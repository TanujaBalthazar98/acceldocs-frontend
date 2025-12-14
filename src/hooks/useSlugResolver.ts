import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface SlugResolution {
  organizationId: string | null;
  projectId: string | null;
  documentId: string | null;
  loading: boolean;
  error: string | null;
  redirected: boolean;
}

/**
 * Resolves slugs to entity IDs, handling redirects for old slugs
 */
export function useSlugResolver(
  orgSlug?: string,
  projectSlug?: string,
  pageSlug?: string
): SlugResolution {
  const navigate = useNavigate();
  const [resolution, setResolution] = useState<SlugResolution>({
    organizationId: null,
    projectId: null,
    documentId: null,
    loading: true,
    error: null,
    redirected: false,
  });

  useEffect(() => {
    if (!orgSlug) {
      setResolution(prev => ({ ...prev, loading: false }));
      return;
    }

    resolveSlug();
  }, [orgSlug, projectSlug, pageSlug]);

  const resolveSlug = async () => {
    setResolution(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Resolve organization by slug or domain
      let orgId: string | null = null;
      let orgData = await supabase
        .from("organizations")
        .select("id, slug, domain")
        .or(`slug.eq.${orgSlug},domain.eq.${orgSlug}`)
        .maybeSingle();

      if (orgData.data) {
        orgId = orgData.data.id;
      } else {
        // Check slug history for redirect
        const { data: historyData } = await supabase
          .from("slug_history")
          .select("entity_id")
          .eq("entity_type", "organization")
          .eq("old_slug", orgSlug)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (historyData) {
          // Get current slug and redirect
          const { data: currentOrg } = await supabase
            .from("organizations")
            .select("slug, domain")
            .eq("id", historyData.entity_id)
            .maybeSingle();

          if (currentOrg) {
            const newOrgSlug = currentOrg.slug || currentOrg.domain;
            const newPath = buildRedirectPath(newOrgSlug, projectSlug, pageSlug);
            navigate(newPath, { replace: true });
            setResolution(prev => ({ ...prev, redirected: true, loading: false }));
            return;
          }
        }

        // Org not found
        setResolution({
          organizationId: null,
          projectId: null,
          documentId: null,
          loading: false,
          error: "Organization not found",
          redirected: false,
        });
        return;
      }

      // Resolve project by slug within organization
      let projectId: string | null = null;
      if (projectSlug && orgId) {
        const { data: projectData } = await supabase
          .from("projects")
          .select("id, slug, organization_id")
          .eq("organization_id", orgId)
          .eq("slug", projectSlug)
          .maybeSingle();

        if (projectData) {
          projectId = projectData.id;
        } else {
          // Check slug history for project redirect
          const { data: historyData } = await supabase
            .from("slug_history")
            .select("entity_id")
            .eq("entity_type", "project")
            .eq("old_slug", projectSlug)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (historyData) {
            // Verify project belongs to this org and get current slug
            const { data: currentProject } = await supabase
              .from("projects")
              .select("slug, organization_id")
              .eq("id", historyData.entity_id)
              .eq("organization_id", orgId)
              .maybeSingle();

            if (currentProject?.slug) {
              const newPath = buildRedirectPath(orgSlug, currentProject.slug, pageSlug);
              navigate(newPath, { replace: true });
              setResolution(prev => ({ ...prev, redirected: true, loading: false }));
              return;
            }
          }
        }
      }

      // Resolve document by slug within project
      let documentId: string | null = null;
      if (pageSlug && projectId) {
        const { data: docData } = await supabase
          .from("documents")
          .select("id, slug, project_id")
          .eq("project_id", projectId)
          .eq("slug", pageSlug)
          .maybeSingle();

        if (docData) {
          documentId = docData.id;
        } else {
          // Check slug history for document redirect
          const { data: historyData } = await supabase
            .from("slug_history")
            .select("entity_id")
            .eq("entity_type", "document")
            .eq("old_slug", pageSlug)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (historyData) {
            // Verify document belongs to this project and get current slug
            const { data: currentDoc } = await supabase
              .from("documents")
              .select("slug, project_id")
              .eq("id", historyData.entity_id)
              .eq("project_id", projectId)
              .maybeSingle();

            if (currentDoc?.slug) {
              const newPath = buildRedirectPath(orgSlug, projectSlug, currentDoc.slug);
              navigate(newPath, { replace: true });
              setResolution(prev => ({ ...prev, redirected: true, loading: false }));
              return;
            }
          }
        }
      }

      setResolution({
        organizationId: orgId,
        projectId,
        documentId,
        loading: false,
        error: null,
        redirected: false,
      });
    } catch (error) {
      console.error("Error resolving slugs:", error);
      setResolution({
        organizationId: null,
        projectId: null,
        documentId: null,
        loading: false,
        error: "Failed to resolve slugs",
        redirected: false,
      });
    }
  };

  return resolution;
}

function buildRedirectPath(
  orgSlug?: string,
  projectSlug?: string,
  pageSlug?: string
): string {
  let path = "/docs";
  if (orgSlug) path += `/${orgSlug}`;
  if (projectSlug) path += `/${projectSlug}`;
  if (pageSlug) path += `/${pageSlug}`;
  return path;
}

/**
 * Utility to generate slug-based URL for a document
 */
export async function getDocumentSlugUrl(
  documentId: string
): Promise<string | null> {
  try {
    const { data: doc } = await supabase
      .from("documents")
      .select(`
        slug,
        project_id,
        projects!inner (
          slug,
          organization_id,
          organizations!inner (
            slug,
            domain
          )
        )
      `)
      .eq("id", documentId)
      .single();

    if (!doc) return null;

    const project = (doc as any).projects;
    const org = project?.organizations;
    const orgSlug = org?.slug || org?.domain;
    const projectSlug = project?.slug;
    const pageSlug = doc.slug;

    if (!orgSlug || !projectSlug || !pageSlug) return null;

    return `/docs/${orgSlug}/${projectSlug}/${pageSlug}`;
  } catch (error) {
    console.error("Error generating slug URL:", error);
    return null;
  }
}
