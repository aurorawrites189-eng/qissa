-- ============================================================================
-- Qissa — Phase 1 database schema
-- Apply with:  supabase db push        (or paste into the SQL editor)
-- File:        supabase/migrations/0001_schema.sql
-- ============================================================================

-- Extensions ---------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- trigram search index

-- Tables -------------------------------------------------------------------
-- NOTE: every table gets id uuid PK default gen_random_uuid() + created_at,
-- except profiles whose id MUST equal auth.users(id) (no default).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  preferred_language text not null default 'en',
  birth_year int,
  age_class text check (age_class in ('child', 'adult')),
  is_admin boolean not null default false,
  strike_count int not null default 0,
  is_suspended boolean not null default false,
  suspended_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_en text not null,
  name_ur text not null,
  is_kids boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null,
  language text not null default 'en',
  category text,
  tags text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'published', 'withheld')),
  visibility text not null default 'public'
    check (visibility in ('public', 'unlisted', 'private')),
  moderation_status text not null default 'unreviewed',
  originality_status text not null default 'unchecked'
    check (originality_status in ('unchecked', 'low', 'possible_duplication', 'strong_evidence')),
  originality_evidence jsonb,
  is_kids_approved boolean not null default false,
  published_at timestamptz,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  caption text,
  created_at timestamptz not null default now()
);

create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.originality_checks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  status text not null,
  evidence jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.violations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  type text not null,
  evidence jsonb,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'appealed', 'overturned')),
  created_at timestamptz not null default now()
);

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  violation_id uuid not null references public.violations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  status text not null default 'open',
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  target_type text not null,
  target_id uuid,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

create table public.reading_history (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- Helper functions ---------------------------------------------------------
-- SECURITY DEFINER helpers let RLS policies read the viewer's own profile
-- WITHOUT recursing into profiles' own RLS policies (which would loop).

-- The viewer's age_class ('child' | 'adult'); NULL for anonymous visitors
-- or authenticated users that have no profile row yet.
create or replace function public.current_age_class()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.age_class
  from public.profiles as p
  where p.id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles as p where p.id = auth.uid()),
    false
  );
$$;

-- Central visibility rule for posts. SECURITY INVOKER (default): the
-- caller's own RLS context applies inside, so this is safe to reuse from
-- the post_images / comments policies.
create or replace function public.can_view_post(p public.posts)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    -- Authors always see their own posts (including drafts).
    p.author_id = auth.uid()
    -- Child accounts see ONLY kids-approved published posts.
    or (
      public.current_age_class() = 'child'
      and p.status = 'published'
      and p.is_kids_approved = true
    )
    -- Anonymous visitors and adults see published public posts.
    or (
      p.status = 'published'
      and p.visibility = 'public'
      and (
        public.current_age_class() is null
        or public.current_age_class() = 'adult'
      )
    );
$$;

-- updated_at maintenance ----------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.handle_updated_at();

-- Guard triggers -------------------------------------------------------------
-- Non-admins may never touch privilege / moderation-controlled columns,
-- even if a policy would otherwise allow the row update.

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.is_admin is distinct from old.is_admin
     or new.strike_count is distinct from old.strike_count
     or new.is_suspended is distinct from old.is_suspended
     or new.suspended_until is distinct from old.suspended_until
     or new.age_class is distinct from old.age_class
     or new.id is distinct from old.id then
    raise exception 'not allowed to modify protected profile fields';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Authors cannot self-approve kids / moderation / originality flags.
create or replace function public.protect_post_moderation_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.is_kids_approved is distinct from old.is_kids_approved
     or new.moderation_status is distinct from old.moderation_status
     or new.originality_status is distinct from old.originality_status
     or new.originality_evidence is distinct from old.originality_evidence then
    raise exception 'only moderators can change moderation fields';
  end if;
  return new;
end;
$$;

create trigger posts_protect_moderation
  before update on public.posts
  for each row execute function public.protect_post_moderation_fields();

-- Force safe defaults on insert for non-admins (same idea, insert side).
create or replace function public.default_post_moderation_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  new.is_kids_approved := false;
  new.moderation_status := 'unreviewed';
  new.originality_status := 'unchecked';
  new.originality_evidence := null;
  new.view_count := 0;
  return new;
end;
$$;

create trigger posts_default_moderation
  before insert on public.posts
  for each row execute function public.default_post_moderation_fields();

-- Public profile view ---------------------------------------------------------
-- RLS cannot do column-level grants, so the "public fields" of profiles are
-- exposed through this SECURITY DEFINER view: only username, display_name,
-- avatar_url and bio of NON-suspended users. The base table stays locked down.
create or replace view public.public_profiles
with (security_invoker = false)
as
select p.id, p.username, p.display_name, p.avatar_url, p.bio
from public.profiles as p
where p.is_suspended = false;

-- Indexes --------------------------------------------------------------------
create index profiles_username_lower_idx on public.profiles (lower(username));

create index posts_author_id_idx on public.posts (author_id);
create index posts_status_published_at_idx on public.posts (status, published_at desc);
create index posts_language_idx on public.posts (language);
create index posts_search_trgm_idx
  on public.posts using gin ((title || ' ' || content) gin_trgm_ops);

create index post_images_post_id_idx on public.post_images (post_id);

create index likes_user_id_idx on public.likes (user_id);
create index likes_post_id_idx on public.likes (post_id);

create index comments_post_id_idx on public.comments (post_id);
create index comments_author_id_idx on public.comments (author_id);

create index follows_follower_id_idx on public.follows (follower_id);
create index follows_following_id_idx on public.follows (following_id);

create index saved_posts_user_id_idx on public.saved_posts (user_id);
create index saved_posts_post_id_idx on public.saved_posts (post_id);

create index notifications_user_id_idx on public.notifications (user_id);

create index originality_checks_post_id_idx on public.originality_checks (post_id);

create index reports_reporter_id_idx on public.reports (reporter_id);
create index reports_post_id_idx on public.reports (post_id);

create index violations_user_id_idx on public.violations (user_id);
create index violations_post_id_idx on public.violations (post_id);

create index appeals_violation_id_idx on public.appeals (violation_id);
create index appeals_user_id_idx on public.appeals (user_id);

create index moderation_actions_admin_id_idx on public.moderation_actions (admin_id);

create index reading_history_user_id_idx on public.reading_history (user_id);
create index reading_history_post_id_idx on public.reading_history (post_id);

-- RLS -------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.saved_posts enable row level security;
alter table public.notifications enable row level security;
alter table public.originality_checks enable row level security;
alter table public.reports enable row level security;
alter table public.violations enable row level security;
alter table public.appeals enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.reading_history enable row level security;

-- profiles: users read/update own row; admins read all. Public fields of
-- non-suspended users go through the public_profiles view (granted below).
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_admin_all"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- categories: public read, admin write.
create policy "categories_select_all"
  on public.categories for select
  using (true);

create policy "categories_admin_all"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

-- posts: visibility via can_view_post(); children are read-only in v1.
create policy "posts_select"
  on public.posts for select
  using (public.can_view_post(posts));

create policy "posts_insert_author"
  on public.posts for insert
  with check (
    auth.uid() = author_id
    and public.current_age_class() is distinct from 'child'
  );

create policy "posts_update_author"
  on public.posts for update
  using (
    auth.uid() = author_id
    and public.current_age_class() is distinct from 'child'
  )
  with check (
    auth.uid() = author_id
    and public.current_age_class() is distinct from 'child'
  );

create policy "posts_delete_author"
  on public.posts for delete
  using (
    auth.uid() = author_id
    and public.current_age_class() is distinct from 'child'
  );

create policy "posts_admin_all"
  on public.posts for all
  using (public.is_admin())
  with check (public.is_admin());

-- post_images: readable with the post; writable by the post's author.
create policy "post_images_select"
  on public.post_images for select
  using (
    exists (
      select 1 from public.posts as p
      where p.id = post_images.post_id and public.can_view_post(p)
    )
  );

create policy "post_images_insert_author"
  on public.post_images for insert
  with check (
    public.current_age_class() is distinct from 'child'
    and exists (
      select 1 from public.posts as p
      where p.id = post_images.post_id and p.author_id = auth.uid()
    )
  );

create policy "post_images_update_author"
  on public.post_images for update
  using (
    public.current_age_class() is distinct from 'child'
    and exists (
      select 1 from public.posts as p
      where p.id = post_images.post_id and p.author_id = auth.uid()
    )
  )
  with check (
    public.current_age_class() is distinct from 'child'
    and exists (
      select 1 from public.posts as p
      where p.id = post_images.post_id and p.author_id = auth.uid()
    )
  );

create policy "post_images_delete_author"
  on public.post_images for delete
  using (
    public.current_age_class() is distinct from 'child'
    and exists (
      select 1 from public.posts as p
      where p.id = post_images.post_id and p.author_id = auth.uid()
    )
  );

create policy "post_images_admin_all"
  on public.post_images for all
  using (public.is_admin())
  with check (public.is_admin());

-- likes: owner-only; children cannot write (read-only in v1).
create policy "likes_select_own"
  on public.likes for select
  using (user_id = auth.uid() or public.is_admin());

create policy "likes_insert_own"
  on public.likes for insert
  with check (
    user_id = auth.uid()
    and public.current_age_class() is distinct from 'child'
  );

create policy "likes_delete_own"
  on public.likes for delete
  using (
    user_id = auth.uid()
    and public.current_age_class() is distinct from 'child'
  );

create policy "likes_admin_all"
  on public.likes for all
  using (public.is_admin())
  with check (public.is_admin());

-- comments: anyone who can view the post can read its comments; only the
-- author (non-child) can write. NOTE: this intentionally deviates from
-- strict "owner-only" reads — comments are meaningless if readers cannot
-- see each other's comments on a public story.
create policy "comments_select"
  on public.comments for select
  using (
    author_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.posts as p
      where p.id = comments.post_id and public.can_view_post(p)
    )
  );

create policy "comments_insert"
  on public.comments for insert
  with check (
    author_id = auth.uid()
    and public.current_age_class() is distinct from 'child'
    and exists (
      select 1 from public.posts as p
      where p.id = comments.post_id and public.can_view_post(p)
    )
  );

create policy "comments_update_own"
  on public.comments for update
  using (
    author_id = auth.uid()
    and public.current_age_class() is distinct from 'child'
  )
  with check (
    author_id = auth.uid()
    and public.current_age_class() is distinct from 'child'
  );

create policy "comments_delete_own"
  on public.comments for delete
  using (
    author_id = auth.uid()
    and public.current_age_class() is distinct from 'child'
  );

create policy "comments_admin_all"
  on public.comments for all
  using (public.is_admin())
  with check (public.is_admin());

-- follows: a user sees relationships they are part of; only the follower
-- (non-child) can create/remove them. NOTE: reads include following_id =
-- auth.uid() (your followers) — needed for follower lists to work at all.
create policy "follows_select_involved"
  on public.follows for select
  using (
    follower_id = auth.uid()
    or following_id = auth.uid()
    or public.is_admin()
  );

create policy "follows_insert_own"
  on public.follows for insert
  with check (
    follower_id = auth.uid()
    and public.current_age_class() is distinct from 'child'
  );

create policy "follows_delete_own"
  on public.follows for delete
  using (
    follower_id = auth.uid()
    and public.current_age_class() is distinct from 'child'
  );

create policy "follows_admin_all"
  on public.follows for all
  using (public.is_admin())
  with check (public.is_admin());

-- saved_posts: owner-only (saving is read-side personalization, allowed for kids).
create policy "saved_posts_select_own"
  on public.saved_posts for select
  using (user_id = auth.uid() or public.is_admin());

create policy "saved_posts_insert_own"
  on public.saved_posts for insert
  with check (user_id = auth.uid());

create policy "saved_posts_delete_own"
  on public.saved_posts for delete
  using (user_id = auth.uid());

create policy "saved_posts_admin_all"
  on public.saved_posts for all
  using (public.is_admin())
  with check (public.is_admin());

-- notifications: owner-only; inserts come from the service role (bypasses RLS).
create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());

create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications_delete_own"
  on public.notifications for delete
  using (user_id = auth.uid());

create policy "notifications_admin_all"
  on public.notifications for all
  using (public.is_admin())
  with check (public.is_admin());

-- reading_history: owner-only (kids need this writable for "continue reading").
create policy "reading_history_select_own"
  on public.reading_history for select
  using (user_id = auth.uid() or public.is_admin());

create policy "reading_history_insert_own"
  on public.reading_history for insert
  with check (user_id = auth.uid());

create policy "reading_history_update_own"
  on public.reading_history for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "reading_history_delete_own"
  on public.reading_history for delete
  using (user_id = auth.uid());

create policy "reading_history_admin_all"
  on public.reading_history for all
  using (public.is_admin())
  with check (public.is_admin());

-- originality_checks: post author can read own; admins manage.
create policy "originality_checks_select"
  on public.originality_checks for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.posts as p
      where p.id = originality_checks.post_id and p.author_id = auth.uid()
    )
  );

create policy "originality_checks_admin_all"
  on public.originality_checks for all
  using (public.is_admin())
  with check (public.is_admin());

-- reports: users insert + read own; admins manage.
create policy "reports_select_own_or_admin"
  on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());

create policy "reports_insert_own"
  on public.reports for insert
  with check (reporter_id = auth.uid());

create policy "reports_admin_all"
  on public.reports for all
  using (public.is_admin())
  with check (public.is_admin());

-- violations: user sees own; admins manage.
create policy "violations_select_own_or_admin"
  on public.violations for select
  using (user_id = auth.uid() or public.is_admin());

create policy "violations_admin_all"
  on public.violations for all
  using (public.is_admin())
  with check (public.is_admin());

-- appeals: user sees/inserts own (only against own violations); admins manage.
create policy "appeals_select_own_or_admin"
  on public.appeals for select
  using (user_id = auth.uid() or public.is_admin());

create policy "appeals_insert_own"
  on public.appeals for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.violations as v
      where v.id = appeals.violation_id and v.user_id = auth.uid()
    )
  );

create policy "appeals_admin_all"
  on public.appeals for all
  using (public.is_admin())
  with check (public.is_admin());

-- moderation_actions: audit log, admin only.
create policy "moderation_actions_admin_all"
  on public.moderation_actions for all
  using (public.is_admin())
  with check (public.is_admin());

-- Grants: table privileges are the ceiling, RLS policies do the filtering.
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Public profile view: readable by everyone (only public fields, non-suspended).
grant select on public.public_profiles to anon, authenticated;
