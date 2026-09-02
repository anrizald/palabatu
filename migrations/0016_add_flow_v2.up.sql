-- Schema support for the redesigned add flow (handoff.md decisions 15-20,
-- revision (g)). Three independent additive changes, all optional/defaulted
-- so existing rows need no backfill:
--
-- 1. boulders.type: cliffs are in scope (decision 1) -- the middle level is
--    a rock *or* a wall, and UI copy switches on this column ("which rock?"
--    vs "which wall?"). Every existing boulder is a rock, hence the default.
-- 2. crags.image_urls: the approach shot (decision 2, amended 2026-08-08(f))
--    -- "park here, the trail starts at this tree". Not annotatable.
-- 3. problems.image_urls: beta/action shots (crux hold, start position,
--    someone on it) -- a NEW column with a NEW meaning, not a revert of
--    migration 0015's drop, which held the wide topo shot that now belongs
--    to the boulder.
ALTER TABLE public.boulders
    ADD COLUMN type text DEFAULT 'boulder' NOT NULL;

ALTER TABLE ONLY public.boulders
    ADD CONSTRAINT boulders_type_check CHECK (type IN ('boulder', 'wall'));

ALTER TABLE public.crags
    ADD COLUMN image_urls jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE public.problems
    ADD COLUMN image_urls jsonb DEFAULT '[]'::jsonb NOT NULL;
