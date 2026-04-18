-- Auth + Community + Save Sharing schema
create extension if not exists pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('user', 'moderator', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'publish_status') THEN
    CREATE TYPE public.publish_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_type') THEN
    CREATE TYPE public.source_type AS ENUM ('save_slot', 'eliya_link', 'custom');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visibility') THEN
    CREATE TYPE public.visibility AS ENUM ('private', 'unlisted', 'public');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_targets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL,
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  source_type public.source_type NOT NULL,
  publish_status public.publish_status NOT NULL DEFAULT 'draft',
  visibility public.visibility NOT NULL DEFAULT 'public',
  target_id bigint REFERENCES public.content_targets(id),
  boss_label text,
  raw_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_builds (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  main_unit_ids int[] NOT NULL,
  unison_unit_ids int[] NOT NULL,
  equipment_ids int[] NOT NULL,
  soul_ids int[] NOT NULL,
  slot_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT team_builds_main_unit_ids_len CHECK (cardinality(main_unit_ids) = 3),
  CONSTRAINT team_builds_unison_unit_ids_len CHECK (cardinality(unison_unit_ids) = 3),
  CONSTRAINT team_builds_equipment_ids_len CHECK (cardinality(equipment_ids) = 3),
  CONSTRAINT team_builds_soul_ids_len CHECK (cardinality(soul_ids) = 3)
);

CREATE TABLE IF NOT EXISTS public.team_tags (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  tag text NOT NULL,
  PRIMARY KEY (team_id, tag)
);

CREATE TABLE IF NOT EXISTS public.moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.save_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  visibility public.visibility NOT NULL DEFAULT 'private',
  sanitized_save jsonb NOT NULL,
  sanitized_hash text NOT NULL,
  expires_at timestamptz,
  download_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.save_share_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  save_share_id uuid NOT NULL REFERENCES public.save_shares(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON public.teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_publish_status ON public.teams(publish_status);
CREATE INDEX IF NOT EXISTS idx_teams_target_id ON public.teams(target_id);
CREATE INDEX IF NOT EXISTS idx_team_tags_tag ON public.team_tags(tag);
CREATE INDEX IF NOT EXISTS idx_save_shares_owner_id ON public.save_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_save_shares_visibility ON public.save_shares(visibility);
CREATE INDEX IF NOT EXISTS idx_reports_entity ON public.reports(entity_type, entity_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_teams_set_updated_at ON public.teams;
CREATE TRIGGER trg_teams_set_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_save_shares_set_updated_at ON public.save_shares;
CREATE TRIGGER trg_save_shares_set_updated_at
BEFORE UPDATE ON public.save_shares
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), 'user'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_moderator_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_app_role() IN ('moderator'::public.app_role, 'admin'::public.app_role);
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.save_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.save_share_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
FOR SELECT USING (true);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE USING (id = auth.uid())
WITH CHECK (id = auth.uid() AND (role = (SELECT role FROM public.profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams
FOR SELECT USING (
  owner_id = auth.uid()
  OR public.is_moderator_or_admin()
  OR (publish_status = 'approved'::public.publish_status AND visibility = 'public'::public.visibility)
);

DROP POLICY IF EXISTS teams_insert_owner ON public.teams;
CREATE POLICY teams_insert_owner ON public.teams
FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS teams_update_owner_draft_pending ON public.teams;
CREATE POLICY teams_update_owner_draft_pending ON public.teams
FOR UPDATE USING (
  owner_id = auth.uid() AND publish_status IN ('draft'::public.publish_status, 'pending'::public.publish_status)
)
WITH CHECK (
  owner_id = auth.uid() AND publish_status IN ('draft'::public.publish_status, 'pending'::public.publish_status)
);

DROP POLICY IF EXISTS teams_update_moderator ON public.teams;
CREATE POLICY teams_update_moderator ON public.teams
FOR UPDATE USING (public.is_moderator_or_admin())
WITH CHECK (public.is_moderator_or_admin());

DROP POLICY IF EXISTS teams_delete_owner_draft_pending ON public.teams;
CREATE POLICY teams_delete_owner_draft_pending ON public.teams
FOR DELETE USING (
  owner_id = auth.uid() AND publish_status IN ('draft'::public.publish_status, 'pending'::public.publish_status)
);

DROP POLICY IF EXISTS team_builds_select ON public.team_builds;
CREATE POLICY team_builds_select ON public.team_builds
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_builds.team_id
      AND (
        t.owner_id = auth.uid()
        OR public.is_moderator_or_admin()
        OR (t.publish_status = 'approved'::public.publish_status AND t.visibility = 'public'::public.visibility)
      )
  )
);

DROP POLICY IF EXISTS team_builds_modify ON public.team_builds;
CREATE POLICY team_builds_modify ON public.team_builds
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_builds.team_id
      AND (
        t.owner_id = auth.uid()
        OR public.is_moderator_or_admin()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_builds.team_id
      AND (
        t.owner_id = auth.uid()
        OR public.is_moderator_or_admin()
      )
  )
);

DROP POLICY IF EXISTS team_tags_select ON public.team_tags;
CREATE POLICY team_tags_select ON public.team_tags
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_tags.team_id
      AND (
        t.owner_id = auth.uid()
        OR public.is_moderator_or_admin()
        OR (t.publish_status = 'approved'::public.publish_status AND t.visibility = 'public'::public.visibility)
      )
  )
);

DROP POLICY IF EXISTS team_tags_modify ON public.team_tags;
CREATE POLICY team_tags_modify ON public.team_tags
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_tags.team_id
      AND (
        t.owner_id = auth.uid()
        OR public.is_moderator_or_admin()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_tags.team_id
      AND (
        t.owner_id = auth.uid()
        OR public.is_moderator_or_admin()
      )
  )
);

DROP POLICY IF EXISTS moderation_events_select ON public.moderation_events;
CREATE POLICY moderation_events_select ON public.moderation_events
FOR SELECT USING (
  public.is_moderator_or_admin()
  OR EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = moderation_events.team_id AND t.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS moderation_events_insert_mod ON public.moderation_events;
CREATE POLICY moderation_events_insert_mod ON public.moderation_events
FOR INSERT WITH CHECK (
  public.is_moderator_or_admin() AND reviewer_id = auth.uid()
);

DROP POLICY IF EXISTS save_shares_select ON public.save_shares;
CREATE POLICY save_shares_select ON public.save_shares
FOR SELECT USING (
  owner_id = auth.uid() OR visibility = 'public'::public.visibility
);

DROP POLICY IF EXISTS save_shares_insert_owner ON public.save_shares;
CREATE POLICY save_shares_insert_owner ON public.save_shares
FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS save_shares_update_owner ON public.save_shares;
CREATE POLICY save_shares_update_owner ON public.save_shares
FOR UPDATE USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS save_shares_delete_owner ON public.save_shares;
CREATE POLICY save_shares_delete_owner ON public.save_shares
FOR DELETE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS save_share_events_select ON public.save_share_events;
CREATE POLICY save_share_events_select ON public.save_share_events
FOR SELECT USING (
  public.is_moderator_or_admin()
  OR EXISTS (
    SELECT 1
    FROM public.save_shares s
    WHERE s.id = save_share_events.save_share_id AND s.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS save_share_events_insert ON public.save_share_events;
CREATE POLICY save_share_events_insert ON public.save_share_events
FOR INSERT WITH CHECK (
  actor_id = auth.uid() OR public.is_moderator_or_admin() OR actor_id IS NULL
);

DROP POLICY IF EXISTS reports_select ON public.reports;
CREATE POLICY reports_select ON public.reports
FOR SELECT USING (reporter_id = auth.uid() OR public.is_moderator_or_admin());

DROP POLICY IF EXISTS reports_insert ON public.reports;
CREATE POLICY reports_insert ON public.reports
FOR INSERT WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS reports_update_mod ON public.reports;
CREATE POLICY reports_update_mod ON public.reports
FOR UPDATE USING (public.is_moderator_or_admin())
WITH CHECK (public.is_moderator_or_admin());

-- Seed content targets if table is empty
INSERT INTO public.content_targets (kind, slug, label)
SELECT 'boss', 'general-boss', 'General Boss'
WHERE NOT EXISTS (SELECT 1 FROM public.content_targets);
