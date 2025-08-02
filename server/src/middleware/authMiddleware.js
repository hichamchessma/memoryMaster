const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protéger les routes
const protect = async (req, res, next) => {
  let token;

  // Vérifier le token dans le header Authorization
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extraire le token du header
      token = req.headers.authorization.split(' ')[1];

      // DEV MODE: bypass si token == 'dev-token'
      if (token === 'dev-token' && (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV)) {
        req.user = {
          _id: 'dev-user-id',
          firstName: 'Dev',
          lastName: 'User',
          email: 'dev@memorymaster.local',
          age: 30,
          nationality: 'FR',
          elo: 1000,
          totalPoints: 0,
          avatar: '',
          role: 'admin',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        return next();
      }
      // Vérifier le token normalement sinon
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      console.error('Erreur d\'authentification:', error);
      res.status(401).json({ message: 'Non autorisé, token invalide' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Non autorisé, pas de token' });
  }
};

// Vérifier les rôles utilisateur
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Le rôle ${req.user.role} n'est pas autorisé à accéder à cette route`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
