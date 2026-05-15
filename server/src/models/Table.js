const mongoose = require('mongoose');

const playerSlotSchema = new mongoose.Schema({
  userId:    { type: String, required: true },
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  socketId:  { type: String, default: null },
  isReady:   { type: Boolean, default: false },
  isHost:    { type: Boolean, default: false },
  position:  { type: Number, required: true },
  elo:       { type: Number, default: 1000 },
}, { _id: false });

const gameConfigSchema = new mongoose.Schema({
  cardsPerPlayer: { type: Number, enum: [4, 6, 8], default: 4 },
  memoDuration:   { type: Number, default: 7,  min: 3,  max: 30 },  // secondes
  drawTime:       { type: Number, default: 10, min: 5,  max: 60 },  // secondes
  choiceTime:     { type: Number, default: 15, min: 5,  max: 60 },  // secondes
}, { _id: false });

const tableSchema = new mongoose.Schema({
  code:       { type: String, required: true, unique: true, uppercase: true },
  maxPlayers: { type: Number, enum: [2, 3, 4], default: 2 },
  players:    [playerSlotSchema],
  hostId:     { type: String, required: true },
  status:     { type: String, enum: ['waiting', 'playing', 'finished'], default: 'waiting' },
  gameState:  { type: mongoose.Schema.Types.Mixed, default: null },
  gameConfig: { type: gameConfigSchema, default: () => ({}) },
}, { timestamps: true });

module.exports = mongoose.model('Table', tableSchema);
