# US-MKT-014: Bottom Navigation Update

**Description:** As a user, I want quick access to marketplace from bottom navigation so I can easily switch between main features.

## Acceptance Criteria

1. Add Marketplace icon to bottom navigation bar
2. Navigation order: Home, Inventory, Marketplace, Messages, Profile/Settings
3. Marketplace icon: shopping bag or store icon
4. Active state highlighting (same as other nav items)
5. Badge on Messages icon showing unread count
6. Badge on Marketplace icon showing new listings count (optional, can skip)
7. Responsive: icons only on mobile, icons+labels on tablet+
8. npm run build passes

## Technical Details

**Files to Modify:**

### 1. Update BottomNav Component
`src/components/layout/BottomNav.tsx` or similar

Current nav items (likely):
- Home
- Inventory (or Items)
- Settings/Profile

New nav items:
```typescript
const navItems = [
  { path: '/', icon: HomeIcon, label: 'Home' },
  { path: '/inventory', icon: BoxIcon, label: 'Items' },
  { path: '/marketplace', icon: ShoppingBagIcon, label: 'Shop' },
  { path: '/messages', icon: ChatBubbleIcon, label: 'Messages', badge: unreadCount },
  { path: '/settings', icon: UserIcon, label: 'Profile' },
];
```

### 2. Icons to Use
From Heroicons or similar:
- Home: `HomeIcon`
- Inventory: `CubeIcon` or `ArchiveBoxIcon`
- Marketplace: `ShoppingBagIcon` or `BuildingStorefrontIcon`
- Messages: `ChatBubbleLeftRightIcon`
- Profile/Settings: `UserCircleIcon` or `Cog6ToothIcon`

### 3. Unread Badge
```tsx
<Link to="/messages" className="nav-item">
  <div className="relative">
    <ChatBubbleIcon className="w-6 h-6" />
    {unreadCount > 0 && (
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    )}
  </div>
  <span className="text-xs">Messages</span>
</Link>
```

### 4. Get Unread Count
Use useMessages hook to get unread count:
```typescript
const { getUnreadCount } = useMessages();
const [unreadCount, setUnreadCount] = useState(0);

useEffect(() => {
  getUnreadCount().then(setUnreadCount);
}, []);
```

### 5. Active State Styling
```tsx
const isActive = location.pathname === item.path;

<Link 
  to={item.path}
  className={`flex flex-col items-center py-2 px-3 ${
    isActive ? 'text-blue-600' : 'text-gray-500'
  }`}
>
```

## Bottom Nav Design

```
┌─────────────────────────────────────────────┐
│  🏠      📦      🛍️      💬(2)     👤     │
│ Home   Items   Shop   Messages  Profile    │
└─────────────────────────────────────────────┘
```

Mobile (icons only):
```
┌─────────────────────────────────────────────┐
│    🏠       📦       🛍️      💬(2)    👤   │
└─────────────────────────────────────────────┘
```

## Instructions

1. Find the bottom navigation component (likely in `src/components/layout/`)
2. Add Marketplace nav item with ShoppingBagIcon
3. Add Messages nav item with ChatBubbleIcon and unread badge
4. Reorder items: Home, Inventory, Marketplace, Messages, Profile
5. Ensure active state highlighting works for all items
6. Run `npm run build` to verify
7. Commit with: `feat: [US-MKT-014] Update bottom navigation with marketplace`
8. Append progress to `scripts/ralph-fixes/progress.txt`

When ALL acceptance criteria are met and build passes, reply with:
<promise>COMPLETE</promise>
