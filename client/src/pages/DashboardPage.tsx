import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/layout/Sidebar'
import TopBar from '../components/layout/TopBar'
import HomeView from '../views/HomeView'
import LobbyView from '../views/LobbyView'
import ProfileView from '../views/ProfileView'
import LeaderboardView from '../views/LeaderboardView'
import GameView from '../views/GameView'

export type View = 'home' | 'lobby' | 'game' | 'profile' | 'leaderboard'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<View>('home')
  const [collapsed, setCollapsed] = useState(false)
  const [activeTableId, setActiveTableId] = useState<string | null>(null)

  if (!user) { navigate('/auth'); return null }

  const handleLogout = () => { logout(); navigate('/auth') }
  const goToGame = (tableId: string) => { setActiveTableId(tableId); setView('game') }
  const leaveGame = () => { setActiveTableId(null); setView('lobby') }

  return (
    <div className="flex h-screen overflow-hidden game-bg">
      {/* Dark overlay on background */}
      <div className="absolute inset-0 bg-black/75 pointer-events-none z-0"/>

      {/* Sidebar */}
      <div className="relative z-10">
        <Sidebar
          current={view === 'game' ? 'lobby' : view}
          onChange={(v) => { if (v !== 'game') { setActiveTableId(null) } setView(v) }}
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          onLogout={handleLogout}
          elo={user.elo}
          isGuest={!!user.isGuest}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10 overflow-hidden">
        <TopBar
          view={view}
          user={user}
          onProfileClick={() => setView('profile')}
          isAdmin={!!user.isAdmin}
        />

        <main className="flex-1 overflow-y-auto">
          {view === 'home'        && <HomeView onPlay={() => setView('lobby')} user={user}/>}
          {view === 'lobby'       && <LobbyView onJoinGame={goToGame} user={user}/>}
          {view === 'game'        && activeTableId && <GameView tableId={activeTableId} user={user} onLeave={leaveGame}/>}
          {view === 'profile'     && <ProfileView user={user}/>}
          {view === 'leaderboard' && <LeaderboardView/>}
        </main>
      </div>
    </div>
  )
}
