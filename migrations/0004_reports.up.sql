-- Adds a moderation queue: logged-in users can report a comment or a
-- problem topo-image; admins (Council/Associate) then dismiss the report
-- or remove the offending content, which resolves it. Images have no
-- per-row id (problems.image_urls is a jsonb array of URL strings), so an
-- image report is identified by (problem_id, image_url) rather than a FK.
CREATE TABLE IF NOT EXISTS public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    problem_id uuid NOT NULL,
    target_type text NOT NULL,
    comment_id uuid,
    image_url text,
    reason text,
    status text DEFAULT 'pending' NOT NULL,
    resolved_by uuid,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_target_type_check CHECK (target_type IN ('comment', 'image'));

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_status_check CHECK (status IN ('pending', 'resolved', 'dismissed'));

-- Deliberately does NOT require comment_id IS NOT NULL for comment-type
-- rows: comment_id is ON DELETE SET NULL below, so it must be allowed to
-- go null later once the reported comment is actually deleted. The
-- service tier always supplies a non-null comment_id at insert time.
ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_target_columns_check CHECK (
        (target_type = 'comment' AND image_url IS NULL)
        OR (target_type = 'image' AND image_url IS NOT NULL AND comment_id IS NULL)
    );

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;
