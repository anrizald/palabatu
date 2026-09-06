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
// decision 22 asks for, kept separate from CanEditOwned so a kind's policy
// can move independently of "owns this resource." It shipped identical to
// CanEditOwned for every kind (creator-or-admin, i.e. today's behaviour
// exactly) so nothing changed on day one -- see git history before
// 2026-09-06 if you need that baseline.
//
// Widened 2026-09-06 (handoff.md open item 11, resolved): KindAddPhoto and
// KindAddApproach now grant to any signed-in user. The person best placed to
// supply a missing photo, or document a walk-in, is whoever is standing at
// the rock right now, not the entity's creator -- and every call site sits
// behind middleware.RequireAuth, so userID is already guaranteed to be a
// real signed-in user by the time this runs. ownerID/titles stay unused for
// these two kinds but are not dropped from the signature, so a kind can be
// pulled back to creator-or-admin, or a new kind added with its own answer,
// without touching any call site. KindAddNote has no call site yet and
// stays on CanEditOwned's default until it has one to decide against.
//
// Removing someone else's contribution is a different question and
// unaffected by this: every delete path (DeleteBoulderImage,
// DeleteCragImage, DeleteProblemImage, DeleteApproach) still calls
// CanEditOwned directly, not this function, so only the creator or an admin
// can take a photo or approach back down.
func CanContribute(userID string, kind ContributionKind, ownerID *string, titles []string) bool {
	switch kind {
	case KindAddPhoto, KindAddApproach:
		return userID != ""
	default:
		return CanEditOwned(userID, ownerID, titles)
	}
}
