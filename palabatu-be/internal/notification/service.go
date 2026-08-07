// Package notification owns per-user notifications: someone commented on or
// sent (ticked) a problem you created, or a report you filed was resolved /
// content you added was removed by a moderator. Like internal/authz, this
// package never reaches into another domain's repository — callers
// (social, report) fetch whatever data they need (problem owner, problem
// name, actor username) and pass it in, so notification stays a leaf
// package with no import-cycle risk.
package notification

import (
	"context"
	"fmt"
)

func List(ctx context.Context, userID string) ([]Notification, error) {
	return list(ctx, userID)
}

func UnreadCount(ctx context.Context, userID string) (int, error) {
	return unreadCount(ctx, userID)
}

func MarkRead(ctx context.Context, userID, id string) error {
	found, err := markRead(ctx, userID, id)
	if err != nil {
		return err
	}
	if !found {
		return ErrNotFound
	}
	return nil
}

func MarkAllRead(ctx context.Context, userID string) error {
	return markAllRead(ctx, userID)
}

// NotifyComment tells a problem's owner that actorUsername commented on it.
// A no-op if the problem has no owner on record, or the commenter is
// commenting on their own problem.
func NotifyComment(ctx context.Context, ownerID *string, actorID, actorUsername, problemID, problemName string) error {
	if ownerID == nil || *ownerID == actorID {
		return nil
	}
	message := fmt.Sprintf("%s commented on your problem \"%s\"", actorUsername, problemName)
	return create(ctx, *ownerID, TypeComment, &problemID, &problemName, &actorUsername, message)
}

// NotifySend tells a problem's owner that actorUsername sent (ticked) it.
// Same no-op rules as NotifyComment.
func NotifySend(ctx context.Context, ownerID *string, actorID, actorUsername, problemID, problemName string) error {
	if ownerID == nil || *ownerID == actorID {
		return nil
	}
	message := fmt.Sprintf("%s sent your problem \"%s\"", actorUsername, problemName)
	return create(ctx, *ownerID, TypeSend, &problemID, &problemName, &actorUsername, message)
}

// NotifyReportResolved tells a report's reporter that an admin acted on it,
// either dismissing it or removing the reported content.
func NotifyReportResolved(ctx context.Context, reporterID, problemID, problemName string, removed bool) error {
	var message string
	if removed {
		message = fmt.Sprintf("Your report on \"%s\" was resolved — the content was removed.", problemName)
	} else {
		message = fmt.Sprintf("Your report on \"%s\" was reviewed — no action was needed.", problemName)
	}
	return create(ctx, reporterID, TypeReportResolved, &problemID, &problemName, nil, message)
}

// NotifyContentRemoved tells removed content's owner (a comment's author, or
// a problem's Founder for an image) that a moderator took it down after a
// report. A no-op if the content has no owner on record.
func NotifyContentRemoved(ctx context.Context, ownerID *string, problemID, problemName, contentDescription string) error {
	if ownerID == nil {
		return nil
	}
	message := fmt.Sprintf("A moderator removed %s from \"%s\" after a report.", contentDescription, problemName)
	return create(ctx, *ownerID, TypeContentRemoved, &problemID, &problemName, nil, message)
}

// NotifyReaction tells a profile's owner that actorUsername reacted to it. A
// no-op if the actor reacted to their own profile. Not tied to a problem, so
// problem_id/problem_name are left nil — the notification just isn't
// clickable through to anything.
func NotifyReaction(ctx context.Context, recipientID, actorID, actorUsername, reactionType string) error {
	if recipientID == actorID {
		return nil
	}
	message := fmt.Sprintf("%s reacted to your profile with %s", actorUsername, reactionType)
	return create(ctx, recipientID, TypeReaction, nil, nil, &actorUsername, message)
}

// NotifyProblemEdited tells a problem's owner that actorUsername (an admin,
// since a Founder editing their own problem is a no-op below) edited it.
func NotifyProblemEdited(ctx context.Context, ownerID *string, actorID, actorUsername, problemID, problemName string) error {
	if ownerID == nil || *ownerID == actorID {
		return nil
	}
	message := fmt.Sprintf("%s edited your problem \"%s\"", actorUsername, problemName)
	return create(ctx, *ownerID, TypeProblemEdited, &problemID, &problemName, &actorUsername, message)
}

// NotifyProblemDeleted tells a problem's owner that actorUsername (an admin)
// deleted it. problemID is deliberately never stored — the problem no
// longer exists, so there is nothing left to link the notification to.
func NotifyProblemDeleted(ctx context.Context, ownerID *string, actorID, actorUsername, problemName string) error {
	if ownerID == nil || *ownerID == actorID {
		return nil
	}
	message := fmt.Sprintf("%s deleted your problem \"%s\"", actorUsername, problemName)
	return create(ctx, *ownerID, TypeProblemDeleted, nil, &problemName, &actorUsername, message)
}

// NotifyMention tells mentionedID that authorUsername mentioned them
// (@username) in a comment on problemName. A no-op if authors mention
// themselves.
func NotifyMention(ctx context.Context, mentionedID, authorID, authorUsername, problemID, problemName string) error {
	if mentionedID == authorID {
		return nil
	}
	message := fmt.Sprintf("%s mentioned you in a comment on \"%s\"", authorUsername, problemName)
	return create(ctx, mentionedID, TypeMention, &problemID, &problemName, &authorUsername, message)
}

// NotifyMergeSuggested tells a recipient (an admin, either boulder's
// creator, or a problem creator on either boulder) that actorUsername
// flagged two boulders as possibly the same rock. Not tied to a single
// problem, so problem_id/problem_name are left nil, mirroring
// NotifyReaction's precedent for a notification that isn't problem-scoped.
func NotifyMergeSuggested(ctx context.Context, recipientID, actorID, actorUsername string) error {
	if recipientID == actorID {
		return nil
	}
	message := fmt.Sprintf("%s flagged two rocks as possibly the same -- take a look.", actorUsername)
	return create(ctx, recipientID, TypeMergeSuggested, nil, nil, &actorUsername, message)
}

// NotifyMergeObjected tells an admin that actorUsername said two boulders
// flagged as the same rock aren't -- informs the review, doesn't block it.
func NotifyMergeObjected(ctx context.Context, recipientID, actorID, actorUsername string) error {
	if recipientID == actorID {
		return nil
	}
	message := fmt.Sprintf("%s said two rocks flagged as the same aren't.", actorUsername)
	return create(ctx, recipientID, TypeMergeObjected, nil, nil, &actorUsername, message)
}

// NotifyMergeResolved tells the suggester and both boulders' creators the
// outcome of a merge request, either way. No actor -- the decision is the
// admin's, and per handoff.md's UX principles the outcome is phrased in
// plain terms ("two rocks were combined"), not as a moderation action
// against anyone.
func NotifyMergeResolved(ctx context.Context, recipientID string, merged bool) error {
	message := "A suggestion that two rocks were the same was not accepted."
	if merged {
		message = "Two rocks were combined."
	}
	return create(ctx, recipientID, TypeMergeResolved, nil, nil, nil, message)
}
