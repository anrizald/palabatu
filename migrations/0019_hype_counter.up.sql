-- A single global, public click counter behind the "semangatin yuk" / Allez
-- button on the under-construction curtain (palabatu-fe's
-- UnderConstruction.tsx). One row by design -- id is pinned to 1 via the
-- CHECK constraint rather than modeled as a keyed table, since there is
-- exactly one counter and no plan yet for more.
--
-- Seeded with a random "phantom" starting value (100-219) instead of 0, so
-- the page never opens looking like nobody has clicked it yet.
CREATE TABLE public.hype_counter (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    count BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT hype_counter_single_row CHECK (id = 1)
);

INSERT INTO public.hype_counter (id, count)
VALUES (1, 100 + floor(random() * 120)::bigint);
