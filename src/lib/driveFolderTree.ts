export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  createdTime?: string;
}

export interface DriveFolderNode {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  depth: number;
  children: DriveFolderNode[];
}

export interface DriveTraversalResult {
  root: DriveFolderNode;
  folders: DriveFolderNode[];
}

export interface DriveTraversalOptions {
  rootFolderId: string;
  rootName?: string;
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 6;
const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

type ListFolderFn = (folderId: string) => Promise<{ files: DriveFileItem[] | null; needsDriveAccess?: boolean }>;

const buildNode = (id: string, name: string, parentId: string | null, path: string, depth: number): DriveFolderNode => ({
  id,
  name,
  parentId,
  path,
  depth,
  children: [],
});

export async function buildDriveFolderTree(
  listFolder: ListFolderFn,
  options: DriveTraversalOptions,
): Promise<DriveTraversalResult> {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const rootName = options.rootName ?? "Root";
  const root = buildNode(options.rootFolderId, rootName, null, rootName, 0);
  const folders: DriveFolderNode[] = [root];

  const queue: DriveFolderNode[] = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    if (current.depth >= maxDepth) {
      continue;
    }

    const { files, needsDriveAccess } = await listFolder(current.id);
    if (needsDriveAccess) {
      throw new Error("Drive access required");
    }

    const folderItems = (files || []).filter((item) => item.mimeType === DRIVE_FOLDER_MIME);
    for (const item of folderItems) {
      const childPath = `${current.path}/${item.name}`;
      const child = buildNode(item.id, item.name, current.id, childPath, current.depth + 1);
      current.children.push(child);
      folders.push(child);
      queue.push(child);
    }
  }

  return { root, folders };
}
