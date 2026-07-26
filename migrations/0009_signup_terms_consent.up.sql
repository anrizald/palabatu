-- Records when a user accepted the Terms of Service / Privacy Policy at
-- signup (Indonesia's UU PDP requires consent for processing personal
-- data). Nullable: existing rows predate this and were never asked, so a
-- NOT NULL constraint with a backfilled "now" would misrepresent history.
-- Enforcement that new signups must set this happens at the application
-- layer (auth.Signup), not via a DB constraint.

ALTER TABLE public.users
    ADD COLUMN terms_accepted_at timestamp without time zone;
