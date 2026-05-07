/**
 * test-player.js — Simule un 2ème joueur pour les tests 2 joueurs
 *
 * Usage :
 *   node test-player.js <tableId>
 *
 * Ce script :
 *  1. Se connecte/inscrit automatiquement avec un compte test
 *  2. Rejoint la table indiquée
 *  3. Se met ready → la partie démarre
 *  4. Joue automatiquement (pioche → remplace si la carte est meilleure, sinon défausse)
 *  5. Répond aux prompts BomBom automatiquement
 */

const { io } = require('./client/node_modules/socket.io-client');

const BASE = 'http://localhost:5001';
const TABLE_ID = process.argv[2];

if (!TABLE_ID) {
  console.error('\nUsage: node test-player.js <tableId>\n');
  process.exit(1);
}

const TEST_EMAIL    = 'testplayer2@mm.test';
const TEST_PASSWORD = 'TestPass123!';
const TEST_FNAME    = 'TestBot';
const TEST_LNAME    = 'Player2';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || JSON.stringify(json));
  return json;
}

function cardScore(value) {
  if (value >= 104 && value <= 109) return -1;
  if (value >= 110 && value <= 115) return -2;
  const rank = value % 13;
  if (rank === 0) return 1;
  if (rank === 9) return 0;
  if (rank >= 10) return 10;
  return rank + 1;
}

function worstIndex(hand) {
  let worst = 0, worstScore = -Infinity;
  for (let i = 0; i < hand.length; i++) {
    const s = cardScore(hand[i].value);
    if (s > worstScore) { worstScore = s; worst = i; }
  }
  return { idx: worst, score: worstScore };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getToken() {
  try {
    const data = await fetchJSON('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    console.log(`[auth] Connecté comme ${TEST_FNAME}`);
    return data.token;
  } catch {
    console.log('[auth] Compte inexistant, création…');
    const data = await fetchJSON('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_EMAIL, password: TEST_PASSWORD,
        firstName: TEST_FNAME, lastName: TEST_LNAME,
      }),
    });
    console.log(`[auth] Compte créé — token obtenu`);
    return data.token;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const token = await getToken();

  const socket = io(BASE, { auth: { token } });

  let myHand  = [];
  let gs      = null;
  let myUserId = null;

  // Récupérer l'userId depuis le token (payload base64)
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    myUserId = payload.id;
    console.log(`[auth] userId = ${myUserId}`);
  } catch { console.error('[auth] Impossible de décoder le token'); }

  socket.on('connect', () => {
    console.log(`[socket] Connecté (${socket.id})`);
    socket.emit('table:join', { tableId: TABLE_ID });
  });

  socket.on('connect_error', (err) => {
    console.error('[socket] Erreur connexion:', err.message);
    process.exit(1);
  });

  socket.on('error', ({ message }) => {
    console.error('[error]', message);
  });

  socket.on('table:updated', (table) => {
    const me = table.players.find(p => p.userId === myUserId);
    if (!me) return;

    if (!me.isReady && table.status === 'waiting') {
      console.log('[lobby] Je me mets ready…');
      setTimeout(() => socket.emit('table:ready', { tableId: TABLE_ID }), 600);
    }
  });

  socket.on('game:dealt', ({ myHand: hand }) => {
    myHand = hand;
    const score = myHand.reduce((s, c) => s + cardScore(c.value), 0);
    console.log(`[jeu] Main reçue — ${myHand.length} cartes, score initial = ${score}`);
  });

  socket.on('game:state', (state) => {
    gs = state;
  });

  socket.on('game:drawn', ({ card }) => {
    if (!gs) return;
    const drawnScore = cardScore(card.value);
    const { idx, score: worstScore } = worstIndex(myHand);

    if (drawnScore < worstScore) {
      console.log(`[jeu] Piochée ${card.value}(${drawnScore}pts) → remplace carte[${idx}](${worstScore}pts)`);
      const old = myHand[idx];
      myHand[idx] = card;
      // Mettre à jour le score local
      socket.emit('game:replace', { tableId: TABLE_ID, cardIndex: idx });
      console.log(`     Score estimé : ${myHand.reduce((s, c) => s + cardScore(c.value), 0)}pts`);
      void old;
    } else {
      console.log(`[jeu] Piochée ${card.value}(${drawnScore}pts) — pas intéressant, défausse`);
      socket.emit('game:discard', { tableId: TABLE_ID });
    }
  });

  socket.on('game:timer', ({ phase, remaining, currentTurn }) => {
    if (phase !== 'draw' || currentTurn !== myUserId) return;
    if (remaining === 9) {
      // Piocher dès le début de notre tour
      console.log('[jeu] Mon tour — je pioche');
      socket.emit('game:draw', { tableId: TABLE_ID });
    }
  });

  socket.on('game:penaltyCards', ({ cards }) => {
    myHand.push(...cards);
    console.log(`[jeu] +${cards.length} cartes pénalité — main : ${myHand.length} cartes`);
  });

  socket.on('game:bombomPrompt', ({ canCancel }) => {
    if (canCancel) {
      console.log('[jeu] BomBom prompt → annulation (une fois)');
      socket.emit('game:cancelBombom', { tableId: TABLE_ID });
    } else {
      socket.emit('game:showtime', { tableId: TABLE_ID });
    }
  });

  socket.on('game:showtime', ({ scores, winner, players }) => {
    console.log('\n══ SHOWTIME ══════════════════════════');
    players.forEach(p => {
      const s = scores[p.userId] ?? '?';
      const flag = p.userId === winner ? ' 🏆 GAGNANT' : '';
      console.log(`  ${p.firstName} ${p.lastName} → ${s} pts${flag}`);
    });
    console.log('══════════════════════════════════════\n');
    console.log('[done] Partie terminée. Ctrl+C pour quitter.');
  });

  socket.on('game:playerLeft', ({ userId }) => {
    if (userId !== myUserId) {
      console.log('[jeu] L\'autre joueur a quitté. Fin.');
      process.exit(0);
    }
  });

  console.log(`\n[test-player] Table cible : ${TABLE_ID}`);
  console.log('[test-player] En attente de la connexion…\n');
})();
