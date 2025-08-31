const Game = require('../models/Game');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const { getGameState } = require('../services/socketService');
const jwt = require('jsonwebtoken');

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

// Remplir automatiquement la partie avec des invités simulés
exports.autofillGame = async (req, res, next) => {
  try {
    const { code } = req.params;
    const { count } = req.body || {};

    const game = await Game.findOne({ code });
    if (!game) {
      return res.status(404).json({ success: false, message: 'Partie non trouvée' });
    }
    if (game.status !== 'waiting') {
      return res.status(400).json({ success: false, message: 'La partie n\'est pas en attente' });
    }

    const missing = Math.max(0, (count ?? (game.maxPlayers - game.players.length)));
    const toAdd = Math.min(missing, game.maxPlayers - game.players.length);
    if (toAdd <= 0) {
      return res.json({ success: true, message: 'Aucun invité à ajouter', players: game.players.length });
    }

    for (let i = 0; i < toAdd; i++) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const firstName = `Invité ${suffix}`;
      const lastName = 'Guest';
      const email = `guest-${Date.now()}-${suffix}@guest.local`;
      const randomPwd = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

      // Créer l'utilisateur invité minimal
      const guestUser = await User.create({
        firstName, lastName, email, password: randomPwd, nationality: '', age: null
      });

      // Ajouter comme joueur
      game.players.push({
        user: guestUser._id,
        socketId: '',
        username: `${firstName} ${lastName}`,
        position: game.players.length + 1,
        score: 0,
        actualScore: 0,
        cards: [],
        isReady: true,
        isHost: false,
        isEliminated: false,
        hasBombom: false,
        bombomActivated: false,
        bombomCanceled: false,
        powers: { jUsed: false, qUsed: false, kUsed: false }
      });
    }

    // Marquer l'hôte prêt si la salle est pleine
    if (game.players.length >= game.maxPlayers) {
      const hostPlayer = game.players.find(p => p.user.toString() === game.host.toString());
      if (hostPlayer) hostPlayer.isReady = true;
    }

    await game.save();

    const gameData = game.toObject();
    delete gameData.__v;
    gameData.players.forEach(p => delete p.socketId);

    res.json({ success: true, message: 'Invités ajoutés', game: gameData });

    // notifier via socket
    try {
      const io = req.app.get('io');
      if (io) io.to(game.code).emit('game_updated', await getGameState(game));
    } catch (e) {
      console.error('Erreur émission socket autofill:', e);
    }
  } catch (error) {
    next(error);
  }
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
      data: gameData
    });

    // Notifier le lobby (liste des salons)
    try {
      const io = req.app.get('io');
      if (io) io.emit('lobby_updated');
    } catch (e) {
      console.error('Erreur émission socket lobby_updated (createGame):', e);
    }
  } catch (error) {
    console.error('Erreur lors de la création de la partie:', error);
    next(error);
  }
};

// Lister les parties (salons) avec filtres simples
exports.listGames = async (req, res, next) => {
  try {
    const { status = 'waiting' } = req.query;
    const query = {};
    if (status) query.status = status;

    const games = await Game.find(query)
      .select('code name status maxPlayers players host createdAt')
      .populate('host', 'firstName lastName')
      .lean();

    const data = games.map(g => ({
      code: g.code,
      name: g.name || '',
      status: g.status,
      maxPlayers: g.maxPlayers,
      playerCount: g.players?.length || 0,
      host: g.host,
      createdAt: g.createdAt
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// Mettre à jour le nom d'un salon (réservé à l'hôte)
exports.updateGameName = async (req, res, next) => {
  try {
    const { code } = req.params;
    const { name } = req.body || {};
    const userId = req.user.id;

    if (typeof name !== 'string' || name.length > 64) {
      return res.status(400).json({ success: false, message: 'Nom invalide' });
    }

    const game = await Game.findOne({ code });
    if (!game) return res.status(404).json({ success: false, message: 'Partie non trouvée' });

    if (game.host.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Seul l'hôte peut renommer le salon" });
    }

    game.name = name.trim();
    await game.save();

    res.json({ success: true, data: { code: game.code, name: game.name } });

    // Notifier le lobby
    try {
      const io = req.app.get('io');
      if (io) io.emit('lobby_updated');
    } catch (e) {
      console.error('Erreur émission socket lobby_updated (updateGameName):', e);
    }
  } catch (error) {
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

    // Émettre l'état aux clients du salon via Socket.IO
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(game.code).emit('game_updated', await getGameState(game));
      }
    } catch (e) {
      console.error('Erreur émission socket startGame:', e);
    }
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

    // Si la partie est en cours, ajouter les cartes du joueur (statuts en minuscules)
    if (['exploration', 'playing', 'finished'].includes(game.status)) {
      response.playerCards = player.cards.map(card => ({
        ...card.toObject(),
        // Ne pas révéler les cartes des autres joueurs
        isVisible: card.isVisible || game.status === 'finished' || 
                  (game.status === 'exploration' && card.position === 'BOTTOM')
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

    // Vérifier que la partie est en cours (statuts en minuscules)
    if (game.status !== 'playing') {
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

// plus utilisé, logique déplacée dans usePower
async function handleUsePower(game, player, powerCard) {
  return null;
}
// (Ancienne fonction, plus utilisée. Logique déplacée dans usePower)


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
    const { powerType, option, targetCardId, targetPlayerId, cardId1, cardId2, playerId1, playerId2 } = req.body;
    const userId = req.user.id;

    session = await mongoose.startSession();
    session.startTransaction();

    const game = await Game.findOne({ code })
      .session(session)
      .populate('players.user')
      .select('+deck');

    if (!game) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Partie non trouvée' });
    }
    if (game.currentPlayer.toString() !== userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Ce n\'est pas votre tour' });
    }
    if (game.status !== 'playing') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'La partie n\'est pas en cours' });
    }
    const currentPlayer = game.players.find(p => p.user._id.toString() === userId);
    if (!currentPlayer) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Joueur non trouvé dans la partie' });
    }
    if (!['J', 'Q', 'K'].includes(powerType)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Type de pouvoir invalide' });
    }
    const powerKey = `${powerType.toLowerCase()}Used`;
    if (currentPlayer.powers[powerKey]) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `Vous avez déjà utilisé le pouvoir ${powerType} dans cette partie` });
    }
    let result = {};
    // Option "activate" = activer le pouvoir, sinon "integrate" = intégrer la carte et chasser
    if (option === 'activate') {
      switch (powerType) {
        case 'J': // Valet: regarder une de ses propres cartes
          if (!targetCardId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Veuillez sélectionner votre carte à regarder' });
          }
          // On simule la "révélation" temporaire côté client, ici on ne fait qu'informer
          result = { message: 'Vous pouvez regarder votre carte', cardId: targetCardId, duration: 10 };
          // Défausser le Valet de la main du joueur (suppression côté client ou à gérer ici)
          break;
        case 'Q': // Dame: regarder une carte d'un adversaire
          if (!targetPlayerId || !targetCardId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Cible et carte requises pour la Dame' });
          }
          const targetPlayerQ = game.players.find(p => p.user._id.toString() === targetPlayerId);
          if (!targetPlayerQ) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'Joueur cible non trouvé' });
          }
          result = { message: 'Vous pouvez regarder la carte de votre adversaire', cardId: targetCardId, playerId: targetPlayerId, duration: 10 };
          // Défausser la Dame
          break;
        case 'K': // Roi: échanger deux cartes entre deux joueurs différents
          if (!playerId1 || !playerId2 || !cardId1 || !cardId2 || playerId1 === playerId2) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Veuillez sélectionner deux joueurs différents et leurs cartes à échanger' });
          }
          const p1 = game.players.find(p => p.user._id.toString() === playerId1);
          const p2 = game.players.find(p => p.user._id.toString() === playerId2);
          if (!p1 || !p2) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'Un des joueurs sélectionnés n\'existe pas' });
          }
          const c1Idx = p1.cards.findIndex(c => c._id.toString() === cardId1);
          const c2Idx = p2.cards.findIndex(c => c._id.toString() === cardId2);
          if (c1Idx === -1 || c2Idx === -1) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'Une des cartes sélectionnées n\'existe pas' });
          }
          // Échange effectif
          const temp = p1.cards[c1Idx];
          p1.cards[c1Idx] = p2.cards[c2Idx];
          p2.cards[c2Idx] = temp;
          result = { message: 'Échange effectué avec succès' };
          // Défausser le Roi
          break;
      }
    } else if (option === 'integrate') {
      // On intègre la carte spéciale dans la main et on chasse une carte (à gérer côté client ou ici)
      if (!targetCardId) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Veuillez sélectionner la carte à chasser' });
      }
      // Suppression de la carte chassée de la main du joueur
      const idx = currentPlayer.cards.findIndex(c => c._id.toString() === targetCardId);
      if (idx === -1) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: 'Carte à chasser non trouvée dans votre main' });
      }
      currentPlayer.cards.splice(idx, 1);
      result = { message: 'Carte spéciale intégrée, carte chassée' };
    } else {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Option invalide' });
    }
    currentPlayer.powers[powerKey] = true;
    game.actions.push({
      type: 'power_used',
      player: currentPlayer.user._id,
      power: powerType,
      timestamp: new Date()
    });
    await game.save({ session });
    await session.commitTransaction();
    session.endSession();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    next(error);
  }
};
// Anciennes définitions et doublons de usePower supprimés


// Anciennes fonctions utilitaires des pouvoirs spéciaux supprimées (toute la logique est dans usePower)

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
