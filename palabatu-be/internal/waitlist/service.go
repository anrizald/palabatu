// Package waitlist stores emails collected from the "join the waitlist"
// coming-soon page shown while the rest of the app is gated pre-launch (see
// palabatu-fe App.tsx's SITE_LIVE flag). Deliberately minimal and unrelated
// to internal/auth: there's no password, session, or profile involved,
// just an email and a timestamp.
package waitlist

import (
	"context"
	"log"
	"regexp"
	"strings"

	"palabatu-be/internal/mailer"
)

var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

func Join(ctx context.Context, email string) (*Subscriber, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if !emailPattern.MatchString(email) {
		return nil, ErrInvalidEmail
	}
	sub, err := createSubscriber(ctx, email)
	if err != nil {
		return nil, err
	}
	notifySubscriber(sub.Email)
	return sub, nil
}

func Count(ctx context.Context) (int, error) {
	return countSubscribers(ctx)
}

// notifySubscriber is best-effort, mirroring feedback.notifyOwner's
// precedent: a failed confirmation email must never fail the waitlist
// signup itself -- the subscriber row is already committed.
func notifySubscriber(email string) {
	if err := mailer.SendWaitlistConfirmation(email); err != nil {
		log.Printf("waitlist: failed to send confirmation email: %v", err)
	}
}
