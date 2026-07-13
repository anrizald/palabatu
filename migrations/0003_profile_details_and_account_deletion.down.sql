ALTER TABLE public.problems
    DROP CONSTRAINT problems_created_by_fkey;

ALTER TABLE public.problems
    ADD CONSTRAINT problems_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.profiles
    DROP CONSTRAINT profiles_id_fkey;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES public.users(id);

ALTER TABLE public.profiles
    DROP COLUMN bio,
    DROP COLUMN location;
