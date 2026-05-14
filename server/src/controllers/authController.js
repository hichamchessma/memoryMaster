const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken    = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
const signGuestTok = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '24h' });

const GUEST_ADJ  = ['Vif', 'Sage', 'Rusé', 'Malin', 'Furtif', 'Audacieux', 'Chanceux', 'Fougueux'];
const GUEST_NOUN = ['Renard', 'Aigle', 'Lynx', 'Tigre', 'Cobra', 'Faucon', 'Puma', 'Jaguar'];

exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ success: false, error: 'Tous les champs sont requis' });
    if (await User.findOne({ email }))
      return res.status(400).json({ success: false, error: 'Email déjà utilisé' });

    const user = await User.create({ firstName, lastName, email, password });
    const token = signToken(user._id);
    res.status(201).json({ success: true, token, user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: 'Email et mot de passe requis' });

    // Alias "admin" → compte admin
    const lookupEmail = email.toLowerCase().trim() === 'admin' ? 'admin@mm.local' : email;
    const user = await User.findOne({ email: lookupEmail });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, error: 'Identifiants incorrects' });

    user.lastLogin = new Date();
    await user.save();
    const token = signToken(user._id);
    res.json({ success: true, token, user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.me = async (req, res) => {
  res.json({ success: true, user: req.user.toPublic() });
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { firstName, lastName },
      { new: true }
    );
    res.json({ success: true, user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.leaderboard = async (_req, res) => {
  try {
    const users = await User.find({ isGuest: { $ne: true } })
      .select('firstName lastName elo gamesPlayed gamesWon')
      .sort({ elo: -1 })
      .limit(20);
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createGuest = async (req, res) => {
  try {
    const adj  = GUEST_ADJ[Math.floor(Math.random() * GUEST_ADJ.length)];
    const noun = GUEST_NOUN[Math.floor(Math.random() * GUEST_NOUN.length)];
    const num  = Math.floor(Math.random() * 9000) + 1000;

    const guest = await User.create({
      firstName: adj,
      lastName:  `${noun}#${num}`,
      email:     `guest_${Date.now()}_${Math.random().toString(36).slice(2)}@guest.mm`,
      password:  Math.random().toString(36) + Math.random().toString(36),
      isGuest:   true,
    });

    const token = signGuestTok(guest._id);
    res.status(201).json({ success: true, token, user: guest.toPublic() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
