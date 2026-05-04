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
  discardPile: Card[]
  deckCount: number
  turnOrder: string[]
  currentTurnIndex: number
  bombomBy: string | null
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

export default function GameView({ tableId, user, onLeave }: Props) {
  const socket = useSocket()
  const [players, setPlayers] = useState<Player[]>([])
  const [myHand, setMyHand] = useState<Card[]>([])
  const [revealedCard, setRevealedCard] = useState<Card | null>(null)
  const [gs, setGs] = useState<GameState | null>(null)
  const [timer, setTimer] = useState<{ phase: TimerPhase; remaining: number; max: number }>({ phase: null, remaining: 0, max: 30 })
  const [drawnCard, setDrawnCard] = useState<Card | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [showtimeData, setShowtimeData] = useState<ShowtimeData | null>(null)
  const [powerMode, setPowerMode] = useState<'jack'|'queen'|'king'|null>(null)
  const [kingStep, setKingStep] = useState<{userId: string; idx: number}|null>(null)
  const [bombomPrompt, setBombomPrompt] = useState(false)
  const [penalty, setPenalty] = useState<string|null>(null)
  const revealTimeout = useRef<ReturnType<typeof setTimeout>|null>(null)

  const myTurn = gs ? gs.turnOrder[gs.currentTurnIndex] === user._id : false
  const phase = gs?.phase ?? 'waiting'
  const topDiscard = gs?.discardPile?.[0] ?? null

  // ── Socket events ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    socket.emit('table:join', { tableId })

    socket.on('table:updated', (table: { players: Player[] }) => setPlayers(table.players))

    socket.on('game:started', ({ players: p }: { players: Player[] }) => {
      setPlayers(p); setGameStarted(true)
    })

    socket.on('game:dealt', ({ myHand: h }: { myHand: Card[] }) => {
      setMyHand(h.map(c => ({ ...c, isFlipped: false })))
    })

    socket.on('game:state', (state: GameState) => setGs(state))

    socket.on('game:timer', ({ phase: p, remaining, currentTurn }: any) => {
      const max = p === 'memorization' ? 7 : p === 'draw' ? 10 : 15
      setTimer({ phase: p as TimerPhase, remaining, max })
      void currentTurn
    })

    socket.on('game:phaseChange', ({ phase: p }: { phase: Phase }) => {
      setGs(prev => prev ? { ...prev, phase: p } : prev)
    })

    socket.on('game:drawn', ({ card }: { card: Card }) => {
      setDrawnCard(card)
      toast(`Vous avez pioché: ${getRankLabel(card.value)}`, { icon: '🃏', duration: 2000 })
    })

    socket.on('game:revealCard', ({ card, duration }: { card: Card; duration: number }) => {
      setRevealedCard(card)
      if (revealTimeout.current) clearTimeout(revealTimeout.current)
      revealTimeout.current = setTimeout(() => setRevealedCard(null), duration)
    })

    socket.on('game:penalty', ({ penaltyCards }: { userId: string; penaltyCards: number }) => {
      setPenalty(`+${penaltyCards} cartes de pénalité !`)
      setTimeout(() => setPenalty(null), 2500)
    })

    socket.on('game:quickDiscarded', ({ userId, card }: { userId: string; card: Card }) => {
      const who = players.find(p => p.userId === userId)?.firstName || 'Joueur'
      toast(`${who} défausse ${getRankLabel(card.value)} !`, { icon: '💨', duration: 1500 })
      if (userId === user._id) {
        setMyHand(prev => prev.filter(c => c.id !== card.id))
      }
    })

    socket.on('game:powerActivated', ({ userId, power }: { userId: string; power: string }) => {
      const who = players.find(p => p.userId === userId)?.firstName || 'Joueur'
      const labels = { jack: 'Valet 👁 (sa carte)', queen: 'Dame 👁 (carte adverse)', king: 'Roi ↔ (échange)' }
      toast(`${who} joue: ${labels[power as keyof typeof labels] || power}`, { icon: '✨', duration: 2500 })
      setPowerMode(null)
    })

    socket.on('game:bombomDeclared', ({ userId }: { userId: string }) => {
      const who = players.find(p => p.userId === userId)?.firstName || 'Joueur'
      toast.error(`💣 ${who} a déclaré BomBom !`, { duration: 3000 })
    })

    socket.on('game:bombomPrompt', ({ canCancel }: { canCancel: boolean }) => {
      setBombomPrompt(canCancel)
      if (!canCancel) socket.emit('game:showtime', { tableId })
    })

    socket.on('game:showtime', (data: ShowtimeData) => {
      setShowtimeData(data)
      setDrawnCard(null)
    })

    socket.on('error', ({ message }: { message: string }) => toast.error(message))

    return () => {
      socket.off('table:updated'); socket.off('game:started'); socket.off('game:dealt')
      socket.off('game:state'); socket.off('game:timer'); socket.off('game:phaseChange')
      socket.off('game:drawn'); socket.off('game:revealCard'); socket.off('game:penalty')
      socket.off('game:quickDiscarded'); socket.off('game:powerActivated')
      socket.off('game:bombomDeclared'); socket.off('game:bombomPrompt')
      socket.off('game:showtime'); socket.off('error')
    }
  }, [socket, tableId, user._id, players])

  // ── Actions ────────────────────────────────────────────────────────────────
  const toggleReady = () => socket?.emit('table:ready', { tableId })
  const drawCard = () => { if (myTurn && gs?.drawPhase) socket?.emit('game:draw', { tableId }) }

  const clickMyCard = useCallback((card: Card, idx: number) => {
    if (!socket || !gs) return

    // Power: Jack — reveal own card
    if (powerMode === 'jack') {
      socket.emit('game:power:jack', { tableId, cardIndex: idx })
      setPowerMode(null); return
    }
    // Power: King step 2 — self card
    if (powerMode === 'king' && kingStep) {
      socket.emit('game:power:king', { tableId, userId1: kingStep.userId, idx1: kingStep.idx, userId2: user._id, idx2: idx })
      setPowerMode(null); setKingStep(null); return
    }
    // Power: King step 1 — own card selected
    if (powerMode === 'king' && !kingStep) {
      setKingStep({ userId: user._id, idx }); return
    }

    // Replace with drawn card
    if (!gs.drawPhase && drawnCard && myTurn) {
      socket.emit('game:replace', { tableId, cardIndex: idx })
      setMyHand(prev => { const h=[...prev]; h[idx]=drawnCard; return h })
      setDrawnCard(null); return
    }

    // Quick discard
    if (gs.phase === 'playing' && !myTurn) {
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
  }, [socket, gs, powerMode, kingStep, tableId])

  const activatePower = (type: 'jack'|'queen'|'king') => {
    setPowerMode(type); setKingStep(null)
    toast(`Cliquez sur une carte pour activer le ${type === 'jack' ? 'Valet' : type === 'queen' ? 'Dame' : 'Roi'}`, { icon: '✨' })
  }

  const discardDrawn = () => {
    if (!drawnCard) return
    socket?.emit('game:discard', { tableId })
    setDrawnCard(null)
  }

  const declareBombom = () => socket?.emit('game:bombom', { tableId })
  const confirmShowtime = () => { setBombomPrompt(false); socket?.emit('game:showtime', { tableId }) }
  const cancelBombom = () => { setBombomPrompt(false); socket?.emit('game:cancelBombom', { tableId }) }

  const playAgain = () => { setShowtimeData(null); setGameStarted(false); setMyHand([]); setGs(null); setDrawnCard(null) }

  // ── Timer bar width ────────────────────────────────────────────────────────
  const timerPct = timer.max > 0 ? (timer.remaining / timer.max) * 100 : 0
  const timerColor = timerPct > 50 ? '#22d3ee' : timerPct > 25 ? '#fbbf24' : '#ef4444'

  // ── ShowTime overlay ───────────────────────────────────────────────────────
  if (showtimeData) {
    const { scores, winner, players: sPlayers } = showtimeData
    const isWinner = winner === user._id
    return (
      <div className="flex items-center justify-center h-full p-6 animate-fade-in">
        <div className="glass rounded-3xl p-10 max-w-lg w-full text-center space-y-6">
          <div className="text-6xl">{isWinner ? '🏆' : '😢'}</div>
          <h2 className="text-3xl font-gaming font-black text-white">
            {isWinner ? 'Victoire !' : 'Défaite'}
          </h2>
          <div className="space-y-3">
            {sPlayers.sort((a, b) => (scores[a.userId] ?? 99) - (scores[b.userId] ?? 99)).map((p, i) => (
              <div key={p.userId} className={`flex items-center gap-4 px-5 py-3 rounded-xl ${p.userId === winner ? 'bg-yellow-500/20 border border-yellow-500/40' : 'glass-2'}`}>
                <span className="text-xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                <span className="flex-1 text-white font-semibold text-left">{p.firstName}</span>
                <span className={`font-gaming font-bold text-lg ${p.userId === winner ? 'text-yellow-400' : 'text-slate-300'}`}>
                  {scores[p.userId] ?? '?'} pts
                </span>
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
    return (
      <div className="flex items-center justify-center h-full p-6 animate-fade-in">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center space-y-6">
          <h2 className="text-2xl font-gaming font-black text-white">Salle d'attente</h2>
          <div className="space-y-3">
            {players.map(p => (
              <div key={p.userId} className="flex items-center gap-3 glass-2 px-4 py-3 rounded-xl">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
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
            <button onClick={toggleReady}
              className={`flex-1 py-3 font-bold rounded-xl transition-all ${me?.isReady ? 'btn-danger' : 'btn-primary'}`}>
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
  const opponents = players.filter(p => p.userId !== user._id)

  return (
    <div className="relative h-full flex flex-col overflow-hidden select-none">

      {/* ── BomBom Prompt ── */}
      {bombomPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
          <div className="glass rounded-2xl p-8 text-center max-w-sm space-y-4">
            <div className="text-5xl">💣</div>
            <h3 className="text-xl font-gaming font-black text-white">ShowTime !</h3>
            <p className="text-slate-400 text-sm">Le BomBom est déclenché. Lancer le ShowTime ?</p>
            <div className="flex gap-3">
              <button onClick={confirmShowtime} className="btn-gold flex-1 py-3">🚀 ShowTime !</button>
              <button onClick={cancelBombom} className="btn-outline flex-1 py-3">↩ Annuler</button>
            </div>
          </div>
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
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-6 py-3 rounded-full font-bold text-white bg-red-600 animate-slide-up">
          ⚠️ {penalty}
        </div>
      )}

      {/* ── Timer bar ── */}
      {timer.phase && (
        <div className="flex-shrink-0 px-4 pt-2">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs text-slate-400 w-24">
              {timer.phase === 'memorization' ? '🧠 Mémo' : timer.phase === 'draw' ? '🃏 Piocher' : '🎯 Décider'}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-white/10">
              <div className="timer-bar h-full rounded-full transition-all duration-1000"
                style={{ width: `${timerPct}%`, background: `linear-gradient(90deg, ${timerColor}, ${timerColor}88)` }}/>
            </div>
            <span className="text-xs font-mono font-bold" style={{ color: timerColor }}>{timer.remaining}s</span>
          </div>
        </div>
      )}

      {/* ── Turn indicator ── */}
      {gs && phase === 'playing' && (
        <div className="flex-shrink-0 px-4 py-1">
          <div className={`text-center text-xs font-bold py-1.5 rounded-lg ${myTurn ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-purple-900/30 text-purple-300'}`}>
            {myTurn ? '⚡ C\'est votre tour !' : `⏳ Tour de ${players.find(p => p.userId === gs.turnOrder[gs.currentTurnIndex])?.firstName || '...'}`}
          </div>
        </div>
      )}

      {/* ── Opponents ── */}
      <div className="flex-shrink-0 px-4 py-2">
        <div className="flex gap-4 justify-center">
          {opponents.map(opp => {
            const handSize = gs?.handSizes?.[opp.userId] ?? 4
            return (
              <div key={opp.userId} className="text-center">
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1 justify-center">
                  <span>{opp.firstName}</span>
                  <span className="text-xs opacity-60">({handSize} cartes)</span>
                </div>
                <div className="flex gap-1 justify-center">
                  {[...Array(handSize)].map((_, i) => (
                    <button key={i} onClick={() => clickOpponentCard(opp.userId, i)}
                      className={`w-12 h-16 rounded-lg overflow-hidden transition-all hover:scale-105 hover:-translate-y-1 ${
                        (powerMode === 'queen' || powerMode === 'king') ? 'ring-2 ring-yellow-400 cursor-crosshair' : ''
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
            disabled={!myTurn || !gs?.drawPhase || phase !== 'playing'}
            className={`w-20 h-28 rounded-xl overflow-hidden transition-all ${
              myTurn && gs?.drawPhase && phase === 'playing'
                ? 'hover:scale-105 hover:-translate-y-2 card-glow cursor-pointer ring-2 ring-purple-500'
                : 'opacity-60 cursor-not-allowed'
            }`}>
            <img src={getCardBack()} alt="Deck" className="w-full h-full object-cover"/>
          </button>
          <p className="text-xs text-slate-400 mt-1">{gs?.deckCount ?? 0} cartes</p>
        </div>

        {/* BomBom button */}
        {myTurn && gs?.drawPhase && !gs.bombomBy && phase === 'playing' && (
          <button onClick={declareBombom}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-orange-500 text-2xl flex items-center justify-center shadow-lg hover:scale-110 transition-all animate-pulse-gold">
            💣
          </button>
        )}

        {/* BomBom indicator */}
        {gs?.bombomBy && gs.bombomBy !== user._id && (
          <div className="text-center">
            <div className="text-3xl animate-pulse">💣</div>
            <div className="text-xs text-red-400 font-bold">BomBom!</div>
          </div>
        )}

        {/* Discard pile */}
        <div className="text-center">
          <div className="w-20 h-28 rounded-xl overflow-hidden border-2 border-dashed border-purple-700/50 flex items-center justify-center">
            {topDiscard ? (
              <img src={getCardImage(topDiscard.value)} alt="Défausse" className="w-full h-full object-cover"/>
            ) : (
              <span className="text-slate-600 text-xs">Défausse</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">Défausse</p>
        </div>
      </div>

      {/* ── Drawn card ── */}
      {drawnCard && myTurn && (
        <div className="flex-shrink-0 px-4 py-2">
          <div className="glass-2 rounded-xl p-3 flex items-center gap-4">
            <div className="w-14 h-20 rounded-lg overflow-hidden flex-shrink-0 card-gold-glow">
              <img src={getCardImage(drawnCard.value)} alt="" className="w-full h-full object-cover"/>
            </div>
            <div className="flex-1">
              <p className="text-white font-bold">{getRankLabel(drawnCard.value)} — {getCardScore(drawnCard.value)} pts</p>
              <p className="text-slate-400 text-xs mb-2">Cliquez une carte pour remplacer ou :</p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={discardDrawn} className="btn-outline text-xs py-1.5 px-3">↩ Défausser</button>
                {isJack(drawnCard.value) && !gs?.powers?.[user._id]?.j && (
                  <button onClick={() => activatePower('jack')} className="text-xs py-1.5 px-3 rounded-lg font-bold bg-blue-600/30 text-blue-300 border border-blue-600/50 hover:bg-blue-600/50">
                    👁 Valet
                  </button>
                )}
                {isQueen(drawnCard.value) && !gs?.powers?.[user._id]?.q && (
                  <button onClick={() => activatePower('queen')} className="text-xs py-1.5 px-3 rounded-lg font-bold bg-pink-600/30 text-pink-300 border border-pink-600/50 hover:bg-pink-600/50">
                    👁 Dame
                  </button>
                )}
                {isKing(drawnCard.value) && !gs?.powers?.[user._id]?.k && (
                  <button onClick={() => activatePower('king')} className="text-xs py-1.5 px-3 rounded-lg font-bold bg-yellow-600/30 text-yellow-300 border border-yellow-600/50 hover:bg-yellow-600/50">
                    ↔ Roi
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── My hand ── */}
      <div className="flex-shrink-0 px-4 pb-4">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-xs text-slate-400">{user.firstName} (moi)</span>
          {powerMode && (
            <span className="text-xs font-bold text-yellow-400 ml-2">
              {powerMode === 'jack' ? '👁 Choisissez votre carte' : powerMode === 'queen' ? '👁 Choisissez la carte adverse' : kingStep ? '↔ Choisissez la 2e carte' : '↔ Choisissez la 1ère carte'}
            </span>
          )}
        </div>
        <div className="flex gap-2 justify-center">
          {myHand.map((card, idx) => {
            const isPowerTarget = powerMode === 'jack' || (powerMode === 'king')
            const isReplaceMode = !gs?.drawPhase && drawnCard && myTurn
            return (
              <button key={card.id || idx} onClick={() => clickMyCard(card, idx)}
                className={`w-16 h-24 rounded-xl overflow-hidden transition-all flex-shrink-0 ${
                  isPowerTarget || isReplaceMode
                    ? 'ring-2 ring-yellow-400 hover:scale-110 hover:-translate-y-2 cursor-crosshair'
                    : gs?.phase === 'playing' && !myTurn
                    ? 'hover:scale-105 hover:-translate-y-1 cursor-pointer'
                    : 'cursor-default'
                } ${card.isFlipped ? 'card-glow' : ''}`}>
                <img
                  src={card.isFlipped || phase === 'memorization' ? getCardImage(card.value) : getCardBack()}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Leave button ── */}
      <button onClick={onLeave}
        className="absolute top-2 right-4 text-xs text-slate-500 hover:text-red-400 transition-colors">
        Quitter
      </button>
    </div>
  )
}
