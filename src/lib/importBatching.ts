export interface ImportFile {
  path: string;
  content: string;
}

export interface ImportBatchingOptions {
  maxFiles?: number;
  maxBytes?: number;
}

export interface ImportBatchResult {
  batches: ImportFile[][];
  offsets: number[];
}

const DEFAULT_MAX_FILES = 50;
const DEFAULT_MAX_BYTES = 2_000_000;

const estimateFileBytes = (file: ImportFile) => file.content.length + file.path.length + 16;

export const splitImportBatches = (
  files: ImportFile[],
  options: ImportBatchingOptions = {}
): ImportBatchResult => {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const batches: ImportFile[][] = [];
  const offsets: number[] = [];

  let currentBatch: ImportFile[] = [];
  let currentBytes = 0;
  let currentStartIndex = 0;

  files.forEach((file, index) => {
    const estimatedBytes = estimateFileBytes(file);
    const wouldExceed =
      currentBatch.length > 0 &&
      (currentBatch.length >= maxFiles || currentBytes + estimatedBytes > maxBytes);

    if (wouldExceed) {
      batches.push(currentBatch);
      offsets.push(currentStartIndex);
      currentBatch = [];
      currentBytes = 0;
      currentStartIndex = index;
    }

    currentBatch.push(file);
    currentBytes += estimatedBytes;
  });

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
    offsets.push(currentStartIndex);
  }

  return { batches, offsets };
};
