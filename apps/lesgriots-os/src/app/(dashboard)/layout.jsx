'use client';
import '@/styles/tokens.css';
import Sidebar from '@/components/layout/Sidebar';
import { ToastProvider, ConfirmProvider } from '@/components/ui';
import QuickAddJournal from '@/components/QuickAddJournal';
import CommandPalette from '@/components/CommandPalette';
import { PinnedProvider, default as PinnedBar } from '@/components/PinnedBar';
import ThemeSection from '@/components/layout/ThemeSection';

export default function DashboardLayout({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
      <PinnedProvider>
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          background: 'var(--bg)',
          fontFamily: 'var(--font-sans)',
          color: 'var(--text)',
        }}>
          <ThemeSection />
          <Sidebar />
          <main style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <PinnedBar />
            {children}
          </main>
          <QuickAddJournal />
          <CommandPalette />
        </div>
      </PinnedProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
