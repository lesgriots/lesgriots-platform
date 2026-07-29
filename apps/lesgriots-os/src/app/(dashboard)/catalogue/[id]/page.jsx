'use client';

import { useParams } from 'next/navigation';
import ProgramWorkspace from '@/components/library/ProgramWorkspace';

export default function ProgrammePage() {
  const { id } = useParams();
  return <ProgramWorkspace formationId={id} />;
}
