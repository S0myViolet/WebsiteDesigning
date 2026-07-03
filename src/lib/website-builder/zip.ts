// Packs a generated project (Record<filePath, fileContent>) into a zip
// archive for download. Paths are normalized so nested folders are created
// correctly and path traversal segments are stripped.

import JSZip from "jszip";

/** Normalize a file path for safe use inside the archive. */
function normalizeZipPath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    .join("/");
}

/** Values with this prefix are written as base64-decoded binary files. */
export const ZIP_BASE64_PREFIX = "__base64__:";

export async function buildZipArchive(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    const normalized = normalizeZipPath(path);
    if (!normalized) continue;
    // createFolders ensures intermediate directories exist as folder entries.
    if (content.startsWith(ZIP_BASE64_PREFIX)) {
      zip.file(normalized, content.slice(ZIP_BASE64_PREFIX.length), {
        base64: true,
        createFolders: true,
      });
    } else {
      zip.file(normalized, content, { createFolders: true });
    }
  }
  return zip.generateAsync({ type: "uint8array" });
}
