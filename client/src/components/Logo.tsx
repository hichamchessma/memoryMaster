interface LogoProps { size?: 'sm' | 'md' | 'lg'; collapsed?: boolean }

export default function Logo({ size = 'md', collapsed = false }: LogoProps) {
  const sz = { sm: 28, md: 36, lg: 48 }[size]
  const textSize = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' }[size]

  return (
    <div className="flex items-center gap-2 select-none">
      {/* SVG Logo: Crown + Cards */}
      <svg width={sz} height={sz} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lgPurple" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7c3aed"/>
            <stop offset="100%" stopColor="#4f46e5"/>
          </linearGradient>
          <linearGradient id="lgGold" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fbbf24"/>
            <stop offset="100%" stopColor="#f59e0b"/>
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Background circle */}
        <circle cx="24" cy="24" r="22" fill="url(#lgPurple)" opacity="0.9"/>

        {/* Cards stacked */}
        <rect x="12" y="18" width="14" height="18" rx="2" fill="white" opacity="0.15" transform="rotate(-8 19 27)"/>
        <rect x="14" y="16" width="14" height="18" rx="2" fill="white" opacity="0.25" transform="rotate(-3 21 25)"/>
        <rect x="16" y="15" width="14" height="18" rx="2" fill="white" opacity="0.9"/>
        <text x="23" y="27" textAnchor="middle" fontSize="9" fontWeight="bold" fill="url(#lgGold)" fontFamily="serif">MM</text>

        {/* Crown */}
        <g filter="url(#glow)">
          <polygon points="8,14 14,8 20,13 24,6 28,13 34,8 40,14 36,19 12,19" fill="url(#lgGold)"/>
          <circle cx="8"  cy="14" r="2.5" fill="#fbbf24"/>
          <circle cx="24" cy="6"  r="2.5" fill="#fbbf24"/>
          <circle cx="40" cy="14" r="2.5" fill="#fbbf24"/>
        </g>
      </svg>

      {!collapsed && (
        <div className="flex flex-col leading-tight">
          <span className={`font-gaming font-black ${textSize} bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent`}>
            Memory
          </span>
          <span className={`font-gaming font-black ${textSize} bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent -mt-1`}>
            Master
          </span>
        </div>
      )}
    </div>
  )
}
