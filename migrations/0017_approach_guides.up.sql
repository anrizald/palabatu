-- Approach guides ("jalan masuk" -- the walk in, photographed step by
-- step), handoff.md decision 21. Deliberately not a field on crags/
-- boulders/problems: a crag may have several approaches ("from the angkot"
-- and "from the village with a motor" are genuinely different walks), and a
-- second contributor adds their own approach alongside an existing one
-- rather than editing it (sidesteps the collaborative-editing deferral).
CREATE TABLE IF NOT EXISTS public.approaches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crag_id uuid NOT NULL,
    name text,
    start_type text NOT NULL,
    duration_minutes integer,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.approaches
    ADD CONSTRAINT approaches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.approaches
    ADD CONSTRAINT approaches_crag_id_fkey FOREIGN KEY (crag_id) REFERENCES public.crags(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.approaches
    ADD CONSTRAINT approaches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- start_type is the local-first part of the design: every global climbing
-- app assumes you arrived by car, and this app assumes angkot/ojek as
-- readily as a car.
ALTER TABLE ONLY public.approaches
    ADD CONSTRAINT approaches_start_type_check CHECK (start_type IN ('angkot', 'ojek', 'motor', 'mobil', 'kaki'));

-- An approach is an ordered list of steps, each a photo plus one line
-- (caption), with an optional coordinate and a "careful here" flag that
-- survives skim-reading where a sentence doesn't. photo_url/caption are
-- NOT NULL -- a step with neither isn't a step, it's an empty row.
CREATE TABLE IF NOT EXISTS public.approach_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    approach_id uuid NOT NULL,
    position integer NOT NULL,
    photo_url text NOT NULL,
    caption text NOT NULL,
    lat double precision,
    lng double precision,
    careful_flag boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.approach_steps
    ADD CONSTRAINT approach_steps_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.approach_steps
    ADD CONSTRAINT approach_steps_approach_id_fkey FOREIGN KEY (approach_id) REFERENCES public.approaches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.approach_steps
    ADD CONSTRAINT approach_steps_approach_id_position_key UNIQUE (approach_id, position);
