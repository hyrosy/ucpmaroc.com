alter table public.actor_services
  add column if not exists title text,
  add column if not exists status text not null default 'draft',
  add column if not exists media_urls text[] not null default '{}',
  add column if not exists media_assets jsonb not null default '[]'::jsonb,
  add column if not exists audio_urls text[] not null default '{}',
  add column if not exists offers jsonb not null default '[]'::jsonb,
  add column if not exists discount_percent numeric,
  add column if not exists location text,
  add column if not exists delivery_time text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.actor_services
  drop constraint if exists actor_services_status_check;

alter table public.actor_services
  add constraint actor_services_status_check
  check (status in ('draft', 'pending_review', 'approved', 'rejected', 'archived'));

update public.actor_services
set title = coalesce(title, service_id),
    status = case when enabled then 'approved' else 'draft' end
where title is null or status = 'draft';

update public.actor_services as service
set media_assets = (
  select coalesce(
    jsonb_agg(jsonb_build_object('url', gallery_url, 'status', 'approved')),
    '[]'::jsonb
  )
  from unnest(service.media_urls) as gallery_url
)
where jsonb_array_length(service.media_assets) = 0
  and cardinality(service.media_urls) > 0;

insert into public.actor_services (actor_id, service_id, enabled, title, status, rate, description)
select a.id, 'voice_over', coalesce(a.service_voiceover, false), 'Voice Over',
  case when coalesce(a.service_voiceover, false) then 'approved' else 'draft' end,
  a."BaseRate_per_Word", 'Professional narration, ads, podcast reads and brand audio.'
from public.actors as a
where not exists (
  select 1 from public.actor_services
  where actor_services.actor_id = a.id and actor_services.service_id = 'voice_over'
)
on conflict (actor_id, service_id) do nothing;

insert into public.actor_services (actor_id, service_id, enabled, title, status, rate, description)
select a.id, 'scriptwriting', coalesce(a.service_scriptwriting, false), 'Script Writing',
  case when coalesce(a.service_scriptwriting, false) then 'approved' else 'draft' end,
  a.service_script_rate, a.service_script_description
from public.actors as a
where not exists (
  select 1 from public.actor_services
  where actor_services.actor_id = a.id and actor_services.service_id = 'scriptwriting'
)
on conflict (actor_id, service_id) do nothing;

insert into public.actor_services (actor_id, service_id, enabled, title, status, rate, description)
select a.id, 'video_editing', coalesce(a.service_videoediting, false), 'Video Editing',
  case when coalesce(a.service_videoediting, false) then 'approved' else 'draft' end,
  a.service_video_rate, a.service_video_description
from public.actors as a
where not exists (
  select 1 from public.actor_services
  where actor_services.actor_id = a.id and actor_services.service_id = 'video_editing'
)
on conflict (actor_id, service_id) do nothing;

create index if not exists actor_services_public_idx
  on public.actor_services (service_id, status, enabled);

drop policy if exists "Enabled actor services are publicly readable" on public.actor_services;
drop policy if exists "Approved actor services are publicly readable" on public.actor_services;
create policy "Approved actor services are publicly readable"
  on public.actor_services for select
  using ((enabled and status = 'approved') or exists (
    select 1 from public.actors
    where actors.id = actor_services.actor_id
      and actors.user_id = auth.uid()
  ));
