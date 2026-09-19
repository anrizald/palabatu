package problems

import (
	"encoding/json"
	"strings"
)

// CreateProblemRequest is handleCreateProblem's request body. BoulderID is
// required -- crag_id is derived from the boulder, not supplied directly
// (handoff.md decision 5). ImageURLs are optional beta/action shots (crux
// hold, start position, someone on it) -- never the topo base, never
// annotatable (decision 2, amended). The rest are the optional fields from
// decisions 8-10.
//
// PitchCount, CommitmentGrade and Pitches are the multi-pitch detail (open
// item 14, decision 23) and are only accepted when the boulder is a wall.
// PitchCount null means single pitch; 2 or more means multi-pitch, and 0 or 1
// is a 400 rather than being quietly turned into null. CommitmentGrade is one
// of F/PD/AD/D/TD/ED or empty. Pitches needs a PitchCount to hang off.
type CreateProblemRequest struct {
	Name              string   `json:"name"`
	Grade             string   `json:"grade"`
	BoulderID         string   `json:"boulder_id"`
	FirstAscensionist string   `json:"first_ascensionist"`
	DiscoveredBy      string   `json:"discovered_by"`
	LandingHazards    string   `json:"landing_hazards"`
	Descent           string   `json:"descent"`
	HeightM           *float64 `json:"height_m"`
	Notes             string   `json:"notes"`
	ImageURLs         []string `json:"image_urls"`
	PitchCount        *int     `json:"pitch_count"`
	CommitmentGrade   string   `json:"commitment_grade"`
	Pitches           []Pitch  `json:"pitches"`
}

// Pitch is one documented rope-length of a multi-pitch route, in both requests
// and responses. It is however much of the route somebody has written down,
// and is not required to agree with the route's pitch_count. LengthM is this
// pitch's own length and has nothing to do with the route's height_m. Notes
// null and empty are the same thing on the way in.
type Pitch struct {
	PitchNumber int      `json:"pitch_number"`
	Grade       string   `json:"grade"`
	LengthM     *float64 `json:"length_m"`
	Notes       *string  `json:"notes"`
}

// UpdateProblemRequest is handleUpdateProblem's request body. BoulderID
// re-parents the problem to a different boulder when non-empty (handoff.md
// decision 13) -- empty string means "leave as is". Doing so drops every
// annotation this problem had (a line drawn on the old rock's photo means
// nothing on the new one) -- see UpdateProblem's doc comment. No
// image_urls here -- images mutate only via the dedicated endpoints below.
//
// Every other field is optional, and one the body leaves out keeps the
// problem's current value. The text fields are pointers so that an omitted key
// (nil, keep) stays distinct from an empty string (write an empty value, which
// is how a field is cleared). HeightM already means "clear the height" when
// null, so HasHeight is what tells that from an omitted key.
//
// The multi-pitch fields follow the same rule. PitchCount is cleared, meaning
// single pitch, by sending null, told from an omitted key by HasPitchCount.
// CommitmentGrade is cleared by an empty string. Pitches replaces the whole
// documented set when present, so an empty array clears it and a missing key
// (or null) keeps it. Clearing is always allowed; sending pitch data for a
// route on a boulder is a 400, and nothing is ever deleted as a side effect.
type UpdateProblemRequest struct {
	BoulderID         string   `json:"boulder_id"`
	Name              *string  `json:"name"`
	Grade             *string  `json:"grade"`
	FirstAscensionist *string  `json:"first_ascensionist"`
	DiscoveredBy      *string  `json:"discovered_by"`
	LandingHazards    *string  `json:"landing_hazards"`
	Descent           *string  `json:"descent"`
	HeightM           *float64 `json:"height_m"`
	Notes             *string  `json:"notes"`
	PitchCount        *int     `json:"pitch_count"`
	CommitmentGrade   *string  `json:"commitment_grade"`
	Pitches           []Pitch  `json:"pitches"`

	// HasHeight and HasPitchCount are whether the body carried a "height_m" /
	// "pitch_count" key at all. They are filled by UnmarshalJSON because a
	// pointer cannot tell an omitted key from an explicit null, and null is
	// how a client clears either value on purpose.
	HasHeight     bool `json:"-"`
	HasPitchCount bool `json:"-"`
}

// UnmarshalJSON decodes as usual, then records which nullable keys were
// present. Keys are matched case-insensitively, as encoding/json itself does,
// so a spelling that fills a field is also seen as present.
func (r *UpdateProblemRequest) UnmarshalJSON(data []byte) error {
	type plain UpdateProblemRequest // no methods, so no recursion
	if err := json.Unmarshal(data, (*plain)(r)); err != nil {
		return err
	}
	var keys map[string]json.RawMessage
	if err := json.Unmarshal(data, &keys); err != nil {
		return err
	}
	r.HasHeight, r.HasPitchCount = false, false
	for k := range keys {
		switch {
		case strings.EqualFold(k, "height_m"):
			r.HasHeight = true
		case strings.EqualFold(k, "pitch_count"):
			r.HasPitchCount = true
		}
	}
	return nil
}

// AddProblemImagesRequest is handleAddProblemImages's request body: URLs
// already uploaded via POST /upload/topo, to append to a problem's
// image_urls.
type AddProblemImagesRequest struct {
	ImageURLs []string `json:"image_urls"`
}

// DeleteProblemImageRequest is handleDeleteProblemImage's request body.
type DeleteProblemImageRequest struct {
	URL string `json:"url"`
}

// SaveAnnotationRequest is handleSaveAnnotation's request body.
type SaveAnnotationRequest struct {
	URL  string          `json:"url"`
	Data json.RawMessage `json:"data"`
}

// TopoUploadResponse and AvatarUploadResponse replace handleUpload's former
// dynamic gin.H{responseKey: url} -- swag can't document a dynamic map key,
// and the two call sites genuinely return different keys ("url" vs
// "avatar_url").
type TopoUploadResponse struct {
	Url string `json:"url"`
}

type AvatarUploadResponse struct {
	AvatarUrl string `json:"avatar_url"`
}
