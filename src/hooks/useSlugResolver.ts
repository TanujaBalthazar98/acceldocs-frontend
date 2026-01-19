import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface SlugResolution {
  organizationId: string | null;
  projectId: string | null;
  projectVersionId: string | null;
  topicId: string | null;
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
  versionSlug?: string,
  topicSlug?: string,
  pageSlug?: string
): SlugResolution {
  const navigate = useNavigate();
  const [resolution, setResolution] = useState<SlugResolution>({
    organizationId: null,
    projectId: null,
    projectVersionId: null,
    topicId: null,
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
  }, [orgSlug, projectSlug, versionSlug, topicSlug, pageSlug]);

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
          const { data: currentOrg } = await supabase
            .from("organizations")
            .select("slug, domain")
            .eq("id", historyData.entity_id)
            .maybeSingle();

          if (currentOrg) {
            const newOrgSlug = currentOrg.slug || currentOrg.domain;
            const newPath = buildRedirectPath(newOrgSlug, projectSlug, topicSlug, pageSlug);
            navigate(newPath, { replace: true });
            setResolution(prev => ({ ...prev, redirected: true, loading: false }));
            return;
          }
        }

        setResolution({
          organizationId: null,
          projectId: null,
          topicId: null,
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
            const { data: currentProject } = await supabase
              .from("projects")
              .select("slug, organization_id")
              .eq("id", historyData.entity_id)
              .eq("organization_id", orgId)
              .maybeSingle();

            if (currentProject?.slug) {
              const newPath = buildRedirectPath(orgSlug, currentProject.slug, versionSlug, topicSlug, pageSlug);
              navigate(newPath, { replace: true });
              setResolution(prev => ({ ...prev, redirected: true, loading: false }));
              return;
            }
          }
        }
      }

      let projectVersionId: string | null = null;
      if (projectId) {
        if (versionSlug) {
          const { data: versionData } = await supabase
            .from("project_versions")
            .select("id")
            .eq("project_id", projectId)
            .eq("slug", versionSlug)
            .maybeSingle();
          projectVersionId = versionData?.id ?? null;
        }

        if (!projectVersionId) {
          const { data: defaultVersion } = await supabase
            .from("project_versions")
            .select("id")
            .eq("project_id", projectId)
            .eq("is_default", true)
            .maybeSingle();
          projectVersionId = defaultVersion?.id ?? null;
        }

        if (!projectVersionId) {
          const { data: publishedVersion } = await supabase
            .from("project_versions")
            .select("id")
            .eq("project_id", projectId)
            .eq("is_published", true)
            .order("semver_major", { ascending: false })
            .order("semver_minor", { ascending: false })
            .order("semver_patch", { ascending: false })
            .limit(1)
            .maybeSingle();
          projectVersionId = publishedVersion?.id ?? null;
        }

        if (!projectVersionId) {
          const { data: latestVersion } = await supabase
            .from("project_versions")
            .select("id")
            .eq("project_id", projectId)
            .order("semver_major", { ascending: false })
            .order("semver_minor", { ascending: false })
            .order("semver_patch", { ascending: false })
            .limit(1)
            .maybeSingle();
          projectVersionId = latestVersion?.id ?? null;
        }
      }

      // Resolve topic by slug within project (if topicSlug provided)
      let topicId: string | null = null;
      if (topicSlug && projectId) {
        const { data: topicData } = await supabase
          .from("topics")
          .select("id, slug, project_id")
          .eq("project_id", projectId)
          .eq("project_version_id", projectVersionId)
          .eq("slug", topicSlug)
          .maybeSingle();

        if (topicData) {
          topicId = topicData.id;
        } else {
          // Check slug history for topic redirect
          const { data: historyData } = await supabase
            .from("slug_history")
            .select("entity_id")
            .eq("entity_type", "topic")
            .eq("old_slug", topicSlug)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (historyData) {
            const { data: currentTopic } = await supabase
              .from("topics")
              .select("slug, project_id")
              .eq("id", historyData.entity_id)
              .eq("project_id", projectId)
              .eq("project_version_id", projectVersionId)
              .maybeSingle();

            if (currentTopic?.slug) {
              const newPath = buildRedirectPath(orgSlug, projectSlug, versionSlug, currentTopic.slug, pageSlug);
              navigate(newPath, { replace: true });
              setResolution(prev => ({ ...prev, redirected: true, loading: false }));
              return;
            }
          }
        }
      }

      // Resolve document by slug
      let documentId: string | null = null;
      if (pageSlug && projectId) {
        // If we have a topic, look for doc in that topic
        // Otherwise look for doc directly under project (no topic)
        const docQuery = supabase
          .from("documents")
          .select("id, slug, project_id, topic_id")
          .eq("project_id", projectId)
          .eq("project_version_id", projectVersionId)
          .eq("slug", pageSlug);
        
        if (topicId) {
          docQuery.eq("topic_id", topicId);
        }

        const { data: docData } = await docQuery.maybeSingle();

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
            const docQuery = supabase
              .from("documents")
              .select("slug, project_id, topic_id")
              .eq("id", historyData.entity_id)
              .eq("project_id", projectId);
            
            docQuery.eq("project_version_id", projectVersionId);
            
            if (topicId) {
              docQuery.eq("topic_id", topicId);
            }

            const { data: currentDoc } = await docQuery.maybeSingle();

            if (currentDoc?.slug) {
              // Get topic slug if document has a topic
              let newTopicSlug = topicSlug;
              if (currentDoc.topic_id && !topicSlug) {
                const { data: topic } = await supabase
                  .from("topics")
                  .select("slug")
                  .eq("id", currentDoc.topic_id)
                  .single();
                newTopicSlug = topic?.slug || undefined;
              }
              
              const newPath = buildRedirectPath(orgSlug, projectSlug, versionSlug, newTopicSlug, currentDoc.slug);
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
        projectVersionId,
        topicId,
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
        projectVersionId: null,
        topicId: null,
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
  versionSlug?: string,
  topicSlug?: string,
  pageSlug?: string
): string {
  let path = "/docs";
  if (orgSlug) path += `/${orgSlug}`;
  if (projectSlug) path += `/${projectSlug}`;
  if (versionSlug) path += `/${versionSlug}`;
  if (topicSlug) path += `/${topicSlug}`;
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
        topic_id,
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

    // Get topic slug if document has a topic
    let topicSlug: string | null = null;
    if (doc.topic_id) {
      const { data: topic } = await supabase
        .from("topics")
        .select("slug")
        .eq("id", doc.topic_id)
        .single();
      topicSlug = topic?.slug || null;
    }

    if (topicSlug) {
      return `/docs/${orgSlug}/${projectSlug}/${topicSlug}/${pageSlug}`;
    }
    return `/docs/${orgSlug}/${projectSlug}/${pageSlug}`;
  } catch (error) {
    console.error("Error generating slug URL:", error);
    return null;
  }
}
