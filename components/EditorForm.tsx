"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/types";
import type { Locale } from "@/lib/site-config";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { publicStorageUrl } from "@/lib/storage";

export interface EditorCategory {
  slug: string;
  name_en: string;
  name_ur: string;
  is_kids: boolean;
}

export interface EditorInitialPost {
  id: string;
  title: string;
  content: string;
  language: string;
  category: string | null;
  tags: string[];
  status: string;
  visibility: string;
  cover: { storage_path: string; alt_text: string | null } | null;
}

const AUTOSAVE_MS = 30_000;

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 10);
}

export function EditorForm({
  lang,
  dict,
  categories,
  initialPost = null,
}: {
  lang: Locale;
  dict: Dictionary;
  categories: EditorCategory[];
  initialPost?: EditorInitialPost | null;
}) {
  const router = useRouter();
  const w = dict.write;

  const [postId, setPostId] = useState<string | null>(initialPost?.id ?? null);
  const [creating, setCreating] = useState(!initialPost);
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [content, setContent] = useState(initialPost?.content ?? "");
  const [language, setLanguage] = useState(initialPost?.language ?? lang);
  const [category, setCategory] = useState(initialPost?.category ?? "");
  const [tagsRaw, setTagsRaw] = useState((initialPost?.tags ?? []).join(", "));
  const [visibility, setVisibility] = useState(initialPost?.visibility ?? "public");
  const [submitAsKids, setSubmitAsKids] = useState(false);
  const [cover, setCover] = useState<{ storage_path: string; alt_text: string } | null>(
    initialPost?.cover
      ? { storage_path: initialPost.cover.storage_path, alt_text: initialPost.cover.alt_text ?? "" }
      : null
  );
  const [preview, setPreview] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirtyRef = useRef(false);
  const stateRef = useRef({ title, content, language, category, tagsRaw, visibility });
  stateRef.current = { title, content, language, category, tagsRaw, visibility };
  const postIdRef = useRef<string | null>(postId);
  postIdRef.current = postId;

  const markDirty = () => {
    dirtyRef.current = true;
    setSaveState((s) => (s === "saved" ? "idle" : s));
  };

  // Create a fresh draft on first mount (only on /write, not /write/[id]).
  useEffect(() => {
    if (initialPost || postIdRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/${lang}/api/posts`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`create failed: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setPostId(data.post.id);
        setCreating(false);
        // Swap to the canonical edit URL so refresh keeps working.
        router.replace(`/${lang}/write/${data.post.id}`);
      } catch {
        if (!cancelled) {
          setCreating(false);
          setError(dict.validation.genericError);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDraft = useCallback(
    async (fields?: { cover_image?: { storage_path: string; alt_text: string } | null }) => {
      const id = postIdRef.current;
      if (!id) return;
      setSaveState("saving");
      setError(null);
      const s = stateRef.current;
      try {
        const payload: Record<string, unknown> = {
          title: s.title,
          content: s.content,
          language: s.language,
          category: s.category || null,
          tags: parseTags(s.tagsRaw),
          visibility: s.visibility,
        };
        if (fields && "cover_image" in fields) payload.cover_image = fields.cover_image;
        const res = await fetch(`/${lang}/api/posts/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`save failed: ${res.status}`);
        dirtyRef.current = false;
        setSaveState("saved");
      } catch {
        setSaveState("error");
        setError(dict.validation.genericError);
      }
    },
    [lang, dict.validation.genericError]
  );

  // Autosave every 30s when something changed.
  useEffect(() => {
    const t = setInterval(() => {
      if (dirtyRef.current && postIdRef.current) void saveDraft();
    }, AUTOSAVE_MS);
    return () => clearInterval(t);
  }, [saveDraft]);

  const onUploadCover = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError(w.notAnImage);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(w.imageTooBig);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/${lang}/api/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`upload failed: ${res.status}`);
      const data = await res.json();
      const next = { storage_path: data.storage_path as string, alt_text: cover?.alt_text ?? "" };
      setCover(next);
      await saveDraft({ cover_image: next });
    } catch {
      setError(dict.validation.genericError);
    } finally {
      setUploading(false);
    }
  };

  const onRemoveCover = async () => {
    setCover(null);
    await saveDraft({ cover_image: null });
  };

  const onAltBlur = async () => {
    if (cover) await saveDraft({ cover_image: cover });
  };

  const onPublish = async () => {
    const id = postIdRef.current;
    if (!id || publishing) return;
    setPublishing(true);
    setError(null);
    const s = stateRef.current;
    try {
      const res = await fetch(`/${lang}/api/posts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: s.title,
          content: s.content,
          language: s.language,
          category: s.category || null,
          tags: parseTags(s.tagsRaw),
          visibility: s.visibility,
          action: "publish",
          submit_as_kids: submitAsKids,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === "kids_category_required") setError(w.kidsCategoryRequired);
        else setError(w.publishError);
        return;
      }
      router.push(`/${lang}/dashboard`);
    } catch {
      setError(w.publishError);
    } finally {
      setPublishing(false);
    }
  };

  const onDelete = async () => {
    const id = postIdRef.current;
    if (!id || deleting) return;
    if (!window.confirm(w.deleteConfirm)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/${lang}/api/posts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      router.push(`/${lang}/dashboard`);
    } catch {
      setError(dict.validation.genericError);
      setDeleting(false);
    }
  };

  const wordCount = content.trim() === "" ? 0 : content.trim().split(/\s+/).length;
  const selectedCategory = categories.find((c) => c.slug === category);
  const catName = (c: EditorCategory) => (lang === "ur" ? c.name_ur : c.name_en);

  if (creating) {
    return <p className="py-16 text-center text-neutral-500">{w.creating}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{w.title}</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 dark:text-neutral-400" role="status">
            {saveState === "saving" && w.saving}
            {saveState === "saved" && `✓ ${w.autosaved}`}
            {saveState === "error" && dict.validation.genericError}
          </span>
          <Button variant="secondary" onClick={() => setPreview((p) => !p)}>
            {preview ? w.backToEditor : w.preview}
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      {preview ? (
        <article
          lang={language}
          dir={language === "ur" ? "rtl" : "ltr"}
          className="rounded-2xl border border-neutral-200 p-8 dark:border-neutral-800"
        >
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={publicStorageUrl("post-images", cover.storage_path)}
              alt={cover.alt_text || title}
              className="mb-6 aspect-[16/9] w-full rounded-xl object-cover"
            />
          )}
          <h2 className="mb-4 text-3xl font-extrabold">{title || w.untitled}</h2>
          <div className="whitespace-pre-wrap text-lg leading-relaxed">
            {content || "…"}
          </div>
        </article>
      ) : (
        <div className="flex flex-col gap-5">
          <Input
            label={w.storyTitle}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            maxLength={200}
            placeholder={w.untitled}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{w.language}</span>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="en">English</option>
                <option value="ur">اردو</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{w.category}</span>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {catName(c)}
                    {c.is_kids ? " · kids" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{w.visibility}</span>
              <select
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="public">{w.visibilityPublic}</option>
                <option value="unlisted">{w.visibilityUnlisted}</option>
              </select>
            </label>
          </div>

          <div>
            <Textarea
              label={w.content}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                markDirty();
              }}
              rows={14}
              dir={language === "ur" ? "rtl" : "ltr"}
              lang={language}
            />
            <p className="mt-1 text-right text-xs text-neutral-500">
              {wordCount} {dict.posts.words}
            </p>
          </div>

          <div>
            <Input
              label={w.tags}
              value={tagsRaw}
              onChange={(e) => {
                setTagsRaw(e.target.value);
                markDirty();
              }}
              placeholder="adventure, kindness"
            />
            <p className="mt-1 text-xs text-neutral-500">{w.tagsHint}</p>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="mb-2 text-sm font-medium">{w.coverImage}</p>
            {cover ? (
              <div className="flex flex-col gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={publicStorageUrl("post-images", cover.storage_path)}
                  alt={cover.alt_text || title}
                  className="aspect-[16/9] w-full rounded-xl object-cover"
                />
                <Input
                  label={w.altText}
                  value={cover.alt_text}
                  onChange={(e) => setCover({ ...cover, alt_text: e.target.value })}
                  onBlur={onAltBlur}
                  maxLength={200}
                />
                <p className="-mt-2 text-xs text-neutral-500">{w.altTextHint}</p>
                <div>
                  <Button variant="ghost" onClick={onRemoveCover}>
                    {w.removeImage}
                  </Button>
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-sm text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUploadCover(f);
                    e.target.value = "";
                  }}
                />
                {uploading ? w.uploading : w.uploadCover}
              </label>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
            <input
              type="checkbox"
              checked={submitAsKids}
              onChange={(e) => setSubmitAsKids(e.target.checked)}
              className="mt-1 h-4 w-4 accent-emerald-700"
            />
            <span className="text-sm">
              <span className="font-medium">{w.submitAsKids}</span>
              <span className="block text-neutral-600 dark:text-neutral-300">{w.kidsStoryHint}</span>
              {submitAsKids && !selectedCategory?.is_kids && (
                <span className="mt-1 block text-red-600 dark:text-red-400">
                  {w.kidsCategoryRequired}
                </span>
              )}
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => void saveDraft()} loading={saveState === "saving"}>
              {w.saveDraft}
            </Button>
            <Button onClick={onPublish} loading={publishing}>
              {w.submitReview}
            </Button>
            <Button variant="danger" onClick={onDelete} loading={deleting} className="ms-auto">
              {w.deleteDraft}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
