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
//
// Every field is optional, and one the body leaves out keeps the crag's
// current value. Pointers keep an omitted key (nil, keep) distinct from an
// empty string (write an empty value, which is how directions or access notes
// are cleared) and from a zero coordinate, which would otherwise arrive for a
// missing lat/lng and be rejected as outside Indonesia. A crag's coordinates
// are required, so unlike a rock's pin there is nothing to clear and each of
// lat and lng is kept or replaced on its own.
type UpdateCragRequest struct {
	Name        *string  `json:"name"`
	Lat         *float64 `json:"lat"`
	Lng         *float64 `json:"lng"`
	Directions  *string  `json:"directions"`
	AccessNotes *string  `json:"access_notes"`
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

// PurgeCounts is what a purge destroys, counted per kind. It is both the
// preview's answer and the confirmation the caller has to echo back --
// handoff.md open item 8's purge decision: an admin has to have looked at
// the number before the number is allowed to become zero.
type PurgeCounts struct {
	Boulders   int `json:"boulders"`
	Problems   int `json:"problems"`
	Pitches    int `json:"pitches"`
	HighPoints int `json:"high_points"`
	Sends      int `json:"sends"`
	Comments   int `json:"comments"`
	Lines      int `json:"lines"`
	Approaches int `json:"approaches"`
	Reports    int `json:"reports"`
	Photos     int `json:"photos"`
}

// CragPurgePreview is GET /api/crags/{id}/purge-preview's response: what
// would die, plus the snapshot that would be the only surviving record of
// it. Deliberately the same Snapshot shape the purge itself returns, so an
// admin can save the file before committing rather than only after.
type CragPurgePreview struct {
	CragID   string       `json:"crag_id"`
	CragName string       `json:"crag_name"`
	Counts   PurgeCounts  `json:"counts"`
	Snapshot CragSnapshot `json:"snapshot"`
}

// CragPurgeRequest is POST /api/crags/{id}/purge's body. Expected must
// match the server's own recount exactly or the purge is refused -- it
// makes the admin's confirmation specific rather than a reflex, and it
// closes the race where somebody adds a problem between the preview and
// the purge.
type CragPurgeRequest struct {
	Expected PurgeCounts `json:"expected"`
}

// CragPurgeResult is what the caller gets back, and for the destroyed rows
// it is the only copy that still exists -- the frontend saves Snapshot to a
// file. PhotosDestroyed/PhotosFailed report the Cloudinary side honestly
// rather than implying success: a failed destroy leaves a real orphan, and
// the admin is the only one who can act on knowing that.
type CragPurgeResult struct {
	Deleted          PurgeCounts  `json:"deleted"`
	PhotosDestroyed  int          `json:"photos_destroyed"`
	PhotosFailed     int          `json:"photos_failed"`
	CreatorsNotified int          `json:"creators_notified"`
	Snapshot         CragSnapshot `json:"snapshot"`
}
