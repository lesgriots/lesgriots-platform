'use client';

/**
 * Button — l'ancien nom du Bouton.
 *
 * Trente fichiers l'importent. Plutôt que de les rouvrir tous d'un coup, il
 * délègue à la primitive : ils héritent sans rien changer de l'anneau de
 * focus, de l'état d'attente et de la bonne couleur d'encre sur l'or.
 *
 * Les écrans neufs écrivent `Bouton`. Celui-ci s'éteindra à mesure que les
 * anciens seront repris.
 */

import Bouton from './Bouton';

export default function Button({ variant = 'secondary', ...reste }) {
  return <Bouton variant={variant} {...reste} />;
}
