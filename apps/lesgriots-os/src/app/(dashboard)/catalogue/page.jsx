import LibraryWorkspace from '@/components/library/LibraryWorkspace';
import { Suspense } from 'react';

export default function CataloguePage() {
  return <Suspense fallback={<p style={{ padding: 28, color: 'var(--text-3)' }}>Chargement de la bibliothèque…</p>}><LibraryWorkspace /></Suspense>;
}
