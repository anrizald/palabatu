ALTER TABLE public.feedback
    DROP CONSTRAINT IF EXISTS feedback_type_check;

ALTER TABLE public.feedback
    DROP COLUMN IF EXISTS type;
