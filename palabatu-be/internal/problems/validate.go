package problems

import "strings"

// gradeScales mirrors palabatu-fe/src/lib/constants.ts's GRADE_SCALES. The
// frontend and backend are separate projects with no shared config, so this
// has to be kept in sync by hand if the frontend's grade lists change.
var gradeScales = [][]string{
	{"V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12", "V13", "V14", "V15"},
	{"4", "4+", "5", "5+", "6A", "6A+", "6B", "6B+", "6C", "6C+", "7A", "7A+", "7B", "7B+", "7C", "7C+", "8A", "8A+", "8B", "8B+", "8C"},
	{"5.5", "5.6", "5.7", "5.8", "5.9", "5.10a", "5.10b", "5.10c", "5.10d", "5.11a", "5.11b", "5.11c", "5.11d", "5.12a", "5.12b", "5.12c", "5.12d", "5.13a", "5.13b", "5.13c", "5.13d"},
	{"5", "5+", "6a", "6a+", "6b", "6b+", "6c", "6c+", "7a", "7a+", "7b", "7b+", "7c", "7c+", "8a", "8a+", "8b", "8b+", "8c", "8c+"},
}

func gradeInScale(grade string, scale []string) bool {
	for _, g := range scale {
		if g == grade {
			return true
		}
	}
	return false
}

// validateGrade accepts a single grade token (e.g. "V4") or a range
// "from-to" (e.g. "V3-V5"), and requires that the token(s) belong to one of
// the known scales. A range's two endpoints must come from the same scale.
// An empty grade is left alone (the frontend doesn't require one).
func validateGrade(grade string) error {
	if grade == "" {
		return nil
	}

	parts := strings.SplitN(grade, "-", 2)
	if len(parts) == 1 {
		for _, scale := range gradeScales {
			if gradeInScale(parts[0], scale) {
				return nil
			}
		}
		return ErrInvalidGrade
	}

	for _, scale := range gradeScales {
		if gradeInScale(parts[0], scale) && gradeInScale(parts[1], scale) {
			return nil
		}
	}
	return ErrInvalidGrade
}

// Indonesia's bounding box, padded slightly beyond the country's actual
// extent (roughly -11.2..6.1 lat, 94.7..141.1 lng) to avoid rejecting
// legitimate spots near the border/coastline.
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
