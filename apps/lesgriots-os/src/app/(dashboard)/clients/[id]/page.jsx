'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Badge, Button, Skeleton, EmptyState,
  SectionTitle, SubLabel, useToast,
} from '@/components/ui';
import ClientLegalActions from '@/components/ClientLegalActions';

const STAGE_LABEL = {
  lead: 'Lead', need: 'Besoin', qualify: 'Qualif', quoted: 'Devis',
  negotiation: 'Négo', signed: 'Signé', active: 'Actif',
  delivered: 'Livré', paid: 'Payé', lost: 'Perdu',
};
const STAGE_TONE = {
  lead: 'neutral', need: 'neutral', qualify: 'info',
  quoted: 'gold', negotiation: 'warning',
  signed: 'success', active: 'success',
  delivered: 'pillar', paid: 'success', lost: 'danger',
};
const PILLAR_COLOR = {
  STUDIO: 'var(--pillar-studio)',
  PROD: 'var(--pillar-prod)',
  GRIOTHEQUE: 'var(--pillar-griotheque)',
};

const fmt = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

export default function ClientDetailPage({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    fetch('/api/data')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        const client = (d.clients || []).find(c => c.id === id);
        if (!client) { setError('CLIENT_NOT_FOUND'); return; }
        const projects = (d.projects || []).filter(p => p.clientId === id);
        setData({ client, projects });
      })
      .catch(e => { console.warn('[Client] Chargement échoué :', e); setError(e.message); });
  }, [id, reloadKey]);

  if (error === 'CLIENT_NOT_FOUND') {
    return (
      <>
        <TopBar title="Client introuvable" />
        <div style={pageStyle}>
          <EmptyState
            icon="✕"
            title="Ce client n'existe pas"
            message="Il a peut-être été supprimé."
            action={<Button variant="primary" href="/clients">← Retour aux clients</Button>}
          />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <TopBar title="Erreur" />
        <div style={pageStyle}>
          <Card variant="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span><strong style={{ color: 'var(--danger)' }}>Erreur :</strong> {error}</span>
              <Button variant="danger" size="sm" onClick={() => { setError(null); setReloadKey(k => k + 1); }}>Réessayer</Button>
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <TopBar title="Chargement…" />
        <div style={pageStyle}>
          <Card>
            <Skeleton width="40%" height={20} />
            <Skeleton width="60%" height={12} style={{ marginTop: 8 }} />
          </Card>
          <Card style={{ minHeight: 200 }}>
            <Skeleton width="20%" height={14} />
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Skeleton height={48} />
              <Skeleton height={48} />
            </div>
          </Card>
        </div>
      </>
    );
  }

  const { client, projects } = data;
  const totalRevenue = projects.reduce((s, p) => s + (p.revenue || 0), 0);
  const paidRevenue = projects
    .filter(p => p.stage === 'paid')
    .reduce((s, p) => s + (p.revenue || 0), 0);
  const activeProjects = projects.filter(p => !['paid', 'lost'].includes(p.stage));
  const wonProjects = projects.filter(p => ['signed', 'active', 'delivered', 'paid'].includes(p.stage));
  const conversionRate = projects.length
    ? Math.round((wonProjects.length / projects.length) * 100)
    : 0;

  const initials = (client.company || `${client.firstName || ''} ${client.lastName || ''}`.trim() || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('');

  return (
    <>
      <TopBar
        title={client.company || `${client.firstName} ${client.lastName}`.trim()}
        subtitle={client.typeClient ? client.typeClient.charAt(0).toUpperCase() + client.typeClient.slice(1) : 'Client'}
      />
      <div style={pageStyle} className="lg-anim-fade">

        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
          <Link href="/clients" style={breadcrumbLink}>← Clients</Link>
          <span style={{ color: 'var(--text-3)' }}>/</span>
          <span style={{ color: 'var(--text-2)' }}>
            {client.company || `${client.firstName} ${client.lastName}`.trim()}
          </span>
        </div>

        {/* Header client */}
        <Card>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{
              width: 56, height: 56,
              borderRadius: '50%',
              background: 'var(--gold-soft)',
              color: 'var(--gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 600,
              fontFamily: 'var(--font-title)',
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{
                margin: 0, fontSize: 20, fontWeight: 500, color: 'var(--text)',
                fontFamily: 'var(--font-title)', letterSpacing: -0.01,
              }}>
                {client.company || `${client.firstName} ${client.lastName}`.trim()}
              </h2>
              {client.company && (client.firstName || client.lastName) && (
                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-2)' }}>
                  Contact : {`${client.firstName} ${client.lastName}`.trim()}
                </div>
              )}
              <div style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-3)' }}>
                {client.email && <span>✉ {client.email}</span>}
                {client.phone && <span>☎ {client.phone}</span>}
                {client.siret && <span style={{ fontFamily: 'var(--font-mono)' }}>SIRET {client.siret}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <Stat label="CA total" value={fmt(totalRevenue)} accent="var(--gold)" />
              <Stat label="Encaissé" value={fmt(paidRevenue)} accent="var(--success)" />
              <Stat label="Conversion" value={`${conversionRate}%`} />
            </div>
          </div>
        </Card>

        {/* 2 col : projets + side info */}
        <div className="resp-grid-1col" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)',
          gap: 12,
        }}>
          {/* Projets */}
          <Card>
            <SectionTitle
              title="Projets"
              level="h2"
              subtitle={`${projects.length} au total · ${activeProjects.length} actif${activeProjects.length > 1 ? 's' : ''}`}
            />
            {projects.length === 0 ? (
              <EmptyState
                icon="◌"
                title="Aucun projet pour ce client"
                message="Crée un projet et lie-le à ce client pour qu'il apparaisse ici."
              />
            ) : (
              projects
                .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
                .map(p => {
                  const pillarColor = PILLAR_COLOR[p.pillar] || 'var(--text-3)';
                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 0',
                        borderBottom: '1px solid var(--border)',
                        textDecoration: 'none',
                        transition: 'background var(--duration) var(--ease)',
                      }}
                    >
                      <span style={{
                        width: 4, alignSelf: 'stretch',
                        background: pillarColor,
                        borderRadius: 2,
                      }} />
                      <span style={{
                        fontSize: 11, fontFamily: 'var(--font-mono)',
                        color: 'var(--text-3)', minWidth: 70,
                      }}>{p.code}</span>
                      <span style={{
                        flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.name}
                      </span>
                      <Badge tone={STAGE_TONE[p.stage] || 'neutral'} size="sm">
                        {STAGE_LABEL[p.stage] || p.stage}
                      </Badge>
                      <span style={{
                        fontSize: 12, fontFamily: 'var(--font-mono)',
                        color: p.revenue ? 'var(--text)' : 'var(--text-3)',
                        fontWeight: 600, minWidth: 80, textAlign: 'right',
                      }}>
                        {p.revenue ? fmt(p.revenue) : '—'}
                      </span>
                    </Link>
                  );
                })
            )}
          </Card>

          {/* Side info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Adresse */}
            {(client.address || client.city) && (
              <Card>
                <SectionTitle title="Adresse" level="h2" />
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                  {client.address && <div>{client.address}</div>}
                  {(client.postalCode || client.city) && (
                    <div>{client.postalCode} {client.city}</div>
                  )}
                  {client.country && client.country !== 'France' && (
                    <div style={{ color: 'var(--text-3)' }}>{client.country}</div>
                  )}
                </div>
              </Card>
            )}

            {/* TVA */}
            <Card>
              <SectionTitle title="Fiscalité" level="h2" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div style={infoRow}>
                  <span style={{ color: 'var(--text-3)' }}>TVA applicable</span>
                  <span style={{ color: 'var(--text)' }}>
                    {client.tvaApplicable ? `Oui (${client.tvaRate}%)` : 'Non'}
                  </span>
                </div>
                {client.tvaNumber && (
                  <div style={infoRow}>
                    <span style={{ color: 'var(--text-3)' }}>N° TVA intra</span>
                    <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                      {client.tvaNumber}
                    </span>
                  </div>
                )}
                {client.pillar && (
                  <div style={infoRow}>
                    <span style={{ color: 'var(--text-3)' }}>Pilier principal</span>
                    <Badge tone="pillar" pillar={client.pillar === 'AGENCE' ? 'STUDIO' : client.pillar} size="sm">
                      {client.pillar}
                    </Badge>
                  </div>
                )}
              </div>
            </Card>

            {/* Contacts */}
            {Array.isArray(client.contacts) && client.contacts.length > 0 && (
              <Card>
                <SectionTitle
                  title="Contacts"
                  level="h2"
                  subtitle={`${client.contacts.length}`}
                />
                {client.contacts.map(contact => (
                  <div key={contact.id} style={{
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                      {`${contact.firstName} ${contact.lastName}`.trim() || '—'}
                    </div>
                    {contact.role && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                        {contact.role}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {contact.email && <span>✉ {contact.email}</span>}
                      {contact.phone && <span>☎ {contact.phone}</span>}
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* Documents juridiques (NDA + MSA) */}
            <ClientLegalActions client={client} />

            {/* Notes */}
            {client.notes && (
              <Card>
                <SectionTitle title="Notes" level="h2" />
                <div style={{
                  fontSize: 12, color: 'var(--text-2)',
                  lineHeight: 1.6, whiteSpace: 'pre-wrap',
                }}>
                  {client.notes}
                </div>
              </Card>
            )}

            {/* Métadonnées */}
            <Card>
              <SectionTitle title="Métadonnées" level="h2" />
              <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={infoRow}>
                  <span style={{ color: 'var(--text-3)' }}>Créé le</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(client.createdAt)}</span>
                </div>
                <div style={infoRow}>
                  <span style={{ color: 'var(--text-3)' }}>Type</span>
                  <span>{client.typeClient || 'entreprise'}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, accent = 'var(--text)' }) {
  return (
    <div>
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
        color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
        marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: 18, fontWeight: 600, color: accent,
        fontFamily: 'var(--font-mono)', lineHeight: 1,
      }}>{value}</div>
    </div>
  );
}

const pageStyle = {
  padding: 'var(--sp-6)',
  display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
  maxWidth: 'var(--content-max)', margin: '0 auto', width: '100%',
};

const breadcrumbLink = {
  color: 'var(--text-3)', textDecoration: 'none',
  transition: 'color var(--duration) var(--ease)',
};

const infoRow = {
  display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', gap: 8,
};
