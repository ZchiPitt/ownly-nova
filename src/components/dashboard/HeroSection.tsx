import { useNavigate } from 'react-router-dom'
import type { RecentItem } from '@/hooks/useRecentItems'
import { useCategories } from '@/hooks/useCategories'

interface HeroSectionProps {
    recentItems: RecentItem[]
    isLoading: boolean
    totalItems: number
}

export function HeroSection({ recentItems, isLoading, totalItems }: HeroSectionProps) {
    const navigate = useNavigate()
    const { categories } = useCategories()
    const isValidItemId = (value: string) => /^[a-f0-9-]{16,}$/i.test(value)

    const getCategoryIdForShortcut = (label: string) => {
        const aliases: Record<string, string[]> = {
            Clothes: ['clothes', 'clothing', 'apparel', 'wardrobe'],
            Beauty: ['beauty', 'cosmetics', 'makeup', 'skincare', 'personal care', 'toiletries'],
            Kitchen: ['kitchen', 'cookware', 'utensils', 'dining'],
            Tools: ['tools', 'tool', 'hardware', 'workshop', 'home improvement', 'equipment'],
        }

        const keywords = aliases[label] ?? [label.toLowerCase()]
        const matched = categories.find((category) => {
            const name = category.name.toLowerCase()
            return keywords.some((keyword) => name === keyword || name.includes(keyword))
        })

        return matched?.id ?? null
    }

    const handleShortcutClick = (label: string) => {
        const categoryId = getCategoryIdForShortcut(label)
        if (!categoryId) {
            navigate('/inventory')
            return
        }

        const params = new URLSearchParams()
        params.set('categories', categoryId)
        navigate(`/inventory?${params.toString()}`)
    }

    const renderShortcutIcon = (label: string) => {
        switch (label) {
            case 'Clothes':
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5h6l1.5 2.25 2.25-1.5 1.5 3-3 1.5V19.5H6.75V9.75l-3-1.5 1.5-3 2.25 1.5L9 4.5Z" />
                    </svg>
                )
            case 'Beauty':
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 4.5h4.5v2.25a2.25 2.25 0 1 1-4.5 0V4.5Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.75h6v2.25H9V9.75Zm.75 2.25h4.5v6h-4.5v-6Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18h7.5" />
                    </svg>
                )
            case 'Kitchen':
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 4.5v7.5M10.5 4.5v7.5M7.5 8.25h3M9 12v7.5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 4.5v15M15.75 4.5a2.25 2.25 0 0 1 2.25 2.25V9h-4.5V6.75A2.25 2.25 0 0 1 15.75 4.5Z" />
                    </svg>
                )
            case 'Tools':
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.75a3 3 0 0 1-4.243 4.243l-4.557 4.557a2.25 2.25 0 1 1-3.182-3.182l4.557-4.557A3 3 0 1 1 16.5 4.5l-1.5 1.5 3 3 1.5-1.5a2.989 2.989 0 0 1 .75-.75Z" />
                    </svg>
                )
            default:
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                    </svg>
                )
        }
    }

    return (
        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-8 soft-shadow border border-[#f5ebe0]/40 overflow-hidden relative">
            <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div onClick={() => navigate('/inventory')} className="cursor-pointer group flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-[#fdf8f2] text-[#d6ccc2] group-hover:bg-[#e3ead3] group-hover:text-[#4a3f35] transition-all soft-shadow">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.25}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h15m-15 0L7.5 4.5h9l3 3m-15 0v12h15v-12" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 11.25h6M9 14.75h4.5" />
                            </svg>
                        </div>
                        <h2 className="text-lg sm:text-2xl font-black text-[#4a3f35] tracking-tight group-hover:text-[#d6ccc2] transition-colors">Your Belongings</h2>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-2.5 mt-1">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-[#e3ead3] rounded-full animate-pulse"></span>
                        <p className="text-[10px] sm:text-[11px] font-black text-[#8d7b6d] uppercase tracking-[0.25em]">{totalItems} Items Added</p>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            navigate('/search')
                        }}
                        className="mt-2.5 sm:mt-3 w-full bg-[#fdf8f2]/90 rounded-[1rem] sm:rounded-[1.25rem] px-3 sm:px-4 py-2.5 sm:py-3 flex items-center border border-[#f5ebe0]/60 soft-shadow text-left group transition-all hover:bg-white"
                    >
                        <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#d6ccc2] mr-2.5 sm:mr-3 group-hover:text-[#4a3f35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.25}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
                        </svg>
                        <span className="font-bold text-xs sm:text-sm text-[#b9a99b] group-hover:text-[#4a3f35]">Search items, tags, locations...</span>
                    </button>
                </div>
                <button
                    onClick={() => navigate('/inventory')}
                    className="p-2.5 sm:p-4 bg-[#fdf8f2] text-[#d6ccc2] rounded-xl sm:rounded-2xl hover:bg-[#e3ead3] hover:text-[#4a3f35] transition-all soft-shadow"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 sm:w-6 sm:h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                </button>
            </div>

            {/* Collection Preview */}
            <div className="mb-5 sm:mb-8 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between px-1 sm:px-2">
                    <div className="flex items-center gap-2.5">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#fbc4ab]">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                        </svg>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#d6ccc2]">RECENTLY ADDED</h3>
                    </div>
                    <button onClick={() => navigate('/inventory')} className="text-[10px] font-black text-[#4a3f35] uppercase tracking-widest hover:underline decoration-2 underline-offset-4">View All</button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {isLoading ? (
                        [1, 2].map(i => (
                            <div key={i} className="aspect-[4/3] bg-[#fdf8f2] rounded-[1.5rem] sm:rounded-[2rem] animate-pulse"></div>
                        ))
                    ) : (
                        recentItems.slice(0, 2).map(item => (
                            <div
                                key={item.id}
                                onClick={() => {
                                    if (!isValidItemId(item.id)) {
                                        navigate('/inventory')
                                        return
                                    }
                                    navigate(`/item/${encodeURIComponent(item.id)}`)
                                }}
                                className="bg-[#fdf8f2] rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden border border-[#f5ebe0]/40 soft-shadow hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group"
                            >
                                <div className="aspect-[4/3] bg-white relative overflow-hidden">
                                    {item.thumbnail_url || item.photo_url ? (
                                        <img src={item.thumbnail_url || item.photo_url} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[#d6ccc2]">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
                                        </div>
                                    )}
                                    <div className="absolute top-3 left-3">
                                        <span className="px-3 py-1 bg-white/85 backdrop-blur-md rounded-full text-[8px] font-black text-[#4a3f35] uppercase tracking-widest border border-white/50">{item.category_name || 'Other'}</span>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-black text-[#4a3f35] text-[11px] truncate">{item.name}</h3>
                                    <div className="mt-2 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-[8px] font-black text-[#8d7b6d] uppercase tracking-wider">
                                            <svg className="w-2.5 h-2.5 text-[#e3ead3]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                                            {(item as any).location_name || 'A safe spot'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Shortcuts */}
            <div className="bg-[#fdf8f2]/40 rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-7 border border-[#f5ebe0]/30 shadow-inner">
                <div className="grid grid-cols-4 gap-3 sm:gap-6 w-full text-center">
                    {[
                        { label: 'Clothes' },
                        { label: 'Beauty' },
                        { label: 'Kitchen' },
                        { label: 'Tools' }
                    ].map((cat, i) => (
                        <button key={i} onClick={() => handleShortcutClick(cat.label)} className="flex flex-col items-center gap-1.5 sm:gap-2 group active:scale-95 transition-all">
                            <div className="p-2.5 sm:p-4 bg-[#fef3c7] rounded-xl sm:rounded-2xl shadow-sm group-hover:bg-[#fde68a] transition-colors border border-white/50">
                                <div className="w-4 h-4 sm:w-5 sm:h-5 text-[#4a3f35]">
                                    {renderShortcutIcon(cat.label)}
                                </div>
                            </div>
                            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tighter text-[#8d7b6d]">{cat.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
