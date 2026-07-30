// Barrel export — kit UI LES GRIOTS OS
// Usage : import { Card, Badge, Button, KpiCard, ... } from '@/components/ui';
export { default as Card }         from './Card';
export { default as Carte }        from './Card';

// ── Les cinq primitives ───────────────────────────────────────────────────
// Un bouton, un champ, une carte, un tableau, une étiquette. Écrits une fois,
// posés sur les jetons, avec leurs états dans styles/primitives.css. Tout
// écran neuf part d'ici ; les anciens noms restent le temps de la reprise.
export { default as Bouton }       from './Bouton';
export { default as Bloc }         from './Bloc';
export { Pile, Page }              from './Bloc';
export { default as Champ }        from './Champ';
export { Saisie, Zone, Choix, Case, Grille } from './Champ';
export { default as Tableau }      from './Tableau';
export { Sous }                    from './Tableau';
export { default as Etiquette }    from './Badge';
export { default as Badge }        from './Badge';
export { default as Button }       from './Button';
export { default as KpiCard }      from './KpiCard';
export { default as Skeleton }     from './Skeleton';
export { SkeletonText }            from './Skeleton';
export { default as EmptyState }   from './EmptyState';
export { default as SectionTitle } from './SectionTitle';
export { SubLabel }                from './SectionTitle';
export { default as StatusDot }    from './StatusDot';
export { default as AlertChip }    from './AlertChip';
export { ToastProvider, useToast } from './Toast';
export { ConfirmProvider, useConfirm } from './ConfirmDialog';
export { default as CaHistoryChart } from './CaHistoryChart';
export { default as ViewSwitcher, useViewMode } from './ViewSwitcher';
export { default as EditableField } from './EditableField';
export { default as StarRating } from './StarRating';
export { default as MultiCategorySelect } from './MultiCategorySelect';
export { HtTtc, MarginBar, CopyBtn, Pagination, Breadcrumbs } from './Misc';
export { default as useMediaQuery } from './useMediaQuery';
