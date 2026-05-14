const User  = require('../models/User');
const Table = require('../models/Table');
const socketInstance = require('../services/socketInstance');

// ── Stats globales ────────────────────────────────────────────────────────────
exports.getStats = async (_req, res) => {
  try {
    const [totalUsers, totalGuests, activeTables, waitingTables, finishedTables] = await Promise.all([
      User.countDocuments({ isGuest: { $ne: true }, isAdmin: { $ne: true } }),
      User.countDocuments({ isGuest: true }),
      Table.countDocuments({ status: 'playing' }),
      Table.countDocuments({ status: 'waiting' }),
      Table.countDocuments({ status: 'finished' }),
    ]);
    res.json({ success: true, data: { totalUsers, totalGuests, activeTables, waitingTables, finishedTables } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── Liste des joueurs ─────────────────────────────────────────────────────────
exports.getUsers = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const query = { isAdmin: { $ne: true }, isGuest: { $ne: true } };
    if (search) query.$or = [
      { firstName: new RegExp(search, 'i') },
      { lastName:  new RegExp(search, 'i') },
      { email:     new RegExp(search, 'i') },
    ];
    const users = await User.find(query)
      .select('firstName lastName email elo gamesPlayed gamesWon createdAt')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: users });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── Supprimer un joueur ───────────────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'Introuvable' });
    if (user.isAdmin) return res.status(403).json({ success: false, error: 'Impossible de supprimer un admin' });
    await Table.deleteMany({ hostId: req.params.id });
    await User.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── Modifier l'ELO d'un joueur ────────────────────────────────────────────────
exports.updateUserElo = async (req, res) => {
  try {
    const elo = Number(req.body.elo);
    if (isNaN(elo)) return res.status(400).json({ success: false, error: 'ELO invalide' });
    const user = await User.findByIdAndUpdate(req.params.id, { elo }, { new: true });
    if (!user) return res.status(404).json({ success: false, error: 'Introuvable' });
    res.json({ success: true, data: user.toPublic() });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── Liste des tables ──────────────────────────────────────────────────────────
exports.getTables = async (_req, res) => {
  try {
    const tables = await Table.find({})
      .select('code maxPlayers players status createdAt hostId')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: tables });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── Forcer la suppression d'une table ────────────────────────────────────────
exports.deleteTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ success: false, error: 'Introuvable' });
    await table.deleteOne();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── Nettoyer les comptes invités orphelins ────────────────────────────────────
exports.cleanupGuests = async (_req, res) => {
  try {
    const result = await User.deleteMany({ isGuest: true });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── Broadcast message vers tous les joueurs connectés ────────────────────────
exports.broadcast = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, error: 'Message vide' });
    socketInstance.emit('admin:message', { message: message.trim() });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};
