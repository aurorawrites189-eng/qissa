"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export interface ProfileEditorProfile {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  preferred_language: string;
}

interface ProfileEditorLabels {
  displayName: string;
  bio: string;
  language: string;
  save: string;
  saved: string;
  avatarHint: string;
  avatarTooBig: string;
  notAnImage: string;
  changeAvatar: string;
  uploading: string;
  genericError: string;
}

/** Edit display name, bio, avatar and preferred language. */
export function ProfileEditor({
  lang,
  profile,
  labels,
}: {
  lang: string;
  profile: ProfileEditorProfile;
  labels: ProfileEditorLabels;
}) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [preferredLanguage, setPreferredLanguage] = useState(profile.preferred_language ?? "en");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/profile`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          preferred_language: preferredLanguage,
        }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      setMessage({ ok: true, text: labels.saved });
    } catch {
      setMessage({ ok: false, text: "error" });
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setMessage(null);
    if (!file.type.startsWith("image/")) {
      setMessage({ ok: false, text: labels.notAnImage });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ ok: false, text: labels.avatarTooBig });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/profile/avatar`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`avatar failed: ${res.status}`);
      const data = await res.json();
      setAvatarUrl(data.avatar_url as string);
      setMessage({ ok: true, text: labels.saved });
    } catch {
      setMessage({ ok: false, text: "error" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-700 text-2xl font-bold text-white">
            {(displayName || profile.username).charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <label className="cursor-pointer text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAvatar(f);
                e.target.value = "";
              }}
            />
            {uploading ? labels.uploading : labels.changeAvatar}
          </label>
          <p className="mt-1 text-xs text-neutral-500">{labels.avatarHint}</p>
        </div>
      </div>

      <Input
        label={labels.displayName}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        maxLength={80}
        placeholder={profile.username}
      />
      <Textarea
        label={labels.bio}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        rows={3}
        maxLength={500}
      />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{labels.language}</span>
        <select
          value={preferredLanguage}
          onChange={(e) => setPreferredLanguage(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="en">English</option>
          <option value="ur">اردو</option>
        </select>
      </label>

      {message && (
        <p
          className={`text-sm ${message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
        >
          {message.text === "error" ? labels.genericError : message.text}
        </p>
      )}

      <div>
        <Button onClick={save} loading={saving}>
          {labels.save}
        </Button>
      </div>
    </div>
  );
}
