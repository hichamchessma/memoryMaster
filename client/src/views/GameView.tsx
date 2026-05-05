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
  hands: Record<string, Card[]>; scores: Record<string, number>; winner: string; players: Player[]
}

const BOT_ID = 'BOT_PLAYER_001'

// ── Flying card system ─────────────────────────────────────────────────────
interface FlyCard { id: string; value: number | null; fromX: number; fromY: number; toX: number; toY: number }

function FlyingCardItem({ data, onDone }: { data: FlyCard; onDone: () => void }) {
  const [moved, setMoved] = useState(false)
  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setMoved(true))
      return () => cancelAnimationFrame(raf2)
    })
    const t = setTimeout(onDone, 700)
    return () => { cancelAnimationFrame(raf1); clearTimeout(t) }
  }, [onDone])

  return (
    <div style={{
      position: 'fixed',
      left: (moved ? data.toX : data.fromX) - 32,
      top:  (moved ? data.toY : data.fromY) - 48,
      width: 64, height: 96,
      transition: moved ? 'left 0.55s cubic-bezier(0.34,1.1,0.64,1), top 0.55s cubic-bezier(0.34,1.1,0.64,1)' : 'none',
      borderRadius: 12, overflow: 'hidden', pointerEvents: 'none',
      boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 0 20px rgba(124,58,237,0.4)',
      zIndex: 9999,
    }}>
      <img
        src={data.value !== null ? getCardImage(data.value) : getCardBack()}
        className="w-full h-full object-cover"
        alt=""
      />
    </div>
  )
}

// ── 3D flip card ────────────────────────────────────────────────────────────
function GameCard({ card, onClick, size = 'md', highlight = false, selected = false, glowing = false }: {
  card: Card; onClick?: () => void; size?: 'sm' | 'md' | 'lg'
  highlight?: boolean; selected?: boolean; glowing?: boolean
}) {
  const sizes = { sm: 'w-12 h-16', md: 'w-16 h-24', lg: 'w-24 h-36' }
  return (
    <div className={`card-3d-container ${sizes[size]} cursor-pointer`} onClick={onClick}>
      <div className={`card-3d-inner ${card.isFlipped ? 'flipped' : ''} ${
        highlight ? 'ring-2 ring-emerald-400 rounded-xl' : ''} ${
        selected ? 'ring-4 ring-yellow-400 rounded-xl scale-110 -translate-y-2' : ''} ${
        glowing ? 'shadow-[0_0_24px_rgba(251,191,36,0.8)]' : ''}`
      }>
        <div className="card-3d-back rounded-xl overflow-hidden">
          <img src={getCardBack()} alt="" className="w-full h-full object-cover"/>
        </div>
        <div className="card-3d-front rounded-xl overflow-hidden shadow-md">
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
  const [revealedCard, setRevealedCard] = useState<Card | null>(null)
  const [memoRevealed, setMemoRevealed] = useState<Set<number>>(new Set())
  const [flyingCards, setFlyingCards] = useState<FlyCard[]>([])
  const [newCardIdxs, setNewCardIdxs] = useState<Set<number>>(new Set())
  const [deckPulse, setDeckPulse] = useState(false)
  // Carte retournée face visible après une mauvaise défausse rapide
  const [penaltyReveal, setPenaltyReveal] = useState<{ userId: string; cardValue: number; cardIndex: number } | null>(null)

  // DOM refs for flying card positions
  const deckRef = useRef<HTMLButtonElement>(null)
  const discardRef = useRef<HTMLDivElement>(null)
  const drawnAreaRef = useRef<HTMLDivElement>(null)
  const myHandRef = useRef<HTMLDivElement>(null)
  const oppHandRef = useRef<HTMLDivElement>(null)

  const revealTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const penaltyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const myHandLenRef = useRef(0)
  myHandLenRef.current = myHand.length

  const myTurn = gs ? gs.turnOrder[gs.currentTurnIndex] === user._id : false
  const phase = gs?.phase ?? 'waiting'
  const topDiscard = gs?.discardPile?.[0] ?? null
  const myPowers = gs?.powers?.[user._id] ?? {}
  const opponents = players.filter(p => p.userId !== user._id)

  // ── Flying card helpers ───────────────────────────────────────────────────
  const getPos = (ref: React.RefObject<HTMLElement | null>) => {
    const r = ref.current?.getBoundingClientRect()
    if (r) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    return null
  }

  const addFlyCard = useCallback((value: number | null, from: { x: number; y: number }, to: { x: number; y: number }, delay = 0) => {
    const id = `${Date.now()}-${Math.random()}`
    setTimeout(() => {
      setFlyingCards(prev => [...prev, { id, value, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y }])
    }, delay)
  }, [])

  const removeFlyCard = useCallback((id: string) => {
    setFlyingCards(prev => prev.filter(c => c.id !== id))
  }, [])

  // Fallback positions (approx based on typical layout)
  const getDeckPos = useCallback(() => getPos(deckRef) ?? { x: window.innerWidth / 2 - 120, y: window.innerHeight * 0.52 }, [])
  const getDiscardPos = useCallback(() => getPos(discardRef) ?? { x: window.innerWidth / 2 + 120, y: window.innerHeight * 0.52 }, [])
  const getDrawnAreaPos = useCallback(() => getPos(drawnAreaRef) ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.45 }, [])
  const getOppHandPos = useCallback(() => getPos(oppHandRef) ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.22 }, [])
  const getMyHandCardPos = useCallback((idx: number) => {
    const r = myHandRef.current?.getBoundingClientRect()
    if (!r) return { x: window.innerWidth / 2, y: window.innerHeight * 0.82 }
    const count = myHandLenRef.current || 4
    const cardW = 68
    const totalW = count * cardW + (count - 1) * 8
    const startX = r.left + r.width / 2 - totalW / 2 + cardW / 2
    return { x: startX + idx * (cardW + 8), y: r.top + r.height / 2 }
  }, [])

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    socket.emit('table:join', { tableId })
    socket.emit('game:requestState', { tableId })

    socket.on('table:updated', (t: { players: Player[] }) => setPlayers(t.players))

    socket.on('game:started', ({ players: p }: { players: Player[] }) => {
      setPlayers(p); setGameStarted(true)
    })

    socket.on('game:dealt', ({ myHand: h, players: p }: { myHand: Card[]; players?: Player[] }) => {
      setMyHand(h.map(c => ({ ...c, isFlipped: false })))
      setMemoRevealed(new Set())
      if (p) setPlayers(p)
    })

    socket.on('game:state', (state: GameState) => {
      setGs(state)
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

    // Player draws: fly card from deck to center
    socket.on('game:drawn', ({ card }: { card: Card }) => {
      const from = getDeckPos()
      const to = getDrawnAreaPos()
      addFlyCard(card.value, from, to)
      setTimeout(() => setDrawnCard(card), 400)
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
        const idxs = new Set(Array.from({ length: added.length }, (_, i) => newLen + i))
        // Fly chaque carte de pénalité depuis le deck vers sa position dans la main (décalé)
        added.forEach((_, i) => {
          const from = getDeckPos()
          const to   = getMyHandCardPos(newLen + i)
          addFlyCard(null, from, to, i * 250)
        })
        // Marquer les nouvelles cartes après l'arrivée des animations
        setTimeout(() => {
          setNewCardIdxs(idxs)
          setTimeout(() => setNewCardIdxs(new Set()), 1200)
        }, 500 + added.length * 250)
        return [...prev, ...added]
      })
    })

    socket.on('game:penalty', ({ penaltyCards }: { penaltyCards: number }) => {
      if (penaltyTimeout.current) clearTimeout(penaltyTimeout.current)
      setPenalty(`⚠️ +${penaltyCards} cartes de pénalité !`)
      penaltyTimeout.current = setTimeout(() => setPenalty(null), 2500)
    })

    socket.on('game:quickDiscarded', ({ userId, card }: { userId: string; card: Card }) => {
      const name = userId === BOT_ID ? '🤖 Bot' : players.find(p => p.userId === userId)?.firstName || ''
      toast(`${name} défausse ${getRankLabel(card.value)} !`, { icon: '💨', duration: 1200 })
      if (userId === user._id) {
        // Animer la carte vers la défausse puis la retirer de la main
        // (la position vient de myHandRef — la carte a déjà disparu visuellement grâce au fly)
        setMyHand(prev => prev.filter(c => c.id !== card.id))
      } else {
        // Pour un adversaire : faire voler une carte cachée depuis sa main vers la défausse
        const from = getOppHandPos()
        const to   = getDiscardPos()
        addFlyCard(card.value, from, to)
      }
    })

    // Mauvaise défausse rapide : retourner la carte fautive pour que tout le monde la voie
    socket.on('game:penaltyReveal', ({ userId, cardValue, cardIndex }: { userId: string; cardValue: number; cardIndex: number }) => {
      setPenaltyReveal({ userId, cardValue, cardIndex })
      if (userId === user._id) {
        // Retourner la carte fautive dans ma main
        setMyHand(prev => prev.map((c, i) => i === cardIndex ? { ...c, isFlipped: true } : c))
        setTimeout(() => {
          setMyHand(prev => prev.map((c, i) => i === cardIndex ? { ...c, isFlipped: false } : c))
          setPenaltyReveal(null)
        }, 1500)
      } else {
        // Pour l'adversaire : afficher la carte fautive en overlay
        setRevealedCard({ id: 'penalty-reveal', value: cardValue, isFlipped: true })
        setTimeout(() => { setRevealedCard(null); setPenaltyReveal(null) }, 1500)
      }
    })

    socket.on('game:powerActivated', ({ userId, power }: { userId: string; power: string }) => {
      const name = userId === BOT_ID ? '🤖 Bot' : players.find(p => p.userId === userId)?.firstName || ''
      const labels: Record<string, string> = { jack: 'Valet 👁', queen: 'Dame 👁', king: 'Roi ↔' }
      toast(`${name} : ${labels[power] || power}`, { icon: '✨', duration: 2000 })
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
      setShowtimeData(data); setDrawnCard(null)
    })

    // ── BOT animations ──────────────────────────────────────────────────────
    socket.on('game:botAction', ({ action }: { action: string }) => {
      const deckPos    = getDeckPos()
      const discardPos = getDiscardPos()
      const drawnPos   = getDrawnAreaPos()
      const oppPos     = getOppHandPos()

      if (action === 'draw') {
        // Card flies from deck to center "hold" area (face down — we don't know the card)
        addFlyCard(null, deckPos, drawnPos)
      } else if (action === 'discard') {
        // Held card flies to discard (face down)
        addFlyCard(null, drawnPos, discardPos)
      } else if (action === 'replace') {
        // New card enters bot hand (deck → hand area)
        addFlyCard(null, drawnPos, oppPos, 0)
        // Old card exits bot hand → discard
        addFlyCard(null, oppPos, discardPos, 200)
      }
    })

    socket.on('error', ({ message }: { message: string }) => {
      toast.error(message); setPowerMode(null); setKingStep(null)
    })

    return () => {
      ['table:updated','game:started','game:dealt','game:state','game:timer','game:phaseChange',
       'game:drawn','game:revealCard','game:penaltyCards','game:penalty','game:penaltyReveal',
       'game:quickDiscarded','game:powerActivated','game:bombomDeclared','game:bombomPrompt',
       'game:showtime','game:botAction','error']
        .forEach(ev => socket.off(ev))
      if (revealTimeout.current) clearTimeout(revealTimeout.current)
      if (penaltyTimeout.current) clearTimeout(penaltyTimeout.current)
    }
  }, [socket, tableId, user._id, addFlyCard, getDeckPos, getDiscardPos, getDrawnAreaPos, getOppHandPos, getMyHandCardPos]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDeckPulse(myTurn && !!gs?.drawPhase && phase === 'playing')
  }, [myTurn, gs?.drawPhase, phase])

  // ── Actions ───────────────────────────────────────────────────────────────
  const toggleReady = () => socket?.emit('table:ready', { tableId })

  const drawCard = () => {
    if (!myTurn || !gs?.drawPhase || phase !== 'playing') return
    socket?.emit('game:draw', { tableId }); setDeckPulse(false)
  }

  const discardDrawn = () => {
    if (!drawnCard) return
    // Animate: drawn card → discard
    const from = getDrawnAreaPos()
    const to   = getDiscardPos()
    addFlyCard(null, from, to)
    setDrawnCard(null)
    setTimeout(() => socket?.emit('game:discard', { tableId }), 200)
    setPowerMode(null); setKingStep(null)
  }

  const activatePower = (type: 'jack' | 'queen' | 'king') => {
    setPowerMode(type); setKingStep(null)
  }

  const declareBombom = () => socket?.emit('game:bombom', { tableId })
  const confirmShowtime = () => { setBombomPrompt(false); socket?.emit('game:showtime', { tableId }) }
  const cancelBombom   = () => { setBombomPrompt(false); socket?.emit('game:cancelBombom', { tableId }) }

  const resetGame = () => {
    setShowtimeData(null); setGameStarted(false); setMyHand([]); setGs(null)
    setDrawnCard(null); setPowerMode(null); setKingStep(null); setBombomPrompt(false)
    setPenalty(null); setDeckPulse(false); setRevealedCard(null); setFlyingCards([])
    setMemoRevealed(new Set()); setTimer({ phase: null, remaining: 0, max: 10 })
  }

  const quitGame = async () => {
    socket?.emit('table:leave', { tableId })
    try { await api.delete(`/tables/${tableId}`) } catch {}
    resetGame(); onLeave()
  }

  const clickMyCard = useCallback((card: Card, idx: number) => {
    if (!socket) return

    // Mémorisation : révéler jusqu'à 2 cartes
    if (phase === 'memorization') {
      if (memoRevealed.has(idx)) {
        setMemoRevealed(prev => { const s = new Set(prev); s.delete(idx); return s })
        setMyHand(prev => prev.map((c, i) => i === idx ? { ...c, isFlipped: false } : c))
      } else if (memoRevealed.size < 2) {
        setMemoRevealed(prev => new Set([...prev, idx]))
        setMyHand(prev => prev.map((c, i) => i === idx ? { ...c, isFlipped: true } : c))
      } else {
        toast('Maximum 2 cartes visibles', { icon: '👀', duration: 1200 })
      }
      return
    }

    if (!gs) return

    if (powerMode === 'jack') {
      socket.emit('game:power:jack', { tableId, cardIndex: idx }); setPowerMode(null); return
    }
    if (powerMode === 'king') {
      if (!kingStep) { setKingStep({ userId: user._id, idx }); return }
      socket.emit('game:power:king', { tableId, userId1: kingStep.userId, idx1: kingStep.idx, userId2: user._id, idx2: idx })
      setPowerMode(null); setKingStep(null); return
    }

    // Remplacer avec la carte piochée → animate: drawn → my hand, my hand old → discard
    if (!gs.drawPhase && drawnCard && myTurn && !powerMode) {
      const drawnPos  = getDrawnAreaPos()
      const handPos   = getMyHandCardPos(idx)
      const discardPos = getDiscardPos()
      // New card flies to hand
      addFlyCard(drawnCard.value, drawnPos, handPos, 0)
      // Old card flies to discard
      addFlyCard(card.value, handPos, discardPos, 150)
      // Update state after animation
      setMyHand(prev => { const h = [...prev]; h[idx] = { ...drawnCard, isFlipped: false }; return h })
      setDrawnCard(null)
      socket.emit('game:replace', { tableId, cardIndex: idx })
      return
    }

    // Défausse rapide — animé côté client immédiatement, serveur valide ensuite
    if (gs.phase === 'playing') {
      const from = getMyHandCardPos(idx)
      const to   = getDiscardPos()
      // On anime optimistiquement (card vole vers défausse)
      // Si pénalité le serveur émet game:penaltyReveal qui stoppe l'effet
      addFlyCard(card.value, from, to)
      socket.emit('game:quickDiscard', { tableId, cardIndex: idx })
    }
  }, [socket, gs, phase, powerMode, kingStep, drawnCard, myTurn, tableId, user._id, memoRevealed, addFlyCard, getDrawnAreaPos, getMyHandCardPos, getDiscardPos])

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

  // ── Timer ─────────────────────────────────────────────────────────────────
  const timerPct = timer.max > 0 ? Math.max(0, (timer.remaining / timer.max) * 100) : 0
  const timerColor = timerPct > 50 ? '#22d3ee' : timerPct > 25 ? '#fbbf24' : '#ef4444'

  // ── ShowTime ──────────────────────────────────────────────────────────────
  if (showtimeData) {
    const { scores, winner, players: sPlayers } = showtimeData
    const isWinner = winner === user._id
    const sorted = [...sPlayers].sort((a, b) => (scores[a?.userId] ?? 99) - (scores[b?.userId] ?? 99))
    return (
      <div className="flex items-center justify-center h-full p-6 animate-fade-in">
        <div className="glass rounded-3xl p-10 max-w-lg w-full text-center space-y-6">
          <div className="text-7xl">{isWinner ? '🏆' : '😢'}</div>
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
    if (hasBot && allReady) return (
      <div className="flex items-center justify-center h-full">
        <div className="glass rounded-2xl p-10 text-center space-y-4">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto"/>
          <p className="text-white font-bold text-lg">Démarrage...</p>
        </div>
      </div>
    )
    return (
      <div className="flex items-center justify-center h-full p-6 animate-fade-in">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center space-y-6">
          <h2 className="text-2xl font-gaming font-black text-white">Salle d'attente</h2>
          <div className="space-y-3">
            {players.map(p => (
              <div key={p.userId} className="flex items-center gap-3 glass-2 px-4 py-3 rounded-xl">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>{p.firstName[0]}</div>
                <span className="flex-1 text-white text-left">{p.firstName} {p.isHost ? '👑' : ''}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${p.isReady ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'}`}>
                  {p.isReady ? 'Prêt ✓' : 'En attente...'}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={toggleReady} className={`flex-1 py-3 font-bold rounded-xl ${me?.isReady ? 'btn-danger' : 'btn-primary'}`}>
              {me?.isReady ? '✗ Annuler' : '✓ Je suis prêt !'}
            </button>
            <button onClick={quitGame} className="btn-outline px-4 py-3">←</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Game board ─────────────────────────────────────────────────────────────
  return (
    <div className="relative h-full flex flex-col overflow-hidden select-none">

      {/* ── Flying cards layer ── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
        {flyingCards.map(fc => (
          <FlyingCardItem key={fc.id} data={fc} onDone={() => removeFlyCard(fc.id)}/>
        ))}
      </div>

      {/* ── Overlays ── */}
      {bombomPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 animate-fade-in">
          <div className="glass rounded-2xl p-8 text-center max-w-sm space-y-4 border border-red-500/40">
            <div className="text-6xl animate-bounce">💣</div>
            <h3 className="text-xl font-gaming font-black text-white">ShowTime !</h3>
            <div className="flex gap-3">
              <button onClick={confirmShowtime} className="btn-gold flex-1 py-3">🚀 Lancer</button>
              <button onClick={cancelBombom} className="btn-outline flex-1 py-3">↩ Annuler (1×)</button>
            </div>
          </div>
        </div>
      )}

      {revealedCard && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 animate-fade-in">
          <div className="text-center space-y-3">
            <p className="text-slate-300 text-sm">Carte révélée 3s</p>
            <div className="w-32 h-48 mx-auto rounded-xl overflow-hidden shadow-2xl card-draw-anim" style={{ boxShadow: '0 0 40px rgba(251,191,36,0.5)' }}>
              <img src={getCardImage(revealedCard.value)} alt="" className="w-full h-full object-cover"/>
            </div>
            <p className="text-yellow-400 font-bold">{getRankLabel(revealedCard.value)} — {getCardScore(revealedCard.value)} pts</p>
          </div>
        </div>
      )}

      {/* Pénalité : carte fautive + message ⚠️ */}
      {penaltyReveal && penaltyReveal.userId !== user._id && (
        <div className="absolute inset-0 z-35 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <div className="text-3xl animate-bounce">🚨</div>
            <div className="w-24 h-32 rounded-xl overflow-hidden shadow-2xl border-4 border-red-500 card-draw-anim">
              <img src={getCardImage(penaltyReveal.cardValue)} alt="" className="w-full h-full object-cover"/>
            </div>
            <div className="px-4 py-2 rounded-xl bg-red-600/90 border border-red-400 text-white font-bold text-sm">
              Mauvaise défausse !
            </div>
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
          {powerMode === 'jack' ? '👁 Cliquez UNE de VOS cartes' : powerMode === 'queen' ? '👁 Cliquez UNE carte adverse' : kingStep ? '↔ Cliquez la 2e carte' : '↔ Cliquez la 1ère carte'}
          <button onClick={() => { setPowerMode(null); setKingStep(null) }} className="opacity-70 hover:opacity-100">✕</button>
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
            <span className="text-xs font-bold text-cyan-300">🧠 Cliquez jusqu'à 2 de vos cartes pour les mémoriser</span>
            <span className="text-xs text-cyan-400 font-bold">{memoRevealed.size}/2</span>
          </div>
        ) : phase === 'playing' ? (
          <div className={`text-center text-xs font-bold py-1.5 rounded-lg ${myTurn ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/50 text-slate-400'}`}>
            {myTurn
              ? gs?.drawPhase ? '⚡ Votre tour — Cliquez le deck pour piocher' : '⚡ Votre tour — Cliquez votre main pour remplacer, ou choisissez une action'
              : `⏳ Tour du ${players.find(p => p.userId === gs?.turnOrder[gs.currentTurnIndex])?.firstName ?? '🤖 Bot'}`}
          </div>
        ) : null}
      </div>

      {/* ── Opponents ── */}
      <div ref={oppHandRef} className="flex-shrink-0 px-4 py-2 flex justify-center gap-8">
        {opponents.map(opp => {
          const handSize = gs?.handSizes?.[opp.userId] ?? 4
          const isOppTurn = gs ? gs.turnOrder[gs.currentTurnIndex] === opp.userId : false
          const isPowerTarget = powerMode === 'queen' || powerMode === 'king'
          return (
            <div key={opp.userId} className="text-center">
              <div className={`text-xs mb-1.5 font-medium ${isOppTurn ? 'text-yellow-400 font-bold' : 'text-slate-400'}`}>
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

      {/* ── CENTER: Deck · Drawn · Discard ── */}
      <div className="flex-1 flex items-center justify-center gap-6 px-4 min-h-0">

        {/* Deck */}
        <div className="flex flex-col items-center gap-1">
          <button ref={deckRef} onClick={drawCard}
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

        {/* Drawn card zone (center) */}
        <div ref={drawnAreaRef} className="flex flex-col items-center gap-2" style={{ minWidth: 140 }}>
          {drawnCard && myTurn ? (
            <div className="flex flex-col items-center gap-2 card-draw-anim">
              <div className="w-28 h-40 rounded-xl overflow-hidden shadow-2xl" style={{ boxShadow: '0 0 32px rgba(251,191,36,0.5)', border: '2px solid rgba(251,191,36,0.4)' }}>
                <img src={getCardImage(drawnCard.value)} alt="" className="w-full h-full object-cover"/>
              </div>
              <p className="text-white font-bold text-xs">{getRankLabel(drawnCard.value)} · {getCardScore(drawnCard.value)} pts</p>
              <div className="flex gap-1.5 flex-wrap justify-center">
                <button onClick={discardDrawn} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 border border-slate-600 bg-slate-800/80 hover:bg-slate-700 transition-all hover:scale-105">
                  ↩ Défausser
                </button>
                {isJack(drawnCard.value) && !myPowers.j && (
                  <button onClick={() => activatePower('jack')} className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-300 border border-blue-600/60 bg-blue-900/40 hover:bg-blue-800/60 transition-all hover:scale-105">👁 J</button>
                )}
                {isQueen(drawnCard.value) && !myPowers.q && (
                  <button onClick={() => activatePower('queen')} className="px-3 py-1.5 rounded-lg text-xs font-bold text-purple-300 border border-purple-600/60 bg-purple-900/40 hover:bg-purple-800/60 transition-all hover:scale-105">👁 Q</button>
                )}
                {isKing(drawnCard.value) && !myPowers.k && (
                  <button onClick={() => activatePower('king')} className="px-3 py-1.5 rounded-lg text-xs font-bold text-yellow-300 border border-yellow-600/60 bg-yellow-900/40 hover:bg-yellow-800/60 transition-all hover:scale-105">↔ K</button>
                )}
              </div>
              <p className="text-xs text-slate-500">ou cliquez votre main pour remplacer</p>
            </div>
          ) : (
            /* BomBom or indicator */
            myTurn && gs?.drawPhase && !gs.bombomBy && phase === 'playing' ? (
              <button onClick={declareBombom} className="w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-orange-500 text-2xl flex items-center justify-center shadow-xl hover:scale-110 transition-all border-2 border-red-400/50">
                💣
              </button>
            ) : gs?.bombomBy && gs.bombomBy !== user._id ? (
              <div className="text-center">
                <div className="text-4xl animate-bounce">💣</div>
                <span className="text-xs text-red-400 font-bold">BomBom!</span>
              </div>
            ) : (
              <div className="w-14 h-20 rounded-xl border-2 border-dashed border-purple-800/30 opacity-40"/>
            )
          )}
        </div>

        {/* Discard */}
        <div className="flex flex-col items-center gap-1">
          <div ref={discardRef} className={`w-20 h-28 rounded-xl overflow-hidden transition-all duration-300 ${topDiscard ? 'shadow-lg' : 'border-2 border-dashed border-purple-800/40'} flex items-center justify-center`}>
            {topDiscard
              ? <img src={getCardImage(topDiscard.value)} alt="" className="w-full h-full object-cover"/>
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
          {phase === 'memorization' && <span className="text-xs text-cyan-400">· {memoRevealed.size}/2 vues</span>}
          {!gs?.drawPhase && drawnCard && myTurn && !powerMode && (
            <span className="text-xs text-emerald-400 font-bold animate-pulse">← Cliquez une carte pour remplacer</span>
          )}
        </div>
        <div ref={myHandRef} className="flex gap-2 justify-center">
          {myHand.map((card, idx) => {
            const isPowerClickable = powerMode === 'jack' || powerMode === 'king'
            const isReplaceMode = !gs?.drawPhase && drawnCard && myTurn && !powerMode
            const isHighlighted = (isPowerClickable || !!isReplaceMode) && phase === 'playing'
            const isKingSelected = powerMode === 'king' && kingStep?.userId === user._id && kingStep.idx === idx
            const isMemoClickable = phase === 'memorization'
            const isNew = newCardIdxs.has(idx)
            return (
              <div key={card.id || idx} className={`relative transition-transform duration-200 ${isNew ? 'card-pop-anim' : ''}`}>
                <GameCard
                  card={card}
                  size="md"
                  onClick={() => clickMyCard(card, idx)}
                  highlight={isHighlighted || isMemoClickable}
                  selected={isKingSelected}
                  glowing={isNew}
                />
                {isNew && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">+</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Quit ── */}
      <button onClick={quitGame}
        className="absolute top-2 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 border border-red-800/40 bg-red-900/20 hover:bg-red-900/50 transition-all">
        🚪 Quitter
      </button>
    </div>
  )
}
