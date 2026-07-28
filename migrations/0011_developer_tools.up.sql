-- Backs the owner-only Developer page's tester-management feature: a flag
-- admins can toggle on a profile to grant access to unreleased features.
-- Gating specific features behind this happens ad hoc later, as those
-- features need it -- this migration only adds the flag itself.
ALTER TABLE public.profiles
    ADD COLUMN is_tester boolean DEFAULT false;
