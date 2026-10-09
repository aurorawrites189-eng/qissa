-- ============================================================================
-- Qissa — Phase 3: social extras (blocks), trigram search RPC, backend fixes
-- Apply with:  supabase db push        (or paste into the SQL editor)
-- File:        supabase/migrations/0002_social.sql
-- ============================================================================

-- Blocks -------------------------------------------------------------------
-- NOTE: blocks exist so feeds/search can EXCLUDE blocked authors. The
-- search_posts() function below and the /api/search + /api/feed/trending
-- routes filter blocked authors out. There is intentionally no block/unblock
-- UI in Phase 3 — the table + RLS are the foundation; UI can follow.
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

-- Owners manage their own block list; admins can read everything.
create policy "blocks_owner_all"
  on public.blocks for all
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

create policy "blocks_admin_all"
  on public.blocks for all
  using (public.is_admin())
  with check (public.is_admin());

create index blocks_blocker_id_idx on public.blocks (blocker_id);
create index blocks_blocked_id_idx on public.blocks (blocked_id);

grant select, insert, update, delete on public.blocks to authenticated;

-- Trigram search ------------------------------------------------------------
-- SECURITY INVOKER (default): the caller's RLS policies apply inside, so
-- children only ever match kids-approved published stories, and blocked
-- authors are excluded for the calling user.
create or replace function public.search_posts(
  query_text text,
  lang_filter text,
  result_limit int,
  result_offset int
)
returns setof public.posts
language sql
stable
set search_path = public
as $$
  select p.*
  from public.posts as p
  where (lang_filter is null or p.language = lang_filter)
    and (
      similarity(p.title, query_text) > 0.15
      or similarity(p.content, query_text) > 0.08
      or p.title ilike '%' || query_text || '%'
      or p.content ilike '%' || query_text || '%'
    )
    and not exists (
      select 1 from public.blocks as b
      where b.blocker_id = auth.uid()
        and b.blocked_id = p.author_id
    )
  order by greatest(similarity(p.title, query_text), similarity(p.content, query_text)) desc
  limit result_limit
  offset result_offset;
$$;

-- Backend guard-trigger fix --------------------------------------------------
-- Phase 1's guard triggers treat "not an admin JWT" as "not allowed", which
-- also blocked the SERVICE ROLE — i.e. our own backend (originality
-- checker, strike system, moderation routes, view counter) could not write
-- originality_status / strike_count / is_suspended / view_count at all.
-- These replacements keep the exact same user-facing behavior and add one
-- exemption: auth.role() = 'service_role'.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
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

create or replace function public.protect_post_moderation_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
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
