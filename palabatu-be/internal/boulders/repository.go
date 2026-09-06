package boulders

import (
	"context"
	"encoding/json"
	"time"

	"palabatu-be/internal/db"
	"palabatu-be/internal/photocredits"
)

// Boulder is one rock at a crag -- the middle level of the crags ->
// boulders -> problems hierarchy (see handoff.md at the repo root). It owns
// the photo(s) climbers draw their lines on; every problem on it shares the
// same image set.
type Boulder struct {
	ID         string    `json:"id"`
	CragID     string    `json:"crag_id"`
	Name       *string   `json:"name"`
	ImageURLs  []string  `json:"image_urls"`
	Type       string    `json:"type"`
	RockType   *string   `json:"rock_type"`
	Lat        *float64  `json:"lat"`
	Lng        *float64  `json:"lng"`
	MergedInto *string   `json:"merged_into"`
	CreatedBy  *string   `json:"created_by"`
	CreatedAt  time.Time `json:"created_at"`
}

// BoulderListItem is the shape returned by GET /crags/:cragId/boulders and
// GET /boulders/:id -- Boulder plus a creator name and how many problems
// are on it, so the future photo-grid boulder picker and the dimmed
// empty-boulder state (handoff.md open item 1) don't need a second
// round-trip. SampleProblemName backs UX principle 3's photoless-rock
// fallback -- "a photoless tile must identify itself by the problems on
// it... falling back to a bare index is not acceptable" -- the oldest
// problem on the rock, or nil if it has none yet.
type BoulderListItem struct {
	ID                string    `json:"id"`
	CragID            string    `json:"crag_id"`
	Name              *string   `json:"name"`
	ImageURLs         []string  `json:"image_urls"`
	Type              string    `json:"type"`
	RockType          *string   `json:"rock_type"`
	Lat               *float64  `json:"lat"`
	Lng               *float64  `json:"lng"`
	MergedInto        *string   `json:"merged_into"`
	CreatedBy         *string   `json:"created_by"`
	CreatorName       *string   `json:"creator_name"`
	ProblemCount      int       `json:"problem_count"`
	SampleProblemName *string   `json:"sample_problem_name"`
	CreatedAt         time.Time `json:"created_at"`

	// ImageCredits is populated by GetBoulder only, never by listBoulders --
	// hence omitempty, so list responses stay byte-identical. An image with
	// no entry here was added by this boulder's own creator; see
	// internal/photocredits for why absent means the creator rather than
	// unknown.
	ImageCredits []photocredits.Credit `json:"image_credits,omitempty"`
}

const boulderListSelect = `
	SELECT
		b.id, b.crag_id, b.name, b.image_urls, b.type, b.rock_type, b.lat, b.lng,
		b.merged_into, b.created_by, pr.username AS creator_name,
		COALESCE((SELECT COUNT(*) FROM problems WHERE boulder_id = b.id), 0)::int AS problem_count,
		(SELECT name FROM problems WHERE boulder_id = b.id ORDER BY created_at ASC LIMIT 1) AS sample_problem_name,
		b.created_at
	FROM boulders b
	LEFT JOIN profiles pr ON b.created_by = pr.id
`

func listBoulders(ctx context.Context, cragID string) ([]BoulderListItem, error) {
	rows, err := db.Pool.Query(ctx, boulderListSelect+" WHERE b.crag_id = $1", cragID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	boulders := []BoulderListItem{}
	for rows.Next() {
		var b BoulderListItem
		if err := rows.Scan(
			&b.ID, &b.CragID, &b.Name, &b.ImageURLs, &b.Type, &b.RockType, &b.Lat, &b.Lng,
			&b.MergedInto, &b.CreatedBy, &b.CreatorName, &b.ProblemCount, &b.SampleProblemName, &b.CreatedAt,
		); err != nil {
			return nil, err
		}
		boulders = append(boulders, b)
	}
	return boulders, rows.Err()
}

func getBoulder(ctx context.Context, id string) (*BoulderListItem, error) {
	var b BoulderListItem
	err := db.Pool.QueryRow(ctx, boulderListSelect+" WHERE b.id = $1", id).Scan(
		&b.ID, &b.CragID, &b.Name, &b.ImageURLs, &b.Type, &b.RockType, &b.Lat, &b.Lng,
		&b.MergedInto, &b.CreatedBy, &b.CreatorName, &b.ProblemCount, &b.SampleProblemName, &b.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func createBoulder(ctx context.Context, cragID, name, boulderType, rockType string, lat, lng *float64, imageURLs []string, createdBy string, filedUncertain *bool) (*Boulder, error) {
	if imageURLs == nil {
		imageURLs = []string{}
	}
	imageURLsJSON, err := json.Marshal(imageURLs)
	if err != nil {
		return nil, err
	}

	var b Boulder
	err = db.Pool.QueryRow(ctx,
		`INSERT INTO boulders (crag_id, name, image_urls, type, rock_type, lat, lng, created_by, filed_uncertain)
		 VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9)
		 RETURNING id, crag_id, name, image_urls, type, rock_type, lat, lng, merged_into, created_by, created_at`,
		cragID, name, string(imageURLsJSON), boulderType, rockType, lat, lng, createdBy, filedUncertain,
	).Scan(&b.ID, &b.CragID, &b.Name, &b.ImageURLs, &b.Type, &b.RockType, &b.Lat, &b.Lng, &b.MergedInto, &b.CreatedBy, &b.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func getBoulderCreator(ctx context.Context, id string) (*string, error) {
	var createdBy *string
	err := db.Pool.QueryRow(ctx, `SELECT created_by FROM boulders WHERE id = $1`, id).Scan(&createdBy)
	if err != nil {
		return nil, err
	}
	return createdBy, nil
}

// getBoulderOwnerAndImages backs DeleteBoulderImage's authorization check
// and Cloudinary cleanup.
func getBoulderOwnerAndImages(ctx context.Context, id string) (createdBy *string, imageURLs []string, err error) {
	err = db.Pool.QueryRow(ctx, `SELECT created_by, image_urls FROM boulders WHERE id = $1`, id).Scan(&createdBy, &imageURLs)
	if err != nil {
		return nil, nil, err
	}
	return createdBy, imageURLs, nil
}

func updateBoulderRow(ctx context.Context, id, name, boulderType, rockType string, lat, lng *float64) (*Boulder, error) {
	var b Boulder
	err := db.Pool.QueryRow(ctx,
		`UPDATE boulders SET name = $1, type = $2, rock_type = $3, lat = $4, lng = $5 WHERE id = $6
		 RETURNING id, crag_id, name, image_urls, type, rock_type, lat, lng, merged_into, created_by, created_at`,
		name, boulderType, rockType, lat, lng, id,
	).Scan(&b.ID, &b.CragID, &b.Name, &b.ImageURLs, &b.Type, &b.RockType, &b.Lat, &b.Lng, &b.MergedInto, &b.CreatedBy, &b.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// reparentBoulder moves a boulder to a different crag and cascades the
// denormalized crag_id onto every problem already on it (handoff.md
// decision 13 -- "anything can be re-parented"; problems.crag_id is
// denormalized off boulder_id specifically so hot queries skip a join, and
// that denormalization is exactly what has to stay consistent here). Both
// writes happen in one transaction. The new crag's existence is enforced by
// the boulders_crag_id_fkey constraint -- callers translate that violation
// to ErrCragNotFound, same pattern as createBoulder.
func reparentBoulder(ctx context.Context, id, newCragID string) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `UPDATE boulders SET crag_id = $1 WHERE id = $2`, newCragID, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE problems SET crag_id = $1 WHERE boulder_id = $2`, newCragID, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// addBoulderImages appends newURLs to a boulder's image_urls jsonb array --
// same `|| $2::jsonb` pattern as problems.addProblemImages did before the
// photo ownership move.
func addBoulderImages(ctx context.Context, id string, newURLs []string) (*Boulder, error) {
	newURLsJSON, err := json.Marshal(newURLs)
	if err != nil {
		return nil, err
	}

	var b Boulder
	err = db.Pool.QueryRow(ctx,
		`UPDATE boulders SET image_urls = image_urls || $2::jsonb WHERE id = $1
		 RETURNING id, crag_id, name, image_urls, type, rock_type, lat, lng, merged_into, created_by, created_at`,
		id, string(newURLsJSON),
	).Scan(&b.ID, &b.CragID, &b.Name, &b.ImageURLs, &b.Type, &b.RockType, &b.Lat, &b.Lng, &b.MergedInto, &b.CreatedBy, &b.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// removeBoulderImage drops one URL from a boulder's image_urls jsonb array.
// The ::text cast disambiguates jsonb's overloaded "-" operator, same
// reasoning as problems.removeProblemImage had before the photo ownership
// move.
func removeBoulderImage(ctx context.Context, id, url string) error {
	_, err := db.Pool.Exec(ctx, `UPDATE boulders SET image_urls = image_urls - $2::text WHERE id = $1`, id, url)
	return err
}

// deleteAnnotationsForImage removes every problem-on-this-boulder's
// annotation on a (now-removed) image -- direct SQL against
// problems/topo_annotations rather than importing internal/problems, same
// one-way-dependency shape as devtools' cross-domain table reads (problems
// imports nothing from boulders' Go package either -- see internal/problems
// for the mirror image of this).
func deleteAnnotationsForImage(ctx context.Context, boulderID, imageURL string) error {
	_, err := db.Pool.Exec(ctx, `
		DELETE FROM topo_annotations
		WHERE image_url = $2 AND problem_id IN (SELECT id FROM problems WHERE boulder_id = $1)
	`, boulderID, imageURL)
	return err
}

// hasForeignAnnotation reports whether some problem on this boulder, other
// than one created by deleterID, has a line drawn on this exact photo.
// handoff.md item 15's guard: a rock's photo is the shared topo canvas every
// problem on it draws against (see item 16), so a bare uploader match isn't
// enough to let a contributor self-delete it -- this is what stops them
// from taking down annotations that belong to problems they have no
// relationship to.
func hasForeignAnnotation(ctx context.Context, boulderID, imageURL, deleterID string) (bool, error) {
	var exists bool
	err := db.Pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM topo_annotations ta
			JOIN problems p ON p.id = ta.problem_id
			WHERE ta.image_url = $1 AND p.boulder_id = $2 AND p.created_by IS DISTINCT FROM $3
		)
	`, imageURL, boulderID, deleterID).Scan(&exists)
	return exists, err
}

// BoulderAnnotation mirrors problems.AnnotationRecord's shape -- duplicated
// rather than imported (same one-way-dependency reasoning as above).
type BoulderAnnotation struct {
	ID        string          `json:"id"`
	ProblemID string          `json:"problem_id"`
	ImageURL  string          `json:"image_url"`
	Data      json.RawMessage `json:"data"`
	UpdatedBy *string         `json:"updated_by"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// listAnnotationsForBoulder returns every problem-on-this-boulder's
// annotation row together, so a boulder's photo can be rendered with every
// problem's line on it at once (handoff.md decision 2: "one photo, N
// lines").
func listAnnotationsForBoulder(ctx context.Context, boulderID string) ([]BoulderAnnotation, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT ta.id, ta.problem_id, ta.image_url, ta.data, ta.updated_by, ta.created_at, ta.updated_at
		FROM topo_annotations ta
		JOIN problems p ON p.id = ta.problem_id
		WHERE p.boulder_id = $1
	`, boulderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	annotations := []BoulderAnnotation{}
	for rows.Next() {
		var a BoulderAnnotation
		if err := rows.Scan(&a.ID, &a.ProblemID, &a.ImageURL, &a.Data, &a.UpdatedBy, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		annotations = append(annotations, a)
	}
	return annotations, rows.Err()
}

// problemCreatorsOnBoulder backs the merge-suggested notification fan-out
// (merge.go) -- every distinct creator of a problem on the given boulder.
func problemCreatorsOnBoulder(ctx context.Context, boulderID string) ([]string, error) {
	rows, err := db.Pool.Query(ctx, `SELECT DISTINCT created_by FROM problems WHERE boulder_id = $1 AND created_by IS NOT NULL`, boulderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// countProblemsOnBoulder backs DeleteBoulder's empty-only rule. Direct SQL
// against problems rather than a call into internal/problems, following the
// same one-way rule the rest of this package uses for the annotations and
// image-cascade queries -- boulders and problems never import each other.
func countProblemsOnBoulder(ctx context.Context, boulderID string) (int, error) {
	var n int
	err := db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM problems WHERE boulder_id = $1`, boulderID).Scan(&n)
	return n, err
}

func deleteBoulderRow(ctx context.Context, boulderID string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM boulders WHERE id = $1`, boulderID)
	return err
}

// listNeedsAttention is handoff.md open item 9's tidy-up queue: the rocks a
// contribution was filed loosely against, so UX principle 5's promise that
// "somebody tidies up later" has a surface behind it.
//
// A rock qualifies when it is still **unidentified** -- no name and no
// photo, the two things that make a rock recognisable to the next person
// (UX principle 3) -- and either of two signals applies:
//
//	said_unsure  -- filed_uncertain, written at creation time when the
//	                person picked "Not sure which one" (migrations/0020).
//	                Trustworthy: it is what they told us.
//	looks_unsure -- item 9's heuristic: it holds exactly one problem.
//	                Inferred, and the only signal available for every rock
//	                created before the flag existed, which today is all of
//	                them.
//
// The unidentified precondition is what makes this queue drainable rather
// than a permanent list of everything ever filed uncertainly. Naming or
// photographing a rock is precisely the tidying this surface asks for, so
// doing it removes the row -- no dismiss button, no flag to clear, and no
// way for the queue to disagree with what the data actually shows. It also
// keeps the flag earning its place: a "not sure" rock that has since
// collected a second problem is still anonymous and still possibly a
// duplicate, and the heuristic alone would have dropped it.
//
// Merged-away rocks are excluded: merged_into means an admin already dealt
// with it, and a resolved row in a queue of things to resolve is noise.
// Ordered flagged-first, then newest, since a stated uncertainty is both
// more reliable and more recent than an inferred one.
const needsAttentionSQL = `
	SELECT
		b.id, b.name, b.crag_id, c.name AS crag_name,
		COALESCE(jsonb_array_length(b.image_urls), 0)::int AS image_count,
		COALESCE((SELECT COUNT(*) FROM problems p WHERE p.boulder_id = b.id), 0)::int AS problem_count,
		(SELECT p.name FROM problems p WHERE p.boulder_id = b.id ORDER BY p.created_at ASC LIMIT 1) AS sample_problem_name,
		COALESCE((SELECT COUNT(*) FROM boulders sib
		          WHERE sib.crag_id = b.crag_id AND sib.id <> b.id AND sib.merged_into IS NULL), 0)::int AS sibling_count,
		b.created_by, pr.username AS creator_name,
		CASE WHEN b.filed_uncertain THEN 'said_unsure' ELSE 'looks_unsure' END AS reason,
		b.created_at
	FROM boulders b
	JOIN crags c ON c.id = b.crag_id
	LEFT JOIN profiles pr ON pr.id = b.created_by
	WHERE b.merged_into IS NULL
	  AND (b.name IS NULL OR b.name = '')
	  AND COALESCE(jsonb_array_length(b.image_urls), 0) = 0
	  AND (
	        b.filed_uncertain
	        OR (SELECT COUNT(*) FROM problems p WHERE p.boulder_id = b.id) = 1
	      )
	ORDER BY (b.filed_uncertain IS TRUE) DESC, b.created_at DESC
`

func listNeedsAttention(ctx context.Context) ([]NeedsAttentionItem, error) {
	rows, err := db.Pool.Query(ctx, needsAttentionSQL)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []NeedsAttentionItem{}
	for rows.Next() {
		var it NeedsAttentionItem
		if err := rows.Scan(
			&it.ID, &it.Name, &it.CragID, &it.CragName, &it.ImageCount, &it.ProblemCount,
			&it.SampleProblemName, &it.SiblingCount, &it.CreatedBy, &it.CreatorName,
			&it.Reason, &it.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}
