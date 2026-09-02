import L from 'leaflet'
import { ChevronLeft, ChevronRight, Compass, Layers } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '../lib/useIsMobile.js'
import type { CragListItem } from '../types/crag.js'

// Rail of nearby crags shown when several crag pins cluster together at low
// zoom (handoff.md decision 3: one pin per crag -- boulders/problems don't
// cluster on the map at all, so there's nothing to fetch a thumbnail for
// here; crags have no photo of their own, only boulders do).
type Props = {
    items: CragListItem[]
    onSelect: (item: CragListItem) => void
}

const CARD_WIDTH = 160
const GAP = 12

export default function ClusterCardRail({ items, onSelect }: Props) {
    const railRef = useRef<HTMLDivElement>(null)
    const cardRefs = useRef<(HTMLButtonElement | null)[]>([])
    const [activeIndex, setActiveIndex] = useState(0)
    const isMobile = useIsMobile()

    // Leaflet's map listens for drag-start (mousedown/touchstart) on the whole
    // container, including anything rendered on top of it. Without stopping
    // propagation here, swiping this rail also starts a map pan underneath it.
    useEffect(() => {
        const el = railRef.current
        if (!el) return
        L.DomEvent.disableClickPropagation(el)
        L.DomEvent.disableScrollPropagation(el)
    }, [])

    const handleScroll = () => {
        const el = railRef.current
        if (!el) return
        // Near the trailing edge, the remaining scroll room can be shorter than
        // one full card + gap (nothing left to scroll past), so scrollLeft never
        // reaches lastIndex * (CARD_WIDTH + GAP) and the division below would
        // undershoot. Detect "scrolled to the end" explicitly instead.
        const maxScrollLeft = el.scrollWidth - el.clientWidth
        if (el.scrollLeft >= maxScrollLeft - 1) {
            setActiveIndex(items.length - 1)
            return
        }
        const idx = Math.round(el.scrollLeft / (CARD_WIDTH + GAP))
        setActiveIndex(Math.max(0, Math.min(items.length - 1, idx)))
    }

    const selectAdjacent = (dir: 1 | -1) => {
        const next = Math.max(0, Math.min(items.length - 1, activeIndex + dir))
        setActiveIndex(next)
        // Moves the selection first; the rail only scrolls as far as needed
        // to bring that card fully into view (nothing, if it's already visible).
        cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
    }

    const showArrows = !isMobile && items.length > 1

    return (
        <div style={{ padding: '4px 2px 2px' }}>
            <div style={{ position: 'relative' }}>
                <div
                    ref={railRef}
                    onScroll={handleScroll}
                    style={{
                        display: 'flex',
                        gap: `${GAP}px`,
                        overflowX: 'auto',
                        scrollSnapType: 'x mandatory',
                        WebkitOverflowScrolling: 'touch',
                        padding: '4px 2px 10px',
                        maskImage: 'linear-gradient(to right, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)',
                    }}
                >
                    {items.map((item, i) => {
                        const isActive = items.length <= 1 || i === activeIndex
                        const isEmpty = item.problem_count === 0
                        return (
                            <button
                                key={item.id}
                                ref={el => { cardRefs.current[i] = el }}
                                onClick={() => onSelect(item)}
                                style={{
                                    scrollSnapAlign: 'start',
                                    flex: '0 0 auto',
                                    width: `${CARD_WIDTH}px`,
                                    display: 'block',
                                    textAlign: 'left',
                                    background: 'none',
                                    border: 'none',
                                    borderRadius: '14px',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    padding: 0,
                                    fontFamily: "'DM Sans', sans-serif",
                                    opacity: isActive ? (isEmpty ? 0.7 : 1) : 0.55,
                                    transform: isActive ? 'translateY(-2px)' : 'none',
                                    boxShadow: isActive
                                        ? '0 8px 18px rgba(0,0,0,0.45), 0 0 0 2px rgba(200,122,48,0.55)'
                                        : '0 2px 6px rgba(0,0,0,0.35), 0 0 0 1px #2a2420',
                                    transition: 'opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
                                    WebkitTapHighlightColor: 'transparent',
                                }}
                            >
                                <div style={{ position: 'relative', width: '100%', height: '104px', background: 'linear-gradient(135deg, #23201b, #171410)' }}>
                                    <Compass
                                        size={20}
                                        color="#4a3f35"
                                        style={{ position: 'absolute', left: '12px', top: '12px', flexShrink: 0 }}
                                    />

                                    <div
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'linear-gradient(to top, rgba(15,12,10,0.95) 0%, rgba(15,12,10,0.35) 55%, rgba(15,12,10,0) 85%)',
                                        }}
                                    />

                                    <div style={{ position: 'absolute', left: '10px', right: '10px', bottom: '8px' }}>
                                        <strong
                                            style={{
                                                display: 'block',
                                                fontFamily: "'Playfair Display', serif",
                                                fontSize: '14px',
                                                color: '#f7ead4',
                                                lineHeight: 1.2,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {item.name}
                                        </strong>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '3px',
                                                marginTop: '2px',
                                                fontSize: '10.5px',
                                                color: 'rgba(240,224,200,0.75)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            <Layers size={10} style={{ flexShrink: 0 }} />
                                            {isEmpty ? 'No problems yet' : `${item.boulder_count} rock${item.boulder_count === 1 ? '' : 's'} · ${item.problem_count} problem${item.problem_count === 1 ? '' : 's'}`}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>

                {showArrows && (
                    <>
                        <button
                            aria-label="Previous spot"
                            onClick={() => selectAdjacent(-1)}
                            disabled={activeIndex === 0}
                            style={arrowButtonStyle('left', activeIndex === 0)}
                        >
                            <ChevronLeft size={16} color="#f0e0c8" style={{ flexShrink: 0 }} />
                        </button>
                        <button
                            aria-label="Next spot"
                            onClick={() => selectAdjacent(1)}
                            disabled={activeIndex === items.length - 1}
                            style={arrowButtonStyle('right', activeIndex === items.length - 1)}
                        >
                            <ChevronRight size={16} color="#f0e0c8" style={{ flexShrink: 0 }} />
                        </button>
                    </>
                )}
            </div>

            {items.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '2px' }}>
                    {items.map((item, i) => (
                        <span
                            key={item.id}
                            style={{
                                width: i === activeIndex ? '14px' : '5px',
                                height: '5px',
                                borderRadius: '3px',
                                background: i === activeIndex ? '#c87a30' : '#3a332c',
                                transition: 'width 0.2s ease, background 0.2s ease',
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function arrowButtonStyle(side: 'left' | 'right', disabled: boolean): React.CSSProperties {
    return {
        position: 'absolute',
        ...(side === 'left' ? { left: '-4px' } : { right: '-4px' }),
        top: '50%',
        transform: 'translateY(-50%)',
        width: '26px',
        height: '26px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(20,16,12,0.85)',
        backdropFilter: 'blur(4px)',
        border: '1px solid #2a2420',
        borderRadius: '50%',
        cursor: disabled ? 'default' : 'pointer',
        padding: 0,
        opacity: disabled ? 0.35 : 1,
    }
}
