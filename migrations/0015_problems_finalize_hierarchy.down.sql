-- Data caveat: dropped columns can't be un-dropped. This restores the shape
-- (nullable, empty) so 0014's down-migration can still run cleanly, not the
-- original values.
ALTER TABLE public.problems
    ADD COLUMN location text,
    ADD COLUMN image_urls jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN lat double precision,
    ADD COLUMN lng double precision;

ALTER TABLE public.problems
    ALTER COLUMN crag_id DROP NOT NULL,
    ALTER COLUMN boulder_id DROP NOT NULL;
