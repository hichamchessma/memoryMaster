# Memory Master - Jeu de cartes multijoueur

Memory Master est un jeu de cartes multijoueur en temps réel où l'objectif est de minimiser son score de cartes. Le jeu mêle mémoire, stratégie et bluff.

## Fonctionnalités

- **Inscription et authentification des joueurs**
- **Création et gestion de parties** (2 à 6 joueurs)
- **Système de tour par tour** avec gestion des délais
- **Pouvoirs spéciaux** (J, Q, K, Joker)
- **Mode Bombom** pour tenter de terminer la partie
- **Classement et statistiques des joueurs**
- **Interface utilisateur réactive** avec animations

## Technologies utilisées

### Backend
- **Node.js** avec **Express**
- **MongoDB** avec **Mongoose**
- **Socket.IO** pour la communication en temps réel
- **JWT** pour l'authentification

### Frontend (à venir)
- **React** avec **Hooks**
- **Tailwind CSS** pour le style
- **React Router** pour la navigation
- **Socket.IO Client** pour la communication en temps réel

## Installation

1. **Cloner le dépôt**
   ```bash
   git clone https://github.com/votre-utilisateur/memory-master.git
   cd memory-master
   ```

2. **Installer les dépendances**
   ```bash
   # Installer les dépendances du serveur
   cd server
   npm install
   
   # Installer les dépendances du client (à venir)
   cd ../client
   npm install
   ```

3. **Configurer les variables d'environnement**
   Créer un fichier `.env` à la racine du projet avec les variables suivantes :
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/memoryMaster
   JWT_SECRET=votre_secret_jwt_tres_securise
   NODE_ENV=development
   CLIENT_URL=http://localhost:3000
   ```

4. **Démarrer les serveurs**
   ```bash
   # Démarrer le serveur backend
   cd server
   npm run dev
   
   # Dans un autre terminal, démarrer le client (à venir)
   cd client
   npm start
   ```

## Structure du projet

```
memory-master/
├── client/                # Frontend React (à venir)
│   ├── public/
│   └── src/
│       ├── components/    # Composants React
│       ├── context/       # Contextes React
│       ├── pages/         # Pages de l'application
│       ├── utils/         # Utilitaires
│       ├── hooks/         # Hooks personnalisés
│       └── assets/        # Images, polices, etc.
├── server/                # Backend Node.js
│   ├── src/
│   │   ├── config/       # Configuration
│   │   ├── controllers/   # Contrôleurs
│   │   ├── middleware/    # Middleware
│   │   ├── models/        # Modèles Mongoose
│   │   ├── routes/        # Routes API
│   │   ├── services/      # Logique métier
│   │   ├── utils/         # Utilitaires
│   │   └── index.js       # Point d'entrée du serveur
│   └── package.json
└── README.md
```

## API Endpoints

### Authentification
- `POST /api/auth/register` - S'inscrire
- `POST /api/auth/login` - Se connecter
- `GET /api/auth/profile` - Obtenir le profil utilisateur
- `PUT /api/auth/profile` - Mettre à jour le profil utilisateur

### Jeu
- `POST /api/games` - Créer une nouvelle partie
- `POST /api/games/:code/join` - Rejoindre une partie existante
- `POST /api/games/:code/start` - Démarrer une partie
- `GET /api/games/:code` - Obtenir les informations d'une partie
- `POST /api/games/:code/play` - Jouer un tour

## Événements Socket.IO

### Écouter
- `game_updated` - Mise à jour de l'état du jeu
- `player_joined` - Un joueur a rejoint la partie
- `player_left` - Un joueur a quitté la partie
- `game_started` - La partie a commencé
- `turn_changed` - Le tour a changé
- `game_ended` - La partie est terminée

### Émettre
- `join_game` - Rejoindre une partie
- `leave_game` - Quitter une partie
- `play_card` - Jouer une carte
- `use_power` - Utiliser un pouvoir
- `throw_now` - Déclencher Throw Now
- `bombom` - Déclencher Bombom

## Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus d'informations.
