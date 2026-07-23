import { MapPin } from 'lucide-react'
import type { ProblemRow } from '../types/problem.js'

type Props = {
    items: ProblemRow[]
    onSelect: (item: ProblemRow) => void
}

export default function ClusterCardRail({ items, onSelect }: Props) {
    return (
        <div
            style={{
                display: 'flex',
                gap: '10px',
                overflowX: 'auto',
                scrollSnapType: 'x proximity',
                WebkitOverflowScrolling: 'touch',
                padding: '2px 2px 6px',
            }}
        >
            {items.map(item => (
                <button
                    key={item.id}
                    onClick={() => onSelect(item)}
                    style={{
                        scrollSnapAlign: 'start',
                        flex: '0 0 auto',
                        width: '150px',
                        display: 'flex',
                        flexDirection: 'column',
                        textAlign: 'left',
                        background: '#1a1612',
                        border: '1px solid #2a2420',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        padding: 0,
                        fontFamily: "'DM Sans', sans-serif",
                    }}
                >
                    <div style={{ width: '100%', height: '84px', background: '#141210', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.image_urls?.[0] ? (
                            <img
                                src={item.image_urls[0]}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                        ) : (
                            <MapPin size={20} color="#5a4c40" style={{ flexShrink: 0 }} />
                        )}
                    </div>
                    <div style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            <strong
                                style={{
                                    fontFamily: "'Playfair Display', serif",
                                    fontSize: '13px',
                                    color: '#f0e0c8',
                                    lineHeight: 1.2,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {item.name}
                            </strong>
                            <span
                                style={{
                                    background: 'rgba(200,122,48,0.15)',
                                    color: '#c87a30',
                                    border: '1px solid #c87a3040',
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    flexShrink: 0,
                                }}
                            >
                                {item.grade}
                            </span>
                        </div>
                        <div
                            style={{
                                fontSize: '11px',
                                color: '#8a7060',
                                marginTop: '4px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {item.location_name}
                        </div>
                    </div>
                </button>
            ))}
        </div>
    )
}
