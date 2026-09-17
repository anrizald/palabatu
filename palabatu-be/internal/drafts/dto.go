package drafts

import "encoding/json"

// CreateDraftRequest/UpdateDraftRequest share a shape: the payload is an
// opaque snapshot of the add sheet's own in-progress form state
// (palabatu-fe's add-sheet/types.ts), which this domain never interprets --
// same precedent as auth.Profile.Title/Tags. photo_urls is pulled out
// separately, not read out of payload, because the client already knows
// exactly which Cloudinary URLs it just uploaded for this draft and orphan
// cleanup (UpdateDraft's diff, DeleteDraft's sweep) needs that list without
// parsing FE-shaped JSON to find it (handoff-drafts.md decision 10).
type CreateDraftRequest struct {
	Intent    string          `json:"intent"`
	Label     string          `json:"label"`
	Payload   json.RawMessage `json:"payload"`
	PhotoURLs []string        `json:"photo_urls"`
}

type UpdateDraftRequest struct {
	Label     string          `json:"label"`
	Payload   json.RawMessage `json:"payload"`
	PhotoURLs []string        `json:"photo_urls"`
}
