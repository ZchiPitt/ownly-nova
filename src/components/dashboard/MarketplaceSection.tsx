import { useNavigate } from 'react-router-dom';

export function MarketplaceSection() {
  const navigate = useNavigate();

  const renderActionIcon = (label: string) => {
    switch (label) {
      case 'Browse':
        return (
          <svg className="w-5 h-5 text-[#4a3f35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 4.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 15 4.5 4.5" />
          </svg>
        );
      case 'Sell':
        return (
          <svg className="w-5 h-5 text-[#4a3f35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5h16.5l-1.2 10.8a1.5 1.5 0 0 1-1.5 1.35H6.45a1.5 1.5 0 0 1-1.5-1.35L3.75 7.5Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 10.5V6.75a3.75 3.75 0 0 1 7.5 0v3.75" />
          </svg>
        );
      case 'Saved':
        return (
          <svg className="w-5 h-5 text-[#4a3f35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25s-7.5-4.219-7.5-10.313A4.688 4.688 0 0 1 12 6.13a4.688 4.688 0 0 1 7.5 3.807C19.5 16.03 12 20.25 12 20.25Z" />
          </svg>
        );
      case 'Inbox':
        return (
          <svg className="w-5 h-5 text-[#4a3f35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25h15A1.5 1.5 0 0 1 21 6.75v10.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.25V6.75a1.5 1.5 0 0 1 1.5-1.5Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 7.5 7.5 5.25 7.5-5.25" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-8 soft-shadow border border-[#f5ebe0]/40 space-y-5 sm:space-y-8 overflow-hidden relative">
      <div className="flex items-center justify-between mb-3 sm:mb-6">
        <div onClick={() => navigate('/marketplace')} className="cursor-pointer group flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-[#fdf8f2] text-[#d6ccc2] group-hover:bg-[#e3ead3] group-hover:text-[#4a3f35] transition-all soft-shadow">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5h16.5l-1.2 10.8a1.5 1.5 0 0 1-1.5 1.35H6.45a1.5 1.5 0 0 1-1.5-1.35L3.75 7.5Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 10.5V6.75a3.75 3.75 0 0 1 7.5 0v3.75" />
              </svg>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-[#4a3f35] tracking-tight group-hover:text-[#d6ccc2] transition-colors">
              Marketplace
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-2.5 mt-1">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-[#fbc4ab] rounded-full animate-pulse"></span>
            <p className="text-[10px] sm:text-[11px] font-black text-[#8d7b6d] truncate">Sell unused items, buy from others.</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/marketplace')}
          className="p-2.5 sm:p-4 bg-[#fdf8f2] text-[#d6ccc2] rounded-xl sm:rounded-2xl hover:bg-[#e3ead3] hover:text-[#4a3f35] transition-all soft-shadow"
          aria-label="Enter Marketplace"
          title="Enter Marketplace"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 sm:w-6 sm:h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>

      <div className="bg-[#fdf8f2]/40 rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-7 border border-[#f5ebe0]/30 shadow-inner">
        <div className="grid grid-cols-4 gap-3 sm:gap-6 w-full text-center">
          {[
            { label: 'Browse', path: '/marketplace' },
            { label: 'Sell', path: '/marketplace/my-listings' },
            { label: 'Saved', path: '/marketplace/saved' },
            { label: 'Inbox', path: '/messages' }
          ].map((action, i) => (
            <button key={i} onClick={() => navigate(action.path)} className="flex flex-col items-center gap-1.5 sm:gap-2 group active:scale-95 transition-all">
              <div className="p-2.5 sm:p-4 bg-[#fef3c7] rounded-xl sm:rounded-2xl shadow-sm group-hover:bg-[#fde68a] transition-colors border border-white/50">
                {renderActionIcon(action.label)}
              </div>
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tighter text-[#8d7b6d]">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
