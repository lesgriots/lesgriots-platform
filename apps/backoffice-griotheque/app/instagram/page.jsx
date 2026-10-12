// Griot DM — tableau de bord des automatisations Instagram.
// Quatre onglets : Automatisations · Contacts · Journal · Simulateur.
// L'en-tête dit en un coup d'œil si le branchement Meta est vivant.
"use client";
import { useEffect, useState } from "react";
import { CSS as FORM_CSS } from "../components/AutomationForm";

const ONGLETS = [
  ["feed", "Feed"],
  ["automatisations", "Automatisations"],
  ["publications", "Publications"],
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
        <div className="actions"><a className="btn btn--ghost" href="/instagram/publier">+ Publication</a><a className="btn" href="/instagram/new">+ Automatisation</a></div>
      </div>

      <Etat status={status} onRefresh={reload} />

      <div className="gdm-onglets" role="tablist">
        {ONGLETS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "est-actif" : ""} onClick={() => go(k)}>{l}</button>
        ))}
      </div>

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
`;
