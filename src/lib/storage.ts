import { IMAGE_CONTENT_TYPE, type ImageKind } from "@/lib/image-validate";

// Uploads go to a public Supabase Storage bucket through its REST API using
// the server-only service key (never sent to the browser). Plain fetch, so no
// extra dependency. The bucket itself is created once, out of band — see
// docs or the PR that added this.

const BUCKET = "school-assets";

export class StorageNotConfigured extends Error {}

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new StorageNotConfigured("Image upload isn't set up yet. Paste an image link instead for now.");
  return { url, key };
}

/**
 * Stores the bytes at `path` (never overwriting — callers pass a unique
 * path, so an already-published result keeps the exact image it was
 * printed with) and returns the public URL.
 */
export async function putPublicImage(path: string, bytes: Uint8Array, kind: ImageKind): Promise<string> {
  const { url, key } = config();
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": IMAGE_CONTENT_TYPE[kind],
      "x-upsert": "false",
      "cache-control": "max-age=31536000",
    },
    body: Buffer.from(bytes),
  });
  if (!res.ok) throw new Error("The image couldn't be saved. Please try again in a moment.");
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}
