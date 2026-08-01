/**
 * La mise en forme des emails de LA GRIOTHÈQUE.
 *
 * Un email n'est pas une page web : pas de flexbox, pas de variables CSS, pas
 * de feuille externe. On revient donc à des tableaux et à des styles en ligne,
 * qui sont la seule chose que rendent Outlook, Gmail et Apple Mail de la même
 * façon.
 *
 * Le logo voyage en pièce jointe interne (cid:) plutôt qu'en lien : Gmail et
 * Outlook bloquent les images distantes par défaut, et un logo bloqué est un
 * message qui arrive sans marque.
 */

const PAPIER = '#f6f5f3';
const ENCRE = '#141310';
const TEXTE2 = '#4a4744';
const TEXTE3 = '#8a857f';
const LIGNE = '#e2ded7';
const OR = '#FFCA00';

/** Le corps texte devient du HTML lisible : titres en capitales, listes, liens. */
function enParagraphes(texte) {
  const blocs = String(texte || '').split(/\n{2,}/);
  return blocs.map((bloc) => {
    const lignes = bloc.split(/\n/).filter((l) => l.trim() !== '');
    if (!lignes.length) return '';

    // Un intertitre : une ligne courte, tout en capitales, éventuellement
    // précédée d'un pictogramme dans le modèle d'origine.
    const premiere = lignes[0].replace(/^[^\p{L}]+/u, '').trim();
    const estTitre = lignes.length > 1
      && premiere.length < 42
      && premiere === premiere.toUpperCase()
      && /\p{L}/u.test(premiere);

    if (estTitre) {
      const suite = lignes.slice(1);
      const puces = suite.every((l) => /^\s*[•\-–]/.test(l));
      return `
        <p style="margin:26px 0 6px;font:500 11px/1.4 'Geist Mono',ui-monospace,monospace;
                  letter-spacing:.14em;text-transform:uppercase;color:${TEXTE3}">${echapper(premiere)}</p>
        ${puces
          ? `<ul style="margin:0;padding-left:18px;font:400 15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${TEXTE2}">
              ${suite.map((l) => `<li style="margin-bottom:4px">${echapper(l.replace(/^\s*[•\-–]\s*/, ''))}</li>`).join('')}
             </ul>`
          : `<p style="margin:0;font:400 15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${ENCRE}">${suite.map(echapper).join('<br>')}</p>`}
      `;
    }

    return `<p style="margin:0 0 14px;font:400 15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${TEXTE2}">${lignes.map(echapper).join('<br>')}</p>`;
  }).join('');
}

function echapper(t) {
  return String(t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Les URL deviennent cliquables : un lien qu'il faut recopier n'est pas un lien.
    .replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${ENCRE};text-decoration:underline">$1</a>`);
}

/**
 * @param {object} o
 * @param {string} o.corps      le texte du modèle
 * @param {string} [o.lien]     l'espace apprenant, mis en avant en bouton
 * @param {string} [o.pied]     la ligne de pied (raison sociale, NDA…)
 */
export function emailHtml({ titre = '', corps = '', lien = '', pied = '' }) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${echapper(titre)}</title></head>
<body style="margin:0;padding:0;background:${PAPIER};-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPIER}">
<tr><td align="center" style="padding:28px 14px 40px">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${LIGNE};border-radius:14px">

    <tr><td style="padding:26px 30px 0">
      <img src="cid:logogriotheque" width="168" alt="LA GRIOTHÈQUE"
           style="display:block;border:0;width:168px;max-width:60%;height:auto">
      <p style="margin:10px 0 0;font:400 10px/1.4 'Geist Mono',ui-monospace,monospace;
                letter-spacing:.16em;text-transform:uppercase;color:${TEXTE3}">Organisme de formation</p>
    </td></tr>

    <tr><td style="padding:22px 30px 0"><div style="height:1px;background:${LIGNE};font-size:0">&nbsp;</div></td></tr>

    <tr><td style="padding:22px 30px 4px">
      ${enParagraphes(corps)}
    </td></tr>

    ${lien ? `
    <tr><td style="padding:8px 30px 4px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:${OR};border-radius:9px">
          <a href="${lien}" style="display:inline-block;padding:13px 22px;font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${ENCRE};text-decoration:none">Ouvrir mon espace apprenant</a>
        </td>
      </tr></table>
      <p style="margin:9px 0 0;font:400 12px/1.5 -apple-system,sans-serif;color:${TEXTE3}">
        Votre programme, vos documents, l’émargement et les questionnaires s’y trouvent.
      </p>
    </td></tr>` : ''}

    <tr><td style="padding:26px 30px 26px">
      <div style="height:1px;background:${LIGNE};font-size:0;margin-bottom:14px">&nbsp;</div>
      <p style="margin:0;font:400 11.5px/1.6 -apple-system,sans-serif;color:${TEXTE3}">
        ${echapper(pied)}
      </p>
    </td></tr>

  </table>

  <p style="margin:16px 0 0;font:400 10px/1.4 'Geist Mono',ui-monospace,monospace;
            letter-spacing:.16em;text-transform:uppercase;color:${TEXTE3}">La Griothèque</p>

</td></tr></table>
</body></html>`;
}
