import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { strapiFetch } from "@/lib/api/client";

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
      const slugParams = new URLSearchParams({
        "filters[slug][$eq]": orgSlug!,
        "pagination[limit]": "1",
      });
      const { data: slugRes, error: slugError } = await strapiFetch<{ data: any[] }>(
        `/api/organizations?${slugParams.toString()}`
      );
      if (slugError) throw slugError;
      let org = slugRes?.data?.[0] ?? null;

      if (!org) {
        const domainParams = new URLSearchParams({
          "filters[domain][$eq]": orgSlug!,
          "pagination[limit]": "1",
        });
        const { data: domainRes, error: domainError } = await strapiFetch<{ data: any[] }>(
          `/api/organizations?${domainParams.toString()}`
        );
        if (domainError) throw domainError;
        org = domainRes?.data?.[0] ?? null;
      }

      if (org?.id) {
        orgId = String(org.id);
      } else {
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
        const { data, error } = await strapiFetch<{ data: any[] }>(
          `/api/projects?filters[organization][id][$eq]=${orgId}&filters[slug][$eq]=${encodeURIComponent(projectSlug)}&pagination[limit]=1`
        );
        if (error) throw error;
        const projectData = data?.data?.[0] ?? null;
        if (projectData?.id) {
          projectId = String(projectData.id);
        }
      }

      let projectVersionId: string | null = null;
      if (projectId) {
        if (versionSlug) {
          const { data, error } = await strapiFetch<{ data: any[] }>(
            `/api/project-versions?filters[project][id][$eq]=${projectId}&filters[slug][$eq]=${encodeURIComponent(versionSlug)}&pagination[limit]=1`
          );
          if (!error && data?.data?.[0]?.id) {
            projectVersionId = String(data.data[0].id);
          }
        }

        if (!projectVersionId) {
          const { data, error } = await strapiFetch<{ data: any[] }>(
            `/api/project-versions?filters[project][id][$eq]=${projectId}&filters[is_default][$eq]=true&pagination[limit]=1`
          );
          if (!error && data?.data?.[0]?.id) {
            projectVersionId = String(data.data[0].id);
          }
        }

        if (!projectVersionId) {
          const { data } = await strapiFetch<{ data: any[] }>(
            `/api/project-versions?filters[project][id][$eq]=${projectId}&filters[is_published][$eq]=true&pagination[limit]=1&sort=semver_major:desc,semver_minor:desc,semver_patch:desc`
          );
          if (data?.data?.[0]?.id) {
            projectVersionId = String(data.data[0].id);
          }
        }

        if (!projectVersionId) {
          const { data } = await strapiFetch<{ data: any[] }>(
            `/api/project-versions?filters[project][id][$eq]=${projectId}&pagination[limit]=1&sort=semver_major:desc,semver_minor:desc,semver_patch:desc`
          );
          if (data?.data?.[0]?.id) {
            projectVersionId = String(data.data[0].id);
          }
        }
      }

      // Resolve topic by slug within project (if topicSlug provided)
      let topicId: string | null = null;
      if (topicSlug && projectId) {
        const params = new URLSearchParams({
          "filters[project][id][$eq]": projectId,
          "filters[slug][$eq]": topicSlug,
          "pagination[limit]": "1",
        });
        if (projectVersionId) {
          params.set("filters[project_version][id][$eq]", projectVersionId);
        }
        const { data, error } = await strapiFetch<{ data: any[] }>(
          `/api/topics?${params.toString()}`
        );
        if (!error && data?.data?.[0]?.id) {
          topicId = String(data.data[0].id);
        }
      }

      // Resolve document by slug
      let documentId: string | null = null;
      if (pageSlug && projectId) {
        const params = new URLSearchParams({
          "filters[project][id][$eq]": projectId,
          "filters[slug][$eq]": pageSlug,
          "pagination[limit]": "1",
        });
        if (projectVersionId) {
          params.set("filters[project_version][id][$eq]", projectVersionId);
        }
        if (topicId) {
          params.set("filters[topic][id][$eq]", topicId);
        }
        const { data, error } = await strapiFetch<{ data: any[] }>(
          `/api/documents?${params.toString()}`
        );
        if (!error && data?.data?.[0]?.id) {
          documentId = String(data.data[0].id);
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
    const { data, error } = await strapiFetch<{ data: any }>(
      `/api/documents/${documentId}?fields[0]=slug&populate[topic][fields][0]=slug&populate[project][fields][0]=slug&populate[project][populate][organization][fields][0]=slug&populate[project][populate][organization][fields][1]=domain`
    );
    if (error || !data?.data) return null;
    const attrs = data.data.attributes || {};
    const project = attrs.project?.data;
    const org = project?.attributes?.organization?.data?.attributes;
    const orgSlug = org?.slug || org?.domain;
    const projectSlug = project?.attributes?.slug;
    const pageSlug = attrs.slug;
    if (!orgSlug || !projectSlug || !pageSlug) return null;
    const topicSlug = attrs.topic?.data?.attributes?.slug || null;
    return topicSlug
      ? `/docs/${orgSlug}/${projectSlug}/${topicSlug}/${pageSlug}`
      : `/docs/${orgSlug}/${projectSlug}/${pageSlug}`;
  } catch (error) {
    console.error("Error generating slug URL:", error);
    return null;
  }
}
