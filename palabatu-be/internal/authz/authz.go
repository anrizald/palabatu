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

// CanEditOwned grants CRUD on a resource (a problem, a comment, ...) to two
// groups: admins (title includes "Council" or "Associate") and the
// resource's own owner, identified by ownerID.
func CanEditOwned(userID string, ownerID *string, titles []string) bool {
	isOwner := ownerID != nil && *ownerID == userID
	return isOwner || IsAdmin(titles)
}
