import { createAdminClient } from "@/lib/supabase/server";
import { json, clientIp, rateLimitOr429, requireAdult } from "@/lib/api/respond";

export const runtime = "edge";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB — matches the post-images bucket limit
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * POST /[lang]/api/upload — multipart form-data with a `file` field.
 * Validates image/* and ≤5MB, stores in the `post-images` bucket at
 * <user_id>/<uuid>.<ext>, and returns { storage_path }.
 *
 * Uses the service-role client so uploads are gated by OUR explicit
 * adult-only check here (the storage RLS policies don't know about
 * age_class). Adult accounts only — children get an explicit 403.
 */
export async function POST(request: Request) {
  const limited = rateLimitOr429(`upload:${await clientIp()}`, 20, 60_000);
  if (limited) return limited;

  const auth = await requireAdult();
  if ("response" in auth) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "invalid_form" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "file_required" }, 400);
  if (!ALLOWED_MIME.includes(file.type)) return json({ error: "not_an_image" }, 400);
  if (file.size > MAX_BYTES) return json({ error: "file_too_large", max_bytes: MAX_BYTES }, 400);
  if (file.size === 0) return json({ error: "file_empty" }, 400);

  const ext = MIME_EXT[file.type] ?? "jpg";
  const storagePath = `${auth.ctx.user.id}/${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage
    .from("post-images")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (error) return json({ error: "upload_failed" }, 500);
  return json({ storage_path: storagePath }, 201);
}
