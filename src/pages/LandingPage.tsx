/**
 * Landing Page - Public homepage for unauthenticated users
 * Showcases app features and provides login/signup CTAs
 */

import { Link } from 'react-router-dom';

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

export function LandingPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#fdf8f2]">
            <div className="w-full max-w-md space-y-12 animate-in fade-in zoom-in-95 duration-700">
                {/* Brand Header */}
                <div className="flex flex-col items-center space-y-6 text-center">
                    <OwnlyLogo className="w-24 h-24 shadow-xl border-4 border-white" />
                    <div className="space-y-4">
                        <h1 className="text-6xl font-black tracking-tighter text-[#4a3f35]">Ownly</h1>
                        <div className="space-y-2">
                            <p className="text-[11px] font-black text-[#8d7b6d] uppercase tracking-[0.25em] leading-none whitespace-nowrap">Your AI Inventory & Ownership Assistant</p>
                            <p className="text-sm font-medium text-[#d6ccc2] italic max-w-[320px] mx-auto leading-relaxed">Know what you own, find quicker, buy smarter, live lighter</p>
                        </div>
                    </div>
                </div>

                {/* Login Container */}
                <div className="bg-white rounded-[4rem] p-12 soft-shadow border border-[#f5ebe0]/60 space-y-10">
                    <div className="space-y-6">
                        <div className="relative group">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[#d6ccc2] group-focus-within:text-[#4a3f35] transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" /></svg>
                            </div>
                            <input
                                type="email"
                                placeholder="Your email"
                                className="w-full bg-[#fdf8f2] border-none rounded-[2rem] py-6 pl-16 pr-8 font-semibold text-lg outline-none ring-2 ring-transparent focus:ring-[#e3ead3] transition-all"
                            />
                        </div>
                        <div className="relative group">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[#d6ccc2] group-focus-within:text-[#4a3f35] transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </div>
                            <input
                                type="password"
                                placeholder="Password"
                                className="w-full bg-[#fdf8f2] border-none rounded-[2rem] py-6 pl-16 pr-8 font-semibold text-lg outline-none ring-2 ring-transparent focus:ring-[#e3ead3] transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-5">
                        <Link
                            to="/dashboard"
                            className="w-full bg-[#d6ccc2] text-white font-black py-6 rounded-[2rem] soft-shadow active:scale-95 transition-all text-xl flex items-center justify-center gap-3 shadow-lg hover:bg-[#c4b5a6]"
                        >
                            Entry my ownly space
                        </Link>
                        <Link
                            to="/dashboard"
                            className="w-full bg-white text-[#8d7b6d] font-bold py-6 rounded-[2rem] border-2 border-[#f5ebe0] active:scale-95 transition-all text-base flex items-center justify-center gap-4 soft-shadow hover:bg-[#fdf8f2]"
                        >
                            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="google" />
                            Connect with Google
                        </Link>
                    </div>
                </div>

                <p className="text-center text-xs font-black uppercase tracking-[0.3em]">
                    <span className="text-[#d6ccc2]">New to Ownly? </span>
                    <Link to="/signup" className="text-[#8d7b6d] hover:text-[#4a3f35] transition-colors underline underline-offset-2">Join the fold</Link>
                </p>
            </div>
        </div>
    );
}
