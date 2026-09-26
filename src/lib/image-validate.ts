// Checks an uploaded image by what its bytes actually are, not by the file
// name or the type the browser claims — a renamed .exe or an HTML page named
// "logo.png" must never be stored and then served from our storage domain.
// Pure, so it is unit-tested without any storage involved.

export const MAX_IMAGE_BYTES = 1024 * 1024; // 1 MB

export type ImageKind = "png" | "jpg" | "webp";

export const IMAGE_CONTENT_TYPE: Record<ImageKind, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export class ImageError extends Error {}

function detectKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  // WebP is a RIFF container: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

/** The image's real type, or throws an ImageError with a message fit to show the admin. */
export function validateImage(bytes: Uint8Array): ImageKind {
  if (bytes.length === 0) throw new ImageError("That file is empty.");
  if (bytes.length > MAX_IMAGE_BYTES) {
    const mb = (bytes.length / (1024 * 1024)).toFixed(1);
    throw new ImageError(`That image is ${mb} MB — the limit is 1 MB. Shrink it (or save it as a JPG) and try again.`);
  }
  const kind = detectKind(bytes);
  if (!kind) throw new ImageError("Only PNG, JPG or WebP images can be uploaded.");
  return kind;
}
