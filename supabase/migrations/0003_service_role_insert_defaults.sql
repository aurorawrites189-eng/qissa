-- ============================================================================
-- Qissa — migration 0003: service_role exemption for insert-side defaults
--
-- Phase 3 (0002) added an `auth.role() = 'service_role'` exemption to the
-- UPDATE-side guard functions (protect_profile_fields,
-- protect_post_moderation_fields) but missed the INSERT-side
-- default_post_moderation_fields(). Consequence: any service_role insert
-- (seed scripts, admin tooling, future workers) silently had
-- is_kids_approved / moderation_status / originality_status reset to the
-- safe defaults, with no error raised.
--
-- This re-creates the function with the same exemption. User-facing
-- behavior is unchanged: regular (non-admin, non-service-role) inserts
-- still get the forced safe defaults.
-- ============================================================================

create or replace function public.default_post_moderation_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
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
