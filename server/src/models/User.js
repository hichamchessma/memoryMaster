const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName:  { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, minlength: 6 },
  avatar:    { type: String, default: null },
  elo:         { type: Number, default: 1000 },
  gamesPlayed: { type: Number, default: 0 },
  gamesWon:    { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  lastLogin:   { type: Date, default: Date.now },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublic = function () {
  return {
    _id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    email: this.email,
    avatar: this.avatar,
    elo: this.elo,
    gamesPlayed: this.gamesPlayed,
    gamesWon: this.gamesWon,
    totalPoints: this.totalPoints,
  };
};

module.exports = mongoose.model('User', userSchema);
