const Game = require('../models/Game');
const User = require('../models/User');
const { calculateCardPoints } = require('../utils/gameUtils');

// Stocker les connexions actives
const activeConnections = new Map();

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
    socket.on('joinTableRoom', (tableId) => {
      console.log(`Socket ${socket.id} joining table room: ${tableId}`);
      socket.join(`table_${tableId}`);
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
        const Game = require('../models/Game');
        const game = await Game.findById(tableId);
        
        if (!game) {
          return socket.emit('error', { message: 'Table non trouvée' });
        }

        const player = game.players.find(p => p.user.toString() === userId);
        if (!player) {
          return socket.emit('error', { message: 'Joueur non trouvé' });
        }

        // Toggle ready status
        player.isReady = !player.isReady;
        await game.save();

        console.log(`🎮 Player ${userId} ready status: ${player.isReady}`);

        // Émettre l'état mis à jour
        io.to(`table_${tableId}`).emit('player:ready_changed', {
          userId,
          isReady: player.isReady,
          allReady: game.players.every(p => p.isReady)
        });

        // Si tous les joueurs sont ready, démarrer la partie automatiquement
        if (game.players.length === game.maxPlayers && game.players.every(p => p.isReady)) {
          console.log(`🚀 All players ready! Starting game...`);
          game.status = 'playing';
          await game.save();
          
          io.to(`table_${tableId}`).emit('game:auto_start', {
            message: 'Tous les joueurs sont prêts ! La partie commence...'
          });
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

    // Autres événements de jeu à implémenter...
  });
};

// Vérifier l'état d'un joueur (élimination, victoire, etc.)
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
