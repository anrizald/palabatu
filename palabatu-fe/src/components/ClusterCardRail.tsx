import L from 'leaflet'
import { MapPin } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ProblemRow } from '../types/problem.js'

type Props = {
    items: ProblemRow[]
    onSelect: (item: ProblemRow) => void
}

const CARD_WIDTH = 160
const GAP = 12

export default function ClusterCardRail({ items, onSelect }: Props) {
    const railRef = useRef<HTMLDivElement>(null)
    const [activeIndex, setActiveIndex] = useState(0)

    // Touch and trackpad gestures scroll an overflow-x container natively, but
    // a plain mouse click-drag does not — desktop mouse users need that drag
    // translated into scrollLeft manually, click-and-drag-carousel style.
    const drag = useRef({ active: false, startX: 0, startScrollLeft: 0, moved: false, pointerId: -1 })

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
        const idx = Math.round(el.scrollLeft / (CARD_WIDTH + GAP))
        setActiveIndex(Math.max(0, Math.min(items.length - 1, idx)))
    }

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'mouse') return
        const el = railRef.current
        if (!el) return
        drag.current = { active: true, startX: e.clientX, startScrollLeft: el.scrollLeft, moved: false, pointerId: e.pointerId }
        el.style.cursor = 'grabbing'
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = railRef.current
        if (!el || !drag.current.active) return
        const dx = e.clientX - drag.current.startX
        if (!drag.current.moved && Math.abs(dx) > 3) {
            drag.current.moved = true
            // Only capture once an actual drag starts: capturing on every
            // plain click retargets the resulting click event to this rail
            // div instead of the card button underneath, so it never fires.
            el.setPointerCapture(e.pointerId)
        }
        if (drag.current.moved) {
            el.scrollLeft = drag.current.startScrollLeft - dx
        }
    }

    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = railRef.current
        if (!el || !drag.current.active) return
        drag.current.active = false
        el.style.cursor = 'grab'
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    }

    const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
        // Swallow the click that follows a drag so releasing over a card
        // doesn't also select it.
        if (drag.current.moved) {
            e.stopPropagation()
            e.preventDefault()
        }
        drag.current.moved = false
    }

    return (
        <div style={{ padding: '4px 2px 2px' }}>
            <div
                ref={railRef}
                onScroll={handleScroll}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onClickCapture={handleClickCapture}
                style={{
                    display: 'flex',
                    gap: `${GAP}px`,
                    overflowX: 'auto',
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                    padding: '4px 2px 10px',
                    cursor: 'grab',
                    touchAction: 'pan-x',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    maskImage: 'linear-gradient(to right, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)',
                }}
            >
                {items.map((item, i) => {
                    const isActive = items.length <= 1 || i === activeIndex
                    const hasPhoto = !!item.image_urls?.[0]
                    return (
                        <button
                            key={item.id}
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
                                opacity: isActive ? 1 : 0.55,
                                transform: isActive ? 'translateY(-2px)' : 'none',
                                boxShadow: isActive
                                    ? '0 8px 18px rgba(0,0,0,0.45), 0 0 0 2px rgba(200,122,48,0.55)'
                                    : '0 2px 6px rgba(0,0,0,0.35), 0 0 0 1px #2a2420',
                                transition: 'opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
                                WebkitTapHighlightColor: 'transparent',
                            }}
                        >
                            <div style={{ position: 'relative', width: '100%', height: '128px', background: 'linear-gradient(135deg, #23201b, #171410)' }}>
                                {hasPhoto ? (
                                    <img
                                        src={item.image_urls![0]}
                                        alt=""
                                        draggable={false}
                                        loading="lazy"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', WebkitUserDrag: 'none' } as React.CSSProperties}
                                    />
                                ) : (
                                    <>
                                        <span
                                            aria-hidden
                                            style={{
                                                position: 'absolute',
                                                right: '-6px',
                                                bottom: '18px',
                                                fontFamily: "'Playfair Display', serif",
                                                fontSize: '44px',
                                                fontWeight: 700,
                                                color: 'rgba(240,224,200,0.07)',
                                                transform: 'rotate(-8deg)',
                                                whiteSpace: 'nowrap',
                                                lineHeight: 1,
                                            }}
                                        >
                                            {item.grade}
                                        </span>
                                        <MapPin
                                            size={18}
                                            color="#4a3f35"
                                            style={{ position: 'absolute', left: '12px', top: '12px', flexShrink: 0 }}
                                        />
                                    </>
                                )}

                                {/* Scrim + overlaid text, same treatment for photo and placeholder cards */}
                                <div
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background: 'linear-gradient(to top, rgba(15,12,10,0.95) 0%, rgba(15,12,10,0.35) 55%, rgba(15,12,10,0) 85%)',
                                    }}
                                />

                                {item.grade && (
                                    <span
                                        style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '8px',
                                            background: 'rgba(20,16,12,0.7)',
                                            backdropFilter: 'blur(4px)',
                                            color: '#ffb870',
                                            border: '1px solid rgba(200,122,48,0.5)',
                                            padding: '2px 7px',
                                            borderRadius: '10px',
                                            fontSize: '10px',
                                            fontWeight: 700,
                                        }}
                                    >
                                        {item.grade}
                                    </span>
                                )}

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
                                        <MapPin size={10} style={{ flexShrink: 0 }} />
                                        {item.location_name}
                                    </div>
                                </div>
                            </div>
                        </button>
                    )
                })}
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
