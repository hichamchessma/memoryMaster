const Table = require('../models/Table');
const { generateCode } = require('../services/gameService');

exports.createTable = async (req, res) => {
  try {
    const { maxPlayers = 2 } = req.body;
    const user = req.user;
    const code = generateCode();

    const table = await Table.create({
      code,
      maxPlayers,
      hostId: user._id.toString(),
      players: [{
        userId: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        isHost: true,
        isReady: false,
        position: 0,
        elo: user.elo,
      }],
    });

    res.status(201).json({ success: true, data: table });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getTables = async (_req, res) => {
  try {
    const tables = await Table.find({ status: { $in: ['waiting', 'playing'] } })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: tables });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ success: false, error: 'Table introuvable' });
    res.json({ success: true, data: table });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ success: false, error: 'Table introuvable' });
    if (table.hostId !== req.user._id.toString())
      return res.status(403).json({ success: false, error: 'Seul l\'hôte peut supprimer' });
    await table.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
