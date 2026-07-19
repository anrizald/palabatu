-- Adds vector route annotations (freehand pen strokes + circles marking
-- holds/start) drawn on top of a problem's topo photos by the problem's
-- Founder or an admin (Council/Associate). Images have no per-row id
-- (problems.image_urls is a jsonb array of URL strings, same as
-- 0004_reports' identical precedent), so a row is identified by
-- (problem_id, image_url) rather than an image FK. The unique constraint
-- below enforces one annotation overlay per image, not per-author: a save
-- always upserts the same row.
CREATE TABLE IF NOT EXISTS public.topo_annotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    problem_id uuid NOT NULL,
    image_url text NOT NULL,
    data jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.topo_annotations
    ADD CONSTRAINT topo_annotations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.topo_annotations
    ADD CONSTRAINT topo_annotations_problem_image_key UNIQUE (problem_id, image_url);

ALTER TABLE ONLY public.topo_annotations
    ADD CONSTRAINT topo_annotations_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.topo_annotations
    ADD CONSTRAINT topo_annotations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;
