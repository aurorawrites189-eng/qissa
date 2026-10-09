/**
 * Public URL for an object in a public storage bucket.
 * Both `avatars` and `post-images` buckets are public-read (see
 * supabase/storage.sql), so no signed URLs are needed.
 */
export function publicStorageUrl(bucket: "avatars" | "post-images", path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
