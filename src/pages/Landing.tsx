import { api } from "../lib/api.js";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ProblemRow } from '../types/problem.js';
import ProblemDetails from '../components/ProblemDetails.js';

export default function Landing() {
    const [problems, setProblems] = useState<any[]>([]);
    const [selectedProblem, setSelectedProblem] = useState<ProblemRow | null>(null);

    useEffect(() => {
        async function fetchProblems() {
            const data = await api.get('/api/problems');
            if (data.error) {
                console.error("Error fetching problems:", data.error);
            } else {
                setProblems(data || []);
            }

        }
        fetchProblems();
    }, []);

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');
        .landing-wrap {
            height: 100vh; width: 100%;
            snap-type: y mandatory;
            overflow-y: scroll;
            scroll-behavior: smooth;
            background: #0f0d0b;
        }
        .problem-card {
            min-width: 240px;
            background: #141210;
            border: 1px solid #2a2420;
            border-radius: 16px;
            padding: 18px;
            transition: transform 0.2s, border-color 0.2s;
            cursor: pointer;
        }
        .problem-card:hover { transform: translateY(-4px); border-color: #c87a30; }
        .skeleton { background: #1a1612; border-radius: 6px; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2420; border-radius: 4px; }
    `}</style>

            <div className="landing-wrap">
                {/* Hero */}
                <section style={{
                    minHeight: '100vh', width: '100%', scrollSnapAlign: 'start',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '80px 24px 40px', textAlign: 'center',
                    boxSizing: 'border-box'
                }}>
                    <img
                        src="/favicon_transparent.png"
                        alt="Palabatu"
                        style={{
                            width: '96px',
                            height: '96px',
                            objectFit: 'contain',
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
                        marginBottom: '48px', transition: 'opacity 0.2s'
                    }}>Open Map</a>

                    <div style={{ width: '100%', maxWidth: '1100px' }}>
                        <h2 style={{
                            fontFamily: "'Playfair Display', serif",
                            fontSize: '20px', fontWeight: 700,
                            color: '#8a7060', marginBottom: '16px',
                            letterSpacing: '0.05em', textTransform: 'uppercase'
                        }}>Recently Added</h2>

                        <div style={{ overflowX: 'auto', display: 'flex', gap: '16px', paddingBottom: '8px', paddingTop: '4px' }}>
                            {problems.length > 0 ? [...problems].reverse().slice(0, 5).map(problem => (
                                <div
                                    key={problem.id}
                                    className="problem-card"
                                    onClick={() => setSelectedProblem(problem)}
                                    style={{ cursor: 'pointer' }} // Add pointer so users know it's clickable
                                >
                                    <h3 style={{
                                        fontFamily: "'Playfair Display', serif",
                                        fontSize: '16px', fontWeight: 700,
                                        color: '#f0e0c8', marginBottom: '6px'
                                    }}>{problem.name || 'Problem Name'}</h3>

                                    <p style={{ fontSize: '12px', color: '#6a5848', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
                                        {problem.location_name || 'Unknown Location'}
                                    </p>

                                    <span style={{
                                        fontSize: '11px', padding: '3px 10px',
                                        background: 'rgba(200,122,48,0.12)',
                                        border: '1px solid #c87a3040',
                                        color: '#c87a30', borderRadius: '20px',
                                        fontFamily: "'DM Sans', sans-serif"
                                    }}>{problem.grade || '—'}</span>

                                    {/* 2. Added by section with Link to Profile */}
                                    <div style={{
                                        marginTop: '12px',
                                        paddingTop: '10px',
                                        borderTop: '1px solid #2a2420',
                                        fontSize: '11px',
                                        color: '#6a5848'
                                    }}>
                                        Added by{' '}
                                        <Link
                                            to={`/profile/${problem.created_by}`}
                                            onClick={(e) => e.stopPropagation()} // 3. Stops the card click event!
                                            style={{ color: '#c87a30', textDecoration: 'none', fontWeight: 600 }}
                                        >
                                            @{problem.creator_name || 'unknown'}
                                        </Link>
                                    </div>
                                </div>
                            )) : [...Array(5)].map((_, i) => (
                                <div key={i} style={{ minWidth: '240px', background: '#141210', border: '1px solid #2a2420', borderRadius: '16px', padding: '18px' }}>
                                    <div className="skeleton" style={{ height: '18px', width: '70%', marginBottom: '10px' }} />
                                    <div className="skeleton" style={{ height: '13px', width: '50%', marginBottom: '10px' }} />
                                    <div className="skeleton" style={{ height: '22px', width: '30%', borderRadius: '20px' }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* About */}
                <section style={{
                    minHeight: '100vh', scrollSnapAlign: 'start',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '80px 24px 40px', textAlign: 'center',
                    boxSizing: 'border-box'
                }}>
                    <h1 style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 'clamp(36px, 7vw, 72px)',
                        fontWeight: 900, color: '#f0e0c8', marginBottom: '16px'
                    }}>about palabatu</h1>
                    <p style={{ fontSize: '16px', color: '#6a5848', maxWidth: '480px', lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif" }}>
                        Lorem Ipsum
                    </p>
                </section>

                {selectedProblem && (
                    <ProblemDetails
                        problem={selectedProblem}
                        // userTitles={userTitles} // Make sure you have userTitles in Landing, or pass an empty array [] if you don't need edit permissions here
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