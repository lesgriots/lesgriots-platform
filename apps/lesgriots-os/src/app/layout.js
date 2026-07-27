import '@/styles/tokens.css';
import '@/styles/responsive.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata = {
  title: 'LES GRIOTS OS',
  description: 'LES GRIOTS OS · Pilotage Agence, Production & Formations',
  icons: {
    icon: [{ url: '/favicon.ico', sizes: '64x64', type: 'image/x-icon' }],
    apple: '/apple-icon.png',
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
            __html: `try{var p=location.pathname,h=location.hostname.toLowerCase(),g=h==='app.lagriotheque.com'||['/formations','/pipeline-formations','/sessions-list','/apprenants','/organisme','/apercu','/catalogue','/intervenants','/lieux','/qualite','/parametres-formation','/entreprises','/financeurs','/bpf','/agenda','/evaluations','/facturation','/appareil','/espace-apprenant','/emails'].some(function(r){return p===r||p.indexOf(r+'/')===0});if(g||localStorage.getItem('os-theme')==='light')document.documentElement.setAttribute('data-theme','light');document.documentElement.setAttribute('data-monde',g?'griotheque':'studio')}catch(e){}`,
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
