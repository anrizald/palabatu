package boulders

import (
	"encoding/json"
	"strings"
	"time"
)

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
	// FiledUncertain records that the contributor said "Not sure which one"
	// rather than "It's a new rock" when this rock was created implicitly by
	// the add sheet (handoff-add-sheet.md C11). Three-state on purpose:
	// true said so, false said it was new, nil was never asked -- every
	// other creation path leaves it nil rather than guessing.
	FiledUncertain *bool `json:"filed_uncertain"`
}

// UpdateBoulderRequest is handleUpdateBoulder's request body. CragID
// re-parents the boulder to a different spot when non-empty (handoff.md
// decision 13) -- empty string means "leave as is", mirroring every other
// plain-string field's already-established convention in this codebase.
//
// Lat and Lng are the rock's pin, and move as a pair: a body with neither key
// leaves the pin alone, while a body with either one replaces both with what
// was sent, where null clears. Name, Type and RockType have no such
// protection: they are written as sent.
type UpdateBoulderRequest struct {
	CragID   string   `json:"crag_id"`
	Name     string   `json:"name"`
	Type     string   `json:"type"`
	RockType string   `json:"rock_type"`
	Lat      *float64 `json:"lat"`
	Lng      *float64 `json:"lng"`

	// HasCoords is whether the body carried a "lat" or "lng" key at all. It
	// is filled by UnmarshalJSON because a *float64 cannot tell an omitted key
	// from an explicit null, and null is how a client clears a pin on purpose.
	HasCoords bool `json:"-"`
}

// UnmarshalJSON decodes as usual, then records whether either coordinate key
// was present. Keys are matched case-insensitively, as encoding/json itself
// does, so a spelling that fills Lat is also seen as present.
func (r *UpdateBoulderRequest) UnmarshalJSON(data []byte) error {
	type plain UpdateBoulderRequest // no methods, so no recursion
	if err := json.Unmarshal(data, (*plain)(r)); err != nil {
		return err
	}
	var keys map[string]json.RawMessage
	if err := json.Unmarshal(data, &keys); err != nil {
		return err
	}
	r.HasCoords = false
	for k := range keys {
		if strings.EqualFold(k, "lat") || strings.EqualFold(k, "lng") {
			r.HasCoords = true
		}
	}
	return nil
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

// NeedsAttentionItem is one row of the admin tidy-up queue
// (GET /api/boulders/needs-attention), closing handoff.md open item 9.
//
// Reason says which of the two signals put it here, because they do not
// deserve equal trust: "said_unsure" is the contributor's own words,
// recorded at the moment they said them; "looks_unsure" is item 9's
// heuristic -- an unnamed, photoless rock holding exactly one problem --
// inferred after the fact, and the only signal available for anything
// created before that flag existed.
//
// SiblingCount is how many other rocks are at the same spot, because it
// decides what the admin can actually do: with siblings the fix is usually
// a merge or a re-parent, with none it is naming the rock or leaving it be.
type NeedsAttentionItem struct {
	ID                string    `json:"id"`
	Name              *string   `json:"name"`
	CragID            string    `json:"crag_id"`
	CragName          string    `json:"crag_name"`
	ImageCount        int       `json:"image_count"`
	ProblemCount      int       `json:"problem_count"`
	SampleProblemName *string   `json:"sample_problem_name"`
	SiblingCount      int       `json:"sibling_count"`
	CreatedBy         *string   `json:"created_by"`
	CreatorName       *string   `json:"creator_name"`
	Reason            string    `json:"reason"`
	CreatedAt         time.Time `json:"created_at"`
}
