import { useNavigate } from 'react-router-dom';

export function AgentSection() {
    const navigate = useNavigate();

    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <button
                onClick={() => navigate('/shopping')}
                className="bg-[#e3ead3] px-3 py-5 sm:p-10 rounded-[2rem] sm:rounded-[3.5rem] flex flex-col items-center gap-3 sm:gap-5 soft-shadow hover:-translate-y-1.5 transition-all group border-2 border-white/60"
            >
                <div className="p-3 sm:p-5 bg-white/50 rounded-2xl sm:rounded-3xl group-hover:bg-white transition-all shadow-md">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-[#4a3f35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                </div>
                <div className="text-center w-full">
                    <span className="text-[11px] sm:text-base font-black text-[#4a3f35] uppercase tracking-tight leading-tight">TALK TO OWNLY</span>
                    <p className="text-[9px] sm:text-[10px] font-bold text-[#4a3f35]/70 mt-1 sm:mt-2 leading-snug">AI bestie for decisions</p>
                </div>
            </button>
            <button
                onClick={() => navigate('/add')}
                className="bg-[#f8e1d7] px-3 py-5 sm:p-10 rounded-[2rem] sm:rounded-[3.5rem] flex flex-col items-center gap-3 sm:gap-5 soft-shadow hover:-translate-y-1.5 transition-all group border-2 border-white/60"
            >
                <div className="p-3 sm:p-5 bg-white/50 rounded-2xl sm:rounded-3xl group-hover:bg-white transition-all shadow-md">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-[#4a3f35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                    </svg>
                </div>
                <div className="text-center w-full">
                    <span className="text-[11px] sm:text-base font-black text-[#4a3f35] uppercase tracking-tight leading-tight">ADD ITEMS</span>
                    <p className="text-[9px] sm:text-[10px] font-bold text-[#4a3f35]/70 mt-1 sm:mt-2 leading-snug">Snap & let AI organize</p>
                </div>
            </button>
        </div>
    )
}
