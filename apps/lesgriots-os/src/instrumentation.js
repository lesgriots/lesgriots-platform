/**
 * LES GRIOTS OS — Instrumentation (Next 15, activée par défaut)
 *
 * Vérifie au démarrage que les secrets indispensables sont présents.
 * En production, on refuse de démarrer sans eux : mieux vaut un crash
 * explicite qu'un serveur ouvert à tous.
 */

export async function register() {
  if (process.env.NODE_ENV === 'production') {
    const missing = [];
    if (!process.env.AUTH_SECRET) missing.push('AUTH_SECRET');
    if (!process.env.OS_API_KEY) missing.push('OS_API_KEY');
    if (missing.length > 0) {
      throw new Error(
        `[instrumentation] Variables d'environnement manquantes en production : ${missing.join(', ')}. ` +
        'Le serveur refuse de démarrer sans elles.'
      );
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.warn('[instrumentation] GOOGLE_CLIENT_ID absent — le login Google OAuth ne fonctionnera pas.');
    }
  }
}
