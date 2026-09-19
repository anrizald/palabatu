package problems

import "unicode/utf8"

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

// maxNameLen caps a user-typed name. Nothing capped these before -- not the
// inputs, not the handlers, and the columns are unbounded `text` -- so a
// pasted essay was a valid problem name, and no amount of CSS makes that a
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

// maxPitchCount bounds pitch_count, pitch_number and the number of pitch rows.
// The schema only says pitch_count >= 2. This is well above the longest routes
// there are (El Capitan's Nose is 31), so it stops garbage without ever
// turning away a real route.
const maxPitchCount = 100

// maxPitchLengthM and maxPitchNotesLen are the same kind of sanity bound for a
// single pitch's own length (a rope is 60 to 80 m) and free-text note.
const (
	maxPitchLengthM  = 1000
	maxPitchNotesLen = 1000
)

// commitmentGrades are the French overall grades, plain letters with no +/-
// modifiers. Mirrors problems_commitment_grade_check (migrations/0023) and
// palabatu-fe/src/lib/constants.ts's COMMITMENT_GRADES.
var commitmentGrades = []string{"F", "PD", "AD", "D", "TD", "ED"}

// validatePitchCount accepts nil (single pitch) or 2..maxPitchCount. 0 and 1
// are rejected rather than folded into nil, so a client finds out that "1 pitch"
// is not a thing this API stores.
func validatePitchCount(n *int) error {
	if n != nil && (*n < 2 || *n > maxPitchCount) {
		return ErrInvalidPitchCount
	}
	return nil
}

// validateCommitmentGrade accepts one of the six grades, or empty, which is
// how a client clears it.
func validateCommitmentGrade(g string) error {
	if g == "" || gradeInScale(g, commitmentGrades) {
		return nil
	}
	return ErrInvalidCommitmentGrade
}

// validatePitches checks each row on its own (a positive number, a real grade,
// a sane length and note) and that no two share a pitch number. It deliberately
// does not compare against pitch_count or the route's height_m: how much of a
// route is documented is allowed to lag the claim about it.
func validatePitches(pitches []Pitch) error {
	if len(pitches) > maxPitchCount {
		return ErrInvalidPitches
	}
	seen := make(map[int]bool, len(pitches))
	for _, p := range pitches {
		if p.PitchNumber < 1 || p.PitchNumber > maxPitchCount || seen[p.PitchNumber] {
			return ErrInvalidPitches
		}
		seen[p.PitchNumber] = true

		if p.Grade == "" || validateGrade(p.Grade) != nil {
			return ErrInvalidPitches
		}
		// The negated form also rejects NaN, which no comparison is true for.
		if p.LengthM != nil && !(*p.LengthM > 0 && *p.LengthM <= maxPitchLengthM) {
			return ErrInvalidPitches
		}
		if p.Notes != nil && utf8.RuneCountInString(*p.Notes) > maxPitchNotesLen {
			return ErrInvalidPitches
		}
	}
	return nil
}
