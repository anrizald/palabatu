-- Records when a user accepted the Community Guidelines at signup, as a
-- distinct consent from terms_accepted_at (migrations/0009) -- Terms of
-- Service/Privacy Policy is a legal agreement, Community Guidelines is a
-- separate behavioral/etiquette acknowledgment users can be asked to
-- re-affirm independently later. Nullable for the same reason as
-- terms_accepted_at: existing rows predate this and were never asked, so a
-- NOT NULL constraint with a backfilled "now" would misrepresent history.
-- Enforcement that new signups must set this happens at the application
-- layer (auth.Signup), not via a DB constraint.

ALTER TABLE public.users
    ADD COLUMN guidelines_accepted_at timestamp without time zone;
