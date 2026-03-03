export type DocumentStatus = "draft" | "review" | "approved" | "rejected";
export type Visibility = "public" | "internal";

export interface DriveNode {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  modifiedTime?: string;
}

export interface IngestedDocumentMeta {
  driveFileId: string;
  googleDocId: string;
  title: string;
  slug: string;
  visibility: Visibility;
  drivePath: string;
  project: string;
  version: string;
  sectionPath: string[];
  modifiedAt?: string;
}
