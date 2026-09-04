-- Introduces the crags -> boulders -> problems hierarchy (see handoff.md at
-- the repo root for the full design). A crag is the place you drive to and
-- park at; a boulder is one rock; a problem is one way up that rock. This
-- migration only adds the new tables and nullable linking columns -- it
-- does not touch existing problems data. A one-off backfill script
-- (cmd/backfill-crags) populates crags/boulders and problems.crag_id/
-- boulder_id for existing rows; migrations/0015 then makes those columns
-- NOT NULL and drops problems' now-superseded location/image_urls/lat/lng
-- columns, once the backfill has been run and eyeballed.
CREATE TABLE IF NOT EXISTS public.crags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    directions text,
    access_notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.crags
    ADD CONSTRAINT crags_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.crags
    ADD CONSTRAINT crags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- A boulder is one rock at a crag. It owns the photo(s) climbers draw their
-- lines on (image_urls, moved here from problems by 0015) -- see decision 2
-- in handoff.md for why: two problems on the same rock used to mean two
-- uploads of the same photograph with two unrelated overlays.
CREATE TABLE IF NOT EXISTS public.boulders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crag_id uuid NOT NULL,
    name text,
    image_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    rock_type text,
    lat double precision,
    lng double precision,
    merged_into uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.boulders
    ADD CONSTRAINT boulders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.boulders
    ADD CONSTRAINT boulders_crag_id_fkey FOREIGN KEY (crag_id) REFERENCES public.crags(id) ON DELETE CASCADE;

-- merged_into is set instead of deleting a boulder when it's merged away
-- (see the merge-flow section of handoff.md) -- ON DELETE SET NULL rather
-- than CASCADE, since the surviving boulder disappearing shouldn't take the
-- (already-inert) loser row with it.
ALTER TABLE ONLY public.boulders
    ADD CONSTRAINT boulders_merged_into_fkey FOREIGN KEY (merged_into) REFERENCES public.boulders(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.boulders
    ADD CONSTRAINT boulders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- problems.crag_id/boulder_id are nullable here so this migration can run
-- before the existing rows are backfilled; migrations/0015 makes both
-- NOT NULL once every row has a value. crag_id is denormalized on purpose
-- (also reachable via boulder_id -> boulders.crag_id) -- every hot
-- list/filter/map query wants it without a two-hop join. The six new
-- problem-level fields are handoff.md decisions 8-10, all optional.
ALTER TABLE public.problems
    ADD COLUMN crag_id uuid,
    ADD COLUMN boulder_id uuid,
    ADD COLUMN first_ascensionist text,
    ADD COLUMN discovered_by text,
    ADD COLUMN landing_hazards text,
    ADD COLUMN descent text,
    ADD COLUMN height_m numeric,
    ADD COLUMN notes text;

ALTER TABLE ONLY public.problems
    ADD CONSTRAINT problems_crag_id_fkey FOREIGN KEY (crag_id) REFERENCES public.crags(id);

ALTER TABLE ONLY public.problems
    ADD CONSTRAINT problems_boulder_id_fkey FOREIGN KEY (boulder_id) REFERENCES public.boulders(id);

-- Duplicate boulders are expected, not exceptional (the backfill creates one
-- boulder per pre-existing problem, and contributors standing at the same
-- rock will keep creating new ones) -- see the merge-flow section of
-- handoff.md. Anyone signed in may suggest a merge ("these are the same
-- rock"); only an admin executes one, choosing which boulder survives.
CREATE TABLE IF NOT EXISTS public.boulder_merge_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_boulder_id uuid NOT NULL,
    target_boulder_id uuid NOT NULL,
    suggested_by uuid,
    reason text,
    status text DEFAULT 'pending' NOT NULL,
    resolved_by uuid,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.boulder_merge_requests
    ADD CONSTRAINT boulder_merge_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.boulder_merge_requests
    ADD CONSTRAINT boulder_merge_requests_status_check CHECK (status IN ('pending', 'merged', 'rejected'));

ALTER TABLE ONLY public.boulder_merge_requests
    ADD CONSTRAINT boulder_merge_requests_source_boulder_id_fkey FOREIGN KEY (source_boulder_id) REFERENCES public.boulders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.boulder_merge_requests
    ADD CONSTRAINT boulder_merge_requests_target_boulder_id_fkey FOREIGN KEY (target_boulder_id) REFERENCES public.boulders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.boulder_merge_requests
    ADD CONSTRAINT boulder_merge_requests_suggested_by_fkey FOREIGN KEY (suggested_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.boulder_merge_requests
    ADD CONSTRAINT boulder_merge_requests_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Only the source/target boulder's own creator may object (handoff.md's
-- merge-flow design note 3) -- objections inform the admin's decision, they
-- never veto it.
CREATE TABLE IF NOT EXISTS public.boulder_merge_objections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    merge_request_id uuid NOT NULL,
    user_id uuid,
    body text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.boulder_merge_objections
    ADD CONSTRAINT boulder_merge_objections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.boulder_merge_objections
    ADD CONSTRAINT boulder_merge_objections_merge_request_id_fkey FOREIGN KEY (merge_request_id) REFERENCES public.boulder_merge_requests(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.boulder_merge_objections
    ADD CONSTRAINT boulder_merge_objections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Three new notification types for the merge flow: a merge suggestion needs
-- review, an objection was filed, or a merge request was resolved either
-- way.
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_type_check CHECK (type IN (
        'comment', 'send', 'report_resolved', 'content_removed',
        'reaction', 'problem_edited', 'problem_deleted', 'mention',
        'merge_suggested', 'merge_objected', 'merge_resolved'
    ));
