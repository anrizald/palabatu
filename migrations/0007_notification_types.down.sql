ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_type_check CHECK (type IN ('comment', 'send', 'report_resolved', 'content_removed'));
