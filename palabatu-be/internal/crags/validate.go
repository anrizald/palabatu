package crags

import "unicode/utf8"

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

// maxNameLen caps a user-typed name. Nothing capped these before -- not the
// inputs, not the handlers, and the columns are unbounded `text` -- so a
// pasted essay was a valid crag name, and no amount of CSS makes that a
// good row. Capping at the source bounds the problem once instead of at every
// surface that renders it. 120 runes is far above anything real (the longest
// name in the seed data is 31) and still short enough to lay out.
//
// Runes, not bytes: a byte cap would cut a multi-byte character in half and
// silently shorten non-ASCII names more than ASCII ones.
const maxNameLen = 250

func validateName(name string) error {
	if utf8.RuneCountInString(name) > maxNameLen {
		return ErrNameTooLong
	}
	return nil
}
