'use client';

/**
 * Tableau — la troisième primitive.
 *
 * Vingt-quatre écrans dessinent un tableau à la main, chacun avec son entête,
 * sa taille de police et son trait de séparation. Ici il y en a un.
 *
 *   <Tableau
 *     colonnes={[
 *       { cle: 'reference', titre: 'Référence', mono: true },
 *       { cle: 'objet',     titre: 'Objet', fort: true },
 *       { titre: 'Montant', nombre: true, rendu: (l) => euros(l.montant) },
 *     ]}
 *     lignes={incidents}
 *     cle={(l) => l.id}
 *     surClic={(l) => router.push(`/incidents/${l.id}`)}
 *     vide={<EmptyState title="Aucun incident" />}
 *   />
 *
 * `rendu` reçoit la ligne entière : une colonne peut donc afficher ce qu'elle
 * veut, un bouton, une étiquette, deux informations superposées.
 *
 * Le tableau ne trie pas et ne pagine pas. Ce n'est pas un oubli : tant qu'un
 * écran n'en a pas besoin, l'ajouter ici reviendrait à faire porter à tout le
 * monde le poids d'un seul.
 */

export default function Tableau({
  colonnes = [],
  lignes = [],
  cle = (ligne, i) => ligne?.id ?? i,
  surClic,
  vide = null,
  className = '',
  style = {},
}) {
  if (!lignes.length) return vide;

  return (
    <div className="lg-table__enveloppe" style={style}>
      <table className={['lg-table', surClic ? 'lg-table--cliquable' : '', className].filter(Boolean).join(' ')}>
        <thead>
          <tr>
            {colonnes.map((c, i) => (
              <th
                key={c.cle || c.titre || i}
                style={{ textAlign: c.nombre ? 'right' : 'left', width: c.largeur }}
              >
                {c.titre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, i) => (
            <tr
              key={cle(ligne, i)}
              onClick={surClic ? () => surClic(ligne) : undefined}
            >
              {colonnes.map((c, j) => {
                const contenu = c.rendu ? c.rendu(ligne, i) : ligne[c.cle];
                return (
                  <td
                    key={c.cle || c.titre || j}
                    className={c.nombre ? 'lg-table__nombre' : undefined}
                    style={{
                      fontWeight: c.fort ? 600 : undefined,
                      fontFamily: c.mono ? 'var(--font-mono)' : undefined,
                      color: c.attenue ? 'var(--text-3)' : undefined,
                      minWidth: c.minLargeur,
                    }}
                  >
                    {contenu === undefined || contenu === null || contenu === ''
                      ? <span style={{ color: 'var(--text-3)' }}>—</span>
                      : contenu}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Une seconde ligne sous la principale, en petit et en gris. Le motif revient
 * partout : un nom et, dessous, son contexte.
 */
export function Sous({ children }) {
  if (!children) return null;
  return (
    <div style={{ fontWeight: 400, fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 3 }}>
      {children}
    </div>
  );
}
