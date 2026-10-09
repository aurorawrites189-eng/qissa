import en from "./dictionaries/en.json";
import enSocial from "./dictionaries/en.social.json";
import urSocial from "./dictionaries/ur.social.json";

/**
 * Shape of every locale dictionary. en.json is the source of truth:
 * ur.json (and any future locale) must structurally match this type,
 * otherwise `tsc` fails — which is how we catch missing translations.
 *
 * Phase 3: social strings live in en.social.json / ur.social.json and are
 * deep-merged at runtime by get-dictionary.ts, so the Dictionary type is
 * the base shape INTERSECTED with the social shape. ur.social.json must
 * structurally match en.social.json — enforced by _assertSocialParity
 * below (a type error here means a missing/mismatched Urdu string).
 */
export type Dictionary = typeof en & typeof enSocial;

// Compile-time parity check for the social dictionaries (unused value;
// the assignment itself is the check).
const _assertSocialParity: typeof enSocial = urSocial;
void _assertSocialParity;
