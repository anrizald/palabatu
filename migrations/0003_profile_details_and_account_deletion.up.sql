-- Adds profile bio/location fields, and fixes ON DELETE behavior so a user
-- can actually be deleted: their profile row should go with them, but
-- problems they created should stay on the map (creator becomes NULL,
-- matching the existing "Added by @unknown" fallback the frontend already
-- has for a missing creator).

ALTER TABLE public.profiles
    ADD COLUMN bio text,
    ADD COLUMN location text;

ALTER TABLE public.profiles
    DROP CONSTRAINT profiles_id_fkey;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.problems
    DROP CONSTRAINT problems_created_by_fkey;

ALTER TABLE public.problems
    ADD CONSTRAINT problems_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
