alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
alter table public.departments enable row level security;
alter table public.courses enable row level security;
alter table public.resources enable row level security;

revoke all on public.profiles, public.clubs, public.events, public.rsvps,
  public.departments, public.courses, public.resources from public, anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.clubs, public.events,
  public.departments, public.courses to authenticated;
grant select, insert, delete on public.rsvps, public.resources to authenticated;

drop policy if exists "profiles read authenticated" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "clubs read authenticated" on public.clubs;
drop policy if exists "clubs admin write" on public.clubs;
drop policy if exists "events read authenticated" on public.events;
drop policy if exists "events admin write" on public.events;
drop policy if exists "departments read authenticated" on public.departments;
drop policy if exists "departments admin write" on public.departments;
drop policy if exists "courses read authenticated" on public.courses;
drop policy if exists "courses admin write" on public.courses;
drop policy if exists "rsvps read own or admin" on public.rsvps;
drop policy if exists "rsvps insert own" on public.rsvps;
drop policy if exists "rsvps delete own before checkin" on public.rsvps;
drop policy if exists "resources read authenticated" on public.resources;
drop policy if exists "resources insert own" on public.resources;
drop policy if exists "resources delete own or admin" on public.resources;
drop policy if exists "resources storage read authenticated" on storage.objects;
drop policy if exists "resources storage upload own folder" on storage.objects;
drop policy if exists "resources storage delete own or admin" on storage.objects;

create policy "profiles read authenticated"
  on public.profiles for select to authenticated using (true);
create policy "profiles update own"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "clubs read authenticated"
  on public.clubs for select to authenticated using (true);
create policy "clubs admin write"
  on public.clubs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "events read authenticated"
  on public.events for select to authenticated using (true);
create policy "events admin write"
  on public.events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "departments read authenticated"
  on public.departments for select to authenticated using (true);
create policy "departments admin write"
  on public.departments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "courses read authenticated"
  on public.courses for select to authenticated using (true);
create policy "courses admin write"
  on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "rsvps read own or admin"
  on public.rsvps for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "rsvps insert own"
  on public.rsvps for insert to authenticated
  with check (user_id = auth.uid());
create policy "rsvps delete own before checkin"
  on public.rsvps for delete to authenticated
  using (user_id = auth.uid() and checked_in_at is null);

create policy "resources read authenticated"
  on public.resources for select to authenticated using (true);
create policy "resources insert own"
  on public.resources for insert to authenticated
  with check (uploaded_by = auth.uid());
create policy "resources delete own or admin"
  on public.resources for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_admin());

insert into storage.buckets (id, name, public)
values ('resources', 'resources', false)
on conflict (id) do update set public = false;

create policy "resources storage read authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'resources');
create policy "resources storage upload own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resources'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "resources storage delete own or admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'resources'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.rsvp_counts() from public, anon;
grant execute on function public.rsvp_counts() to authenticated;
revoke execute on function public.check_in_rsvp(uuid) from public, anon;
grant execute on function public.check_in_rsvp(uuid) to authenticated;
