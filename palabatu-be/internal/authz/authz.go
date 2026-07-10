// Package authz holds shared admin-role policy. It is deliberately
// stateless: functions take already-fetched data (titles, IDs) as
// arguments rather than reaching into another domain's repository, so the
// dependency direction stays one-way (problems/social/auth -> authz) with
// no risk of an import cycle.
package authz

// adminTitles are the profiles.title values that grant CRUD privileges on
// any problem, not just ones the holder created themselves.
var adminTitles = map[string]bool{"Council": true, "Associate": true}

// IsAdmin reports whether any of the given profile titles grant admin
// (Council/Associate) privileges.
func IsAdmin(titles []string) bool {
	for _, t := range titles {
		if adminTitles[t] {
			return true
		}
	}
	return false
}

// CanEditProblem grants CRUD on a problem to two groups: admins (title
// includes "Council" or "Associate") and that problem's own creator — its
// "Founder" — who may only edit/delete the problem(s) they added.
func CanEditProblem(userID string, createdBy *string, titles []string) bool {
	isFounder := createdBy != nil && *createdBy == userID
	return isFounder || IsAdmin(titles)
}
