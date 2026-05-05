import { useEffect, useState, useCallback, useRef } from 'react'
import { useSocket } from '../context/SocketContext'
import { getCardImage, getCardBack, getCardScore, getRankLabel, isJack, isQueen, isKing } from '../utils/cards'
import toast from 'react-hot-toast'
import api from '../lib/api'

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
  phase: Phase; drawPhase: boolean; discardPile: Card[]; deckCount: number
  turnOrder: string[]; currentTurnIndex: number; bombomBy: string | null
  bombomCancelUsed: Record<string, boolean>; activePower: { type: string; userId: string } | null
  powers: Record<string, { j?: boolean; q?: boolean; k?: boolean }>
  scores: Record<string, number>; winner: string | null; handSizes: Record<string, number>
}

interface ShowtimeData {
  hands: Record<string, Card[]>; scores: Record<string, number>
  winner: string; players: Player[]
}

const BOT_ID = 'BOT_PLAYER_001'

// ── Card component with 3D flip ────────────────────────────────────────────
function GameCard({ card, onClick, size = 'md', highlight = false, selected = false, glowing = false, disabled = false }: {
  card: Card; onClick?: () => void; size?: 'sm' | 'md' | 'lg'; highlight?: boolean; selected?: boolean; glowing?: boolean; disabled?: boolean
}) {
  const sizes = { sm: 'w-14 h-20', md: 'w-16 h-24', lg: 'w-24 h-36' }
  return (
    <div
      className={`card-3d-container ${sizes[size]} flex-shrink-0 cursor-${disabled ? 'default' : 'pointer'}`}
      onClick={disabled ? undefined : onClick}
    >
      <div className={`card-3d-inner ${card.isFlipped ? 'flipped' : ''} ${highlight ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-transparent rounded-xl' : ''} ${selected ? 'ring-4 ring-yellow-400 ring-offset-1 ring-offset-transparent rounded-xl scale-110' : ''} ${glowing ? 'shadow-[0_0_20px_rgba(251,191,36,0.7)]' : ''}`}>
        <div className="card-3d-back rounded-xl overflow-hidden">
          <img src={getCardBack()} alt="" className="w-full h-full object-cover"/>
        </div>
        <div className="card-3d-front rounded-xl overflow-hidden shadow-lg">
          <img src={getCardImage(card.value)} alt={getRankLabel(card.value)} className="w-full h-full object-cover"/>
        </div>
      </div>
    </div>
  )
}

export default function GameView({ tableId, user, onLeave }: Props) {
  const socket = useSocket()
  const [players, setPlayers] = useState<Player[]>([])
  const [myHand, setMyHand] = useState<Card[]>([])
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
  const [revealedCard, setRevealedCard] = useState<Card | null>(null)
  // Mémorisation : le joueur peut révéler jusqu'à 2 cartes en cliquant
  const [memoRevealed, setMemoRevealed] = useState<Set<number>>(new Set())
  // Nouvelle carte apparue (pour animation)
  const [newCardIdxs, setNewCardIdxs] = useState<Set<number>>(new Set())

  const revealTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const penaltyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const botThinkingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const myTurn = gs ? gs.turnOrder[gs.currentTurnIndex] === user._id : false
  const phase = gs?.phase ?? 'waiting'
  const topDiscard = gs?.discardPile?.[0] ?? null
  const myPowers = gs?.powers?.[user._id] ?? {}

  // ── Socket events ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    socket.emit('table:join', { tableId })
    socket.emit('game:requestState', { tableId })

    socket.on('table:updated', (t: { players: Player[] }) => setPlayers(t.players))

    socket.on('game:started', ({ players: p }: { players: Player[] }) => {
      setPlayers(p); setGameStarted(true)
    })

    socket.on('game:dealt', ({ myHand: h, players: p }: { myHand: Card[]; players?: Player[] }) => {
      // Cartes face cachée au départ — joueur choisit lesquelles voir (max 2)
      setMyHand(h.map(c => ({ ...c, isFlipped: false })))
      setMemoRevealed(new Set())
      if (p) setPlayers(p)
    })

    socket.on('game:state', (state: GameState) => {
      setGs(state)
      setBotThinking(null)
      if (state.drawPhase) setDrawnCard(null)
      if (state.phase === 'playing') {
        setMyHand(prev => prev.map(c => ({ ...c, isFlipped: false })))
        setMemoRevealed(new Set())
      }
    })

    socket.on('game:timer', ({ phase: p, remaining }: { phase: string; remaining: number }) => {
      const maxMap: Record<string, number> = { memorization: 7, draw: 10, choice: 15 }
      setTimer({ phase: p as TimerPhase, remaining, max: maxMap[p] ?? 10 })
    })

    socket.on('game:phaseChange', ({ phase: p }: { phase: Phase }) => {
      setGs(prev => prev ? { ...prev, phase: p } : prev)
      if (p === 'playing') {
        setMyHand(prev => prev.map(c => ({ ...c, isFlipped: false })))
        setMemoRevealed(new Set())
      }
    })

    socket.on('game:drawn', ({ card }: { card: Card }) => {
      setDrawnCard(card)
    })

    socket.on('game:revealCard', ({ card, duration }: { card: Card; duration: number }) => {
      setRevealedCard(card)
      if (revealTimeout.current) clearTimeout(revealTimeout.current)
      revealTimeout.current = setTimeout(() => setRevealedCard(null), duration)
    })

    socket.on('game:penaltyCards', ({ cards }: { cards: Card[] }) => {
      setMyHand(prev => {
        const newLen = prev.length
        const added = cards.map(c => ({ ...c, isFlipped: false }))
        const next = [...prev, ...added]
        // Marquer les nouvelles cartes pour animation
        const idxs = new Set(Array.from({ length: added.length }, (_, i) => newLen + i))
        setNewCardIdxs(idxs)
        setTimeout(() => setNewCardIdxs(new Set()), 800)
        return next
      })
    })

    socket.on('game:penalty', ({ penaltyCards }: { penaltyCards: number }) => {
      if (penaltyTimeout.current) clearTimeout(penaltyTimeout.current)
      setPenalty(`⚠️ +${penaltyCards} cartes de pénalité !`)
      penaltyTimeout.current = setTimeout(() => setPenalty(null), 2500)
    })

    socket.on('game:quickDiscarded', ({ userId, card }: { userId: string; card: Card }) => {
      const name = userId === BOT_ID ? '🤖 Bot' : players.find(p => p.userId === userId)?.firstName || 'Joueur'
      toast(`${name} défausse ${getRankLabel(card.value)} !`, { icon: '💨', duration: 1500 })
      if (userId === user._id) setMyHand(prev => prev.filter(c => c.id !== card.id))
    })

    socket.on('game:powerActivated', ({ userId, power }: { userId: string; power: string }) => {
      const name = userId === BOT_ID ? '🤖 Bot' : players.find(p => p.userId === userId)?.firstName || ''
      const labels: Record<string, string> = { jack: 'Valet 👁', queen: 'Dame 👁', king: 'Roi ↔' }
      toast(`${name} joue : ${labels[power] || power}`, { icon: '✨', duration: 2000 })
      if (userId === user._id) { setPowerMode(null); setKingStep(null) }
    })

    socket.on('game:bombomDeclared', ({ userId }: { userId: string }) => {
      const name = userId === BOT_ID ? '🤖 Bot' : players.find(p => p.userId === userId)?.firstName || ''
      toast.error(`💣 ${name} déclare BomBom !`, { duration: 3000 })
    })

    socket.on('game:bombomPrompt', ({ canCancel }: { canCancel: boolean }) => {
      if (canCancel) setBombomPrompt(true)
      else socket.emit('game:showtime', { tableId })
    })

    socket.on('game:showtime', (data: ShowtimeData) => {
      setShowtimeData(data); setDrawnCard(null); setBotThinking(null)
    })

    socket.on('game:botAction', ({ action }: { action: string }) => {
      if (botThinkingTimeout.current) clearTimeout(botThinkingTimeout.current)
      const msgs: Record<string, string> = { draw: '🤖 Bot pioche...', replace: '🤖 Bot remplace', discard: '🤖 Bot défausse' }
      setBotThinking(msgs[action] ?? null)
      if (action !== 'draw') {
        botThinkingTimeout.current = setTimeout(() => setBotThinking(null), 1800)
      }
    })

    socket.on('error', ({ message }: { message: string }) => {
      toast.error(message); setPowerMode(null); setKingStep(null)
    })

    return () => {
      ['table:updated','game:started','game:dealt','game:state','game:timer','game:phaseChange',
       'game:drawn','game:revealCard','game:penaltyCards','game:penalty','game:quickDiscarded',
       'game:powerActivated','game:bombomDeclared','game:bombomPrompt','game:showtime','game:botAction','error']
        .forEach(ev => socket.off(ev))
      if (revealTimeout.current) clearTimeout(revealTimeout.current)
      if (penaltyTimeout.current) clearTimeout(penaltyTimeout.current)
      if (botThinkingTimeout.current) clearTimeout(botThinkingTimeout.current)
    }
  }, [socket, tableId, user._id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDeckPulse(myTurn && !!gs?.drawPhase && phase === 'playing')
  }, [myTurn, gs?.drawPhase, phase])

  // ── Actions ──────────────────────────────────────────────────────────────
  const toggleReady = () => socket?.emit('table:ready', { tableId })
  const drawCard = () => {
    if (!myTurn || !gs?.drawPhase || phase !== 'playing') return
    socket?.emit('game:draw', { tableId }); setDeckPulse(false)
  }
  const discardDrawn = () => {
    if (!drawnCard) return
    socket?.emit('game:discard', { tableId })
    setDrawnCard(null); setPowerMode(null); setKingStep(null)
  }
  const activatePower = (type: 'jack' | 'queen' | 'king') => {
    setPowerMode(type); setKingStep(null)
  }
  const declareBombom = () => socket?.emit('game:bombom', { tableId })
  const confirmShowtime = () => { setBombomPrompt(false); socket?.emit('game:showtime', { tableId }) }
  const cancelBombom = () => { setBombomPrompt(false); socket?.emit('game:cancelBombom', { tableId }) }

  const resetGame = () => {
    setShowtimeData(null); setGameStarted(false); setMyHand([]); setGs(null)
    setDrawnCard(null); setPowerMode(null); setKingStep(null); setBombomPrompt(false)
    setPenalty(null); setBotThinking(null); setDeckPulse(false); setRevealedCard(null)
    setMemoRevealed(new Set()); setTimer({ phase: null, remaining: 0, max: 10 })
  }

  const quitGame = async () => {
    socket?.emit('table:leave', { tableId })
    try { await api.delete(`/tables/${tableId}`) } catch {}
    resetGame(); onLeave()
  }

  // Clic sur une carte en main
  const clickMyCard = useCallback((card: Card, idx: number) => {
    if (!socket) return

    // ── Phase mémorisation : révéler jusqu'à 2 cartes ──
    if (phase === 'memorization') {
      if (memoRevealed.has(idx)) {
        // Re-cacher si déjà révélée
        setMemoRevealed(prev => { const s = new Set(prev); s.delete(idx); return s })
        setMyHand(prev => prev.map((c, i) => i === idx ? { ...c, isFlipped: false } : c))
      } else if (memoRevealed.size < 2) {
        setMemoRevealed(prev => new Set([...prev, idx]))
        setMyHand(prev => prev.map((c, i) => i === idx ? { ...c, isFlipped: true } : c))
      } else {
        toast('Vous pouvez regarder seulement 2 cartes', { icon: '👀', duration: 1500 })
      }
      return
    }

    if (!gs) return

    // Power: Jack
    if (powerMode === 'jack') {
      socket.emit('game:power:jack', { tableId, cardIndex: idx }); setPowerMode(null); return
    }
    // Power: King
    if (powerMode === 'king') {
      if (!kingStep) { setKingStep({ userId: user._id, idx }); return }
      socket.emit('game:power:king', { tableId, userId1: kingStep.userId, idx1: kingStep.idx, userId2: user._id, idx2: idx })
      setPowerMode(null); setKingStep(null); return
    }
    // Remplacer avec la carte piochée
    if (!gs.drawPhase && drawnCard && myTurn && !powerMode) {
      socket.emit('game:replace', { tableId, cardIndex: idx })
      setMyHand(prev => { const h = [...prev]; h[idx] = { ...drawnCard, isFlipped: false }; return h })
      setDrawnCard(null); return
    }
    // Défausse rapide
    if (gs.phase === 'playing') {
      socket.emit('game:quickDiscard', { tableId, cardIndex: idx })
    }
  }, [socket, gs, phase, powerMode, kingStep, drawnCard, myTurn, tableId, user._id, memoRevealed])

  const clickOpponentCard = useCallback((targetUserId: string, idx: number) => {
    if (!socket || !gs) return
    if (powerMode === 'queen') {
      socket.emit('game:power:queen', { tableId, targetUserId, cardIndex: idx }); setPowerMode(null); return
    }
    if (powerMode === 'king') {
      if (!kingStep) { setKingStep({ userId: targetUserId, idx }); return }
      socket.emit('game:power:king', { tableId, userId1: kingStep.userId, idx1: kingStep.idx, userId2: targetUserId, idx2: idx })
      setPowerMode(null); setKingStep(null); return
    }
  }, [socket, gs, powerMode, kingStep, tableId])

  // ── Timer bar ────────────────────────────────────────────────────────────
  const timerPct = timer.max > 0 ? Math.max(0, (timer.remaining / timer.max) * 100) : 0
  const timerColor = timerPct > 50 ? '#22d3ee' : timerPct > 25 ? '#fbbf24' : '#ef4444'
  const opponents = players.filter(p => p.userId !== user._id)

  // ── ShowTime ─────────────────────────────────────────────────────────────
  if (showtimeData) {
    const { scores, winner, players: sPlayers } = showtimeData
    const isWinner = winner === user._id
    const sorted = [...sPlayers].sort((a, b) => (scores[a?.userId] ?? 99) - (scores[b?.userId] ?? 99))
    return (
      <div className="flex items-center justify-center h-full p-6 animate-fade-in">
        <div className="glass rounded-3xl p-10 max-w-lg w-full text-center space-y-6">
          <div className="text-7xl mb-2">{isWinner ? '🏆' : '😢'}</div>
          <h2 className="text-3xl font-gaming font-black text-white">{isWinner ? 'Victoire !' : 'Défaite'}</h2>
          <div className="space-y-3">
            {sorted.map((p, i) => {
              const hand = showtimeData.hands[p.userId] || []
              return (
                <div key={p.userId} className={`rounded-xl p-4 ${p.userId === winner ? 'bg-yellow-500/20 border border-yellow-500/40' : 'glass-2'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{['🥇','🥈','🥉'][i] ?? `#${i+1}`}</span>
                    <span className="flex-1 text-white font-bold text-left">{p.firstName}</span>
                    <span className={`font-gaming font-black text-xl ${p.userId === winner ? 'text-yellow-400' : 'text-slate-300'}`}>{scores[p.userId] ?? '?'} pts</span>
                  </div>
                  <div className="flex gap-1.5 justify-center flex-wrap">
                    {hand.map((c, ci) => (
                      <div key={ci} className="w-12 h-16 rounded-lg overflow-hidden shadow-md">
                        <img src={getCardImage(c.value)} alt="" className="w-full h-full object-cover"/>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3">
            <button onClick={resetGame} className="btn-primary flex-1 py-3">🔄 Rejouer</button>
            <button onClick={() => { resetGame(); onLeave() }} className="btn-outline flex-1 py-3">← Salon</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Waiting room ──────────────────────────────────────────────────────────
  if (!gameStarted) {
    const me = players.find(p => p.userId === user._id)
    const hasBot = players.some(p => p.userId === BOT_ID)
    const allReady = players.length >= 2 && players.every(p => p.isReady)
    if (hasBot && allReady) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="glass rounded-2xl p-10 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto"/>
            <p className="text-white font-bold text-lg">Démarrage...</p>
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
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
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
            <button onClick={quitGame} className="btn-outline px-4 py-3">←</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Game board ────────────────────────────────────────────────────────────
  return (
    <div className="relative h-full flex flex-col overflow-hidden select-none bg-black/20">

      {/* ── Overlays ── */}
      {bombomPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 animate-fade-in">
          <div className="glass rounded-2xl p-8 text-center max-w-sm space-y-4 border border-red-500/40">
            <div className="text-6xl animate-bounce">💣</div>
            <h3 className="text-xl font-gaming font-black text-white">ShowTime déclenché !</h3>
            <div className="flex gap-3">
              <button onClick={confirmShowtime} className="btn-gold flex-1 py-3 font-bold">🚀 Lancer ShowTime</button>
              <button onClick={cancelBombom} className="btn-outline flex-1 py-3">↩ Annuler (1×)</button>
            </div>
          </div>
        </div>
      )}

      {revealedCard && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 animate-fade-in">
          <div className="text-center space-y-3">
            <p className="text-slate-300 text-sm font-medium">Carte révélée pendant 3s</p>
            <div className="w-32 h-48 mx-auto rounded-xl overflow-hidden shadow-2xl card-draw-anim" style={{ boxShadow: '0 0 40px rgba(251,191,36,0.5)' }}>
              <img src={getCardImage(revealedCard.value)} alt="" className="w-full h-full object-cover"/>
            </div>
            <p className="text-yellow-400 font-bold text-lg">{getRankLabel(revealedCard.value)} — {getCardScore(revealedCard.value)} pts</p>
          </div>
        </div>
      )}

      {penalty && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-30 px-6 py-3 rounded-2xl font-bold text-white text-lg bg-red-600/90 border border-red-400 shadow-2xl animate-slide-up">
          {penalty}
        </div>
      )}

      {powerMode && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-5 py-2.5 rounded-full font-bold text-sm animate-fade-in shadow-xl"
          style={{ background: powerMode === 'jack' ? '#1d4ed8ee' : powerMode === 'queen' ? '#7c3aedee' : '#d97706ee', color: '#fff' }}>
          <span>{powerMode === 'jack' ? '👁 Cliquez UNE de VOS cartes' : powerMode === 'queen' ? '👁 Cliquez UNE carte ADVERSE' : kingStep ? '↔ Cliquez la 2e carte' : '↔ Cliquez la 1ère carte'}</span>
          <button onClick={() => { setPowerMode(null); setKingStep(null) }} className="ml-1 opacity-70 hover:opacity-100 text-white font-bold">✕</button>
        </div>
      )}

      {/* ── Timer bar ── */}
      {timer.phase && (
        <div className="flex-shrink-0 px-4 pt-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-16 flex-shrink-0">
              {timer.phase === 'memorization' ? '🧠 Mémo' : timer.phase === 'draw' ? '🃏 Piocher' : '🎯 Décider'}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-white/10">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${timerPct}%`, background: `linear-gradient(90deg,${timerColor},${timerColor}99)` }}/>
            </div>
            <span className="text-xs font-mono font-bold w-8 text-right" style={{ color: timerColor }}>{timer.remaining}s</span>
          </div>
        </div>
      )}

      {/* ── Status bar ── */}
      <div className="flex-shrink-0 px-4 py-1">
        {phase === 'memorization' ? (
          <div className="flex items-center justify-between px-4 py-1.5 rounded-lg bg-cyan-900/30 border border-cyan-500/30">
            <span className="text-xs font-bold text-cyan-300">🧠 Mémorisez — cliquez jusqu'à 2 de vos cartes pour les voir</span>
            <span className="text-xs text-cyan-400 font-bold">{memoRevealed.size}/2</span>
          </div>
        ) : phase === 'playing' ? (
          <div className={`text-center text-xs font-bold py-1.5 rounded-lg ${myTurn ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/50 text-slate-400'}`}>
            {myTurn
              ? gs?.drawPhase ? '⚡ Votre tour — Cliquez le deck pour piocher' : '⚡ Votre tour — Cliquez une carte pour remplacer, ou utilisez les actions ci-dessous'
              : `⏳ Tour de ${players.find(p => p.userId === gs?.turnOrder[gs.currentTurnIndex])?.firstName ?? '🤖 Bot'}`}
          </div>
        ) : null}
      </div>

      {/* ── Bot thinking ── */}
      {botThinking && (
        <div className="flex-shrink-0 flex justify-center px-4">
          <div className="flex items-center gap-2 px-4 py-1 rounded-full glass-2 border border-purple-500/30">
            <div className="flex gap-0.5">
              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }}/>)}
            </div>
            <span className="text-xs text-purple-300 font-medium">{botThinking}</span>
          </div>
        </div>
      )}

      {/* ── Opponent(s) ── */}
      <div className="flex-shrink-0 px-4 py-2 flex justify-center gap-8">
        {opponents.map(opp => {
          const handSize = gs?.handSizes?.[opp.userId] ?? 4
          const isOppTurn = gs ? gs.turnOrder[gs.currentTurnIndex] === opp.userId : false
          const isPowerTarget = powerMode === 'queen' || powerMode === 'king'
          return (
            <div key={opp.userId} className="text-center">
              <div className={`text-xs mb-1.5 font-medium ${isOppTurn ? 'text-yellow-400' : 'text-slate-400'}`}>
                {isOppTurn && '▶ '}{opp.firstName} · {handSize} cartes
              </div>
              <div className="flex gap-1.5 justify-center">
                {[...Array(handSize)].map((_, i) => (
                  <button key={i} onClick={() => clickOpponentCard(opp.userId, i)}
                    className={`w-12 h-16 rounded-xl overflow-hidden transition-all duration-200 ${isPowerTarget ? 'ring-2 ring-yellow-400 hover:scale-110 hover:-translate-y-1 cursor-crosshair' : 'cursor-default opacity-80'}`}>
                    <img src={getCardBack()} alt="" className="w-full h-full object-cover"/>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── CENTER: Deck · DrawnCard · Discard ── */}
      <div className="flex-1 flex items-center justify-center gap-6 px-4 min-h-0">

        {/* Deck */}
        <div className="flex flex-col items-center gap-1">
          <button onClick={drawCard}
            className={`w-20 h-28 rounded-xl overflow-hidden relative transition-all duration-300 ${
              deckPulse
                ? 'scale-110 cursor-pointer shadow-[0_0_32px_rgba(251,191,36,0.8)] ring-4 ring-yellow-400'
                : myTurn && gs?.drawPhase && phase === 'playing'
                  ? 'cursor-pointer ring-2 ring-purple-400 hover:scale-105 hover:-translate-y-1 shadow-[0_0_16px_rgba(124,58,237,0.4)]'
                  : 'opacity-60 cursor-default'
            }`}>
            <img src={getCardBack()} alt="Deck" className="w-full h-full object-cover"/>
            {deckPulse && <div className="absolute inset-0 rounded-xl animate-ping bg-yellow-400/20 pointer-events-none"/>}
          </button>
          <span className="text-xs text-slate-400">{gs?.deckCount ?? 0}</span>
          {deckPulse && <span className="text-xs text-yellow-400 font-bold animate-pulse">Piocher !</span>}
        </div>

        {/* ── Drawn card (au centre quand piochée) ── */}
        {drawnCard && myTurn ? (
          <div className="flex flex-col items-center gap-3 card-draw-anim">
            <div className="w-28 h-40 rounded-xl overflow-hidden shadow-2xl" style={{ boxShadow: '0 0 32px rgba(251,191,36,0.5)', border: '2px solid rgba(251,191,36,0.5)' }}>
              <img src={getCardImage(drawnCard.value)} alt="" className="w-full h-full object-cover"/>
            </div>
            <p className="text-white font-bold text-sm">{getRankLabel(drawnCard.value)} · {getCardScore(drawnCard.value)} pts</p>
            {/* Actions compactes sous la carte */}
            <div className="flex gap-2 flex-wrap justify-center">
              <button onClick={discardDrawn} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 border border-slate-600 bg-slate-800/80 hover:bg-slate-700 transition-all hover:scale-105">
                ↩ Défausser
              </button>
              {isJack(drawnCard.value) && !myPowers.j && (
                <button onClick={() => activatePower('jack')} className="px-4 py-2 rounded-xl text-xs font-bold text-blue-300 border border-blue-600/60 bg-blue-900/40 hover:bg-blue-800/60 transition-all hover:scale-105">
                  👁 Valet
                </button>
              )}
              {isQueen(drawnCard.value) && !myPowers.q && (
                <button onClick={() => activatePower('queen')} className="px-4 py-2 rounded-xl text-xs font-bold text-purple-300 border border-purple-600/60 bg-purple-900/40 hover:bg-purple-800/60 transition-all hover:scale-105">
                  👁 Dame
                </button>
              )}
              {isKing(drawnCard.value) && !myPowers.k && (
                <button onClick={() => activatePower('king')} className="px-4 py-2 rounded-xl text-xs font-bold text-yellow-300 border border-yellow-600/60 bg-yellow-900/40 hover:bg-yellow-800/60 transition-all hover:scale-105">
                  ↔ Roi
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">ou cliquez une carte de votre main pour remplacer</p>
          </div>
        ) : (
          /* BomBom button when no drawn card */
          myTurn && gs?.drawPhase && !gs.bombomBy && phase === 'playing' && (
            <button onClick={declareBombom}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-orange-500 text-2xl flex items-center justify-center shadow-xl hover:scale-110 transition-all border-2 border-red-400/50"
              title="Déclarer BomBom">
              💣
            </button>
          )
        )}

        {/* BomBom indicator (opponent declared) */}
        {gs?.bombomBy && gs.bombomBy !== user._id && !drawnCard && (
          <div className="flex flex-col items-center gap-1">
            <div className="text-4xl animate-bounce">💣</div>
            <span className="text-xs text-red-400 font-bold">BomBom!</span>
          </div>
        )}

        {/* Discard pile */}
        <div className="flex flex-col items-center gap-1">
          <div className={`w-20 h-28 rounded-xl overflow-hidden transition-all duration-300 ${topDiscard ? 'shadow-lg' : 'border-2 border-dashed border-purple-800/40'} flex items-center justify-center`}>
            {topDiscard
              ? <img src={getCardImage(topDiscard.value)} alt="Défausse" className="w-full h-full object-cover"/>
              : <span className="text-slate-600 text-xs text-center px-2">Défausse</span>
            }
          </div>
          <span className="text-xs text-slate-400">Défausse</span>
        </div>
      </div>

      {/* ── My hand ── */}
      <div className="flex-shrink-0 px-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-slate-400 font-medium">{user.firstName} (moi)</span>
          {phase === 'memorization' && memoRevealed.size > 0 && (
            <span className="text-xs text-cyan-400">· {memoRevealed.size} carte(s) visible(s)</span>
          )}
          {powerMode && <span className="text-xs text-yellow-400 font-bold">· Pouvoir actif</span>}
          {!gs?.drawPhase && drawnCard && myTurn && !powerMode && (
            <span className="text-xs text-emerald-400 font-bold">← Cliquez pour remplacer</span>
          )}
        </div>
        <div className="flex gap-2 justify-center">
          {myHand.map((card, idx) => {
            const isPowerClickable = powerMode === 'jack' || powerMode === 'king'
            const isReplaceMode = !gs?.drawPhase && drawnCard && myTurn && !powerMode
            const isHighlighted = (isPowerClickable || isReplaceMode) && phase === 'playing'
            const isKingSelected = powerMode === 'king' && kingStep?.userId === user._id && kingStep.idx === idx
            const isMemoClickable = phase === 'memorization'
            const isNew = newCardIdxs.has(idx)

            return (
              <div key={card.id || idx} className={`relative ${isNew ? 'card-pop-anim' : ''}`}>
                <GameCard
                  card={card}
                  size="md"
                  onClick={() => clickMyCard(card, idx)}
                  highlight={isHighlighted || isMemoClickable}
                  selected={isKingSelected}
                  glowing={isNew}
                  disabled={false}
                />
                {isNew && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">+</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Quit button ── */}
      <button onClick={quitGame}
        className="absolute top-2 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 border border-red-800/40 bg-red-900/20 hover:bg-red-900/50 hover:text-red-300 transition-all">
        🚪 Quitter
      </button>
    </div>
  )
}
