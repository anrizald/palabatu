package crags

// CreateCragRequest is handleCreateCrag's request body. ImageURLs is the
// approach shot (handoff.md decision 2, amended 2026-08-08(f)) -- uploadable
// at spot-creation time since the person is often standing right there,
// mirroring boulders.CreateBoulderRequest.ImageURLs.
type CreateCragRequest struct {
	Name        string   `json:"name"`
	Lat         float64  `json:"lat"`
	Lng         float64  `json:"lng"`
	Directions  string   `json:"directions"`
	AccessNotes string   `json:"access_notes"`
	ImageURLs   []string `json:"image_urls"`
}

// UpdateCragRequest is handleUpdateCrag's request body. No image_urls --
// images mutate only via the dedicated add/delete endpoints below, same
// split as boulders.UpdateBoulderRequest.
type UpdateCragRequest struct {
	Name        string  `json:"name"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	Directions  string  `json:"directions"`
	AccessNotes string  `json:"access_notes"`
}

// AddCragImagesRequest is handleAddCragImages's request body: URLs already
// uploaded via POST /upload/topo, to append to a crag's image_urls.
type AddCragImagesRequest struct {
	ImageURLs []string `json:"image_urls"`
}

// DeleteCragImageRequest is handleDeleteCragImage's request body.
type DeleteCragImageRequest struct {
	URL string `json:"url"`
}
