// Package waitlist stores emails collected from the "join the waitlist"
// coming-soon page shown while the rest of the app is gated pre-launch (see
// palabatu-fe App.tsx's SITE_LIVE flag). Deliberately minimal and unrelated
// to internal/auth: there's no password, session, or profile involved,
// just an email and a timestamp.
package waitlist

import (
	"context"
	"regexp"
	"strings"
)

var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

func Join(ctx context.Context, email string) (*Subscriber, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if !emailPattern.MatchString(email) {
		return nil, ErrInvalidEmail
	}
	return createSubscriber(ctx, email)
}
