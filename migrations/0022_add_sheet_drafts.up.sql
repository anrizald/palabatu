-- Backend sync for add-sheet drafts (handoff-drafts.md Milestone 2). M1
-- (2026-08-17) was IndexedDB-only, same-device recovery from an interrupted
-- add-sheet session. This table is the cross-device/reinstall-survival half
-- the doc gated on M1 proving the feature earns its keep -- built anyway,
-- deliberately, per the same-day decision to build it speculatively rather
-- than wait for usage signal M1 has no way to produce (client-only storage
-- exposes nothing about resume-vs-abandon rates to look at).
--
-- payload stays opaque jsonb, not a typed column per field: it is a direct
-- mirror of the frontend's own in-progress form state (add-sheet/types.ts),
-- which the backend has no business interpreting -- same precedent as
-- auth.Profile.Title/Tags. photo_urls is pulled out as its own array
-- specifically so DeleteDraft/UpdateDraft can clean up provisional Cloudinary
-- uploads (decision 10) without parsing the opaque payload to find them --
-- the client already knows exactly what it just uploaded and sends the list
-- alongside the payload it describes.
CREATE TABLE IF NOT EXISTS public.drafts (
    id         uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id    uuid NOT NULL,
    intent     text NOT NULL CHECK (intent IN ('problem', 'spot', 'rock')),
    label      text NOT NULL DEFAULT '',
    payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
    photo_urls text[] NOT NULL DEFAULT '{}',
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_pkey PRIMARY KEY (id);

-- Drafts are private, pre-submission scratch state (decision 7) with no
-- reason to survive the account that made them -- unlike created_by on
-- crags/boulders/problems/approaches (ON DELETE SET NULL, since a deleted
-- user's real contributions stay attributed to "someone"), a draft that
-- never became one of those things has nothing left to attribute.
ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Matches notifications_user_id_created_at_idx's shape exactly -- the only
-- query this table ever serves besides a single-row get is "this owner's
-- drafts, newest-updated first" (decision 2's real draft list).
CREATE INDEX drafts_user_id_updated_at_idx ON public.drafts (user_id, updated_at DESC);
