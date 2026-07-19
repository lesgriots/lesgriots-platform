// Préfixe basePath pour le code CLIENT (fetch, <img>, <video>).
//
// Next.js ne préfixe automatiquement QUE les <Link> et ses propres assets.
// Tout fetch("/api/…") ou src="/api/preview…" écrit en absolu part sinon sur
// admin.lesgriots.com/api/… (le hub), qui route vers le BO Studio → 404 ou
// mauvaise app. NEXT_PUBLIC_BASE_PATH est inliné au build (cf. next.config.js) :
// "/lesgriots" en prod, "" en dev.
export const BP = process.env.NEXT_PUBLIC_BASE_PATH || "";

// URL d'affichage d'un média du store : URL http(s) directe (R2, externe)
// ou chemin relatif au site → servi par /api/preview (avec le bon préfixe).
export function mediaUrl(p) {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return `${BP}/api/preview?p=${encodeURIComponent(p)}`;
}

// true si le chemin est une vidéo (pour choisir <video> vs <img>).
export function isVideo(p) {
  return /\.(mp4|webm|m4v|mov)(\?|$)/i.test(p || "");
}
