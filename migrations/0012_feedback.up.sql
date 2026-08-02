-- Global feedback / bug report form. Its own table rather than bolted onto
-- reports -- that table is specifically comment/image moderation, a
-- different shape and a different resolution flow (see ROADMAP.md's Phase 1
-- feedback item). Open to logged-out visitors as well as signed-in users, so
-- user_id is nullable -- mirrors problems.created_by's nullable-on-delete
-- precedent from migrations/0003.
CREATE TABLE IF NOT EXISTS public.feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text,
    message text NOT NULL,
    page_url text,
    status text DEFAULT 'open' NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_status_check CHECK (status IN ('open', 'reviewed'));

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
