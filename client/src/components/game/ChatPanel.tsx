import { useState, useEffect, useRef } from 'react'

export interface ChatMessage {
  userId: string
  firstName: string
  message: string
  timestamp: number
}

interface Props {
  messages: ChatMessage[]
  onSend: (msg: string) => void
  currentUserId: string
  unreadCount: number
  onRead: () => void
}

const QUICK = ['👋', '😂', '🔥', '💣', '😤', '👑', '🎉', '🤔', '😱', 'gg', 'wp', '😊']

export default function ChatPanel({ messages, onSend, currentUserId, unreadCount, onRead }: Props) {
  const [open, setOpen]   = useState(false)
  const [input, setInput] = useState('')
  const bottomRef         = useRef<HTMLDivElement>(null)

  // Scroll bas + marquer lu à l'ouverture ou quand nouveau message
  useEffect(() => {
    if (open) {
      onRead()
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [open, messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = (msg: string) => {
    const trimmed = msg.trim()
    if (!trimmed) return
    onSend(trimmed)
    setInput('')
  }

  return (
    <div className="absolute bottom-[92px] left-2 z-30 flex flex-col items-start select-text">

      {/* Bouton toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-xl transition-all duration-200 ${
          open
            ? 'bg-purple-600 ring-2 ring-purple-400 scale-105'
            : 'bg-slate-800/90 hover:bg-slate-700 border border-purple-900/40 hover:scale-105'
        }`}
        title="Chat"
      >
        💬
        {unreadCount > 0 && !open && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center px-0.5 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute bottom-12 left-0 w-[265px] rounded-xl border border-purple-900/40 shadow-2xl flex flex-col overflow-hidden animate-fade-in"
          style={{ background: 'rgba(8,8,22,0.96)', backdropFilter: 'blur(16px)', maxHeight: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-purple-900/30 flex-shrink-0">
            <span className="text-white font-bold text-xs flex items-center gap-1.5">
              💬 <span>Chat</span>
            </span>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white text-sm transition-colors">✕</button>
          </div>

          {/* Messages */}
          <div className="overflow-y-auto px-3 py-2 space-y-2 flex-1" style={{ minHeight: 80 }}>
            {messages.length === 0 && (
              <p className="text-slate-600 text-xs text-center py-6">Aucun message pour l'instant 👀</p>
            )}
            {messages.map((m, i) => {
              const isMe = m.userId === currentUserId
              return (
                <div key={i} className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <span className="text-[10px] text-slate-400 px-1 font-medium">{m.firstName}</span>
                  )}
                  <div className={`px-3 py-1.5 rounded-2xl text-xs font-medium max-w-[88%] break-words leading-relaxed ${
                    isMe
                      ? 'bg-purple-700/90 text-white rounded-br-sm'
                      : 'bg-slate-700/80 text-slate-200 rounded-bl-sm'
                  }`}>
                    {m.message}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef}/>
          </div>

          {/* Quick emojis / mots */}
          <div className="flex flex-wrap gap-1 px-2.5 py-1.5 border-t border-purple-900/20 flex-shrink-0">
            {QUICK.map(e => (
              <button key={e}
                onClick={() => send(e)}
                className="px-1.5 py-0.5 rounded-lg text-xs bg-slate-800/70 hover:bg-purple-800/60 text-slate-300 hover:text-white transition-all duration-150 active:scale-95">
                {e}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-1.5 px-2.5 pb-2.5 pt-1 flex-shrink-0">
            <input
              value={input}
              onChange={e => setInput(e.target.value.slice(0, 80))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(input) } }}
              placeholder="Message… (Entrée pour envoyer)"
              className="flex-1 bg-slate-800/70 border border-slate-700/50 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500/60 transition-colors"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim()}
              className="px-2.5 py-1.5 rounded-xl bg-purple-700/80 hover:bg-purple-600 text-white text-xs font-bold disabled:opacity-30 transition-all active:scale-95">
              ↑
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
