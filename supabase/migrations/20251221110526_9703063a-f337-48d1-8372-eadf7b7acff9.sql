-- Add MCP enabled field to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS mcp_enabled boolean DEFAULT false;