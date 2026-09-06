// Package photocredits records who added a given photo to a crag, boulder or
// problem, and reads those credits back for display.
//
// It exists because handoff.md decision 22 requires attribution on every
// additive contribution before authz.CanContribute's policy can widen past
// creator-or-admin, and photos had none: crags.image_urls, boulders.image_urls
// and problems.image_urls are all jsonb arrays of bare URL strings. Approaches
// already had attribution at the right granularity (approaches.created_by), so
// this closes the gap for the one kind that lacked it. See migrations/0021 for
// why this is a sidecar table rather than a reshaped image_urls column.
//
// Shared infrastructure used by three domains, in the same shape as
// internal/cloudinary: it takes already-fetched ids as arguments, owns its own
// table and nothing else, and imports no domain package -- so crags, boulders
// and problems can all reach for it without any of them importing each other.
package photocredits

import (
	"context"
	"time"

	"palabatu-be/internal/db"
)

// Kind names the level a photo hangs off. The same three values back
// photo_credits.entity_kind's CHECK constraint; keep them in step.
type Kind string

const (
	KindCrag    Kind = "crag"
	KindBoulder Kind = "boulder"
	KindProblem Kind = "problem"
)

// Credit is one recorded photo contribution. Username is nil when the
// uploader's account is gone (uploaded_by is ON DELETE SET NULL) or has no
// profile row -- render the photo without a credit line rather than
// inventing one.
//
// An absent Credit is not the same as an unknown one: until the contribution
// policy widens, a photo with no row was added by the entity's creator, since
// that is what the authorization allowed. Callers fall back to the entity's
// own creator_name rather than showing "unknown".
type Credit struct {
	ImageURL   string    `json:"image_url"`
	UploadedBy *string   `json:"uploaded_by"`
	Username   *string   `json:"username"`
	CreatedAt  time.Time `json:"created_at"`
}

// Record credits every URL in urls to uploadedBy. Called from the add-photo
// paths only -- never from entity creation, where the uploader is the creator
// by definition and the absent-row fallback already says so.
//
// ON CONFLICT DO NOTHING so the first crediter of a URL keeps it: re-adding a
// URL that somehow still has a row is not a reason to reassign authorship, and
// the ordinary remove-then-re-add path deletes the row on the way out anyway.
func Record(ctx context.Context, kind Kind, entityID, uploadedBy string, urls []string) error {
	if len(urls) == 0 {
		return nil
	}

	_, err := db.Pool.Exec(ctx,
		`INSERT INTO photo_credits (entity_kind, entity_id, image_url, uploaded_by)
		 SELECT $1, $2, unnest($3::text[]), $4
		 ON CONFLICT (entity_kind, entity_id, image_url) DO NOTHING`,
		string(kind), entityID, urls, uploadedBy)
	return err
}

// Remove drops the credit for one photo. Called wherever a single image is
// removed from an entity, alongside the cloudinary.DestroyByURL that already
// happens there.
func Remove(ctx context.Context, kind Kind, entityID, url string) error {
	_, err := db.Pool.Exec(ctx,
		`DELETE FROM photo_credits WHERE entity_kind = $1 AND entity_id = $2 AND image_url = $3`,
		string(kind), entityID, url)
	return err
}

// RemoveEntity drops every credit for one entity, for the paths that delete
// the entity itself. Nothing else will: there is no FK from a jsonb array
// element to cascade from.
func RemoveEntity(ctx context.Context, kind Kind, entityID string) error {
	_, err := db.Pool.Exec(ctx,
		`DELETE FROM photo_credits WHERE entity_kind = $1 AND entity_id = $2`,
		string(kind), entityID)
	return err
}

// RemoveURLs drops credits for a set of photos regardless of which entity or
// level they hang off. This is the crags purge's path: it destroys a crag,
// its rocks and their problems in one transaction, so scoping the cleanup by
// entity would mean collecting ids at three levels when the purge already
// holds the flat URL list it feeds to cloudinary.DestroyByURL. A Cloudinary
// URL is unique per upload, so matching on it alone cannot touch a photo
// belonging to something that survives.
func RemoveURLs(ctx context.Context, urls []string) error {
	if len(urls) == 0 {
		return nil
	}

	_, err := db.Pool.Exec(ctx,
		`DELETE FROM photo_credits WHERE image_url = ANY($1::text[])`, urls)
	return err
}

// List returns every credit recorded against one entity, oldest first.
// Callers attach these to a single-entity GET only -- a list endpoint would
// turn this into one query per row for a line of text nobody reads at that
// zoom level.
func List(ctx context.Context, kind Kind, entityID string) ([]Credit, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT pc.image_url, pc.uploaded_by, pr.username, pc.created_at
		   FROM photo_credits pc
		   LEFT JOIN profiles pr ON pc.uploaded_by = pr.id
		  WHERE pc.entity_kind = $1 AND pc.entity_id = $2
		  ORDER BY pc.created_at ASC`,
		string(kind), entityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	credits := []Credit{}
	for rows.Next() {
		var c Credit
		if err := rows.Scan(&c.ImageURL, &c.UploadedBy, &c.Username, &c.CreatedAt); err != nil {
			return nil, err
		}
		credits = append(credits, c)
	}
	return credits, rows.Err()
}
