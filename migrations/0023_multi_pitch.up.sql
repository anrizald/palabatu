-- Multi-pitch detail on a route (handoff.md decision 23, built per open item 14).
--
-- pitch_count and commitment_grade are columns on problems, not a side table:
-- each is one value per route, the same kind of fact as height_m, and columns
-- ride along for free wherever a whole problem row is copied (the purge
-- snapshot's row_to_json, re-parenting, boulder merges).
--
-- NULL pitch_count is the one and only way to say "single pitch". Decision 23
-- said "null or 1", which is two stored forms of one fact; the CHECK allows
-- only 2 or more, so nothing ever has to reconcile null with 1. That is also
-- why almost every existing row needs no change: they are all single pitch.
ALTER TABLE public.problems
    ADD COLUMN pitch_count integer,
    ADD COLUMN commitment_grade text;

ALTER TABLE public.problems
    ADD CONSTRAINT problems_pitch_count_check CHECK (pitch_count >= 2);

-- French overall grade, the six plain letters with no +/- modifiers. A CHECK
-- rather than validation in Go alone, following boulders_type_check. The cost
-- is that adding modifiers later needs a migration. Clearing it stores NULL,
-- never '' (which would fail this constraint); the Go layer writes NULLIF.
ALTER TABLE public.problems
    ADD CONSTRAINT problems_commitment_grade_check
    CHECK (commitment_grade IN ('F', 'PD', 'AD', 'D', 'TD', 'ED'));

-- However much of the route somebody has documented, pitch by pitch. Rows only
-- exist on a route with a pitch_count. The two are deliberately NOT required
-- to agree: "roughly 10 pitches" is known while the breakdown is not, so a
-- route can say 10 and hold 4 rows, and the UI surfaces that gap as "4 of 10
-- pitches documented" rather than either side deriving from the other.
--
-- length_m is per pitch and is never summed into, or checked against,
-- problems.height_m (the whole route's height). A route with 3 of 10 pitches
-- entered would fail any such check for the ordinary reason that the other 7
-- are not entered yet.
--
-- ON DELETE CASCADE takes these rows with their problem, so deleting a problem
-- needs no extra step, but crags' purge has to add them to its snapshot and
-- counts by hand: row_to_json only covers the tables it is told about.
CREATE TABLE IF NOT EXISTS public.problem_pitches (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id   uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
    pitch_number integer NOT NULL CHECK (pitch_number >= 1),
    grade        text NOT NULL,
    length_m     numeric CHECK (length_m > 0),
    notes        text,

    -- Also the index for reading a problem's pitches, since problem_id is its
    -- leading column.
    CONSTRAINT problem_pitches_problem_number_key UNIQUE (problem_id, pitch_number)
);
