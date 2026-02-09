-- Enable pgcrypto for symmetric encryption helpers
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Per-organization encryption keys stored in Supabase Vault
CREATE TABLE IF NOT EXISTS public.organization_encryption_keys (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  vault_secret_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Track encrypted refresh tokens without exposing raw tokens
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_refresh_token_encrypted text,
  ADD COLUMN IF NOT EXISTS google_refresh_token_present boolean DEFAULT false NOT NULL;

-- Track encrypted OAuth tokens for connectors (if used)
ALTER TABLE public.connector_credentials
  ADD COLUMN IF NOT EXISTS oauth_access_token_encrypted text,
  ADD COLUMN IF NOT EXISTS oauth_refresh_token_encrypted text,
  ADD COLUMN IF NOT EXISTS oauth_tokens_present boolean DEFAULT false NOT NULL;

-- Encrypted document cache for fast reads (HTML + text + headings)
CREATE TABLE IF NOT EXISTS public.document_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  content_html_encrypted text,
  content_text_encrypted text,
  headings_encrypted text,
  published_content_html_encrypted text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS document_cache_document_id_idx
  ON public.document_cache(document_id);

CREATE INDEX IF NOT EXISTS document_cache_organization_id_idx
  ON public.document_cache(organization_id);

ALTER TABLE public.organization_encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_cache ENABLE ROW LEVEL SECURITY;

-- Ensure per-organization secret exists in Vault and return its id
CREATE OR REPLACE FUNCTION public.ensure_organization_encryption_key(org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  secret_id uuid;
  secret_value text;
BEGIN
  SELECT vault_secret_id INTO secret_id
  FROM public.organization_encryption_keys
  WHERE organization_id = org_id;

  IF secret_id IS NOT NULL THEN
    RETURN secret_id;
  END IF;

  secret_value := encode(gen_random_bytes(32), 'base64');
  INSERT INTO vault.secrets (name, secret)
  VALUES ('org:' || org_id::text, secret_value)
  RETURNING id INTO secret_id;

  INSERT INTO public.organization_encryption_keys (organization_id, vault_secret_id)
  VALUES (org_id, secret_id);

  RETURN secret_id;
END;
$$;

-- Fetch the per-organization secret key (plaintext) for server-side encryption
CREATE OR REPLACE FUNCTION public.get_organization_encryption_key(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  secret_id uuid;
  secret_value text;
BEGIN
  secret_id := public.ensure_organization_encryption_key(org_id);

  SELECT secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE id = secret_id;

  RETURN secret_value;
END;
$$;

-- Encrypt plaintext for an organization
CREATE OR REPLACE FUNCTION public.encrypt_org_text(org_id uuid, plaintext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key_value text;
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;

  key_value := public.get_organization_encryption_key(org_id);
  RETURN encode(pgp_sym_encrypt(plaintext, key_value, 'compress-algo=1, cipher-algo=aes256'), 'base64');
END;
$$;

-- Decrypt ciphertext for an organization
CREATE OR REPLACE FUNCTION public.decrypt_org_text(org_id uuid, ciphertext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key_value text;
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;

  key_value := public.get_organization_encryption_key(org_id);
  RETURN pgp_sym_decrypt(decode(ciphertext, 'base64'), key_value);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_organization_encryption_key(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_organization_encryption_key(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.encrypt_org_text(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrypt_org_text(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ensure_organization_encryption_key(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_organization_encryption_key(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_org_text(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_org_text(uuid, text) TO service_role;
