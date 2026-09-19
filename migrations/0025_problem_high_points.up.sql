-- A climber's high point on a multi-pitch route they turned back from
-- (handoff.md open item 14, decision 23's third follow-on): "I got to pitch 4
-- of 10". A separate table on purpose, never a column on sends. A sends row
-- means "I climbed it", and six places read it as exactly that: the profile
-- send count and recent activity, the list send_count, the "X sent Y"
-- notification, the developer export and analytics, and the purge snapshot
-- and counts. Each would count a retreat as a send unless each learned to
-- filter it out, and ToggleSend's one-tick contract would have to change.
--
-- One row per climber per route, so setting a new high point replaces the old
-- one. It is private to the climber: nothing reads it except that climber,
-- it sends no notification, and it is never counted as a send anywhere.
-- Topping out later clears it (social.ToggleSend drops the row when it adds a
-- send), so a route never holds both a send and a high point for one person.
--
-- Both FKs cascade: deleting a route or an account takes its records with it.
-- Crags' purge cascades through the problems delete but has to add this table
-- to its snapshot and counts by hand, since row_to_json only covers the
-- tables it is told about.
CREATE TABLE IF NOT EXISTS public.problem_high_points (
    problem_id uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    pitch      integer NOT NULL CHECK (pitch >= 1),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),

    -- The primary key is also the only lookup the app ever does, (problem, me),
    -- and it covers problem_id as its leading column.
    PRIMARY KEY (problem_id, user_id)
);

-- user_id is the primary key's second column, so it is not covered. Nothing
-- queries by it alone, but deleting an account cascades here, and without an
-- index that lookup scans the whole table.
CREATE INDEX IF NOT EXISTS problem_high_points_user_id_idx
    ON public.problem_high_points (user_id);
