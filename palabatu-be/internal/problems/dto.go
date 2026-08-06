package problems

import "encoding/json"

// CreateProblemRequest is handleCreateProblem's request body.
type CreateProblemRequest struct {
	Name      string   `json:"name"`
	Grade     string   `json:"grade"`
	Location  string   `json:"location"`
	Lat       float64  `json:"lat"`
	Lng       float64  `json:"lng"`
	ImageURLs []string `json:"image_urls"`
}

// UpdateProblemRequest is handleUpdateProblem's request body.
type UpdateProblemRequest struct {
	Name         string  `json:"name"`
	Grade        string  `json:"grade"`
	LocationName string  `json:"location_name"`
	Lat          float64 `json:"lat"`
	Lng          float64 `json:"lng"`
}

// DeleteProblemImageRequest is handleDeleteProblemImage's request body.
type DeleteProblemImageRequest struct {
	URL string `json:"url"`
}

// AddProblemImagesRequest is handleAddProblemImages's request body: URLs
// already uploaded via POST /upload/topo, to append to an existing
// problem's image_urls.
type AddProblemImagesRequest struct {
	ImageURLs []string `json:"image_urls"`
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
