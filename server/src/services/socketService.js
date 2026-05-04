const Table = require('../models/Table');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const {
  createGameState, getCardScore, calcScore, canQuickDiscard, shuffle, buildDeck
} = require('./gameService');
const { BOT_ID, botDecideReplace, botShouldBombom, botQuickDiscard } = require('./botService');

const timers = {};  // tableId -> { memo, draw, choice }

function stopTimers(tableId) {
  if (timers[tableId]) {
    clearTimeout(timers[tableId].memo);
    clearTimeout(timers[tableId].draw);
    clearTimeout(timers[tableId].choice);
    clearInterval(timers[tableId].tick);
    delete timers[tableId];
  }
}

module.exports = function initSocket(io) {

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

        const slot = table.players.find(p => p.userId === socket.userId);
        if (!slot) {
          // New player joining
          if (table.players.length >= table.maxPlayers || table.status !== 'waiting')
            return socket.emit('error', { message: 'Table pleine ou partie en cours' });

          const user = await User.findById(socket.userId);
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
          slot.socketId = socket.id;
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

        // Démarrer immédiatement si tous prêts (cas bot)
        if (hasBot && table.players.every(p => p.isReady)) {
          setTimeout(() => startGame(io, table), 500);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Leave table ─────────────────────────────────────────────────────────
    socket.on('table:leave', async ({ tableId }) => {
      try {
        const table = await Table.findById(tableId);
        if (!table) return;
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
        if (!table) return;
        const slot = table.players.find(p => p.userId === socket.userId);
        if (!slot) return;
        slot.isReady = !slot.isReady;
        await table.save();
        io.to(tableId).emit('table:updated', table);

        const allReady = table.players.length >= 2
          && table.players.every(p => p.isReady);
        if (allReady) startGame(io, table);
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

        gs.discardPile.unshift(gs.drawnCard);
        gs.drawnCard = null;
        gs.drawPhase = true;
        advanceTurn(gs);
        table.markModified('gameState');
        await table.save();

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
          // Penalty: add 2 cards
          const penalty = gs.deck.splice(0, 2);
          hand.push(...penalty);
          table.markModified('gameState');
          await table.save();
          io.to(tableId).emit('game:penalty', {
            userId: socket.userId,
            penaltyCards: penalty.length,
          });
          io.to(tableId).emit('game:state', sanitizeState(gs, table.players));
          return;
        }

        // Valid discard
        hand.splice(cardIndex, 1);
        gs.discardPile.unshift(card);
        table.markModified('gameState');
        await table.save();
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
        if (gs.activePower || gs.powers[socket.userId]?.k) return;

        stopTimers(tableId);
        if (!gs.powers[socket.userId]) gs.powers[socket.userId] = {};
        gs.powers[socket.userId].k = true;

        const hand1 = gs.hands[userId1];
        const hand2 = gs.hands[userId2];
        [hand1[idx1], hand2[idx2]] = [hand2[idx2], hand1[idx1]];

        gs.discardPile.unshift(gs.drawnCard);
        gs.drawnCard = null;
        gs.activePower = null;
        gs.drawPhase = true;
        advanceTurn(gs);

        table.markModified('gameState');
        await table.save();

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
      // Update socketId to null for this player in any table
      try {
        const table = await Table.findOne({ 'players.userId': socket.userId });
        if (!table) return;
        const slot = table.players.find(p => p.userId === socket.userId);
        if (slot) { slot.socketId = null; await table.save(); }
        io.to(table._id.toString()).emit('table:updated', table);
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

    // Update user stats
    for (const uid of gs.turnOrder) {
      try {
        const win = uid === gs.winner;
        await User.findByIdAndUpdate(uid, {
          $inc: { gamesPlayed: 1, gamesWon: win ? 1 : 0 },
        });
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
    const gs = createGameState(table.players);
    table.gameState = gs;
    table.status = 'playing';

    Table.findByIdAndUpdate(tableId, { gameState: gs, status: 'playing' }).then(() => {
      io.to(tableId).emit('game:started', { players: table.players });

      // Memorization phase
      const memoDuration = gs.memoDuration;
      let remaining = Math.ceil(memoDuration / 1000);

      // Send each player their hand (hidden from others)
      for (const player of table.players) {
        const sock = getSocketById(io, player.socketId);
        if (sock) sock.emit('game:dealt', {
          myHand: gs.hands[player.userId],
          players: table.players,
        });
      }

      timers[tableId] = {};
      timers[tableId].tick = setInterval(() => {
        remaining--;
        io.to(tableId).emit('game:timer', { phase: 'memorization', remaining });
        if (remaining <= 0) {
          clearInterval(timers[tableId].tick);
          gs.phase = 'playing';
          Table.findByIdAndUpdate(tableId, { 'gameState.phase': 'playing' }).then(() => {
            io.to(tableId).emit('game:phaseChange', { phase: 'playing' });
            io.to(tableId).emit('game:state', sanitizeState(gs, table.players));
            Table.findById(tableId).then(t => { if (t) startDrawTimer(io, t, tableId); });
          });
        }
      }, 1000);
    });
  }

  const DRAW_TIME = 10;
  const CHOICE_TIME = 15;

  function startDrawTimer(io, table, tableId) {
    stopTimers(tableId);
    let remaining = DRAW_TIME;
    const gs = table.gameState;
    if (!gs || gs.phase !== 'playing') return;

    const currentPlayerId = gs.turnOrder[gs.currentTurnIndex];
    io.to(tableId).emit('game:timer', { phase: 'draw', remaining, currentTurn: currentPlayerId });

    // ── Bot draws automatically after 1.5s ──────────────────────────────────
    if (currentPlayerId === BOT_ID) {
      timers[tableId] = {};
      timers[tableId].tick = setTimeout(async () => {
        const t = await Table.findById(tableId);
        if (!t?.gameState || t.gameState.phase !== 'playing') return;
        const botGs = t.gameState;

        // BomBom check before drawing
        if (!botGs.bombomBy && botShouldBombom(botGs.hands[BOT_ID] || [])) {
          botGs.bombomBy = BOT_ID;
          t.markModified('gameState');
          await t.save();
          io.to(tableId).emit('game:bombomDeclared', { userId: BOT_ID });
        }

        // Draw card
        const card = botGs.deck.shift();
        if (!card) return;
        botGs.drawnCard = card;
        botGs.drawPhase = false;
        t.markModified('gameState');
        await t.save();
        io.to(tableId).emit('game:state', sanitizeState(botGs, t.players));

        // Bot decides replace or discard after 1.5s
        setTimeout(async () => {
          const t2 = await Table.findById(tableId);
          if (!t2?.gameState || !t2.gameState.drawnCard) return;
          const gs2 = t2.gameState;
          const hand = gs2.hands[BOT_ID] || [];
          const replaceIdx = botDecideReplace(hand, gs2.drawnCard);

          if (replaceIdx !== null) {
            const old = hand[replaceIdx];
            hand[replaceIdx] = gs2.drawnCard;
            gs2.discardPile.unshift(old);
          } else {
            gs2.discardPile.unshift(gs2.drawnCard);
          }
          gs2.drawnCard = null;
          gs2.drawPhase = true;
          advanceTurn(gs2);
          t2.markModified('gameState');
          await t2.save();
          io.to(tableId).emit('game:state', sanitizeState(gs2, t2.players));
          checkBombomTrigger(io, t2, tableId);
          startDrawTimer(io, t2, tableId);
        }, 1500);
      }, 1500);
      return;
    }

    // ── Human player turn ────────────────────────────────────────────────────
    timers[tableId] = {};
    timers[tableId].tick = setInterval(async () => {
      remaining--;
      io.to(tableId).emit('game:timer', { phase: 'draw', remaining, currentTurn: currentPlayerId });
      if (remaining <= 0) {
        clearInterval(timers[tableId].tick);
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
  }

  function startChoiceTimer(io, table, tableId) {
    stopTimers(tableId);
    let remaining = CHOICE_TIME;
    const gs = table.gameState;

    io.to(tableId).emit('game:timer', { phase: 'choice', remaining, currentTurn: gs.turnOrder[gs.currentTurnIndex] });

    timers[tableId] = {};
    timers[tableId].tick = setInterval(async () => {
      remaining--;
      io.to(tableId).emit('game:timer', { phase: 'choice', remaining, currentTurn: gs.turnOrder[gs.currentTurnIndex] });
      if (remaining <= 0) {
        clearInterval(timers[tableId].tick);
        // Auto discard drawn card
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
  }

  function sanitizeState(gs, players) {
    // Don't send card values of opponents (face-down) — client handles reveals
    return {
      phase: gs.phase,
      discardPile: gs.discardPile.slice(0, 3),
      deckCount: gs.deck.length,
      turnOrder: gs.turnOrder,
      currentTurnIndex: gs.currentTurnIndex,
      bombomBy: gs.bombomBy,
      scores: gs.scores,
      winner: gs.winner,
      handSizes: Object.fromEntries(
        Object.entries(gs.hands).map(([uid, h]) => [uid, h.length])
      ),
    };
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
