DROP INDEX IF EXISTS public.boulders_filed_uncertain_idx;

ALTER TABLE public.boulders
    DROP COLUMN IF EXISTS filed_uncertain;
