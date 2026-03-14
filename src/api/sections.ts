import { fetchOrThrow } from "./client";
import type { Section } from "./types";

export const sectionsApi = {
  list: (): Promise<{ sections: Section[] }> =>
    fetchOrThrow<{ sections: Section[] }>("/api/sections"),

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

  delete: (id: number): Promise<void> =>
    fetchOrThrow("/api/sections/" + id, { method: "DELETE" }),
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
        roots.push(node);
      }
    }
  });

  return roots.sort((a, b) => a.display_order - b.display_order);
}
