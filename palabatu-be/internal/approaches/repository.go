package approaches

import (
	"context"
	"time"

	"palabatu-be/internal/db"
)

// ApproachStep is one photographed step of the walk in, in order.
// Lat/Lng are optional (handoff.md decision 21: "an optional coordinate per
// step") -- when present, the reading view can open on the step the user is
// nearest. CarefulFlag survives skim-reading where a sentence doesn't
// ("slippery after rain", "easy to miss", "ask permission first").
type ApproachStep struct {
	ID          string    `json:"id"`
	ApproachID  string    `json:"approach_id"`
	Position    int       `json:"position"`
	PhotoURL    string    `json:"photo_url"`
	Caption     string    `json:"caption"`
	Lat         *float64  `json:"lat"`
	Lng         *float64  `json:"lng"`
	CarefulFlag bool      `json:"careful_flag"`
	CreatedAt   time.Time `json:"created_at"`
}

// Approach is one way in ("jalan masuk") to a crag -- handoff.md decision
// 21. A crag may have several; "from the angkot" and "from the village with
// a motor" are genuinely different walks, and each is its own row rather
// than a shared, edited-by-everyone document.
type Approach struct {
	ID              string         `json:"id"`
	CragID          string         `json:"crag_id"`
	Name            *string        `json:"name"`
	StartType       string         `json:"start_type"`
	DurationMinutes *int           `json:"duration_minutes"`
	CreatedBy       *string        `json:"created_by"`
	CreatorName     *string        `json:"creator_name"`
	CreatedAt       time.Time      `json:"created_at"`
	Steps           []ApproachStep `json:"steps"`
}

// ApproachListItem is the shape returned by GET /crags/:id/approaches --
// enough for a crag page's "Jalan masuk" list without fetching every
// approach's full step set. StartLat/StartLng back the map's third zoom
// layer (handoff.md open item 13: "an approach's start point, drawn as its
// own marker kind") -- the first step, by position, that actually has a
// coordinate; nil when none of the steps were pinned.
type ApproachListItem struct {
	ID              string    `json:"id"`
	CragID          string    `json:"crag_id"`
	Name            *string   `json:"name"`
	StartType       string    `json:"start_type"`
	DurationMinutes *int      `json:"duration_minutes"`
	StepCount       int       `json:"step_count"`
	FirstPhotoURL   *string   `json:"first_photo_url"`
	StartLat        *float64  `json:"start_lat"`
	StartLng        *float64  `json:"start_lng"`
	CreatedBy       *string   `json:"created_by"`
	CreatorName     *string   `json:"creator_name"`
	CreatedAt       time.Time `json:"created_at"`
}

func listApproaches(ctx context.Context, cragID string) ([]ApproachListItem, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT
			a.id, a.crag_id, a.name, a.start_type, a.duration_minutes,
			COALESCE((SELECT COUNT(*) FROM approach_steps WHERE approach_id = a.id), 0)::int AS step_count,
			(SELECT photo_url FROM approach_steps WHERE approach_id = a.id ORDER BY position ASC LIMIT 1) AS first_photo_url,
			(SELECT lat FROM approach_steps WHERE approach_id = a.id AND lat IS NOT NULL ORDER BY position ASC LIMIT 1) AS start_lat,
			(SELECT lng FROM approach_steps WHERE approach_id = a.id AND lng IS NOT NULL ORDER BY position ASC LIMIT 1) AS start_lng,
			a.created_by, pr.username AS creator_name, a.created_at
		FROM approaches a
		LEFT JOIN profiles pr ON a.created_by = pr.id
		WHERE a.crag_id = $1
		ORDER BY a.created_at ASC
	`, cragID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []ApproachListItem{}
	for rows.Next() {
		var a ApproachListItem
		if err := rows.Scan(
			&a.ID, &a.CragID, &a.Name, &a.StartType, &a.DurationMinutes,
			&a.StepCount, &a.FirstPhotoURL, &a.StartLat, &a.StartLng, &a.CreatedBy, &a.CreatorName, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

func getApproach(ctx context.Context, id string) (*Approach, error) {
	var a Approach
	err := db.Pool.QueryRow(ctx, `
		SELECT a.id, a.crag_id, a.name, a.start_type, a.duration_minutes,
			a.created_by, pr.username AS creator_name, a.created_at
		FROM approaches a
		LEFT JOIN profiles pr ON a.created_by = pr.id
		WHERE a.id = $1
	`, id).Scan(&a.ID, &a.CragID, &a.Name, &a.StartType, &a.DurationMinutes, &a.CreatedBy, &a.CreatorName, &a.CreatedAt)
	if err != nil {
		return nil, err
	}

	steps, err := listStepsForApproach(ctx, id)
	if err != nil {
		return nil, err
	}
	a.Steps = steps
	return &a, nil
}

func listStepsForApproach(ctx context.Context, approachID string) ([]ApproachStep, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, approach_id, position, photo_url, caption, lat, lng, careful_flag, created_at
		FROM approach_steps
		WHERE approach_id = $1
		ORDER BY position ASC
	`, approachID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	steps := []ApproachStep{}
	for rows.Next() {
		var s ApproachStep
		if err := rows.Scan(
			&s.ID, &s.ApproachID, &s.Position, &s.PhotoURL, &s.Caption, &s.Lat, &s.Lng, &s.CarefulFlag, &s.CreatedAt,
		); err != nil {
			return nil, err
		}
		steps = append(steps, s)
	}
	return steps, rows.Err()
}

// getCragCreator is a direct SQL read against crags' own table, not a Go
// import of internal/crags -- mirrors problems.getBoulderCragID's
// dependency-direction reasoning (see that package's doc comment): domains
// reach into each other's tables with their own SQL rather than importing
// each other's package, so the dependency graph stays acyclic.
func getCragCreator(ctx context.Context, cragID string) (*string, error) {
	var createdBy *string
	err := db.Pool.QueryRow(ctx, `SELECT created_by FROM crags WHERE id = $1`, cragID).Scan(&createdBy)
	if err != nil {
		return nil, err
	}
	return createdBy, nil
}

func getApproachCreator(ctx context.Context, id string) (*string, error) {
	var createdBy *string
	err := db.Pool.QueryRow(ctx, `SELECT created_by FROM approaches WHERE id = $1`, id).Scan(&createdBy)
	if err != nil {
		return nil, err
	}
	return createdBy, nil
}

// createApproach inserts the approach row and every step in one
// transaction -- decision 21's "photos first, captions second... submitted
// once", not built up over several requests. name is stored NULL when
// empty (most approaches won't have an explicit label; the frontend derives
// a display label from start_type when name is absent).
func createApproach(ctx context.Context, cragID, name, startType string, durationMinutes *int, steps []CreateApproachStepInput, createdBy string) (*Approach, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var namePtr *string
	if name != "" {
		namePtr = &name
	}

	var a Approach
	err = tx.QueryRow(ctx,
		`INSERT INTO approaches (crag_id, name, start_type, duration_minutes, created_by)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, crag_id, name, start_type, duration_minutes, created_by, created_at`,
		cragID, namePtr, startType, durationMinutes, createdBy,
	).Scan(&a.ID, &a.CragID, &a.Name, &a.StartType, &a.DurationMinutes, &a.CreatedBy, &a.CreatedAt)
	if err != nil {
		return nil, err
	}

	a.Steps = make([]ApproachStep, 0, len(steps))
	for i, s := range steps {
		var step ApproachStep
		err = tx.QueryRow(ctx,
			`INSERT INTO approach_steps (approach_id, position, photo_url, caption, lat, lng, careful_flag)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 RETURNING id, approach_id, position, photo_url, caption, lat, lng, careful_flag, created_at`,
			a.ID, i, s.PhotoURL, s.Caption, s.Lat, s.Lng, s.CarefulFlag,
		).Scan(&step.ID, &step.ApproachID, &step.Position, &step.PhotoURL, &step.Caption, &step.Lat, &step.Lng, &step.CarefulFlag, &step.CreatedAt)
		if err != nil {
			return nil, err
		}
		a.Steps = append(a.Steps, step)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &a, nil
}

func deleteApproachRow(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM approaches WHERE id = $1`, id)
	return err
}
