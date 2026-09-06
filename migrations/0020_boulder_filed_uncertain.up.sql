-- Records that a contributor said "Not sure which one" when the rock their
-- problem was filed against got created, rather than "It's a new rock".
-- Closes handoff-add-sheet.md C11, where the two picks were byte-identical
-- in the code and the stated uncertainty was thrown away one tap after the
-- person expressed it.
--
-- Nullable on purpose, so the column carries three states rather than two:
--   true  -- the person said they were not sure
--   false -- the person said it was a new rock
--   NULL  -- nobody was asked (every row created before this migration, and
--            every rock created through the crag page or the rock intent,
--            where the question never comes up)
-- A NOT NULL DEFAULT false would flatten "we never asked" into "they said
-- no", which is exactly the inference handoff.md open item 9 says the admin
-- surface should not have to make.
ALTER TABLE public.boulders
    ADD COLUMN filed_uncertain boolean;

-- The needs-attention query filters on this alongside a derived heuristic
-- (unnamed + photoless + exactly one problem, per open item 9), and is
-- admin-only and low-traffic, so this index is about keeping the flagged
-- half of that query cheap rather than about a hot path. Partial, since
-- only true rows are ever selected on.
CREATE INDEX IF NOT EXISTS boulders_filed_uncertain_idx
    ON public.boulders (filed_uncertain) WHERE filed_uncertain;
