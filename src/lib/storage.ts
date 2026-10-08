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

type StorageObject = { name: string; id: string | null };

async function listFolder(url: string, key: string, prefix: string): Promise<StorageObject[]> {
  const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  if (!res.ok) throw new Error("Could not list stored files.");
  return (await res.json()) as StorageObject[];
}

/**
 * Deletes every stored file under one school's folder (logo, signature, stamp,
 * student photos), including sub-folders. Returns how many were removed, or
 * null when storage isn't set up at all (nothing was ever uploaded).
 */
export async function deleteSchoolFiles(schoolId: string): Promise<number | null> {
  let url: string;
  let key: string;
  try {
    ({ url, key } = config());
  } catch (err) {
    if (err instanceof StorageNotConfigured) return null;
    throw err;
  }

  const paths: string[] = [];
  const queue = [schoolId];
  while (queue.length > 0 && paths.length < 20_000) {
    const folder = queue.shift()!;
    for (const item of await listFolder(url, key, folder)) {
      // A folder has no id; a file has one.
      if (item.id === null) queue.push(`${folder}/${item.name}`);
      else paths.push(`${folder}/${item.name}`);
    }
  }

  for (let i = 0; i < paths.length; i += 100) {
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: paths.slice(i, i + 100) }),
    });
    if (!res.ok) throw new Error("Could not delete stored files.");
  }
  return paths.length;
}
