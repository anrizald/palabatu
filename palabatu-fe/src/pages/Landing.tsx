import { api } from "../lib/api.js";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { ProblemRow } from '../types/problem.js';
import ProblemDetails from '../components/ProblemDetails.js';
import Toast from '../components/Toast.js';
import { useAuth } from '../lib/useAuth.js';

type Tab = 'nearYou' | 'hot' | 'recent';
type Geo = { lat: number; lng: number };
type CardItem = { problem: ProblemRow; badge: string; icon: 'pin' | 'flame' | 'clock' };

const CARD_LIMIT = 10;

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

function TabIcon({ icon }: { icon: CardItem['icon'] }) {
    if (icon === 'flame') return <FlameIcon />;
    if (icon === 'clock') return <ClockIcon />;
    return <PinIcon />;
}

function ProblemCard({ item, onSelect }: { item: CardItem; onSelect: (p: ProblemRow) => void }) {
    const { problem, badge, icon } = item;
    return (
        <div className="p-card" onClick={() => onSelect(problem)}>
            <h3 className="p-card-title">{problem.name || 'Problem Name'}</h3>
            <p className="p-card-loc">{problem.location_name || 'Unknown Location'}</p>
            <div className="p-card-row">
                <span className="p-card-grade">{problem.grade || '—'}</span>
                <span className="p-card-badge"><TabIcon icon={icon} />{badge}</span>
            </div>
            <div className="p-card-foot">
                Added by{' '}
                <Link
                    to={`/profile/${problem.creator_slug}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {problem.creator_name || 'unknown'}
                </Link>
            </div>
        </div>
    );
}

export default function Landing() {
    const { showToast, toast } = useAuth();
    const [problems, setProblems] = useState<ProblemRow[]>([]);
    const [climberCount, setClimberCount] = useState<number | null>(null);
    const [selectedProblem, setSelectedProblem] = useState<ProblemRow | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('hot');
    const [geo, setGeo] = useState<Geo | null>(null);
    const [locating, setLocating] = useState(false);

    useEffect(() => {
        async function fetchData() {
            const [problemsData, usersData] = await Promise.all([
                api.get('/api/problems'),
                api.get('/auth/users/count'),
            ]);
            if (problemsData.error) {
                console.error("Error fetching problems:", problemsData.error);
            } else {
                setProblems(problemsData || []);
            }
            if (typeof usersData?.count === 'number') {
                setClimberCount(usersData.count);
            }
        }
        fetchData();
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
                return { problem, badge: `${count} send${count === 1 ? '' : 's'}`, icon: 'flame' as const };
            })
    ), [problems]);

    const recentItems = useMemo<CardItem[]>(() => (
        [...problems]
            .filter(p => p.created_at)
            .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
            .slice(0, CARD_LIMIT)
            .map(problem => ({ problem, badge: formatRelativeTime(problem.created_at as string), icon: 'clock' as const }))
    ), [problems]);

    const nearYouItems = useMemo<CardItem[]>(() => {
        if (!geo) return [];
        return [...problems]
            .filter(p => p.latitude != null && p.longitude != null)
            .map(problem => ({ problem, distanceKm: haversineKm(geo, { lat: problem.latitude, lng: problem.longitude }) }))
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .slice(0, CARD_LIMIT)
            .map(({ problem, distanceKm }) => ({ problem, badge: formatDistance(distanceKm), icon: 'pin' as const }));
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

    return (
        <>
            {toast && <Toast {...toast} />}
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');

        .landing-wrap { width: 100%; background: #0f0d0b; }

        /* --- hero --- */
        .hero {
            position: relative;
            min-height: 100vh;
            min-height: 100dvh;
            width: 100%;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 100px 24px 56px;
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

        .scroll-cue { position: absolute; bottom: 64px; left: 50%; transform: translateX(-50%); color: #6a5848; z-index: 1; }
        .scroll-cue svg { width: 18px; height: 18px; animation: cue-bounce 2.2s ease-in-out infinite; }
        @keyframes cue-bounce {
            0%, 100% { transform: translateY(0); opacity: 0.5; }
            50% { transform: translateY(6px); opacity: 1; }
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
        .p-card {
            scroll-snap-align: start;
            min-width: 236px; max-width: 236px;
            background: #141210; border: 1px solid #2a2420; border-radius: 16px;
            padding: 18px; cursor: pointer;
            transition: transform 0.2s, border-color 0.2s;
        }
        .p-card:hover { transform: translateY(-4px); border-color: #c87a30; }
        .p-card-title { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: #f0e0c8; margin: 0 0 6px; }
        .p-card-loc { font-size: 12px; color: #6a5848; margin: 0 0 12px; font-family: 'DM Sans', sans-serif; }
        .p-card-row { display: flex; align-items: center; gap: 8px; }
        .p-card-grade {
            font-size: 11px; padding: 3px 10px;
            background: rgba(200,122,48,0.12); border: 1px solid #c87a3040;
            color: #c87a30; border-radius: 20px; font-family: 'DM Sans', sans-serif;
        }
        .p-card-badge { font-size: 11px; color: #8a7060; display: flex; align-items: center; gap: 4px; font-family: 'DM Sans', sans-serif; }
        .p-card-badge svg { width: 12px; height: 12px; }
        .p-card-foot { margin-top: 12px; padding-top: 10px; border-top: 1px solid #2a2420; font-size: 11px; color: #6a5848; font-family: 'DM Sans', sans-serif; }
        .p-card-foot a { color: #c87a30; text-decoration: none; font-weight: 600; }

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
        .about-features {
            display: flex;
            width: 100%;
            max-width: 720px;
            margin: 40px auto;
        }
        .about-feature {
            flex: 1;
            padding: 0 28px;
            border-left: 1px solid #2a2420;
        }
        .about-feature:first-child { border-left: none; padding-left: 0; }

        @media (max-width: 640px) {
            .about-features { flex-direction: column; margin: 32px auto; }
            .about-feature {
                border-left: none;
                border-top: 1px solid #2a2420;
                padding: 20px 0 0;
                margin-top: 20px;
            }
            .about-feature:first-child { border-top: none; padding-top: 0; margin-top: 0; }
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
                        ) : (
                            <div className="card-row">
                                {problems.length === 0
                                    ? [...Array(5)].map((_, i) => (
                                        <div key={i} className="p-card">
                                            <div className="skeleton" style={{ height: '18px', width: '70%', marginBottom: '10px' }} />
                                            <div className="skeleton" style={{ height: '13px', width: '50%', marginBottom: '10px' }} />
                                            <div className="skeleton" style={{ height: '22px', width: '30%', borderRadius: '20px' }} />
                                        </div>
                                    ))
                                    : activeItems.map(item => (
                                        <ProblemCard key={item.problem.id} item={item} onSelect={setSelectedProblem} />
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
                        <p style={{ fontSize: '16px', color: '#6a5848', maxWidth: '520px', lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif", margin: '0 auto' }}>
                            Palabatu started as a shared pin-drop between friends chasing sandstone and volcanic
                            boulders across Java. Now it's the map Indonesian climbers open first — find a spot,
                            see what's been climbed, and log your own sends on the rock you're actually pulling on.
                        </p>

                        <div className="about-features">
                            <div className="about-feature">
                                <h3 style={{
                                    fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 500,
                                    color: '#c87a30', letterSpacing: '0.08em', textTransform: 'uppercase',
                                    marginBottom: '8px'
                                }}>Spot Map</h3>
                                <p style={{ fontSize: '14px', color: '#8a7060', lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
                                    Real boulders at real coordinates, added by the climbers who found them.
                                </p>
                            </div>
                            <div className="about-feature">
                                <h3 style={{
                                    fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 500,
                                    color: '#c87a30', letterSpacing: '0.08em', textTransform: 'uppercase',
                                    marginBottom: '8px'
                                }}>Logbook</h3>
                                <p style={{ fontSize: '14px', color: '#8a7060', lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
                                    Track every problem you've sent, from your first V0 to your current project.
                                </p>
                            </div>
                            <div className="about-feature">
                                <h3 style={{
                                    fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 500,
                                    color: '#c87a30', letterSpacing: '0.08em', textTransform: 'uppercase',
                                    marginBottom: '8px'
                                }}>Crew</h3>
                                <p style={{ fontSize: '14px', color: '#8a7060', lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
                                    Follow climbers, see who's active at your local spot, build your name.
                                </p>
                            </div>
                        </div>

                        <p style={{ fontSize: '14px', color: '#6a5848', fontFamily: "'DM Sans', sans-serif" }}>
                            No gym membership, no gatekeeping — just the rock and the people who show up for it.{' '}
                            <Link to="/signup" style={{ color: '#c87a30', textDecoration: 'none', fontWeight: 600 }}>
                                Create your profile
                            </Link>
                        </p>
                    </div>
                </section>

                {selectedProblem && (
                    <ProblemDetails
                        problem={selectedProblem}
                        onClose={() => setSelectedProblem(null)}
                        onDelete={(id) => {
                            setProblems(prev => prev.filter(p => p.id !== id));
                            setSelectedProblem(null);
                        }}
                        onUpdate={(updatedItem) => {
                            setProblems(prev => prev.map(p => p.id === updatedItem.id ? updatedItem : p));
                        }}
                    />
                )}
            </div>
        </>
    )
}
