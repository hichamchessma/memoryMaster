const User = require('../models/User');
const Game = require('../models/Game');
const jwt = require('jsonwebtoken');

/**
 * Créer une session de test automatique avec 2 joueurs
 * Crée Ali et Hicham, une table, et les fait rejoindre
 */
exports.createTestSession = async (req, res, next) => {
  try {
    console.log('🧪 Creating test session...');

    // 1. Créer ou récupérer les utilisateurs de test
    let ali = await User.findOne({ email: 'ali@test.com' });
    if (!ali) {
      ali = await User.create({
        firstName: 'Ali',
        lastName: 'Test',
        email: 'ali@test.com',
        password: 'test123',
        elo: 1200
      });
      console.log('✅ Ali created');
    }

    let hicham = await User.findOne({ email: 'hicham@test.com' });
    if (!hicham) {
      hicham = await User.create({
        firstName: 'Hicham',
        lastName: 'Test',
        email: 'hicham@test.com',
        password: 'test123',
        elo: 1200
      });
      console.log('✅ Hicham created');
    }

    // 2. Créer une nouvelle table
    const game = await Game.create({
      code: Math.random().toString(36).substr(2, 6).toUpperCase(),
      host: ali._id,
      maxPlayers: 2,
      cardsPerPlayer: 4,
      status: 'waiting',
      players: []
    });
    console.log('✅ Table created:', game.code);

    // 3. Faire rejoindre Ali (position 0)
    game.players.push({
      user: ali._id,
      username: `${ali.firstName} ${ali.lastName}`,
      position: 0,
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
    });

    // 4. Faire rejoindre Hicham (position 1)
    game.players.push({
      user: hicham._id,
      username: `${hicham.firstName} ${hicham.lastName}`,
      position: 1,
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
    console.log('✅ Players joined');

    // 5. Générer les tokens JWT
    const aliToken = jwt.sign(
      { id: ali._id, email: ali.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    const hichamToken = jwt.sign(
      { id: hicham._id, email: hicham.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // 6. Retourner les données
    res.json({
      success: true,
      data: {
        tableId: game._id.toString(),
        tableCode: game.code,
        ali: {
          userId: ali._id.toString(),
          token: aliToken,
          name: `${ali.firstName} ${ali.lastName}`
        },
        hicham: {
          userId: hicham._id.toString(),
          token: hichamToken,
          name: `${hicham.firstName} ${hicham.lastName}`
        },
        players: game.players.map(p => ({
          _id: p.user.toString(),
          firstName: p.username.split(' ')[0],
          lastName: p.username.split(' ')[1],
          position: p.position,
          isReady: p.isReady,
          isHost: p.isHost
        }))
      }
    });

    console.log('✅ Test session created successfully');
  } catch (error) {
    console.error('❌ Error creating test session:', error);
    next(error);
  }
};
