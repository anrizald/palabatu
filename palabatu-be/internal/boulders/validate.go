package boulders

// Indonesia's bounding box, padded slightly beyond the country's actual
// extent -- mirrors problems/validate.go's original constants (removed
// there since problems no longer carries its own lat/lng), kept as this
// domain's own copy rather than a shared package, matching this codebase's
// existing per-domain-validator convention. A boulder's coordinates are
// optional (unlike a crag's), so this only runs when both are provided.
const (
	minLat = -11.5
	maxLat = 6.5
	minLng = 94.5
	maxLng = 141.5
)

func validateLatLng(lat, lng *float64) error {
	if lat == nil || lng == nil {
		return nil
	}
	if *lat < minLat || *lat > maxLat || *lng < minLng || *lng > maxLng {
		return ErrInvalidLocation
	}
	return nil
}
