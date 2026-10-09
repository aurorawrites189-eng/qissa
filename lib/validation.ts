import { z } from "zod";

/**
 * Server-side validation for all user input.
 * Every server action / route handler must parse through these schemas.
 */

const email = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .max(254, "Email is too long");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

const username = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers and underscores")
  .transform((s) => s.toLowerCase());

export const signupSchema = z.object({
  email,
  password,
  username,
  birth_year: z
    .number()
    .int("Birth year must be a whole number")
    .min(1900, "Birth year looks invalid")
    .max(new Date().getFullYear(), "Birth year cannot be in the future"),
  preferred_language: z.enum(["en", "ur"]).default("en"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const postSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200, "Title is too long"),
  content: z.string().trim().min(50, "Content must be at least 50 characters").max(100000, "Content is too long"),
  language: z.enum(["en", "ur"]).default("en"),
  category: z.string().trim().max(100).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
});

export const commentSchema = z.object({
  post_id: z.string().uuid("Invalid post id"),
  content: z.string().trim().min(1, "Comment cannot be empty").max(2000, "Comment is too long"),
});

export const reportSchema = z.object({
  post_id: z.string().uuid("Invalid post id"),
  reason: z.string().trim().min(3, "Reason is required").max(120),
  details: z.string().trim().max(2000).optional(),
});

/** Cover image payload stored alongside a post (post_images row). */
export const coverImageSchema = z.object({
  storage_path: z.string().trim().min(1, "Missing image path").max(500, "Image path is too long"),
  alt_text: z.string().trim().max(200, "Alt text is too long").optional(),
});

/**
 * PATCH /api/posts/[id] body. All content fields are optional (autosave);
 * when `action` is "publish" the merged post is re-validated against the
 * full postSchema in the route handler.
 */
export const postUpdateSchema = postSchema.partial().extend({
  action: z.enum(["publish"]).optional(),
  /** "Submit as kids' story": requires a kids category (checked in handler). */
  submit_as_kids: z.boolean().optional(),
  visibility: z.enum(["public", "unlisted"]).optional(),
  cover_image: coverImageSchema.nullable().optional(),
});

export const profileUpdateSchema = z.object({
  display_name: z.string().trim().max(80, "Display name is too long").optional(),
  bio: z.string().trim().max(500, "Bio is too long").optional(),
  preferred_language: z.enum(["en", "ur"]).optional(),
});

/** Query params for GET /api/posts (feed listing). */
export const postsQuerySchema = z.object({
  lang: z.enum(["en", "ur"]).optional(),
  category: z.string().trim().max(100).optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PostInput = z.infer<typeof postSchema>;
export type PostUpdateInput = z.infer<typeof postUpdateSchema>;
export type CoverImageInput = z.infer<typeof coverImageSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type ReportInput = z.infer<typeof reportSchema>;

/** Child (under-18) vs adult, derived from birth_year. */
export function ageClassFromBirthYear(birthYear: number): "child" | "adult" {
  return new Date().getFullYear() - birthYear < 18 ? "child" : "adult";
}
