package problems

import "encoding/json"

// CreateProblemRequest is handleCreateProblem's request body. BoulderID is
// required -- crag_id is derived from the boulder, not supplied directly
// (handoff.md decision 5). The rest are the optional fields from decisions
// 8-10.
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
}

// UpdateProblemRequest is handleUpdateProblem's request body. BoulderID is
// not editable via update -- moving a problem to a different boulder isn't
// a flow this app supports; a boulder merge (internal/boulders) is how
// problems get reassociated with a different boulder.
type UpdateProblemRequest struct {
	Name              string   `json:"name"`
	Grade             string   `json:"grade"`
	FirstAscensionist string   `json:"first_ascensionist"`
	DiscoveredBy      string   `json:"discovered_by"`
	LandingHazards    string   `json:"landing_hazards"`
	Descent           string   `json:"descent"`
	HeightM           *float64 `json:"height_m"`
	Notes             string   `json:"notes"`
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
