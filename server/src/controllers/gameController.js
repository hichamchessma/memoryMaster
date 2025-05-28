const Game = require('../models/Game');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');

// Fonction utilitaire pour générer un code de jeu unique
const generateGameCode = async () => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Éviter les caractères ambigus
  let code;
  let isUnique = false;
  
  while (!isUnique) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    const existingGame = await Game.findOne({ code });
    if (!existingGame) {
      isUnique = true;
    }
  }
  
  return code;
};

// Fonction utilitaire pour calculer le score d'une carte
const calculateCardPoints = (cardValue) => {
  if (cardValue === 'A') return 1;
  if (cardValue === '10') return 0;
  if (['J', 'Q', 'K'].includes(cardValue)) return 10;
  if (cardValue === 'JOKER') return -1;
  return parseInt(cardValue, 10);
};

// Créer une nouvelle partie
exports.createGame = async (req, res, next) => {
  try {
    const { cardsPerPlayer = 6, maxPlayers = 4 } = req.body;
    const userId = req.user.id;

    // Vérifier que l'utilisateur existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    // Valider le nombre de cartes par joueur
    if (![4, 6, 8, 10].includes(parseInt(cardsPerPlayer, 10))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le nombre de cartes par joueur doit être 4, 6, 8 ou 10' 
      });
    }

    // Valider le nombre maximum de joueurs
    if (maxPlayers < 2 || maxPlayers > 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le nombre de joueurs doit être compris entre 2 et 6' 
      });
    }

    // Générer un code de jeu unique
    const code = await generateGameCode();

    // Créer la nouvelle partie
    const game = new Game({
      code,
      host: userId,
      maxPlayers,
      cardsPerPlayer,
      players: [{
        user: userId,
        socketId: req.socketId || '',
        username: `${user.firstName} ${user.lastName}`,
        position: 1,
        score: 0,
        actualScore: 0,
        cards: [],
        isReady: false,
        isHost: true,
        isEliminated: false,
        hasBombom: false,
        bombomActivated: false,
        bombomCanceled: false,
        powers: {
          jUsed: false,
          qUsed: false,
          kUsed: false
        }
      }],
      status: 'waiting',
      phase: 'waiting',
      currentTurn: 0,
      settings: {
        turnDuration: 30, // secondes
        explorationDuration: 10, // secondes
        powerJDuration: 3, // secondes
        powerQDuration: 3  // secondes
      }
    });

    await game.save();

    // Préparer la réponse
    const gameData = game.toObject();
    
    // Nettoyer les données sensibles
    delete gameData.__v;
    gameData.players.forEach(player => {
      delete player.socketId;
    });

    res.status(201).json({
      success: true,
      message: 'Partie créée avec succès',
      game: gameData
    });
  } catch (error) {
    console.error('Erreur lors de la création de la partie:', error);
    next(error);
  }
};

// Rejoindre une partie existante
exports.joinGame = async (req, res, next) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;
    const { socketId } = req.body;

    // Vérifier que l'utilisateur existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    // Trouver la partie
    const game = await Game.findOne({ code });
    if (!game) {
      return res.status(404).json({ 
        success: false, 
        message: 'Partie non trouvée' 
      });
    }

    // Vérifier si la partie est en attente
    if (game.status !== 'waiting') {
      return res.status(400).json({ 
        success: false, 
        message: 'Impossible de rejoindre cette partie car elle a déjà commencé' 
      });
    }

    // Vérifier si le joueur est déjà dans la partie
    const playerExists = game.players.some(p => p.user.toString() === userId);
    if (playerExists) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous avez déjà rejoint cette partie' 
      });
    }

    // Vérifier s'il reste de la place
    if (game.players.length >= game.maxPlayers) {
      return res.status(400).json({ 
        success: false, 
        message: 'La partie est complète' 
      });
    }

    // Ajouter le joueur à la partie
    game.players.push({
      user: userId,
      socketId: socketId || '',
      username: `${user.firstName} ${user.lastName}`,
      position: game.players.length + 1,
      score: 0,
      actualScore: 0,
      cards: [],
      isReady: false,
      isHost: false,
      isEliminated: false,
      hasBombom: false,
      bombomActivated: false,
      bombomCanceled: false,
      powers: {
        jUsed: false,
        qUsed: false,
        kUsed: false
      }
    });

    await game.save();

    // Préparer la réponse
    const response = {
      code: game.code,
      maxPlayers: game.maxPlayers,
      cardsPerPlayer: game.cardsPerPlayer,
      status: game.status,
      host: {
        _id: game.host,
        firstName: user.firstName,
        lastName: user.lastName,
        elo: user.elo
      },
      players: await Promise.all(game.players.map(async (p) => {
        const playerUser = await User.findById(p.user);
        return {
          _id: p.user,
          firstName: playerUser.firstName,
          lastName: playerUser.lastName,
          elo: playerUser.elo,
          position: p.position
        };
      }))
    };

    res.json({
      message: 'Vous avez rejoint la partie',
      game: response
    });
  } catch (error) {
    next(error);
  }
};

// Démarrer une partie
exports.startGame = async (req, res, next) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;

    // Trouver la partie
    const game = await Game.findOne({ code });
    if (!game) {
      return res.status(404).json({ 
        success: false, 
        message: 'Partie non trouvée' 
      });
    }

    // Vérifier que l'utilisateur est l'hôte
    if (game.host.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Seul l\'hôte peut démarrer la partie' 
      });
    }

    // Vérifier qu'il y a assez de joueurs
    if (game.players.length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Il faut au moins 2 joueurs pour commencer' 
      });
    }

    // Vérifier que tous les joueurs sont prêts
    const allPlayersReady = game.players.every(p => p.isReady || p.isEliminated);
    if (!allPlayersReady) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tous les joueurs doivent être prêts' 
      });
    }

    // Vérifier que la partie n'a pas déjà commencé
    if (game.status !== 'waiting') {
      return res.status(400).json({ 
        success: false, 
        message: 'La partie a déjà commencé' 
      });
    }

    // Initialiser le jeu
    game.status = 'playing';
    game.phase = 'exploration';
    game.startedAt = new Date();
    game.currentTurn = 1;
    
    // Créer le paquet de cartes
    const cardValues = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const jokers = Array(2).fill('JOKER');
    let deck = [];
    
    // Ajouter 4 exemplaires de chaque valeur + 2 jokers
    cardValues.forEach(value => {
      for (let i = 0; i < 4; i++) {
        deck.push({
          value,
          isFlipped: false,
          isVisible: false,
          position: deck.length,
          isDiscarded: false
        });
      }
    });
    
    // Ajouter les jokers
    jokers.forEach(joker => {
      deck.push({
        value: joker,
        isFlipped: false,
        isVisible: false,
        position: deck.length,
        isDiscarded: false
      });
    });
    
    // Mélanger le paquet
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    // Distribuer les cartes aux joueurs
    game.players.forEach(player => {
      player.cards = [];
      for (let i = 0; i < game.cardsPerPlayer; i++) {
        if (deck.length === 0) break;
        const card = { ...deck.pop() };
        card.ownerId = player.user;
        player.cards.push(card);
      }
      
      // Révéler la moitié des cartes (phase d'exploration)
      const halfCards = Math.floor(game.cardsPerPlayer / 2);
      for (let i = 0; i < halfCards; i++) {
        if (player.cards[i]) {
          player.cards[i].isVisible = true;
        }
      }
    });
    
    // Mettre à jour le paquet de pioche
    game.deck = deck;
    
    // Définir le premier joueur
    game.currentPlayer = game.players[0].user;
    
    // Définir le timer d'exploration
    game.explorationEndTime = new Date(
      Date.now() + (game.settings.explorationDuration * 1000)
    );
    
    await game.save();

    // Préparer la réponse
    const gameData = game.toObject();
    
    // Nettoyer les données sensibles et les cartes non visibles
    delete gameData.__v;
    gameData.players.forEach(player => {
      delete player.socketId;
      // Ne renvoyer que les cartes visibles pour chaque joueur
      player.cards = player.cards.map(card => ({
        id: card.id,
        value: card.isVisible ? card.value : 'HIDDEN',
        isFlipped: card.isFlipped,
        isVisible: card.isVisible,
        position: card.position
      }));
    });

    res.status(200).json({
      success: true,
      message: 'Partie démarrée avec succès',
      game: gameData
    });
  } catch (error) {
    next(error);
  }
};

// Obtenir les informations d'une partie
exports.getGame = async (req, res, next) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;

    // Trouver la partie
    const game = await Game.findOne({ code })
      .populate('players.user', 'firstName lastName elo')
      .populate('host', 'firstName lastName elo');

    if (!game) {
      return res.status(404).json({ message: 'Partie non trouvée' });
    }

    // Vérifier que l'utilisateur fait partie de la partie
    const player = game.players.find(p => p.user._id.toString() === userId);
    if (!player) {
      return res.status(403).json({ message: 'Vous ne faites pas partie de cette partie' });
    }

    // Préparer la réponse en fonction du statut de la partie
    let response = {
      code: game.code,
      status: game.status,
      currentPlayerIndex: game.currentPlayerIndex,
      maxPlayers: game.maxPlayers,
      cardsPerPlayer: game.cardsPerPlayer,
      host: game.host,
      players: game.players.map(p => ({
        _id: p.user._id,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        elo: p.user.elo,
        position: p.position,
        score: p.score,
        isEliminated: p.isEliminated,
        hasBombom: p.hasBombom,
        cardsCount: p.cards.length
      })),
      discardPile: game.discardPile,
      drawPileCount: game.drawPile.length,
      turnEndTime: game.turnEndTime
    };

    // Si la partie est en cours, ajouter les cartes du joueur
    if (['EXPLORATION', 'PLAYING', 'FINISHED'].includes(game.status)) {
      response.playerCards = player.cards.map(card => ({
        ...card.toObject(),
        // Ne pas révéler les cartes des autres joueurs
        isVisible: card.isVisible || game.status === 'FINISHED' || 
                  (game.status === 'EXPLORATION' && card.position === 'BOTTOM')
      }));
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// Jouer un tour
exports.playTurn = async (req, res, next) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;
    const { action, cardIndex, targetIndex, powerCard } = req.body;

    // Trouver la partie
    const game = await Game.findOne({ code });
    if (!game) {
      return res.status(404).json({ message: 'Partie non trouvée' });
    }

    // Vérifier que la partie est en cours
    if (game.status !== 'PLAYING') {
      return res.status(400).json({ message: 'La partie n\'est pas en cours' });
    }

    // Vérifier que c'est bien le tour du joueur
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.user.toString() !== userId) {
      return res.status(400).json({ message: 'Ce n\'est pas votre tour' });
    }

    // Vérifier que le joueur n'est pas éliminé
    if (currentPlayer.isEliminated) {
      return res.status(400).json({ message: 'Vous êtes éliminé de la partie' });
    }

    // Logique de jeu en fonction de l'action
    switch (action) {
      case 'DRAW_CARD':
        await handleDrawCard(game, currentPlayer);
        break;
      case 'PLAY_CARD':
        await handlePlayCard(game, currentPlayer, cardIndex, targetIndex);
        break;
      case 'USE_POWER':
        await handleUsePower(game, currentPlayer, powerCard);
        break;
      case 'THROW_NOW':
        await handleThrowNow(game, currentPlayer);
        break;
      case 'BOMBOM':
        await handleBombom(game, currentPlayer);
        break;
      default:
        return res.status(400).json({ message: 'Action non valide' });
    }

    // Sauvegarder les modifications
    await game.save();

    // Préparer la réponse
    const response = {
      code: game.code,
      status: game.status,
      currentPlayerIndex: game.currentPlayerIndex,
      players: game.players.map(p => ({
        _id: p.user,
        score: p.score,
        isEliminated: p.isEliminated,
        hasBombom: p.hasBombom,
        cardsCount: p.cards.length
      })),
      discardPile: game.discardPile,
      drawPileCount: game.drawPile.length,
      turnEndTime: game.turnEndTime
    };

    res.json({
      message: 'Action effectuée avec succès',
      game: response
    });
  } catch (error) {
    next(error);
  }
};

// Fonctions auxiliaires pour gérer les actions de jeu
async function handleDrawCard(game, player) {
  // Vérifier s'il reste des cartes à piocher
  if (game.drawPile.length === 0) {
    throw new Error('Plus de cartes à piocher');
  }

  // Piocher une carte
  const drawnCard = game.drawPile.pop();
  player.cards.push({
    ...drawnCard,
    isVisible: true
  });

  // Mettre à jour le timer du tour
  game.turnEndTime = new Date(Date.now() + game.turnTimeLimit);
}

async function handlePlayCard(game, player, cardIndex, targetIndex) {
  // Vérifier que l'index de la carte est valide
  if (cardIndex < 0 || cardIndex >= player.cards.length) {
    throw new Error('Carte invalide');
  }

  // Récupérer la carte jouée
  const playedCard = player.cards[cardIndex];

  // Vérifier si la cible est valide (si nécessaire)
  if (targetIndex !== undefined) {
    if (targetIndex < 0 || targetIndex >= player.cards.length) {
      throw new Error('Cible invalide');
    }

    // Remplacer la carte cible par la carte jouée
    const discardedCard = player.cards[targetIndex];
    player.cards[targetIndex] = {
      ...playedCard,
      isVisible: false
    };

    // Ajouter la carte remplacée au cimetière
    game.discardPile.push({
      card: discardedCard,
      playerId: player.user,
      timestamp: new Date()
    });
  } else {
    // Jeter simplement la carte
    game.discardPile.push({
      card: playedCard,
      playerId: player.user,
      timestamp: new Date()
    });
  }

  // Retirer la carte jouée de la main du joueur
  player.cards.splice(cardIndex, 1);

  // Vérifier si le joueur a gagné ou perdu
  checkPlayerStatus(game, player);

  // Passer au joueur suivant
  await game.nextPlayer();

  // Mettre à jour le timer du tour
  game.turnEndTime = new Date(Date.now() + game.turnTimeLimit);
}

async function handleUsePower(game, player, powerCard) {
  // Implémenter la logique des pouvoirs spéciaux
  // (À compléter selon les règles du jeu)
}

async function handleThrowNow(game, player) {
  // Implémenter la logique de ThrowNow
  // (À compléter selon les règles du jeu)
}

async function handleBombom(game, player) {
  // Implémenter la logique de Bombom
  // (À compléter selon les règles du jeu)
}

function checkPlayerStatus(game, player) {
  // Calculer le score actuel du joueur
  const score = player.cards.reduce((sum, card) => sum + card.points, 0);
  player.score = score;

  // Vérifier si le joueur est éliminé
  if (score > 100) {
    player.isEliminated = true;
  }
  // Vérifier le cas spécial du score exactement à 100
  else if (score === 100) {
    player.score = 50; // Réinitialiser à 50 points
  }
}

// Jouer une carte
exports.playCard = async (req, res, next) => {
  let session = null;
  
  try {
    const { code } = req.params;
    const { cardId, targetPlayerId, isBluff } = req.body;
    const userId = req.user.id;

    // Démarrer une session pour la transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // Trouver la partie avec verrouillage pour éviter les conflits
    const game = await Game.findOne({ code }).session(session).select('+deck').populate('players.user');
    if (!game) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false, 
        message: 'Partie non trouvée' 
      });
    }

    // Vérifier que c'est bien le tour du joueur
    if (game.currentPlayer.toString() !== userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'Ce n\'est pas votre tour' 
      });
    }

    // Vérifier que la partie est en cours
    if (game.phase !== 'playing') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'La phase de jeu ne permet pas de jouer de carte actuellement' 
      });
    }

    // Trouver le joueur actif
    const currentPlayer = game.players.find(p => p.user._id.toString() === userId);
    if (!currentPlayer) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false, 
        message: 'Joueur non trouvé dans la partie' 
      });
    }

    // Trouver la carte à jouer
    const cardIndex = currentPlayer.cards.findIndex(c => c._id.toString() === cardId);
    if (cardIndex === -1) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false, 
        message: 'Carte non trouvée dans votre main' 
      });
    }

    const cardToPlay = currentPlayer.cards[cardIndex];

    // Vérifier si le joueur a déjà joué une carte ce tour
    if (currentPlayer.hasPlayedCard) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'Vous avez déjà joué une carte ce tour' 
      });
    }

    // Vérifier si la cible est valide (si nécessaire)
    if (['Q', 'K'].includes(cardToPlay.value) && !targetPlayerId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'Une cible est requise pour cette carte' 
      });
    }

    // Si c'est un Joker, vérifier si c'est un bluff
    if (cardToPlay.value === 'JOKER' && typeof isBluff !== 'boolean') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'Vous devez spécifier si c\'est un bluff ou non' 
      });
    }

    // Traiter le jeu de la carte
    let gameUpdate = {};
    let message = 'Carte jouée avec succès';

    // Utiliser les fonctions existantes pour gérer les actions
    try {
      if (cardToPlay.value === 'JOKER') {
        // Gestion spéciale pour le joker
        gameUpdate = await handleJokerCard(game, currentPlayer, isBluff, cardIndex, session);
      } else if (['J', 'Q', 'K'].includes(cardToPlay.value)) {
        // Gestion des cartes spéciales avec pouvoir
        gameUpdate = await handleUsePower(game, currentPlayer, cardToPlay);
      } else {
        // Gestion des cartes normales
        gameUpdate = await handlePlayCard(game, currentPlayer, cardIndex, null);
      }

      // Marquer que le joueur a joué une carte ce tour
      currentPlayer.hasPlayedCard = true;
      game.lastAction = {
        player: currentPlayer.user._id,
        card: cardToPlay.value,
        targetPlayer: targetPlayerId || null,
        isBluff: cardToPlay.value === 'JOKER' ? isBluff : null,
        timestamp: new Date()
      };

      // Vérifier si c'est la fin du tour
      const allPlayersPlayed = game.players.every(p => p.hasPlayedCard || p.isEliminated);
      if (allPlayersPlayed) {
        // Préparer le prochain tour
        await prepareNextTurn(game, session);
        message += '. Fin du tour !';
      } else {
        // Passer au joueur suivant
        await nextPlayer(game, session);
      }

      // Sauvegarder les modifications
      await game.save({ session });
      await session.commitTransaction();
      session.endSession();

      // Préparer la réponse
      const gameData = game.toObject();
      
      // Nettoyer les données sensibles
      delete gameData.__v;
      gameData.players.forEach(player => {
        delete player.socketId;
        // Ne pas révéler les cartes des autres joueurs
        if (player.user._id.toString() !== userId) {
          player.cards = player.cards.map(card => ({
            id: card.id,
            value: card.isVisible ? card.value : 'HIDDEN',
            isFlipped: card.isFlipped,
            isVisible: card.isVisible,
            position: card.position
          }));
        }
      });

      res.status(200).json({
        success: true,
        message,
        game: gameData,
        ...gameUpdate
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

  } catch (error) {
    console.error('Erreur lors du jeu de la carte:', error);
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    next(error);
  }
};

// Fonction utilitaire pour gérer le joker
async function handleJokerCard(game, player, isBluff, cardIndex, session) {
  if (isBluff) {
    // Le joueur tente un bluff
    const randomValue = ['J', 'Q', 'K'][Math.floor(Math.random() * 3)];
    player.cards.splice(cardIndex, 1); // Retirer le joker de la main
    
    // Ajouter une pénalité si le bluff est découvert (20% de chance)
    if (Math.random() < 0.2) {
      player.score += 10; // Pénalité de 10 points
      return { 
        message: 'Votre bluff a été découvert ! +10 points de pénalité',
        isBluffDiscovered: true
      };
    }
    
    return { 
      message: 'Bluff réussi ! Vous avez évité de piocher une carte',
      isBluffDiscovered: false
    };
  } else {
    // Le joker est joué comme une carte normale
    player.cards.splice(cardIndex, 1);
    return { message: 'Joker joué comme carte neutre' };
  }
}

// Fonction utilitaire pour préparer le prochain tour
async function prepareNextTurn(game, session) {
  // Réinitialiser les états des joueurs pour le prochain tour
  game.players.forEach(player => {
    if (!player.isEliminated) {
      player.hasPlayedCard = false;
    }
  });
  
  // Incrémenter le numéro du tour
  game.currentTurn++;
  
  // Vérifier les conditions de fin de partie
  await checkGameEnd(game, session);
  
  // Passer au premier joueur non éliminé
  await nextPlayer(game, session);
}

// Fonction utilitaire pour passer au joueur suivant
async function nextPlayer(game, session) {
  const currentIndex = game.players.findIndex(
    p => p.user._id.toString() === game.currentPlayer.toString()
  );
  
  let nextIndex = (currentIndex + 1) % game.players.length;
  while (game.players[nextIndex] && game.players[nextIndex].isEliminated) {
    nextIndex = (nextIndex + 1) % game.players.length;
  }
  
  if (game.players[nextIndex]) {
    game.currentPlayer = game.players[nextIndex].user._id;
    await game.save({ session });
  }
}

// Fonction utilitaire pour vérifier les conditions de fin de partie
async function checkGameEnd(game, session) {
  // Vérifier si un joueur a gagné (score le plus bas)
  const activePlayers = game.players.filter(p => !p.isEliminated);
  
  if (activePlayers.length === 1) {
    // Un seul joueur restant, il gagne la partie
    game.status = 'finished';
    game.winner = activePlayers[0].user._id;
    game.finishedAt = new Date();
    await game.save({ session });
    return true;
  }
  
  // Vérifier si tous les joueurs sauf un sont éliminés
  if (activePlayers.length <= 1) {
    game.status = 'finished';
    if (activePlayers.length === 1) {
      game.winner = activePlayers[0].user._id;
    }
    game.finishedAt = new Date();
    await game.save({ session });
    return true;
  }
  
  return false;
}

// Terminer le tour actuel
exports.endTurn = async (req, res, next) => {
  let session = null;
  
  try {
    const { code } = req.params;
    const userId = req.user.id;

    // Démarrer une session pour la transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // Trouver la partie avec verrouillage pour éviter les conflits
    const game = await Game.findOne({ code }).session(session).populate('players.user');
    if (!game) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false, 
        message: 'Partie non trouvée' 
      });
    }

    // Vérifier que c'est bien le tour du joueur
    if (game.currentPlayer.toString() !== userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'Ce n\'est pas votre tour' 
      });
    }

    // Vérifier que la partie est en cours
    if (game.status !== 'playing') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'La partie n\'est pas en cours' 
      });
    }

    // Trouver le joueur actif
    const currentPlayer = game.players.find(p => p.user._id.toString() === userId);
    if (!currentPlayer) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false, 
        message: 'Joueur non trouvé dans la partie' 
      });
    }

    // Marquer que le joueur a terminé son tour
    currentPlayer.hasPlayedCard = true;
    game.lastAction = {
      player: currentPlayer.user._id,
      action: 'end_turn',
      timestamp: new Date()
    };

    // Vérifier si c'est la fin du tour
    const allPlayersPlayed = game.players.every(p => p.hasPlayedCard || p.isEliminated);
    
    if (allPlayersPlayed) {
      // Préparer le prochain tour
      await prepareNextTurn(game, session);
    } else {
      // Passer au joueur suivant
      await nextPlayer(game, session);
    }

    // Sauvegarder les modifications
    await game.save({ session });
    await session.commitTransaction();
    session.endSession();

    // Préparer la réponse
    const gameData = game.toObject();
    
    // Nettoyer les données sensibles
    delete gameData.__v;
    gameData.players.forEach(player => {
      delete player.socketId;
      // Ne pas révéler les cartes des autres joueurs
      if (player.user._id.toString() !== userId) {
        player.cards = player.cards.map(card => ({
          id: card.id,
          value: card.isVisible ? card.value : 'HIDDEN',
          isFlipped: card.isFlipped,
          isVisible: card.isVisible,
          position: card.position
        }));
      }
    });

    res.status(200).json({
      success: true,
      message: 'Tour terminé avec succès',
      game: gameData,
      isNewTurn: allPlayersPlayed
    });

  } catch (error) {
    console.error('Erreur lors de la fin du tour:', error);
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    next(error);
  }
};

// Utiliser un pouvoir spécial (Valet, Dame, Roi)
exports.usePower = async (req, res, next) => {
  let session = null;
  
  try {
    const { code } = req.params;
    const { powerType, targetCardId, targetPlayerId } = req.body;
    const userId = req.user.id;

    // Démarrer une session pour la transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // Trouver la partie avec verrouillage pour éviter les conflits
    const game = await Game.findOne({ code })
      .session(session)
      .populate('players.user')
      .select('+deck');
      
    if (!game) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false, 
        message: 'Partie non trouvée' 
      });
    }

    // Vérifier que c'est bien le tour du joueur
    if (game.currentPlayer.toString() !== userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'Ce n\'est pas votre tour' 
      });
    }

    // Vérifier que la partie est en cours
    if (game.status !== 'playing') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'La partie n\'est pas en cours' 
      });
    }

    // Trouver le joueur actif
    const currentPlayer = game.players.find(p => p.user._id.toString() === userId);
    if (!currentPlayer) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false, 
        message: 'Joueur non trouvé dans la partie' 
      });
    }

    // Vérifier que le type de pouvoir est valide
    if (!['J', 'Q', 'K'].includes(powerType)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'Type de pouvoir invalide' 
      });
    }

    // Vérifier que le pouvoir n'a pas déjà été utilisé
    const powerKey = `${powerType.toLowerCase()}Used`;
    if (currentPlayer.powers[powerKey]) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: `Vous avez déjà utilisé le pouvoir ${powerType} dans cette partie` 
      });
    }

    let result = {};
    let targetPlayer = null;

    // Vérifier la cible si nécessaire
    if (['Q', 'K'].includes(powerType) && !targetPlayerId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: `Une cible est requise pour le pouvoir ${powerType}` 
      });
    }

    // Trouver le joueur cible si spécifié
    if (targetPlayerId) {
      targetPlayer = game.players.find(p => p.user._id.toString() === targetPlayerId);
      if (!targetPlayer) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ 
          success: false, 
          message: 'Joueur cible non trouvé' 
        });
      }
    }

    // Exécuter le pouvoir spécifique
    switch (powerType) {
      case 'J': // Valet - Échanger une carte avec un autre joueur
        if (!targetCardId) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ 
            success: false, 
            message: 'Veuillez sélectionner une carte à échanger' 
          });
        }
        result = await handleJackPower(game, currentPlayer, targetPlayer, targetCardId, session);
        break;
        
      case 'Q': // Dame - Comparer une carte avec un autre joueur
        if (!targetCardId) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ 
            success: false, 
            message: 'Veuillez sélectionner une carte à comparer' 
          });
        }
        result = await handleQueenPower(game, currentPlayer, targetPlayer, targetCardId, session);
        break;
        
      case 'K': // Roi - Regarder la main d'un autre joueur
        result = await handleKingPower(game, currentPlayer, targetPlayer, session);
        break;
    }

    // Marquer le pouvoir comme utilisé
    currentPlayer.powers[powerKey] = true;
    
    // Enregistrer l'action
    game.actions.push({
      type: 'power_used',
      player: currentPlayer.user._id,
      power: powerType,
      targetPlayer: targetPlayer ? targetPlayer.user._id : null,
      timestamp: new Date()
    });

    // Sauvegarder les modifications
    await game.save({ session });
    await session.commitTransaction();
    session.endSession();

    // Préparer la réponse
    const gameData = game.toObject();
    
    // Nettoyer les données sensibles
    delete gameData.__v;
    gameData.players.forEach(player => {
      delete player.socketId;
      // Ne pas révéler les cartes des autres joueurs
      if (player.user._id.toString() !== userId) {
        player.cards = player.cards.map(card => ({
          id: card.id,
          value: card.isVisible ? card.value : 'HIDDEN',
          isFlipped: card.isFlipped,
          isVisible: card.isVisible,
          position: card.position
        }));
      }
    });

    res.status(200).json({
      success: true,
      message: `Pouvoir ${powerType} utilisé avec succès`,
      game: gameData,
      ...result
    });

  } catch (error) {
    console.error('Erreur lors de l\'utilisation du pouvoir:', error);
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    next(error);
  }
};

// Fonction utilitaire pour gérer le pouvoir du Valet (échange de cartes)
async function handleJackPower(game, currentPlayer, targetPlayer, targetCardId, session) {
  // Vérifier que la carte cible appartient bien au joueur actuel
  const cardIndex = currentPlayer.cards.findIndex(c => c._id.toString() === targetCardId);
  if (cardIndex === -1) {
    throw new Error('Carte non trouvée dans votre main');
  }
  
  // Vérifier que le joueur cible a des cartes
  if (targetPlayer.cards.length === 0) {
    throw new Error('Le joueur cible n\'a pas de cartes');
  }
  
  // Choisir une carte aléatoire chez le joueur cible
  const randomIndex = Math.floor(Math.random() * targetPlayer.cards.length);
  const targetCard = targetPlayer.cards[randomIndex];
  
  // Échanger les cartes
  const playerCard = currentPlayer.cards[cardIndex];
  currentPlayer.cards[cardIndex] = targetCard;
  targetPlayer.cards[randomIndex] = playerCard;
  
  // Enregistrer l'action
  game.actions.push({
    type: 'card_swapped',
    fromPlayer: currentPlayer.user._id,
    toPlayer: targetPlayer.user._id,
    cardFrom: playerCard.value,
    cardTo: targetCard.value,
    timestamp: new Date()
  });
  
  await game.save({ session });
  
  return {
    message: `Vous avez échangé une carte avec ${targetPlayer.user.firstName}`,
    cardReceived: targetCard.value,
    cardGiven: playerCard.value
  };
}

// Fonction utilitaire pour gérer le pouvoir de la Dame (comparaison de cartes)
async function handleQueenPower(game, currentPlayer, targetPlayer, targetCardId, session) {
  // Vérifier que la carte cible appartient bien au joueur actuel
  const cardIndex = currentPlayer.cards.findIndex(c => c._id.toString() === targetCardId);
  if (cardIndex === -1) {
    throw new Error('Carte non trouvée dans votre main');
  }
  
  // Choisir une carte aléatoire chez le joueur cible
  const randomIndex = Math.floor(Math.random() * targetPlayer.cards.length);
  const targetCard = targetPlayer.cards[randomIndex];
  const playerCard = currentPlayer.cards[cardIndex];
  
  // Comparer les valeurs des cartes
  const playerCardValue = getCardValue(playerCard.value);
  const targetCardValue = getCardValue(targetCard.value);
  
  let message = '';
  
  if (playerCardValue > targetCardValue) {
    message = `Votre carte (${playerCard.value}) est plus forte que celle de ${targetPlayer.user.firstName} (${targetCard.value})`;
  } else if (playerCardValue < targetCardValue) {
    message = `Votre carte (${playerCard.value}) est plus faible que celle de ${targetPlayer.user.firstName} (${targetCard.value})`;
  } else {
    message = `Égalité entre votre carte (${playerCard.value}) et celle de ${targetPlayer.user.firstName} (${targetCard.value})`;
  }
  
  // Enregistrer l'action
  game.actions.push({
    type: 'card_compared',
    player1: currentPlayer.user._id,
    player2: targetPlayer.user._id,
    card1: playerCard.value,
    card2: targetCard.value,
    result: message,
    timestamp: new Date()
  });
  
  await game.save({ session });
  
  return {
    message,
    comparison: {
      yourCard: playerCard.value,
      theirCard: targetCard.value,
      result: playerCardValue > targetCardValue ? 'win' : 
              playerCardValue < targetCardValue ? 'lose' : 'draw'
    }
  };
}

// Fonction utilitaire pour gérer le pouvoir du Roi (regarder la main d'un joueur)
async function handleKingPower(game, currentPlayer, targetPlayer, session) {
  // Révéler toutes les cartes du joueur cible au joueur actuel
  const revealedCards = targetPlayer.cards.map(card => ({
    id: card._id,
    value: card.value,
    isVisible: true
  }));
  
  // Enregistrer l'action
  game.actions.push({
    type: 'hand_revealed',
    player: currentPlayer.user._id,
    targetPlayer: targetPlayer.user._id,
    timestamp: new Date()
  });
  
  await game.save({ session });
  
  return {
    message: `Vous avez regardé la main de ${targetPlayer.user.firstName}`,
    revealedHand: revealedCards,
    targetPlayerId: targetPlayer.user._id
  };
}

// Fonction utilitaire pour obtenir la valeur numérique d'une carte
function getCardValue(cardValue) {
  if (cardValue === 'A') return 1;
  if (cardValue === 'J') return 11;
  if (cardValue === 'Q') return 12;
  if (cardValue === 'K') return 13;
  if (cardValue === 'JOKER') return 0;
  return parseInt(cardValue, 10);
}

// Obtenir l'historique des actions d'une partie
exports.getGameHistory = async (req, res, next) => {
  try {
    const { code } = req.params;
    const { limit = 20, page = 1 } = req.query;

    // Trouver la partie
    const game = await Game.findOne({ code })
      .select('actions')
      .sort({ 'actions.timestamp': -1 })
      .limit(parseInt(limit, 10))
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10));

    if (!game) {
      return res.status(404).json({ 
        success: false, 
        message: 'Partie non trouvée' 
      });
    }

    // Compter le nombre total d'actions
    const totalActions = game.actions.length;
    const totalPages = Math.ceil(totalActions / parseInt(limit, 10));

    res.status(200).json({
      success: true,
      actions: game.actions,
      pagination: {
        total: totalActions,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    next(error);
  }
};
