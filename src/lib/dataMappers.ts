import type { Project, ProjectVersion, Topic, Document } from "@/types/dashboard";

export const unwrapStrapiEntity = <T extends Record<string, any>>(
  entity: T | null | undefined,
): T | null => {
  if (!entity) return null;
  if ((entity as any).attributes) {
    return { id: (entity as any).id, ...(entity as any).attributes } as T;
  }
  return entity;
};

export const mapProjectFromStrapi = (item: any, orgId: string): Project => {
  const attrs = item?.attributes || item || {};
  const parentRaw =
    attrs.parent?.data?.id ??
    attrs.parent?.id ??
    attrs.parent_id ??
    attrs.parent ??
    null;
  const normalizedParent =
    parentRaw && parentRaw !== "null" && parentRaw !== "undefined" ? String(parentRaw) : null;
  return {
    id: String(item?.id ?? attrs.id),
    name: attrs.name || "",
    slug: attrs.slug ?? null,
    drive_folder_id: attrs.drive_folder_id ?? null,
    drive_parent_id: attrs.drive_parent_id ?? null,
    visibility: attrs.visibility ?? "internal",
    is_published: !!attrs.is_published,
    parent_id: normalizedParent,
    organization_id: orgId,
    show_version_switcher: attrs.show_version_switcher ?? true,
    require_approval: attrs.require_approval ?? true,
  };
};

export const mapVersionFromStrapi = (item: any): ProjectVersion => {
  const attrs = item?.attributes || item || {};
  const projectIdRaw =
    attrs.project?.data?.id ??
    attrs.project?.id ??
    attrs.project_id ??
    null;
  return {
    id: String(item?.id ?? attrs.id),
    project_id: projectIdRaw ? String(projectIdRaw) : "",
    name: attrs.name || "",
    slug: attrs.slug || "",
    is_default: !!attrs.is_default,
    is_published: !!attrs.is_published,
    semver_major: Number(attrs.semver_major ?? 0),
    semver_minor: Number(attrs.semver_minor ?? 0),
    semver_patch: Number(attrs.semver_patch ?? 0),
  };
};

export const mapTopicFromStrapi = (item: any): Topic => {
  const attrs = item?.attributes || item || {};
  const projectIdRaw =
    attrs.project?.data?.id ??
    attrs.project?.id ??
    attrs.project_id ??
    null;
  const projectVersionIdRaw =
    attrs.project_version?.data?.id ??
    attrs.project_version?.id ??
    attrs.project_version_id ??
    null;
  const parentIdRaw =
    attrs.parent?.data?.id ??
    attrs.parent?.id ??
    attrs.parent_id ??
    null;
  return {
    id: String(item?.id ?? attrs.id),
    name: attrs.name || "",
    drive_folder_id: attrs.drive_folder_id ?? "",
    project_id: projectIdRaw ? String(projectIdRaw) : "",
    project_version_id: projectVersionIdRaw ? String(projectVersionIdRaw) : null,
    parent_id: parentIdRaw ? String(parentIdRaw) : null,
    display_order: attrs.display_order ?? null,
  };
};

export const mapDocumentFromStrapi = (item: any): Document => {
  const attrs = item?.attributes || item || {};
  const owner = attrs.owner?.data?.attributes || attrs.owner || {};
  const projectIdRaw =
    attrs.project?.data?.id ??
    attrs.project?.id ??
    attrs.project_id ??
    null;
  const projectVersionIdRaw =
    attrs.project_version?.data?.id ??
    attrs.project_version?.id ??
    attrs.project_version_id ??
    null;
  const topicIdRaw =
    attrs.topic?.data?.id ??
    attrs.topic?.id ??
    attrs.topic_id ??
    null;
  const ownerIdRaw =
    attrs.owner?.data?.id ??
    attrs.owner?.id ??
    attrs.owner_id ??
    null;
  return {
    id: String(item?.id ?? attrs.id),
    title: attrs.title || "",
    google_doc_id: attrs.google_doc_id || "",
    project_id: projectIdRaw ? String(projectIdRaw) : null,
    project_version_id: projectVersionIdRaw ? String(projectVersionIdRaw) : null,
    topic_id: topicIdRaw ? String(topicIdRaw) : null,
    display_order: attrs.display_order ?? null,
    google_modified_at: attrs.google_modified_at ?? null,
    created_at: attrs.createdAt || attrs.created_at || "",
    updated_at: attrs.updatedAt || attrs.updated_at || "",
    visibility: attrs.visibility ?? "internal",
    is_published: !!attrs.is_published,
    owner_id: ownerIdRaw ? String(ownerIdRaw) : null,
    owner_name: owner.full_name || owner.email || owner.username || undefined,
    content_html: attrs.content_html ?? null,
    published_content_html: attrs.published_content_html ?? null,
    content_id: attrs.content_id ?? null,
    published_content_id: attrs.published_content_id ?? null,
    video_url: attrs.video_url ?? null,
    video_title: attrs.video_title ?? null,
    // Legacy string project field — used as fallback for matching when project_id is null
    project: typeof attrs.project === "string" ? attrs.project : null,
  } as any;
};
