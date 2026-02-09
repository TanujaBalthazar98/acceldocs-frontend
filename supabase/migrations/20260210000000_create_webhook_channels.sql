-- Create table to track Google Drive webhook channels
create table if not exists webhook_channels (
  id uuid default gen_random_uuid() primary key,
  channel_id uuid not null unique,
  resource_id text not null,
  resource_type text not null check (resource_type in ('file', 'folder')),
  project_id uuid references projects(id) on delete cascade,
  topic_id uuid references topics(id) on delete set null,
  expiration bigint not null,
  channel_token text not null,
  created_at timestamp with time zone default now(),
  created_by uuid references auth.users(id)
);

-- Index for faster lookups during webhook processing
create index if not exists idx_webhook_channels_resource_id on webhook_channels(resource_id);
create index if not exists idx_webhook_channels_channel_id on webhook_channels(channel_id);

-- RLS Policies
alter table webhook_channels enable row level security;

-- Only admins/owners can view channels (or system)
create policy "Admins can view webhook channels"
  on webhook_channels for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role in ('owner', 'admin')
    )
  );

-- Only system/admins can insert (usually done via Edge Function which bypasses RLS if using service role, but good to have)
create policy "Admins can manage webhook channels"
  on webhook_channels for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role in ('owner', 'admin')
    )
  );
