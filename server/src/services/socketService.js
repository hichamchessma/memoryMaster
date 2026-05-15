const Table = require('../models/Table');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const {
  createGameState, getCardScore, calcScore, canQuickDiscard, shuffle, buildDeck
} = require('./gameService');
const { BOT_ID, BOT_NAME, botDecideReplace, botShouldBombom, botQuickDiscard } = require('./botService');

const timers = {};       // tableId -> { tick, decide }
const starting = new Set(); // guard contre double startGame

function stopTimers(tableId) {
  if (timers[tableId]) {
    clearTimeout(timers[tableId].tick);
    clearInterval(timers[tableId].tick);
    clearTimeout(timers[tableId].decide);
    delete timers[tableId];
  }
}

const socketInstance = require('./socketInstance');

module.exports = function initSocket(io) {
  socketInstance.set(io);

  // ── Auth middleware ───────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const dec = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = dec.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {

    // ── Join table room ─────────────────────────────────────────────────────
    socket.on('table:join', async ({ tableId }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table) return;

        // ── Dédupliquer : supprimer tout doublon du même userId avant traitement ──
        const beforeLen = table.players.length;
        table.players = table.players.filter(
          (p, i, arr) => arr.findIndex(x => x.userId === p.userId) === i
        );
        if (table.players.length !== beforeLen) table.markModified('players');

        const slot = table.players.find(p => p.userId === socket.userId);
        if (!slot) {
          // Compter uniquement les vrais joueurs (≤ maxPlayers)
          if (table.players.length >= table.maxPlayers || table.status !== 'waiting')
            return socket.emit('error', { message: 'Table pleine ou partie en cours' });

          const user = await User.findById(socket.userId);
          if (!user) return socket.emit('error', { message: 'Utilisateur introuvable' });

          table.players.push({
            userId: socket.userId,
            firstName: user.firstName,
            lastName: user.lastName,
            socketId: socket.id,
            isReady: false,
            isHost: false,
            position: table.players.length,
            elo: user.elo,
          });
        } else {
          slot.socketId = socket.id; // Reconnexion : juste mettre à jour le socket
        }

        // Si table avec bot → marquer le joueur humain comme prêt automatiquement
        const hasBot = table.players.some(p => p.userId === BOT_ID);
        if (hasBot) {
          const humanSlot = table.players.find(p => p.userId === socket.userId);
          if (humanSlot) humanSlot.isReady = true;
        }

        await table.save();
        socket.join(tableId);
        io.to(tableId).emit('table:updated', table);

        // Démarrer si tous les slots maxPlayers sont prêts
        const tid = table._id.toString();
        const activePlayers = table.players.filter(p => p.userId !== BOT_ID || hasBot);
        const allReady = table.players.length >= table.maxPlayers && table.players.every(p => p.isReady);
        if (hasBot && table.status === 'waiting' && allReady && !starting.has(tid)) {
          starting.add(tid);
          setTimeout(() => startGame(io, table), 1500);
        }
        void activePlayers;
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Leave table ─────────────────────────────────────────────────────────
    socket.on('table:leave', async ({ tableId }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table) return;
        // Notify others if a game was in progress
        if (table.status === 'playing') {
          io.to(tableId).emit('game:playerLeft', { userId: socket.userId });
        }
        table.players = table.players.filter(p => p.userId !== socket.userId);
        if (table.players.length === 0) {
          await table.deleteOne();
        } else {
          if (table.hostId === socket.userId) {
            table.hostId = table.players[0].userId;
            table.players[0].isHost = true;
          }
          await table.save();
          io.to(tableId).emit('table:updated', table);
        }
        socket.leave(tableId);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Toggle ready ────────────────────────────────────────────────────────
    socket.on('table:ready', async ({ tableId }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table || table.status !== 'waiting') return;

        // Dédupliquer avant de traiter
        table.players = table.players.filter(
          (p, i, arr) => arr.findIndex(x => x.userId === p.userId) === i
        );

        const slot = table.players.find(p => p.userId === socket.userId);
        if (!slot) return;
        slot.isReady = !slot.isReady;
        await table.save();
        io.to(tableId).emit('table:updated', table);

        const tid2 = table._id.toString();
        // Démarrer seulement quand on a exactement maxPlayers joueurs tous prêts
        const allReady = table.players.length >= table.maxPlayers
          && table.players.every(p => p.isReady);
        if (allReady && !starting.has(tid2)) {
          starting.add(tid2);
          startGame(io, table);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Draw card ───────────────────────────────────────────────────────────
    socket.on('game:draw', async ({ tableId }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        const gs = table.gameState;
        const currentId = gs.turnOrder[gs.currentTurnIndex];
        if (currentId !== socket.userId || !gs.drawPhase) return;

        stopTimers(tableId);

        const card = gs.deck.shift();
        if (!card) return;
        gs.drawnCard = card;
        gs.drawPhase = false;
        table.markModified('gameState');
        await table.save();

        // Notify current player of the drawn card
        const currentSocket = getSocket(io, gs, socket.userId, table);
        if (currentSocket) currentSocket.emit('game:drawn', { card });
        // Notify opponents: a card flew from deck to center (face-down for them)
        io.to(tableId).emit('game:playerAction', { userId: socket.userId, action: 'draw' });
        io.to(tableId).emit('game:state', sanitizeState(gs, table.players));
        startChoiceTimer(io, table, tableId);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Replace card ────────────────────────────────────────────────────────
    socket.on('game:replace', async ({ tableId, cardIndex }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        const gs = table.gameState;
        const currentId = gs.turnOrder[gs.currentTurnIndex];
        if (currentId !== socket.userId || gs.drawPhase || !gs.drawnCard) return;

        stopTimers(tableId);

        const hand = gs.hands[socket.userId];
        const replaced = hand[cardIndex];
        hand[cardIndex] = gs.drawnCard;
        gs.discardPile.unshift(replaced);
        gs.drawnCard = null;
        gs.drawPhase = true;
        advanceTurn(gs);
        table.markModified('gameState');
        await table.save();

        // Opponents see: new card flying to player's hand, old card flying to discard
        io.to(tableId).emit('game:playerAction', { userId: socket.userId, action: 'replace', discardedCard: replaced });
        io.to(tableId).emit('game:state', sanitizeState(gs, table.players));
        checkBombomTrigger(io, table, tableId);
        startDrawTimer(io, table, tableId);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Discard drawn card ──────────────────────────────────────────────────
    socket.on('game:discard', async ({ tableId }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        const gs = table.gameState;
        const currentId = gs.turnOrder[gs.currentTurnIndex];
        if (currentId !== socket.userId || gs.drawPhase || !gs.drawnCard) return;

        stopTimers(tableId);

        const discarded = gs.drawnCard;
        gs.discardPile.unshift(discarded);
        gs.drawnCard = null;
        gs.drawPhase = true;
        advanceTurn(gs);
        table.markModified('gameState');
        await table.save();

        // Opponents see: drawn card (now public) flying from center to discard
        io.to(tableId).emit('game:playerAction', { userId: socket.userId, action: 'discard', card: discarded });
        io.to(tableId).emit('game:state', sanitizeState(gs, table.players));
        checkBombomTrigger(io, table, tableId);
        startDrawTimer(io, table, tableId);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Quick discard ───────────────────────────────────────────────────────
    socket.on('game:quickDiscard', async ({ tableId, cardIndex }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        const gs = table.gameState;
        if (gs.phase !== 'playing') return;

        const hand = gs.hands[socket.userId];
        const card = hand[cardIndex];
        const top = gs.discardPile[0];

        if (!canQuickDiscard(card.value, top)) {
          // 1. Révéler la carte fautive à tous (tout le monde la voit se retourner)
          io.to(tableId).emit('game:penaltyReveal', {
            userId: socket.userId,
            cardValue: card.value,
            cardIndex,
          });

          // 2. Attendre 1.5s (temps de voir la carte) puis appliquer la pénalité
          await new Promise(r => setTimeout(r, 1500));

          const penalty = gs.deck.splice(0, 2);
          hand.push(...penalty);
          table.markModified('gameState');
          await table.save();

          // 3. Envoyer les vraies cartes au joueur pénalisé
          const penSocket = getSocketById(io, table.players.find(p => p.userId === socket.userId)?.socketId);
          if (penSocket) penSocket.emit('game:penaltyCards', { cards: penalty });
          io.to(tableId).emit('game:penalty', { userId: socket.userId, penaltyCards: penalty.length });
          io.to(tableId).emit('game:state', sanitizeState(gs, table.players));
          return;
        }

        // Valid discard
        hand.splice(cardIndex, 1);
        gs.discardPile.unshift(card);
        table.markModified('gameState');
        await table.save();
        // Notif avec la valeur de la carte pour l'animation de vol côté client
        io.to(tableId).emit('game:quickDiscarded', { userId: socket.userId, card });
        io.to(tableId).emit('game:state', sanitizeState(gs, table.players));

        // Check win by empty hand
        if (hand.length === 0) triggerShowtime(io, table, tableId);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Power: Jack ─────────────────────────────────────────────────────────
    socket.on('game:power:jack', async ({ tableId, cardIndex }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        const gs = table.gameState;
        if (!gs.powers) gs.powers = {};
        if (gs.activePower || gs.powers[socket.userId]?.j) return;

        stopTimers(tableId);
        if (!gs.powers[socket.userId]) gs.powers[socket.userId] = {};
        gs.powers[socket.userId].j = true;
        gs.activePower = { type: 'jack', userId: socket.userId };

        const card = gs.hands[socket.userId][cardIndex];
        gs.discardPile.unshift(gs.drawnCard);
        gs.drawnCard = null;

        table.markModified('gameState');
        await table.save();

        // Reveal own card to the player for 3s
        const targetSocket = getSocketById(io, table.players.find(p => p.userId === socket.userId)?.socketId);
        if (targetSocket) targetSocket.emit('game:revealCard', { card, duration: 3000 });

        io.to(tableId).emit('game:powerActivated', { userId: socket.userId, power: 'jack' });

        setTimeout(async () => {
          const t = await Table.findById(tableId);
          if (!t?.gameState) return;
          t.gameState.activePower = null;
          t.gameState.drawPhase = true;
          advanceTurn(t.gameState);
          t.markModified('gameState');
          await t.save();
          io.to(tableId).emit('game:state', sanitizeState(t.gameState, t.players));
          startDrawTimer(io, t, tableId);
        }, 3500);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Power: Queen ────────────────────────────────────────────────────────
    socket.on('game:power:queen', async ({ tableId, targetUserId, cardIndex }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        const gs = table.gameState;
        if (!gs.powers) gs.powers = {};
        if (gs.activePower || gs.powers[socket.userId]?.q) return;

        stopTimers(tableId);
        if (!gs.powers[socket.userId]) gs.powers[socket.userId] = {};
        gs.powers[socket.userId].q = true;
        gs.activePower = { type: 'queen', userId: socket.userId };

        const card = gs.hands[targetUserId]?.[cardIndex];
        gs.discardPile.unshift(gs.drawnCard);
        gs.drawnCard = null;

        table.markModified('gameState');
        await table.save();

        const currentSocket = getSocketById(io, table.players.find(p => p.userId === socket.userId)?.socketId);
        if (currentSocket && card) currentSocket.emit('game:revealCard', { card, duration: 3000 });

        io.to(tableId).emit('game:powerActivated', { userId: socket.userId, power: 'queen' });

        setTimeout(async () => {
          const t = await Table.findById(tableId);
          if (!t?.gameState) return;
          t.gameState.activePower = null;
          t.gameState.drawPhase = true;
          advanceTurn(t.gameState);
          t.markModified('gameState');
          await t.save();
          io.to(tableId).emit('game:state', sanitizeState(t.gameState, t.players));
          startDrawTimer(io, t, tableId);
        }, 3500);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Power: King ─────────────────────────────────────────────────────────
    socket.on('game:power:king', async ({ tableId, userId1, idx1, userId2, idx2 }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        const gs = table.gameState;
        if (!gs.powers) gs.powers = {};
        if (gs.activePower || gs.powers[socket.userId]?.k) return;

        stopTimers(tableId);
        if (!gs.powers[socket.userId]) gs.powers[socket.userId] = {};
        gs.powers[socket.userId].k = true;

        const hand1 = gs.hands[userId1];
        const hand2 = gs.hands[userId2];
        if (!hand1 || !hand2) return socket.emit('error', { message: 'Cartes invalides' });
        [hand1[idx1], hand2[idx2]] = [hand2[idx2], hand1[idx1]];

        if (gs.drawnCard) gs.discardPile.unshift(gs.drawnCard);
        gs.drawnCard = null;
        gs.activePower = null;
        gs.drawPhase = true;
        advanceTurn(gs);

        table.markModified('gameState');
        await table.save();

        // Animation de l'échange (sans révéler les valeurs)
        io.to(tableId).emit('game:kingSwap', { userId1, idx1, userId2, idx2 });
        // Envoyer la main mise à jour à chaque joueur concerné
        const kSock1 = getSocketById(io, table.players.find(p => p.userId === userId1)?.socketId);
        if (kSock1) kSock1.emit('game:handUpdate', { hand: gs.hands[userId1] });
        if (userId2 !== userId1) {
          const kSock2 = getSocketById(io, table.players.find(p => p.userId === userId2)?.socketId);
          if (kSock2) kSock2.emit('game:handUpdate', { hand: gs.hands[userId2] });
        }

        io.to(tableId).emit('game:powerActivated', { userId: socket.userId, power: 'king' });
        io.to(tableId).emit('game:state', sanitizeState(gs, table.players));
        startDrawTimer(io, table, tableId);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── BomBom ──────────────────────────────────────────────────────────────
    socket.on('game:bombom', async ({ tableId }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        const gs = table.gameState;
        const currentId = gs.turnOrder[gs.currentTurnIndex];
        if (currentId !== socket.userId || gs.bombomBy) return;
        gs.bombomBy = socket.userId;
        table.markModified('gameState');
        await table.save();
        io.to(tableId).emit('game:bombomDeclared', { userId: socket.userId });
        io.to(tableId).emit('game:state', sanitizeState(gs, table.players));
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Cancel BomBom ────────────────────────────────────────────────────────
    socket.on('game:cancelBombom', async ({ tableId }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        const gs = table.gameState;
        if (!gs.bombomCancelUsed) gs.bombomCancelUsed = {};
        gs.bombomCancelUsed[socket.userId] = true;
        table.markModified('gameState');
        await table.save();
        io.to(tableId).emit('game:bombomCancelled', { userId: socket.userId });
        io.to(tableId).emit('game:state', sanitizeState(gs, table.players));
        startDrawTimer(io, table, tableId);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Mise à jour de la config par l'hôte (salle d'attente) ─────────────
    socket.on('table:updateConfig', async ({ tableId, gameConfig }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table || table.status !== 'waiting' || table.hostId !== socket.userId) return;

        const cfg = gameConfig || {};
        if ([4, 6, 8].includes(cfg.cardsPerPlayer))
          table.gameConfig.cardsPerPlayer = cfg.cardsPerPlayer;
        if (Number.isFinite(cfg.memoDuration) && cfg.memoDuration >= 3 && cfg.memoDuration <= 30)
          table.gameConfig.memoDuration = Math.round(cfg.memoDuration);
        if (Number.isFinite(cfg.drawTime) && cfg.drawTime >= 5 && cfg.drawTime <= 60)
          table.gameConfig.drawTime = Math.round(cfg.drawTime);
        if (Number.isFinite(cfg.choiceTime) && cfg.choiceTime >= 5 && cfg.choiceTime <= 60)
          table.gameConfig.choiceTime = Math.round(cfg.choiceTime);

        table.markModified('gameConfig');
        await table.save();
        io.to(tableId).emit('table:updated', table);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Chat en jeu ────────────────────────────────────────────────────────
    socket.on('game:chat', async ({ tableId, message }) => {
      if (!message?.trim() || message.length > 120) return;
      try {
        const table = await Table.findById(tableId);
        if (!table) return;
        const player = table.players.find(p => p.userId === socket.userId);
        if (!player) return;
        io.to(tableId).emit('game:chatMessage', {
          userId:    socket.userId,
          firstName: player.firstName,
          message:   message.trim(),
          timestamp: Date.now(),
        });
      } catch {}
    });

    // ── Ajouter un bot à la table (bouton test 2 joueurs) ──────────────────
    socket.on('table:addBot', async ({ tableId }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table || table.status !== 'waiting') return;
        if (table.players.some(p => p.userId === BOT_ID)) return;
        if (table.players.length >= table.maxPlayers) return;

        // Ajouter le bot
        table.players.push({
          userId:    BOT_ID,
          firstName: BOT_NAME.firstName,
          lastName:  BOT_NAME.lastName,
          socketId:  null,
          isHost:    false,
          isReady:   true,
          position:  table.players.length,
          elo:       1000,
        });
        // Auto-ready tous les joueurs humains présents
        table.players.forEach(p => { if (p.userId !== BOT_ID) p.isReady = true; });
        table.markModified('players');
        await table.save();

        io.to(tableId).emit('table:updated', table);

        const tid = table._id.toString();
        const allReady = table.players.length >= table.maxPlayers && table.players.every(p => p.isReady);
        if (allReady && !starting.has(tid)) {
          starting.add(tid);
          setTimeout(() => startGame(io, table), 1200);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Resync state (reconnexion / bot) ────────────────────────────────────
    socket.on('game:requestState', async ({ tableId }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        const gs = table.gameState;
        if (gs.phase === 'finished') return;

        // Renvoyer l'état de jeu au client qui demande
        socket.emit('game:started', { players: table.players });
        socket.emit('game:dealt', {
          myHand: gs.hands[socket.userId] || [],
          players: table.players,
        });
        socket.emit('game:state', sanitizeState(gs, table.players));
      } catch {}
    });

    // ══════════════════════════════════════════════════════════════════════════
    // ── DEBUG / TEST events (à supprimer en production) ─────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    // Révéler toutes les mains à tout le monde 3s
    socket.on('debug:revealAll', async ({ tableId }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        io.to(tableId).emit('debug:allHands', { hands: table.gameState.hands });
      } catch {}
    });

    // Forcer la prochaine carte piochée (mettre label en tête de deck)
    socket.on('debug:forceCard', async ({ tableId, label }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        const gs = table.gameState;
        const rankMap = { 'A':0,'2':1,'3':2,'4':3,'5':4,'6':5,'7':6,'8':7,'9':8,'10':9,'J':10,'Q':11,'K':12 };
        let idx = -1;
        if (label === 'Jok1') {
          idx = gs.deck.findIndex((c) => c.value >= 104 && c.value <= 109);
        } else if (label === 'Jok2') {
          idx = gs.deck.findIndex((c) => c.value >= 110 && c.value <= 115);
        } else {
          const rank = rankMap[label];
          if (rank !== undefined) idx = gs.deck.findIndex((c) => c.value % 13 === rank);
        }
        if (idx > 0) {
          const [card] = gs.deck.splice(idx, 1);
          gs.deck.unshift(card);
          table.markModified('gameState');
          await table.save();
          socket.emit('debug:cardForced', { label });
        }
      } catch {}
    });

    // Supprimer une carte de la main du joueur
    socket.on('debug:removeCard', async ({ tableId, cardIndex }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        const gs = table.gameState;
        const hand = gs.hands[socket.userId];
        if (!hand || cardIndex >= hand.length) return;
        const [removed] = hand.splice(cardIndex, 1);
        gs.discardPile.unshift(removed);
        table.markModified('gameState');
        await table.save();
        socket.emit('debug:handUpdated', { hand });
        io.to(tableId).emit('game:state', sanitizeState(gs, table.players));
      } catch {}
    });

    // Scores instantanés (sans déclencher showtime)
    socket.on('debug:scores', async ({ tableId }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        const gs = table.gameState;
        const { calcScore } = require('./gameService');
        const scores = {};
        for (const uid of gs.turnOrder) scores[uid] = calcScore(gs.hands[uid] || []);
        socket.emit('debug:scoresResult', { scores, hands: gs.hands, players: table.players });
      } catch {}
    });
    // ══════════════════════════════════════════════════════════════════════════

    // ── Trigger ShowTime manually ────────────────────────────────────────────
    socket.on('game:showtime', async ({ tableId }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table?.gameState) return;
        triggerShowtime(io, table, tableId);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('disconnect', async () => {
      try {
        const table = await Table.findOne({ 'players.userId': socket.userId });
        if (table) {
          if (table.status === 'playing') {
            io.to(table._id.toString()).emit('game:playerLeft', { userId: socket.userId });
          }
          const slot = table.players.find(p => p.userId === socket.userId);
          if (slot) { slot.socketId = null; await table.save(); }
          io.to(table._id.toString()).emit('table:updated', table);
        }
        // Supprimer le compte guest dès qu'il n'est plus en partie active
        if (!table || table.status !== 'playing') {
          await User.deleteOne({ _id: socket.userId, isGuest: true });
        }
      } catch {}
    });
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function advanceTurn(gs) {
    gs.currentTurnIndex = (gs.currentTurnIndex + 1) % gs.turnOrder.length;
  }

  function checkBombomTrigger(io, table, tableId) {
    const gs = table.gameState;
    if (!gs.bombomBy) return;
    const currentId = gs.turnOrder[gs.currentTurnIndex];
    if (currentId !== gs.bombomBy) return;

    // BomBom player's turn again
    const cancelUsed = gs.bombomCancelUsed?.[gs.bombomBy];
    if (!cancelUsed) {
      // Offer cancel
      const bombomSocket = getSocketById(io, table.players.find(p => p.userId === gs.bombomBy)?.socketId);
      if (bombomSocket) bombomSocket.emit('game:bombomPrompt', { canCancel: true });
    } else {
      // Mandatory showtime
      triggerShowtime(io, table, tableId);
    }
  }

  async function triggerShowtime(io, table, tableId) {
    stopTimers(tableId);
    const gs = table.gameState;
    gs.phase = 'showtime';

    const scores = {};
    for (const uid of gs.turnOrder) {
      scores[uid] = calcScore(gs.hands[uid]);
    }
    gs.scores = scores;

    const minScore = Math.min(...Object.values(scores));
    const winners = Object.entries(scores).filter(([, s]) => s === minScore).map(([uid]) => uid);
    gs.winner = winners[0];
    gs.phase = 'finished';

    table.markModified('gameState');
    await table.save();

    // Update user stats — skip bots and guests
    for (const uid of gs.turnOrder) {
      if (uid === BOT_ID) continue;
      try {
        const win = uid === gs.winner;
        await User.findOneAndUpdate(
          { _id: uid, isGuest: { $ne: true } },
          { $inc: { gamesPlayed: 1, gamesWon: win ? 1 : 0 } }
        );
      } catch {}
    }

    io.to(tableId).emit('game:showtime', {
      hands: gs.hands,
      scores,
      winner: gs.winner,
      players: table.players,
    });
  }

  function startGame(io, table) {
    const tableId = table._id.toString();
    starting.delete(tableId);
    const gs = createGameState(table.players, table.gameConfig || {});
    table.gameState = gs;
    table.status = 'playing';

    Table.findByIdAndUpdate(tableId, { gameState: gs, status: 'playing' }).then(() => {
      io.to(tableId).emit('game:started', { players: table.players });

      const memoDuration = gs.memoDuration;
      let remaining = Math.ceil(memoDuration / 1000);

      for (const player of table.players) {
        const sock = getSocketById(io, player.socketId);
        if (sock) sock.emit('game:dealt', {
          myHand: gs.hands[player.userId],
          players: table.players,
        });
      }

      // Envoyer l'état initial pendant la mémo (pour le deck count)
      io.to(tableId).emit('game:state', sanitizeState(gs, table.players));

      timers[tableId] = {};
      const memoTick = setInterval(() => {
        if (!timers[tableId]) { clearInterval(memoTick); return; }
        remaining--;
        io.to(tableId).emit('game:timer', { phase: 'memorization', remaining });
        if (remaining <= 0) {
          clearInterval(memoTick);
          if (!timers[tableId]) return;
          gs.phase = 'playing';
          Table.findByIdAndUpdate(tableId, { 'gameState.phase': 'playing' }).then(() => {
            io.to(tableId).emit('game:phaseChange', { phase: 'playing' });
            io.to(tableId).emit('game:state', sanitizeState(gs, table.players));
            Table.findById(tableId).then(t => { if (t) startDrawTimer(io, t, tableId); });
          });
        }
      }, 1000);
      timers[tableId].tick = memoTick;
    });
  }

  const BOT_DRAW_DELAY   = 2500;
  const BOT_DECIDE_DELAY = 2000;

  function startDrawTimer(io, table, tableId) {
    stopTimers(tableId);
    if (!table?.gameState || table.gameState.phase !== 'playing') return;

    const gs = table.gameState;
    const currentPlayerId = gs.turnOrder[gs.currentTurnIndex];
    const DRAW_TIME = table.gameConfig?.drawTime || 10;
    let remaining = DRAW_TIME;

    io.to(tableId).emit('game:timer', { phase: 'draw', remaining, currentTurn: currentPlayerId });

    // ── Bot turn ─────────────────────────────────────────────────────────────
    if (currentPlayerId === BOT_ID) {
      timers[tableId] = {};
      const botTimeout = setTimeout(async () => {
        if (!timers[tableId]) return;
        const t = await Table.findById(tableId);
        if (!t?.gameState || t.gameState.phase !== 'playing') return;
        const botGs = t.gameState;

        if (!botGs.bombomBy && botShouldBombom(botGs.hands[BOT_ID] || [])) {
          botGs.bombomBy = BOT_ID;
          t.markModified('gameState');
          await t.save();
          io.to(tableId).emit('game:bombomDeclared', { userId: BOT_ID });
        }

        const card = botGs.deck.shift();
        if (!card) return;
        botGs.drawnCard = card;
        botGs.drawPhase = false;
        t.markModified('gameState');
        await t.save();
        // Notifier le client que le bot pioche (pour animation)
        io.to(tableId).emit('game:playerAction', { userId: BOT_ID, action: 'draw' });
        io.to(tableId).emit('game:state', sanitizeState(botGs, t.players));

        // Bot decide after BOT_DECIDE_DELAY
        const decideTimeout = setTimeout(async () => {
          const t2 = await Table.findById(tableId);
          if (!t2?.gameState || !t2.gameState.drawnCard) return;
          const gs2 = t2.gameState;
          const hand = gs2.hands[BOT_ID] || [];
          const replaceIdx = botDecideReplace(hand, gs2.drawnCard);
          const action = replaceIdx !== null ? 'replace' : 'discard';

          let discardedCard = null;
          if (replaceIdx !== null) {
            const old = hand[replaceIdx];
            discardedCard = old;
            hand[replaceIdx] = gs2.drawnCard;
            gs2.discardPile.unshift(old);
          } else {
            discardedCard = gs2.drawnCard;
            gs2.discardPile.unshift(gs2.drawnCard);
          }
          gs2.drawnCard = null;
          gs2.drawPhase = true;
          advanceTurn(gs2);
          t2.markModified('gameState');
          await t2.save();
          io.to(tableId).emit('game:playerAction', { userId: BOT_ID, action, discardedCard });
          io.to(tableId).emit('game:state', sanitizeState(gs2, t2.players));
          checkBombomTrigger(io, t2, tableId);
          startDrawTimer(io, t2, tableId);
        }, BOT_DECIDE_DELAY);

        if (timers[tableId]) timers[tableId].decide = decideTimeout;
        else clearTimeout(decideTimeout);
      }, BOT_DRAW_DELAY);

      timers[tableId].tick = botTimeout;
      return;
    }

    // ── Human turn ────────────────────────────────────────────────────────────
    timers[tableId] = {};
    const drawTick = setInterval(async () => {
      if (!timers[tableId]) { clearInterval(drawTick); return; }
      remaining--;
      io.to(tableId).emit('game:timer', { phase: 'draw', remaining, currentTurn: currentPlayerId });
      if (remaining <= 0) {
        clearInterval(drawTick);
        if (!timers[tableId]) return;
        const t = await Table.findById(tableId);
        if (!t?.gameState || t.gameState.phase !== 'playing') return;
        const card = t.gameState.deck.shift();
        if (!card) return;
        t.gameState.discardPile.unshift(card);
        t.gameState.drawPhase = true;
        advanceTurn(t.gameState);
        t.markModified('gameState');
        await t.save();
        io.to(tableId).emit('game:state', sanitizeState(t.gameState, t.players));
        checkBombomTrigger(io, t, tableId);
        startDrawTimer(io, t, tableId);
      }
    }, 1000);
    timers[tableId].tick = drawTick;
  }

  function startChoiceTimer(io, table, tableId) {
    stopTimers(tableId);
    const CHOICE_TIME = table.gameConfig?.choiceTime || 15;
    let remaining = CHOICE_TIME;
    const gs = table.gameState;

    io.to(tableId).emit('game:timer', { phase: 'choice', remaining, currentTurn: gs.turnOrder[gs.currentTurnIndex] });

    timers[tableId] = {};
    const choiceTick = setInterval(async () => {
      if (!timers[tableId]) { clearInterval(choiceTick); return; }
      remaining--;
      io.to(tableId).emit('game:timer', { phase: 'choice', remaining, currentTurn: gs.turnOrder[gs.currentTurnIndex] });
      if (remaining <= 0) {
        clearInterval(choiceTick);
        if (!timers[tableId]) return;
        const t = await Table.findById(tableId);
        if (!t?.gameState || !t.gameState.drawnCard) return;
        t.gameState.discardPile.unshift(t.gameState.drawnCard);
        t.gameState.drawnCard = null;
        t.gameState.drawPhase = true;
        advanceTurn(t.gameState);
        t.markModified('gameState');
        await t.save();
        io.to(tableId).emit('game:state', sanitizeState(t.gameState, t.players));
        checkBombomTrigger(io, t, tableId);
        startDrawTimer(io, t, tableId);
      }
    }, 1000);
    timers[tableId].tick = choiceTick;
  }

  function sanitizeState(gs, players) {
    return {
      phase: gs.phase,
      drawPhase: !!gs.drawPhase,
      discardPile: (gs.discardPile || []).slice(0, 3),
      deckCount: (gs.deck || []).length,
      turnOrder: gs.turnOrder || [],
      currentTurnIndex: gs.currentTurnIndex || 0,
      bombomBy: gs.bombomBy || null,
      bombomCancelUsed: gs.bombomCancelUsed || {},
      activePower: gs.activePower || null,
      powers: gs.powers || {},
      scores: gs.scores || {},
      winner: gs.winner || null,
      cardsPerPlayer: gs.cardsPerPlayer || 4,
      handSizes: Object.fromEntries(
        Object.entries(gs.hands || {}).map(([uid, h]) => [uid, Array.isArray(h) ? h.length : 0])
      ),
    };
    void players;
  }

  function getSocketById(io, socketId) {
    if (!socketId) return null;
    return io.sockets.sockets.get(socketId) || null;
  }

  function getSocket(io, gs, userId, table) {
    const player = table.players.find(p => p.userId === userId);
    return getSocketById(io, player?.socketId);
  }
};
