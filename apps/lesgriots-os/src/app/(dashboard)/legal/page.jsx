'use client';
/**
 * /legal — Bibliothèque juridique LES GRIOTS
 *
 * Trois sections :
 *   1. Générateurs FR pré-remplis (NDA, Media Release, MSA) — partent depuis client/projet
 *   2. Templates The Futur Legal Kit (EN / droit US) — téléchargeables tels quels
 *   3. Disclaimer juridique général
 */
import { useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import { Card, Badge, Button, SectionTitle } from '@/components/ui';

// ── Catalogue des templates Legal Kit ──
const TEMPLATES = [
  {
    file: '01-MSA.docx',
    title: 'Master Services Agreement (MSA)',
    badge: 'Client',
    category: 'Client Agreements',
    description: 'Contrat-cadre client. Définit les termes généraux : confidentialité, propriété intellectuelle, paiement, résiliation. Utilisé en complément de Schedule A (IP) et Schedule B (SOW).',
    when: 'Client récurrent ou projet > 10k€.',
    needsAdaptation: true,
  },
  {
    file: '02-Schedule-A-IP.docx',
    title: 'Schedule A — Intellectual Property',
    badge: 'Client',
    category: 'Client Agreements',
    description: 'Annexe au MSA. Détaille la cession de droits de propriété intellectuelle entre LES GRIOTS et le client (qui possède quoi, dans quel contexte, pour quel usage).',
    when: 'À signer avec chaque MSA.',
    needsAdaptation: true,
  },
  {
    file: '03-Schedule-B-SOW.docx',
    title: 'Schedule B — Statement of Work (SOW)',
    badge: 'Client',
    category: 'Client Agreements',
    description: 'Annexe au MSA. Détaille un projet spécifique : périmètre, livrables, planning, prix. Un MSA = un SOW par projet.',
    when: 'À chaque nouveau projet sous MSA existant.',
    needsAdaptation: true,
  },
  {
    file: '04-Employee-Agreement.docx',
    title: 'Employee Agreement',
    badge: 'Équipe',
    category: 'Employee Agreements',
    description: 'Contrat de salarié·e (CDI / CDD à adapter au Code du travail français). À ne pas utiliser tel quel — référence uniquement.',
    when: 'Référence pour adaptation par avocat·e.',
    needsAdaptation: true,
  },
  {
    file: '05-Independent-Contractor-Agreement.docx',
    title: 'Independent Contractor Agreement',
    badge: 'Freelance',
    category: 'Employee Agreements',
    description: 'Contrat de prestation freelance. Définit la mission, le tarif, la propriété intellectuelle des livrables, la confidentialité.',
    when: 'Chaque collaboration freelance / sous-traitance.',
    needsAdaptation: true,
  },
  {
    file: '06-Media-Release.docx',
    title: 'Media Release',
    badge: 'Tournage',
    category: 'Misc Agreements',
    description: 'Autorisation de droit à l\'image et d\'enregistrement. Fait signer par toute personne apparaissant dans une captation (interview, tournage, événement).',
    when: 'Chaque tournage / interview / événement filmé.',
    needsAdaptation: true,
  },
  {
    file: '07-Mutual-NDA.docx',
    title: 'Mutual Non-Disclosure Agreement (NDA)',
    badge: 'Confidentialité',
    category: 'Misc Agreements',
    description: 'Accord de confidentialité réciproque. À faire signer avant de partager des informations sensibles (pitch, stratégie, données chiffrées).',
    when: 'Avant tout échange confidentiel (pitch, RFP, audit).',
    needsAdaptation: true,
  },
];

const GENERATORS = [
  {
    key: 'nda',
    title: 'NDA — Accord de confidentialité',
    description: 'Génère un NDA réciproque en français, pré-rempli depuis une fiche client.',
    where: 'Bouton « Générer NDA » sur la fiche client.',
    cta: { label: 'Voir les entreprises', href: '/entreprises' },
    available: true,
  },
  {
    key: 'media-release',
    title: 'Cession de droit à l\'image',
    description: 'Génère une autorisation d\'enregistrement et de diffusion (RGPD + art. 9 Code civil), pré-remplie depuis une fiche projet.',
    where: 'Bouton « Cession droit à l\'image » sur la fiche projet.',
    cta: { label: 'Voir les projets', href: '/projects' },
    available: true,
  },
  {
    key: 'msa',
    title: 'Contrat-cadre de prestation (MSA)',
    description: 'Génère un contrat-cadre de prestation de services en droit français, pré-rempli depuis une fiche client. Inclut cession CPI, confidentialité, RGPD, juridiction.',
    where: 'Bouton « Générer MSA » sur la fiche client.',
    cta: { label: 'Voir les entreprises', href: '/entreprises' },
    available: true,
  },
];

export default function LegalPage() {
  const [filter, setFilter] = useState('all');
  const categories = ['all', ...new Set(TEMPLATES.map(t => t.category))];
  const filtered = filter === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.category === filter);

  return (
    <>
      <TopBar
        title="Légal"
        subtitle="Bibliothèque de contrats et générateurs FR pré-remplis"
      />
      <div style={pageStyle} className="lg-anim-fade">

        {/* Disclaimer juridique global */}
        <Card variant="alert">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18 }}>⚖️</span>
            <div style={{ flex: 1 }}>
              <strong style={{ color: 'var(--text)', fontSize: 13 }}>
                Cette bibliothèque est un point de départ, pas un substitut à un·e avocat·e.
              </strong>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>
                Les templates The Futur sont en anglais et basés sur le droit américain — ils nécessitent une adaptation au droit français (Code civil, CPI, Code du travail, RGPD) avant signature.
                Les générateurs FR ci-dessous produisent des documents conformes aux usages français mais doivent être relus par un·e juriste pour les enjeux importants
                (contrats &gt; 10k€, cession exclusive de droits, exclusivité, clause de non-concurrence).
              </p>
            </div>
          </div>
        </Card>

        {/* Section 1 — Générateurs FR */}
        <section>
          <SectionTitle
            title="Générateurs FR pré-remplis"
            level="h2"
            subtitle="Documents en français, conformes au droit français, partant des données du dashboard"
          />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12,
            marginTop: 12,
          }}>
            {GENERATORS.map(g => (
              <Card key={g.key}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge tone="success" size="sm">FR</Badge>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      {g.title}
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, flex: 1 }}>
                    {g.description}
                  </p>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-3)',
                    fontFamily: 'var(--font-mono)',
                    padding: '6px 8px',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    📍 {g.where}
                  </div>
                  <Button variant="secondary" size="sm" href={g.cta.href}>
                    {g.cta.label} →
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Section 2 — Templates The Futur Legal Kit */}
        <section>
          <SectionTitle
            title="Templates The Futur Legal Kit"
            level="h2"
            subtitle="Templates EN / droit US — référence pour adaptation par avocat·e"
            right={
              <a
                href="/legal/templates/00-Read-This-First.pdf"
                target="_blank"
                rel="noopener"
                style={{ fontSize: 12, color: 'var(--gold-deep)', textDecoration: 'none' }}
              >
                📖 Read This First
              </a>
            }
          />

          {/* Filtres */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid ' + (filter === c ? 'var(--gold)' : 'var(--border)'),
                  background: filter === c ? 'var(--gold-soft)' : 'transparent',
                  color: filter === c ? 'var(--gold-deep)' : 'var(--text-2)',
                  cursor: 'pointer',
                  transition: 'all var(--duration) var(--ease)',
                }}
              >
                {c === 'all' ? `Tous (${TEMPLATES.length})` : c}
              </button>
            ))}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 12,
          }}>
            {filtered.map(t => (
              <Card key={t.file}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Badge tone="neutral" size="sm">EN · US</Badge>
                    <Badge tone="info" size="sm">{t.badge}</Badge>
                  </div>
                  <h3 style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-title)',
                  }}>
                    {t.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, flex: 1 }}>
                    {t.description}
                  </p>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-3)',
                    fontFamily: 'var(--font-mono)',
                    padding: '6px 8px',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    📌 {t.when}
                  </div>
                  <a
                    href={`/legal/templates/${t.file}`}
                    download
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      fontSize: 12,
                      fontWeight: 500,
                      textDecoration: 'none',
                      transition: 'all var(--duration) var(--ease)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold-soft)'; e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold-deep)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}
                  >
                    ⬇ Télécharger .docx
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Notes méthodologiques */}
        <Card>
          <SectionTitle title="Méthodo — comment utiliser cette bibliothèque" level="h3" />
          <ol style={{
            margin: '10px 0 0',
            padding: '0 0 0 20px',
            fontSize: 12,
            color: 'var(--text-2)',
            lineHeight: 1.7,
          }}>
            <li><strong>Pour signature rapide :</strong> utilise les générateurs FR (NDA, Media Release, MSA) — pré-remplis et exploitables tel quel pour les cas standards.</li>
            <li><strong>Pour un client important :</strong> télécharge le template EN correspondant, fais-le adapter par un·e avocat·e en droit des affaires.</li>
            <li><strong>Pour la propriété intellectuelle :</strong> précise toujours <em>cession</em> ou <em>licence</em>, l&apos;étendue (mondiale ?), la durée, l&apos;exclusivité, les médias couverts.</li>
            <li><strong>Pour le RGPD :</strong> tout document collectant nom + image + signature doit mentionner finalité, durée de conservation, droit d&apos;accès et de retrait.</li>
            <li><strong>Pour la juridiction :</strong> par défaut, droit français, tribunaux de Paris. Vérifier pour les clients hors UE.</li>
          </ol>
        </Card>

      </div>
    </>
  );
}

const pageStyle = {
  padding: 'var(--sp-6)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--sp-5)',
  maxWidth: 'var(--content-max)',
  margin: '0 auto',
  width: '100%',
};
