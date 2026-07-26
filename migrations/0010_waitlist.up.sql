-- Stores emails collected from the "join the waitlist" coming-soon page
-- shown while the rest of the app is gated pre-launch (palabatu-fe's
-- App.tsx SITE_LIVE flag). Deliberately its own minimal table rather than
-- reusing `users` -- these are prospective signups, not accounts, and have
-- no password/session/profile of their own.
CREATE TABLE IF NOT EXISTS public.waitlist_subscribers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.waitlist_subscribers
    ADD CONSTRAINT waitlist_subscribers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.waitlist_subscribers
    ADD CONSTRAINT waitlist_subscribers_email_key UNIQUE (email);
