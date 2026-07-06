import { useRef } from 'react';

interface HorizontalScrollCarouselProps {
    children: React.ReactNode;
    itemCount?: number;         // used to decide whether to show nav buttons
    gap?: number;
    paddingX?: number;
    outerMarginX?: number;      // negative margin to bleed past parent padding
}

export default function HorizontalScrollCarousel({
    children,
    itemCount = 1,
    gap = 12,
    paddingX = 20,
    outerMarginX = 20,
}: HorizontalScrollCarouselProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (dir: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const width = scrollRef.current.clientWidth;
        scrollRef.current.scrollBy({ left: dir === 'left' ? -width : width, behavior: 'smooth' });
    };

    return (
        <div style={{ position: 'relative', margin: `0 -${outerMarginX}px` }}>
            <div ref={scrollRef} style={{
                display: 'flex',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                gap: `${gap}px`,
                padding: `0 ${paddingX}px`,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
            } as React.CSSProperties}>
                {children}
            </div>

            {itemCount > 1 && (
                <>
                    {(['left', 'right'] as const).map(dir => (
                        <button key={dir} onClick={() => scroll(dir)} style={{
                            position: 'absolute',
                            [dir]: `${paddingX + 4}px`,
                            top: '50%', transform: 'translateY(-50%)',
                            background: 'rgba(20,18,16,0.75)', backdropFilter: 'blur(6px)',
                            border: '1px solid #2a2420', color: '#f0e0c8',
                            width: '36px', height: '36px', borderRadius: '50%',
                            cursor: 'pointer', fontSize: '16px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {dir === 'left' ? '‹' : '›'}
                        </button>
                    ))}
                </>
            )}
        </div>
    );
}