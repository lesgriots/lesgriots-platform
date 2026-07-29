/** URL canonique d'une session : une fiche autonome depuis tout l'OS. */
export const sessionHref = (sessionId) => (
  `/sessions/${encodeURIComponent(sessionId)}`
);
