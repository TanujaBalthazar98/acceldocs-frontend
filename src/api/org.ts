import { fetchOrThrow } from "./client";
import type { Org, OrgMember } from "./types";

export const orgApi = {
  get: (orgId?: number): Promise<Org> =>
    fetchOrThrow<Org>(orgId ? `/api/org?org_id=${orgId}` : "/api/org"),

  listOrgs: (): Promise<{ ok: boolean; organizations: { id: number; name: string; slug: string; logo_url: string | null; domain: string | null; user_role: string }[] }> =>
    fetchOrThrow("/api/org/list"),

  update: (data: Partial<Pick<Org, "name" | "logo_url" | "primary_color" | "tagline" | "hierarchy_mode" | "custom_docs_domain">>): Promise<Org> =>
    fetchOrThrow<Org>("/api/org", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listMembers: (): Promise<{ members: OrgMember[] }> =>
    fetchOrThrow<{ members: OrgMember[] }>("/api/org/members"),

  updateMemberRole: (memberId: number, role: OrgMember["role"]): Promise<void> =>
    fetchOrThrow("/api/org/members/" + memberId + "/role", {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  removeMember: (memberId: number): Promise<void> =>
    fetchOrThrow("/api/org/members/" + memberId, { method: "DELETE" }),
};
