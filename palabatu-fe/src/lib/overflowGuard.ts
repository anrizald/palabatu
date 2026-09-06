/**
 * Dev-only guard against the page scrolling sideways.
 *
 * CLAUDE.md: "the page body must never scroll horizontally" — wide content
 * (tables, diagrams, carousels) scrolls inside its own container instead.
 * That rule is easy to break by accident and invisible on a desktop monitor,
 * which is how `BoulderDetailPage`'s header action row shipped 63px too wide
 * for a 360px viewport with the "Edit" button clipped off the right edge.
 *
 * A Playwright sweep (tests/no-horizontal-overflow.spec.ts) covers the states
 * someone thought to enumerate. This covers the ones nobody did: a crag name
 * longer than any fixture, a three-line error banner, a pending state that
 * only appears on a slow connection. It runs wherever you actually navigate,
 * so it catches the case the first time you produce it.
 *
 * Stripped from production builds by `import.meta.env.DEV` — Vite evaluates
 * it at build time, so none of this ships.
 */

/** Overflow values that make an ancestor clip or scroll its children. */
const CONTAINING = new Set(['auto', 'scroll', 'hidden', 'clip'])

/**
 * Is this element inside something that scrolls or clips horizontally?
 *
 * This is the check that separates a real bug from a false alarm, and it is
 * the one a naive "find everything past the right edge" sweep gets wrong: a
 * topo carousel, the directory's card rail and Leaflet's tile layer all
 * deliberately extend past the viewport inside their own scroller. None of
 * them can push the document wider, so none of them is the culprit.
 */
function insideScroller(el: Element): boolean {
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const overflowX = getComputedStyle(a).overflowX
        if (CONTAINING.has(overflowX)) return true
    }
    return false
}

function describe(el: Element): string {
    const chain: string[] = []
    for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const raw = a.getAttribute('class') ?? ''
        const cls = raw.trim().split(/\s+/).filter(Boolean).slice(0, 4).join('.')
        chain.push(a.tagName.toLowerCase() + (cls ? `.${cls}` : ''))
    }
    return chain.slice(0, 6).join(' < ')
}

/**
 * Names what is pushing the document wide: the outermost element past the
 * right edge that no ancestor clips, plus the innermost one for context.
 *
 * Outermost is the useful half. When a too-wide row of buttons overflows, its
 * page container is still viewport-width, so the first offender in document
 * order is the row itself -- the thing whose CSS is actually wrong -- while
 * the innermost is some icon inside it, a symptom.
 *
 * An earlier version reported only the innermost, filtered by "has no child
 * that also sticks out", and returned nothing at all: that rule dropped the
 * row and the button, and the leaf below them was an icon path inside a
 * lucide <svg>, which computes overflow-x: hidden and so looked like a
 * scroller. Collect candidates first, then pick from them.
 */
function findOffender(viewportWidth: number): string | null {
    const candidates: Element[] = []
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        if (rect.right <= viewportWidth + 1) continue
        if (insideScroller(el)) continue
        candidates.push(el)
    }
    if (candidates.length === 0) return null

    // querySelectorAll returns document order, so ancestors precede descendants.
    const outer = candidates[0]
    const inner = candidates[candidates.length - 1]
    if (!outer || !inner) return null

    const outermost = describe(outer)
    const innermost = describe(inner)
    return outermost === innermost ? outermost : `${outermost}
  innermost: ${innermost}`
}

export function installOverflowGuard() {
    if (!import.meta.env.DEV) return

    // Only report a given (width, offender) pair once. Without this, a
    // MutationObserver on a React app turns one bug into a wall of identical
    // errors and the next real one scrolls out of the console.
    const reported = new Set<string>()
    let queued = false

    const check = () => {
        queued = false
        const root = document.documentElement
        // clientWidth excludes a vertical scrollbar, which is what makes this
        // comparison meaningful rather than off by ~15px on desktop.
        if (root.scrollWidth <= root.clientWidth + 1) return

        const offender = findOffender(root.clientWidth) ?? '(not found — likely a margin or absolute position)'
        const key = `${root.clientWidth}|${offender}`
        if (reported.has(key)) return
        reported.add(key)

        console.error(
            `[overflow] the page scrolls sideways at ${root.clientWidth}px: ` +
            `scrollWidth ${root.scrollWidth} > clientWidth ${root.clientWidth}\n` +
            `  widest thing sticking out: ${offender}\n` +
            `  Wide content belongs in its own overflow-x container (CLAUDE.md).`,
        )
    }

    // Coalesce bursts: a route change fires hundreds of mutations, and layout
    // is only worth measuring once it settles.
    const schedule = () => {
        if (queued) return
        queued = true
        setTimeout(() => requestAnimationFrame(check), 400)
    }

    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true })
    window.addEventListener('resize', schedule)
    schedule()
}
