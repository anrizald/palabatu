package boulders

// CreateBoulderRequest is handleCreateBoulder's request body. Type is
// "boulder" or "wall" (handoff.md decision 1: cliffs are in scope) -- empty
// defaults to "boulder" at the service layer.
type CreateBoulderRequest struct {
	CragID    string   `json:"crag_id"`
	Name      string   `json:"name"`
	Type      string   `json:"type"`
	RockType  string   `json:"rock_type"`
	Lat       *float64 `json:"lat"`
	Lng       *float64 `json:"lng"`
	ImageURLs []string `json:"image_urls"`
}

// UpdateBoulderRequest is handleUpdateBoulder's request body. CragID
// re-parents the boulder to a different spot when non-empty (handoff.md
// decision 13) -- empty string means "leave as is", mirroring every other
// plain-string field's already-established convention in this codebase.
type UpdateBoulderRequest struct {
	CragID   string   `json:"crag_id"`
	Name     string   `json:"name"`
	Type     string   `json:"type"`
	RockType string   `json:"rock_type"`
	Lat      *float64 `json:"lat"`
	Lng      *float64 `json:"lng"`
}

// AddBoulderImagesRequest is handleAddBoulderImages's request body: URLs
// already uploaded via POST /upload/topo, to append to a boulder's
// image_urls.
type AddBoulderImagesRequest struct {
	ImageURLs []string `json:"image_urls"`
}

// DeleteBoulderImageRequest is handleDeleteBoulderImage's request body.
type DeleteBoulderImageRequest struct {
	URL string `json:"url"`
}

// SuggestMergeRequest is handleSuggestMerge's request body -- "these are
// the same rock".
type SuggestMergeRequest struct {
	TargetBoulderID string `json:"target_boulder_id"`
	Reason          string `json:"reason"`
}

// ObjectToMergeRequest is handleObjectToMerge's request body -- "this is
// not the same rock".
type ObjectToMergeRequest struct {
	Body string `json:"body"`
}

// ResolveMergeRequestRequest is handleResolveMergeRequest's request body.
// SurvivorID is required when Action is "merge" -- the admin's pick of
// which boulder survives, never automatic (handoff.md's merge-flow design
// note 5).
type ResolveMergeRequestRequest struct {
	Action       string `json:"action"`
	SurvivorID   string `json:"survivor_id"`
	OverrideHold bool   `json:"override_hold"`
}
