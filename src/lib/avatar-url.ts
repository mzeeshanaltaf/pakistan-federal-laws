// Better Auth's user.image field isn't restricted server-side, so a raw API
// call (bypassing our own upload/dicebear routes, which only ever return
// same-origin /api/avatar/{userId} URLs) could set it to an attacker-controlled
// absolute URL. Rendering that in an <img> would leak the viewer's IP/UA to
// the attacker every time the profile is viewed — restrict rendering to
// same-origin relative paths and fall back to initials otherwise.
export function isSafeAvatarUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && url.startsWith("/api/avatar/");
}
