DROP TABLE IF EXISTS public.problem_pitches;

ALTER TABLE public.problems
    DROP CONSTRAINT IF EXISTS problems_commitment_grade_check,
    DROP CONSTRAINT IF EXISTS problems_pitch_count_check;

ALTER TABLE public.problems
    DROP COLUMN IF EXISTS commitment_grade,
    DROP COLUMN IF EXISTS pitch_count;
