'use client';
import { useEffect, useState, use, useCallback, useRef } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Badge, Button, Skeleton, EmptyState,
  SectionTitle, SubLabel, useToast, EditableField, useConfirm,
} from '@/components/ui';
import { PPM_PHASE_KEYS, TASK_PHASE_GROUPS, EXPENSE_CATEGORIES } from '@/lib/constants';
import ExpenseCategoryBreakdown from '@/components/ExpenseCategoryBreakdown';
import { PinButton } from '@/components/PinnedBar';
import EmailComposer from '@/components/EmailComposer';
import DependenciesDiagram from '@/components/DependenciesDiagram';
import ApplyWorkflowModal from '@/components/ApplyWorkflowModal';
import { BRIEF_PPM_KEYS } from '@/components/BriefSections';
import ProjectNav from '@/components/ProjectNav';
import TjmCheckBanner from '@/components/TjmCheckBanner';
import DisciplinesPicker from '@/components/DisciplinesPicker';
import ProjectProgress from '@/components/ProjectProgress';

const STAGES = [
  { key: 'lead',        label: 'Lead',     tone: 'neutral' },
  { key: 'need',        label: 'Besoin',   tone: 'neutral' },
  { key: 'qualify',     label: 'Qualif',   tone: 'info' },
  { key: 'quoted',      label: 'Devis',    tone: 'gold' },
  { key: 'negotiation', label: 'Négo',     tone: 'warning' },
  { key: 'signed',      label: 'Signé',    tone: 'success' },
  { key: 'active',      label: 'Actif',    tone: 'success' },
  { key: 'delivered',   label: 'Livré',    tone: 'pillar' },
  { key: 'paid',        label: 'Payé',     tone: 'success' },
  { key: 'lost',        label: 'Perdu',    tone: 'danger' },
];
const STAGE_BY_KEY = Object.fromEntries(STAGES.map(s => [s.key, s]));

const PILLAR_COLOR = {
  STUDIO: 'var(--pillar-studio)',
  PROD: 'var(--pillar-prod)',
  GRIOTHEQUE: 'var(--pillar-griotheque)',
};

const TASK_STATUS = [
  { key: 'todo',        label: 'À faire',     color: 'var(--text-3)' },
  { key: 'in_progress', label: 'En cours',    color: 'var(--info)' },
  { key: 'review',      label: 'Review',      color: 'var(--warning)' },
  { key: 'done',        label: 'Terminé',     color: 'var(--success)' },
];

const TYPE_ICON = {
  email: '✉', call: '☎', meeting: '⌘', note: '✎',
  milestone: '✦', devis: '📄', paiement: '€',
};

// Brief structure inspirée de Practical Project Management (The Futur / Chris Do).
// 6 sections officielles + 2 champs LES GRIOTS pour le pilotage opérationnel.
// BRIEF_FIELDS / BRIEF_PPM_KEYS / BriefSections sont maintenant dans /components/BriefSections.jsx
// La page d'édition complète vit dans /projects/[id]/brief.

const fmt = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

const relTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export default function ProjectDetailPage({ params }) {
  const { id } = use(params);
  const { toast } = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [ppmLogs, setPpmLogs] = useState([]);
  const [team, setTeam] = useState([]);
  const [providers, setProviders] = useState([]);
  const [generating, setGenerating] = useState(null); // 'devis' | 'bdc' | 'brief' | 'facture' | null
  const [emailOpen, setEmailOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);

  const reload = useCallback(() => {
    return fetch('/api/data')
      .then(r => r.json())
      .then(d => {
        const project = (d.projects || []).find(p => p.id === id);
        if (!project) { setError('PROJECT_NOT_FOUND'); return; }
        const client = (d.clients || []).find(c => c.id === project.clientId);
        setData({ project, client });
        setTasks((project.tasks || []).map(t => ({ ...t,
          phaseGroup: t.phase_group || t.phaseGroup || '',
          assigneeId: t.assignee_id || t.assigneeId,
          assigneeName: t.assignee_name || t.assigneeName,
          dueDate: t.due_date || t.dueDate,
        })));
        setExpenses(project.expenses || []);
        setPpmLogs(project.ppmLogs || project.ppm_logs || []);
        setTeam(d.team || []);
        setProviders(d.providers || []);
      })
      .catch(e => setError(e.message));
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  // ── Save helpers ─────────────────────────────────────
  const saveProjectField = useCallback(async (field, value) => {
    setData(prev => ({ ...prev, project: { ...prev.project, [field]: value } }));
    try {
      const r = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data.project, [field]: value }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success('Sauvegardé');
    } catch (e) {
      toast.error(`Échec : ${e.message}`);
      reload();
    }
  }, [id, data, toast, reload]);

  const saveBriefField = useCallback(async (key, value) => {
    const newBrief = { ...(data?.project?.creativeBrief || {}), [key]: value };
    setData(prev => ({ ...prev, project: { ...prev.project, creativeBrief: newBrief } }));
    try {
      const r = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data.project, creativeBrief: newBrief }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      toast.error(`Brief : ${e.message}`);
      reload();
    }
  }, [id, data, toast, reload]);

  const togglePpmPhase = useCallback(async (phaseKey, currentValue) => {
    const newPhases = { ...(data?.project?.ppmPhases || {}), [phaseKey]: !currentValue };
    setData(prev => ({ ...prev, project: { ...prev.project, ppmPhases: newPhases } }));
    try {
      await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data.project, ppmPhases: newPhases }),
      });
    } catch (e) {
      toast.error(`PPM : ${e.message}`);
      reload();
    }
  }, [id, data, toast, reload]);

  const addPpmLog = useCallback(async (phaseKey, note) => {
    if (!note.trim()) return;
    try {
      const r = await fetch('/api/ppm-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, phaseKey, note, loggedAt: new Date().toISOString().slice(0, 10) }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const log = await r.json();
      setPpmLogs(prev => [log, ...prev]);
      // Auto-valider la phase au premier log
      const isDone = (data?.project?.ppmPhases || {})[phaseKey];
      if (!isDone) await togglePpmPhase(phaseKey, false);
      toast.success(`Log ajouté · ${phaseKey}`);
    } catch (e) {
      toast.error(`Log : ${e.message}`);
    }
  }, [id, data, toast, togglePpmPhase]);

  const updateTask = useCallback(async (taskId, patch) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t));
    try {
      const r = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      toast.error(`Tâche : ${e.message}`);
      reload();
    }
  }, [toast, reload]);

  const createTask = useCallback(async (title, phaseGroup) => {
    if (!title.trim()) return;
    try {
      const r = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: id, title: title.trim(),
          status: 'todo', phaseGroup: phaseGroup || '',
          sortOrder: tasks.length,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { id: newId } = await r.json();
      setTasks(prev => [...prev, { id: newId, title: title.trim(), status: 'todo', phaseGroup: phaseGroup || '' }]);
      toast.success('Tâche ajoutée');
    } catch (e) {
      toast.error(`Tâche : ${e.message}`);
    }
  }, [id, tasks.length, toast]);

  const deleteTask = useCallback(async (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      toast.success('Tâche supprimée');
    } catch (e) {
      toast.error(`Suppression : ${e.message}`);
      reload();
    }
  }, [toast, reload]);

  const createPhase = useCallback(async () => {
    const name = window.prompt('Nom de la nouvelle phase :');
    if (!name || !name.trim()) return;
    // Palette hex volontaire : la couleur est PERSISTÉE en base via l'API (pas un style rendu),
    // les consommateurs (exports PDF, lignes existantes) attendent du hex — ne pas tokeniser.
    const PHASE_COLORS = ['#C46B3D', '#B07A0E', '#2670B4', '#8347A1', '#1E8449', '#C9821C', '#B83328', '#5C5246'];
    const existingCount = (data?.project?.phases || []).length;
    const color = PHASE_COLORS[existingCount % PHASE_COLORS.length];
    try {
      const r = await fetch('/api/phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: id, name: name.trim(), color,
          sortOrder: existingCount,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success(`Phase "${name.trim()}" créée`);
      reload();
    } catch (e) {
      toast.error(`Phase : ${e.message}`);
    }
  }, [id, data, toast, reload]);

  const deletePhase = useCallback(async (phaseId, phaseName) => {
    if (!(await confirm({ title: `Supprimer la phase "${phaseName}" ?`, message: 'Les tâches associées restent (sans phase).', confirmLabel: 'Supprimer' }))) return;
    try {
      const r = await fetch(`/api/phases/${phaseId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success('Phase supprimée');
      reload();
    } catch (e) {
      toast.error(`Suppression : ${e.message}`);
    }
  }, [toast, reload, confirm]);

  // ── Expenses CRUD ──
  const createExpense = useCallback(async ({ label, amountHT, category, status, date }) => {
    if (!label || !label.trim()) return;
    const ht = parseFloat(amountHT) || 0;
    const tvaRate = String(data?.project?.tvaRate || '20');
    const rate = parseFloat(tvaRate) / 100 || 0;
    const tvaAmount = ht * rate;
    const amountTtc = ht * (1 + rate);
    const expenseId = 'exp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    try {
      const r = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: expenseId,
          projectId: data.project.id,
          label: label.trim(),
          amountHT: ht, tvaRate, tvaAmount, amount: amountTtc,
          category: category || '',
          status: status || 'pending',
          date: date || new Date().toISOString().slice(0, 10),
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      toast.success('Dépense ajoutée');
      reload();
    } catch (e) {
      toast.error(`Dépense : ${e.message}`);
    }
  }, [data, toast, reload]);

  const updateExpense = useCallback(async (expenseId, patch) => {
    setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, ...patch } : e));
    try {
      // Si amountHT change, recalculer TTC
      let body = { ...patch };
      if (patch.amountHT !== undefined) {
        const current = expenses.find(e => e.id === expenseId);
        const rate = parseFloat(current?.tva_rate || '20') / 100 || 0;
        const amountHT = parseFloat(patch.amountHT) || 0;
        body.amountHT = amountHT;
        body.tvaAmount = amountHT * rate;
        body.amount = amountHT * (1 + rate);
      }
      const r = await fetch(`/api/expenses/${expenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // Recharger pour rafraîchir les totaux et le amount_ttc calculé
      if (patch.amountHT !== undefined || patch.status !== undefined) {
        reload();
      }
    } catch (e) {
      toast.error(`Dépense : ${e.message}`);
      reload();
    }
  }, [expenses, toast, reload]);

  const deleteExpense = useCallback(async (expenseId) => {
    setExpenses(prev => prev.filter(e => e.id !== expenseId));
    try {
      const r = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success('Dépense supprimée');
    } catch (e) {
      toast.error(`Suppression : ${e.message}`);
      reload();
    }
  }, [toast, reload]);

  const renamePhase = useCallback(async (phaseId, oldName, newName) => {
    if (!newName || newName === oldName) return;
    try {
      const r = await fetch(`/api/phases/${phaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // Optionnel : on pourrait propager le rename sur les tasks dont phase_group = oldName
      // mais on laisse le décalage tant que l'utilisateur ne fait pas un re-assign
      toast.success('Phase renommée');
      reload();
    } catch (e) {
      toast.error(`Rename : ${e.message}`);
    }
  }, [toast, reload]);

  const generateDevis = useCallback(async () => {
    setGenerating('devis');
    try {
      const r = await fetch(`/api/projects/${id}/devis`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Devis-${data?.project?.code || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Devis généré');
    } catch (e) {
      toast.error(`Devis : ${e.message}`);
    } finally {
      setGenerating(null);
    }
  }, [id, data, toast]);

  const generateFacture = useCallback(async () => {
    setGenerating('facture');
    try {
      const r = await fetch(`/api/projects/${id}/facture`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Facture-${data?.project?.code || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Facture générée');
    } catch (e) {
      toast.error(`Facture : ${e.message}`);
    } finally {
      setGenerating(null);
    }
  }, [id, data, toast]);

  const addJournalEntry = useCallback(async ({ type, content, date }) => {
    if (!content || !content.trim()) return;
    try {
      const r = await fetch(`/api/projects/${id}/journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: type || 'note',
          content: content.trim(),
          date: date || new Date().toISOString().slice(0, 10),
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      const { entry } = await r.json();
      // Optimistic update : prepend the new entry
      setData(prev => ({
        ...prev,
        project: {
          ...prev.project,
          projectJournal: [entry, ...(prev.project.projectJournal || [])],
        },
      }));
      toast.success('Entrée ajoutée');
      return true;
    } catch (e) {
      toast.error(`Entrée : ${e.message}`);
      return false;
    }
  }, [id, toast]);

  const deleteJournalEntry = useCallback(async (entryId) => {
    if (!entryId) return;
    if (!(await confirm({ title: 'Supprimer cette entrée du journal ?', confirmLabel: 'Supprimer' }))) return;
    // Optimistic
    setData(prev => ({
      ...prev,
      project: {
        ...prev.project,
        projectJournal: (prev.project.projectJournal || []).filter(e => e.id !== entryId),
      },
    }));
    try {
      const r = await fetch(`/api/projects/${id}/journal?entryId=${encodeURIComponent(entryId)}`, {
        method: 'DELETE',
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      toast.success('Entrée supprimée');
    } catch (e) {
      toast.error(`Suppression : ${e.message}`);
      reload();
    }
  }, [id, toast, reload, confirm]);

  const generateBrief = useCallback(async () => {
    setGenerating('brief');
    try {
      const r = await fetch(`/api/projects/${id}/brief`);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Brief-${data?.project?.code || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Brief généré');
    } catch (e) {
      toast.error(`Brief : ${e.message}`);
    } finally {
      setGenerating(null);
    }
  }, [id, data, toast]);

  const generateBrandStrategy = useCallback(async () => {
    setGenerating('brand-strategy');
    try {
      const r = await fetch(`/api/projects/${id}/brand-strategy`);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BrandStrategy-${data?.project?.code || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Brand Strategy générée');
    } catch (e) {
      toast.error(`Brand Strategy : ${e.message}`);
    } finally {
      setGenerating(null);
    }
  }, [id, data, toast]);

  const generateProposal = useCallback(async () => {
    setGenerating('proposal');
    try {
      const r = await fetch(`/api/projects/${id}/proposal`);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Proposal-${data?.project?.code || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Proposal générée');
    } catch (e) {
      toast.error(`Proposal : ${e.message}`);
    } finally {
      setGenerating(null);
    }
  }, [id, data, toast]);

  const generateAar = useCallback(async () => {
    setGenerating('aar');
    try {
      const r = await fetch(`/api/projects/${id}/aar`);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AAR-${data?.project?.code || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('AAR généré');
    } catch (e) {
      toast.error(`AAR : ${e.message}`);
    } finally {
      setGenerating(null);
    }
  }, [id, data, toast]);

  const generateMediaRelease = useCallback(async () => {
    setGenerating('media-release');
    try {
      const r = await fetch(`/api/projects/${id}/media-release`);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CessionImage-${data?.project?.code || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Cession droit à l\'image générée');
    } catch (e) {
      toast.error(`Cession : ${e.message}`);
    } finally {
      setGenerating(null);
    }
  }, [id, data, toast]);

  // ── Render states ────────────────────────────────────
  if (error === 'PROJECT_NOT_FOUND') {
    return (
      <>
        <TopBar title="Projet introuvable" />
        <div style={pageStyle}>
          <EmptyState
            icon="✕"
            title="Ce projet n'existe pas"
            message="Il a peut-être été supprimé ou l'identifiant est incorrect."
            action={<Button variant="primary" href="/pipeline">← Retour au pipeline</Button>}
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
              <Button variant="danger" size="sm" onClick={() => { setError(null); reload(); }}>Réessayer</Button>
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
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} style={{ minHeight: 100 }}>
              <Skeleton width="20%" height={14} />
              <Skeleton height={48} style={{ marginTop: 12 }} />
            </Card>
          ))}
        </div>
      </>
    );
  }

  const { project, client } = data;
  const pillarColor = PILLAR_COLOR[project.pillar] || 'var(--text-3)';
  const journal = Array.isArray(project.projectJournal) ? project.projectJournal : [];
  const tasksOpen = tasks.filter(t => t.status !== 'done');
  const tasksDone = tasks.filter(t => t.status === 'done');
  const expensesPaid = expenses.filter(e => e.status === 'paid');
  const expensesTotal = expenses.reduce((s, e) => s + (Number(e.amount_ttc) || 0), 0);
  const expensesPaidTotal = expensesPaid.reduce((s, e) => s + (Number(e.amount_ttc) || 0), 0);
  const margin = project.revenue && expensesTotal
    ? Math.round(((project.revenue - expensesTotal) / project.revenue) * 100)
    : null;

  // Groupes de tâches : priorité aux production_phases du projet, fallback sur TASK_PHASE_GROUPS du template
  const productionPhases = Array.isArray(project.phases) ? project.phases : [];
  const sortedProductionPhases = [...productionPhases].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const templateGroups = project.template && TASK_PHASE_GROUPS[project.template] || [];
  const phaseGroups = sortedProductionPhases.length > 0
    ? sortedProductionPhases.map(p => ({ id: p.id, label: p.name, color: p.color }))
    : templateGroups;
  const tasksByGroup = (() => {
    const groups = {};
    for (const pg of phaseGroups) groups[pg.label] = [];
    groups['__autres__'] = [];
    for (const t of tasks) {
      if (t.phaseGroup && groups[t.phaseGroup]) groups[t.phaseGroup].push(t);
      else groups['__autres__'].push(t);
    }
    return groups;
  })();

  const ppmDone = PPM_PHASE_KEYS.filter(p => (project.ppmPhases || {})[p.key]).length;

  return (
    <>
      <TopBar title={project.name} subtitle={project.code} />
      <div style={pageStyle} className="lg-anim-fade">

        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link href="/pipeline" style={breadcrumbLink}>← Pipeline</Link>
            <span style={{ color: 'var(--text-3)' }}>/</span>
            <Link href="/projects" style={breadcrumbLink}>Projets</Link>
            <span style={{ color: 'var(--text-3)' }}>/</span>
            <span style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{project.code}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PinButton projectId={id} size="sm" />
            <Link href="/legacy" style={{
              ...breadcrumbLink,
              color: 'var(--text-3)',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
            }} title="Ouvrir l'ancienne interface complète">
              Vue legacy ↗
            </Link>
          </div>
        </div>

        {/* Navigation projet */}
        <ProjectNav projectId={id} active="overview" />

        {/* Alerte TJM si projet sous-tarifé */}
        <TjmCheckBanner
          revenue={project.revenue}
          hoursSpent={project.hoursSpent}
        />

        {/* Header projet */}
        <Card variant="pillar" pillarColor={pillarColor}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <Badge tone="pillar" pillar={project.pillar} size="md">{project.pillar}</Badge>
                <Badge tone={STAGE_BY_KEY[project.stage]?.tone || 'neutral'} size="md">
                  {STAGE_BY_KEY[project.stage]?.label || project.stage}
                </Badge>
                {project.template && (
                  <Badge tone="neutral" size="md" mono>{project.template}</Badge>
                )}
              </div>
              <EditableField
                value={project.name}
                onSave={(v) => saveProjectField('name', v)}
                placeholder="Nom du projet"
                inputStyle={{
                  fontSize: 22, fontWeight: 500,
                  fontFamily: 'var(--font-title)', letterSpacing: -0.01,
                  padding: '4px 8px',
                }}
              />
              {client && (
                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-2)' }}>
                  {client.company || `${client.firstName} ${client.lastName}`.trim()}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Stat label="Revenue" value={fmt(project.revenue)} accent={pillarColor} />
              <Stat label="Budget" value={fmt(project.budget)} />
              <Stat label="Dépensé" value={fmt(expensesTotal)} accent={expensesTotal > project.budget ? 'var(--danger)' : 'var(--text)'} />
              {margin !== null && (
                <Stat label="Marge" value={`${margin}%`} accent={margin > 30 ? 'var(--success)' : margin > 0 ? 'var(--warning)' : 'var(--danger)'} />
              )}
            </div>
          </div>

          {/* Barre de progression projet */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <ProjectProgress
              phases={productionPhases}
              tasks={tasks}
            />
          </div>

          {/* Stage selector */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <SubLabel>Changer le stage</SubLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STAGES.map(s => (
                <button
                  key={s.key}
                  onClick={() => saveProjectField('stage', s.key)}
                  disabled={project.stage === s.key}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid ' + (project.stage === s.key ? 'var(--gold)' : 'var(--border)'),
                    background: project.stage === s.key ? 'var(--gold-soft)' : 'transparent',
                    color: project.stage === s.key ? 'var(--gold-deep)' : 'var(--text-2)',
                    fontSize: 11, fontFamily: 'var(--font-sans)',
                    cursor: project.stage === s.key ? 'default' : 'pointer',
                    fontWeight: project.stage === s.key ? 500 : 400,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Actions : Génération PDF */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                Documents
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Générer devis ou facture à partir du projet et de ses dépenses
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setEmailOpen(true)}
              >
                ✉ Email
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={generateBrief}
                disabled={generating === 'brief'}
              >
                {generating === 'brief' ? 'Génération…' : '📋 Brief'}
              </Button>
              {project.pillar === 'PROD' && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={generateMediaRelease}
                  disabled={generating === 'media-release'}
                  title="Cession droit à l'image — à faire signer par chaque personne filmée"
                >
                  {generating === 'media-release' ? 'Génération…' : '🎥 Cession image'}
                </Button>
              )}
              {['delivered', 'paid'].includes(project.stage) && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={generateAar}
                  disabled={generating === 'aar'}
                  title="After Action Review — rétrospective post-projet"
                >
                  {generating === 'aar' ? 'Génération…' : '🔍 AAR'}
                </Button>
              )}
              {project.pillar === 'STUDIO' && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={generateBrandStrategy}
                  disabled={generating === 'brand-strategy'}
                  title="Brand Strategy Workbook (méthode The Futur)"
                >
                  {generating === 'brand-strategy' ? 'Génération…' : '🧬 Brand Strategy'}
                </Button>
              )}
              <Button
                variant="secondary"
                size="md"
                onClick={generateProposal}
                disabled={generating === 'proposal'}
                title="Proposal multi-niveaux (Good/Better/Best) — pour les gros deals"
              >
                {generating === 'proposal' ? 'Génération…' : '📑 Proposal'}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={generateDevis}
                disabled={generating === 'devis'}
              >
                {generating === 'devis' ? 'Génération…' : '📄 Devis'}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={generateFacture}
                disabled={generating === 'facture'}
              >
                {generating === 'facture' ? 'Génération…' : '💰 Facture'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Champs éditables — Dates, budget, hours, payment */}
        <Card>
          <SectionTitle title="Détails projet" level="h2" />

          {/* Disciplines créatives — Image / Stories / Movement */}
          <div style={{ marginBottom: 18 }}>
            <div style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-3)',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Disciplines créatives
            </div>
            <DisciplinesPicker
              value={project.disciplines || []}
              onChange={(v) => saveProjectField('disciplines', v)}
            />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
          }}>
            <EditableField
              label="Revenue (HT €)"
              value={project.revenue || ''}
              type="number"
              onSave={(v) => saveProjectField('revenue', parseFloat(v) || 0)}
              placeholder="0"
            />
            <EditableField
              label="Budget (HT €)"
              value={project.budget || ''}
              type="number"
              onSave={(v) => saveProjectField('budget', parseFloat(v) || 0)}
              placeholder="0"
            />
            <EditableField
              label="Date début"
              value={project.startDate || ''}
              type="date"
              onSave={(v) => saveProjectField('startDate', v)}
            />
            <EditableField
              label="Date fin"
              value={project.endDate || ''}
              type="date"
              onSave={(v) => saveProjectField('endDate', v)}
            />
            <EditableField
              label="Heures passées"
              value={project.hoursSpent || ''}
              type="number"
              onSave={(v) => saveProjectField('hoursSpent', parseFloat(v) || 0)}
              placeholder="0"
            />
            <EditableField
              label="TVA (%)"
              value={project.tvaRate || '20'}
              type="number"
              onSave={(v) => saveProjectField('tvaRate', v)}
            />
            <EditableField
              label="Modalités paiement"
              value={project.paymentTerms || ''}
              onSave={(v) => saveProjectField('paymentTerms', v)}
              placeholder="Ex : 30 jours fin de mois"
              containerStyle={{ gridColumn: 'span 2' }}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <EditableField
              label="Notes"
              value={project.notes || ''}
              type="textarea"
              rows={3}
              onSave={(v) => saveProjectField('notes', v)}
              placeholder="Notes libres sur le projet…"
            />
          </div>
        </Card>

        {/* Creative Brief — lien vers la page dédiée */}
        <BriefCardLink
          projectId={id}
          brief={project.creativeBrief || {}}
          onGenerate={generateBrief}
          generating={generating === 'brief'}
        />

        {/* PPM Phases */}
        <Card>
          <SectionTitle
            title="PPM Phases"
            level="h2"
            subtitle={`${ppmDone}/${PPM_PHASE_KEYS.length} validées`}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PPM_PHASE_KEYS.map(phase => {
              const done = (project.ppmPhases || {})[phase.key];
              const logs = ppmLogs.filter(l => l.phaseKey === phase.key);
              return (
                <PpmPhaseRow
                  key={phase.key}
                  phase={phase}
                  done={!!done}
                  logs={logs}
                  onToggle={() => togglePpmPhase(phase.key, done)}
                  onAddLog={(note) => addPpmLog(phase.key, note)}
                />
              );
            })}
          </div>
        </Card>

        {/* Tâches groupées par phase */}
        <Card id="tasks">
          <SectionTitle
            title="Tâches"
            level="h2"
            subtitle={`${tasksOpen.length} ouverte${tasksOpen.length > 1 ? 's' : ''} / ${tasks.length} · ${productionPhases.length} phase${productionPhases.length > 1 ? 's' : ''}`}
            right={
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="sm" variant="ghost" onClick={createPhase}>
                  + Phase
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setWorkflowOpen(true)}>
                  ⚡ Appliquer un workflow
                </Button>
              </div>
            }
          />
          {phaseGroups.length > 0 ? (
            phaseGroups.map(pg => (
              <TaskGroup
                key={pg.label}
                group={pg}
                tasks={tasksByGroup[pg.label] || []}
                allTasks={tasks}
                team={team}
                providers={providers}
                onUpdate={updateTask}
                onCreate={(title) => createTask(title, pg.label)}
                onDelete={deleteTask}
                onRenamePhase={renamePhase}
                onDeletePhase={deletePhase}
              />
            ))
          ) : null}
          {(tasksByGroup['__autres__'] || []).length > 0 && (
            <TaskGroup
              group={{ label: phaseGroups.length > 0 ? 'Autres' : 'Tâches', color: 'var(--text-3)' }}
              tasks={tasksByGroup['__autres__']}
              allTasks={tasks}
              team={team}
              providers={providers}
              onUpdate={updateTask}
              onCreate={(title) => createTask(title, '')}
              onDelete={deleteTask}
            />
          )}
          {phaseGroups.length === 0 && (!tasksByGroup['__autres__'] || tasksByGroup['__autres__'].length === 0) && (
            <NewTaskInput onCreate={(title) => createTask(title, '')} />
          )}
        </Card>

        {/* Dependencies diagram — visualisation PPM/The Futur */}
        {tasks.length > 0 && (
          <Card>
            <SectionTitle
              title="Flow des dépendances"
              level="h2"
              subtitle="Waterfall · Parallel"
              right={
                <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  PPM · Practical Project Management
                </span>
              }
            />
            <DependenciesDiagram tasks={tasks} />
          </Card>
        )}

        {/* Dépenses */}
        <div id="expenses">
          <ExpensesPanel
            expenses={expenses}
            totalPaid={expensesPaidTotal}
            totalAll={expensesTotal}
            onCreate={createExpense}
            onUpdate={updateExpense}
            onDelete={deleteExpense}
          />
        </div>

        {/* Email Composer modal */}
        <EmailComposer
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          project={project}
          client={client}
        />

        {/* Apply Workflow modal */}
        <ApplyWorkflowModal
          open={workflowOpen}
          onClose={() => setWorkflowOpen(false)}
          project={project}
          onApplied={reload}
        />

        {/* Journal */}
        <JournalSection
          journal={journal}
          onAdd={addJournalEntry}
          onDelete={deleteJournalEntry}
        />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// PpmPhaseRow
// ─────────────────────────────────────────────────────────
function PpmPhaseRow({ phase, done, logs, onToggle, onAddLog }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  const submit = () => {
    if (!note.trim()) return;
    onAddLog(note);
    setNote('');
  };

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--surface)',
      transition: 'all var(--duration) var(--ease)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', cursor: 'pointer',
      }} onClick={() => setOpen(o => !o)}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{
            width: 20, height: 20, borderRadius: 4,
            border: '1.5px solid ' + (done ? 'var(--success)' : 'var(--border-2)'),
            background: done ? 'var(--success)' : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--on-solid)', fontSize: 12, flexShrink: 0,
          }}
          title={done ? 'Valider la phase' : 'Marquer comme faite'}
        >
          {done ? '✓' : ''}
        </button>
        <span style={{
          flex: 1, fontSize: 13, fontWeight: 500,
          color: done ? 'var(--text-3)' : 'var(--text)',
          textDecoration: done ? 'line-through' : 'none',
        }}>
          {phase.label}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          {logs.length} log{logs.length > 1 ? 's' : ''}
        </span>
        <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
          {open ? '▾' : '▸'}
        </span>
      </div>
      {open && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: 12, background: 'var(--surface-2)',
        }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="Ajouter un log à cette phase…"
              style={{
                flex: 1, padding: '6px 10px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 12,
                outline: 'none', fontFamily: 'var(--font-sans)',
              }}
            />
            <Button size="sm" variant="primary" onClick={submit}>Logger</Button>
          </div>
          {logs.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
              Aucun log pour cette phase
            </div>
          ) : (
            logs.map(l => (
              <div key={l.id} style={{
                display: 'flex', gap: 10, padding: '6px 0',
                borderTop: '1px solid var(--border)', fontSize: 12,
              }}>
                <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', minWidth: 80 }}>
                  {l.loggedAt}
                </span>
                <span style={{ flex: 1, color: 'var(--text)' }}>{l.note || '—'}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// TaskGroup — section avec ses tâches
// ─────────────────────────────────────────────────────────
function TaskGroup({ group, tasks, allTasks = [], team, providers, onUpdate, onCreate, onDelete, onRenamePhase, onDeletePhase }) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.label);
  const sorted = [...tasks].sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (b.status === 'done' && a.status !== 'done') return -1;
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });

  const canEditPhase = !!group.id && typeof onRenamePhase === 'function';

  const commitRename = () => {
    if (nameDraft.trim() && nameDraft !== group.label) {
      onRenamePhase(group.id, group.label, nameDraft.trim());
    }
    setEditing(false);
  };

  return (
    <div
      style={{ marginBottom: 16 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
        paddingBottom: 6, borderBottom: `2px solid ${group.color || 'var(--border)'}`,
      }}>
        {editing && canEditPhase ? (
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setNameDraft(group.label); setEditing(false); }
            }}
            autoFocus
            style={{
              flex: 1, padding: '2px 6px',
              background: 'var(--surface-2)',
              border: `1px solid ${group.color || 'var(--gold)'}`,
              borderRadius: 'var(--radius-sm)',
              color: group.color || 'var(--text)',
              fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.6,
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
        ) : (
          <button
            onClick={() => { if (canEditPhase) { setNameDraft(group.label); setEditing(true); } }}
            style={{
              background: 'transparent', border: 'none', padding: 0,
              cursor: canEditPhase ? 'pointer' : 'default',
              fontSize: 11, fontWeight: 600, color: group.color || 'var(--text)',
              textTransform: 'uppercase', letterSpacing: 0.6,
              fontFamily: 'var(--font-mono)',
            }}
            title={canEditPhase ? 'Cliquer pour renommer' : ''}
          >
            {group.label}
          </button>
        )}
        <span style={{
          fontSize: 10, padding: '1px 6px', borderRadius: 999,
          background: 'var(--surface-2)', color: 'var(--text-3)',
          fontFamily: 'var(--font-mono)',
        }}>
          {tasks.length}
        </span>

        <div style={{ flex: 1 }} />

        {canEditPhase && hover && !editing && (
          <button
            onClick={() => onDeletePhase(group.id, group.label)}
            title="Supprimer cette phase (les tâches restent)"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-3)', fontSize: 13, lineHeight: 1, padding: '2px 4px',
              borderRadius: 4,
              transition: 'color var(--duration) var(--ease), background var(--duration) var(--ease)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-soft)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
          >×</button>
        )}
      </div>
      {sorted.map(t => (
        <TaskRow
          key={t.id}
          task={t}
          team={team}
          providers={providers}
          allTasks={allTasks}
          onUpdate={(patch) => onUpdate(t.id, patch)}
          onDelete={() => onDelete(t.id)}
        />
      ))}
      <NewTaskInput onCreate={onCreate} />
    </div>
  );
}

function TaskRow({ task, team, providers, allTasks = [], onUpdate, onDelete }) {
  const [hover, setHover] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [depsOpen, setDepsOpen] = useState(false);
  const statusCfg = TASK_STATUS.find(s => s.key === task.status) || TASK_STATUS[0];
  const complexity = task.complexity || 'simple';
  const isComplex = complexity === 'complex';
  const deps = Array.isArray(task.dependsOn) ? task.dependsOn : [];
  const blockingTasks = deps
    .map(id => allTasks.find(t => t.id === id))
    .filter(t => t && t.status !== 'done');
  const isBlocked = blockingTasks.length > 0 && task.status !== 'done';

  const nextStatus = () => {
    const idx = TASK_STATUS.findIndex(s => s.key === task.status);
    const next = TASK_STATUS[(idx + 1) % TASK_STATUS.length];
    onUpdate({ status: next.key });
  };

  const toggleComplexity = () => {
    onUpdate({ complexity: isComplex ? 'simple' : 'complex' });
  };

  const toggleDep = (depId) => {
    const newDeps = deps.includes(depId)
      ? deps.filter(d => d !== depId)
      : [...deps, depId];
    onUpdate({ dependsOn: newDeps });
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 0', borderBottom: '1px solid var(--border)',
        fontSize: 12,
        opacity: isBlocked ? 0.65 : 1,
      }}
    >
      <button
        onClick={nextStatus}
        title={`Statut : ${statusCfg.label} (clic pour avancer)`}
        style={{
          width: 16, height: 16, borderRadius: 8,
          border: '1.5px solid ' + statusCfg.color,
          background: task.status === 'done' ? statusCfg.color : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--on-solid)', fontSize: 9, flexShrink: 0,
        }}
      >
        {task.status === 'done' ? '✓' : ''}
      </button>
      <input
        type="text"
        value={task.title || ''}
        onChange={(e) => onUpdate({ title: e.target.value })}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: task.status === 'done' ? 'var(--text-3)' : 'var(--text)',
          textDecoration: task.status === 'done' ? 'line-through' : 'none',
          fontSize: 12, fontFamily: 'var(--font-sans)',
          padding: '2px 0',
        }}
      />

      {/* Bloquée par */}
      {isBlocked && (
        <span
          title={`Bloquée par : ${blockingTasks.map(t => t.title).join(', ')}`}
          style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 999,
            background: 'var(--warning-soft)', color: 'var(--warning)',
            fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
          }}
        >
          ⏸ bloquée
        </span>
      )}

      {/* Complexity toggle */}
      <button
        onClick={toggleComplexity}
        title={isComplex
          ? 'Tâche complexe : focus dédié recommandé'
          : 'Tâche simple : rapide, à grouper avec d\'autres simples'}
        style={{
          fontSize: 10, padding: '2px 7px', borderRadius: 999,
          background: isComplex ? 'var(--danger-soft)' : 'var(--success-soft)',
          color: isComplex ? 'var(--danger)' : 'var(--success)',
          border: '1px solid ' + (isComplex ? 'var(--danger)' : 'var(--success)'),
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
          fontWeight: 500, whiteSpace: 'nowrap',
        }}
      >
        {isComplex ? '◆ Complex' : '● Simple'}
      </button>

      {/* Heures estimées */}
      <input
        type="number"
        step="0.5"
        min="0"
        value={task.estimatedHours ?? ''}
        onChange={(e) => onUpdate({ estimatedHours: e.target.value })}
        placeholder="h"
        title="Heures estimées"
        style={{
          width: 44, padding: '2px 4px',
          background: 'transparent',
          border: '1px solid transparent',
          color: task.estimatedHours ? 'var(--text-2)' : 'var(--text-3)',
          fontSize: 10, fontFamily: 'var(--font-mono)',
          outline: 'none', borderRadius: 4, textAlign: 'right',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
      />

      {/* Picker dépendances */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setDepsOpen(o => !o)}
          title={deps.length ? `${deps.length} dépendance${deps.length > 1 ? 's' : ''}` : 'Ajouter une dépendance'}
          style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 999,
            background: deps.length ? 'var(--info-soft)' : 'transparent',
            color: deps.length ? 'var(--info)' : 'var(--text-3)',
            border: '1px solid ' + (deps.length ? 'var(--info)' : 'var(--border)'),
            cursor: 'pointer', fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
          }}
        >
          ⇠ {deps.length || '0'}
        </button>
        {depsOpen && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
            zIndex: 10, minWidth: 260, maxHeight: 280, overflowY: 'auto',
            padding: 4,
          }}>
            <div style={dropdownLabel}>Doit finir avant cette tâche</div>
            {allTasks.filter(t => t.id !== task.id).length === 0 ? (
              <div style={{ padding: 8, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
                Pas d'autre tâche dans ce projet
              </div>
            ) : (
              allTasks.filter(t => t.id !== task.id).map(t => {
                const selected = deps.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleDep(t.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 8px', background: selected ? 'var(--info-soft)' : 'transparent',
                      border: 'none', borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer', textAlign: 'left',
                      fontSize: 11, color: 'var(--text)',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <span style={{
                      width: 10, height: 10, borderRadius: 2,
                      border: '1.5px solid ' + (selected ? 'var(--info)' : 'var(--border-2)'),
                      background: selected ? 'var(--info)' : 'transparent',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--on-solid)', fontSize: 8, flexShrink: 0,
                    }}>{selected ? '✓' : ''}</span>
                    <span style={{
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textDecoration: t.status === 'done' ? 'line-through' : 'none',
                      color: t.status === 'done' ? 'var(--text-3)' : 'var(--text)',
                    }}>{t.title}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setAssignOpen(o => !o)}
          style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 999,
            background: task.assigneeName ? 'var(--gold-soft)' : 'var(--surface-2)',
            color: task.assigneeName ? 'var(--gold-deep)' : 'var(--text-3)',
            border: '1px solid ' + (task.assigneeName ? 'var(--gold)' : 'var(--border)'),
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {task.assigneeName || '+ assigner'}
        </button>
        {assignOpen && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
            zIndex: 10, minWidth: 200, maxHeight: 280, overflowY: 'auto',
          }}>
            <button
              onClick={() => { onUpdate({ assigneeId: null, assigneeName: '' }); setAssignOpen(false); }}
              style={dropdownItem}
            >
              <span style={{ color: 'var(--text-3)' }}>— Personne —</span>
            </button>
            {team.length > 0 && (
              <>
                <div style={dropdownLabel}>Équipe</div>
                {team.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { onUpdate({ assigneeId: m.id, assigneeName: m.name }); setAssignOpen(false); }}
                    style={dropdownItem}
                  >
                    {m.name}
                  </button>
                ))}
              </>
            )}
            {providers.length > 0 && (
              <>
                <div style={dropdownLabel}>Prestataires</div>
                {providers.map(p => {
                  const name = `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.name;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { onUpdate({ assigneeId: p.id, assigneeName: name }); setAssignOpen(false); }}
                      style={dropdownItem}
                    >
                      {name}
                      <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-3)' }}>{p.category}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
      <input
        type="date"
        value={task.dueDate || ''}
        onChange={(e) => onUpdate({ dueDate: e.target.value })}
        style={{
          fontSize: 11, padding: '2px 4px',
          background: 'transparent', border: '1px solid transparent',
          color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
          outline: 'none', borderRadius: 4, width: 100,
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
      />
      {hover && (
        <button
          onClick={onDelete}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', fontSize: 14, padding: 2, lineHeight: 1,
          }}
          title="Supprimer la tâche"
        >
          ×
        </button>
      )}
    </div>
  );
}

function NewTaskInput({ onCreate }) {
  const [value, setValue] = useState('');
  const submit = () => {
    if (!value.trim()) return;
    onCreate(value);
    setValue('');
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
      <span style={{ color: 'var(--text-3)', fontSize: 14, width: 16, textAlign: 'center' }}>+</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder="Ajouter une tâche…"
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-sans)',
          padding: '2px 0',
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// BriefCardLink — résumé brief + lien vers la page dédiée /projects/[id]/brief
// ─────────────────────────────────────────────────────────
function BriefCardLink({ projectId, brief = {}, onGenerate, generating }) {
  const ppmFilled = BRIEF_PPM_KEYS.filter(k => (brief[k] || '').trim()).length;
  const ppmTotal = BRIEF_PPM_KEYS.length;
  const pctFilled = Math.round((ppmFilled / ppmTotal) * 100);

  return (
    <Card>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
            <h3 style={{
              margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text)',
              fontFamily: 'var(--font-title)', letterSpacing: 0.3,
            }}>Creative brief</h3>
            <span style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
            }}>
              {ppmFilled}/{ppmTotal} sections PPM
            </span>
          </div>
          <div style={{
            height: 3, width: '100%', maxWidth: 320,
            background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${pctFilled}%`,
              background: pctFilled === 100 ? 'var(--success)' : 'var(--gold)',
              transition: 'width var(--duration-slow) var(--ease-out)',
            }} />
          </div>
          <div style={{
            fontSize: 12, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.5,
          }}>
            {ppmFilled === 0
              ? 'Pas encore renseigné — démarre par GOAL et OVERVIEW.'
              : pctFilled === 100
                ? 'Brief complet sur les 6 sections PPM, prêt à exporter.'
                : `${ppmTotal - ppmFilled} section${ppmTotal - ppmFilled > 1 ? 's' : ''} restante${ppmTotal - ppmFilled > 1 ? 's' : ''} à remplir.`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onGenerate}
            disabled={generating || ppmFilled === 0}
          >
            {generating ? 'Génération…' : '📋 PDF'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            href={`/projects/${projectId}/brief`}
          >
            Ouvrir le brief →
          </Button>
        </div>
      </div>
    </Card>
  );
}

// (legacy) BriefSectionsBlock + BriefSection inline — déplacés vers /components/BriefSections.jsx
// La page d'édition complète vit dans /projects/[id]/brief.

// ─────────────────────────────────────────────────────────
// JournalSection — Card Journal avec form d'ajout inline
// ─────────────────────────────────────────────────────────
const JOURNAL_TYPES = [
  { key: 'note',      label: 'Note',     icon: '✎' },
  { key: 'email',     label: 'Email',    icon: '✉' },
  { key: 'call',      label: 'Appel',    icon: '☎' },
  { key: 'meeting',   label: 'Meeting',  icon: '⌘' },
  { key: 'milestone', label: 'Milestone', icon: '✦' },
  { key: 'devis',     label: 'Devis',    icon: '📄' },
  { key: 'paiement',  label: 'Paiement', icon: '€' },
];

function JournalSection({ journal, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    type: 'note',
    content: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!draft.content.trim() || submitting) return;
    setSubmitting(true);
    const ok = await onAdd(draft);
    setSubmitting(false);
    if (ok !== false) {
      setDraft({ type: 'note', content: '', date: new Date().toISOString().slice(0, 10) });
      setAdding(false);
    }
  };

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      setAdding(false);
      setDraft({ type: 'note', content: '', date: new Date().toISOString().slice(0, 10) });
    }
  };

  return (
    <Card id="journal">
      <SectionTitle
        title="Journal"
        level="h2"
        subtitle={`${journal.length} entrée${journal.length > 1 ? 's' : ''}`}
        right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              ⌘J
            </span>
            {!adding && (
              <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
                + Entrée
              </Button>
            )}
          </div>
        }
      />

      {/* Formulaire d'ajout inline */}
      {adding && (
        <div style={{
          padding: 12, marginBottom: 16,
          background: 'var(--surface-2)',
          border: '1px solid var(--gold)',
          borderRadius: 'var(--radius-md)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* Picker type + date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
              {JOURNAL_TYPES.map(t => (
                <button
                  key={t.key}
                  onClick={() => setDraft(d => ({ ...d, type: t.key }))}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                    fontSize: 11,
                    fontWeight: draft.type === t.key ? 500 : 400,
                    background: draft.type === t.key ? 'var(--gold-soft)' : 'var(--surface)',
                    color: draft.type === t.key ? 'var(--gold-deep)' : 'var(--text-2)',
                    border: '1px solid ' + (draft.type === t.key ? 'var(--gold)' : 'var(--border)'),
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    transition: 'all var(--duration) var(--ease)',
                  }}
                >
                  <span style={{ fontSize: 12 }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft(d => ({ ...d, date: e.target.value }))}
              style={{
                padding: '4px 8px', fontSize: 11,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-2)',
                fontFamily: 'var(--font-mono)', outline: 'none',
              }}
            />
          </div>

          {/* Textarea contenu */}
          <textarea
            value={draft.content}
            onChange={(e) => setDraft(d => ({ ...d, content: e.target.value }))}
            onKeyDown={onKeyDown}
            placeholder="Ce qui s'est passé, à retenir, à suivre…"
            rows={3}
            autoFocus
            style={{
              width: '100%', padding: '10px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)', fontSize: 13,
              fontFamily: 'var(--font-sans)', lineHeight: 1.5,
              outline: 'none', resize: 'vertical',
              minHeight: 70,
            }}
          />

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              ⌘+Enter valider · Esc annuler
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); }}>
                Annuler
              </Button>
              <Button size="sm" variant="primary" onClick={submit} disabled={!draft.content.trim() || submitting}>
                {submitting ? 'Ajout…' : 'Ajouter'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {journal.length === 0 ? (
        !adding && (
          <EmptyState
            icon="◌"
            title="Pas encore d'entrée"
            message="Tape ⌘J n'importe où dans l'app ou clique sur + Entrée pour ajouter une note, un appel, un meeting…"
            action={<Button variant="primary" onClick={() => setAdding(true)}>+ Première entrée</Button>}
          />
        )
      ) : (
        journal.map(e => (
          <JournalEntryRow key={e.id} entry={e} onDelete={onDelete} />
        ))
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// JournalEntryRow — entrée + delete au hover
// ─────────────────────────────────────────────────────────
function JournalEntryRow({ entry, onDelete }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={journalRow}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{
          width: 24, height: 24, borderRadius: 12,
          background: 'var(--gold-soft)', color: 'var(--gold)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, flexShrink: 0,
        }}>
          {TYPE_ICON[entry.type] || '·'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline', marginBottom: 4, gap: 8,
          }}>
            <span style={{
              fontSize: 11, fontFamily: 'var(--font-mono)',
              color: 'var(--text-3)', textTransform: 'uppercase',
            }}>{entry.type}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {fmtDate(entry.date)} · {entry.author}
              </span>
              {hover && (
                <button
                  onClick={() => onDelete(entry.id)}
                  title="Supprimer cette entrée"
                  aria-label="Supprimer cette entrée du journal"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-3)',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: 2,
                    borderRadius: 4,
                    transition: 'color var(--duration) var(--ease), background var(--duration) var(--ease)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = 'var(--danger)';
                    e.currentTarget.style.background = 'var(--danger-soft)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'var(--text-3)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
          <div style={{
            fontSize: 13, color: 'var(--text)',
            lineHeight: 1.5, whiteSpace: 'pre-wrap',
          }}>
            {entry.content}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Stat & styles
// ─────────────────────────────────────────────────────────
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
};

const journalRow = {
  padding: '12px 0',
  borderBottom: '1px solid var(--border)',
};

const dropdownItem = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '6px 12px', background: 'transparent', border: 'none',
  cursor: 'pointer', fontSize: 12, color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
};

const dropdownLabel = {
  padding: '6px 12px 2px',
  fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
  color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
};

// ─────────────────────────────────────────────────────────
// ExpensesPanel — CRUD rapide des dépenses sur la fiche projet
// ─────────────────────────────────────────────────────────
const EXPENSE_STATUS_CYCLE = ['pending', 'paid', 'overdue'];
const EXPENSE_STATUS_TONE = {
  pending: 'warning',
  paid:    'success',
  overdue: 'danger',
};
const EXPENSE_STATUS_LABEL = {
  pending: 'En attente',
  paid:    'Payée',
  overdue: 'En retard',
};

function ExpensesPanel({ expenses = [], totalPaid, totalAll, onCreate, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ label: '', amountHT: '', category: '', status: 'pending', date: new Date().toISOString().slice(0, 10) });

  const submit = async () => {
    if (!draft.label.trim()) return;
    await onCreate(draft);
    setDraft({ label: '', amountHT: '', category: '', status: 'pending', date: new Date().toISOString().slice(0, 10) });
  };

  return (
    <Card>
      <SectionTitle
        title="Dépenses"
        level="h2"
        subtitle={`${expenses.length} · ${fmt(totalPaid)} payées / ${fmt(totalAll)} total`}
        right={
          adding ? null : (
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
              + Dépense
            </Button>
          )
        }
      />

      {/* Form ajout rapide */}
      {adding && (
        <div className="resp-grid-1col" style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 110px 100px 100px 80px',
          gap: 8, padding: '10px',
          background: 'var(--surface-2)',
          border: '1px solid var(--gold)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 12,
          alignItems: 'center',
        }}>
          <input
            type="text"
            value={draft.label}
            onChange={(e) => setDraft(d => ({ ...d, label: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') { setAdding(false); }
            }}
            placeholder="Libellé de la dépense"
            autoFocus
            style={miniInput}
          />
          <select
            value={draft.category}
            onChange={(e) => setDraft(d => ({ ...d, category: e.target.value }))}
            style={{ ...miniInput, fontFamily: 'var(--font-sans)' }}
          >
            <option value="">— Catégorie —</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={draft.status}
            onChange={(e) => setDraft(d => ({ ...d, status: e.target.value }))}
            style={{ ...miniInput, fontFamily: 'var(--font-sans)' }}
          >
            <option value="pending">En attente</option>
            <option value="paid">Payée</option>
            <option value="overdue">En retard</option>
          </select>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft(d => ({ ...d, date: e.target.value }))}
            style={miniInput}
          />
          <input
            type="number"
            step="0.01"
            value={draft.amountHT}
            onChange={(e) => setDraft(d => ({ ...d, amountHT: e.target.value }))}
            placeholder="HT €"
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            style={{ ...miniInput, textAlign: 'right', fontFamily: 'var(--font-mono)' }}
          />
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              ↵ valider · Esc annuler · HT recalculé en TTC automatiquement
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Annuler</Button>
              <Button size="sm" variant="primary" onClick={submit} disabled={!draft.label.trim()}>
                Ajouter
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown par catégorie */}
      {expenses.length > 0 && (
        <ExpenseCategoryBreakdown expenses={expenses} />
      )}

      {/* Table headers */}
      {expenses.length > 0 && (
        <div className="resp-table-head" style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 110px 100px 110px 22px',
          gap: 10, padding: '6px 0',
          fontSize: 10, fontWeight: 600, color: 'var(--text-3)',
          letterSpacing: 0.5, textTransform: 'uppercase',
          fontFamily: 'var(--font-mono)',
          borderBottom: '1px solid var(--border)',
        }}>
          <span>Libellé</span>
          <span>Catégorie</span>
          <span>Statut</span>
          <span>Date</span>
          <span style={{ textAlign: 'right' }}>TTC</span>
          <span />
        </div>
      )}

      {expenses.length === 0 && !adding ? (
        <EmptyState
          icon="—"
          title="Aucune dépense"
          message="Click sur + Dépense pour ajouter la première."
          action={<Button size="sm" variant="primary" onClick={() => setAdding(true)}>+ Dépense</Button>}
        />
      ) : (
        expenses
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          .map(e => (
            <ExpenseRow
              key={e.id}
              expense={e}
              onUpdate={(patch) => onUpdate(e.id, patch)}
              onDelete={() => onDelete(e.id)}
            />
          ))
      )}
    </Card>
  );
}

function ExpenseRow({ expense, onUpdate, onDelete }) {
  const [hover, setHover] = useState(false);
  const status = expense.status || 'pending';

  const cycleStatus = () => {
    const idx = EXPENSE_STATUS_CYCLE.indexOf(status);
    const next = EXPENSE_STATUS_CYCLE[(idx + 1) % EXPENSE_STATUS_CYCLE.length];
    onUpdate({ status: next });
  };

  return (
    <div
      className="resp-table-row"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr 110px 100px 110px 22px',
        gap: 10, padding: '6px 0',
        alignItems: 'center', fontSize: 12,
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Libellé */}
      <input
        type="text"
        value={expense.label || ''}
        onChange={(e) => onUpdate({ label: e.target.value })}
        placeholder="Libellé"
        style={inlineInput}
      />

      {/* Catégorie */}
      <input
        type="text"
        value={expense.category || ''}
        onChange={(e) => onUpdate({ category: e.target.value })}
        list="expense-cats"
        placeholder="—"
        style={{ ...inlineInput, color: 'var(--text-3)', fontSize: 11 }}
      />

      {/* Status clickable */}
      <button
        onClick={cycleStatus}
        title="Cliquer pour cycler"
        style={{
          padding: '2px 8px', borderRadius: 999,
          fontSize: 10, fontWeight: 500, cursor: 'pointer',
          background: status === 'paid' ? 'var(--success-soft)'
                    : status === 'overdue' ? 'var(--danger-soft)'
                    : 'var(--warning-soft)',
          color: status === 'paid' ? 'var(--success)'
               : status === 'overdue' ? 'var(--danger)'
               : 'var(--warning)',
          border: '1px solid ' + (status === 'paid' ? 'var(--success)'
                                : status === 'overdue' ? 'var(--danger)'
                                : 'var(--warning)'),
          fontFamily: 'var(--font-sans)',
          whiteSpace: 'nowrap',
          justifySelf: 'start',
        }}
      >
        {EXPENSE_STATUS_LABEL[status]}
      </button>

      {/* Date */}
      <input
        type="date"
        value={expense.date || ''}
        onChange={(e) => onUpdate({ date: e.target.value })}
        style={{ ...inlineInput, color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
      />

      {/* Montant HT (édité) + TTC affiché */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <input
          type="number"
          step="0.01"
          value={expense.amount_ht ?? expense.amountHt ?? ''}
          onChange={(e) => onUpdate({ amountHT: e.target.value })}
          placeholder="0"
          title="HT"
          style={{
            ...inlineInput,
            textAlign: 'right',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: 'var(--text)',
            fontSize: 12,
            width: '100%',
          }}
        />
        <span style={{
          fontSize: 10, color: 'var(--text-3)',
          fontFamily: 'var(--font-mono)',
          paddingRight: 6,
        }}>
          {fmt(expense.amount_ttc || expense.amountTtc)} TTC
        </span>
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        title="Supprimer"
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-3)', fontSize: 14, padding: 2, lineHeight: 1,
          opacity: hover ? 1 : 0,
          transition: 'opacity var(--duration) var(--ease), color var(--duration) var(--ease), background var(--duration) var(--ease)',
          borderRadius: 4,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-soft)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
      >×</button>
    </div>
  );
}

const inlineInput = {
  padding: '4px 8px',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  width: '100%',
  transition: 'all var(--duration) var(--ease)',
};

const miniInput = {
  padding: '6px 10px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  width: '100%',
};
