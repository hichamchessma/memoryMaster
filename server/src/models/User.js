const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Le prénom est requis'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Veuillez entrer un email valide']
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
    select: false
  },
  age: {
    type: Number,
    min: [12, 'L\'âge minimum est de 12 ans'],
    max: [120, 'L\'âge maximum est de 120 ans']
  },
  nationality: {
    type: String,
    trim: true
  },
  elo: {
    type: Number,
    default: 1000
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  gamesPlayed: {
    type: Number,
    default: 0
  },
  gamesWon: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Hachage du mot de passe avant la sauvegarde
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour vérifier le mot de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Méthode pour mettre à jour le score après une partie
userSchema.methods.updateStats = function(win, points) {
  this.gamesPlayed += 1;
  this.totalPoints += points;
  
  if (win) {
    this.gamesWon += 1;
    this.elo += 20; // Augmentation de l'ELO en cas de victoire
  } else {
    this.elo = Math.max(0, this.elo - 10); // Diminution de l'ELO en cas de défaite, avec un minimum de 0
  }
  
  return this.save();
};

const User = mongoose.model('User', userSchema);

module.exports = User;
