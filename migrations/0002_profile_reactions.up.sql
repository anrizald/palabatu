-- Lets a climber react to another climber's profile with a small fixed set
-- of emoji (like/fire/heart), one reaction per type per user, toggleable.

CREATE TABLE public.profile_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    user_id uuid,
    reaction_type text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE ONLY public.profile_reactions
    ADD CONSTRAINT profile_reactions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profile_reactions
    ADD CONSTRAINT profile_reactions_type_check CHECK (reaction_type IN ('like', 'fire', 'heart'));

ALTER TABLE ONLY public.profile_reactions
    ADD CONSTRAINT profile_reactions_profile_id_user_id_reaction_type_key UNIQUE (profile_id, user_id, reaction_type);

ALTER TABLE ONLY public.profile_reactions
    ADD CONSTRAINT profile_reactions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profile_reactions
    ADD CONSTRAINT profile_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
