import { z } from "zod";
import { fetchOrThrow } from "./client";
import type { Section } from "./types";

export const SectionSchema = z.object({
  id: z.number(),
  organization_id: z.number(),
  parent_id: z.number().nullable(),
  name: z.string(),
  slug: z.string(),
  section_type: z.enum(["section", "tab", "version"]).default("section"),
  visibility: z.enum(["public", "internal", "external"]).optional(),
  drive_folder_id: z.string().nullable(),
  display_order: z.number().default(0),
  is_published: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
});

const SectionListResponseSchema = z.object({ sections: z.array(SectionSchema) });

export const sectionsApi = {
  list: async (): Promise<{ sections: Section[] }> => {
    const raw = await fetchOrThrow<{ sections: Section[] }>("/api/sections");
    const result = SectionListResponseSchema.safeParse(raw);
    if (!result.success) {
      console.warn("[sectionsApi.list] schema validation issues:", result.error.issues);
    }
    return raw;
  },

  create: (data: {
    name: string;
    parent_id?: number | null;
    section_type?: "section" | "tab" | "version";
    visibility?: "public" | "internal" | "external";
    drive_folder_id?: string | null;
    display_order?: number;
    clone_from_section_id?: number | null;
  }): Promise<Section> =>
    fetchOrThrow<Section>("/api/sections", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<Pick<Section, "name" | "parent_id" | "section_type" | "visibility" | "drive_folder_id" | "display_order" | "is_published">>): Promise<Section> =>
    fetchOrThrow<Section>("/api/sections/" + id, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<{ ok: boolean; pages_deleted: number; sections_deleted: number; drive_trashed: number; drive_errors: string[] | null }> =>
    fetchOrThrow<{ ok: boolean; pages_deleted: number; sections_deleted: number; drive_trashed: number; drive_errors: string[] | null }>("/api/sections/" + id, { method: "DELETE" }),
};

/** Build a nested tree from a flat section list. */
export function buildSectionTree(sections: Section[]): Section[] {
  const map = new Map<number, Section>();
  sections.forEach((s) =>
    map.set(s.id, { ...s, section_type: s.section_type ?? "section", children: [], pages: [] }),
  );

  const roots: Section[] = [];
  sections.forEach((s) => {
    const node = map.get(s.id)!;
    if (s.parent_id === null) {
      roots.push(node);
    } else {
      const parent = map.get(s.parent_id);
      if (parent) {
        parent.children = parent.children ?? [];
        parent.children.push(node);
      } else {
        console.warn(
          `[buildSectionTree] orphaned section id=${s.id} has parent_id=${s.parent_id} which is not in the section list — placing at root`,
        );
        roots.push(node);
      }
    }
  });

  return roots.sort((a, b) => a.display_order - b.display_order);
}
