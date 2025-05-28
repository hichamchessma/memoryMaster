const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateGameCode } = require('../utils/gameUtils');

// Générer un token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Inscription d'un nouvel utilisateur
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, age, nationality } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    // Créer un nouvel utilisateur
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      age,
      nationality
    });

    // Générer le token JWT
    const token = generateToken(user._id);

    // Envoyer la réponse
    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      age: user.age,
      nationality: user.nationality,
      elo: user.elo,
      token
    });
  } catch (error) {
    next(error);
  }
};

// Connexion d'un utilisateur
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Vérifier si l'utilisateur existe
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Mettre à jour la dernière connexion
    user.lastLogin = new Date();
    await user.save();

    // Générer le token JWT
    const token = generateToken(user._id);

    // Envoyer la réponse
    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      age: user.age,
      nationality: user.nationality,
      elo: user.elo,
      totalPoints: user.totalPoints,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      token
    });
  } catch (error) {
    next(error);
  }
};

// Récupérer le profil de l'utilisateur connecté
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      age: user.age,
      nationality: user.nationality,
      elo: user.elo,
      totalPoints: user.totalPoints,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    });
  } catch (error) {
    next(error);
  }
};

// Mettre à jour le profil utilisateur
exports.updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, age, nationality } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Mettre à jour les champs fournis
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (age) user.age = age;
    if (nationality) user.nationality = nationality;
    
    await user.save();
    
    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      age: user.age,
      nationality: user.nationality,
      elo: user.elo
    });
  } catch (error) {
    next(error);
  }
};
