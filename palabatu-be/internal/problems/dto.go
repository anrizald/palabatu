package problems

import "encoding/json"

// CreateProblemRequest is handleCreateProblem's request body. BoulderID is
// required -- crag_id is derived from the boulder, not supplied directly
// (handoff.md decision 5). ImageURLs are optional beta/action shots (crux
// hold, start position, someone on it) -- never the topo base, never
// annotatable (decision 2, amended). The rest are the optional fields from
// decisions 8-10.
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
}

// UpdateProblemRequest is handleUpdateProblem's request body. BoulderID
// re-parents the problem to a different boulder when non-empty (handoff.md
// decision 13) -- empty string means "leave as is". Doing so drops every
// annotation this problem had (a line drawn on the old rock's photo means
// nothing on the new one) -- see UpdateProblem's doc comment. No
// image_urls here -- images mutate only via the dedicated endpoints below.
type UpdateProblemRequest struct {
	BoulderID         string   `json:"boulder_id"`
	Name              string   `json:"name"`
	Grade             string   `json:"grade"`
	FirstAscensionist string   `json:"first_ascensionist"`
	DiscoveredBy      string   `json:"discovered_by"`
	LandingHazards    string   `json:"landing_hazards"`
	Descent           string   `json:"descent"`
	HeightM           *float64 `json:"height_m"`
	Notes             string   `json:"notes"`
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
