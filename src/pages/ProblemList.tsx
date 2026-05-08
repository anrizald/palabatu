import { api } from '../lib/api.js';
import Header from '../components/Header.js';
import { useState, useEffect, useMemo } from 'react';
import ProblemDetails from '../components/ProblemDetails.js';

type ProblemRow = {
    id: string | number;
    name: string;
    location_name: string;
    latitude: number;
    longitude: number;
    grade: string;
    creator_name: string;
    created_by: string;
};

export function ProblemList() {
    const [problems, setProblems] = useState<ProblemRow[]>([]);
    const [search, setSearch] = useState('');
    const [selectedGrade, setSelectedGrade] = useState('All');
    const [selectedProblem, setSelectedProblem] = useState<ProblemRow | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchProblems() {
            const data = await api.get('/api/problems');
            if (!data.error) setProblems(data as ProblemRow[]);
            setIsLoading(false);
        }
        fetchProblems();
    }, []);

    // Extract unique grades for our filter dropdown
    const availableGrades = useMemo(() => {
        const grades = new Set(problems.map(p => p.grade));
        return ['All', ...Array.from(grades).sort()];
    }, [problems]);

    // Filter problems based on search and grade
    const filteredProblems = useMemo(() => {
        return problems.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.location_name.toLowerCase().includes(search.toLowerCase());
            const matchesGrade = selectedGrade === 'All' || p.grade === selectedGrade;
            return matchesSearch && matchesGrade;
        });
    }, [problems, search, selectedGrade]);

    return (
        <div style={{ minHeight: '100vh', background: '#0f0d0b', color: '#f0e0c8', fontFamily: "'DM Sans', sans-serif", paddingBottom: '48px' }}>
            <Header />

            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '100px 24px 40px' }}>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', marginBottom: '8px' }}>Directory</h1>
                <p style={{ color: '#8a7060', marginBottom: '24px' }}>Search and filter all problems in Palabatu.</p>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        placeholder="Search by name or location..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ flex: 1, minWidth: '200px', padding: '12px 16px', background: '#141210', border: '1px solid #2a2420', borderRadius: '12px', color: '#fff', outline: 'none' }}
                    />
                    <select
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        style={{ padding: '12px 16px', background: '#141210', border: '1px solid #2a2420', borderRadius: '12px', color: '#fff', outline: 'none', cursor: 'pointer' }}
                    >
                        {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>

                {/* List */}
                {isLoading ? (
                    <div style={{ color: '#8a7060', textAlign: 'center', padding: '40px' }}>Loading...</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filteredProblems.map(problem => (
                            <div
                                key={problem.id}
                                onClick={() => setSelectedProblem(problem)}
                                style={{
                                    background: '#141210', border: '1px solid #2a2420', borderRadius: '16px', padding: '16px 20px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                                    transition: 'border-color 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = '#c87a30'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2420'}
                            >
                                <div>
                                    <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', margin: '0 0 4px 0' }}>{problem.name}</h3>
                                    <div style={{ fontSize: '12px', color: '#6a5848' }}>📍 {problem.location_name}</div>
                                </div>
                                <span style={{ background: 'rgba(200,122,48,0.15)', color: '#c87a30', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
                                    {problem.grade}
                                </span>
                            </div>
                        ))}
                        {filteredProblems.length === 0 && (
                            <div style={{ color: '#8a7060', textAlign: 'center', padding: '40px' }}>No problems found.</div>
                        )}
                    </div>
                )}
            </div>

            {/* Reuse the ProblemDetails modal! */}
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
    );
}