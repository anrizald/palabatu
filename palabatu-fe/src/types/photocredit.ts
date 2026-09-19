// Mirrors palabatu-be/internal/photocredits (generated schema
// `palabatu-be_internal_photocredits.Credit`) — who added a given photo to a
// crag, boulder or problem.
//
// Attached to the single-entity GETs only (`GET /crags/:id`,
// `GET /boulders/:id`, `GET /problems/:id`), never to a list response, so
// the field is optional on every entity type that carries it.
//
// An absent entry is not an unknown uploader. Until the contribution policy
// widens past creator-or-admin (handoff.md open item 11), a photo with no
// credit row was added by the entity's own creator, since that is what the
// authorization allowed — so fall back to the entity's `creator_name` rather
// than rendering "unknown".
export type PhotoCredit = {
    image_url: string
    // Both nullable on the Go side: `uploaded_by` is ON DELETE SET NULL, and
    // `username` comes from a LEFT JOIN on profiles. Render no credit line
    // rather than inventing one.
    uploaded_by: string | null
    username: string | null
    created_at: string
}

/**
 * Resolves the credit line for one photo: the recorded uploader if there is
 * one, otherwise the entity's own creator per the fallback above. Returns
 * null when neither is known, which means render nothing.
 */
export function creditFor(
    imageURL: string,
    credits: PhotoCredit[] | undefined,
    creatorName: string | null | undefined,
): string | null {
    const recorded = credits?.find(c => c.image_url === imageURL)
    if (recorded?.username) return recorded.username
    return creatorName ?? null
}
