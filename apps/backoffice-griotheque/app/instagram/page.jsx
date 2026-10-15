// Griot DM — tableau de bord des automatisations Instagram.
// Onglets : Messages · Feed · Automatisations · Publications · Contacts · Journal · Simulateur.
// L'en-tête dit en un coup d'œil si le branchement Meta est vivant.
"use client";
import { useEffect, useState } from "react";
import { CSS as FORM_CSS } from "../components/AutomationForm";

const ONGLETS = [
  ["messages", "Messages"],
  ["feed", "Feed"],
  ["automatisations", "Automatisations"],
  ["publications", "Publications"],
  ["contacts", "Contacts"],
  ["journal", "Journal"],
  ["simulateur", "Simulateur"],
];

export default function InstagramPage() {
  const [tab, setTab] = useState("messages");
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
        <div className="actions"><a className="btn btn--ghost" href="/instagram/publier">+ Publication</a><a className="btn" href="/instagram/new">+ Automatisation</a></div>
      </div>

      <Etat status={status} onRefresh={reload} />

      <div className="gdm-onglets" role="tablist">
        {ONGLETS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "est-actif" : ""} onClick={() => go(k)}>{l}</button>
        ))}
      </div>

      {tab === "messages" && <Messages autos={autos || []} />}
      {tab === "automatisations" && <Automatisations autos={autos} onToggle={toggle} />}
      {tab === "feed" && <Feed autos={autos || []} />}
      {tab === "publications" && <Publications autos={autos || []} />}
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

// ---- Messages : boîte de réception -----------------------------------------
// Toutes les conversations Instagram, avec ce que Griot DM sait de la personne.
// Répondre ici met l'automate en pause 24 h pour elle.
const ETIQUETTES = ["prospect", "inscrit", "client", "partenaire", "presse", "à rappeler"];
const quand = (iso) => {
  if (!iso) return "";
  const d = new Date(iso), n = new Date();
  return d.toDateString() === n.toDateString() ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};
const reste = (iso) => {
  const ms = Date.parse(iso) - Date.now();
  if (!(ms > 0)) return "";
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
};

function Messages({ autos }) {
  const [convs, setConvs] = useState(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(null);
  const [fil, setFil] = useState(null);
  const [filtre, setFiltre] = useState("tous");
  const [texte, setTexte] = useState("");
  const [pause, setPause] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [note, setNote] = useState("");
  const titre = (id) => (autos.find((a) => a.id === id) || {}).title || id;

  async function loadList() {
    const r = await fetch("/api/instagram/inbox").then((x) => x.json()).catch((e) => ({ error: e.message }));
    if (r && r.error) { setErr(r.error); setConvs([]); } else { setErr(""); setConvs(r); }
  }
  async function open(id) {
    setSel(id); setFil(null);
    const r = await fetch(`/api/instagram/inbox/${encodeURIComponent(id)}`).then((x) => x.json()).catch((e) => ({ error: e.message }));
    setFil(r); setNote((r.contact && r.contact.note) || "");
    setConvs((cs) => (cs || []).map((c) => (c.id === id ? { ...c, unread: false } : c)));
  }
  useEffect(() => { loadList(); const t = setInterval(loadList, 30000); return () => clearInterval(t); }, []);

  async function send() {
    if (!texte.trim() || !fil) return;
    setEnvoi(true);
    const r = await fetch(`/api/instagram/inbox/${encodeURIComponent(fil.id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ igsid: fil.igsid, text: texte, pause_hours: pause ? 24 : 0 }) }).then((x) => x.json()).catch((e) => ({ error: e.message }));
    setEnvoi(false);
    if (r.error) { alertBox(r.error); return; }
    setTexte(""); open(fil.id); loadList();
  }
  const [alerte, setAlerte] = useState("");
  function alertBox(m) { setAlerte(m); setTimeout(() => setAlerte(""), 6000); }

  async function patch(body) {
    if (!fil) return;
    await fetch("/api/instagram/contacts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ igsid: fil.igsid, ...body }) });
    open(fil.id); loadList();
  }
  function toggleLabel(l) {
    const cur = (fil.contact && fil.contact.labels) || [];
    patch({ labels: cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l] });
  }

  if (convs === null) return <div className="empty">Chargement des conversations…</div>;
  const shown = convs.filter((c) => filtre === "tous" ? true
    : filtre === "non-lus" ? c.unread
    : filtre === "ouverts" ? c.window.open
    : (c.contact && c.contact.labels.includes(filtre)));
  const nonLus = convs.filter((c) => c.unread).length;
  const ct = fil && fil.contact;
  const enPause = ct && (ct.paused || (ct.paused_until && Date.parse(ct.paused_until) > Date.now()));

  return (
    <>
      {err && <div className="empty" style={{ textAlign: "left" }}>Impossible de lire les conversations : <code>{err}</code></div>}
      <div className="gdm-filtres">
        {[["tous", "Tous"], ["non-lus", `Non lus${nonLus ? ` (${nonLus})` : ""}`], ["ouverts", "Fenêtre ouverte"], ...ETIQUETTES.map((l) => [l, l])].map(([k, l]) => (
          <button key={k} className={"pill" + (filtre === k ? " pill--on" : "")} onClick={() => setFiltre(k)}>{l}</button>
        ))}
        <button className="btn btn--ghost btn--petit" style={{ marginLeft: "auto" }} onClick={loadList}>Actualiser</button>
      </div>
      <div className={"gdm-inbox" + (sel ? " a-un-fil" : "")}>
        <ul className="gdm-inbox__liste">
          {!shown.length && <li className="note" style={{ padding: 16 }}>Rien ici.</li>}
          {shown.map((c) => (
            <li key={c.id}>
              <button className={"gdm-conv" + (sel === c.id ? " est-actif" : "") + (c.unread ? " est-nonlu" : "")} onClick={() => open(c.id)}>
                <span className="gdm-conv__haut"><b>@{c.username || c.igsid}</b><span>{quand(c.updated_time)}</span></span>
                <span className="gdm-conv__texte">{c.last ? (c.last.from_me ? "Toi : " : "") + (c.last.text || "(pièce jointe)") : ""}</span>
                <span className="gdm-conv__tags">
                  {c.window.open && <span className="gdm-tag gdm-tag--ok">{reste(c.window.ends_at)}</span>}
                  {c.contact && c.contact.email && <span className="gdm-tag">email</span>}
                  {c.contact && c.contact.conversions.length > 0 && <span className="gdm-tag gdm-tag--noir">inscrit</span>}
                  {c.contact && c.contact.labels.map((l) => <span key={l} className="gdm-tag">{l}</span>)}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="gdm-inbox__fil">
          {!sel && <div className="empty">Choisis une conversation.</div>}
          {sel && !fil && <div className="empty">Chargement…</div>}
          {fil && fil.error && <div className="empty">Erreur : <code>{fil.error}</code></div>}
          {fil && !fil.error && (<>
            <div className="gdm-fil__tete">
              <button className="btn btn--ghost btn--petit gdm-retour" onClick={() => { setSel(null); setFil(null); }}>←</button>
              <a href={`https://instagram.com/${fil.username}`} target="_blank" rel="noopener noreferrer"><b>@{fil.username}</b></a>
              <span className={"gdm-tag" + (fil.window.open ? " gdm-tag--ok" : "")}>{fil.window.open ? `fenêtre ouverte · ${reste(fil.window.ends_at)}` : "fenêtre fermée"}</span>
              {enPause && <span className="gdm-tag gdm-tag--noir">automate en pause</span>}
            </div>
            <div className="gdm-fil__msgs">
              {fil.messages.map((m) => (
                <div key={m.id} className={"gdm-bulle" + (m.from_me ? " gdm-bulle--moi" : "")}>
                  <div>{m.text || <i>(pièce jointe, visible dans Instagram)</i>}</div>
                  <span>{new Date(m.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
            <div className="gdm-fil__saisie">
              {alerte && <div className="note" style={{ color: "var(--danger, #b42318)" }}>{alerte}</div>}
              {fil.window.open ? (<>
                <textarea rows={2} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Ta réponse…" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} />
                <div className="gdm-fil__actions">
                  <label className="gdm-case" style={{ margin: 0 }}><input type="checkbox" checked={pause} onChange={(e) => setPause(e.target.checked)} /> Mettre l'automate en pause 24 h</label>
                  <button className="btn" disabled={envoi || !texte.trim()} onClick={send}>{envoi ? "…" : "Envoyer"}</button>
                </div>
              </>) : (
                <p className="note">Instagram n'autorise une réponse que dans les 24 h qui suivent le dernier message de la personne. Réponds depuis l'app Instagram, ou attends qu'elle t'écrive.</p>
              )}
            </div>
          </>)}
        </div>

        {fil && !fil.error && (
          <aside className="gdm-inbox__fiche">
            <h3>Fiche</h3>
            <dl>
              <dt>Email</dt><dd>{(ct && ct.email) || "—"}</dd>
              <dt>Automatisations</dt><dd>{ct && ct.history.length ? [...new Set(ct.history)].map(titre).join(", ") : "—"}</dd>
            </dl>
            <h3>Étiquettes</h3>
            <div className="gdm-filtres" style={{ margin: 0 }}>
              {ETIQUETTES.map((l) => <button key={l} className={"pill" + (ct && ct.labels.includes(l) ? " pill--on" : "")} onClick={() => toggleLabel(l)}>{l}</button>)}
            </div>
            <h3>Note</h3>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => ct && note !== ct.note && patch({ note })} placeholder="Ce qu'il faut savoir sur cette personne…" />
            <h3>Liens envoyés</h3>
            {fil.links.length ? <ul className="gdm-liens">{fil.links.map((l) => (
              <li key={l.token}><b>{titre(l.automation)}</b><span>{l.converted ? "inscrit ✓" : l.clicks ? `ouvert ${l.clicks}×` : "pas ouvert"}</span></li>
            ))}</ul> : <p className="note">Aucun lien suivi pour l'instant.</p>}
            {fil.followups.length > 0 && (<><h3>Relances</h3><ul className="gdm-liens">{fil.followups.map((f) => (
              <li key={f.id}><b>{new Date(f.due_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b><span>{f.done ? f.result : "prévue"}</span></li>
            ))}</ul></>)}
            <h3>Automate</h3>
            {enPause
              ? <button className="btn btn--ghost btn--petit" onClick={() => patch(ct.paused ? { paused: false, resume: true } : { resume: true })}>Reprendre l'automate</button>
              : <button className="btn btn--ghost btn--petit" onClick={() => patch({ paused: true })}>Mettre en pause</button>}
          </aside>
        )}
      </div>
    </>
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
      <th>Automatisation</th><th>Déclencheur</th><th>Mots-clés</th><th>Déclenchées</th><th>Emails</th><th>Livrées</th><th title="Personnes ayant ouvert le lien">Clics</th><th title="Inscriptions reliées au DM">Inscrits</th><th>Relances</th><th>Statut</th><th></th>
    </tr></thead><tbody>
      {autos.map((a) => (
        <tr key={a.id}>
          <td><a href={`/instagram/${a.id}`}><b>{a.title}</b></a><div className="note" style={{ margin: 0 }}>{a.media_ids.length ? `${a.media_ids.length} post(s)` : (a.trigger === "dm" ? "en DM" : "tous les posts")}{a.ask_email ? " · email" : ""}{a.follow_gate ? " · abonnés" : ""}{a.relance_enabled ? ` · relance ${a.relance_delay_h} h` : ""}</div></td>
          <td>{{ comment: "Commentaire", dm: "DM", both: "Les deux" }[a.trigger]}</td>
          <td className="num">{a.match === "any" ? "tout" : a.keywords.join(", ")}</td>
          <td className="num">{a.stats.triggered || 0}</td>
          <td className="num">{a.stats.emails || 0}</td>
          <td className="num">{a.stats.delivered || 0}</td>
          <td className="num">{a.stats.clicks || 0}</td>
          <td className="num">{a.stats.converted || 0}{a.stats.delivered ? <span className="note" style={{ margin: 0, display: "block" }}>{Math.round(100 * (a.stats.converted || 0) / a.stats.delivered)} %</span> : null}</td>
          <td className="num">{a.relance_enabled ? (a.stats.relances || 0) : "—"}</td>
          <td><button className={"pill " + (a.active ? "pill--on" : "pill--off")} style={{ cursor: "pointer", background: "none" }} onClick={() => onToggle(a)}>{a.active ? "active" : "en pause"}</button></td>
          <td><div className="actions"><a className="btn btn--ghost btn--petit" href={`/instagram/${a.id}`}>Éditer</a></div></td>
        </tr>
      ))}
    </tbody></table></div>
  );
}

// ---- Feed : la grille du compte, posts programmés en tête ------------------
function Feed({ autos }) {
  const [media, setMedia] = useState(null);
  const [err, setErr] = useState("");
  const [posts, setPosts] = useState([]);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    fetch("/api/instagram/media?limit=48").then((r) => r.json())
      .then((d) => Array.isArray(d) ? setMedia(d) : (setMedia([]), setErr(d.error || "indisponible")))
      .catch((e) => { setMedia([]); setErr(e.message); });
    fetch("/api/instagram/posts").then((r) => r.json()).then((d) => Array.isArray(d) && setPosts(d)).catch(() => {});
  }, []);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  // Une automatisation « tous les posts » couvre tout le feed ; les autres, leurs posts cochés.
  const autosFor = (id) => autos.filter((a) => a.trigger !== "dm" && (a.media_ids.length ? a.media_ids.includes(id) : true));
  const prevu = posts.filter((p) => ["programme", "a_publier", "publication"].includes(p.status) && p.kind !== "story")
    .sort((a, b) => String(b.scheduled_at || "").localeCompare(String(a.scheduled_at || "")));
  const img = (m) => m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url;
  const kind = (m) => m.media_product_type === "REELS" ? "Reel" : m.media_type === "CAROUSEL_ALBUM" ? "Carrousel" : m.media_type === "VIDEO" ? "Vidéo" : "";

  if (media === null) return <div className="empty">Chargement du feed…</div>;
  return (
    <>
      {err && <div className="empty">Feed indisponible : {err}</div>}
      <div className="feed">
        {prevu.map((p) => {
          const m = p.media[0] || {};
          return (
            <a key={p.id} href="/instagram?tab=publications" className="feed__case feed__case--prevu" title={p.caption}>
              {m.type === "video" ? <video src={`/api/preview?p=${encodeURIComponent(m.path)}`} muted /> : <img src={`/api/preview?p=${encodeURIComponent(m.path)}`} alt="" />}
              <span className="feed__etiquette">{p.status === "programme" && p.scheduled_at ? new Date(p.scheduled_at).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "en cours"}</span>
            </a>
          );
        })}
        {media.map((m) => {
          const linked = autosFor(m.id).filter((a) => a.active);
          return (
            <button key={m.id} type="button" className="feed__case" onClick={() => setOpen(m)} title={(m.caption || "").slice(0, 120)}>
              {img(m) ? <img src={img(m)} alt="" loading="lazy" /> : null}
              {kind(m) && <span className="feed__type">{kind(m)}</span>}
              {linked.length > 0 && <span className="feed__dm">DM auto</span>}
              <span className="feed__stats">♥ {m.like_count ?? "–"}  ·  💬 {m.comments_count ?? "–"}</span>
            </button>
          );
        })}
      </div>

      {open && (
        <div className="feed__voile" onClick={() => setOpen(null)}>
          <aside className="feed__tiroir" onClick={(e) => e.stopPropagation()} aria-label="Détail du post">
            <button type="button" className="feed__fermer" onClick={() => setOpen(null)} aria-label="Fermer">×</button>
            <div className="feed__visuel">{open.media_type === "VIDEO"
              ? <video src={open.media_url} poster={open.thumbnail_url} controls playsInline />
              : <img src={open.media_url} alt="" />}</div>
            <div className="feed__corps">
              <div className="feed__chiffres"><span><b>{open.like_count ?? "–"}</b> j'aime</span><span><b>{open.comments_count ?? "–"}</b> commentaires</span></div>
              <div className="note" style={{ margin: "0 0 12px" }}>{new Date(open.timestamp).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}{kind(open) ? " · " + kind(open) : ""}</div>
              <p className="feed__legende">{open.caption || "Sans légende."}</p>
              <h2 style={{ marginTop: 24 }}>Réponse automatique en DM</h2>
              {autosFor(open.id).length ? (
                <ul className="feed__autos">{autosFor(open.id).map((a) => (
                  <li key={a.id}><a href={`/instagram/${a.id}`}>{a.title}</a> <span className={"pill " + (a.active ? "pill--on" : "pill--off")}>{a.active ? "active" : "en pause"}</span>
                    <div className="note" style={{ margin: 0 }}>{a.match === "any" ? "tous les commentaires" : "mot-clé : " + a.keywords.join(", ")}{a.media_ids.length ? "" : " · tous les posts"}</div></li>
                ))}</ul>
              ) : <p className="note">Aucune sur ce post.</p>}
              <div className="actions" style={{ marginTop: 16 }}>
                <a className="btn" href={`/instagram/new?media=${open.id}`}>Créer une réponse DM sur ce post</a>
                <a className="btn btn--ghost" href={open.permalink} target="_blank" rel="noopener noreferrer">Voir sur Instagram ↗</a>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

const STATUTS = {
  programme: ["programmé", "pill"],
  a_publier: ["en file", "pill"],
  publication: ["publication…", "pill"],
  publie: ["publié", "pill pill--on"],
  erreur: ["erreur", "pill"],
};
const TYPES_POST = { image: "Photo", carousel: "Carrousel", reel: "Reel", story: "Story" };

function Publications({ autos }) {
  const [posts, setPosts] = useState(null);
  const [quota, setQuota] = useState(null);
  const load = () => fetch("/api/instagram/posts").then((r) => r.json()).then((d) => setPosts(Array.isArray(d) ? d : [])).catch(() => setPosts([]));
  useEffect(() => {
    load();
    fetch("/api/instagram/limit").then((r) => r.json()).then((d) => !d.error && setQuota(d)).catch(() => {});
    const t = setInterval(load, 8000); // suit les publications en cours
    return () => clearInterval(t);
  }, []);
  async function act(p, method) {
    if (method === "DELETE" && !confirm(p.status === "publie" ? "Retirer de la liste ? (le post reste sur Instagram)" : "Supprimer cette publication ?")) return;
    await fetch(`/api/instagram/posts/${p.id}`, { method });
    load();
  }
  const titre = (id) => (autos.find((a) => a.id === id) || {}).title || id;
  if (posts === null) return <div className="empty">Chargement…</div>;
  return (
    <>
      <div className="actions" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <span className="note" style={{ margin: 0 }}>{quota && quota.total ? `${quota.used} / ${quota.total} publications via l'API sur les dernières 24 h` : "Les posts programmés partent tout seuls à l'heure dite."}</span>
        <a className="btn" href="/instagram/publier">+ Publication</a>
      </div>
      {!posts.length ? (
        <div className="empty">Rien de publié depuis le BO pour l'instant. Prépare un post, choisis l'heure, et relie-le à une réponse automatique en DM.</div>
      ) : (
        <div className="bo-tableau"><table><thead><tr><th style={{ width: 76 }}></th><th>Publication</th><th>Quand</th><th>Statut</th><th>Réponse DM</th><th></th></tr></thead><tbody>
          {posts.map((p) => {
            const m = p.media[0] || {};
            const st = STATUTS[p.status] || [p.status, "pill"];
            return (
              <tr key={p.id}>
                <td>{m.path ? (m.type === "video"
                  ? <video src={`/api/preview?p=${encodeURIComponent(m.path)}`} muted style={{ width: 56, height: 70, objectFit: "cover", borderRadius: 10, display: "block" }} />
                  : <img src={`/api/preview?p=${encodeURIComponent(m.path)}`} alt="" style={{ width: 56, height: 70, objectFit: "cover", borderRadius: 10, display: "block" }} />) : null}</td>
                <td style={{ maxWidth: 360 }}>
                  <b>{TYPES_POST[p.kind]}{p.media.length > 1 ? ` · ${p.media.length} médias` : ""}</b>
                  <div className="note" style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.caption || "—"}</div>
                  {p.error ? <div style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 4 }}>{p.error}</div> : null}
                </td>
                <td style={{ fontSize: 13, whiteSpace: "nowrap" }}>{new Date(p.published_at || p.scheduled_at || p.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td><span className={st[1]}>{st[0]}</span></td>
                <td style={{ fontSize: 13 }}>{p.automation_id ? <a href={`/instagram/${p.automation_id}`}>{titre(p.automation_id)}</a> : p.automation ? (p.automation.mode === "new" ? `nouvelle : ${p.automation.keywords.join(", ")}` : titre(p.automation.id)) : "—"}</td>
                <td><div className="actions">
                  {p.permalink && <a className="btn btn--ghost btn--petit" href={p.permalink} target="_blank" rel="noopener noreferrer">Voir ↗</a>}
                  {(p.status === "erreur" || p.status === "programme") && <button className="btn btn--ghost btn--petit" onClick={() => act(p, "POST")}>{p.status === "erreur" ? "Relancer" : "Publier maintenant"}</button>}
                  {p.status !== "publication" && <button className="btn btn--danger btn--petit" onClick={() => act(p, "DELETE")}>×</button>}
                </div></td>
              </tr>
            );
          })}
        </tbody></table></div>
      )}
    </>
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
              {c.paused_until && Date.parse(c.paused_until) > Date.now() && !c.paused
                ? <button className="btn btn--ghost btn--petit" title={"Pause jusqu'à " + new Date(c.paused_until).toLocaleString("fr-FR")} onClick={() => patch(c.igsid, { resume: true })}>Reprendre</button>
                : <button className="btn btn--ghost btn--petit" onClick={() => patch(c.igsid, { paused: !c.paused })}>{c.paused ? "Réactiver" : "Pause"}</button>}
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

.feed { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; max-width: 760px; }
.feed__case { position: relative; aspect-ratio: 3/4; padding: 0; border: 0; background: var(--paper-3); overflow: hidden; cursor: pointer; display: block; }
.feed__case img, .feed__case video { width: 100%; height: 100%; object-fit: cover; display: block; transition: opacity .15s; }
.feed__case:hover img, .feed__case:hover video { opacity: .82; }
.feed__case--prevu img, .feed__case--prevu video { opacity: .55; }
.feed__case--prevu { box-shadow: inset 0 0 0 2px var(--ink); }
.feed__etiquette, .feed__type, .feed__dm { position: absolute; font-size: 11.5px; font-weight: 500; border-radius: 999px; padding: 3px 9px; }
.feed__etiquette { left: 8px; bottom: 8px; background: var(--ink); color: var(--paper); }
.feed__type { right: 8px; top: 8px; background: rgba(246,245,243,.92); color: var(--ink); }
.feed__dm { left: 8px; top: 8px; background: var(--ink); color: var(--paper); }
.feed__stats { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 10px 8px; font-size: 12.5px; color: #fff; background: linear-gradient(transparent, rgba(0,0,0,.55)); opacity: 0; transition: opacity .15s; text-align: left; }
.feed__case:hover .feed__stats, .feed__case:focus-visible .feed__stats { opacity: 1; }
.feed__voile { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,.35); display: flex; justify-content: flex-end; }
.feed__tiroir { position: relative; width: min(480px, 100%); height: 100%; overflow-y: auto; background: var(--paper); box-shadow: -1px 0 0 var(--rule); }
.feed__fermer { position: absolute; right: 14px; top: 14px; z-index: 2; width: 34px; height: 34px; border-radius: 50%; border: 0; background: rgba(246,245,243,.92); font-size: 20px; cursor: pointer; }
.feed__visuel img, .feed__visuel video { width: 100%; display: block; background: var(--paper-3); }
.feed__corps { padding: 20px 22px 40px; }
.feed__chiffres { display: flex; gap: 20px; font-size: 14px; margin-bottom: 4px; }
.feed__chiffres b { font-size: 20px; font-weight: 500; letter-spacing: -.02em; margin-right: 4px; }
.feed__legende { white-space: pre-line; font-size: 14px; line-height: 1.5; color: var(--ink); }
.feed__autos { list-style: none; display: grid; gap: 10px; }
@media (max-width: 700px) { .feed { gap: 2px; } }
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
.gdm-filtres { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; align-items: center; }
.gdm-filtres .pill { cursor: pointer; background: none; }
.gdm-filtres .pill.pill--on { background: var(--ink); color: var(--paper); }
.gdm-inbox { display: grid; grid-template-columns: 300px minmax(0, 1fr) 260px; border: 1px solid var(--rule-fort); background: #fff; height: calc(100vh - 300px); min-height: 480px; }
.gdm-inbox:not(.a-un-fil) { grid-template-columns: 300px minmax(0, 1fr); }
.gdm-inbox__liste { list-style: none; overflow-y: auto; border-right: 1px solid var(--rule); margin: 0; padding: 0; }
.gdm-conv { display: grid; gap: 4px; width: 100%; text-align: left; border: 0; border-bottom: 1px solid var(--rule); background: none; padding: 12px 14px; cursor: pointer; font: inherit; color: var(--ink); }
.gdm-conv:hover { background: var(--paper); }
.gdm-conv.est-actif { background: var(--paper-3); }
.gdm-conv__haut { display: flex; justify-content: space-between; gap: 8px; font-size: 13.5px; }
.gdm-conv__haut span { font-size: 11.5px; color: var(--ink-dim); }
.gdm-conv__texte { font-size: 13px; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gdm-conv.est-nonlu .gdm-conv__texte { color: var(--ink); font-weight: 500; }
.gdm-conv.est-nonlu .gdm-conv__haut b::before { content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--ink); margin-right: 6px; vertical-align: 1px; }
.gdm-conv__tags { display: flex; flex-wrap: wrap; gap: 4px; }
.gdm-tag { font-size: 11px; border: 1px solid var(--rule-fort); border-radius: 999px; padding: 1px 8px; color: var(--ink-2); white-space: nowrap; }
.gdm-tag--ok { border-color: var(--ok); color: var(--ok); }
.gdm-tag--noir { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.gdm-inbox__fil { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.gdm-inbox__fil > .empty { margin: auto; }
.gdm-fil__tete { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid var(--rule); }
.gdm-retour { display: none; }
.gdm-fil__msgs { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; background: var(--paper); }
.gdm-bulle { align-self: flex-start; max-width: 78%; background: #fff; border: 1px solid var(--rule); border-radius: 16px 16px 16px 4px; padding: 8px 12px; font-size: 14px; line-height: 1.45; white-space: pre-line; overflow-wrap: anywhere; }
.gdm-bulle span { display: block; font-size: 10.5px; color: var(--ink-dim); margin-top: 3px; }
.gdm-bulle--moi { align-self: flex-end; background: var(--ink); color: var(--paper); border-color: var(--ink); border-radius: 16px 16px 4px 16px; }
.gdm-bulle--moi span { color: rgba(246,245,243,.6); }
.gdm-fil__saisie { border-top: 1px solid var(--rule); padding: 12px 16px; display: grid; gap: 8px; }
.gdm-fil__saisie textarea, .gdm-inbox__fiche textarea { width: 100%; font: inherit; font-size: 14px; border: 1px solid var(--rule-fort); border-radius: 12px; padding: 8px 10px; resize: vertical; background: #fff; }
.gdm-fil__actions { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.gdm-inbox__fiche { border-left: 1px solid var(--rule); padding: 14px 16px; overflow-y: auto; font-size: 13.5px; }
.gdm-inbox__fiche h3 { font-size: 12px; font-weight: 500; color: var(--ink-dim); margin: 16px 0 6px; }
.gdm-inbox__fiche h3:first-child { margin-top: 0; }
.gdm-inbox__fiche dl { display: grid; gap: 2px; margin: 0; }
.gdm-inbox__fiche dt { font-size: 11.5px; color: var(--ink-dim); margin-top: 6px; }
.gdm-inbox__fiche dd { margin: 0; overflow-wrap: anywhere; }
.gdm-liens { list-style: none; display: grid; gap: 6px; margin: 0; padding: 0; }
.gdm-liens li { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; }
.gdm-liens li span { color: var(--ink-dim); white-space: nowrap; }
@media (max-width: 1100px) { .gdm-inbox, .gdm-inbox:not(.a-un-fil) { grid-template-columns: 280px minmax(0, 1fr); } .gdm-inbox__fiche { display: none; } }
@media (max-width: 760px) {
  .gdm-inbox, .gdm-inbox:not(.a-un-fil) { grid-template-columns: 1fr; height: calc(100vh - 240px); }
  .gdm-inbox.a-un-fil .gdm-inbox__liste { display: none; }
  .gdm-inbox:not(.a-un-fil) .gdm-inbox__fil { display: none; }
  .gdm-retour { display: inline-flex; }
}
`;
