// Package auth owns users, sessions, JWT issuance/verification,
// signup/signin, email verification, password reset, and profiles.
// Profiles live here rather than as their own domain because
// profiles.title is an authz concern (see internal/authz), even though
// tags/avatar/level is public-facing display data other domains read.
package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"palabatu-be/internal/authz"
	"palabatu-be/internal/cloudinary"
	"palabatu-be/internal/mailer"
)

// maxBioLength and maxLocationLength bound the two new free-text profile
// fields, mirroring internal/social's maxCommentLength precedent.
const (
	maxBioLength      = 300
	maxLocationLength = 100
)

const resetTokenTTL = time.Hour
const sessionTokenTTL = 7 * 24 * time.Hour

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// Signup creates a user and its profile row together (see
// insertUserAndProfile) and emails a verification link. If the email fails
// to send, the user row is rolled back, mirroring
// palabatu-be/routes/auth.ts — the profile row goes with it via
// profiles_id_fkey's ON DELETE CASCADE (migrations/0003).
func Signup(ctx context.Context, email, password, username string, termsAccepted bool) error {
	if strings.TrimSpace(email) == "" || strings.TrimSpace(password) == "" || strings.TrimSpace(username) == "" {
		return ErrMissingFields
	}
	if !termsAccepted {
		return ErrTermsNotAccepted
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	verificationToken, err := generateToken()
	if err != nil {
		return err
	}

	id, err := createUser(ctx, email, string(hashed), username, verificationToken, time.Now())
	if err != nil {
		return err
	}

	if err := mailer.SendVerificationEmail(email, verificationToken); err != nil {
		_ = deleteUser(ctx, id)
		return ErrEmailSendFailed
	}

	return nil
}

// Signin verifies credentials and returns a signed 7-day JWT plus the user.
func Signin(ctx context.Context, email, password string) (string, *User, error) {
	user, err := getUserByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil, ErrInvalidCredentials
	}
	if err != nil {
		return "", nil, err
	}

	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)) != nil {
		return "", nil, ErrInvalidCredentials
	}
	if !user.IsVerified {
		return "", nil, ErrNotVerified
	}

	claims := jwt.MapClaims{
		"id":    user.ID,
		"email": user.Email,
		"exp":   time.Now().Add(sessionTokenTTL).Unix(),
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return "", nil, err
	}

	return token, user, nil
}

// Session looks up the user for an already-verified JWT (see handler.go,
// which wraps the /session route with middleware.RequireAuth). Returns
// (nil, nil) if the token was valid but the user is gone.
func Session(ctx context.Context, userID string) (*User, error) {
	user, err := getUserByID(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return user, err
}

// VerifyEmail marks a user verified by their emailed token.
func VerifyEmail(ctx context.Context, token string) error {
	_, _, err := verifyEmailByToken(ctx, token)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidToken
	}
	return err
}

// ForgotPassword emails a reset link if the address exists. It deliberately
// does not report whether the address was found, to avoid leaking that.
func ForgotPassword(ctx context.Context, email string) error {
	_, err := getUserByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}

	token, err := generateToken()
	if err != nil {
		return err
	}

	if err := setResetToken(ctx, email, token, time.Now().Add(resetTokenTTL)); err != nil {
		return err
	}

	return mailer.SendPasswordResetEmail(email, token)
}

// ResetPassword sets a new password for the user matching an unexpired reset token.
func ResetPassword(ctx context.Context, token, password string) error {
	user, err := getUserByResetToken(ctx, token)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidToken
	}
	if err != nil {
		return err
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	return updatePassword(ctx, user.ID, string(hashed))
}

// uuidPattern matches a canonical Postgres uuid's textual form, letting
// ResolveUserID tell a real id apart from a profile slug without a DB
// round-trip.
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// ResolveUserID accepts either a user's real id or their public profile slug
// (migrations/0008_user_slug.up.sql) and returns the underlying user id, so
// callers — profile routes, the social package's reaction routes — can
// accept whichever a URL happens to contain without duplicating this check.
func ResolveUserID(ctx context.Context, idOrSlug string) (string, error) {
	if uuidPattern.MatchString(idOrSlug) {
		return idOrSlug, nil
	}
	id, err := getUserIDBySlug(ctx, idOrSlug)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return id, err
}

// GetProfile returns a blank Profile (id set, everything else zero) when the
// user exists but has no profile row — Signup creates one atomically for
// every new account, so this now only happens for accounts created before
// that change; it's a normal state, not an error. ErrNotFound is only
// returned when idOrSlug doesn't match any user at all, so the frontend can
// tell "new user, empty profile" apart from "no such user" and render a
// proper not-found page for the latter.
func GetProfile(ctx context.Context, idOrSlug string) (*Profile, error) {
	id, err := ResolveUserID(ctx, idOrSlug)
	if err != nil {
		return nil, ErrNotFound
	}

	createdAt, slug, err := getUserMeta(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	profile, err := getProfileByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		profile = &Profile{ID: id}
	} else if err != nil {
		return nil, err
	}
	profile.CreatedAt = createdAt
	profile.Slug = slug
	return profile, nil
}

// GetUserIDByUsername resolves a username to a user id, for @mention
// notifications parsed out of comment text.
func GetUserIDByUsername(ctx context.Context, username string) (string, error) {
	id, err := getProfileIDByUsername(ctx, username)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return id, err
}

// CountUsers returns the total number of registered users, for the landing
// page's climber-count stat.
func CountUsers(ctx context.Context) (int, error) {
	return countUsers(ctx)
}

// GetProfileStats returns a user's sends count and problems-added count.
func GetProfileStats(ctx context.Context, idOrSlug string) (ProfileStats, error) {
	id, err := ResolveUserID(ctx, idOrSlug)
	if err != nil {
		return ProfileStats{}, err
	}
	return getProfileStats(ctx, id)
}

// RecentActivity is the profile page's activity feed: a user's most recent
// sends and most recently added problems, each capped at
// recentActivityLimit.
type RecentActivity struct {
	Sends    []RecentSend    `json:"sends"`
	Problems []RecentProblem `json:"problems"`
}

func GetRecentActivity(ctx context.Context, idOrSlug string) (RecentActivity, error) {
	id, err := ResolveUserID(ctx, idOrSlug)
	if err != nil {
		return RecentActivity{}, err
	}
	sends, err := getRecentSends(ctx, id)
	if err != nil {
		return RecentActivity{}, err
	}
	problems, err := getRecentlyAddedProblems(ctx, id)
	if err != nil {
		return RecentActivity{}, err
	}
	return RecentActivity{Sends: sends, Problems: problems}, nil
}

// UpsertProfile writes the caller's own profile. callerID must match id — a
// user may only edit their own profile, never someone else's. Additionally,
// changing title (the Council/Associate admin flag authz.IsAdmin checks) is
// only permitted if the caller already holds an admin title; otherwise a
// non-admin could grant themselves admin by just PUTing their own profile.
// If avatarURL replaces a previously stored one, the old Cloudinary asset is
// best-effort destroyed afterward, mirroring problems.DeleteProblem's
// cleanup of its image_urls.
func UpsertProfile(ctx context.Context, callerID, idOrSlug, username string, title, tags json.RawMessage, avatarURL, bio, location string) (*Profile, error) {
	id, err := ResolveUserID(ctx, idOrSlug)
	if err != nil {
		return nil, ErrForbidden
	}
	if callerID != id {
		return nil, ErrForbidden
	}
	if len(bio) > maxBioLength {
		return nil, ErrBioTooLong
	}
	if len(location) > maxLocationLength {
		return nil, ErrLocationTooLong
	}

	currentTitles, err := GetUserTitles(ctx, id)
	if err != nil {
		return nil, err
	}
	if !authz.IsAdmin(currentTitles) {
		var requested []string
		if len(title) > 0 && string(title) != "null" {
			if err := json.Unmarshal(title, &requested); err != nil {
				return nil, ErrForbidden
			}
		}
		if !sameTitles(requested, currentTitles) {
			return nil, ErrForbidden
		}
	}

	current, err := getProfileByID(ctx, id)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	if title == nil {
		title = json.RawMessage("null")
	}
	if tags == nil {
		tags = json.RawMessage("null")
	}
	profile, err := upsertProfileRow(ctx, id, username, title, tags, avatarURL, bio, location)
	if err != nil {
		return nil, err
	}

	if current != nil && current.AvatarURL != nil && *current.AvatarURL != "" && *current.AvatarURL != avatarURL {
		if err := cloudinary.DestroyByURL(ctx, *current.AvatarURL); err != nil {
			log.Printf("failed to delete old avatar from Cloudinary: %v", err)
		}
	}

	return profile, nil
}

// ChangePassword verifies currentPassword against the stored hash before
// setting newPassword, reusing the same repository write ResetPassword uses.
func ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	user, err := getUserByID(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidCredentials
	}
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(currentPassword)) != nil {
		return ErrInvalidCredentials
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return updatePassword(ctx, userID, string(hashed))
}

// DeleteAccount requires the caller's current password as confirmation
// before deleting their user row. profiles/comments/sends/profile_reactions
// all cascade via FK (migrations/0003), and problems they created are kept
// with created_by set to NULL rather than deleted. The avatar, if any, is
// best-effort destroyed from Cloudinary first.
func DeleteAccount(ctx context.Context, userID, password string) error {
	user, err := getUserByID(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidCredentials
	}
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)) != nil {
		return ErrInvalidCredentials
	}

	profile, err := getProfileByID(ctx, userID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if profile != nil && profile.AvatarURL != nil && *profile.AvatarURL != "" {
		if err := cloudinary.DestroyByURL(ctx, *profile.AvatarURL); err != nil {
			log.Printf("failed to delete avatar from Cloudinary: %v", err)
		}
	}

	return deleteUser(ctx, userID)
}

// sameTitles compares two title sets order- and duplicate-insensitively.
func sameTitles(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	counts := make(map[string]int, len(a))
	for _, t := range a {
		counts[t]++
	}
	for _, t := range b {
		counts[t]--
	}
	for _, c := range counts {
		if c != 0 {
			return false
		}
	}
	return true
}
