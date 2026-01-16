alter table public.projects
  add column if not exists parent_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_parent_id_fkey'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_parent_id_fkey
      foreign key (parent_id) references public.projects(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_projects_parent_id on public.projects(parent_id);
