import '@/styles/tokens.css';
import '@/styles/responsive.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata = {
  // Le nom de l'application, celui qu'on lit dans l'onglet et au partage.
  // La raison sociale reste LES GRIOTS sur les documents officiels : c'est la
  // SASU qui porte le SIRET et la déclaration d'activité, pas le logiciel.
  title: 'LA GRIOTHÈQUE OS',
  description: 'LA GRIOTHÈQUE OS · Le pilotage de l’organisme de formation',
  manifest: '/manifest.webmanifest',
  icons: {
    // Le symbole officiel est utilisé pour l'onglet, les raccourcis et l'app installée.
    // Le mot-symbole complet reste affiché là où la place le permet (connexion/sidebar).
    icon: [{ url: '/branding/griotring-ink.png', sizes: '512x512', type: 'image/png' }],
    shortcut: [{ url: '/branding/griotring-ink.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/branding/griotring-ink.png', sizes: '512x512', type: 'image/png' }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        {/* Anti-FOUC : applique le thème avant le premier paint.
            Deux mondes : les sections de la Griothèque (l'organisme de formation)
            reprennent l'identité papier du site lagriotheque.com ; le reste garde
            le cockpit encre et respecte la préférence enregistrée.
            La liste des routes doit rester alignée sur ThemeSection.jsx. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=location.pathname,h=location.hostname.toLowerCase(),g=h==='app.lagriotheque.com'||['/formations','/pipeline-formations','/sessions','/sessions-list','/apprenants','/organisme','/apercu','/catalogue','/intervenants','/lieux','/qualite','/parametres-formation','/entreprises','/financeurs','/bpf','/agenda','/evaluations','/facturation','/appareil','/espace-apprenant','/emails','/inscriptions','/recyclages','/opportunites-archivees','/workflows','/settings'].some(function(r){return p===r||p.indexOf(r+'/')===0});if(g||localStorage.getItem('os-theme')==='light')document.documentElement.setAttribute('data-theme','light');document.documentElement.setAttribute('data-monde',g?'griotheque':'studio')}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@100;200;300;400;500;600;700;800;900&family=Geist+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="os-app" style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
