import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { InstallBanner } from '../InstallBanner'
import { IOSInstallBanner } from '../IOSInstallBanner'
import { OfflineBanner } from '../OfflineBanner'
import { Toast } from '../Toast'
import { useMessages } from '@/hooks/useMessages'

interface AppShellProps {
  children: React.ReactNode
  /** Optional header content to show at the top. If not provided, shows default Ownly header with navigation. */
  header?: React.ReactNode
  /** Whether to show the floating add button (default: true) */
  showAddButton?: boolean
  /** Whether to show search bar in header (default: false) */
  showSearch?: boolean
  /** Callback when search is clicked */
  onSearchClick?: () => void
}

/**
 * OwnlyLogo - Minimal, warm icon for the brand.
 */
const OwnlyLogo = ({ className = 'w-14 h-14' }: { className?: string }) => (
  <div className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-white soft-shadow border border-[#f5ebe0] ${className}`}>
    <svg viewBox="0 0 100 100" className="w-full h-full p-2">
      <defs>
        <linearGradient id="softGrad" x1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f8e1d7" />
          <stop offset="100%" stopColor="#fbc4ab" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="35" fill="url(#softGrad)" opacity="0.4" />
      <path d="M50,25 L50,75 M25,50 L75,50" stroke="#4a3f35" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
      <rect x="35" y="35" width="30" height="30" rx="6" fill="white" />
      <circle cx="50" cy="50" r="6" fill="#fcf6bd" />
    </svg>
  </div>
);

/**
 * AppShell provides the main application layout.
 */
export function AppShell({
  children,
  header: _header,
  showAddButton = true,
  showSearch = false,
  onSearchClick,
}: AppShellProps) {
  const [showInstallToast, setShowInstallToast] = useState(false)
  const [_unreadCount, setUnreadCount] = useState(0)
  const location = useLocation()
  const navigate = useNavigate()
  const { getUnreadCount } = useMessages()

  useEffect(() => {
    let isMounted = true
    const loadUnreadCount = async () => {
      const count = await getUnreadCount()
      if (isMounted) {
        setUnreadCount(count)
      }
    }
    loadUnreadCount()
    return () => {
      isMounted = false
    }
  }, [getUnreadCount, location.pathname])

  const handleInstalled = () => {
    setShowInstallToast(true)
  }

  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/'

  return (
    <div className="min-h-screen pb-12 transition-colors duration-1000 bg-[#fdf8f2]">
      {/* Offline status banner */}
      <OfflineBanner />

      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-[#f5ebe0]/40 px-3 py-2.5 sm:px-6 sm:py-5 flex flex-col gap-3 sm:gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-5 flex-1 min-w-0">
            {!isDashboard ? (
              <button onClick={() => navigate('/dashboard')} className="p-2.5 sm:p-4 bg-white/60 rounded-2xl sm:rounded-3xl text-[#8d7b6d] active:scale-95 transition-all soft-shadow border border-white/50">
                <svg className="w-5 h-5 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              </button>
            ) : (
              <OwnlyLogo className="w-10 h-10 sm:w-14 sm:h-14 animate-breathing" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col">
                <div className="flex items-baseline gap-2 sm:gap-3">
                  <h1 className="text-2xl sm:text-4xl font-black tracking-tighter text-[#4a3f35] leading-none whitespace-nowrap">Ownly</h1>
                  <span className="text-[10px] font-bold text-[#d6ccc2] uppercase tracking-widest leading-none hidden sm:inline">Your AI Inventory & Ownership Assistant</span>
                </div>
                <p className="text-[9px] sm:text-xs font-bold text-[#8d7b6d] uppercase tracking-[0.1em] sm:tracking-[0.15em] leading-tight mt-0.5 sm:mt-1 truncate">Know what you own</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `p-2 sm:p-4 rounded-xl sm:rounded-3xl transition-all active:scale-95 ${isActive ? 'bg-[#d6ccc2] text-white soft-shadow' : 'bg-white/40 text-[#8d7b6d] hover:bg-white/60'}`}
              aria-label="Home"
              title="Home"
            >
              <svg className="w-4 h-4 sm:w-5.5 sm:h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 10.5 12 3.75l8.25 6.75" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 9.75V19.5a.75.75 0 0 0 .75.75h3.75V15a.75.75 0 0 1 .75-.75h0a.75.75 0 0 1 .75.75v5.25h3.75a.75.75 0 0 0 .75-.75V9.75" />
              </svg>
            </NavLink>
            <NavLink
              to="/inventory"
              className={({ isActive }) => `p-2 sm:p-4 rounded-xl sm:rounded-3xl transition-all active:scale-95 ${isActive ? 'bg-[#d6ccc2] text-white soft-shadow' : 'bg-white/40 text-[#8d7b6d] hover:bg-white/60'}`}
              aria-label="My Inventory"
              title="My Inventory"
            >
              <svg className="w-4 h-4 sm:w-5.5 sm:h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h15m-15 0L7.5 4.5h9l3 3m-15 0v12h15v-12" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 11.25h6M9 14.75h4.5" />
              </svg>
            </NavLink>
            <NavLink
              to="/marketplace"
              className={({ isActive }) => `p-2 sm:p-4 rounded-xl sm:rounded-3xl transition-all active:scale-95 ${isActive ? 'bg-[#d6ccc2] text-white soft-shadow' : 'bg-white/40 text-[#8d7b6d] hover:bg-white/60'}`}
              aria-label="Marketplace"
              title="Marketplace"
            >
              <svg className="w-4 h-4 sm:w-5.5 sm:h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5h16.5l-1.2 10.8a1.5 1.5 0 0 1-1.5 1.35H6.45a1.5 1.5 0 0 1-1.5-1.35L3.75 7.5Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 10.5V6.75a3.75 3.75 0 0 1 7.5 0v3.75" />
              </svg>
            </NavLink>
            <NavLink
              to="/shopping"
              className={({ isActive }) => `p-2 sm:p-4 rounded-xl sm:rounded-3xl transition-all active:scale-95 ${isActive ? 'bg-[#d6ccc2] text-white soft-shadow' : 'bg-white/40 text-[#8d7b6d] hover:bg-white/60'}`}
              aria-label="Shopping Assistant"
              title="Shopping Assistant"
            >
              <svg className="w-4 h-4 sm:w-5.5 sm:h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
            </NavLink>
            <NavLink
              to="/messages"
              className={({ isActive }) => `relative p-2 sm:p-4 rounded-xl sm:rounded-3xl transition-all active:scale-95 ${isActive ? 'bg-[#d6ccc2] text-white soft-shadow' : 'bg-white/40 text-[#8d7b6d] hover:bg-white/60'}`}
              aria-label="Messages"
              title="Messages"
            >
              <svg className="w-4 h-4 sm:w-5.5 sm:h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9h8m-8 4h5m-8 7.5V7.875C3 6.563 4.063 5.5 5.375 5.5h11.25C17.938 5.5 19 6.563 19 7.875v5.625c0 1.312-1.062 2.375-2.375 2.375H9.25L5.25 19.5a.75.75 0 0 1-1.25-.56Z" />
              </svg>
              {_unreadCount > 0 && (
                <span className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-red-500 text-white text-[8px] sm:text-[9px] leading-none rounded-full min-w-[12px] sm:min-w-[14px] h-3 sm:h-3.5 px-0.5 sm:px-1 flex items-center justify-center">
                  {_unreadCount > 9 ? '9+' : _unreadCount}
                </span>
              )}
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => `p-2 sm:p-4 rounded-xl sm:rounded-3xl transition-all active:scale-95 ${isActive ? 'bg-[#d6ccc2] text-white soft-shadow' : 'bg-white/40 text-[#8d7b6d] hover:bg-white/60'}`}
              aria-label="Settings"
              title="Settings"
            >
              <svg className="w-4 h-4 sm:w-5.5 sm:h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75h15M4.5 12h15M4.5 17.25h15" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm10.5 5.25a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-7.5 5.25a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
              </svg>
            </NavLink>
          </div>
        </div>

        {/* Search Bar - only if needed */}
        {showSearch && (
          <div className="flex items-center gap-3 animate-in fade-in duration-500">
            <button
              onClick={onSearchClick || (() => navigate('/search'))}
              className="relative flex-1 bg-white/50 rounded-[1.5rem] px-6 py-4 flex items-center border border-white/60 soft-shadow text-left group transition-all hover:bg-white"
            >
              <svg className="w-5 h-5 text-[#d6ccc2] mr-4 group-hover:text-[#4a3f35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" /></svg>
              <span className="font-bold text-base text-[#d6ccc2] group-hover:text-[#4a3f35]">Find a memory...</span>
            </button>
          </div>
        )}
      </header>

      {/* Main content area */}
      <main className="flex-1 p-3 sm:p-6 max-w-6xl mx-auto">
        {children}
      </main>

      {/* 2 Floating Global Buttons */}
      {showAddButton && !location.pathname.startsWith('/settings') && (
        <div className="fixed bottom-6 right-4 sm:bottom-10 sm:right-10 z-[60] flex flex-col gap-3 sm:gap-6">
          <button
            onClick={() => navigate('/shopping')}
            className="w-14 h-14 sm:w-20 sm:h-20 bg-[#e3ead3] text-[#4a3f35] rounded-full soft-shadow flex items-center justify-center active:scale-90 transition-all shadow-2xl hover:bg-[#d0f4de] border-2 border-white/50"
            title="Talk to Ownly"
          >
            <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg>
          </button>
          <button
            onClick={() => navigate('/add')}
            className="w-14 h-14 sm:w-20 sm:h-20 bg-[#f8e1d7] text-[#4a3f35] rounded-full soft-shadow flex items-center justify-center active:scale-90 transition-all shadow-2xl hover:bg-[#fbc4ab] border-2 border-white/50"
            title="Add Items"
          >
            <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>
          </button>
        </div>
      )}

      {/* Install banner for Android/Chrome */}
      <InstallBanner onInstalled={handleInstalled} />

      {/* Install instructions banner for iOS Safari */}
      <IOSInstallBanner />

      {/* Install success toast */}
      {showInstallToast && (
        <Toast
          message="App installed!"
          type="success"
          onClose={() => setShowInstallToast(false)}
        />
      )}
    </div>
  )
}

export default AppShell
