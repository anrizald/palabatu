ALTER TABLE public.problems
    DROP COLUMN image_urls;

ALTER TABLE public.crags
    DROP COLUMN image_urls;

ALTER TABLE public.boulders
    DROP CONSTRAINT boulders_type_check;

ALTER TABLE public.boulders
    DROP COLUMN type;
