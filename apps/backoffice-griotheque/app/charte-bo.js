// Charte La Griothèque appliquée au back office (12/10/2026).
//
// Le BO parlait encore l'ancien langage « machine » : capitales interlettrées
// en Geist Mono, jaune de marque, cases carrées. La charte du site l'a
// abandonné : Geist seul, bas de casse, trois valeurs (noir, papier
// #f6f5f3, beige #f5f4f1), pas de jaune, boutons en pilule.
// Cette feuille se pose APRÈS globalCss et ne fait que surcharger : retirer
// la ligne <style>{charteCss}</style> dans layout.jsx rend l'ancien BO.
export const charteCss = `
:root {
  --paper: #f6f5f3;
  --beige: #f5f4f1;
  --paper-2: #efeeeb;
  --paper-3: #e9e7e3;
  --field: #fbfaf8;
  --ink: #000;
  --ink-2: rgba(0,0,0,.72);
  --ink-dim: rgba(0,0,0,.48);
  --rule: rgba(0,0,0,.10);
  --rule-fort: rgba(0,0,0,.22);
  --accent: #000;
  --accent-soft: rgba(0,0,0,.08);
  --font-mono: "Geist", "Inter", -apple-system, system-ui, sans-serif;
}

/* ---- une seule voix : Geist, bas de casse ------------------------- */
label, h2, th, .btn, .pill, .bo-fil, .bo-menu__groupe, .bo-compte,
.bo-carte__titre, .bo-marque__sub, .bo-tete__compte, .bo-burger,
.bo-barre__pied a.bo-lien-site, td.num, code, input.mono, textarea.mono {
  font-family: var(--font-sans);
  text-transform: none;
  letter-spacing: 0;
}
code, input.mono, textarea.mono, td.num { font-variant-numeric: tabular-nums; }

label { font-size: 13px; font-weight: 500; color: var(--ink-2); margin-bottom: 8px; }
h1 { font-size: clamp(26px, 2.6vw, 34px); letter-spacing: -0.025em; font-weight: 500; }
h2 { font-size: 17px; font-weight: 500; color: var(--ink); letter-spacing: -0.01em;
     margin: 40px 0 16px; padding: 0; border: 0; }
.note, .champ__aide { color: var(--ink-dim); }
code { background: var(--paper-3); border-radius: 6px; padding: 1px 7px; font-size: 12.5px; }

/* ---- barre latérale ---------------------------------------------- */
.bo-barre { border-right: 1px solid var(--rule); }
.bo-marque { border-bottom: 1px solid var(--rule); }
.bo-marque__sub { font-size: 12px; color: var(--ink-dim); margin-top: 6px; }
.bo-menu { padding: 8px 10px 18px; }
.bo-menu__groupe { font-size: 12px; color: var(--ink-dim); padding: 20px 12px 6px; }
.bo-menu a { border-left: 0; border-radius: 999px; padding: 8px 12px; margin: 1px 0; }
.bo-menu a:hover { background: var(--paper-3); }
.bo-menu a[aria-current="page"] { background: var(--ink); color: var(--paper); }
.bo-menu a[aria-current="page"] .bo-compte { color: rgba(246,245,243,.6); }
.bo-compte { font-size: 12px; }
.bo-barre__pied { border-top: 1px solid var(--rule); }
.bo-barre__pied a.bo-lien-site { font-size: 13px; }

/* ---- en-tête de page --------------------------------------------- */
.bo-tete { border-bottom: 1px solid var(--rule); padding-bottom: 20px; margin-bottom: 28px; }
.bo-fil { font-size: 13px; margin-bottom: 6px; }
.bo-tete__compte { border-radius: 999px; font-size: 13px; padding: 3px 11px; vertical-align: .3em;
  background: var(--paper-3); color: var(--ink-2); }

/* ---- boutons : pilules ------------------------------------------- */
.btn { border-radius: 999px; padding: 11px 20px; font-size: 13.5px; font-weight: 500;
  border: 1px solid var(--ink); background: var(--ink); color: var(--paper); transition: opacity .15s, background .15s; }
.btn:hover { background: var(--ink); color: var(--paper); opacity: .82; }
.btn--ghost { background: transparent; color: var(--ink); border-color: var(--rule-fort); }
.btn--ghost:hover { background: var(--paper-3); color: var(--ink); opacity: 1; border-color: var(--ink); }
.btn--accent { background: var(--ink); color: var(--paper); }
.btn--danger { background: transparent; color: var(--danger); border-color: rgba(198,40,40,.4); }
.btn--danger:hover { background: var(--danger); color: #fff; opacity: 1; }
.btn--petit { padding: 6px 13px; font-size: 12.5px; }
.btn:disabled { opacity: .4; cursor: default; }

/* ---- champs ------------------------------------------------------ */
input, textarea, select { background: var(--field); border: 1px solid var(--rule-fort); border-radius: 12px; padding: 11px 14px; }
input[type="checkbox"], input[type="radio"] { accent-color: var(--ink); }
input:focus, textarea:focus, select:focus { border-color: var(--ink); box-shadow: 0 0 0 3px var(--accent-soft); }
:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; border-radius: 999px; }
input:focus-visible, textarea:focus-visible, select:focus-visible { border-radius: 12px; outline: none; }

/* ---- pastilles ----------------------------------------------------- */
.pill { border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 500; border-color: var(--rule-fort); }
.pill--on { color: var(--ink); border-color: var(--ink); background: transparent; }
.pill--on::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #2e7d4f; margin-right: 6px; vertical-align: 1px; }
.pill--off { color: var(--ink-dim); }

/* ---- tableaux ------------------------------------------------------ */
.bo-tableau { border: 0; border-radius: 18px; background: var(--beige); box-shadow: inset 0 0 0 1px var(--rule); }
th { font-size: 12.5px; font-weight: 500; color: var(--ink-dim); background: var(--beige); border-bottom: 1px solid var(--rule); }
th, td { padding: 13px 16px; }
td { border-bottom: 1px solid var(--rule); }
tbody tr:hover td { background: rgba(0,0,0,.025); }

/* ---- cartes d'accueil ---------------------------------------------- */
.bo-cartes { gap: 12px; }
.bo-carte { box-shadow: inset 0 0 0 1px var(--rule); background: var(--beige); border-radius: 18px; }
.bo-carte:hover { background: var(--ink); color: var(--paper); }
.bo-carte:hover .bo-carte__desc { color: rgba(246,245,243,.7); }
.bo-carte__titre { font-size: 15px; font-weight: 500; }
.empty { border-radius: 18px; border: 1px dashed var(--rule-fort); background: var(--beige); }
.bo-actions-collees { border-top: 1px solid var(--rule); }

/* ---- Griot DM ------------------------------------------------------ */
.bo .gdm-onglets { border-bottom: 1px solid var(--rule); gap: 4px; margin: 34px 0 20px; }
.bo .gdm-onglets button { font-family: var(--font-sans); text-transform: none; letter-spacing: 0; font-size: 14px;
  color: var(--ink-dim); border: 0; border-radius: 999px; padding: 8px 16px; margin-bottom: 10px; }
.bo .gdm-onglets button:hover { color: var(--ink); background: var(--paper-3); }
.bo .gdm-onglets button.est-actif { color: var(--paper); background: var(--ink); }
.bo .gdm-etat { border: 0; border-radius: 18px; background: var(--beige); box-shadow: inset 0 0 0 1px var(--rule); padding: 20px 22px; }
.bo .gdm-etat.est-ok { box-shadow: inset 0 0 0 1px var(--rule); }
.bo .gdm-etat__titre { font-size: 16px; }
.bo .gdm-etat.est-ok .gdm-etat__titre::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #2e7d4f; margin-right: 9px; vertical-align: 2px; }
.bo .gdm-etat__chiffres b { font-family: var(--font-sans); font-size: 20px; letter-spacing: -.02em; margin-right: 4px; }

/* l'aperçu : un vrai fil de messages, c'est la pièce qu'on regarde */
.bo .gdm-apercu { border: 0; border-radius: 28px; background: var(--field); box-shadow: 0 0 0 1px var(--rule), 0 24px 48px -28px rgba(0,0,0,.35); overflow: hidden; }
.bo .gdm-apercu__tete { font-family: var(--font-sans); text-transform: none; letter-spacing: 0; font-size: 13.5px; font-weight: 500;
  padding: 16px 18px; border-bottom: 1px solid var(--rule); display: flex; align-items: center; gap: 10px; }
.bo .gdm-apercu__tete::before { content: ""; width: 28px; height: 28px; border-radius: 50%; background: var(--ink); flex: 0 0 auto; }
.bo .gdm-fil { padding: 18px 16px 22px; gap: 12px; }
.bo .gdm-bulle__ou { font-family: var(--font-sans); text-transform: none; letter-spacing: 0; font-size: 11px; padding: 0 6px; }
.bo .gdm-bulle__txt { border-radius: 20px; padding: 10px 14px; font-size: 13.5px; background: var(--paper-3); }
.bo .gdm-bulle--nous .gdm-bulle__txt { background: var(--ink); color: var(--paper); border-bottom-right-radius: 6px; }
.bo .gdm-bulle--eux .gdm-bulle__txt { border-bottom-left-radius: 6px; }
.bo .gdm-bulle__btn { border-radius: 14px; border-color: var(--rule-fort); background: var(--field); }
.bo .gdm-bulle__quick { border-radius: 999px; border-color: var(--ink); background: var(--field); font-size: 12.5px; padding: 6px 14px; }
.bo .gdm-media__item { border-radius: 12px; }
.bo .gdm-media__item span { font-family: var(--font-sans); font-size: 10.5px; }
.bo .gdm-case { font-weight: 400; }
`;
