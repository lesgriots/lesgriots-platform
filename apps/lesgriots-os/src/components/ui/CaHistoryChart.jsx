'use client';

/**
 * CaHistoryChart — l'enveloppe, pas le graphique.
 *
 * `components/ui/index.js` est importé par cinquante-cinq pages. Tant que ce
 * fichier importait recharts directement, les cinquante-cinq embarquaient la
 * bibliothèque de graphiques, y compris celles qui n'affichent aucune courbe.
 *
 * Le tracé vit désormais dans CaHistoryChartVue, chargé à la demande. Les
 * appelants n'ont rien à changer : le nom et les propriétés sont les mêmes.
 * `ssr: false` parce qu'un graphique dessiné au serveur puis redessiné au
 * client donne exactement l'écart d'hydratation qu'on cherche à éviter.
 */
import dynamic from 'next/dynamic';

const CaHistoryChart = dynamic(() => import('./CaHistoryChartVue'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 132, borderRadius: 'var(--radius-md)', background: 'var(--surface-2)' }} />
  ),
});

export default CaHistoryChart;
