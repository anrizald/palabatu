// Package drafts is the backend half of the add sheet's autosave feature
// (handoff-drafts.md). Milestone 1 (2026-08-17) was IndexedDB-only,
// same-device recovery from an interrupted session; this is Milestone 2,
// cross-device and reinstall survival. Every route is scoped to the calling
// user -- a draft is private, pre-submission scratch state (decision 7), not
// a shared or moderated entity, so there is no admin path here at all.
//
// payload is stored and returned opaque (json.RawMessage): this domain
// mirrors whatever shape palabatu-fe's add-sheet/types.ts sends, the same
// way auth.Profile.Title/Tags pass through FE-defined shapes untyped.
// photo_urls travels alongside it, not parsed out of it, so cleanup never
// has to interpret that shape (see dto.go).
package drafts

import (
	"context"
	"encoding/json"
	"errors"
	"log"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/cloudinary"
)

func validIntent(intent string) bool {
	return intent == "problem" || intent == "spot" || intent == "rock"
}

func ListDrafts(ctx context.Context, userID string) ([]DraftListItem, error) {
	return listDrafts(ctx, userID)
}

func GetDraft(ctx context.Context, userID, id string) (*Draft, error) {
	d, err := getDraft(ctx, userID, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return d, nil
}

// CreateDraft is the first autosave of a session (handoff-drafts.md decision
// 3: lazy creation on the first real edit, not on opening the sheet).
func CreateDraft(ctx context.Context, userID, intent, label string, payload json.RawMessage, photoURLs []string) (*Draft, error) {
	if !validIntent(intent) {
		return nil, ErrInvalidIntent
	}
	if photoURLs == nil {
		photoURLs = []string{}
	}
	return createDraft(ctx, userID, intent, label, payload, photoURLs)
}

// UpdateDraft is every autosave after the first. Any photo URL the previous
// version of this draft carried that the new version doesn't is a
// provisional upload this write just orphaned -- either the person removed
// the staged photo, or picked a different one -- and is destroyed
// best-effort, the same treatment every other domain's photo-delete paths
// give a Cloudinary failure (log it, never fail the request over it;
// handoff-drafts.md decision 10).
func UpdateDraft(ctx context.Context, userID, id, label string, payload json.RawMessage, photoURLs []string) (*Draft, error) {
	if photoURLs == nil {
		photoURLs = []string{}
	}
	updated, previousPhotoURLs, err := updateDraft(ctx, userID, id, label, payload, photoURLs)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	stillReferenced := make(map[string]bool, len(photoURLs))
	for _, url := range photoURLs {
		stillReferenced[url] = true
	}
	for _, url := range previousPhotoURLs {
		if stillReferenced[url] {
			continue
		}
		if err := cloudinary.DestroyByURL(ctx, url); err != nil {
			log.Printf("failed to delete orphaned draft photo from Cloudinary: %v", err)
		}
	}

	return updated, nil
}

// DeleteDraft removes the row. Whether it also destroys the photos it
// staged depends on why it's being deleted, which is the one place this
// package deliberately diverges from handoff-drafts.md's literal text --
// that doc describes a single DELETE covering both "explicit removal" and
// "post-submit cleanup" and has both destroy photos. That's wrong for the
// second trigger: by the time a submitted draft is cleaned up, submitProblem
// et al. have already reused this draft's uploaded URLs as the real
// problem/boulder/crag's own photo (decision 10 exists precisely so the
// final submit doesn't have to re-upload) -- destroying them here would take
// down a live entity's photo seconds after it was attached. keepPhotos=true
// is the post-submit path: delete the row, leave Cloudinary alone. False is
// genuine abandonment (the drafts-list "Remove" button, or the "Undo" toast
// deleting a draft nobody meant to keep) -- there the photos really are
// only reachable through this draft, and decision 10's leak concern applies
// in full: log-and-continue on a Cloudinary failure, same as everywhere else.
func DeleteDraft(ctx context.Context, userID, id string, keepPhotos bool) error {
	photoURLs, err := deleteDraft(ctx, userID, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if keepPhotos {
		return nil
	}
	for _, url := range photoURLs {
		if err := cloudinary.DestroyByURL(ctx, url); err != nil {
			log.Printf("failed to delete draft photo from Cloudinary: %v", err)
		}
	}
	return nil
}
