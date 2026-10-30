-- Plant Memory: saved plants, their checks over time, and what the farmer did between checks.

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  crop text,
  bed_label text check (bed_label is null or char_length(bed_label) <= 80),
  planted_on date,
  location text check (location is null or char_length(location) <= 120),
  created_at timestamptz not null default now()
);

create table public.checks (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  photo_path text,
  result_json jsonb not null,
  growth_stage text,
  flowering boolean,
  summary text
);

create table public.practice_logs (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_at timestamptz not null default now(),
  kind text not null check (kind in ('watering', 'fertilizer', 'spray', 'pruning', 'other')),
  note text not null check (char_length(note) between 1 and 500)
);

create index plants_user_idx on public.plants (user_id, created_at desc);
create index checks_plant_idx on public.checks (plant_id, created_at desc);
create index practice_logs_plant_idx on public.practice_logs (plant_id, logged_at desc);

alter table public.plants enable row level security;
alter table public.checks enable row level security;
alter table public.practice_logs enable row level security;

create policy "own plants" on public.plants
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own checks" on public.checks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.plants p where p.id = plant_id and p.user_id = (select auth.uid()))
  );

create policy "own practice logs" on public.practice_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.plants p where p.id = plant_id and p.user_id = (select auth.uid()))
  );

insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', false)
on conflict (id) do nothing;

-- Objects live under plant-photos/{user_id}/...
create policy "own plant photos read" on storage.objects
  for select to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own plant photos write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own plant photos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
