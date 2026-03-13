import { fetchOrThrow } from "./client";
import type { Org, OrgMember } from "./types";

export const orgApi = {
  get: (): Promise<Org> =>
    fetchOrThrow<Org>("/api/org"),

  update: (data: Partial<Pick<Org, "name" | "logo_url" | "primary_color" | "tagline" | "hierarchy_mode">>): Promise<Org> =>
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
