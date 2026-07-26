-- Recipient-facing notifications: someone commented on or sent (ticked) a
-- problem you created, or a report you filed was resolved / content you
-- added was removed by a moderator. problem_name and actor_name are
-- snapshots captured at creation time (not re-joined from live tables),
-- since a notification is a historical feed entry that should keep reading
-- right even after a username changes or the referenced problem is deleted.
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    problem_id uuid,
    problem_name text,
    actor_name text,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_type_check CHECK (type IN ('comment', 'send', 'report_resolved', 'content_removed'));

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ON DELETE SET NULL, not CASCADE: a notification should still read fine
-- (via its stored problem_name snapshot) after the problem itself is gone;
-- only the /problems/:id link target goes away.
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE SET NULL;

CREATE INDEX notifications_user_id_created_at_idx ON public.notifications (user_id, created_at DESC);
