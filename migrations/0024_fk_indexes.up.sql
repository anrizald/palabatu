-- Postgres indexes the referenced side of a foreign key, never the
-- referencing side, so these columns had no index at all. Each one backs
-- a real hot query: the crag list's per-crag counts, a boulder's problems,
-- a problem's comments, profile stats. Created while the tables are empty,
-- so a plain CREATE INDEX blocks nothing.

-- The crag list counts boulders, problems and approaches per crag.
CREATE INDEX problems_crag_id_idx    ON public.problems (crag_id);
CREATE INDEX boulders_crag_id_idx    ON public.boulders (crag_id);
CREATE INDEX approaches_crag_id_idx  ON public.approaches (crag_id);

-- A boulder's problems, its annotations, its image-delete cascade.
CREATE INDEX problems_boulder_id_idx ON public.problems (boulder_id);

-- A problem's comments, oldest first: the order listComments reads them in.
CREATE INDEX comments_problem_id_created_at_idx ON public.comments (problem_id, created_at);

-- Profile stats and activity, and the checks run when a user is deleted.
CREATE INDEX problems_created_by_idx ON public.problems (created_by);
CREATE INDEX comments_user_id_idx    ON public.comments (user_id);
CREATE INDEX sends_user_id_idx       ON public.sends (user_id);
