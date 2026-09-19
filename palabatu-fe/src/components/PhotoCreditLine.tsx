import { creditFor, type PhotoCredit } from '../types/photocredit.js'

/**
 * "Photo by <name>" under a crag, boulder or problem photo.
 *
 * Renders nothing when neither a recorded credit nor the entity's creator is
 * known, rather than showing "unknown" — see types/photocredit.ts for why an
 * absent credit falls back to the creator instead of being a gap.
 *
 * Text is Weathered Stone (`text-text-muted`), not Faint Stone, per
 * DESIGN.md's Sentence Rule: if it is made of words, it is at least
 * Weathered Stone.
 */
export default function PhotoCreditLine({
    url,
    credits,
    creatorName,
}: {
    url: string
    credits: PhotoCredit[] | undefined
    creatorName: string | null | undefined
}) {
    const name = creditFor(url, credits, creatorName)
    if (!name) return null

    return (
        <div className="text-[11px] text-text-muted mt-1">
            Photo by {name}
        </div>
    )
}
