ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_type_check CHECK (type IN (
        'comment', 'send', 'report_resolved', 'content_removed',
        'reaction', 'problem_edited', 'problem_deleted', 'mention'
    ));

DROP TABLE IF EXISTS public.boulder_merge_objections;
DROP TABLE IF EXISTS public.boulder_merge_requests;

ALTER TABLE public.problems
    DROP COLUMN IF EXISTS crag_id,
    DROP COLUMN IF EXISTS boulder_id,
    DROP COLUMN IF EXISTS first_ascensionist,
    DROP COLUMN IF EXISTS discovered_by,
    DROP COLUMN IF EXISTS landing_hazards,
    DROP COLUMN IF EXISTS descent,
    DROP COLUMN IF EXISTS height_m,
    DROP COLUMN IF EXISTS notes;

DROP TABLE IF EXISTS public.boulders;
DROP TABLE IF EXISTS public.crags;
