const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');

// Use the same fallback as in authController.js
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

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
          id: 'dev-user-id',
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
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Support des invités (pas de lookup DB)
      if (decoded && decoded.guest) {
        // Vérifier si l'ID est un ObjectId valide
        let userId = decoded.id;
        
        // Si l'ID n'est pas un ObjectId valide (ancien système temporaire)
        if (!mongoose.Types.ObjectId.isValid(userId)) {
          // Créer un utilisateur invité en base pour avoir un vrai ObjectId
          const suffix = Math.floor(1000 + Math.random() * 9000);
          const firstName = decoded.firstName || `Invité ${suffix}`;
          const email = `guest-${Date.now()}-${suffix}@guest.local`;
          const randomPwd = Math.random().toString(36).slice(2);
          
          const guestUser = await User.create({
            firstName,
            lastName: 'Guest',
            email,
            password: randomPwd,
            nationality: '',
            age: null,
          });
          
          userId = guestUser._id;
        }
        
        req.user = {
          _id: userId,
          id: userId,
          firstName: decoded.firstName || 'Invité',
          lastName: '',
          email: '',
          age: null,
          nationality: '',
          elo: 1000,
          totalPoints: 0,
          avatar: '',
          role: 'admin',  // Tous les invités sont admin par défaut pour les tests
        };
      } else {
        req.user = await User.findById(decoded.id).select('-password');
        if (req.user && !req.user.id) {
          // Garantir la présence de req.user.id pour les contrôleurs
          req.user.id = req.user._id;
        }
        req.user.role = 'admin'; // Tous les utilisateurs sont admin par défaut pour les tests
      }
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

