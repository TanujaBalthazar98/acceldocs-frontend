import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { usePermissions, useAuditLog } from "@/hooks/usePermissions";
import { useJoinRequestNotifications } from "@/hooks/useJoinRequestNotifications";
import { invokeFunction, invokeRpc } from "@/lib/api/functions";
import {
  mapProjectFromStrapi,
  mapVersionFromStrapi,
  mapTopicFromStrapi,
  mapDocumentFromStrapi,
} from "@/lib/dataMappers";
import type {
  Project,
  ProjectVersion,
  Topic,
  Document,
} from "@/types/dashboard";

export const useDashboardData = () => {
  const { user, signOut, googleAccessToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Core data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectVersions, setProjectVersions] = useState<ProjectVersion[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  // Selection state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ProjectVersion | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Organization state
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string>("");
  const [appRole, setAppRole] = useState<string | null>(null);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [orgMcpEnabled, setOrgMcpEnabled] = useState(false);
  const [orgHasApiSpec, setOrgHasApiSpec] = useState(false);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsDriveAccess, setNeedsDriveAccess] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // UI state
  const [visiblePagesCount, setVisiblePagesCount] = useState(10);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const [subProjectsExpanded, setSubProjectsExpanded] = useState(true);
  const [topicsExpanded, setTopicsExpanded] = useState(true);

  // Permissions and audit logging
  const { permissions, role, loading: permissionsLoading, isOrgOwner } = usePermissions(selectedProject?.id || null);
  const { logAction, logUnauthorizedAttempt } = useAuditLog();

  // Join request notifications
  const { approvedOrgId, approvedOrgName, switchToApprovedWorkspace } = useJoinRequestNotifications(user?.id);

  // Derived state
  const projectStepDone = projects.length > 0;
  const canProjectCreateRole = appRole === "owner" || appRole === "admin" || appRole === "editor";
  const canCreateProject = canProjectCreateRole;

  // Version helpers
  const getHighestSemverVersion = (versions: ProjectVersion[]) =>
    versions
      .slice()
      .sort((a, b) => {
        if (a.semver_major !== b.semver_major) return b.semver_major - a.semver_major;
        if (a.semver_minor !== b.semver_minor) return b.semver_minor - a.semver_minor;
        return b.semver_patch - a.semver_patch;
      })[0] ?? null;

  const resolveDefaultVersion = (projectId: string) => {
    const versions = projectVersions.filter((v) => v.project_id === projectId);
    if (versions.length === 0) return null;
    const defaultVersion = versions.find((v) => v.is_default);
    if (defaultVersion) return defaultVersion;
    const publishedVersions = versions.filter((v) => v.is_published);
    return getHighestSemverVersion(publishedVersions) ?? getHighestSemverVersion(versions);
  };

  // Permission check for publish
  const canPublishForProject = async (projectId: string): Promise<boolean> => {
    if (!user) return false;
    if (selectedProject?.id === projectId && permissions.canPublish) return true;
    const { data: canEdit, error } = await invokeRpc("can_edit_project" as any, {
      _project_id: projectId as any,
      _user_id: user.id as any,
    });
    if (error) {
      console.error("Error checking publish permission:", error);
      return false;
    }
    return (canEdit as any) === true;
  };

  const getDescendantProjectIds = (projectId: string) => {
    const ids = new Set<string>([projectId]);
    const queue = [projectId];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const project of projects) {
        if (project.parent_id === current && !ids.has(project.id)) {
          ids.add(project.id);
          queue.push(project.id);
        }
      }
    }
    return ids;
  };

  const selectedProjectIds = selectedProject ? getDescendantProjectIds(selectedProject.id) : null;
  const unassignedDocuments = documents.filter((doc) => !doc.project_id);

  const versionIdentity = (version: {
    id?: string;
    slug?: string;
    name?: string;
    semver_major?: number;
    semver_minor?: number;
    semver_patch?: number;
  } | null | undefined): string => {
    if (!version) return "";
    const major = Number(version.semver_major ?? 0);
    const minor = Number(version.semver_minor ?? 0);
    const patch = Number(version.semver_patch ?? 0);
    if (major || minor || patch) return `semver:${major}.${minor}.${patch}`;
    if (version.slug) return `slug:${version.slug.toLowerCase()}`;
    if (version.name) return `name:${version.name.toLowerCase()}`;
    return version.id ? `id:${version.id}` : "";
  };

  const versionIdentityById = useMemo(() => {
    const map = new Map<string, string>();
    for (const version of projectVersions) {
      map.set(version.id, versionIdentity(version));
    }
    return map;
  }, [projectVersions]);

  const selectedVersionIdentity = selectedVersion ? versionIdentity(selectedVersion) : null;

  const matchesSelectedVersion = (entityVersionId?: string | null): boolean => {
    if (!selectedVersion) return true;
    if (!entityVersionId) return true;
    if (entityVersionId === selectedVersion.id) return true;
    if (!selectedVersionIdentity) return false;
    const entityIdentity = versionIdentityById.get(entityVersionId);
    return !!entityIdentity && entityIdentity === selectedVersionIdentity;
  };

  // Scoped data — include records for the selected version identity (semver/slug), not only exact ID.
  const scopedDocuments = selectedVersion
    ? documents.filter((doc) => matchesSelectedVersion(doc.project_version_id))
    : documents;

  const scopedTopics = selectedVersion
    ? topics.filter((topic) => matchesSelectedVersion(topic.project_version_id))
    : topics;

  // Build a set of project slugs/names for the selected project tree (for legacy matching)
  const selectedProjectSlugs = useMemo(() => {
    if (!selectedProjectIds) return null;
    const slugs = new Set<string>();
    for (const project of projects) {
      if (selectedProjectIds.has(project.id)) {
        if (project.slug) slugs.add(project.slug.toLowerCase());
        if (project.name) {
          slugs.add(project.name.toLowerCase());
          slugs.add(project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
        }
      }
    }
    return slugs;
  }, [selectedProjectIds, projects]);

  // Filtered data
  const filteredDocuments = scopedDocuments.filter((doc) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      if (!doc.title.toLowerCase().includes(query)) return false;
    }
    if (selectedTopic) return doc.topic_id === selectedTopic.id;
    if (selectedProject) {
      // Primary: match by FK project_id
      if (doc.project_id && selectedProjectIds?.has(doc.project_id)) return true;
      // Fallback: match by legacy string project field (slug/name)
      const legacyProject = (doc as any).project;
      if (legacyProject && selectedProjectSlugs?.has(String(legacyProject).toLowerCase())) return true;
      return false;
    }
    return true;
  });

  const visibleDocuments = filteredDocuments.slice(0, visiblePagesCount);
  const hasMorePages = visiblePagesCount < filteredDocuments.length;

  const filteredProjects = projects.filter(
    (p) => !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTopics = scopedTopics.filter(
    (t) => !searchQuery.trim() || t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedProjectVersions = selectedProject
    ? projectVersions
        .filter((v) => v.project_id === selectedProject.id)
        .slice()
        .sort((a, b) => {
          if (a.semver_major !== b.semver_major) return b.semver_major - a.semver_major;
          if (a.semver_minor !== b.semver_minor) return b.semver_minor - a.semver_minor;
          return b.semver_patch - a.semver_patch;
        })
    : [];

  // Project tree helpers
  const rootProjects = filteredProjects.filter((p) => !p.parent_id);
  const getSubProjects = (parentId: string) => filteredProjects.filter((p) => p.parent_id === parentId);

  const selectedParentProject = selectedProject?.parent_id
    ? filteredProjects.find((p) => p.id === selectedProject.parent_id) || null
    : null;

  const subProjectsGroupProject = selectedParentProject ?? selectedProject ?? null;
  const visibleSubProjects = subProjectsGroupProject ? getSubProjects(subProjectsGroupProject.id) : [];

  // Assign project helpers
  const buildProjectOptions = () => {
    const byParent = new Map<string | null, Project[]>();
    for (const project of projects) {
      const key = project.parent_id ?? null;
      const list = byParent.get(key) ?? [];
      list.push(project);
      byParent.set(key, list);
    }
    const options: Array<{ id: string; label: string }> = [];
    const walk = (parentId: string | null, depth: number) => {
      const children = byParent.get(parentId) ?? [];
      children.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      for (const child of children) {
        const prefix = depth > 0 ? new Array(depth + 1).join("-- ") : "";
        options.push({ id: child.id, label: `${prefix}${child.name}` });
        walk(child.id, depth + 1);
      }
    };
    walk(null, 0);
    return options;
  };

  const getAssignableTopics = (projectId: string | null, projectVersionId: string | null) => {
    if (!projectId) return [];
    return topics.filter((topic) => {
      if (topic.project_id !== projectId) return false;
      if (!projectVersionId) return true;
      return topic.project_version_id === projectVersionId;
    });
  };

  // Ensure default version for project
  const ensureDefaultVersionForProject = async (projectId: string, isPublished: boolean) => {
    const { data: versionRes, error: versionError } = await invokeFunction<{
      ok?: boolean;
      versions?: any[];
      error?: string;
    }>("list-project-versions", { body: { projectIds: [projectId] } });

    if (versionError || !versionRes?.ok) {
      console.error("Error checking default version:", versionError || versionRes?.error);
    } else {
      const existingDefault = (versionRes.versions || []).find((v: any) => v.is_default);
      if (existingDefault?.id) return String(existingDefault.id);
    }

    const { data: created, error: createError } = await invokeFunction<{
      ok?: boolean;
      versionId?: string;
      error?: string;
    }>("create-project-version", {
      body: {
        projectId,
        name: "v1.0",
        slug: "v1.0",
        isDefault: true,
        isPublished,
        semverMajor: 1,
        semverMinor: 0,
        semverPatch: 0,
      },
    });

    if (createError || !created?.ok) {
      console.error("Error creating default version:", createError || created?.error);
      return null;
    }

    return created?.versionId ?? null;
  };

  // Main data fetch
  const fetchData = async () => {
    if (!user) {
      setIsLoading(false);
      setAppRole(null);
      return;
    }

    const blockUI = !hasLoadedOnce;
    if (blockUI) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const { data: workspace, error: workspaceError } = await invokeFunction<{
        ok?: boolean;
        organization?: { id: number; name: string; slug?: string; domain?: string };
        members?: any[];
        error?: string;
      }>("ensure-workspace", {
        body: {},
      });

      if (workspaceError || !workspace?.ok || !workspace?.organization?.id) {
        throw workspaceError || new Error(workspace?.error || "Failed to ensure workspace");
      }

      const orgId = String(workspace.organization.id);
      setOrganizationId(orgId);

      const { data: orgResponse, error: orgError } = await invokeFunction<{
        ok?: boolean;
        id?: number;
        name?: string;
        slug?: string;
        domain?: string;
        drive_folder_id?: string;
        mcp_enabled?: boolean;
        openapi_spec_json?: string;
        openapi_spec_url?: string;
        members?: any[];
        error?: string;
      }>("get-organization");
      if (orgError || !orgResponse?.ok) {
        throw orgError || new Error(orgResponse?.error || "Failed to load organization");
      }
      const org = orgResponse || null;

      if (org?.drive_folder_id) {
        setRootFolderId(org.drive_folder_id);
      }
      setNeedsDriveAccess(!org?.drive_folder_id);
      // Always set a slug — fall back to org name or ID so View Docs buttons appear
      const slug = org?.slug || org?.domain || org?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || String(orgId);
      setOrganizationSlug(slug);
      setOrgMcpEnabled(org?.mcp_enabled ?? false);
      setOrgHasApiSpec(!!(org?.openapi_spec_json || org?.openapi_spec_url));
      setOrganizationName(org?.name || "");

      const memberRole =
        orgResponse?.members?.find((member: any) => String(member?.id) === String(user.id))?.role || "viewer";
      setAppRole(memberRole);

      // Show onboarding if owner has no Drive folder configured yet
      if (!org?.drive_folder_id && memberRole === "owner") {
        setNeedsOnboarding(true);
      } else {
        setNeedsOnboarding(false);
      }

      const { data: projectRes, error: projectError } = await invokeFunction<{
        ok?: boolean;
        projects?: any[];
        error?: string;
      }>("list-projects", {
        body: { organizationId: orgId },
      });

      if (projectError || !projectRes?.ok) {
        throw projectError || new Error(projectRes?.error || "Failed to load projects");
      }

      let projectRows = projectRes.projects || [];

      // Auto-bootstrap missing root projects from Drive root folder (owner/admin only).
      if (rootFolderId && googleAccessToken && (memberRole === "owner" || memberRole === "admin")) {
        try {
          const { data: driveList } = await invokeFunction<{
            ok?: boolean;
            files?: Array<{ id?: string; name?: string; isFolder?: boolean; mimeType?: string }>;
          }>("google-drive", {
            body: { action: "list_folder", folderId: rootFolderId },
            headers: { "x-google-token": googleAccessToken },
          });

          const rootFolders = (driveList?.files || []).filter(
            (file) =>
              !!file?.id &&
              !!file?.name &&
              (file?.isFolder ||
                file?.mimeType === "application/vnd.google-apps.folder"),
          );

          const existingByDriveFolder = new Set(
            projectRows.map((project: any) => String(project?.drive_folder_id || "")).filter(Boolean),
          );

          const missingFolders = rootFolders.filter(
            (folder) => !existingByDriveFolder.has(String(folder.id)),
          );

          if (missingFolders.length > 0) {
            const slugifyName = (value: string) =>
              value
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-");

            for (const folder of missingFolders) {
              await invokeFunction("create-project", {
                body: {
                  name: folder.name,
                  slug: slugifyName(folder.name || "project"),
                  drive_folder_id: folder.id,
                  drive_parent_id: rootFolderId,
                  visibility: "internal",
                },
              });
            }

            const { data: refreshedProjects } = await invokeFunction<{
              ok?: boolean;
              projects?: any[];
            }>("list-projects", {
              body: { organizationId: orgId },
            });

            if (refreshedProjects?.ok) {
              projectRows = refreshedProjects.projects || projectRows;
            }
          }
        } catch (bootstrapError) {
          console.error("Failed to auto-bootstrap projects from Drive root:", bootstrapError);
        }
      }

      const mappedProjects = projectRows
        .map((row) => mapProjectFromStrapi(row, orgId))
        .filter((p) => p.name.trim().length > 0);

      const normalizeName = (value: string) => value.trim().toLowerCase();
      const rawToCanonicalProjectId = new Map<string, string>();
      const groupedByDrive = new Map<string, Project[]>();
      const groupedByNameParent = new Map<string, Project[]>();

      for (const project of mappedProjects) {
        if (project.drive_folder_id) {
          const grouped = groupedByDrive.get(project.drive_folder_id) ?? [];
          grouped.push(project);
          groupedByDrive.set(project.drive_folder_id, grouped);
          continue;
        }
        const key = `${project.parent_id || "root"}::${normalizeName(project.name)}`;
        const grouped = groupedByNameParent.get(key) ?? [];
        grouped.push(project);
        groupedByNameParent.set(key, grouped);
      }

      const dedupedProjects: Project[] = [];
      for (const grouped of groupedByDrive.values()) {
        const canonical = grouped.find((project) => !!project.parent_id) ?? grouped[0];
        dedupedProjects.push(canonical);
        for (const project of grouped) {
          rawToCanonicalProjectId.set(project.id, canonical.id);
        }
      }
      for (const grouped of groupedByNameParent.values()) {
        const canonical = grouped[0];
        dedupedProjects.push(canonical);
        for (const project of grouped) {
          rawToCanonicalProjectId.set(project.id, canonical.id);
        }
      }

      const uniqueProjectIdsForFetch = Array.from(new Set(mappedProjects.map((project) => project.id)));
      const uniqueDedupedProjects = dedupedProjects.filter(
        (project, idx, arr) => arr.findIndex((other) => other.id === project.id) === idx
      );

      setProjects(uniqueDedupedProjects);

      const projectIds = uniqueProjectIdsForFetch;
      console.debug("[fetchData] projects loaded", {
        count: uniqueDedupedProjects.length,
        projectIds,
      });
      if (projectIds.length === 0) {
        setProjectVersions([]);
        setTopics([]);
        setDocuments([]);
        return;
      }

      const { data: versionRes, error: versionError } = await invokeFunction<{
        ok?: boolean;
        versions?: any[];
        error?: string;
      }>("list-project-versions", { body: { projectIds } });
      if (versionError || !versionRes?.ok) {
        throw versionError || new Error(versionRes?.error || "Failed to load versions");
      }
      const mappedVersions = (versionRes.versions || []).map(mapVersionFromStrapi).map((version) => ({
        ...version,
        project_id: rawToCanonicalProjectId.get(version.project_id) ?? version.project_id,
      }));
      setProjectVersions(mappedVersions);

      const { data: topicRes, error: topicError } = await invokeFunction<{
        ok?: boolean;
        topics?: any[];
        error?: string;
      }>("list-topics", { body: { projectIds } });
      if (topicError || !topicRes?.ok) {
        throw topicError || new Error(topicRes?.error || "Failed to load topics");
      }
      const mappedTopics = (topicRes.topics || []).map(mapTopicFromStrapi).map((topic) => ({
        ...topic,
        project_id: rawToCanonicalProjectId.get(topic.project_id) ?? topic.project_id,
      }));
      setTopics(mappedTopics);

      const { data: docRes, error: docError } = await invokeFunction<{
        ok?: boolean;
        documents?: any[];
        error?: string;
      }>("list-documents", { body: { projectIds } });
      console.debug("[fetchData] list-documents", { projectIds, ok: docRes?.ok, count: docRes?.documents?.length, error: docRes?.error || docError });
      if (docError || !docRes?.ok) {
        throw docError || new Error(docRes?.error || "Failed to load documents");
      }
      const normalizeProjectName = (value?: string | null) => (value || "").trim().toLowerCase();
      const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      // Build lookup maps: name → id, slug → id, slugified-name → id
      const projectIdByKey = new Map<string, string>();
      for (const project of uniqueDedupedProjects) {
        projectIdByKey.set(normalizeProjectName(project.name), project.id);
        if (project.slug) projectIdByKey.set(project.slug.toLowerCase(), project.id);
        projectIdByKey.set(slugify(project.name), project.id);
      }
      const mappedDocs = (docRes.documents || []).map((row: any) => {
        const mapped = mapDocumentFromStrapi(row);
        if (mapped.project_id) {
          mapped.project_id = rawToCanonicalProjectId.get(mapped.project_id) ?? mapped.project_id;
        }
        if (!mapped.project_id) {
          const attrs = row?.attributes || row || {};
          const inferredProjectName = attrs.project_name || attrs.project || "";
          const normalized = normalizeProjectName(inferredProjectName);
          const inferredProjectId = projectIdByKey.get(normalized) || projectIdByKey.get(slugify(inferredProjectName));
          if (inferredProjectId) {
            mapped.project_id = inferredProjectId;
          }
        }
        return mapped;
      });
      // Debug: log docs with and without project_id
      const withPid = mappedDocs.filter((d: Document) => !!d.project_id);
      const withoutPid = mappedDocs.filter((d: Document) => !d.project_id);
      if (withoutPid.length > 0) {
        console.warn("[fetchData] docs without project_id:", withoutPid.map((d: Document) => ({ id: d.id, title: d.title, project_id: d.project_id })));
      }
      console.debug("[fetchData] docs mapped", { total: mappedDocs.length, withProjectId: withPid.length, withoutProjectId: withoutPid.length });
      const docByKey = new Map<string, Document>();
      for (const doc of mappedDocs) {
        const key = doc.google_doc_id ? `gdoc:${doc.google_doc_id}` : `id:${doc.id}`;
        const existing = docByKey.get(key);
        if (!existing) {
          docByKey.set(key, doc);
          continue;
        }
        if (!existing.is_published && doc.is_published) {
          docByKey.set(key, doc);
          continue;
        }
        const existingUpdated = Date.parse(existing.updated_at || "") || 0;
        const currentUpdated = Date.parse(doc.updated_at || "") || 0;
        if (currentUpdated > existingUpdated) {
          docByKey.set(key, doc);
        }
      }
      setDocuments(Array.from(docByKey.values()));

      return;
    } finally {
      if (!hasLoadedOnce) {
        setIsLoading(false);
      }
      setIsRefreshing(false);
      setHasLoadedOnce(true);
    }
  };

  // Effects
  useEffect(() => {
    fetchData();
  }, [user?.id]);

  useEffect(() => {
    setNeedsDriveAccess(!rootFolderId);
  }, [rootFolderId]);

  useEffect(() => {
    if (!selectedProject) {
      setSelectedVersion(null);
      return;
    }
    const resolved = resolveDefaultVersion(selectedProject.id);
    if (!resolved) {
      setSelectedVersion(null);
      return;
    }
    if (resolved.id !== selectedVersion?.id) {
      setSelectedVersion(resolved);
    }
  }, [selectedProject, projectVersions]);

  useEffect(() => {
    if (!selectedVersion) return;
    if (selectedTopic && selectedTopic.project_version_id !== selectedVersion.id) {
      setSelectedTopic(null);
    }
    if (selectedDocument && selectedDocument.project_version_id !== selectedVersion.id) {
      setSelectedDocument(null);
    }
  }, [selectedVersion, selectedTopic, selectedDocument]);

  useEffect(() => {
    if (selectedDocument && documents.length > 0) {
      const updatedDoc = documents.find((d) => d.id === selectedDocument.id);
      if (
        updatedDoc &&
        (updatedDoc.content_html !== selectedDocument.content_html ||
          updatedDoc.published_content_html !== selectedDocument.published_content_html ||
          updatedDoc.title !== selectedDocument.title ||
          updatedDoc.is_published !== selectedDocument.is_published)
      ) {
        setSelectedDocument(updatedDoc);
      }
    }
  }, [documents]);

  useEffect(() => {
    setVisiblePagesCount(10);
  }, [selectedProject, selectedTopic, searchQuery]);

  return {
    // Auth
    user,
    signOut,
    googleAccessToken,

    // Navigation
    navigate,
    location,
    toast,

    // Core data
    projects,
    setProjects,
    projectVersions,
    setProjectVersions,
    topics,
    setTopics,
    documents,
    setDocuments,

    // Selection
    selectedProject,
    setSelectedProject,
    selectedVersion,
    setSelectedVersion,
    selectedTopic,
    setSelectedTopic,
    selectedDocument,
    setSelectedDocument,
    selectedPage,
    setSelectedPage,
    expandedProjects,
    setExpandedProjects,

    // Organization
    organizationId,
    organizationSlug,
    organizationName,
    appRole,
    rootFolderId,
    setRootFolderId,
    orgMcpEnabled,
    orgHasApiSpec,

    // Loading
    isLoading,
    isRefreshing,
    needsOnboarding,
    setNeedsOnboarding,
    needsDriveAccess,
    setNeedsDriveAccess,

    // Search
    searchQuery,
    setSearchQuery,

    // UI state
    visiblePagesCount,
    setVisiblePagesCount,
    deepLinkHandled,
    setDeepLinkHandled,
    subProjectsExpanded,
    setSubProjectsExpanded,
    topicsExpanded,
    setTopicsExpanded,

    // Permissions
    permissions,
    permissionsLoading,
    isOrgOwner,
    logAction,
    logUnauthorizedAttempt,

    // Join requests
    approvedOrgId,
    approvedOrgName,
    switchToApprovedWorkspace,

    // Derived
    projectStepDone,
    canCreateProject,
    canProjectCreateRole,
    scopedDocuments,
    scopedTopics,
    selectedProjectIds,
    unassignedDocuments,
    filteredDocuments,
    visibleDocuments,
    hasMorePages,
    filteredProjects,
    filteredTopics,
    selectedProjectVersions,
    rootProjects,
    getSubProjects,
    selectedParentProject,
    subProjectsGroupProject,
    visibleSubProjects,

    // Helpers
    resolveDefaultVersion,
    canPublishForProject,
    buildProjectOptions,
    getAssignableTopics,
    ensureDefaultVersionForProject,
    fetchData,
  };
};
