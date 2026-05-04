import { useEffect, useState, useCallback, useRef } from 'react'
import { useSocket } from '../context/SocketContext'
import { getCardImage, getCardBack, getCardScore, getRankLabel, isJack, isQueen, isKing } from '../utils/cards'
import toast from 'react-hot-toast'

interface Card { id: string; value: number; isFlipped: boolean }
interface Player { userId: string; firstName: string; lastName: string; elo: number; isHost: boolean; isReady: boolean }

interface Props {
  tableId: string
  user: { _id: string; firstName: string; lastName: string; elo: number }
  onLeave: () => void
}

type Phase = 'waiting' | 'memorization' | 'playing' | 'showtime' | 'finished'
type TimerPhase = 'memorization' | 'draw' | 'choice' | null

interface GameState {
  phase: Phase
  drawPhase: boolean
  discardPile: Card[]
  deckCount: number
  turnOrder: string[]
  currentTurnIndex: number
  bombomBy: string | null
  bombomCancelUsed: Record<string, boolean>
  activePower: { type: string; userId: string } | null
  powers: Record<string, { j?: boolean; q?: boolean; k?: boolean }>
  scores: Record<string, number>
  winner: string | null
  handSizes: Record<string, number>
}

interface ShowtimeData {
  hands: Record<string, Card[]>
  scores: Record<string, number>
  winner: string
  players: Player[]
}

const BOT_ID = 'BOT_PLAYER_001'

export default function GameView({ tableId, user, onLeave }: Props) {
  const socket = useSocket()
  const [players, setPlayers] = useState<Player[]>([])
  const [myHand, setMyHand] = useState<Card[]>([])
  const [revealedCard, setRevealedCard] = useState<Card | null>(null)
  const [gs, setGs] = useState<GameState | null>(null)
  const [timer, setTimer] = useState<{ phase: TimerPhase; remaining: number; max: number }>({ phase: null, remaining: 0, max: 10 })
  const [drawnCard, setDrawnCard] = useState<Card | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [showtimeData, setShowtimeData] = useState<ShowtimeData | null>(null)
  const [powerMode, setPowerMode] = useState<'jack' | 'queen' | 'king' | null>(null)
  const [kingStep, setKingStep] = useState<{ userId: string; idx: number } | null>(null)
  const [bombomPrompt, setBombomPrompt] = useState(false)
  const [penalty, setPenalty] = useState<string | null>(null)
  const [botThinking, setBotThinking] = useState<string | null>(null)
  const [deckPulse, setDeckPulse] = useState(false)

  const revealTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const penaltyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const botThinkingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const myTurn = gs ? gs.turnOrder[gs.currentTurnIndex] === user._id : false
  const phase = gs?.phase ?? 'waiting'
  const topDiscard = gs?.discardPile?.[0] ?? null

  // ── Socket events ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    socket.emit('table:join', { tableId })
    socket.emit('game:requestState', { tableId })

    socket.on('table:updated', (table: { players: Player[] }) => setPlayers(table.players))

    socket.on('game:started', ({ players: p }: { players: Player[] }) => {
      setPlayers(p)
      setGameStarted(true)
    })

    socket.on('game:dealt', ({ myHand: h, players: p }: { myHand: Card[]; players?: Player[] }) => {
      setMyHand(h.map(c => ({ ...c, isFlipped: true })))
      if (p) setPlayers(p)
    })

    socket.on('game:state', (state: GameState) => {
      setGs(state)
      setBotThinking(null)
      if (state.phase === 'playing') {
        setMyHand(prev => prev.map(c => ({ ...c, isFlipped: false })))
      }
    })

    socket.on('game:timer', ({ phase: p, remaining }: { phase: string; remaining: number }) => {
      const maxMap: Record<string, number> = { memorization: 7, draw: 10, choice: 15 }
      setTimer({ phase: p as TimerPhase, remaining, max: maxMap[p] ?? 10 })
    })

    socket.on('game:phaseChange', ({ phase: p }: { phase: Phase }) => {
      setGs(prev => prev ? { ...prev, phase: p } : prev)
      if (p === 'playing') setMyHand(prev => prev.map(c => ({ ...c, isFlipped: false })))
    })

    socket.on('game:drawn', ({ card }: { card: Card }) => {
      setDrawnCard(card)
      toast(`Vous piochez : ${getRankLabel(card.value)}`, { icon: '🃏', duration: 2000 })
    })

    socket.on('game:revealCard', ({ card, duration }: { card: Card; duration: number }) => {
      setRevealedCard(card)
      if (revealTimeout.current) clearTimeout(revealTimeout.current)
      revealTimeout.current = setTimeout(() => setRevealedCard(null), duration)
    })

    socket.on('game:penalty', ({ penaltyCards }: { penaltyCards: number }) => {
      if (penaltyTimeout.current) clearTimeout(penaltyTimeout.current)
      setPenalty(`+${penaltyCards} cartes de pénalité !`)
      penaltyTimeout.current = setTimeout(() => setPenalty(null), 2500)
    })

    socket.on('game:quickDiscarded', ({ userId, card }: { userId: string; card: Card }) => {
      const name = userId === BOT_ID ? '🤖 Bot' : players.find(p => p.userId === userId)?.firstName || 'Joueur'
      toast(`${name} défausse ${getRankLabel(card.value)} !`, { icon: '💨', duration: 1500 })
      if (userId === user._id) setMyHand(prev => prev.filter(c => c.id !== card.id))
    })

    socket.on('game:powerActivated', ({ userId, power }: { userId: string; power: string }) => {
      const name = userId === BOT_ID ? '🤖 Bot' : players.find(p => p.userId === userId)?.firstName || 'Joueur'
      const labels: Record<string, string> = { jack: 'Valet 👁 (sa carte)', queen: 'Dame 👁 (adverse)', king: 'Roi ↔ (échange)' }
      toast(`${name} joue : ${labels[power] || power}`, { icon: '✨', duration: 2500 })
      if (userId === user._id) { setPowerMode(null); setKingStep(null) }
    })

    socket.on('game:bombomDeclared', ({ userId }: { userId: string }) => {
      const name = userId === BOT_ID ? '🤖 Bot' : players.find(p => p.userId === userId)?.firstName || 'Joueur'
      toast.error(`💣 ${name} déclare BomBom !`, { duration: 3000 })
    })

    socket.on('game:bombomPrompt', ({ canCancel }: { canCancel: boolean }) => {
      if (canCancel) setBombomPrompt(true)
      else socket.emit('game:showtime', { tableId })
    })

    socket.on('game:showtime', (data: ShowtimeData) => {
      setShowtimeData(data)
      setDrawnCard(null)
      setBotThinking(null)
    })

    socket.on('game:botAction', ({ action }: { action: string }) => {
      if (botThinkingTimeout.current) clearTimeout(botThinkingTimeout.current)
      const msgs: Record<string, string> = { draw: '🤖 Bot pioche...', replace: '🤖 Bot remplace une carte', discard: '🤖 Bot défausse' }
      setBotThinking(msgs[action] ?? null)
      if (action !== 'draw') {
        botThinkingTimeout.current = setTimeout(() => setBotThinking(null), 2000)
      }
    })

    socket.on('error', ({ message }: { message: string }) => {
      toast.error(message)
      setPowerMode(null)
      setKingStep(null)
    })

    return () => {
      ['table:updated','game:started','game:dealt','game:state','game:timer','game:phaseChange',
       'game:drawn','game:revealCard','game:penalty','game:quickDiscarded','game:powerActivated',
       'game:bombomDeclared','game:bombomPrompt','game:showtime','game:botAction','error']
        .forEach(ev => socket.off(ev))
      if (revealTimeout.current) clearTimeout(revealTimeout.current)
      if (penaltyTimeout.current) clearTimeout(penaltyTimeout.current)
      if (botThinkingTimeout.current) clearTimeout(botThinkingTimeout.current)
    }
  }, [socket, tableId, user._id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Deck pulse when my turn to draw ────────────────────────────────────────
  useEffect(() => {
    setDeckPulse(myTurn && !!gs?.drawPhase && phase === 'playing')
  }, [myTurn, gs?.drawPhase, phase])

  // ── Actions ────────────────────────────────────────────────────────────────
  const toggleReady = () => socket?.emit('table:ready', { tableId })

  const drawCard = () => {
    if (!myTurn || !gs?.drawPhase || phase !== 'playing') return
    socket?.emit('game:draw', { tableId })
    setDeckPulse(false)
  }

  const discardDrawn = () => {
    if (!drawnCard) return
    socket?.emit('game:discard', { tableId })
    setDrawnCard(null)
    setPowerMode(null)
    setKingStep(null)
  }

  const activatePower = (type: 'jack' | 'queen' | 'king') => {
    setPowerMode(type)
    setKingStep(null)
    const hints: Record<string, string> = {
      jack: 'Cliquez sur une de VOS cartes pour la voir',
      queen: 'Cliquez sur une carte ADVERSE pour la voir',
      king: 'Cliquez 2 cartes à échanger (les vôtres ou adverses)',
    }
    toast(hints[type], { icon: '✨', duration: 3000 })
  }

  const declareBombom = () => socket?.emit('game:bombom', { tableId })
  const confirmShowtime = () => { setBombomPrompt(false); socket?.emit('game:showtime', { tableId }) }
  const cancelBombom = () => { setBombomPrompt(false); socket?.emit('game:cancelBombom', { tableId }) }

  const playAgain = () => {
    setShowtimeData(null); setGameStarted(false); setMyHand([]); setGs(null)
    setDrawnCard(null); setPowerMode(null); setKingStep(null)
    setBombomPrompt(false); setPenalty(null); setBotThinking(null); setDeckPulse(false)
    setTimer({ phase: null, remaining: 0, max: 10 })
    setRevealedCard(null)
  }

  const clickMyCard = useCallback((card: Card, idx: number) => {
    if (!socket || !gs) return

    // Power: Jack — reveal own card
    if (powerMode === 'jack') {
      socket.emit('game:power:jack', { tableId, cardIndex: idx })
      setPowerMode(null); return
    }

    // Power: King — step 1 or 2 (own card)
    if (powerMode === 'king') {
      if (!kingStep) { setKingStep({ userId: user._id, idx }); return }
      socket.emit('game:power:king', { tableId, userId1: kingStep.userId, idx1: kingStep.idx, userId2: user._id, idx2: idx })
      setPowerMode(null); setKingStep(null); return
    }

    // Replace with drawn card (my turn, draw done)
    if (!gs.drawPhase && drawnCard && myTurn) {
      socket.emit('game:replace', { tableId, cardIndex: idx })
      setMyHand(prev => { const h = [...prev]; h[idx] = drawnCard; return h })
      setDrawnCard(null); return
    }

    // Quick discard (server validates the rank match)
    if (gs.phase === 'playing') {
      socket.emit('game:quickDiscard', { tableId, cardIndex: idx })
    }
  }, [socket, gs, powerMode, kingStep, drawnCard, myTurn, tableId, user._id])

  const clickOpponentCard = useCallback((targetUserId: string, idx: number) => {
    if (!socket || !gs) return
    if (powerMode === 'queen') {
      socket.emit('game:power:queen', { tableId, targetUserId, cardIndex: idx })
      setPowerMode(null); return
    }
    if (powerMode === 'king') {
      if (!kingStep) { setKingStep({ userId: targetUserId, idx }); return }
      socket.emit('game:power:king', { tableId, userId1: kingStep.userId, idx1: kingStep.idx, userId2: targetUserId, idx2: idx })
      setPowerMode(null); setKingStep(null); return
    }
    // Quick discard on opponent's card slot has no effect — only own cards
  }, [socket, gs, powerMode, kingStep, tableId])

  // ── Timer bar ──────────────────────────────────────────────────────────────
  const timerPct = timer.max > 0 ? Math.max(0, (timer.remaining / timer.max) * 100) : 0
  const timerColor = timerPct > 50 ? '#22d3ee' : timerPct > 25 ? '#fbbf24' : '#ef4444'

  const myPowers = gs?.powers?.[user._id] ?? {}
  const opponents = players.filter(p => p.userId !== user._id)

  // ── ShowTime ───────────────────────────────────────────────────────────────
  if (showtimeData) {
    const { scores, winner, players: sPlayers } = showtimeData
    const isWinner = winner === user._id
    const sorted = [...sPlayers].sort((a, b) => (scores[a.userId] ?? 99) - (scores[b.userId] ?? 99))
    return (
      <div className="flex items-center justify-center h-full p-6 animate-fade-in">
        <div className="glass rounded-3xl p-10 max-w-lg w-full text-center space-y-6">
          <div className="text-6xl">{isWinner ? '🏆' : '😢'}</div>
          <h2 className="text-3xl font-gaming font-black text-white">{isWinner ? 'Victoire !' : 'Défaite'}</h2>
          <div className="space-y-3">
            {sorted.map((p, i) => (
              <div key={p.userId} className={`flex items-center gap-4 px-5 py-3 rounded-xl ${p.userId === winner ? 'bg-yellow-500/20 border border-yellow-500/40' : 'glass-2'}`}>
                <span className="text-xl">{['🥇','🥈','🥉'][i] ?? `#${i+1}`}</span>
                <span className="flex-1 text-white font-semibold text-left">{p.firstName}</span>
                <div className="text-right">
                  <div className={`font-gaming font-black text-lg ${p.userId === winner ? 'text-yellow-400' : 'text-slate-300'}`}>{scores[p.userId] ?? '?'} pts</div>
                  <div className="text-xs text-slate-500">{(showtimeData.hands[p.userId] || []).map(c => `${getRankLabel(c.value)}(${getCardScore(c.value)})`).join(' ')}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={playAgain} className="btn-primary flex-1 py-3">🔄 Rejouer</button>
            <button onClick={onLeave} className="btn-outline flex-1 py-3">← Salon</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Waiting room ───────────────────────────────────────────────────────────
  if (!gameStarted) {
    const me = players.find(p => p.userId === user._id)
    const hasBot = players.some(p => p.userId === BOT_ID)
    const allReady = players.length >= 2 && players.every(p => p.isReady)

    if (hasBot && allReady) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="glass rounded-2xl p-10 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto"/>
            <p className="text-white font-bold text-lg">Démarrage de la partie...</p>
            <p className="text-slate-400 text-sm">Préparation des cartes</p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center justify-center h-full p-6 animate-fade-in">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center space-y-6">
          <h2 className="text-2xl font-gaming font-black text-white">Salle d'attente</h2>
          <div className="space-y-3">
            {players.map(p => (
              <div key={p.userId} className="flex items-center gap-3 glass-2 px-4 py-3 rounded-xl">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                  {p.firstName[0]}
                </div>
                <span className="flex-1 text-white text-left">{p.firstName} {p.isHost ? '👑' : ''}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${p.isReady ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'}`}>
                  {p.isReady ? 'Prêt ✓' : 'En attente...'}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={toggleReady} className={`flex-1 py-3 font-bold rounded-xl transition-all ${me?.isReady ? 'btn-danger' : 'btn-primary'}`}>
              {me?.isReady ? '✗ Annuler' : '✓ Je suis prêt !'}
            </button>
            <button onClick={onLeave} className="btn-outline px-4 py-3">←</button>
          </div>
          <p className="text-slate-500 text-xs">La partie démarre quand tous les joueurs sont prêts</p>
        </div>
      </div>
    )
  }

  // ── Game board ─────────────────────────────────────────────────────────────
  return (
    <div className="relative h-full flex flex-col overflow-hidden select-none">

      {/* ── BomBom Prompt ── */}
      {bombomPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
          <div className="glass rounded-2xl p-8 text-center max-w-sm space-y-4">
            <div className="text-5xl">💣</div>
            <h3 className="text-xl font-gaming font-black text-white">ShowTime !</h3>
            <p className="text-slate-400 text-sm">BomBom déclenché. Lancer le ShowTime ?</p>
            <div className="flex gap-3">
              <button onClick={confirmShowtime} className="btn-gold flex-1 py-3">🚀 ShowTime !</button>
              <button onClick={cancelBombom} className="btn-outline flex-1 py-3">↩ Annuler (1×)</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Power mode indicator ── */}
      {powerMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full text-sm font-bold text-white animate-fade-in"
          style={{ background: powerMode === 'jack' ? 'rgba(37,99,235,0.9)' : powerMode === 'queen' ? 'rgba(168,85,247,0.9)' : 'rgba(234,179,8,0.9)', color: powerMode === 'king' ? '#000' : '#fff' }}>
          {powerMode === 'jack' && '👁 Cliquez UNE de VOS cartes'}
          {powerMode === 'queen' && '👁 Cliquez UNE carte ADVERSE'}
          {powerMode === 'king' && (kingStep ? '↔ Cliquez la 2e carte à échanger' : '↔ Cliquez la 1ère carte')}
          <button onClick={() => { setPowerMode(null); setKingStep(null) }} className="ml-3 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── Revealed card overlay ── */}
      {revealedCard && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 animate-fade-in">
          <div className="text-center space-y-3">
            <p className="text-white font-bold text-lg">Carte révélée</p>
            <div className="w-28 h-40 mx-auto rounded-xl overflow-hidden shadow-2xl card-gold-glow">
              <img src={getCardImage(revealedCard.value)} alt="" className="w-full h-full object-cover"/>
            </div>
            <p className="text-yellow-400 font-bold">{getRankLabel(revealedCard.value)} — {getCardScore(revealedCard.value)} pts</p>
          </div>
        </div>
      )}

      {/* ── Penalty overlay ── */}
      {penalty && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-6 py-3 rounded-full font-bold text-white bg-red-600 animate-slide-up shadow-lg">
          ⚠️ {penalty}
        </div>
      )}

      {/* ── Timer bar ── */}
      {timer.phase && (
        <div className="flex-shrink-0 px-4 pt-2">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs text-slate-400 w-20 flex-shrink-0">
              {timer.phase === 'memorization' ? '🧠 Mémo' : timer.phase === 'draw' ? '🃏 Piocher' : '🎯 Décider'}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-white/10">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${timerPct}%`, background: `linear-gradient(90deg, ${timerColor}, ${timerColor}88)` }}/>
            </div>
            <span className="text-xs font-mono font-bold w-8 text-right" style={{ color: timerColor }}>{timer.remaining}s</span>
          </div>
        </div>
      )}

      {/* ── Turn / Phase indicator ── */}
      <div className="flex-shrink-0 px-4 py-1">
        {phase === 'memorization' ? (
          <div className="text-center text-xs font-bold py-1.5 rounded-lg bg-cyan-900/30 text-cyan-300 border border-cyan-500/30">
            🧠 Mémorisez vos cartes !
          </div>
        ) : phase === 'playing' ? (
          <div className={`text-center text-xs font-bold py-1.5 rounded-lg ${myTurn ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-purple-900/30 text-purple-300'}`}>
            {myTurn
              ? gs?.drawPhase ? '⚡ Votre tour — Cliquez le deck pour piocher' : '⚡ Votre tour — Remplacez une carte ou défaussez'
              : `⏳ Tour de ${players.find(p => p.userId === gs?.turnOrder[gs.currentTurnIndex])?.firstName ?? '🤖 Bot'}`}
          </div>
        ) : null}
      </div>

      {/* ── Bot thinking ── */}
      {botThinking && (
        <div className="flex-shrink-0 px-4">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl glass-2 border border-purple-500/30 w-fit mx-auto">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"/>
            <span className="text-xs text-purple-300 font-medium">{botThinking}</span>
          </div>
        </div>
      )}

      {/* ── Opponents ── */}
      <div className="flex-shrink-0 px-4 py-2">
        <div className="flex gap-6 justify-center">
          {opponents.map(opp => {
            const handSize = gs?.handSizes?.[opp.userId] ?? 4
            const isOppTurn = gs ? gs.turnOrder[gs.currentTurnIndex] === opp.userId : false
            return (
              <div key={opp.userId} className="text-center">
                <div className={`text-xs mb-1 flex items-center gap-1 justify-center ${isOppTurn ? 'text-yellow-400 font-bold' : 'text-slate-400'}`}>
                  {isOppTurn && '▶ '}{opp.firstName} ({handSize} cartes)
                </div>
                <div className="flex gap-1 justify-center">
                  {[...Array(handSize)].map((_, i) => (
                    <button key={i} onClick={() => clickOpponentCard(opp.userId, i)}
                      className={`w-12 h-16 rounded-lg overflow-hidden transition-all hover:scale-105 hover:-translate-y-1 ${
                        (powerMode === 'queen' || powerMode === 'king') ? 'ring-2 ring-yellow-400 cursor-crosshair' : 'cursor-default'
                      }`}>
                      <img src={getCardBack()} alt="?" className="w-full h-full object-cover"/>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Center: Deck + Discard ── */}
      <div className="flex-1 flex items-center justify-center gap-8 px-4">

        {/* Deck */}
        <div className="text-center">
          <button onClick={drawCard}
            className={`w-20 h-28 rounded-xl overflow-hidden transition-all duration-200 relative ${
              deckPulse
                ? 'cursor-pointer ring-4 ring-yellow-400 scale-110 -translate-y-2 shadow-[0_0_28px_rgba(251,191,36,0.8)]'
                : myTurn && gs?.drawPhase && phase === 'playing'
                  ? 'cursor-pointer ring-2 ring-purple-400 hover:scale-105 hover:-translate-y-1'
                  : 'opacity-50 cursor-default'
            }`}>
            <img src={getCardBack()} alt="Deck" className="w-full h-full object-cover"/>
            {deckPulse && <div className="absolute inset-0 rounded-xl animate-ping bg-yellow-400/25 pointer-events-none"/>}
          </button>
          <p className="text-xs text-slate-400 mt-1">{gs?.deckCount ?? 0} cartes</p>
          {deckPulse && <p className="text-xs text-yellow-400 font-bold mt-0.5 animate-pulse">Cliquez !</p>}
        </div>

        {/* BomBom button */}
        {myTurn && gs?.drawPhase && !gs.bombomBy && phase === 'playing' && (
          <button onClick={declareBombom}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-orange-500 text-2xl flex items-center justify-center shadow-lg hover:scale-110 transition-all"
            title="Déclarer BomBom">
            💣
          </button>
        )}

        {/* BomBom indicator */}
        {gs?.bombomBy && gs.bombomBy !== user._id && (
          <div className="text-center">
            <div className="text-3xl animate-pulse">💣</div>
            <div className="text-xs text-red-400 font-bold mt-0.5">BomBom!</div>
          </div>
        )}

        {/* Discard pile */}
        <div className="text-center">
          <div className="w-20 h-28 rounded-xl overflow-hidden border-2 border-dashed border-purple-700/50 flex items-center justify-center relative">
            {topDiscard ? (
              <img src={getCardImage(topDiscard.value)} alt="Défausse" className="w-full h-full object-cover"/>
            ) : (
              <span className="text-slate-600 text-xs">Défausse</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">Défausse</p>
        </div>
      </div>

      {/* ── Drawn card panel ── */}
      {drawnCard && myTurn && (
        <div className="flex-shrink-0 px-4 py-2 animate-slide-up">
          <div className="glass-2 rounded-xl p-3 flex items-center gap-4 border border-yellow-500/30">
            <div className="w-14 h-20 rounded-lg overflow-hidden flex-shrink-0 card-gold-glow">
              <img src={getCardImage(drawnCard.value)} alt="" className="w-full h-full object-cover"/>
            </div>
            <div className="flex-1">
              <p className="text-white font-bold">{getRankLabel(drawnCard.value)} — {getCardScore(drawnCard.value)} pts</p>
              <p className="text-slate-400 text-xs mb-2">Cliquez une carte de votre main pour remplacer, ou :</p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={discardDrawn} className="btn-outline text-xs py-1.5 px-3">↩ Défausser</button>
                {isJack(drawnCard.value) && !myPowers.j && (
                  <button onClick={() => activatePower('jack')} className="text-xs py-1.5 px-3 rounded-lg font-bold bg-blue-600/30 text-blue-300 border border-blue-600/50 hover:bg-blue-600/50 transition-all">
                    👁 Valet — voir ma carte
                  </button>
                )}
                {isQueen(drawnCard.value) && !myPowers.q && (
                  <button onClick={() => activatePower('queen')} className="text-xs py-1.5 px-3 rounded-lg font-bold bg-pink-600/30 text-pink-300 border border-pink-600/50 hover:bg-pink-600/50 transition-all">
                    👁 Dame — voir carte adverse
                  </button>
                )}
                {isKing(drawnCard.value) && !myPowers.k && (
                  <button onClick={() => activatePower('king')} className="text-xs py-1.5 px-3 rounded-lg font-bold bg-yellow-600/30 text-yellow-300 border border-yellow-600/60 hover:bg-yellow-600/50 transition-all">
                    ↔ Roi — échanger 2 cartes
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── My hand ── */}
      <div className="flex-shrink-0 px-4 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-slate-400">{user.firstName} (moi)</span>
          {powerMode && (
            <span className="text-xs font-bold text-yellow-400 ml-2">
              Mode pouvoir actif — cliquez la bonne carte
            </span>
          )}
          {!gs?.drawPhase && drawnCard && myTurn && !powerMode && (
            <span className="text-xs text-emerald-400 font-bold ml-2">
              ← Cliquez une carte pour la remplacer
            </span>
          )}
        </div>
        <div className="flex gap-2 justify-center">
          {myHand.map((card, idx) => {
            const isPowerClickable = powerMode === 'jack' || powerMode === 'king'
            const isReplaceMode = !gs?.drawPhase && drawnCard && myTurn && !powerMode
            const isHighlighted = isPowerClickable || isReplaceMode
            const isKingSelected = powerMode === 'king' && kingStep?.userId === user._id && kingStep.idx === idx

            return (
              <button key={card.id || idx} onClick={() => clickMyCard(card, idx)}
                className={`w-16 h-24 rounded-xl overflow-hidden transition-all flex-shrink-0 relative ${
                  isKingSelected
                    ? 'ring-4 ring-yellow-400 scale-105 -translate-y-2 cursor-crosshair'
                    : isHighlighted
                      ? 'ring-2 ring-emerald-400 hover:scale-110 hover:-translate-y-2 cursor-crosshair'
                      : gs?.phase === 'playing'
                        ? 'hover:scale-105 hover:-translate-y-1 cursor-pointer'
                        : 'cursor-default'
                }`}>
                <img
                  src={card.isFlipped ? getCardImage(card.value) : getCardBack()}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {isKingSelected && (
                  <div className="absolute inset-0 bg-yellow-400/20 flex items-center justify-center text-xl">⭐</div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Leave ── */}
      <button onClick={onLeave} className="absolute top-2 right-4 text-xs text-slate-500 hover:text-red-400 transition-colors z-10">
        Quitter
      </button>
    </div>
  )
}
