// Package mailer sends transactional email (verification, password reset,
// feedback notifications) through Resend's SMTP endpoint, mirroring
// palabatu-be/lib/mailer.ts.
package mailer

import (
	"crypto/tls"
	"fmt"
	"html"
	"net/smtp"
	"os"
)

const smtpHost = "smtp.resend.com"
const smtpPort = "465"

func send(to, subject, html string) error {
	from := os.Getenv("EMAIL_FROM")

	msg := []byte(fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-version: 1.0\r\nContent-Type: text/html; charset=\"UTF-8\"\r\n\r\n%s\r\n",
		from, to, subject, html,
	))

	conn, err := tls.Dial("tcp", smtpHost+":"+smtpPort, &tls.Config{ServerName: smtpHost})
	if err != nil {
		return err
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, smtpHost)
	if err != nil {
		return err
	}
	defer client.Close()

	auth := smtp.PlainAuth("", "resend", os.Getenv("RESEND_API_KEY"), smtpHost)
	if err := client.Auth(auth); err != nil {
		return err
	}
	if err := client.Mail(from); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}

	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return client.Quit()
}

func SendVerificationEmail(email, token string) error {
	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", os.Getenv("CLIENT_URL"), token)
	html := fmt.Sprintf(`
		<h2>Welcome to Palabatu!</h2>
		<p>Click the link below to verify your email:</p>
		<a href="%s">%s</a>
		<p>Link expires in 24 hours.</p>
	`, verifyURL, verifyURL)
	return send(email, "Verify your Palabatu account", html)
}

func SendPasswordResetEmail(email, token string) error {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", os.Getenv("CLIENT_URL"), token)
	html := fmt.Sprintf(`
		<h2>Password Reset</h2>
		<p>Click the link below to reset your password:</p>
		<a href="%s">%s</a>
		<p>Link expires in 1 hour. If you didn't request this, ignore this email.</p>
	`, resetURL, resetURL)
	return send(email, "Reset your Palabatu password", html)
}

func SendWaitlistConfirmation(email string) error {
	html := `
		<h2>You're on the list!</h2>
		<p>Thanks for joining the Palabatu waitlist. We'll email you as soon as the app is live.</p>
	`
	return send(email, "You're on the Palabatu waitlist", html)
}

// SendFeedbackNotification alerts the owner immediately when a feedback /
// bug report is submitted, so nothing sits unseen even before anyone opens
// the Developer page's review list. message and submitterEmail are
// user-typed free text (unlike this file's other templates, which only ever
// interpolate URLs/tokens), so both are HTML-escaped before going into the
// email body.
func SendFeedbackNotification(to, message string, submitterEmail, pageURL *string) error {
	submitter := "Anonymous"
	if submitterEmail != nil && *submitterEmail != "" {
		submitter = html.EscapeString(*submitterEmail)
	}
	pageLine := ""
	if pageURL != nil && *pageURL != "" {
		pageLine = fmt.Sprintf("<p><strong>Page:</strong> %s</p>", html.EscapeString(*pageURL))
	}
	body := fmt.Sprintf(`
		<h2>New feedback submitted</h2>
		<p><strong>From:</strong> %s</p>
		%s
		<p>%s</p>
	`, submitter, pageLine, html.EscapeString(message))
	return send(to, "New Palabatu feedback", body)
}
