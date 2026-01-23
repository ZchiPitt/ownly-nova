import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useMessages } from '@/hooks/useMessages'

interface NavItem {
  path: string
  label: string
  icon: ReactNode
  badgeCount?: number
  isCenter?: boolean
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? 'text-[#2f6f67]' : 'text-[#8b8b8b]'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3.75 10.5L12 3.75l8.25 6.75"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6.75 9.75V19.5a.75.75 0 00.75.75h3.75V15a.75.75 0 01.75-.75h0a.75.75 0 01.75.75v5.25h3.75a.75.75 0 00.75-.75V9.75"
      />
      <path
        className={active ? 'opacity-100' : 'opacity-0'}
        fill="currentColor"
        d="M12 5.4l6.45 5.28V19.05h-4.2v-3.9A2.25 2.25 0 0012 12.9a2.25 2.25 0 00-2.25 2.25v3.9h-4.2v-8.37L12 5.4z"
      />
    </svg>
  )
}

function InventoryIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? 'text-[#8c5a2b]' : 'text-[#8b8b8b]'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.5 7.5h15m-15 0L7.5 4.5h9l3 3m-15 0v12h15v-12"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 11.25h6M9 14.75h4.5"
      />
      <path
        className={active ? 'opacity-100' : 'opacity-0'}
        fill="currentColor"
        d="M5.7 8.4h12.6v10.2H5.7V8.4zm2.85-2.7h6.9l1.2 1.2h-9.3l1.2-1.2z"
      />
    </svg>
  )
}

function MarketplaceIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? 'text-[#4a3f35]' : 'text-[#a89887]'}`}
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={active ? 0 : 2}
        d="M3.75 7.5h16.5l-1.5 12a2.25 2.25 0 01-2.25 2h-9a2.25 2.25 0 01-2.25-2l-1.5-12z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={active ? 0 : 2}
        d="M9 7.5V6a3 3 0 116 0v1.5"
      />
    </svg>
  )
}

function MessagesIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? 'text-[#4a3f35]' : 'text-[#a89887]'}`}
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={active ? 0 : 2}
        d="M6 9h8m-8 4h5m-8 7.5V7.875C3 6.563 4.063 5.5 5.375 5.5h11.25C17.938 5.5 19 6.563 19 7.875v5.625c0 1.312-1.062 2.375-2.375 2.375H9.25L5.25 19.5a.75.75 0 01-1.25-.56z"
      />
    </svg>
  )
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? 'text-[#4f5d77]' : 'text-[#8b8b8b]'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.5 6.75h15M4.5 12h15M4.5 17.25h15"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.25 6.75a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm10.5 5.25a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm-7.5 5.25a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
      />
      <path
        className={active ? 'opacity-100' : 'opacity-0'}
        fill="currentColor"
        d="M4.5 6h15v1.5h-15V6zm0 5.25h15v1.5h-15v-1.5zm0 5.25h15V18h-15v-1.5z"
      />
    </svg>
  )
}

export function BottomNav() {
  const location = useLocation()
  const { getUnreadCount } = useMessages()
  const [unreadCount, setUnreadCount] = useState(0)

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

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

  const navItems: NavItem[] = [
    {
      path: '/dashboard',
      label: 'Home',
      icon: <HomeIcon active={isActive('/dashboard')} />,
    },
    {
      path: '/inventory',
      label: 'Inventory',
      icon: <InventoryIcon active={isActive('/inventory')} />,
    },
    {
      path: '/marketplace',
      label: 'Marketplace',
      icon: <MarketplaceIcon active={isActive('/marketplace')} />,
    },
    {
      path: '/messages',
      label: 'Messages',
      icon: <MessagesIcon active={isActive('/messages')} />,
      badgeCount: unreadCount,
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: <SettingsIcon active={isActive('/settings')} />,
    },
  ]

  const getIconContainerClass = (path: string) => {
    const active = isActive(path)
    if (!active) {
      return 'h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200'
    }

    if (path === '/dashboard') {
      return 'h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 bg-[#e6f2ef]'
    }
    if (path === '/inventory') {
      return 'h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 bg-[#f4e7d9]'
    }
    if (path === '/settings') {
      return 'h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 bg-[#e8ecf5]'
    }
    return 'h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 bg-[#e9f1f8]'
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-[#ece6df] h-16 z-50">
      <div className="flex items-center justify-around h-full max-w-lg mx-auto px-3">
        {navItems.map((item) => {
          const active = isActive(item.path)
          const badgeCount = item.badgeCount ?? 0
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex flex-col items-center justify-center flex-1 h-full gap-0.5"
              aria-label={item.label}
            >
              <div className={`relative ${getIconContainerClass(item.path)}`}>
                {item.icon}
                {badgeCount > 0 ? (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-none rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                ) : null}
              </div>
              <span
                className={`text-[10px] mt-0.5 transition-colors ${
                  active ? 'text-[#4a3f35] font-semibold' : 'text-[#8b8b8b]'
                }`}
              >
                {item.label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
