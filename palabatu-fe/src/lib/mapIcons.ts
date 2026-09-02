import L from 'leaflet'

// Shared visual DNA for every map marker kind (handoff.md's three-layer
// zoom design: the far-out crag pin, and two close-zoom layers -- boulder
// pins and approach-start pins, see CragDetailLayer.tsx). Before this
// module existed, PinpointMarker.tsx had a matching "dark disc + colored
// ring + cream glyph" fallback SVG (used only when its PNG art fails to
// load) but BoulderPinMarker/ApproachStartMarker each hand-rolled their own
// unrelated L.divIcon string -- a flat CSS circle for one, a bespoke inline
// SVG for the other. Two base shapes now carry the semantics everywhere:
//
//   - "badge": a tailless dark disc with a colored ring -- "an object
//     exists here" (boulder pins; also PinpointMarker's cluster fallback).
//   - "teardrop": the tailed pin-drop silhouette -- "you go here"
//     (approach-start pins; also PinpointMarker's own single-pin fallback).
//
// Both share the same fill/stroke/shadow language so a PNG-load failure or
// a close-zoom marker never reads as a different app than the real
// hand-drawn pinpoint art. Real hand-drawn raster art for the badge/teardrop
// glyphs is a queued follow-up (see custom_icon_asset_plan.md) -- these SVGs
// are the code-only stand-in until then.

const BADGE_FILL = '#1a1612'
export const GLYPH_STROKE = '#f0e0c8'
const GLYPH_ATTRS = `fill="none" stroke="${GLYPH_STROKE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`

function badgeRing(ringColor: string) {
    // stroke-width 2 (not the crag pin's original fallback 1.25) so the ring
    // still reads once scaled down to a 16-18px boulder badge -- at 1.25 it
    // all but disappeared into the dark fill at that size (checked live).
    return `<circle cx="12" cy="12" r="11" fill="${BADGE_FILL}" stroke="${ringColor}" stroke-width="2"/>`
}

const TEARDROP_PATH = 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0'
const DEFAULT_DOT_GLYPH = '<circle cx="12" cy="10" r="3"/>'

type SvgOpts = {
    ringColor: string
    /** Extra SVG markup (paths/circles/etc), drawn with GLYPH_ATTRS on top of the base shape. */
    glyph?: string
    size?: number
}

type IconOpts = SvgOpts & {
    size: number
    className?: string
}

export function renderBadgeSvg({ ringColor, glyph = '', size = 24 }: SvgOpts): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">${badgeRing(ringColor)}<g ${GLYPH_ATTRS}>${glyph}</g></svg>`
}

export function renderTeardropSvg({ ringColor, glyph = DEFAULT_DOT_GLYPH, size = 24 }: SvgOpts): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">${badgeRing(ringColor)}<path d="${TEARDROP_PATH}" ${GLYPH_ATTRS}/><g ${GLYPH_ATTRS}>${glyph}</g></svg>`
}

/** Tailless disc badge -- close-zoom "an object is here" markers (boulders). */
export function buildBadgeIcon(opts: IconOpts): L.DivIcon {
    const { size, className = '' } = opts
    return L.divIcon({
        html: renderBadgeSvg(opts),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        className,
    })
}

/** Tailed pin-drop -- "you go here" destination markers (approach starts). */
export function buildTeardropIcon(opts: IconOpts): L.DivIcon {
    const { size, className = '' } = opts
    return L.divIcon({
        html: renderTeardropSvg(opts),
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size],
        className,
    })
}
