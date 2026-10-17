/**
 * Dialogue (picture) stories for the Kids' Story World.
 *
 * A dialogue story is stored as JSON in posts.content:
 *   { "format": "dialogue", "turns": [{ "img": "/kids/<slug>/1.jpg", "speaker": "Nori", "line": "..." }] }
 * so that every dialogue turn starts with its own illustration.
 * Plain-text stories keep working exactly as before.
 */

export interface DialogueTurn {
  /** Public image path, e.g. /kids/nori-shares-her-light/1.jpg */
  img: string;
  speaker: string;
  line: string;
}

export interface DialogueStory {
  format: "dialogue";
  turns: DialogueTurn[];
}

/** Parse posts.content; returns null for ordinary plain-text stories. */
export function parseDialogueContent(content: string): DialogueStory | null {
  const t = content.trim();
  if (!t.startsWith("{")) return null;
  try {
    const p = JSON.parse(t) as Partial<DialogueStory>;
    if (p && p.format === "dialogue" && Array.isArray(p.turns) && p.turns.length > 0) {
      return { format: "dialogue", turns: p.turns };
    }
  } catch {
    /* plain-text story */
  }
  return null;
}

/**
 * Plain readable text of a story, for search indexing, card previews and
 * "continue reading" snippets. Dialogue stories become "Speaker: line"
 * paragraphs; plain-text stories pass through unchanged.
 */
export function kidsStoryText(content: string): string {
  const d = parseDialogueContent(content);
  if (!d) return content;
  return d.turns.map((t) => `${t.speaker}: ${t.line}`).join("\n\n");
}
