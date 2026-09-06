-- Records who added a given photo to a crag, boulder or problem, so an
-- additive contribution can be credited, judged, and reverted. This is the
-- blocking half of handoff.md open item 11: decision 22 requires attribution
-- on every contribution before the CanContribute policy can widen past
-- creator-or-admin, and photos had none. Approaches already had it, at the
-- right granularity, via approaches.created_by.
--
-- A sidecar keyed (entity, url) rather than reshaping image_urls into an
-- array of objects, or normalizing a photos table. Both of those touch every
-- reader and writer of a field that otherwise needed no change: the
-- `image_urls || $2::jsonb` append, the `image_urls - $2::text` delete,
-- jsonb_array_length in the needs-attention query, three Go []string scans,
-- the frontend mirror types, and topo_annotations' membership check. This
-- repo has already reached for the same sidecar shape twice, for the same
-- reason -- topo_annotations keys on (problem_id, image_url) and reports on
-- (problem_id, target_type, image_url) -- because a photo inside a jsonb
-- array has no id to point at. A third instance is a pattern, not a
-- workaround, and this one changes no existing read or write path.
--
-- No backfill, on purpose. Until the policy widens, every photo was added by
-- the entity's creator or by an admin, because that is what CanEditOwned
-- enforced -- so an absent row means "the creator" and the display falls back
-- to the entity's own created_by with nothing guessed. Rows are written from
-- now on, before any widening, which keeps the ambiguous window historical.
-- The one real gap, named rather than hidden: an admin who added a photo to
-- someone else's entity before this migration reads as the creator. There
-- were 17 photos in the local data when this shipped (6 crags, 11 boulders,
-- 0 problems), so that is checkable by hand if it ever matters.
CREATE TABLE IF NOT EXISTS public.photo_credits (
    entity_kind text NOT NULL CHECK (entity_kind IN ('crag', 'boulder', 'problem')),
    entity_id   uuid NOT NULL,
    image_url   text NOT NULL,
    uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at  timestamp without time zone NOT NULL DEFAULT now(),

    -- No FK can point at an element inside a jsonb array, so a credit row can
    -- outlive the photo it describes. That is tolerable and matches both
    -- precedents above; the delete paths that already enumerate a URL to call
    -- cloudinary.DestroyByURL drop the credit in the same place.
    PRIMARY KEY (entity_kind, entity_id, image_url)
);

-- No separate index on (entity_kind, entity_id): it is a prefix of the
-- primary key, which is the only way this table is ever read.
