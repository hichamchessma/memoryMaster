const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Fonction pour injecter des utilisateurs de test
exports.seedUsers = async (req, res) => {
  try {
    // 1. Définir les utilisateurs par défaut
    const usersToSeed = [
      { firstName: 'Hicham', lastName: 'Test', email: 'hicham@test.com', password: 'password123' },
      { firstName: 'Haitham', lastName: 'Test', email: 'haitham@test.com', password: 'password123' },
      { firstName: 'Simo', lastName: 'Test', email: 'simo@test.com', password: 'password123' },
      { firstName: 'Mehdi', lastName: 'Test', email: 'mehdi@test.com', password: 'password123' },
      { firstName: 'Hamza', lastName: 'Test', email: 'hamza@test.com', password: 'password123' },
      { firstName: 'Sanae', lastName: 'Test', email: 'sanae@test.com', password: 'password123' },
    ];

    // 2. Supprimer les anciens utilisateurs de test pour éviter les doublons
    const emailsToClear = usersToSeed.map(u => u.email);
    await User.deleteMany({ email: { $in: emailsToClear } });

    // 3. Hacher les mots de passe avant l'insertion
    const salt = await bcrypt.genSalt(10);
    const usersWithHashedPasswords = await Promise.all(usersToSeed.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, salt);
      return { ...user, password: hashedPassword };
    }));

    // 4. Insérer les nouveaux utilisateurs avec les mots de passe hachés
    const createdUsers = await User.insertMany(usersWithHashedPasswords);

    res.status(201).json({ 
      message: '6 utilisateurs de test ont été créés avec succès.',
      users: createdUsers.map(u => ({ id: u._id, firstName: u.firstName, email: u.email }))
    });

  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création des utilisateurs de test.', error: error.message });
  }
};

// Fonction pour lister tous les utilisateurs
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, 'firstName lastName email createdAt');
    res.status(200).json({
      message: `${users.length} utilisateurs trouvés.`,
      users,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
  }
};
