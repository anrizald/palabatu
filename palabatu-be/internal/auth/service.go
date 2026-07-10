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
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"palabatu-be/internal/mailer"
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

// Signup creates a user and emails a verification link. If the email fails
// to send, the user row is rolled back, mirroring palabatu-be/routes/auth.ts.
func Signup(ctx context.Context, email, password, username string) error {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	verificationToken, err := generateToken()
	if err != nil {
		return err
	}

	id, err := createUser(ctx, email, string(hashed), username, verificationToken)
	if err != nil {
		return ErrEmailExists
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

// GetProfile returns (nil, nil) when no profile row exists, matching
// palabatu-be/routes/api.ts's `res.json(null)` for a missing profile.
func GetProfile(ctx context.Context, id string) (*Profile, error) {
	profile, err := getProfileByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return profile, err
}

func UpsertProfile(ctx context.Context, id, username string, title, tags json.RawMessage, avatarURL string) (*Profile, error) {
	if title == nil {
		title = json.RawMessage("null")
	}
	if tags == nil {
		tags = json.RawMessage("null")
	}
	return upsertProfileRow(ctx, id, username, title, tags, avatarURL)
}
