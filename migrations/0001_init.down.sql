-- Reverses 0001_init.up.sql. Drop order respects FK dependencies
-- (comments/sends -> problems/users, profiles -> users, then users).

DROP TABLE IF EXISTS public.comments;
DROP TABLE IF EXISTS public.sends;
DROP TABLE IF EXISTS public.problems;
DROP TABLE IF EXISTS public.profiles;
DROP TABLE IF EXISTS public.users;
