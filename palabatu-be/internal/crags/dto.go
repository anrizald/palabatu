package crags

// CreateCragRequest is handleCreateCrag's request body.
type CreateCragRequest struct {
	Name        string  `json:"name"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	Directions  string  `json:"directions"`
	AccessNotes string  `json:"access_notes"`
}

// UpdateCragRequest is handleUpdateCrag's request body.
type UpdateCragRequest struct {
	Name        string  `json:"name"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	Directions  string  `json:"directions"`
	AccessNotes string  `json:"access_notes"`
}
