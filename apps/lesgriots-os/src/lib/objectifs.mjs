/**
 * objectifs.mjs — lire des objectifs pédagogiques, quel qu'en soit le format.
 *
 * Le champ `objectives` d'une formation contient tantôt un tableau JSON, tantôt
 * du texte tapé au clavier, une ligne par objectif, avec ou sans tiret devant.
 * Les deux sont légitimes : l'éditeur du programme propose une zone de texte
 * libre, l'import en propose une autre.
 *
 * La convention savait lire les deux. L'attestation et le certificat ne
 * savaient lire que le JSON : une fiche dont les objectifs avaient été tapés
 * à la main produisait un certificat de réalisation sans un seul objectif,
 * en silence. Or c'est la pièce que l'OPCO lit pour payer.
 *
 * Une seule fonction, donc, et tout le monde s'en sert.
 */
export function lireObjectifs(brut) {
  if (!brut) return [];
  if (Array.isArray(brut)) return brut.map(String).map((x) => x.trim()).filter(Boolean);
  try {
    const j = JSON.parse(brut);
    if (Array.isArray(j)) return j.map(String).map((x) => x.trim()).filter(Boolean);
  } catch { /* ce n'était pas du JSON : c'est du texte, et c'est très bien */ }
  return String(brut)
    .split(/\r?\n/)
    .map((x) => x.replace(/^\s*[-—•*]\s*/, '').trim())
    .filter(Boolean);
}
