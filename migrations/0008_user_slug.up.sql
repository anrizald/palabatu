-- Adds a short, opaque, system-generated public identifier for users so
-- profile URLs don't have to expose the raw uuid. Deliberately not the
-- existing username: username defaults to the email's local part
-- (palabatu-fe/src/lib/AuthContext.tsx) and is user-editable with no
-- uniqueness guarantee on profiles.username, so it isn't safe or stable
-- enough to use as a public lookup key.
ALTER TABLE users ADD COLUMN slug text;

-- One-shot backfill for rows that existed before this column did. Collision
-- odds are negligible at this app's current (pre-launch, local/test) scale;
-- if the UNIQUE constraint below ever fails to apply because of a collision,
-- just re-run this UPDATE for the affected row(s) before retrying.
UPDATE users SET slug = lower(substr(md5(id::text || clock_timestamp()::text || random()::text), 1, 10))
WHERE slug IS NULL;

ALTER TABLE users ALTER COLUMN slug SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_slug_key UNIQUE (slug);
