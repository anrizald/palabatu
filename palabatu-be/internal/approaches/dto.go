package approaches

// CreateApproachStepInput is one step within CreateApproachRequest.Steps.
// Position is assigned by array order at the service layer (the frontend
// reorders via move-up/move-down buttons on a plain array), not a client
// field -- simpler, and avoids gaps or duplicate positions entirely.
type CreateApproachStepInput struct {
	PhotoURL    string   `json:"photo_url"`
	Caption     string   `json:"caption"`
	Lat         *float64 `json:"lat"`
	Lng         *float64 `json:"lng"`
	CarefulFlag bool     `json:"careful_flag"`
}

// CreateApproachRequest is handleCreateApproach's request body -- the whole
// approach and its steps in one call (handoff.md decision 21: "photos
// first, captions second... reorderable", submitted once at the end, on
// wifi, at home).
type CreateApproachRequest struct {
	CragID          string                    `json:"crag_id"`
	Name            string                    `json:"name"`
	StartType       string                    `json:"start_type"`
	DurationMinutes *int                      `json:"duration_minutes"`
	Steps           []CreateApproachStepInput `json:"steps"`
}
