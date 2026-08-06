export const GRADE_SCALES = {
    boulder: {
        'V-Scale': ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15'],
        'Font': ['4', '4+', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+', '7A', '7A+', '7B', '7B+', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C'],
    },
    rope: {
        'YDS': ['5.5', '5.6', '5.7', '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d', '5.11a', '5.11b', '5.11c', '5.11d', '5.12a', '5.12b', '5.12c', '5.12d', '5.13a', '5.13b', '5.13c', '5.13d'],
        'French': ['5', '5+', '6a', '6a+', '6b', '6b+', '6c', '6c+', '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a', '8a+', '8b', '8b+', '8c', '8c+'],
    }
} as const;

export type ProblemType = keyof typeof GRADE_SCALES;

// Finds which (type, scale) a single grade token belongs to by scanning
// GRADE_SCALES -- shared by ProblemEditForm's grade picker (which also needs
// from/to/isRange around this) and ProblemList's Type/Scale/Grade quick
// filters. Returns null for unrecognized/legacy tokens; callers decide their
// own fallback.
export function detectGradeScale(token: string): { type: ProblemType; scale: string } | null {
    for (const [ptype, scales] of Object.entries(GRADE_SCALES)) {
        for (const [scaleName, gradesArray] of Object.entries(scales as Record<string, readonly string[]>)) {
            if (gradesArray.includes(token)) {
                return { type: ptype as ProblemType, scale: scaleName };
            }
        }
    }
    return null;
}

export const circleButtonStyle = {
    background: '#141210',
    border: '1px solid #c87a30',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    transition: 'all 0.2s',
} as const;