package crags

import (
	"context"
	"log"
	"time"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/cloudinary"
	"palabatu-be/internal/notification"
)

// Purging a crag is the deliberate, destructive counterpart to DeleteCrag's
// empty-only rule (handoff.md open item 8). DeleteCrag refuses anything
// with content in it; this removes a crag *and everything under it* -- the
// rocks, the lines, other people's ticks, other people's comments, the
// drawn topo lines, the approach guides, and any pending reports.
//
// It exists because the empty-only rule has no answer for a spam or
// takedown case, where the content is exactly the problem and re-parenting
// it somewhere else is not a goal. It is a separate endpoint rather than a
// flag on DeleteCrag because the two are different acts: one is tidying up
// an empty husk, the other is destroying a body of work, and an API where
// those differ by one boolean is an API where they differ by one typo.
//
// Three guarantees make this safe enough to exist at all, and none of them
// are optional -- a plain cascade delete silently skips all three, which is
// the reason this is code rather than an ON DELETE clause:
//
//  1. It cannot be done by reflex. The caller has to send the exact counts
//     the server independently recomputes (ErrCountMismatch otherwise), so
//     the number is seen before it becomes zero, and anything added between
//     looking and acting aborts the purge instead of riding along.
//  2. Nothing is orphaned. Every Cloudinary asset reachable only through
//     these rows is destroyed explicitly, because a database cascade runs
//     no Go and would leave assets nobody can ever enumerate again.
//  3. Nobody finds out by noticing. Every problem creator is notified, the
//     same way problems.DeleteProblem notifies one creator when an admin
//     removes a single problem.
//
// The snapshot is returned to the caller, not written server-side: it is
// the only surviving record, and the admin's own copy is one the app cannot
// lose later.
func PreviewPurge(ctx context.Context, userID, cragID string) (*CragPurgePreview, error) {
	if err := requireAdmin(ctx, userID); err != nil {
		return nil, err
	}

	crag, err := GetCrag(ctx, cragID)
	if err != nil {
		return nil, err
	}

	counts, err := getPurgeCounts(ctx, cragID)
	if err != nil {
		return nil, err
	}

	data, err := getCragSnapshot(ctx, cragID)
	if err != nil {
		return nil, err
	}

	return &CragPurgePreview{
		CragID:   crag.ID,
		CragName: crag.Name,
		Counts:   *counts,
		Snapshot: CragSnapshot{PurgedAt: time.Now().UTC(), PurgedBy: userID, Data: data},
	}, nil
}

func PurgeCrag(ctx context.Context, userID, cragID string, expected PurgeCounts) (*CragPurgeResult, error) {
	if err := requireAdmin(ctx, userID); err != nil {
		return nil, err
	}

	if _, err := GetCrag(ctx, cragID); err != nil {
		return nil, err
	}

	counts, err := getPurgeCounts(ctx, cragID)
	if err != nil {
		return nil, err
	}
	if *counts != expected {
		return nil, ErrCountMismatch
	}

	// Everything the purge needs to report or clean up has to be read while
	// the rows still exist -- after the delete none of it is recoverable,
	// which is the whole reason this endpoint does its own bookkeeping
	// instead of letting the FK chain do the work.
	data, err := getCragSnapshot(ctx, cragID)
	if err != nil {
		return nil, err
	}
	photoURLs, err := getPurgePhotoURLs(ctx, cragID)
	if err != nil {
		return nil, err
	}
	victims, err := getPurgeVictims(ctx, cragID)
	if err != nil {
		return nil, err
	}

	if err := purgeCragRows(ctx, cragID); err != nil {
		return nil, err
	}

	// Only now that the rows are definitely gone. Destroying the photos
	// first would leave a crag pointing at dead URLs if the transaction
	// failed.
	destroyed, failed := 0, 0
	for _, url := range photoURLs {
		if err := cloudinary.DestroyByURL(ctx, url); err != nil {
			log.Printf("purge: failed to destroy %s: %v", url, err)
			failed++
			continue
		}
		destroyed++
	}

	return &CragPurgeResult{
		Deleted:          *counts,
		PhotosDestroyed:  destroyed,
		PhotosFailed:     failed,
		CreatorsNotified: notifyPurgeVictims(ctx, userID, victims),
		Snapshot:         CragSnapshot{PurgedAt: time.Now().UTC(), PurgedBy: userID, Data: data},
	}, nil
}

// notifyPurgeVictims tells every affected creator, best-effort, reusing the
// existing problem_deleted notification rather than adding a type -- from
// the creator's side "an admin deleted my problem" is exactly what
// happened, and a new type would mean a migration for a distinction only
// the admin can see. Returns how many were actually told.
func notifyPurgeVictims(ctx context.Context, actorID string, victims []purgeVictim) int {
	if len(victims) == 0 {
		return 0
	}

	username := "An admin"
	if actor, err := auth.GetProfile(ctx, actorID); err == nil && actor.Username != nil {
		username = *actor.Username
	}

	notified := 0
	for _, v := range victims {
		if v.CreatorID == actorID {
			continue // don't notify the admin about their own act
		}
		ownerID := v.CreatorID
		if err := notification.NotifyProblemDeleted(ctx, &ownerID, actorID, username, v.ProblemName); err != nil {
			log.Printf("purge: failed to notify %s: %v", ownerID, err)
			continue
		}
		notified++
	}
	return notified
}
