# 🔧 INSTRUCTIONS POUR NETTOYER LE CACHE

## Problème actuel
Les anciens tokens avec des IDs temporaires invalides sont encore dans le navigateur.

## Solution : Nettoyer le cache

### Étape 1 : Ouvre la console du navigateur
- **Chrome/Edge** : `F12` ou `Ctrl+Shift+I`
- **Firefox** : `F12`

### Étape 2 : Va dans l'onglet "Application" (Chrome) ou "Storage" (Firefox)

### Étape 3 : Supprime les données
1. **Local Storage** → `http://localhost:5173` → Clique droit → "Clear"
2. **Session Storage** → `http://localhost:5173` → Clique droit → "Clear"

### Étape 4 : Recharge la page
- `Ctrl+Shift+R` (rechargement forcé)

## OU : Utilise le mode navigation privée
- `Ctrl+Shift+N` (Chrome/Edge)
- `Ctrl+Shift+P` (Firefox)

## Vérification
Après nettoyage, tu devrais pouvoir :
1. Te connecter en tant qu'invité
2. Créer une table
3. Voir la table créée dans le salon
