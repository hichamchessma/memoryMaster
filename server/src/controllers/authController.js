const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User   = require('../models/User');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
// FROM : change par ton domaine vérifié sur resend.com (ex: noreply@tondomaine.com)
// En attendant onboarding@resend.dev fonctionne UNIQUEMENT vers l'email propriétaire du compte Resend
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

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
    if (user.isBanned)
      return res.status(403).json({ success: false, error: 'Ce compte a été suspendu. Contacte le support.' });

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

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email requis' });

    const user = await User.findOne({ email: email.toLowerCase(), isGuest: { $ne: true } });
    // Réponse identique que le compte existe ou non (anti-énumération)
    if (!user) return res.json({ success: true });

    const code    = Math.floor(100000 + Math.random() * 900000).toString(); // code 6 chiffres
    const hashed  = await bcrypt.hash(code, 10);
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    user.resetPasswordToken   = hashed;
    user.resetPasswordExpires = expires;
    await user.save();

    await resend.emails.send({
      from:    FROM_EMAIL,
      to:      user.email,
      subject: '🔐 Ton code MemoryMaster',
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8"><style>
          body{background:#0f0a1e;margin:0;padding:40px 20px;font-family:Arial,sans-serif}
          .card{background:#1e1b4b;max-width:460px;margin:0 auto;border-radius:16px;padding:36px;border:1px solid #7c3aed33}
          h1{color:#a78bfa;text-align:center;margin-bottom:4px;font-size:22px}
          p{color:#94a3b8;line-height:1.6;font-size:14px}
          .code{background:#0f0a1e;color:#a78bfa;font-size:38px;font-weight:900;text-align:center;letter-spacing:10px;padding:22px;border-radius:12px;margin:24px 0;border:1px solid #7c3aed44}
          .note{color:#475569;font-size:12px;text-align:center;margin-top:12px}
        </style></head>
        <body><div class="card">
          <h1>🃏 MemoryMaster</h1>
          <p style="text-align:center;color:#64748b;margin-top:4px">Réinitialisation de mot de passe</p>
          <p>Bonjour <strong style="color:#e2e8f0">${user.firstName}</strong>,</p>
          <p>Voici ton code de réinitialisation :</p>
          <div class="code">${code}</div>
          <p>Saisis ce code dans l'application pour choisir un nouveau mot de passe.</p>
          <p class="note">⏱ Ce code expire dans <strong>15 minutes</strong>.</p>
          <p class="note">Tu n'as pas demandé cela ? Ignore cet email.</p>
        </div></body></html>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword)
      return res.status(400).json({ success: false, error: 'Tous les champs sont requis' });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, error: 'Mot de passe trop court (6 caractères min)' });

    const user = await User.findOne({
      email:                email.toLowerCase(),
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user || !user.resetPasswordToken)
      return res.status(400).json({ success: false, error: 'Code invalide ou expiré' });

    const valid = await bcrypt.compare(code.trim(), user.resetPasswordToken);
    if (!valid)
      return res.status(400).json({ success: false, error: 'Code incorrect' });

    user.password             = newPassword; // le pre-save hook hash automatiquement
    user.resetPasswordToken   = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.googleAuth = async (req, res) => {
  try {
    const { accessToken, idToken } = req.body;
    if (!accessToken && !idToken) return res.status(400).json({ success: false, error: 'Token requis' });

    let googleUser;

    // idToken (SDK natif) — vérification directe, plus fiable
    if (idToken) {
      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      googleUser = await r.json();
      if (googleUser.error) googleUser = null;
    }

    // Fallback : accessToken via userinfo
    if (!googleUser && accessToken) {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) googleUser = await r.json();
    }

    if (!googleUser) return res.status(401).json({ success: false, error: 'Token Google invalide' });

    const { email, given_name, family_name, sub } = googleUser;
    if (!email) return res.status(400).json({ success: false, error: 'Email non fourni par Google' });

    // Trouver ou créer l'utilisateur
    let user = await User.findOne({ $or: [{ googleId: sub }, { email: email.toLowerCase() }] });
    if (!user) {
      const rndPwd = require('crypto').randomBytes(24).toString('hex'); // mot de passe inutilisable = login Google uniquement
      user = await User.create({
        firstName: given_name || 'Joueur',
        lastName:  family_name || `G${sub.slice(0, 6)}`,
        email:     email.toLowerCase(),
        password:  rndPwd,
        googleId:  sub,
      });
    } else if (!user.googleId) {
      user.googleId = sub;
      await user.save();
    }

    user.lastLogin = new Date();
    await user.save();
    const token = signToken(user._id);
    res.json({ success: true, token, user: user.toPublic() });
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
