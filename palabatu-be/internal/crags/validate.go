package crags

// Indonesia's bounding box, padded slightly beyond the country's actual
// extent -- mirrors problems/validate.go's identical constants, kept as
// this domain's own copy rather than a shared package, matching this
// codebase's existing per-domain-validator convention.
const (
	minLat = -11.5
	maxLat = 6.5
	minLng = 94.5
	maxLng = 141.5
)

func validateLatLng(lat, lng float64) error {
	if lat < minLat || lat > maxLat || lng < minLng || lng > maxLng {
		return ErrInvalidLocation
	}
	return nil
}
