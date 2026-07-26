-- Adds four more notification types: a profile reaction (like/fire/heart),
-- an admin editing or deleting a problem someone else created, and an
-- @username mention in a comment.
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_type_check CHECK (type IN (
        'comment', 'send', 'report_resolved', 'content_removed',
        'reaction', 'problem_edited', 'problem_deleted', 'mention'
    ));
