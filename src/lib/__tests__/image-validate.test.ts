import { describe, expect, it } from "vitest";
import { ImageError, MAX_IMAGE_BYTES, validateImage } from "@/lib/image-validate";

const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const jpg = [0xff, 0xd8, 0xff, 0xe0];
const webp = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const bytes = (head: number[], length = 64) => Uint8Array.from({ length }, (_, i) => head[i] ?? 0);

describe("validateImage", () => {
  it("recognises PNG, JPG and WebP by their bytes", () => {
    expect(validateImage(bytes(png))).toBe("png");
    expect(validateImage(bytes(jpg))).toBe("jpg");
    expect(validateImage(bytes(webp))).toBe("webp");
  });
  it("refuses anything else, whatever it is called", () => {
    expect(() => validateImage(new TextEncoder().encode("<html><script>alert(1)</script></html>"))).toThrow(ImageError);
    expect(() => validateImage(bytes([0x4d, 0x5a]))).toThrow(/PNG, JPG or WebP/); // an .exe
    expect(() => validateImage(bytes([0x47, 0x49, 0x46, 0x38]))).toThrow(ImageError); // GIF isn't allowed
  });
  it("refuses an empty file and one over 1 MB, saying why", () => {
    expect(() => validateImage(new Uint8Array())).toThrow(/empty/);
    expect(() => validateImage(bytes(png, MAX_IMAGE_BYTES + 1))).toThrow(/limit is 1 MB/);
    expect(validateImage(bytes(png, MAX_IMAGE_BYTES))).toBe("png");
  });
});
