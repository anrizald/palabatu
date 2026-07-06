package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"palabatu-be/internal/mailer"
	"palabatu-be/internal/repository"
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

	id, err := repository.CreateUser(ctx, email, string(hashed), username, verificationToken)
	if err != nil {
		return ErrEmailExists
	}

	if err := mailer.SendVerificationEmail(email, verificationToken); err != nil {
		_ = repository.DeleteUser(ctx, id)
		return ErrEmailSendFailed
	}

	return nil
}

// Signin verifies credentials and returns a signed 7-day JWT plus the user.
func Signin(ctx context.Context, email, password string) (string, *repository.User, error) {
	user, err := repository.GetUserByEmail(ctx, email)
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

// Session looks up the user for an already-verified JWT (see
// middleware.RequireAuth, which handler/auth.go wraps the /session route
// with). Returns (nil, nil) if the token was valid but the user is gone.
func Session(ctx context.Context, userID string) (*repository.User, error) {
	user, err := repository.GetUserByID(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return user, err
}

// VerifyEmail marks a user verified by their emailed token.
func VerifyEmail(ctx context.Context, token string) error {
	_, _, err := repository.VerifyEmailByToken(ctx, token)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidToken
	}
	return err
}

// ForgotPassword emails a reset link if the address exists. It deliberately
// does not report whether the address was found, to avoid leaking that.
func ForgotPassword(ctx context.Context, email string) error {
	_, err := repository.GetUserByEmail(ctx, email)
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

	if err := repository.SetResetToken(ctx, email, token, time.Now().Add(resetTokenTTL)); err != nil {
		return err
	}

	return mailer.SendPasswordResetEmail(email, token)
}

// ResetPassword sets a new password for the user matching an unexpired reset token.
func ResetPassword(ctx context.Context, token, password string) error {
	user, err := repository.GetUserByResetToken(ctx, token)
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

	return repository.UpdatePassword(ctx, user.ID, string(hashed))
}
