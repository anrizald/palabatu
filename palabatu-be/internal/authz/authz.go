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

// ContributionKind distinguishes an additive contribution to someone else's
// entity (a photo, an approach, a note) from a change to their existing
// words (edit_field, delete) -- see handoff.md decision 22. Only the
// additive kinds go through CanContribute; changing or removing someone
// else's content stays on CanEditOwned directly, unchanged.
type ContributionKind string

const (
	KindAddPhoto    ContributionKind = "add_photo"
	KindAddApproach ContributionKind = "add_approach"
	KindAddNote     ContributionKind = "add_note"
)

// CanContribute is the collaborative-contribution mechanism handoff.md
// decision 22 asks for, separated from the (still undecided) policy of who
// it grants to. It ships identical to CanEditOwned -- creator-or-admin for
// every kind, i.e. today's behaviour exactly -- so nothing changes on day
// one. Widening a single kind to "any signed-in user" is a one-line change
// in this function later, not an audit of every call site that uses it.
func CanContribute(userID string, kind ContributionKind, ownerID *string, titles []string) bool {
	_ = kind // not yet used to differentiate policy -- see doc comment above
	return CanEditOwned(userID, ownerID, titles)
}
