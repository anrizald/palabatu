-- Finalizes the crags -> boulders -> problems restructure started in 0014.
-- Run only after cmd/backfill-crags has populated crag_id/boulder_id on
-- every existing problem and the result has been hand-checked (see
-- handoff.md's migration notes -- this is deliberately a separate, later
-- migration rather than bundled into 0014, so the backfill can be verified
-- before the old columns are gone for good).
ALTER TABLE public.problems
    ALTER COLUMN crag_id SET NOT NULL,
    ALTER COLUMN boulder_id SET NOT NULL;

-- location/image_urls/lat/lng are fully superseded: location was the
-- free-text string a crag's name now replaces, image_urls moved to
-- boulders (they're the rock's photos, shared by every problem on it), and
-- lat/lng moved to crags (the approach point) and boulders (the rock's own
-- point) -- a problem is just a line on a rock, it has no location of its
-- own to record (handoff.md decision 4).
ALTER TABLE public.problems
    DROP COLUMN location,
    DROP COLUMN image_urls,
    DROP COLUMN lat,
    DROP COLUMN lng;
