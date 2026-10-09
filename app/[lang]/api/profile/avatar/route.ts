import { createAdminClient, createClient } from "@/lib/supabase/server";
import { json, clientIp, rateLimitOr429, requireUser } from "@/lib/api/respond";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB — matches the avatars bucket limit
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * POST /[lang]/api/profile/avatar — multipart form-data with a `file` field.
 * Stores in the `avatars` bucket at <user_id>/avatar.<ext> (≤2MB, image/*),
 * updates profiles.avatar_url with the public URL, and returns
 * { avatar_url }.
 *
 * Any signed-in user may set an avatar (children are only denied writes on
 * posts/likes/comments/follows per the Phase-1 RLS design). Uses the
 * service-role client for the storage write so the bucket RLS (which keys
 * on auth.uid()) isn't the gatekeeper here — the session check above is.
 */
export async function POST(request: Request) {
  const limited = rateLimitOr429(`avatar:${clientIp()}`, 20, 60_000);
  if (limited) return limited;

  const auth = await requireUser();
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
  const storagePath = `${auth.ctx.user.id}/avatar.${ext}`;

  const admin = createAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(storagePath, bytes, { contentType: file.type, upsert: true });
  if (uploadError) return json({ error: "upload_failed" }, 500);

  const { data: urlData } = admin.storage.from("avatars").getPublicUrl(storagePath);
  const avatarUrl = urlData.publicUrl;

  const supabase = createClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", auth.ctx.user.id);
  if (profileError) return json({ error: "profile_update_failed" }, 500);

  return json({ avatar_url: avatarUrl });
}
