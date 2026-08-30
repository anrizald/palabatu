import { api } from "../lib/api.js";
import { enrichProblems } from "../lib/cragCache.js";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Compass, Flame, Clock } from 'lucide-react';
import type { ProblemListItem, EnrichedProblem } from '../types/problem.js';
import { ProblemCard, type FooterStat } from '../components/ProblemCard.js';
import Toast from '../components/Toast.js';
import FeedbackModal from '../components/FeedbackModal.js';
import { useAuth } from '../lib/useAuth.js';
import type { CountResponse, ErrorResponse } from '../types/apitypes.js';
import type { FeedbackType } from '../types/feedback.js';

type Tab = 'nearYou' | 'hot' | 'recent';
type Geo = { lat: number; lng: number };
type CardItem = { problem: EnrichedProblem; footerStat: FooterStat };

const CARD_LIMIT = 10;

// placeholder — replace once a real invite exists
const DISCORD_SUPPORT_URL = 'https://discord.gg/palabatu';

// placeholder — replace with real donation URLs
const SAWERIA_URL = 'https://saweria.co/ghuldev';
const KOFI_URL = 'https://ko-fi.com/ghulaman';

const GITHUB_REPO_URL = 'https://github.com/anrizald/palabatu';
const INSTAGRAM_URL = 'https://instagram.com/palbat.id';

const labelStyle = {
    fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 500,
    color: '#c87a30', letterSpacing: '0.08em', textTransform: 'uppercase',
    margin: '0 0 8px',
} as const;

const bodyStyle = {
    fontSize: '14px', color: '#8a7060', lineHeight: 1.6,
    fontFamily: "'DM Sans', sans-serif", margin: 0,
} as const;

function haversineKm(a: Geo, b: Geo) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2
        + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
}

function formatDistance(km: number) {
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function formatRelativeTime(dateStr: string) {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    const months = Math.floor(days / 30);
    return months <= 1 ? '1 month ago' : `${months} months ago`;
}

function PinIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" strokeLinejoin="round" />
            <circle cx="12" cy="9" r="2.4" />
        </svg>
    );
}

function FlameIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M12 2c1 3-2 4-2 7a3 3 0 006 0c1.2 1 2 2.8 2 4.5a6 6 0 11-12 0C6 9 9 7 12 2z" strokeLinejoin="round" />
        </svg>
    );
}

function ClockIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.5 2" strokeLinecap="round" />
        </svg>
    );
}

function GithubIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.48 0-.24-.01-1.02-.01-1.85-2.78.61-3.37-1.19-3.37-1.19-.45-1.16-1.11-1.47-1.11-1.47-.91-.63.07-.62.07-.62 1 .07 1.53 1.04 1.53 1.04.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.56-1.13-4.56-5.02 0-1.11.39-2.02 1.03-2.73-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.04a9.4 9.4 0 0 1 5 0c1.91-1.31 2.75-1.04 2.75-1.04.55 1.41.2 2.45.1 2.71.64.71 1.03 1.62 1.03 2.73 0 3.9-2.34 4.76-4.57 5.01.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.58.69.48A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
        </svg>
    );
}

function DiscordIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.32 5.36A17.5 17.5 0 0 0 15.9 4c-.2.36-.44.84-.6 1.22a16.2 16.2 0 0 0-4.6 0A11 11 0 0 0 10.1 4a17.6 17.6 0 0 0-4.42 1.36C2.6 9.2 1.85 12.95 2.12 16.64a17.6 17.6 0 0 0 5.36 2.72c.43-.59.82-1.22 1.15-1.88-.63-.24-1.23-.53-1.8-.88.15-.11.3-.23.44-.35a12.6 12.6 0 0 0 10.46 0c.14.12.29.24.44.35-.57.35-1.17.64-1.8.88.33.66.72 1.29 1.15 1.88a17.5 17.5 0 0 0 5.36-2.72c.32-4.28-.68-8-2.6-11.28ZM9.68 14.1c-.86 0-1.56-.8-1.56-1.77 0-.98.68-1.78 1.56-1.78.89 0 1.58.81 1.56 1.78 0 .98-.68 1.77-1.56 1.77Zm4.65 0c-.86 0-1.56-.8-1.56-1.77 0-.98.69-1.78 1.56-1.78.89 0 1.58.81 1.56 1.78 0 .98-.67 1.77-1.56 1.77Z" />
        </svg>
    );
}

function InstagramIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4.2" />
            <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
        </svg>
    );
}

export default function Landing() {
    const { user, showToast, toast } = useAuth();
    const navigate = useNavigate();
    const [problems, setProblems] = useState<EnrichedProblem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [climberCount, setClimberCount] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('hot');
    const [geo, setGeo] = useState<Geo | null>(null);
    const [locating, setLocating] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const [problemsData, usersData] = await Promise.all([
                    api.get<ProblemListItem[] | ErrorResponse>('/api/problems'),
                    api.get<Partial<CountResponse>>('/auth/users/count'),
                ]);
                if ('error' in problemsData) {
                    console.error("Error fetching problems:", problemsData.error);
                } else {
                    setProblems(await enrichProblems(problemsData || []));
                }
                if (typeof usersData?.count === 'number') {
                    setClimberCount(usersData.count);
                }
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    useEffect(() => {
        if (window.location.hash === '#support') {
            document.getElementById('support')?.scrollIntoView();
        }
    }, []);

    const totalSends = useMemo(
        () => problems.reduce((sum, p) => sum + (p.send_count ?? 0), 0),
        [problems]
    );

    const hotItems = useMemo<CardItem[]>(() => (
        [...problems]
            .sort((a, b) => (b.send_count ?? 0) - (a.send_count ?? 0))
            .slice(0, CARD_LIMIT)
            .map(problem => {
                const count = problem.send_count ?? 0;
                return { problem, footerStat: { icon: Flame, label: `${count} send${count === 1 ? '' : 's'}` } };
            })
    ), [problems]);

    const recentItems = useMemo<CardItem[]>(() => (
        [...problems]
            .filter(p => p.created_at)
            .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
            .slice(0, CARD_LIMIT)
            .map(problem => ({ problem, footerStat: { icon: Clock, label: formatRelativeTime(problem.created_at as string) } }))
    ), [problems]);

    const nearYouItems = useMemo<CardItem[]>(() => {
        if (!geo) return [];
        return [...problems]
            .filter(p => p.mapLat != null && p.mapLng != null)
            .map(problem => ({ problem, distanceKm: haversineKm(geo, { lat: problem.mapLat!, lng: problem.mapLng! }) }))
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .slice(0, CARD_LIMIT)
            .map(({ problem, distanceKm }) => ({ problem, footerStat: { icon: Compass, label: formatDistance(distanceKm) } }));
    }, [problems, geo]);

    const activeItems = activeTab === 'hot' ? hotItems : activeTab === 'recent' ? recentItems : nearYouItems;

    const handleUseLocation = () => {
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocating(false);
            },
            () => {
                showToast("Could not get your location. Check your browser's location permissions.", 'error');
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const submitFeedback = async ({ type, message, email }: { type: FeedbackType; message: string; email: string }) => {
        setIsSubmittingFeedback(true);
        try {
            const res = await api.post<Partial<ErrorResponse>>('/api/feedback', { type, message, email, page_url: window.location.pathname });
            if (res.error) {
                showToast(`Error: ${res.error}`, 'error');
            } else {
                setIsFeedbackOpen(false);
                showToast('Thanks for the feedback!');
            }
        } catch (e) {
            console.error('Feedback submission failed', e);
            showToast('Failed to send feedback. Check your connection.', 'error');
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    return (
        <>
            {toast && <Toast {...toast} />}
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');

        .landing-wrap { width: 100%; background: #0f0d0b; }

        /* --- hero --- */
        .hero {
            position: relative;
            /* the shell already holds back the header/footer strips, so a
               full-bleed hero is exactly the space left between them */
            min-height: var(--content-h);
            width: 100%;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 40px 24px 40px;
            text-align: center;
            box-sizing: border-box;
            overflow: hidden;
        }
        .hero-topo { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
        .hero-content { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; }
        .hero-content > * { opacity: 0; animation: rise-in 0.6s ease forwards; }
        .hero-content > *:nth-child(1) { animation-delay: 0.05s; }
        .hero-content > *:nth-child(2) { animation-delay: 0.15s; }
        .hero-content > *:nth-child(3) { animation-delay: 0.25s; }
        .hero-content > *:nth-child(4) { animation-delay: 0.35s; }
        .hero-content > *:nth-child(5) { animation-delay: 0.45s; }
        @keyframes rise-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .hero-stats {
            display: flex; align-items: center; gap: 14px;
            margin-top: 28px;
            font-size: 12px; color: #8a7060;
            letter-spacing: 0.03em;
            font-family: 'DM Sans', sans-serif;
        }
        .hero-stats b { color: #f0e0c8; font-weight: 600; }
        .hero-stats .dot { width: 3px; height: 3px; border-radius: 50%; background: #2a2420; }

        .scroll-cue { position: absolute; bottom: 88px; left: 50%; transform: translateX(-50%); color: #6a5848; z-index: 1; }
        .scroll-cue svg { width: 28px; height: 28px; animation: cue-bounce 2.2s ease-in-out infinite; }
        @keyframes cue-bounce {
            0%, 100% { transform: translateY(0); opacity: 0.5; }
            50% { transform: translateY(9px); opacity: 1; }
        }

        .route-line {
            fill: none; stroke: #c87a30; stroke-width: 2.2; stroke-linecap: round;
            stroke-dasharray: 1; stroke-dashoffset: 1;
            animation: draw-route 1.8s 0.3s cubic-bezier(.4,0,.2,1) forwards;
        }
        .route-dot { opacity: 0; animation: dot-in 0.5s 2s ease forwards; }
        @keyframes draw-route { to { stroke-dashoffset: 0; } }
        @keyframes dot-in { to { opacity: 1; } }

        @media (prefers-reduced-motion: reduce) {
            .scroll-cue svg { animation: none; }
            .route-line { animation: none; stroke-dashoffset: 0; }
            .route-dot { animation: none; opacity: 1; }
            .hero-content > * { animation: none; opacity: 1; }
        }

        /* --- sections --- */
        .section { padding: 88px 24px; }
        .section-inner { max-width: 1100px; margin: 0 auto; }
        .eyebrow {
            font-family: 'DM Sans', sans-serif;
            font-size: 12px; font-weight: 600; color: #8a7060;
            letter-spacing: 0.12em; text-transform: uppercase;
            margin: 0 0 18px;
        }

        /* --- explore tabs --- */
        .explore-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
        .tabs { display: inline-flex; gap: 2px; background: #141210; border: 1px solid #2a2420; border-radius: 10px; padding: 3px; }
        .tab {
            border: none; background: none; cursor: pointer;
            padding: 7px 16px; font-size: 13px; color: #8a7060;
            border-radius: 7px; display: flex; align-items: center; gap: 6px;
            font-family: 'DM Sans', sans-serif;
            transition: color 0.15s, background 0.15s;
        }
        .tab svg { width: 14px; height: 14px; }
        .tab[aria-selected="true"] { background: linear-gradient(145deg, #c87a30, #8b4a18); color: #fef3e6; }

        /* --- cards --- */
        .card-row { display: flex; gap: 16px; overflow-x: auto; padding: 4px 4px 12px; scroll-snap-type: x proximity; }
        /* Loading placeholder only -- the real cards are the shared
           components/ProblemCard.tsx, styled via Tailwind theme tokens. */
        .p-card-skeleton {
            min-width: 236px; max-width: 236px;
            background: #141210; border: 1px solid #2a2420; border-radius: 16px;
            padding: 18px;
        }

        .locked-card {
            background: #141210; border: 1px dashed #2a2420; border-radius: 16px;
            padding: 32px 24px; display: flex; flex-direction: column; align-items: center;
            text-align: center; gap: 12px;
        }
        .locked-card svg { width: 26px; height: 26px; color: #6a5848; }
        .locked-card p { margin: 0; font-size: 13px; color: #8a7060; max-width: 320px; font-family: 'DM Sans', sans-serif; }
        .locked-btn {
            border: 1px solid #c87a30; color: #c87a30; background: none;
            padding: 8px 18px; border-radius: 9px; font-size: 13px; cursor: pointer;
            font-family: 'DM Sans', sans-serif;
        }
        .locked-btn:hover { background: rgba(200,122,48,0.1); }
        .locked-btn:disabled { opacity: 0.6; cursor: default; }

        .skeleton { background: #1a1612; border-radius: 6px; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }

        /* --- about --- */
        .about { text-align: center; }
        .mission { max-width: 640px; margin: 44px auto 0; }
        .mission p {
            font-size: 15px; color: #8a7060; line-height: 1.7;
            font-family: 'DM Sans', sans-serif; margin: 0 0 12px;
        }
        .mission p:last-child { margin-bottom: 0; }
        .mission .mission-line {
            font-family: 'Playfair Display', serif;
            font-size: clamp(21px, 3vw, 30px);
            font-weight: 700; color: #f0e0c8; line-height: 1.4;
            margin: 0 0 20px;
        }

        /* two panels: vision | support */
        .about-split {
            display: flex; gap: 22px; align-items: flex-start;
            text-align: left; max-width: 900px; margin: 48px auto 0;
        }
        .about-panel {
            flex: 1; min-width: 0;
            background: #141210; border: 1px solid #2a2420;
            border-radius: 16px; padding: 26px 24px;
        }
        #support { scroll-margin-top: 80px; }
        .about-feature { border-top: 1px solid #2a2420; padding-top: 20px; margin-top: 20px; }
        .about-feature:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
        .pat-lane { border-top: 1px solid #2a2420; padding-top: 18px; margin-top: 18px; }
        .pat-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 13px; }
        .pat-link {
            font-size: 12px; color: #c87a30; text-decoration: none;
            background: rgba(200,122,48,0.12); border: 1px solid #c87a3040;
            border-radius: 20px; padding: 6px 13px;
            font-family: 'DM Sans', sans-serif;
            transition: background 0.15s, border-color 0.15s;
        }
        .pat-link:hover { background: rgba(200,122,48,0.22); border-color: #c87a30; }
        .pat-icons { display: flex; gap: 10px; margin-top: 14px; }
        .pat-icon-link {
            display: inline-flex; align-items: center; justify-content: center;
            width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
            border: 1px solid #c87a30; color: #c87a30;
            transition: background 0.15s;
        }
        .pat-icon-link svg { width: 18px; height: 18px; flex-shrink: 0; }
        .pat-icon-link:hover { background: rgba(200,122,48,0.12); }
        .pat-link:focus-visible, .pat-icon-link:focus-visible { outline: 2px solid #c87a30; outline-offset: 2px; }

        @media (max-width: 640px) {
            .mission { margin-top: 36px; }
            .about-split { flex-direction: column; gap: 20px; margin: 36px auto 0; }
            .about-panel { width: 100%; box-sizing: border-box; }
            .section { padding: 64px 20px; }
            .explore-head { flex-direction: column; align-items: flex-start; }
        }

        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2420; border-radius: 4px; }
    `}</style>

            <div className="landing-wrap">
                {/* Hero */}
                <section className="hero">
                    <svg className="hero-topo" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                        <g fill="none" stroke="#f0e0c8" strokeWidth={1.1}>
                            <path opacity="0.05" d="M780,140 C920,120 1040,220 1030,340 C1020,460 900,540 770,520 C640,500 560,400 580,290 C598,192 660,155 780,140 Z" />
                            <path opacity="0.06" transform="translate(600,400) scale(0.8) translate(-600,-400)" d="M780,140 C920,120 1040,220 1030,340 C1020,460 900,540 770,520 C640,500 560,400 580,290 C598,192 660,155 780,140 Z" />
                            <path opacity="0.07" transform="translate(600,400) scale(0.6) translate(-600,-400)" d="M780,140 C920,120 1040,220 1030,340 C1020,460 900,540 770,520 C640,500 560,400 580,290 C598,192 660,155 780,140 Z" />
                            <path opacity="0.08" transform="translate(600,400) scale(0.4) translate(-600,-400)" d="M780,140 C920,120 1040,220 1030,340 C1020,460 900,540 770,520 C640,500 560,400 580,290 C598,192 660,155 780,140 Z" />
                            <path opacity="0.09" transform="translate(600,400) scale(0.22) translate(-600,-400)" d="M780,140 C920,120 1040,220 1030,340 C1020,460 900,540 770,520 C640,500 560,400 580,290 C598,192 660,155 780,140 Z" />
                        </g>
                        <path className="route-line" pathLength={1} strokeLinejoin="round"
                            d="M120,650 C220,600 260,520 240,460 C220,395 300,380 340,320 C380,258 470,300 520,240 C560,190 640,210 690,165" />
                        <circle className="route-dot" cx="690" cy="165" r="6" fill="#c87a30" />
                        <circle className="route-dot" cx="120" cy="650" r="4" fill="#c87a30" opacity={0.6} />
                    </svg>

                    <div className="hero-content">
                        <img
                            src="/favicon_transparent.png"
                            alt="Palabatu"
                            style={{
                                width: '80px', height: '80px', objectFit: 'contain',
                                marginBottom: '16px',
                                filter: 'drop-shadow(0 4px 8px rgba(200,122,48,0.4))'
                            }}
                        />
                        <p style={{
                            fontFamily: "'Playfair Display', serif",
                            fontSize: 'clamp(32px, 6vw, 64px)',
                            fontWeight: 900, color: '#f0e0c8',
                            marginBottom: '8px', letterSpacing: '-0.01em'
                        }}>kuat, pinter, boleh</p>
                        <p style={{ fontSize: '15px', color: '#6a5848', marginBottom: '32px', fontFamily: "'DM Sans', sans-serif" }}>
                            Indonesia's bouldering community
                        </p>
                        <a href="/map" style={{
                            padding: '12px 28px',
                            background: 'linear-gradient(145deg, #c87a30, #8b4a18)',
                            color: '#fef3e6', borderRadius: '12px',
                            textDecoration: 'none', fontFamily: "'DM Sans', sans-serif",
                            fontSize: '14px', fontWeight: 500,
                            boxShadow: '0 2px 16px rgba(200,122,48,0.35)',
                        }}>Open Map</a>

                        <div className="hero-stats">
                            <span><b>{problems.length}</b> spots</span>
                            <span className="dot" />
                            <span><b>{totalSends}</b> sends logged</span>
                            <span className="dot" />
                            <span><b>{climberCount ?? '—'}</b> climbers</span>
                        </div>
                    </div>

                    <div className="scroll-cue" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </section>

                {/* Explore */}
                <section className="section">
                    <div className="section-inner">
                        <p className="eyebrow">Explore problems</p>
                        <div className="explore-head">
                            <div className="tabs" role="tablist" aria-label="Explore problems by">
                                <button className="tab" role="tab" aria-selected={activeTab === 'nearYou'} onClick={() => setActiveTab('nearYou')}>
                                    <PinIcon /> Near You
                                </button>
                                <button className="tab" role="tab" aria-selected={activeTab === 'hot'} onClick={() => setActiveTab('hot')}>
                                    <FlameIcon /> Hot
                                </button>
                                <button className="tab" role="tab" aria-selected={activeTab === 'recent'} onClick={() => setActiveTab('recent')}>
                                    <ClockIcon /> Recent
                                </button>
                            </div>
                        </div>

                        {activeTab === 'nearYou' && !geo ? (
                            <div className="locked-card">
                                <PinIcon />
                                <p>Turn on location to see what problems are within reach.</p>
                                <button className="locked-btn" onClick={handleUseLocation} disabled={locating}>
                                    {locating ? 'Locating...' : 'Use my location'}
                                </button>
                            </div>
                        ) : isLoading ? (
                            <div className="card-row">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="p-card-skeleton">
                                        <div className="skeleton" style={{ height: '18px', width: '70%', marginBottom: '10px' }} />
                                        <div className="skeleton" style={{ height: '13px', width: '50%', marginBottom: '10px' }} />
                                        <div className="skeleton" style={{ height: '22px', width: '30%', borderRadius: '20px' }} />
                                    </div>
                                ))}
                            </div>
                        ) : problems.length === 0 ? (
                            <div className="locked-card">
                                <PinIcon />
                                <p>No problems added yet. Be the first to map one.</p>
                                <Link to="/map" className="locked-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
                                    Add a problem
                                </Link>
                            </div>
                        ) : (
                            <div className="card-row">
                                {activeItems.map(item => (
                                    <ProblemCard
                                        key={item.problem.id}
                                        problem={item.problem}
                                        navigate={navigate}
                                        footerStat={item.footerStat}
                                        className="shrink-0 w-[236px] snap-start"
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* About */}
                <section className="section about">
                    <div className="section-inner">
                        <h1 style={{
                            fontFamily: "'Playfair Display', serif",
                            fontSize: 'clamp(36px, 7vw, 72px)',
                            fontWeight: 900, color: '#f0e0c8', marginBottom: '16px'
                        }}>about palabatu</h1>
                        <div className="mission">
                            <p className="mission-line">
                                From Sabang to Merauke.<br />All of it awaits.
                            </p>
                            <p>
                                Every wall worth pulling on from Sumatra to Papua, mapped well enough that
                                anybody can find it, climb it, and leave their mark on palabatu.
                            </p>
                            <p>
                                And numbers are leverage. A scattered community gets ignored when someone
                                decides a limestone crag is worth more as gravel. A big one doesn't.
                            </p>
                        </div>

                        <p style={{ fontSize: '14px', color: '#6a5848', fontFamily: "'DM Sans', sans-serif", margin: '28px 0 0' }}>
                            Anyone can add a boulder. Anyone can log a send.<br />
                            Join the cause —{' '}
                            <Link to="/signup" style={{ color: '#c87a30', textDecoration: 'none', fontWeight: 600 }}>
                                Create your profile
                            </Link>
                        </p>

                        <div className="about-split">
                            <div className="about-panel">
                                <p className="eyebrow" style={{ margin: '0 0 6px' }}>Roadmap</p>
                                <h3 style={{
                                    fontFamily: "'Playfair Display', serif", fontSize: '27px',
                                    fontWeight: 700, color: '#f0e0c8', margin: '0 0 4px'
                                }}>visi</h3>
                                <p style={{ fontSize: '13px', color: '#8a7060', fontFamily: "'DM Sans', sans-serif", margin: '0 0 15px' }}>
                                    planned incoming features
                                </p>
                                <div className="about-feature">
                                    <h3 style={labelStyle}>Spot Map</h3>
                                    <p style={bodyStyle}>
                                        Real boulders at real coordinates, added by the people who found them.
                                    </p>
                                </div>
                                <div className="about-feature">
                                    <h3 style={labelStyle}>Logbook</h3>
                                    <p style={bodyStyle}>
                                        Every problem you've sent, from your first V0 to the one you're still
                                        failing on.
                                    </p>
                                </div>
                                <div className="about-feature">
                                    <h3 style={labelStyle}>Crew</h3>
                                    <p style={bodyStyle}>
                                        See who else climbs your local spot, and what they've been getting on.
                                    </p>
                                </div>
                                <div className="about-feature">
                                    <h3 style={labelStyle}>Monsoon Tracker</h3>
                                    <p style={bodyStyle}>
                                        Rain radar for your local crag. Don't climb when the sun isn't out.
                                    </p>
                                </div>
                                <p style={{ fontSize: '13px', color: '#8a7060', fontFamily: "'DM Sans', sans-serif", margin: '20px 0 0' }}>
                                    Have a cool suggestion?{' '}
                                    <button
                                        onClick={() => setIsFeedbackOpen(true)}
                                        style={{
                                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                            color: '#c87a30', fontWeight: 600,
                                            fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
                                        }}
                                    >
                                        Feedback
                                    </button>
                                </p>
                            </div>

                            <div className="about-panel" id="support">
                                <p className="eyebrow" style={{ margin: '0 0 6px' }}>Support</p>
                                <h3 style={{
                                    fontFamily: "'Playfair Display', serif", fontSize: '27px',
                                    fontWeight: 700, color: '#f0e0c8', margin: '0 0 4px'
                                }}>patungan / bantuin</h3>
                                <p style={{ fontSize: '13px', color: '#8a7060', fontFamily: "'DM Sans', sans-serif", margin: '0 0 15px' }}>
                                    everyone throws in what they've got
                                </p>
                                <p style={bodyStyle}>
                                    Hosting, image storage, and the domain cost money every month.
                                </p>

                                <div className="pat-lane">
                                    <h4 style={labelStyle}>Duit</h4>
                                    <p style={bodyStyle}>
                                        Goes to servers, storage, and the domain. That's the entire list.
                                    </p>
                                    <div className="pat-links">
                                        <a href={SAWERIA_URL} target="_blank" rel="noopener noreferrer" className="pat-link">
                                            Saweria (IDR)
                                        </a>
                                        <a href={KOFI_URL} target="_blank" rel="noopener noreferrer" className="pat-link">
                                            Ko-fi (USD)
                                        </a>
                                    </div>
                                </div>

                                <div className="pat-lane">
                                    <h4 style={labelStyle}>Tenaga</h4>
                                    <p style={bodyStyle}>
                                        Devs, illustrators, writers, translators — or anyone who knows a crag
                                        well enough to fix what we got wrong.
                                    </p>
                                    <div className="pat-icons">
                                        {/* <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="pat-icon-link" aria-label="Palabatu on GitHub">
                                            <GithubIcon />
                                        </a> */}
                                        <a href={DISCORD_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="pat-icon-link" aria-label="Join the Discord">
                                            <DiscordIcon />
                                        </a>
                                        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="pat-icon-link" aria-label="Palabatu on Instagram">
                                            <InstagramIcon />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {isFeedbackOpen && (
                    <FeedbackModal
                        onClose={() => setIsFeedbackOpen(false)}
                        onSubmit={submitFeedback}
                        isSubmitting={isSubmittingFeedback}
                        showEmailField={!user}
                    />
                )}
            </div>
        </>
    )
}
