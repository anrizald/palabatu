-- Lets a feedback submission carry a submitter-chosen category, surfaced as
-- a dropdown on FeedbackModal. 'report' here means "something about the
-- app's content/data is wrong" (a bad grade, stale directions, a duplicate
-- spot) -- distinct from internal/report's table, which is the admin
-- comment/image moderation queue reached by reporting a specific piece of
-- content, not this general form. Defaults existing rows to 'feedback',
-- the closest match to what the single-purpose form collected before this
-- column existed.
ALTER TABLE public.feedback
    ADD COLUMN type text DEFAULT 'feedback' NOT NULL;

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_type_check CHECK (type IN ('feedback', 'bug', 'report', 'suggestion'));
