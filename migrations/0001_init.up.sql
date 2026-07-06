-- Initial schema, captured via pg_dump --schema-only from the live Neon
-- database (2026-07-06). Reflects palabatu-be's actual production tables;
-- there was previously no schema file anywhere in the repo.

CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    username text NOT NULL,
    is_verified boolean DEFAULT false,
    verification_token text,
    created_at timestamp without time zone DEFAULT now(),
    reset_token text,
    reset_token_expiry timestamp without time zone
);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text,
    title jsonb,
    tags jsonb,
    avatar_url text
);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES public.users(id);


CREATE TABLE public.problems (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    grade text,
    location text,
    lat double precision,
    lng double precision,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    image_urls jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE ONLY public.problems
    ADD CONSTRAINT problems_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.problems
    ADD CONSTRAINT problems_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


CREATE TABLE public.sends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    problem_id uuid,
    user_id uuid,
    created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE ONLY public.sends
    ADD CONSTRAINT sends_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sends
    ADD CONSTRAINT sends_problem_id_user_id_key UNIQUE (problem_id, user_id);

ALTER TABLE ONLY public.sends
    ADD CONSTRAINT sends_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sends
    ADD CONSTRAINT sends_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    problem_id uuid,
    user_id uuid,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
