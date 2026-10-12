// Griot DM — tableau de bord des automatisations Instagram.
// Quatre onglets : Automatisations · Contacts · Journal · Simulateur.
// L'en-tête dit en un coup d'œil si le branchement Meta est vivant.
"use client";
import { useEffect, useState } from "react";
import { CSS as FORM_CSS } from "../components/AutomationForm";

const ONGLETS = [
  ["automatisations", "Automatisations"],
  ["contacts", "Contacts"],
  ["journal", "Journal"],
  ["simulateur", "Simulateur"],
];

export default function InstagramPage() {
  const [tab, setTab] = useState("automatisations");
  const [status, setStatus] = useState(null);
  const [autos, setAutos] = useState(null);

  async function reload() {
    const [s, a] = await Promise.all([
      fetch("/api/instagram/status").then((r) => r.json()).catch(() => null),
      fetch("/api/instagram/automations").then((r) => r.json()).catch(() => []),
    ]);
    setStatus(s); setAutos(Array.isArray(a) ? a : []);
  }
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && ONGLETS.some(([k]) => k === t)) setTab(t);
    reload();
  }, []);

  function go(k) {
    setTab(k);
    const u = new URL(window.location.href); u.searchParams.set("tab", k); window.history.replaceState(null, "", u);
  }

  async function toggle(a) {
    await fetch(`/api/instagram/automations/${a.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...a, active: !a.active }) });
    reload();
  }

  return (
    <div className="bo-page">
      <style>{FORM_CSS + CSS}</style>
      <div className="bo-tete">
        <div className="bo-tete__gauche">
          <div className="bo-fil">Relation · Griot DM</div>
          <h1>Instagram{status ? <span className="bo-tete__compte">{status.counts.actives} active{status.counts.actives > 1 ? "s" : ""}</span> : null}</h1>
        </div>
        <div className="actions"><a className="btn" href="/instagram/new">+ Automatisation</a></div>
      </div>

      <Etat status={status} onRefresh={reload} />

      <div className="gdm-onglets" role="tablist">
        {ONGLETS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "est-actif" : ""} onClick={() => go(k)}>{l}</button>
        ))}
      </div>

      {tab === "automatisations" && <Automatisations autos={autos} onToggle={toggle} />}
      {tab === "contacts" && <Contacts autos={autos || []} />}
      {tab === "journal" && <Journal log={status ? status.log : null} onRefresh={reload} />}
      {tab === "simulateur" && <Simulateur autos={autos || []} />}
    </div>
  );
}

function Etat({ status, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!status) return <div className="note">Vérification du branchement…</div>;
  const { config, account, accountError, token, counts } = status;
  const ok = config.hasToken && config.hasSecret && config.hasVerify && account;
  async function subscribe() {
    setBusy(true); setMsg("");
    const r = await fetch("/api/instagram/subscribe", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setBusy(false); setMsg(r.ok && d.success ? "Webhooks abonnés ✓ (comments, messages, postbacks)" : "⚠ " + (d.error || "échec"));
  }
  async function refresh() {
    setBusy(true); setMsg("");
    const r = await fetch("/api/instagram/refresh", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setBusy(false); setMsg(r.ok ? "Jeton rafraîchi ✓" : "⚠ " + (d.error || "échec")); onRefresh();
  }
  const items = [
    ["Jeton d'accès", config.hasToken, token.source === "rafraîchi" ? `rafraîchi le ${new Date(token.refreshed_at).toLocaleDateString("fr-FR")} · expire le ${new Date(token.expires_at).toLocaleDateString("fr-FR")}` : token.source],
    ["Clé secrète de l'app", config.hasSecret, "IG_APP_SECRET"],
    ["Jeton de vérification webhook", config.hasVerify, "IG_VERIFY_TOKEN"],
    ["Compte Instagram", !!account, account ? `@${account.username} · ${account.followers_count ?? "?"} abonnés` : (accountError || "non connecté")],
  ];
  return (
    <div className={"gdm-etat" + (ok ? " est-ok" : "")}>
      <div className="gdm-etat__titre">{ok ? (config.dryRun ? "Branché — mode simulation (IG_DRY_RUN=1), rien n'est envoyé" : "Branché et actif") : "Branchement Meta incomplet"}</div>
      <ul>
        {items.map(([l, v, d]) => <li key={l}><span className={"pill " + (v ? "pill--on" : "pill--off")}>{v ? "ok" : "manque"}</span> {l} <span className="note" style={{ display: "inline" }}>— {d}</span></li>)}
      </ul>
      <div className="gdm-etat__chiffres">
        <span><b>{counts.contacts}</b> contacts</span><span><b>{counts.emails}</b> emails captés</span><span><b>{counts.automations}</b> automatisations</span>
      </div>
      {config.hasToken && <div className="actions" style={{ marginTop: 10 }}><button className="btn btn--ghost btn--petit" onClick={subscribe} disabled={busy}>Abonner les webhooks</button><button className="btn btn--ghost btn--petit" onClick={refresh} disabled={busy}>Rafraîchir le jeton</button><span className="note" style={{ margin: 0 }}>{msg}</span></div>}
      {!ok && <p className="note" style={{ marginTop: 10 }}>URL du webhook à déclarer chez Meta : <code>https://admin.lagriotheque.com/api/instagram/webhook</code> · champs : <code>comments</code>, <code>messages</code>, <code>messaging_postbacks</code>. Le guide complet est dans <code>docs/GRIOT-DM.md</code>.</p>}
    </div>
  );
}

function Automatisations({ autos, onToggle }) {
  if (autos === null) return <div className="empty">Chargement…</div>;
  if (!autos.length) return (
    <div className="empty">Aucune automatisation. Commence par une ressource : un post, un mot-clé en commentaire, la ressource livrée en DM contre un email.
      <div style={{ marginTop: 14 }}><a className="btn" href="/instagram/new">+ Créer la première</a></div></div>
  );
  return (
    <div className="bo-tableau"><table><thead><tr>
      <th>Automatisation</th><th>Déclencheur</th><th>Mots-clés</th><th>Déclenchées</th><th>Emails</th><th>Livrées</th><th>Statut</th><th></th>
    </tr></thead><tbody>
      {autos.map((a) => (
        <tr key={a.id}>
          <td><a href={`/instagram/${a.id}`}><b>{a.title}</b></a><div className="note" style={{ margin: 0 }}>{a.media_ids.length ? `${a.media_ids.length} post(s)` : (a.trigger === "dm" ? "en DM" : "tous les posts")}{a.ask_email ? " · email" : ""}{a.follow_gate ? " · abonnés" : ""}</div></td>
          <td>{{ comment: "Commentaire", dm: "DM", both: "Les deux" }[a.trigger]}</td>
          <td className="num">{a.match === "any" ? "tout" : a.keywords.join(", ")}</td>
          <td className="num">{a.stats.triggered || 0}</td>
          <td className="num">{a.stats.emails || 0}</td>
          <td className="num">{a.stats.delivered || 0}</td>
          <td><button className={"pill " + (a.active ? "pill--on" : "pill--off")} style={{ cursor: "pointer", background: "none" }} onClick={() => onToggle(a)}>{a.active ? "active" : "en pause"}</button></td>
          <td><div className="actions"><a className="btn btn--ghost btn--petit" href={`/instagram/${a.id}`}>Éditer</a></div></td>
        </tr>
      ))}
    </tbody></table></div>
  );
}

function Contacts({ autos }) {
  const [list, setList] = useState(null);
  const load = () => fetch("/api/instagram/contacts").then((r) => r.json()).then((d) => setList(Array.isArray(d) ? d : [])).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  async function patch(igsid, body) {
    await fetch("/api/instagram/contacts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ igsid, ...body }) });
    load();
  }
  const titre = (id) => (autos.find((a) => a.id === id) || {}).title || id;
  if (list === null) return <div className="empty">Chargement…</div>;
  if (!list.length) return <div className="empty">Personne n'a encore interagi avec une automatisation.</div>;
  return (
    <>
      <p className="note">« Pause » coupe l'automate pour une personne : à faire quand tu reprends la conversation à la main, pour qu'il ne réponde pas à ta place.</p>
      <div className="bo-tableau"><table><thead><tr><th>Pseudo</th><th>Email</th><th>En cours</th><th>Reçu</th><th>Dernière activité</th><th></th></tr></thead><tbody>
        {list.map((c) => (
          <tr key={c.igsid}>
            <td>{c.username ? <a href={`https://instagram.com/${c.username}`} target="_blank" rel="noopener noreferrer">@{c.username}</a> : <code>{c.igsid}</code>}</td>
            <td>{c.email || "—"}</td>
            <td>{c.pending ? <span className="pill">{c.pending.step} · {titre(c.pending.automation)}</span> : "—"}</td>
            <td style={{ fontSize: 12.5 }}>{(c.history || []).map((h) => titre(h.automation)).filter((v, i, t) => t.indexOf(v) === i).join(", ") || "—"}</td>
            <td style={{ fontSize: 11, color: "var(--ink-dim)" }}>{c.updated_at ? new Date(c.updated_at).toLocaleString("fr-FR") : ""}</td>
            <td><div className="actions">
              <button className="btn btn--ghost btn--petit" onClick={() => patch(c.igsid, { paused: !c.paused })}>{c.paused ? "Relancer" : "Pause"}</button>
              {c.pending && <button className="btn btn--ghost btn--petit" onClick={() => patch(c.igsid, { reset: true })}>Annuler</button>}
            </div></td>
          </tr>
        ))}
      </tbody></table></div>
    </>
  );
}

function Journal({ log, onRefresh }) {
  if (!log) return <div className="empty">Chargement…</div>;
  return (
    <>
      <div className="actions" style={{ marginTop: 6 }}><button className="btn btn--ghost btn--petit" onClick={onRefresh}>Actualiser</button></div>
      {!log.length ? <div className="empty">Rien pour l'instant. Chaque commentaire et message reçu par le webhook s'inscrira ici.</div> : (
        <div className="bo-tableau"><table><thead><tr><th>Quand</th><th>Qui</th><th>Événement</th><th>Détail</th></tr></thead><tbody>
          {log.map((l, i) => (
            <tr key={i}>
              <td style={{ fontSize: 11, color: "var(--ink-dim)", whiteSpace: "nowrap" }}>{new Date(l.at).toLocaleString("fr-FR")}</td>
              <td>{l.username ? "@" + l.username : <code>{String(l.igsid || "").slice(0, 10)}</code>}</td>
              <td><span className="pill" style={l.type === "erreur" ? { color: "var(--danger)", borderColor: "var(--danger)" } : null}>{l.type}</span></td>
              <td style={{ fontSize: 12.5 }}>{[l.automation, l.text, l.email, l.url, l.error].filter(Boolean).join(" · ")}</td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </>
  );
}

function Simulateur({ autos }) {
  const [session] = useState(() => "s" + Math.random().toString(36).slice(2, 8));
  const [fil, setFil] = useState([]);
  const [text, setText] = useState("");
  const [username, setUsername] = useState("camille");
  const [follows, setFollows] = useState(true);
  const [mode, setMode] = useState("comment");
  const [quick, setQuick] = useState(null);

  async function send(kind, t, payload = "") {
    if (!t && !payload) return;
    setFil((f) => [...f, { who: "eux", where: kind === "comment" ? "commentaire" : "DM", text: t }]);
    setText(""); setQuick(null);
    const r = await fetch("/api/instagram/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session, kind, text: t, payload, username, follows }) });
    const d = await r.json();
    const bulles = (d.out || []).map((o) => {
      const m = o.message || {};
      const tpl = m.attachment && m.attachment.payload;
      return {
        who: "nous", where: o.kind,
        text: o.text || m.text || (tpl && tpl.text) || "",
        button: tpl && tpl.buttons ? `${tpl.buttons[0].title} ↗ ${tpl.buttons[0].url}` : "",
        quick: m.quick_replies ? m.quick_replies[0] : null,
      };
    });
    const last = [...bulles].reverse().find((b) => b.quick);
    if (last) setQuick(last.quick);
    if (!bulles.length) bulles.push({ who: "systeme", text: (d.log || []).map((l) => l.type).join(" · ") || "aucune réaction" });
    setFil((f) => [...f, ...bulles]);
    if (kind === "comment") setMode("dm");
  }

  async function reset() {
    await fetch("/api/instagram/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session, reset: true }) });
    setFil([]); setQuick(null); setMode("comment");
  }

  return (
    <div className="gdm-sim">
      <div>
        <p className="note">Rejoue une conversation avec tes vraies automatisations (seules les actives répondent). Rien n'est envoyé à Instagram, aucun lead n'est créé.</p>
        {!autos.some((a) => a.active) && <p className="note" style={{ color: "var(--danger)" }}>Aucune automatisation active : active-en une pour la tester.</p>}
        <div className="row">
          <div className="champ"><label>Pseudo fictif</label><input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div className="champ"><label>&nbsp;</label><label className="gdm-case" style={{ marginTop: 6 }}><input type="checkbox" checked={follows} onChange={(e) => setFollows(e.target.checked)} /> Suit le compte</label></div>
        </div>
        <div className="champ"><label>{mode === "comment" ? "Écrire un commentaire" : "Répondre en DM"}</label>
          <form onSubmit={(e) => { e.preventDefault(); send(mode, text); }} className="actions" style={{ flexWrap: "nowrap" }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "comment" ? "RECIT" : "ton message…"} />
            <button className="btn" type="submit">Envoyer</button>
          </form>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn btn--ghost btn--petit" onClick={() => setMode(mode === "comment" ? "dm" : "comment")}>Passer en {mode === "comment" ? "DM" : "commentaire"}</button>
          <button className="btn btn--ghost btn--petit" onClick={reset}>Recommencer</button>
        </div>
      </div>
      <div className="gdm-apercu">
        <div className="gdm-apercu__tete">Conversation simulée</div>
        <div className="gdm-fil">
          {!fil.length && <div className="note">Écris un commentaire avec un de tes mots-clés.</div>}
          {fil.map((s, i) => s.who === "systeme" ? <div key={i} className="note" style={{ textAlign: "center" }}>— {s.text} —</div> : (
            <div key={i} className={"gdm-bulle gdm-bulle--" + s.who}>
              <div className="gdm-bulle__ou">{s.where}</div>
              {s.text ? <div className="gdm-bulle__txt">{s.text}</div> : null}
              {s.button ? <div className="gdm-bulle__btn" style={{ wordBreak: "break-all" }}>{s.button}</div> : null}
            </div>
          ))}
          {quick && <button className="gdm-bulle__quick" style={{ cursor: "pointer", background: "#fff" }} onClick={() => send("dm", quick.title, quick.payload)}>{quick.title}</button>}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.gdm-onglets { display: flex; gap: 0; border-bottom: 1px solid var(--ink); margin: 28px 0 18px; overflow-x: auto; }
.gdm-onglets button { background: none; border: 0; border-bottom: 3px solid transparent; padding: 10px 16px; font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-dim); cursor: pointer; white-space: nowrap; }
.gdm-onglets button.est-actif { color: var(--ink); border-bottom-color: var(--accent); }
.gdm-etat { border: 1px solid var(--rule-fort); padding: 16px 18px; background: #fff; }
.gdm-etat.est-ok { border-color: var(--ok); }
.gdm-etat__titre { font-weight: 500; margin-bottom: 8px; }
.gdm-etat ul { list-style: none; display: grid; gap: 6px; font-size: 13.5px; }
.gdm-etat__chiffres { display: flex; gap: 22px; margin-top: 12px; font-size: 13px; color: var(--ink-2); flex-wrap: wrap; }
.gdm-etat__chiffres b { font-family: var(--font-mono); font-weight: 500; color: var(--ink); }
.gdm-sim { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 30px; align-items: start; }
.gdm-sim .gdm-apercu { position: static; }
@media (max-width: 1000px) { .gdm-sim { grid-template-columns: 1fr; } }
`;
