const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateGameCode } = require('../utils/gameUtils');
const { OAuth2Client } = require('google-auth-library');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Générer un token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Connexion via Google (Google Identity Services — idToken -> JWT interne)
exports.googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'idToken manquant' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ message: 'GOOGLE_CLIENT_ID non configuré' });
    }

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ message: 'Token Google invalide' });
    }

    const email = payload.email.toLowerCase();
    const firstName = payload.given_name || 'Joueur';
    const lastName = payload.family_name || '';

    // Upsert utilisateur basé sur l'email Google
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        firstName,
        lastName,
        email,
        password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
        nationality: '',
        age: null,
      });
    } else {
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.lastLogin = new Date();
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
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

// Générer un token JWT invité (sans utilisateur DB)
const generateGuestToken = (guest) => {
  return jwt.sign({
    guest: true,
    id: guest._id,
    role: 'guest',
    firstName: guest.firstName,
  }, JWT_SECRET, { expiresIn: '7d' });
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
    
    // --- LOG DE DÉBOGAGE ---
    console.log(`[Login Attempt] Email: ${email}`);
    if (!user) {
      console.log('[Login Result] Utilisateur non trouvé.');
      return res.status(401).json({ message: 'Identifiants invalides' });
    }
    console.log(`[Login Debug] Utilisateur trouvé: ${user.email}`);
    console.log(`[Login Debug] Hash stocké: ${user.password}`);
    // --- FIN LOG ---

    // Vérifier le mot de passe
    const isMatch = await user.comparePassword(password);
    
    // --- LOG DE DÉBOGAGE ---
    console.log(`[Login Result] La comparaison du mot de passe a retourné: ${isMatch}`);
    // --- FIN LOG ---

    if (!isMatch) {
      return res.status(401).json({ message: 'Identifiants invalides' });
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

// Connexion en mode invité (sans compte)
exports.guestLogin = async (req, res, next) => {
  try {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const guest = {
      _id: `guest-${Date.now()}-${suffix}`,
      firstName: `Invité ${suffix}`,
      lastName: '',
      email: '',
      age: null,
      nationality: '',
      elo: 1000,
      totalPoints: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      role: 'guest'
    };

    const token = jwt.sign({
      guest: true,
      id: guest._id,
      role: 'guest',
      firstName: guest.firstName,
    }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      ...guest,
      token
    });
  } catch (error) {
    next(error);
  }
};
