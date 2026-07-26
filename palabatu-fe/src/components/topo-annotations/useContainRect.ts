import { useEffect, useRef, useState } from 'react'

export type ContainRect = {
    left: number
    top: number
    width: number
    height: number
}

// Tracks the rendered box of an "object-fit: contain"-style image by
// measuring the <img> element directly via getBoundingClientRect, rather
// than recomputing contain-math from naturalWidth/naturalHeight. Those
// don't reliably match the browser's own visual layout for every photo —
// real-world EXIF-oriented phone photos in particular can report natural
// dimensions that don't match what's actually painted — which showed up
// live as the drawable/rendered area being narrower than the visible
// photo. Measuring the actual box the browser painted is correct by
// construction regardless of what caused a naturalWidth/height mismatch.
//
// Requires the <img> itself to be sized via maxWidth/maxHeight: 100% +
// width/height: auto (NOT width/height: 100% + objectFit: contain) inside
// a flex-centered container, so the <img>'s own box shrinks to the visible
// content instead of always filling the container.
export function useContainRect() {
    const containerRef = useRef<HTMLDivElement>(null)
    const imgRef = useRef<HTMLImageElement>(null)
    const [rect, setRect] = useState<ContainRect | null>(null)

    useEffect(() => {
        const container = containerRef.current
        const img = imgRef.current
        if (!container || !img) return

        const compute = () => {
            const containerBox = container.getBoundingClientRect()
            const imgBox = img.getBoundingClientRect()
            if (imgBox.width <= 0 || imgBox.height <= 0) return

            setRect({
                left: imgBox.left - containerBox.left,
                top: imgBox.top - containerBox.top,
                width: imgBox.width,
                height: imgBox.height,
            })
        }

        compute()

        // ResizeObserver alone isn't enough: it only fires when the
        // observed element's own SIZE changes, not when its POSITION
        // shifts because something else nearby reflows (confirmed live —
        // the toolbar's web-font swap-in after first paint shifted the
        // image container's on-screen top without changing its size,
        // leaving `rect` computed from a since-superseded layout pass).
        // A few rAF-deferred recomputes over the following frames catch
        // any such late settling (fonts, image decode, wrap changes)
        // without needing to enumerate every possible cause.
        let rafId = 0
        let framesLeft = 8
        const tick = () => {
            compute()
            framesLeft -= 1
            if (framesLeft > 0) rafId = requestAnimationFrame(tick)
        }
        rafId = requestAnimationFrame(tick)

        const observer = new ResizeObserver(compute)
        observer.observe(img)
        observer.observe(container)
        return () => {
            observer.disconnect()
            cancelAnimationFrame(rafId)
        }
    }, [])

    return { containerRef, imgRef, rect }
}
