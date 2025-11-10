const Game = require('../models/Game');
const User = require('../models/User');
const { calculateCardPoints } = require('../utils/gameUtils');

// Stocker les connexions actives
const activeConnections = new Map();

// Stocker les timers actifs par table
// Structure: { tableId: { memoTimer, gameTimer, choiceTimer, currentPhase } }
const activeTimers = new Map();

/**
 * Démarrer le timer de mémorisation (2 secondes)
 * Ce timer n'existe que pendant la phase de mémorisation initiale
 */
function startMemorizationTimer(io, tableId, duration = 2) {
  console.log(`🧠 Starting memorization timer for table ${tableId} (${duration}s)`);
  
  // IMPORTANT: Arrêter TOUS les timers existants avant d'en démarrer un nouveau
  stopAllTimers(tableId);
  
  // Récupérer ou créer l'objet timers
  const timers = activeTimers.get(tableId) || {};
  
  // Vérification de sécurité: s'assurer qu'aucun timer n'est actif
  if (timers.memoTimer || timers.gameTimer || timers.choiceTimer) {
    console.error(`⚠️ Attempting to start memo timer but other timers are still active for table ${tableId}!`);
    // Arrêter tous les timers pour éviter les chevauchements
    stopAllTimers(tableId);
  }
  
  let timeLeft = duration;
  
  // Définir clairement la phase actuelle
  timers.currentPhase = 'memorization';
  timers.memoTimeLeft = timeLeft;
  timers.gameTimeLeft = 0; // Mettre à zéro les autres timers
  timers.choiceTimeLeft = 0;
  
  activeTimers.set(tableId, timers);
  
  // Émettre l'état initial
  io.to(`table_${tableId}`).emit('game:timer_update', {
    phase: 'memorization',
    memoTimeLeft: timeLeft,
    gameTimeLeft: 0,
    choiceTimeLeft: 0
  });
  
  const interval = setInterval(() => {
    timeLeft--;
    timers.memoTimeLeft = timeLeft;
    
    io.to(`table_${tableId}`).emit('game:timer_update', {
      phase: 'memorization',
      memoTimeLeft: timeLeft,
      gameTimeLeft: 0,
      choiceTimeLeft: 0
    });
    
    if (timeLeft <= 0) {
      clearInterval(interval);
      timers.memoTimer = null;
      console.log(`✅ Memorization phase ended for table ${tableId}`);
      // La phase de jeu démarrera via game:turn_changed
    }
  }, 1000);
  
  timers.memoTimer = interval;
  console.log(`✅ Memorization timer started for table ${tableId} - Duration: ${duration}s`);
}

/**
 * Démarrer le timer de jeu (5 secondes par tour)
 * Ce timer n'existe que pendant la phase où le joueur doit piocher une carte
 */
function startGameTimer(io, tableId, duration = 5) {
  console.log(`🎮 Starting game timer for table ${tableId} (${duration}s)`);
  
  // IMPORTANT: Arrêter TOUS les timers existants avant d'en démarrer un nouveau
  stopAllTimers(tableId);
  
  // Récupérer ou créer l'objet timers
  const timers = activeTimers.get(tableId) || {};
  
  // Vérification de sécurité: s'assurer qu'aucun timer n'est actif
  if (timers.memoTimer || timers.gameTimer || timers.choiceTimer) {
    console.error(`⚠️ Attempting to start game timer but other timers are still active for table ${tableId}!`);
    // Arrêter tous les timers pour éviter les chevauchements
    stopAllTimers(tableId);
  }
  
  // Vérifier si un pouvoir est actif
  if (timers.activePower) {
    console.log(`⚠️ Cannot start game timer while power is active: ${JSON.stringify(timers.activePower)}`);
    return; // Ne pas démarrer le timer si un pouvoir est actif
  }
  
  let timeLeft = duration;
  
  // Définir clairement la phase actuelle
  timers.currentPhase = 'game';
  timers.gameTimeLeft = timeLeft;
  timers.memoTimeLeft = 0; // Mettre à zéro les autres timers
  timers.choiceTimeLeft = 0;
  
  activeTimers.set(tableId, timers);
  
  // Émettre l'état initial
  io.to(`table_${tableId}`).emit('game:timer_update', {
    phase: 'game',
    memoTimeLeft: 0,
    gameTimeLeft: timeLeft,
    choiceTimeLeft: 0
  });
  
  const interval = setInterval(() => {
    timeLeft--;
    timers.gameTimeLeft = timeLeft;
    
    io.to(`table_${tableId}`).emit('game:timer_update', {
      phase: 'game',
      memoTimeLeft: 0,
      gameTimeLeft: timeLeft,
      choiceTimeLeft: 0
    });
    
    if (timeLeft <= 0) {
      clearInterval(interval);
      timers.gameTimer = null;
      console.log(`⏰ Game timer reached 0 for table ${tableId} - waiting for client timeout event`);
    }
  }, 1000);
  
  timers.gameTimer = interval;
  console.log(`✅ Game timer started for table ${tableId} - Duration: ${duration}s`);
}

/**
 * Démarrer le timer de choix (10 secondes pour choisir quoi faire avec la carte piochée)
 * Ce timer n'existe que pendant la phase où le joueur a pioché et doit prendre une décision
 */
function startChoiceTimer(io, tableId, duration = 10) {
  console.log(`⏱️ Starting choice timer for table ${tableId} (${duration}s)`);
  
  // IMPORTANT: Arrêter TOUS les timers existants avant d'en démarrer un nouveau
  stopAllTimers(tableId);
  
  // Récupérer ou créer l'objet timers
  const timers = activeTimers.get(tableId) || {};
  
  // Vérification de sécurité: s'assurer qu'aucun timer n'est actif
  if (timers.memoTimer || timers.gameTimer || timers.choiceTimer) {
    console.error(`⚠️ Attempting to start choice timer but other timers are still active for table ${tableId}!`);
    // Arrêter tous les timers pour éviter les chevauchements
    stopAllTimers(tableId);
  }
  
  // Vérifier si un pouvoir est actif
  if (timers.activePower) {
    console.log(`⚠️ Cannot start choice timer while power is active: ${JSON.stringify(timers.activePower)}`);
    return; // Ne pas démarrer le timer si un pouvoir est actif
  }
  
  let timeLeft = duration;
  
  // Définir clairement la phase actuelle
  timers.currentPhase = 'choice';
  timers.choiceTimeLeft = timeLeft;
  timers.memoTimeLeft = 0; // Mettre à zéro les autres timers
  timers.gameTimeLeft = 0;
  
  activeTimers.set(tableId, timers);
  
  // Émettre l'état initial
  io.to(`table_${tableId}`).emit('game:timer_update', {
    phase: 'choice',
    memoTimeLeft: 0,
    gameTimeLeft: 0,
    choiceTimeLeft: timeLeft
  });
  
  const interval = setInterval(() => {
    timeLeft--;
    timers.choiceTimeLeft = timeLeft;
    
    io.to(`table_${tableId}`).emit('game:timer_update', {
      phase: 'choice',
      memoTimeLeft: 0,
      gameTimeLeft: 0,
      choiceTimeLeft: timeLeft
    });
    
    if (timeLeft <= 0) {
      clearInterval(interval);
      timers.choiceTimer = null;
      console.log(`⏰ Choice timer reached 0 for table ${tableId} - waiting for client timeout event`);
    }
  }, 1000);
  
  timers.choiceTimer = interval;
  console.log(`✅ Choice timer started for table ${tableId} - Duration: ${duration}s`);
}

/**
 * Arrêter TOUS les timers d'une table et supprimer l'entrée
 * À utiliser uniquement quand la table est supprimée
 */
function clearAllTimers(tableId) {
  const timers = activeTimers.get(tableId);
  if (timers) {
    if (timers.memoTimer) clearInterval(timers.memoTimer);
    if (timers.gameTimer) clearInterval(timers.gameTimer);
    if (timers.choiceTimer) clearInterval(timers.choiceTimer);
    activeTimers.delete(tableId);
    console.log(`🗑️ All timers cleared and removed for table ${tableId}`);
  }
}

/**
 * Arrêter TOUS les timers d'une table mais conserver l'entrée
 * À utiliser avant de démarrer un nouveau timer
 */
function stopAllTimers(tableId) {
  const timers = activeTimers.get(tableId);
  if (timers) {
    // Arrêter tous les timers
    let timersCount = 0;
    
    if (timers.memoTimer) {
      clearInterval(timers.memoTimer);
      timers.memoTimer = null;
      timersCount++;
      console.log(`⏸️ Memo timer stopped for table ${tableId}`);
    }
    
    if (timers.gameTimer) {
      clearInterval(timers.gameTimer);
      timers.gameTimer = null;
      timersCount++;
      console.log(`⏸️ Game timer stopped for table ${tableId}`);
    }
    
    if (timers.choiceTimer) {
      clearInterval(timers.choiceTimer);
      timers.choiceTimer = null;
      timersCount++;
      console.log(`⏸️ Choice timer stopped for table ${tableId}`);
    }
    
    // Conserver l'entrée dans la Map mais avec tous les timers arrêtés
    activeTimers.set(tableId, timers);
    
    if (timersCount > 0) {
      console.log(`⚠️ ${timersCount} timers were running simultaneously and have been stopped for table ${tableId}`);
    } else {
      console.log(`✅ No active timers found for table ${tableId}`);
    }
    
    // Afficher l'état actuel des timers
    console.log(`📊 Timer state for table ${tableId}:`, {
      phase: timers.currentPhase || 'none',
      memoTimer: timers.memoTimer !== null,
      gameTimer: timers.gameTimer !== null,
      choiceTimer: timers.choiceTimer !== null,
      activePower: timers.activePower || 'none'
    });
  }
}

/**
 * Arrêter uniquement le timer de mémorisation d'une table
 * @deprecated Utiliser stopAllTimers() à la place
 */
function clearMemoTimer(tableId) {
  const timers = activeTimers.get(tableId);
  if (timers && timers.memoTimer) {
    clearInterval(timers.memoTimer);
    timers.memoTimer = null;
    console.log(`⏸️ Memo timer cleared for table ${tableId}`);
    activeTimers.set(tableId, timers);
  }
}

/**
 * Arrêter uniquement le timer de jeu d'une table
 * @deprecated Utiliser stopAllTimers() à la place
 */
function clearGameTimer(tableId) {
  const timers = activeTimers.get(tableId);
  if (timers && timers.gameTimer) {
    clearInterval(timers.gameTimer);
    timers.gameTimer = null;
    console.log(`⏸️ Game timer paused for table ${tableId}`);
    activeTimers.set(tableId, timers);
  }
}

/**
 * Arrêter uniquement le timer de choix d'une table
 * @deprecated Utiliser stopAllTimers() à la place
 */
function clearChoiceTimer(tableId) {
  const timers = activeTimers.get(tableId);
  if (timers && timers.choiceTimer) {
    clearInterval(timers.choiceTimer);
    timers.choiceTimer = null;
    console.log(`⏸️ Choice timer paused for table ${tableId}`);
    activeTimers.set(tableId, timers);
  }
}

/**
 * Générer un deck de 52 cartes + 6 jokers
 * @returns {Array<number>} Tableau de valeurs de cartes (0-51 pour cartes normales, 104-115 pour jokers)
 */
function generateDeck() {
  const deck = [];
  
  // 52 cartes normales (0-51)
  for (let i = 0; i < 52; i++) {
    deck.push(i);
  }
  
  // 6 jokers (104-109 = Joker type 1, 110-115 = Joker type 2)
  for (let i = 104; i < 110; i++) {
    deck.push(i);
  }
  for (let i = 110; i < 116; i++) {
    deck.push(i);
  }
  
  return deck;
}

/**
 * Mélanger un tableau (Fisher-Yates shuffle)
 */
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Distribuer les cartes aux joueurs
 * @param {Array} players - Liste des joueurs
 * @param {number} cardsPerPlayer - Nombre de cartes par joueur
 * @returns {Object} { playerCards, deckRemaining }
 */
function dealCards(players, cardsPerPlayer) {
  const deck = shuffleDeck(generateDeck());
  const playerCards = {};
  let cardIndex = 0;
  
  // Distribuer les cartes à chaque joueur
  players.forEach(player => {
    const cards = [];
    for (let i = 0; i < cardsPerPlayer; i++) {
      cards.push({
        id: `card-${player.user}-${i}`,
        value: deck[cardIndex],
        isFlipped: false,
        isVisible: false,
        position: i
      });
      cardIndex++;
    }
    playerCards[player.user.toString()] = cards;
  });
  
  // Cartes restantes dans le deck (convertir en objets)
  const deckRemaining = deck.slice(cardIndex).map((value, index) => ({
    id: `deck-card-${index}`,
    value: value,
    isFlipped: false,
    isVisible: false,
    position: index
  }));
  
  return { playerCards, deckRemaining };
}

// Configurer les gestionnaires d'événements Socket.IO
exports.setupSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`Nouvelle connexion: ${socket.id}`);

    // Événement lorsqu'un joueur rejoint une partie
    socket.on('join_game', async ({ gameCode, userId }) => {
      try {
        // Vérifier que l'utilisateur existe
        const user = await User.findById(userId);
        if (!user) {
          return socket.emit('error', { message: 'Utilisateur non trouvé' });
        }

        // Trouver la partie
        const game = await Game.findOne({ code: gameCode });
        if (!game) {
          return socket.emit('error', { message: 'Partie non trouvée' });
        }

        // Vérifier si le joueur est déjà dans la partie
        let player = game.players.find(p => p.user.toString() === userId);
        
        if (!player) {
          // Vérifier s'il reste de la place
          if (game.players.length >= game.maxPlayers) {
            return socket.emit('error', { message: 'La partie est complète' });
          }
          
          // Ajouter le joueur à la partie
          player = {
            user: userId,
            socketId: socket.id,
            position: game.players.length + 1,
            cards: [],
            score: 0,
            hasThrown: false,
            hasBombom: false,
            isEliminated: false
          };
          
          game.players.push(player);
          await game.save();
        } else {
          // Mettre à jour le socketId du joueur existant
          player.socketId = socket.id;
          await game.save();
        }

        // Enregistrer la connexion
        activeConnections.set(socket.id, { userId, gameCode });
        
        // Rejoindre la salle de la partie
        socket.join(gameCode);
        
        // Informer tous les joueurs de la mise à jour
        io.to(gameCode).emit('game_updated', await getGameState(game));
        
      } catch (error) {
        console.error('Erreur lors de la connexion à la partie:', error);
        socket.emit('error', { message: 'Erreur lors de la connexion à la partie' });
      }
    });

    // Événement lorsqu'un joueur quitte la partie
    socket.on('leave_game', async () => {
      try {
        const connection = activeConnections.get(socket.id);
        if (!connection) return;

        const { userId, gameCode } = connection;
        const game = await Game.findOne({ code: gameCode });
        
        if (game) {
          // Retirer le joueur de la partie
          game.players = game.players.filter(p => p.user.toString() !== userId);
          
          // Si c'était l'hôte, désigner un nouvel hôte
          if (game.host.toString() === userId && game.players.length > 0) {
            game.host = game.players[0].user;
          }
          
          // Si plus de joueurs, supprimer la partie
          if (game.players.length === 0) {
            await Game.deleteOne({ _id: game._id });
          } else {
            await game.save();
            // Informer les autres joueurs
            io.to(gameCode).emit('game_updated', await getGameState(game));
          }
        }
        
        // Quitter la salle
        socket.leave(gameCode);
        activeConnections.delete(socket.id);
        
      } catch (error) {
        console.error('Erreur lors de la déconnexion de la partie:', error);
      }
    });

    // Gestion de la déconnexion
    socket.on('disconnect', async () => {
      console.log(`Déconnexion: ${socket.id}`);
      const connection = activeConnections.get(socket.id);
      if (!connection) return;

      const { userId, gameCode } = connection;
      
      try {
        const game = await Game.findOne({ code: gameCode });
        if (!game) return;
        
        // Marquer le joueur comme déconnecté
        const player = game.players.find(p => p.user.toString() === userId);
        if (player) {
          player.socketId = null;
          await game.save();
          
          // Informer les autres joueurs
          io.to(gameCode).emit('player_disconnected', { userId });
        }
      } catch (error) {
        console.error('Erreur lors de la gestion de la déconnexion:', error);
      }
      
      activeConnections.delete(socket.id);
    });

    // Événements de jeu
    socket.on('play_card', async ({ gameCode, userId, cardIndex, targetIndex }) => {
      try {
        const game = await Game.findOne({ code: gameCode });
        if (!game) return;
        
        const player = game.players.find(p => p.user.toString() === userId);
        if (!player || player.isEliminated) return;
        
        // Vérifier que c'est le tour du joueur
        if (game.players[game.currentPlayerIndex].user.toString() !== userId) {
          return socket.emit('error', { message: 'Ce n\'est pas votre tour' });
        }
        
        // Logique de jeu (simplifiée pour l'exemple)
        if (cardIndex >= 0 && cardIndex < player.cards.length) {
          const playedCard = player.cards[cardIndex];
          
          // Ajouter la carte au cimetière
          game.discardPile.push({
            card: playedCard,
            playerId: userId,
            timestamp: new Date()
          });
          
          // Retirer la carte de la main du joueur
          player.cards.splice(cardIndex, 1);
          
          // Vérifier si le joueur a gagné ou perdu
          checkPlayerStatus(game, player);
          
          // Passer au joueur suivant
          await game.nextPlayer();
          
          // Sauvegarder et diffuser l'état mis à jour
          await game.save();
          io.to(gameCode).emit('game_updated', await getGameState(game));
        }
      } catch (error) {
        console.error('Erreur lors du jeu de la carte:', error);
        socket.emit('error', { message: 'Erreur lors du jeu de la carte' });
      }
    });

    // Rejoindre une room de table
    socket.on('joinTableRoom', async ({ tableId, userId }) => {
      console.log(`Socket ${socket.id} joining table room: ${tableId}, userId: ${userId}`);
      socket.join(`table_${tableId}`);
      
      // Stocker le mapping userId → socket pour les événements de jeu
      if (userId) {
        activeConnections.set(userId, socket);
        console.log(`  ✅ Mapped userId ${userId} to socket ${socket.id}`);
      }
      
      console.log(`Socket ${socket.id} joined room: table_${tableId}`);
    });

    // Quitter une room de table
    socket.on('leaveTableRoom', (tableId) => {
      console.log(`Socket ${socket.id} leaving table room: ${tableId}`);
      socket.leave(`table_${tableId}`);
    });

    // Toggle Ready status
    socket.on('player:toggle_ready', async ({ tableId, userId }) => {
      try {
        console.log(`📥 Received player:toggle_ready - tableId: ${tableId}, userId: ${userId}`);
        
        const Game = require('../models/Game');
        const game = await Game.findById(tableId);
        
        if (!game) {
          console.error(`❌ Table not found: ${tableId}`);
          return socket.emit('error', { message: 'Table non trouvée' });
        }

        console.log(`📊 Game found - Players: ${game.players.length}/${game.maxPlayers}`);
        console.log(`📊 Current ready status:`, game.players.map(p => ({ 
          userId: p.user.toString(), 
          isReady: p.isReady 
        })));

        const player = game.players.find(p => p.user.toString() === userId);
        if (!player) {
          console.error(`❌ Player not found: ${userId}`);
          return socket.emit('error', { message: 'Joueur non trouvé' });
        }

        // Toggle ready status
        player.isReady = !player.isReady;
        await game.save();

        console.log(`🎮 Player ${userId} ready status: ${player.isReady}`);
        console.log(`📊 Updated ready status:`, game.players.map(p => ({ 
          userId: p.user.toString(), 
          isReady: p.isReady 
        })));

        // Émettre l'état mis à jour
        io.to(`table_${tableId}`).emit('player:ready_changed', {
          userId,
          isReady: player.isReady,
          allReady: game.players.every(p => p.isReady)
        });

        // Vérifier les conditions de démarrage
        const allReady = game.players.every(p => p.isReady);
        const enoughPlayers = game.players.length === game.maxPlayers;
        console.log(`🔍 Check start conditions:`);
        console.log(`   - Players: ${game.players.length}/${game.maxPlayers} (${enoughPlayers ? '✅' : '❌'})`);
        console.log(`   - All ready: ${allReady ? '✅' : '❌'}`);

        // Si tous les joueurs sont ready, démarrer la partie automatiquement
        if (enoughPlayers && allReady) {
          console.log(`🚀 All players ready! Starting game...`);
          
          // Distribuer les cartes
          const { playerCards, deckRemaining } = dealCards(game.players, game.cardsPerPlayer);
          
          console.log(`🃏 Cards dealt:`, Object.keys(playerCards).map(userId => `${userId}: ${playerCards[userId].length} cards`));
          
          // Sauvegarder les cartes et le deck dans la base de données
          game.players.forEach(player => {
            const userId = player.user.toString();
            player.cards = playerCards[userId];
          });
          game.status = 'playing';
          game.currentTurn = 0;
          game.deck = deckRemaining;
          game.discardPile = [];
          await game.save();
          
          console.log(`💾 Game state saved - Deck: ${game.deck.length} cards, Discard: ${game.discardPile.length} cards`);
          
          // Envoyer les cartes à chaque joueur individuellement
          console.log('📤 Sending cards to players...');
          game.players.forEach(player => {
            const userId = player.user.toString();
            console.log(`  - Looking for socket for userId: ${userId}`);
            
            const playerSocket = Array.from(io.sockets.sockets.values()).find(
              s => s.handshake.auth?.userId === userId
            );
            
            if (playerSocket) {
              console.log(`  ✅ Socket found: ${playerSocket.id}`);
              
              // Trouver les cartes de l'adversaire
              const opponentPlayer = game.players.find(p => p.user.toString() !== userId);
              const opponentCards = opponentPlayer ? playerCards[opponentPlayer.user.toString()] : [];
              
              // Déterminer si ce joueur est player1 (premier dans la liste)
              const amIPlayer1 = game.players[0].user.toString() === userId;
              
              console.log(`  📊 myCards: ${playerCards[userId].length} cards`);
              console.log(`  📊 opponentCards: ${opponentCards.length} cards`);
              console.log(`  📊 amIPlayer1: ${amIPlayer1}`);
              
              const payload = {
                myCards: playerCards[userId],
                opponentCards: opponentCards,
                deckCount: deckRemaining.length,
                currentTurn: game.currentTurn,
                amIPlayer1: amIPlayer1
              };
              
              console.log(`  📤 Emitting game:cards_dealt to ${playerSocket.id}`);
              playerSocket.emit('game:cards_dealt', payload);
            } else {
              console.error(`  ❌ No socket found for userId: ${userId}`);
            }
          });
          
          // Notifier tous les joueurs que la partie commence
          io.to(`table_${tableId}`).emit('game:auto_start', {
            message: 'Tous les joueurs sont prêts ! La partie commence...',
            cardsPerPlayer: game.cardsPerPlayer,
            deckCount: deckRemaining.length
          });
          
          // Démarrer le timer de mémorisation après la distribution ET l'overlay
          // Distribution: 8 cartes * 400ms = 3.2s
          // Délai après dernière carte: 0.5s
          // Overlay "Préparez-vous": 2s
          // Total: 3.2s + 0.5s + 2s = 5.7s (on met 5.5s pour être sûr)
          setTimeout(() => {
            startMemorizationTimer(io, tableId, 2);
          }, 5500);
          
          // Après la mémorisation (5.5s + 2s + 0.5s = 8s), démarrer le premier tour
          // Le délai de 0.5s permet aux clients de finir de traiter la fin de la mémorisation
          setTimeout(async () => {
            // Recharger le jeu avec les infos des joueurs
            const gameWithPlayers = await Game.findById(tableId).populate('players.user');
            if (!gameWithPlayers) return;
            
            const firstPlayerId = gameWithPlayers.players[0].user._id.toString();
            const firstPlayerUser = gameWithPlayers.players[0].user;
            
            console.log(`🎮 Starting first turn for player: ${firstPlayerId} (${firstPlayerUser.firstName} ${firstPlayerUser.lastName})`);
            
            // Démarrer le timer de jeu
            startGameTimer(io, tableId, 5);
            
            // Émettre l'événement de changement de tour
            io.to(`table_${tableId}`).emit('game:turn_changed', {
              currentPlayerId: firstPlayerId,
              currentPlayerName: `${firstPlayerUser.firstName} ${firstPlayerUser.lastName}`
            });
          }, 8000);
        }
      } catch (error) {
        console.error('Erreur toggle ready:', error);
        socket.emit('error', { message: 'Erreur lors du changement de statut' });
      }
    });

    // Quitter la partie en cours
    socket.on('player:quit_game', async ({ tableId, userId }) => {
      try {
        const Game = require('../models/Game');
        const game = await Game.findById(tableId);
        
        if (!game) {
          return socket.emit('error', { message: 'Table non trouvée' });
        }

        const quittingPlayer = game.players.find(p => p.user.toString() === userId);
        if (!quittingPlayer) {
          return socket.emit('error', { message: 'Joueur non trouvé' });
        }

        console.log(`🚪 Player ${userId} quit the game`);

        // Marquer le joueur comme éliminé
        quittingPlayer.isEliminated = true;
        
        // L'autre joueur gagne automatiquement
        const winner = game.players.find(p => p.user.toString() !== userId);
        
        game.status = 'finished';
        await game.save();

        // Notifier tous les joueurs
        io.to(`table_${tableId}`).emit('game:player_quit', {
          quitterId: userId,
          winnerId: winner.user.toString(),
          message: `${quittingPlayer.username} a quitté. ${winner.username} gagne par forfait !`
        });
      } catch (error) {
        console.error('Erreur quit game:', error);
        socket.emit('error', { message: 'Erreur lors de la déconnexion' });
      }
    });

    // Piocher une carte du deck
    socket.on('game:draw_card', async ({ tableId, userId, fromDeck, forcedCard }) => {
      try {
        console.log(`🎴 Player ${userId} drawing card from ${fromDeck ? 'deck' : 'discard'}`);
        
        const game = await Game.findById(tableId);
        if (!game) {
          console.error('❌ Game not found:', tableId);
          return socket.emit('error', { message: 'Partie non trouvée' });
        }
        
        console.log(`  📊 Game state - Deck: ${game.deck?.length || 0} cards, Discard: ${game.discardPile?.length || 0} cards`);
        
        // Vérifier si un pouvoir est actif
        const timers = activeTimers.get(tableId) || {};
        if (timers.activePower) {
          console.log(`⚠️ Cannot draw card while power is active: ${JSON.stringify(timers.activePower)}`);
          return socket.emit('error', { message: 'Impossible de piocher pendant l\'activation d\'un pouvoir' });
        }
        
        let drawnCard;
        
        if (fromDeck) {
          // Piocher du deck
          if (!game.deck || game.deck.length === 0) {
            console.error('✖ Deck is empty or undefined');
            return socket.emit('error', { message: 'Le deck est vide' });
          }
          
          if (forcedCard) {
            console.log(`  🎯 Forced card requested:`, forcedCard);
            
            // Trouver l'index de la carte forcée dans le deck
            let forcedCardIndex = -1;
            
            if (forcedCard.kind === 'rank') {
              // Chercher une carte avec le rang spécifié
              forcedCardIndex = game.deck.findIndex(card => {
                // Extraire le rang (0-12) de la valeur de la carte (0-51)
                const rank = card.value % 13;
                return rank === forcedCard.rank;
              });
            } else if (forcedCard.kind === 'joker') {
              // Chercher un joker du type spécifié
              const jokerBaseValue = forcedCard.type === 1 ? 104 : 110;
              forcedCardIndex = game.deck.findIndex(card => {
                return card.value >= jokerBaseValue && card.value < jokerBaseValue + 6;
              });
            }
            
            if (forcedCardIndex !== -1) {
              // Retirer la carte forcée du deck
              drawnCard = game.deck.splice(forcedCardIndex, 1)[0];
              console.log(`  ✅ Drew forced card: ${drawnCard.value}, Remaining deck: ${game.deck.length}`);
            } else {
              console.log(`  ⚠️ Forced card not found in deck, drawing random card`);
              drawnCard = game.deck.pop();
              console.log(`  ✅ Drew random card: ${drawnCard.value}, Remaining deck: ${game.deck.length}`);
            }
          } else {
            // Piocher normalement
            drawnCard = game.deck.pop();
            console.log(`  ✅ Drew card: ${drawnCard.value}, Remaining deck: ${game.deck.length}`);
          }
        } else {
          // Piocher de la défausse
          if (!game.discardPile || game.discardPile.length === 0) {
            console.error('❌ Discard pile is empty or undefined');
            return socket.emit('error', { message: 'La défausse est vide' });
          }
          drawnCard = game.discardPile.pop();
          console.log(`  ✅ Drew card from discard: ${drawnCard}`);
        }
        
        await game.save();
        
        console.log(`✅ Card drawn and saved: ${drawnCard}`);
        
        // IMPORTANT: Arrêter le timer de jeu et démarrer le timer de choix (10 secondes)
        // Ceci arrêtera automatiquement tous les autres timers
        startChoiceTimer(io, tableId, 10);
        
        // Notifier le joueur qui a pioché (il voit la carte)
        socket.emit('game:card_drawn', {
          playerId: userId,
          card: drawnCard,
          fromDeck
        });
        
        // Notifier les autres joueurs (ils voient juste qu'une carte a été piochée, face cachée)
        socket.to(`table_${tableId}`).emit('game:opponent_drew_card', {
          playerId: userId,
          fromDeck
        });
        
        console.log(`✅ Choice timer started for player ${userId} - Game timer stopped`);
        
      } catch (error) {
        console.error('Erreur draw card:', error);
        socket.emit('error', { message: 'Erreur lors du piochage' });
      }
    });
    
    // Défausser une carte
    socket.on('game:discard_card', async ({ tableId, userId, cardIndex, card }) => {
      try {
        console.log(`🗑️ Player ${userId} discarding card at index ${cardIndex}`);
        
        const game = await Game.findById(tableId).populate('players.user');
        if (!game) {
          console.error(`❌ Game not found: ${tableId}`);
          return socket.emit('error', { message: 'Partie non trouvée' });
        }
        
        console.log(`  📊 Game players:`, game.players.map(p => ({ 
          userId: p.user._id.toString(), 
          name: `${p.user.firstName} ${p.user.lastName}` 
        })));
        console.log(`  🔍 Looking for userId: ${userId}`);
        
        const player = game.players.find(p => p.user._id.toString() === userId);
        if (!player) {
          console.error(`❌ Player not found! userId: ${userId}`);
          console.error(`   Available players:`, game.players.map(p => p.user._id.toString()));
          return socket.emit('error', { message: 'Joueur non trouvé' });
        }
        
        console.log(`  ✅ Player found: ${player.user.firstName} ${player.user.lastName}`);
        
        // Vérifier si un pouvoir est actif
        const timers = activeTimers.get(tableId) || {};
        if (timers.activePower) {
          console.log(`⚠️ Cannot discard card while power is active: ${JSON.stringify(timers.activePower)}`);
          return socket.emit('error', { message: 'Impossible de défausser pendant l\'activation d\'un pouvoir' });
        }
        
        let discardedCardValue;
        let discardedCardObject;
        
        // Si cardIndex === -1, c'est la carte piochée qu'on défausse directement
        if (cardIndex === -1) {
          discardedCardValue = card;
          console.log(`  → Discarding drawn card directly: ${discardedCardValue}`);
          // Créer un objet carte pour la défausse
          discardedCardObject = {
            value: discardedCardValue,
            isFlipped: true,
            isVisible: true,
            isDiscarded: true
          };
        } else {
          // Sinon, c'est une carte de la main
          if (!player.cards[cardIndex]) {
            return socket.emit('error', { message: 'Carte invalide' });
          }
          discardedCardObject = player.cards[cardIndex];
          discardedCardValue = discardedCardObject.value;
          player.cards.splice(cardIndex, 1);
          console.log(`  → Discarding card from hand at index ${cardIndex}: ${discardedCardValue}`);
        }
        
        // Ajouter à la défausse
        game.discardPile.push(discardedCardObject);
        
        await game.save();
        
        console.log(`✅ Card discarded: ${discardedCardValue}`);
        
        // Notifier TOUS les joueurs (la défausse est visible par tous)
        io.to(`table_${tableId}`).emit('game:card_discarded', {
          playerId: userId,
          card: discardedCardValue,
          cardIndex,
          totalCards: player.cards.length // Ajouter le nombre total de cartes
        });
        
        console.log(`✅ Emitted game:card_discarded with totalCards: ${player.cards.length}`);
        
        // Passer au joueur suivant
        const currentPlayerIndex = game.players.findIndex(p => p.user._id.toString() === userId);
        const nextPlayerIndex = (currentPlayerIndex + 1) % game.players.length;
        const nextPlayer = game.players[nextPlayerIndex];
        const nextPlayerUser = nextPlayer.user;
        
        console.log(`🔄 Next turn: ${nextPlayerUser._id} (${nextPlayerUser.firstName} ${nextPlayerUser.lastName})`);
        
        // IMPORTANT: Arrêter tous les timers et démarrer le timer de jeu (5 secondes)
        // Ceci arrêtera automatiquement tous les autres timers
        startGameTimer(io, tableId, 5);
        
        // Émettre le changement de tour
        io.to(`table_${tableId}`).emit('game:turn_changed', {
          currentPlayerId: nextPlayerUser._id.toString(),
          currentPlayerName: `${nextPlayerUser.firstName} ${nextPlayerUser.lastName}`
        });
        
        console.log(`✅ Game timer started for next player ${nextPlayerUser._id} - Choice timer stopped`);
        
      } catch (error) {
        console.error('Erreur discard card:', error);
        socket.emit('error', { message: 'Erreur lors de la défausse' });
      }
    });
    
    // Remplacer une carte de sa main
    socket.on('game:replace_card', async ({ tableId, userId, cardIndex, newCard }) => {
      try {
        console.log(`🔄 Player ${userId} replacing card at index ${cardIndex}`);
        
        const game = await Game.findById(tableId).populate('players.user');
        if (!game) {
          return socket.emit('error', { message: 'Partie non trouvée' });
        }
        
        const player = game.players.find(p => p.user._id.toString() === userId);
        if (!player) {
          return socket.emit('error', { message: 'Joueur non trouvé' });
        }
        
        // Retirer l'ancienne carte et l'ajouter à la défausse
        const oldCard = player.cards[cardIndex];
        player.cards[cardIndex] = newCard;
        game.discardPile.push(oldCard);
        
        await game.save();
        
        console.log(`✅ Card replaced: ${oldCard.value} -> ${newCard.value}`);
        
        // Notifier tous les joueurs
        io.to(`table_${tableId}`).emit('game:card_replaced', {
          playerId: userId,
          cardIndex,
          discardedCard: oldCard,
          newCard: newCard,
          newCardValue: newCard.value, // Ajouter la valeur de la nouvelle carte pour que l'adversaire puisse la voir
          totalCards: player.cards.length // Ajouter le nombre total de cartes
        });
        
        console.log(`✅ Emitted game:card_replaced with totalCards: ${player.cards.length}, newCardValue: ${newCard.value}`);
        
        // Passer au joueur suivant
        const currentPlayerIndex = game.players.findIndex(p => p.user._id.toString() === userId);
        const nextPlayerIndex = (currentPlayerIndex + 1) % game.players.length;
        const nextPlayer = game.players[nextPlayerIndex];
        const nextPlayerUser = nextPlayer.user;
        
        console.log(`🔄 Next turn: ${nextPlayerUser._id} (${nextPlayerUser.firstName} ${nextPlayerUser.lastName})`);
        
        // Redémarrer le timer de jeu (5 secondes)
        startGameTimer(io, tableId, 5);
        
        io.to(`table_${tableId}`).emit('game:turn_changed', {
          currentPlayerId: nextPlayerUser._id.toString(),
          currentPlayerName: `${nextPlayerUser.firstName} ${nextPlayerUser.lastName}`
        });
        
      } catch (error) {
        console.error('Erreur replace card:', error);
        socket.emit('error', { message: 'Erreur lors du remplacement' });
      }
    });
    
    // Gérer le timeout du choix (défausse automatique après 10s)
    socket.on('game:choice_timeout', async ({ tableId, userId, drawnCard }) => {
      try {
        console.log(`⏰ Choice timeout - Auto-discarding card for userId: ${userId}`);
        
        const game = await Game.findById(tableId).populate('players.user');
        if (!game) {
          console.error(`❌ Game not found: ${tableId}`);
          return socket.emit('error', { message: 'Partie non trouvée' });
        }
        
        // Vérifier si un pouvoir est actif
        const timers = activeTimers.get(tableId) || {};
        if (timers.activePower) {
          console.log(`⚠️ Cannot process choice timeout while power is active: ${JSON.stringify(timers.activePower)}`);
          return socket.emit('error', { message: 'Impossible de traiter le timeout pendant l\'activation d\'un pouvoir' });
        }
        
        // Défausser automatiquement la carte piochée
        const discardedCardObject = {
          value: drawnCard,
          isFlipped: true,
          isVisible: true,
          isDiscarded: true
        };
        game.discardPile.push(discardedCardObject);
        await game.save();
        
        console.log(`✅ Card auto-discarded: ${drawnCard}`);
        
        // Notifier tous les joueurs
        io.to(`table_${tableId}`).emit('game:card_discarded', {
          playerId: userId,
          card: drawnCard,
          cardIndex: -1,
          autoDiscard: true
        });
        
        // Passer au joueur suivant
        const currentPlayerIndex = game.players.findIndex(p => p.user._id.toString() === userId);
        const nextPlayerIndex = (currentPlayerIndex + 1) % game.players.length;
        const nextPlayer = game.players[nextPlayerIndex];
        const nextPlayerUser = nextPlayer.user;
        
        console.log(`🔄 Next turn after auto-discard: ${nextPlayerUser._id} (${nextPlayerUser.firstName} ${nextPlayerUser.lastName})`);
        
        // IMPORTANT: Arrêter tous les timers et démarrer le timer de jeu (5 secondes)
        // Ceci arrêtera automatiquement tous les autres timers
        startGameTimer(io, tableId, 5);
        
        // Émettre le changement de tour
        io.to(`table_${tableId}`).emit('game:turn_changed', {
          currentPlayerId: nextPlayerUser._id.toString(),
          currentPlayerName: `${nextPlayerUser.firstName} ${nextPlayerUser.lastName}`
        });
        
        console.log(`✅ Game timer started for next player ${nextPlayerUser._id} - Choice timer stopped`);
        
      } catch (error) {
        console.error('Erreur choice timeout:', error);
        socket.emit('error', { message: 'Erreur lors du timeout de choix' });
      }
    });
    
    // Gérer le timeout du tour (quand le timer arrive à 0)
    socket.on('game:turn_timeout', async ({ tableId, userId }) => {
      try {
        console.log(`⏰ Turn timeout received - tableId: ${tableId}, userId: ${userId}`);
        
        const game = await Game.findById(tableId).populate('players.user');
        if (!game) {
          console.error(`❌ Game not found: ${tableId}`);
          return socket.emit('error', { message: 'Partie non trouvée' });
        }
        
        console.log(`✅ Game found, processing timeout...`);
        
        // Vérifier si un pouvoir est actif
        const timers = activeTimers.get(tableId) || {};
        if (timers.activePower) {
          console.log(`⚠️ Cannot process turn timeout while power is active: ${JSON.stringify(timers.activePower)}`);
          return socket.emit('error', { message: 'Impossible de traiter le timeout pendant l\'activation d\'un pouvoir' });
        }
        
        // Passer au joueur suivant
        const currentPlayerIndex = game.players.findIndex(p => p.user._id.toString() === userId);
        const nextPlayerIndex = (currentPlayerIndex + 1) % game.players.length;
        const nextPlayer = game.players[nextPlayerIndex];
        const nextPlayerUser = nextPlayer.user;
        
        console.log(`🔄 Timeout - Next turn: ${nextPlayerUser._id} (${nextPlayerUser.firstName} ${nextPlayerUser.lastName})`);
        
        // IMPORTANT: Arrêter tous les timers et démarrer le timer de jeu (5 secondes)
        // Ceci arrêtera automatiquement tous les autres timers
        startGameTimer(io, tableId, 5);
        
        // Émettre le changement de tour
        io.to(`table_${tableId}`).emit('game:turn_changed', {
          currentPlayerId: nextPlayerUser._id.toString(),
          currentPlayerName: `${nextPlayerUser.firstName} ${nextPlayerUser.lastName}`
        });
        
        console.log(`✅ Game timer started for next player ${nextPlayerUser._id}`);
        
      } catch (error) {
        console.error('Erreur turn timeout:', error);
        socket.emit('error', { message: 'Erreur lors du changement de tour' });
      }
    });
    
    // Gérer la défausse rapide (clic sur une carte de même valeur)
    socket.on('game:quick_discard', async ({ tableId, userId, cardIndex, card }) => {
      try {
        console.log(`⚡ Quick discard - userId: ${userId}, cardIndex: ${cardIndex}, card: ${card}`);
        
        const game = await Game.findById(tableId).populate('players.user');
        if (!game) {
          console.error(`❌ Game not found: ${tableId}`);
          return socket.emit('error', { message: 'Partie non trouvée' });
        }
        
        const player = game.players.find(p => p.user._id.toString() === userId);
        if (!player) {
          return socket.emit('error', { message: 'Joueur non trouvé' });
        }
        
        // Retirer la carte de la main
        const discardedCardObject = player.cards[cardIndex];
        player.cards.splice(cardIndex, 1);
        
        // Ajouter à la défausse
        game.discardPile.push(discardedCardObject);
        await game.save();
        
        console.log(`✅ Quick discard successful: ${card}`);
        
        // Notifier TOUS les joueurs
        io.to(`table_${tableId}`).emit('game:card_discarded', {
          playerId: userId,
          card: card,
          cardIndex: cardIndex,
          quickDiscard: true
        });
        
        // Vérifier si le joueur a gagné (plus de cartes)
        if (player.cards.length === 0) {
          console.log(`🏆 Player ${userId} won by quick discard!`);
          io.to(`table_${tableId}`).emit('game:player_won', {
            playerId: userId,
            playerName: `${player.user.firstName} ${player.user.lastName}`
          });
          return;
        }
        
        // La défausse rapide ne change PAS le tour
        // Le joueur peut continuer à défausser rapidement
        
      } catch (error) {
        console.error('Erreur quick discard:', error);
        socket.emit('error', { message: 'Erreur lors de la défausse rapide' });
      }
    });
    
    // Gérer la pénalité de défausse rapide (mauvaise carte)
    socket.on('game:quick_discard_penalty', async ({ tableId, userId, cardIndex }) => {
      try {
        console.log(`⚠️ Quick discard penalty - userId: ${userId}, cardIndex: ${cardIndex}`);
        
        const game = await Game.findById(tableId).populate('players.user');
        if (!game) {
          console.error(`❌ Game not found: ${tableId}`);
          return socket.emit('error', { message: 'Partie non trouvée' });
        }
        
        const player = game.players.find(p => p.user._id.toString() === userId);
        if (!player) {
          return socket.emit('error', { message: 'Joueur non trouvé' });
        }
        
        // Vérifier qu'il y a assez de cartes dans le deck
        if (game.deck.length < 2) {
          console.log('⚠️ Not enough cards in deck for penalty');
          return socket.emit('error', { message: 'Pas assez de cartes dans le deck' });
        }
        
        // IMPORTANT: La carte fautive RESTE dans la main (on ne la retire PAS)
        // On ajoute seulement 2 nouvelles cartes de pénalité
        const penaltyCard1 = game.deck.pop();
        const penaltyCard2 = game.deck.pop();
        player.cards.push(penaltyCard1, penaltyCard2);
        
        await game.save();
        
        console.log(`✅ Penalty applied: 2 cards added to player ${userId} (faulty card remains)`);
        console.log(`  → Penalty cards: ${penaltyCard1.value}, ${penaltyCard2.value}`);
        
        // Envoyer les cartes au joueur pénalisé (seulement à lui)
        io.to(socket.id).emit('game:penalty_cards_received', {
          cards: [penaltyCard1.value, penaltyCard2.value],
          totalCards: player.cards.length // Ajouter le nombre total de cartes
        });
        
        console.log(`✅ Sent penalty cards to player ${userId} with totalCards: ${player.cards.length}`);
        
        // Notifier TOUS les joueurs de la pénalité (en incluant les valeurs des cartes)
        console.log(`📢 Emitting game:quick_discard_penalty_applied to table_${tableId}`);
        console.log(`  → Penalty player: ${userId} (${player.user.firstName} ${player.user.lastName})`);
        console.log(`  → Card index: ${cardIndex}`);
        console.log(`  → Total cards after penalty: ${player.cards.length}`);
        console.log(`  → Penalty cards: ${penaltyCard1.value}, ${penaltyCard2.value}`);
        io.to(`table_${tableId}`).emit('game:quick_discard_penalty_applied', {
          playerId: userId,
          playerName: `${player.user.firstName} ${player.user.lastName}`,
          cardIndex: cardIndex,
          penaltyCardCount: 2,
          totalCards: player.cards.length, // Ajouter le nombre total de cartes
          penaltyCards: [penaltyCard1.value, penaltyCard2.value] // Ajouter les valeurs des cartes de pénalité
        });
        console.log(`✅ Event emitted to all players in table_${tableId}`);
        
      } catch (error) {
        console.error('Erreur quick discard penalty:', error);
        socket.emit('error', { message: 'Erreur lors de la pénalité' });
      }
    });

    // Gérer la fin d'un tour
    socket.on('game:end_turn', async (data) => {
      const { tableId, userId, nextPlayerId } = data;
      console.log(`🔄 End turn received - tableId: ${tableId}, userId: ${userId}, nextPlayerId: ${nextPlayerId}`);
      
      try {
        const game = await Game.findById(tableId).populate('players.user');
        if (!game) {
          console.error('⚠️ Game not found for end turn:', tableId);
          return socket.emit('error', { message: 'Table non trouvée' });
        }
        
        const nextPlayerUser = game.players.find(p => p.user._id.toString() === nextPlayerId)?.user;
        if (!nextPlayerUser) {
          console.error('⚠️ Next player not found:', nextPlayerId);
          return socket.emit('error', { message: 'Joueur non trouvé' });
        }
        
        // Démarrer le timer de jeu pour le prochain joueur
        startGameTimer(io, tableId, 5);
        
        // Émettre l'événement de changement de tour
        io.to(`table_${tableId}`).emit('game:turn_changed', {
          currentPlayerId: nextPlayerId,
          currentPlayerName: `${nextPlayerUser.firstName} ${nextPlayerUser.lastName}`
        });
      } catch (error) {
        console.error('Erreur end turn:', error);
        socket.emit('error', { message: 'Erreur lors de la fin du tour' });
      }
    });
    
    // Gérer le début d'un tour
    socket.on('game:start_turn', async (data) => {
      const { tableId, userId, currentPlayerId } = data;
      console.log(`🎮 Start turn received - tableId: ${tableId}, userId: ${userId}, currentPlayerId: ${currentPlayerId}`);
      
      try {
        const game = await Game.findById(tableId).populate('players.user');
        if (!game) {
          console.error('⚠️ Game not found for start turn:', tableId);
          return socket.emit('error', { message: 'Table non trouvée' });
        }
        
        // Démarrer le timer de jeu
        startGameTimer(io, tableId, 5);
      } catch (error) {
        console.error('Erreur start turn:', error);
        socket.emit('error', { message: 'Erreur lors du début du tour' });
      }
    });
    
    // Gérer l'activation des pouvoirs des cartes figures (J, Q, K)
    socket.on('game:power_activated', async (data) => {
      const { tableId, userId, powerType } = data;
      console.log(`👑 Power activated - tableId: ${tableId}, userId: ${userId}, powerType: ${powerType}`);
      
      try {
        const game = await Game.findById(tableId).populate('players.user');
        if (!game) {
          console.error('⚠️ Game not found for power activation:', tableId);
          return socket.emit('error', { message: 'Table non trouvée' });
        }
        
        // Arrêter TOUS les timers en cours pour éviter la désynchronisation
        stopAllTimers(tableId);
        
        // Récupérer ou créer l'objet timers
        const timers = activeTimers.get(tableId) || {};
        
        // Sauvegarder l'état du pouvoir actif dans la table
        timers.activePower = {
          powerType,
          playerId: userId,
          activatedAt: new Date().getTime()
        };
        
        // Mettre à jour la phase actuelle
        timers.currentPhase = 'power_active';
        timers.memoTimeLeft = 0;
        timers.gameTimeLeft = 0;
        timers.choiceTimeLeft = 0;
        
        activeTimers.set(tableId, timers);
        
        // Notifier tous les joueurs que le pouvoir est activé et que le minuteur est en pause
        io.to(`table_${tableId}`).emit('game:power_activated', {
          playerId: userId,
          powerType: powerType,
          message: `Pouvoir de carte ${powerType === 'jack' ? 'Valet' : powerType === 'queen' ? 'Dame' : 'Roi'} activé`
        });
        
        // Réinitialiser l'état du minuteur pour éviter l'affichage de 00:00
        io.to(`table_${tableId}`).emit('game:timer_update', {
          phase: 'power_active',
          memoTimeLeft: 0,
          gameTimeLeft: 30, // Valeur arbitraire pour montrer que le timer est en pause
          choiceTimeLeft: 0
        });
        
        console.log(`✅ Power ${powerType} activated for player ${userId} - All timers paused`);
      } catch (error) {
        console.error('Erreur power activation:', error);
        socket.emit('error', { message: 'Erreur lors de l\'activation du pouvoir' });
      }
    });
    
    // Gérer la fin de l'utilisation des pouvoirs des cartes figures (J, Q, K)
    socket.on('game:power_completed', async (data) => {
      const { tableId, userId, powerType } = data;
      console.log(`👑 Power completed - tableId: ${tableId}, userId: ${userId}, powerType: ${powerType}`);
      
      try {
        const game = await Game.findById(tableId).populate('players.user');
        if (!game) {
          console.error('⚠️ Game not found for power completion:', tableId);
          return socket.emit('error', { message: 'Table non trouvée' });
        }
        
        // Récupérer l'état du pouvoir actif
        const timers = activeTimers.get(tableId) || {};
        const activePower = timers.activePower;
        
        // Vérifier que c'est bien le même joueur qui termine le pouvoir
        if (activePower && activePower.playerId === userId && activePower.powerType === powerType) {
          // Arrêter tous les timers existants
          stopAllTimers(tableId);
          
          // Effacer l'état du pouvoir actif
          delete timers.activePower;
          activeTimers.set(tableId, timers);
          
          // Notifier tous les joueurs que le pouvoir est terminé
          io.to(`table_${tableId}`).emit('game:power_completed', {
            playerId: userId,
            powerType: powerType,
            message: `Pouvoir de carte ${powerType === 'jack' ? 'Valet' : powerType === 'queen' ? 'Dame' : 'Roi'} terminé`
          });
          
          // Passer au joueur suivant
          const currentPlayerIndex = game.players.findIndex(p => p.user._id.toString() === userId);
          const nextPlayerIndex = (currentPlayerIndex + 1) % game.players.length;
          const nextPlayer = game.players[nextPlayerIndex];
          const nextPlayerUser = nextPlayer.user;
          
          console.log(`🔄 Next turn after power completion: ${nextPlayerUser._id} (${nextPlayerUser.firstName} ${nextPlayerUser.lastName})`);
          
          // Redémarrer le timer de jeu (5 secondes) - ceci arrêtera automatiquement tous les autres timers
          startGameTimer(io, tableId, 5);
          
          // Émettre le changement de tour
          io.to(`table_${tableId}`).emit('game:turn_changed', {
            currentPlayerId: nextPlayerUser._id.toString(),
            currentPlayerName: `${nextPlayerUser.firstName} ${nextPlayerUser.lastName}`
          });
          
          console.log(`✅ Power ${powerType} completed for player ${userId} - Game timer started for next player`);
        } else {
          console.error(`⚠️ Power completion mismatch: active=${JSON.stringify(activePower)}, received=${userId}/${powerType}`);
        }
      } catch (error) {
        console.error('Erreur power completion:', error);
        socket.emit('error', { message: 'Erreur lors de la fin du pouvoir' });
      }
    });
  });
};

// Vérifier l'état d'un joueur (elimination, victoire, etc.)
function checkPlayerStatus(game, player) {
  const score = player.cards.reduce((sum, card) => sum + card.points, 0);
  player.score = score;
  
  if (score > 100) {
    player.isEliminated = true;
  } else if (score === 100) {
    player.score = 50; // Réinitialiser à 50 points
  }
}

// Obtenir l'état actuel du jeu pour un client
async function getGameState(game) {
  const populatedGame = await Game.populate(game, [
    { path: 'players.user', select: 'firstName lastName elo' },
    { path: 'host', select: 'firstName lastName elo' }
  ]);

  return {
    code: populatedGame.code,
    status: populatedGame.status,
    currentPlayerIndex: populatedGame.currentPlayerIndex,
    maxPlayers: populatedGame.maxPlayers,
    cardsPerPlayer: populatedGame.cardsPerPlayer,
    host: populatedGame.host,
    players: populatedGame.players.map(p => ({
      _id: p.user._id,
      firstName: p.user.firstName,
      lastName: p.user.lastName,
      elo: p.user.elo,
      position: p.position,
      score: p.score,
      cardsCount: p.cards.length,
      isEliminated: p.isEliminated,
      hasBombom: p.hasBombom
    })),
    discardPile: populatedGame.discardPile,
    drawPileCount: populatedGame.drawPile.length,
    explorationEndTime: populatedGame.explorationEndTime,
    turnEndTime: populatedGame.turnEndTime
  };
}

// Export utilitaire pour réutilisation côté contrôleurs (REST)
module.exports.getGameState = getGameState;
