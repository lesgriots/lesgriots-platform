'use client';
import '@/styles/tokens.css';
import RailGriotheque from '@/components/layout/RailGriotheque';
import { ToastProvider, ConfirmProvider } from '@/components/ui';
import CommandPalette from '@/components/CommandPalette';
import ThemeSection from '@/components/layout/ThemeSection';

/**
 * Le cadre commun de tous les écrans de l’organisme de formation.
 *
 * Il portait aussi la barre des projets épinglés et le journal rapide ⌘J :
 * deux outils d’agence, partis avec le Studio. Sidebar.jsx aiguillait entre le
 * rail de la Griothèque et le menu du Studio ; il n’y a plus qu’un monde, donc
 * plus d’aiguillage.
 */
export default function DashboardLayout({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          background: 'var(--bg)',
          fontFamily: 'var(--font-sans)',
          color: 'var(--text)',
        }}>
          <ThemeSection />
          <RailGriotheque />
          <main style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}>
            {children}
          </main>
          <CommandPalette />
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
