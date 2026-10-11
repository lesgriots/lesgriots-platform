/* global React, window, document */
// ============================================================================
// FICHE FORMATION — gabarit « The Freelance Photographer » (12/09/2026)
// ----------------------------------------------------------------------------
// Chargé AVANT app.jsx (index.html). Il définit window.FormationTfp, que
// ProgramPage appelle en tout début pour les fiches de kind === "formation".
// Les workshops et événements gardent l'ancienne fiche à onglets.
//
// Tout le contenu vient de data.jsx (exporté par le BO) : rien n'est écrit en
// dur ici sauf les libellés de section. Les helpers (text, ctaHref, modales,
// TrainersInline, ProgramAccordion, normalizeStatus, sessionDateLabel…) sont
// ceux d'app.jsx — résolus à l'exécution, donc disponibles au rendu.
//
// Structure (validée écran par écran sur fiche-test-tfp.html) :
//   vidéo plein écran + titre → promesse mot à mot → accroche (overview 1) →
//   pour qui → objectifs → prérequis → moyens → programme par jour (écrans
//   sticky papier / noir) → certification → formateur → comment ça se passe →
//   programme détaillé + modalités (dépliants) → FAQ → avis → CTA final.
//   + barre de titre et barre de section sous le menu, carte de réservation
//   fixe (lg__cta-mini) masquée pendant le programme.
// ============================================================================

(function () {
  const { useState, useEffect, useRef } = React;

  // Découpe une chaîne de phrases en liste (« A. B. C. » → [A, B, C]).
  function sentences(str) {
    return String(str || "")
      .split(/\.\s+/)
      .map((s) => s.trim().replace(/\.$/, ""))
      .filter((s) => s.length > 0);
  }

  // Découpe un champ texte en { lead, note, items } : 1re phrase = chapeau,
  // phrases correspondant à `noteRe` = mention grise, le reste = liste fléchée.
  function splitField(str, noteRe) {
    const all = sentences(str);
    const lead = all.shift() || "";
    const note = noteRe ? all.filter((x) => noteRe.test(x)) : [];
    const items = noteRe ? all.filter((x) => !noteRe.test(x)) : all;
    return { lead, note: note.join(". "), items };
  }

  // Les noms sont saisis en capitales au BO (« MOOS COULIBALY ») ; la charte
  // interdit le mot tout en capitales, hors logo. On recasse en bas de casse
  // avec majuscule initiale, en gardant les traits d'union et les apostrophes.
  function nomPropre(str) {
    const v = String(str || "");
    if (/[a-zà-öø-ÿ]/.test(v)) return v; // déjà mixte : on n'y touche pas
    return v.toLowerCase().replace(/(^|[\s'’\-])([\p{L}])/gu, (m, sep, c) => sep + c.toUpperCase());
  }

  // Titre d'un module sans son préfixe « Module n — ».
  function moduleShort(title) {
    return String(title || "").replace(/^module\s*\d+\s*[—–-]\s*/i, "").trim();
  }

  // Bloc d'overview par titre (« À la fin de la formation », « Notre formation »…).
  function overviewBlock(f, re) {
    const list = Array.isArray(f.overview) ? f.overview : [];
    for (const b of list) {
      const head = Array.isArray(b) ? b[0] : b && b.title;
      const txt = Array.isArray(b) ? b[1] : b && b.text;
      const media = Array.isArray(b) ? b[2] : b && b.media;
      if (head && re.test(head)) return { head, text: txt || "", media: typeof media === "string" ? media : (media && media.src) || "" };
    }
    return null;
  }

  // Images de repli pour les écrans de jour : les médias de la fiche, en boucle.
  function dayImages(f) {
    const imgs = [];
    (Array.isArray(f.overview) ? f.overview : []).forEach((b) => {
      const m = Array.isArray(b) ? b[2] : b && b.media;
      const src = typeof m === "string" ? m : (m && m.src) || "";
      if (src && !/\.(mp4|webm|mov|m4v)$/i.test(src)) imgs.push(src);
    });
    if (f.media && f.media.type === "image" && f.media.src) imgs.push(f.media.src);
    return imgs;
  }

  // Promesse révélée mot à mot : section de 2 écrans, texte épinglé.
  function Promise_({ text: t, onCta, ctaLabel }) {
    const secRef = useRef(null);
    const h2Ref = useRef(null);
    const btnRef = useRef(null);
    useEffect(() => {
      const sec = secRef.current, h2 = h2Ref.current, btn = btnRef.current;
      if (!sec || !h2) return;
      const words = h2.querySelectorAll(".w");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const reveal = () => {
        if (reduce) return;
        const r = sec.getBoundingClientRect();
        const total = sec.offsetHeight - window.innerHeight;
        const p = Math.min(1, Math.max(0, -r.top / total));
        const k = p < 0.12 ? 0 : Math.round(((p - 0.12) / 0.68) * words.length);
        for (let i = 0; i < words.length; i++) words[i].classList.toggle("on", i < k);
        if (btn) btn.classList.toggle("on", p > 0.8);
      };
      reveal();
      window.addEventListener("scroll", reveal, { passive: true });
      window.addEventListener("resize", reveal);
      return () => { window.removeEventListener("scroll", reveal); window.removeEventListener("resize", reveal); };
    }, [t]);
    const words = String(t || "").trim().split(/\s+/);
    return (
      <section className="tfp__promise" ref={secRef} id="promesse">
        <div className="tfp__promise__pin">
          <h2 ref={h2Ref}>
            {words.map((w, i) => (
              <React.Fragment key={i}><span className="w">{w}</span>{i < words.length - 1 ? " " : ""}</React.Fragment>
            ))}
          </h2>
          <button type="button" className="tfp__btn" ref={btnRef} onClick={onCta}>{ctaLabel || "Demander une inscription"} →</button>
        </div>
      </section>
    );
  }

  // Liste d'attente — l'équivalent du « Join Waitlist » de TFP : quand aucune
  // session n'est ouverte, c'est ÇA l'offre, pas un formulaire décoratif posé
  // au-dessus d'une session qu'on peut déjà réserver. Poste sur le même
  // endpoint que la newsletter du site (Systeme.io via le BO), avec la
  // formation dans `source`.
  function Waitlist({ item }) {
    const [email, setEmail] = useState("");
    const [etat, setEtat] = useState("idle"); // idle | envoi | ok | erreur
    async function submit(e) {
      e.preventDefault();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEtat("erreur"); return; }
      setEtat("envoi");
      const cfg = (typeof window !== "undefined" && window.SITE_CONFIG) || {};
      try {
        const r = await fetch(cfg.subscribeEndpoint || "https://admin.lagriotheque.com/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, source: "liste-attente:" + item.id, consent: true }),
        });
        setEtat(r.ok ? "ok" : "erreur");
      } catch (err) { setEtat("erreur"); }
    }
    if (etat === "ok") {
      return <p className="tfp__wait__done">✓ C'est noté. Tu seras prévenu dès l'ouverture de la prochaine session.</p>;
    }
    return (
      <form className="tfp__wait" onSubmit={submit}>
        <label htmlFor="tfp-wait">Être prévenu de la prochaine session</label>
        <div className="tfp__wait__row">
          <input
            id="tfp-wait"
            type="email"
            placeholder="ton@email.com"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (etat === "erreur") setEtat("idle"); }}
          />
          <button type="submit" className="lg__cta-mini__btn" disabled={etat === "envoi"}>{etat === "envoi" ? "…" : "M'inscrire →"}</button>
        </div>
        {etat === "erreur" && <p className="tfp__wait__err">Vérifie ton email et réessaie.</p>}
        <p className="tfp__wait__fine">Un seul message, à l'ouverture des inscriptions. Pas de newsletter déguisée.</p>
      </form>
    );
  }

  function FormationTfp({ item }) {
    const f = item;
    const [showInscription, setShowInscription] = useState(false);
    const [cpfOpen, setCpfOpen] = useState(false);
    const [downloadOpen, setDownloadOpen] = useState(false);
    const pageRef = useRef(null);

    // Sessions à venir (même logique que ProgramPage).
    const upcoming = (window.SESSIONS || [])
      .filter((s) => sessionMatchesItem(s, item, "formation"))
      .sort((a, b) => parseSessionDate(a.date || a.dateLabel).sortKey.localeCompare(parseSessionDate(b.date || b.dateLabel).sortKey));

    // Média du hero : la vidéo de la fiche si c'en est une, sinon la vidéo du
    // catalogue (BO → catalogue.media) avec l'image de la fiche en poster.
    const ownVideo = f.media && /\.(mp4|webm|mov|m4v)$/i.test(f.media.src || "") ? f.media.src : "";
    const heroVideo = ownVideo || text("catalogue.media", "") || text("home.hero_video", "");
    const heroPoster = (f.media && f.media.poster) || (f.media && f.media.type === "image" ? f.media.src : "");

    const fin = overviewBlock(f, /fin de la formation/i);
    const accroche = (Array.isArray(f.overview) && f.overview[0] && !/notre formation|fin de la formation/i.test(Array.isArray(f.overview[0]) ? f.overview[0][0] : f.overview[0].title))
      ? { head: Array.isArray(f.overview[0]) ? f.overview[0][0] : f.overview[0].title, text: Array.isArray(f.overview[0]) ? f.overview[0][1] : f.overview[0].text, media: (() => { const m = Array.isArray(f.overview[0]) ? f.overview[0][2] : f.overview[0].media; return typeof m === "string" ? m : (m && m.src) || ""; })() }
      : null;
    const notre = overviewBlock(f, /notre formation/i);
    // 1er paragraphe = la promesse (écran plein, mot à mot) ; le paragraphe qui
    // parle du jury/certification alimente la section Certification.
    const finParas = fin ? String(fin.text).split(/\n\n/).map((x) => x.trim()).filter(Boolean) : [];
    const promise = finParas[0] || f.tagline || "";
    const certifText = finParas.slice(1).filter((x) => /jury|certification/i.test(x)).pop() || finParas[1] || f.evaluation || "";
    const finDetail = finParas.slice(1).filter((x) => !/jury|certification/i.test(x));
    const imgs = dayImages(f);
    const program = Array.isArray(f.program) ? f.program : [];
    const moyens = splitField(f.methods, /encadrement|adaptable|personnalis/i);
    const prereq = splitField(f.prerequisites, /admission|délai/i);
    const trainer = f.trainer || (window.TRAINERS || []).find((t) => t.id === f.trainer_id);
    // f.trainer ne porte que {name, role} : la bio vit dans TRAINERS (trainer_id).
    const trainerCard = Array.isArray(trainer) ? trainer[0] : trainer || {};
    const trainerFiche = (window.TRAINERS || []).find((t) => t.id === f.trainer_id || t.name === trainerCard.name) || {};
    const trainerBio = trainerFiche.bio || trainerCard.bio || "";
    const plusieursFormateurs = Array.isArray(trainer) && trainer.length > 1;
    const disciplineLabel = f.discipline ? f.discipline.toLowerCase() : "";
    // Le prix saisi au BO porte déjà sa mention (« 1 650 € TTC ») : on ne recolle
    // pas « HT » derrière, et la mention de TVA est la même partout.
    // Deux états de fiche, jamais trois : une session ouverte → on réserve ;
    // aucune session ouverte → liste d'attente (le « Join Waitlist » de TFP).
    const sessionOuverte = upcoming.some((sx) => normalizeStatus(sx.status).class === "open");
    const ctaTexte = sessionOuverte ? "Demander une inscription" : "Être prévenu de la prochaine session";
    const versReservation = () => {
      const el = document.getElementById("reserver");
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 160, behavior: "smooth" });
    };
    const ctaAction = sessionOuverte ? inscrire : versReservation;
    const prix = f.price || "—";
    const prixAffiche = /\b(TTC|HT)\b/i.test(prix) ? prix : prix + " HT";
    const mentionTva = "TVA non applicable, article 293 B du CGI";
    const hoursPerDay = 7;

    // ---- Barres, carte, menu : tout est piloté par le scroll --------------
    useEffect(() => {
      const root = pageRef.current;
      if (!root) return;
      const hero0 = root.querySelector(".tfp__hero"); if (!hero0) return;
      const header = document.querySelector(".lg__header");
      const hero = root.querySelector(".tfp__hero");
      const h1 = root.querySelector(".tfp__hero h1");
      const tb = document.querySelector(".tfp__titlebar");
      const sb = document.querySelector(".tfp__sectionbar");
      const sbName = document.querySelector("#tfp-sb-name");
      const sbCur = document.querySelector("#tfp-sb-cur");
      const sbCount = document.querySelector("#tfp-sb-count");
      const bar = document.querySelector(".tfp__bar");
      const secs = Array.from(root.querySelectorAll("[data-bar]"));
      const days = Array.from(root.querySelectorAll(".tfp__day"));
      let raf = false;
      const mesure = () => {
        raf = false;
        const hH = header ? header.offsetHeight : 121;
        // Titre → barre : dès que le panneau papier recouvre le titre du hero.
        const h1rel = h1 ? h1.getBoundingClientRect().top - hero.getBoundingClientRect().top : 0;
        const stuck = window.scrollY >= hero.offsetHeight - h1rel;
        tb.classList.toggle("is-stuck", stuck);
        tb.setAttribute("aria-hidden", stuck ? "false" : "true");
        document.documentElement.style.setProperty("--lg-title-h", tb.offsetHeight + "px");
        // Section courante sous les barres.
        const barsH = hH + tb.offsetHeight;
        let cur = null;
        for (const s of secs) {
          const r = s.getBoundingClientRect();
          if (r.top <= barsH + 1 && r.bottom > barsH + 1) cur = s;
        }
        const on = stuck && !!cur;
        sb.classList.toggle("is-on", on);
        sb.setAttribute("aria-hidden", on ? "false" : "true");
        if (on) {
          sbName.textContent = cur.getAttribute("data-bar");
          if (cur.hasAttribute("data-days") && days.length) {
            let k = 0;
            for (let i = 0; i < days.length; i++) if (days[i].getBoundingClientRect().top <= barsH + 1) k = i;
            const num = days[k].querySelector(".tfp__day__num");
            const h3 = days[k].querySelector("h3");
            sbCur.innerHTML = "<b>" + (num ? num.textContent : "") + "</b> · " + (h3 ? h3.textContent : "");
            sbCount.textContent = (k + 1) + " / " + days.length;
          } else { sbCur.textContent = ""; sbCount.textContent = ""; }
        }
        // Carte de réservation : visible après le hero, masquée pendant le programme.
        // Barre compacte (mobile) : dès qu'on a quitté la vidéo.
        bar.classList.toggle("is-on", stuck);
        bar.setAttribute("aria-hidden", stuck ? "false" : "true");
      };
      const onScroll = () => { if (!raf) { raf = true; requestAnimationFrame(mesure); } };
      mesure();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      document.body.classList.add("is-tfp");
      return () => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        document.body.classList.remove("is-tfp");
      };
    }, [f.id]);

    const inscrire = () => setShowInscription(true);

    // La carte de réservation du site (lg__cta-mini), posée DEUX FOIS dans le fil
    // de la page (après la promesse et après la FAQ), comme les deux blocs de prix
    // de The Freelance Photographer. Plus de carte flottante sur desktop : sur
    // mobile, c'est la barre compacte du bas (.tfp__bar) qui prend le relais.
    const carte = (
      <div className="lg__cta-mini">
                    <p className="lg__cta-mini__title">{f.title}</p>
                    <div className="lg__cta-mini__head">
                      <strong className="lg__cta-mini__price">{f.price || "—"}</strong>
                      <span className="lg__cta-mini__hint">{mentionTva}</span>
                    </div>
                    {(f.cpf || f.rs) && (
                      <p className="lg__cta-mini__cert"><span aria-hidden="true">✓</span> Formation certifiante{f.rs && <span className="lg__cta-mini__cert__code"> · {f.rs.replace(/^RS/i, "RS ")}</span>}</p>
                    )}
                    {(f.cpf || f.opco || f.faf || f.rs) && (
                      <div className="lg__cta-mini__badges">
                        {f.cpf && <span>CPF</span>}{f.opco && <span>OPCO</span>}{f.faf && <span>FAF</span>}{f.rs && <span>{f.rs.replace(/^RS/i, "RS ")}</span>}
                      </div>
                    )}
                    {f.format && <ul className="lg__cta-mini__meta"><li>{f.format}</li></ul>}
                    {upcoming.length > 0 ? (
                      <div className="lg__cta-mini__sessions">
                        <p className="lg__cta-mini__sessions__label">{upcoming.length > 1 ? "Prochaines sessions" : "Prochaine session"}</p>
                        <ul className="lg__cta-mini__sessions__list">
                          {upcoming.slice(0, 3).map((s) => {
                            const st = normalizeStatus(s.status);
                            return (
                              <li key={s.id} className="lg__cta-mini__session">
                                <span className="lg__cta-mini__session__date">{sessionDateLabel(s)}</span>
                                {s.location && <span className="lg__cta-mini__session__loc">{s.location}</span>}
                                <span className="lg__cta-mini__session__meta">
                                  <span className={"lg__cta-mini__session__status is-" + st.class}>{st.label}</span>
                                  {s.places && st.class === "open" && <span className="lg__cta-mini__session__places">· {s.places} place{Number(s.places) > 1 ? "s" : ""}</span>}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : (
                      <div className="lg__cta-mini__sessions">
                        <p className="lg__cta-mini__sessions__label">Prochaine session</p>
                        <p className="lg__cta-mini__session__date">Dates à venir</p>
                      </div>
                    )}
                    {f.duration && (
                      <div className="lg__cta-mini__sessions">
                        <p className="lg__cta-mini__sessions__label">Durée</p>
                        <p className="lg__cta-mini__session__date">{f.duration.toLowerCase().replace(/\s*·\s*/g, " / ").replace(/journée/g, "jour")}</p>
                      </div>
                    )}
                    {sessionOuverte ? (
                      <>
                        <button type="button" className="lg__cta-mini__btn" onClick={inscrire}>Demander une inscription →</button>
                        {f.cpf && <button type="button" className="lg__cta-mini__btn" onClick={() => setCpfOpen(true)}>S'inscrire via Mon Compte Formation</button>}
                      </>
                    ) : (
                      <Waitlist item={f} />
                    )}
                    <button type="button" className="lg__cta-mini__btn lg__cta-mini__btn--ghost" onClick={() => setDownloadOpen(true)}>↓ Télécharger le programme</button>
                    <a className="lg__cta-mini__sub" href="mailto:formations@lesgriots.com?subject=Devis%20OPCO%20%2F%20FAF">Étudier un financement</a>
                    {f.cpf && (
                      <div className="lg__cta-mini__cpfbox">
                        <img className="lg__cta-mini__cpfbox__logo" src="img/moncompteformation.webp" alt="Mon Compte Formation" />
                        <span className="lg__cta-mini__cpfbox__text">Finançable avec ton Compte Personnel de Formation</span>
                      </div>
                    )}
                  </div>
    );
    // Un seul bloc de réservation, à la fin : la carte du site + tout ce qui
    // touche à l'argent et à l'accès (tarif, franchise de TVA, financements,
    // délai, lieu), sortis des dépliants réglementaires pour ne pas être dits
    // deux fois. Sur mobile, la barre compacte du bas reprend prix + bouton.
    const blocReservation = (titre) => (
      <section className="tfp__offer" id="reserver" data-bar="Tarifs et financement">
        <div className="tfp__offer__grid">
          <div className="tfp__offer__txt">
            <h2>{titre}</h2>
            <p className="tfp__lead">{sessionOuverte ? "Prochaine session : " + sessionDateLabel(upcoming[0]) : "Les inscriptions rouvrent bientôt"}{f.duration ? " · " + f.duration.toLowerCase() : ""}{f.format ? " · " + f.format.toLowerCase() : ""}</p>
            <dl className="tfp__offer__lines">
              <div>
                <dt>Tarif</dt>
                <dd><strong>{prixAffiche}</strong> — montant net à payer. {mentionTva} : LES GRIOTS bénéficie de la franchise en base, aucune TVA n'est ajoutée.</dd>
              </div>
              {(f.cpf || f.opco || f.faf) && (
                <div>
                  <dt>Financements</dt>
                  <dd>Prise en charge possible {[f.cpf && "CPF", f.opco && "OPCO", f.faf && "FAF"].filter(Boolean).join(" · ")}.{f.cpf ? " La réservation CPF se fait depuis Mon Compte Formation." : ""}</dd>
                </div>
              )}
              <div>
                <dt>Délai d'accès</dt>
                <dd>{text("faq.a_delais", "Réponse à toute demande sous 48h ouvrées. Inscription possible jusqu'à 14 jours avant le démarrage de la session, dans la limite des places disponibles.")}</dd>
              </div>
              {f.location && (
                <div>
                  <dt>Lieu</dt>
                  <dd>{f.location}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="tfp__offer__card">{carte}</div>
        </div>
      </section>
    );


    return (
      <section className="lg__formation tfp" ref={pageRef}>
        {/* Barres et carte : position fixed → portées dans <body> (le <main> du
            site est animé/transformé à chaque route, ce qui casserait le fixed). */}
        {ReactDOM.createPortal(
          <div className="tfp__fixed">
        {/* ---- Barre de titre (reprise de .lg__formation__title.is-stuck) ---- */}
            <div className="tfp__titlebar" aria-hidden="true">
              <div className="tfp__titlebar__title">{f.title}</div>
              <div className="tfp__titlebar__meta">
                {f.duration && <span className="dur">{formatDuration(f.duration) || f.duration}</span>}
                {f.price && <span>{f.price}</span>}
                <button type="button" onClick={ctaAction}>{ctaTexte}</button>
              </div>
            </div>
            {/* ---- Barre de section --------------------------------------------- */}
            <div className="tfp__sectionbar" aria-hidden="true">
              <span className="tfp__sectionbar__name" id="tfp-sb-name"></span>
              <span className="tfp__sectionbar__cur" id="tfp-sb-cur"></span>
              <span className="tfp__sectionbar__count" id="tfp-sb-count"></span>
            </div>


            {/* Barre compacte du bas, mobile uniquement (habitude du site). */}
            <div className="tfp__bar" aria-hidden="true">
              <div className="tfp__bar__price"><strong>{f.price || "—"}</strong>{f.duration && <span>{f.duration.toLowerCase()}</span>}</div>
              <button type="button" className="tfp__btn" onClick={ctaAction}>{sessionOuverte ? "Demander une inscription →" : "Être prévenu →"}</button>
            </div>

          </div>,
          document.body
        )}

        {/* ---- 1. Hero : vidéo plein écran, titre par-dessus ----------------- */}
        <div className="lg__pagehero tfp__hero">
          {heroVideo ? (
            <video src={heroVideo} poster={heroPoster || undefined} autoPlay loop muted playsInline preload="metadata" />
          ) : heroPoster ? (
            <img src={heroPoster} alt="" />
          ) : null}
          <div className="tfp__hero__txt">
            {(f.cpf || f.rs) && <span className="tfp__pill">Formation certifiante{f.rs ? " · " + f.rs.replace(/^RS/i, "RS ") : ""}{f.cpf ? " · éligible CPF" : ""}</span>}
            <h1>{f.title}</h1>
            {f.tagline && <p className="tfp__lead">{f.tagline}</p>}
            <div className="tfp__hero__cta">
              <button type="button" className="tfp__btn tfp__btn--paper" onClick={ctaAction}>{ctaTexte} →</button>
              <small>{[disciplineLabel, f.duration && f.duration.toLowerCase()].filter(Boolean).join(" · ")}</small>
            </div>
          </div>
        </div>

        <div className="tfp__after">
          {/* ---- 2. Promesse plein écran, mot à mot ------------------------- */}
          {promise && <Promise_ text={promise} onCta={ctaAction} ctaLabel={ctaTexte} />}

          {/* ---- 3. Accroche (1er bloc Aperçu) ------------------------------ */}
          {accroche && (
            <section className="tfp__split" data-bar="Pourquoi">
              <div className="tfp__split__txt">
                <h2>{accroche.head}</h2>
                {String(accroche.text).split(/\n\n/).map((p, i) => <p key={i}>{p}</p>)}
              </div>
              {accroche.media && <div className="tfp__split__img" style={{ backgroundImage: "url(" + accroche.media + ")" }} />}
            </section>
          )}

          {/* ---- 4. Pour qui ------------------------------------------------ */}
          {(f.audience || (Array.isArray(f.audience_points) && f.audience_points.length)) && (
            <section className="tfp__two" data-bar="Public">
              <div>
                <h2>Pour qui</h2>
                {f.audience && <p className="tfp__lead">{f.audience}</p>}
                {prereq.note && <p className="tfp__fine">{prereq.note}.</p>}
              </div>
              {Array.isArray(f.audience_points) && f.audience_points.length > 0 && (
                <ul className="tfp__arrows">{f.audience_points.map((pt, i) => <li key={i}>{pt}</li>)}</ul>
              )}
            </section>
          )}

          {/* ---- 5. Objectifs pédagogiques ---------------------------------- */}
          {Array.isArray(f.objectives) && f.objectives.length > 0 && (
            <section className="tfp__obj" data-bar="Objectifs pédagogiques">
              <h2>Objectifs pédagogiques</h2>
              <p className="tfp__lead">{(f.rs ? "Les " + f.objectives.length + " compétences du référentiel " + f.rs.replace(/^RS/i, "RS ") + ". " : "") + (program.length > 1 ? "À la fin des " + program.length + " jours, tu sais :" : "À la fin de la formation, tu sais :")}</p>
              <div className="tfp__obj__grid">{f.objectives.map((o, i) => <div key={i}>{o}</div>)}</div>
            </section>
          )}

          {/* ---- 6. Prérequis ----------------------------------------------- */}
          {(prereq.lead || prereq.items.length > 0) && (
            <section className="tfp__two" data-bar="Prérequis et admission">
              <div><h2>Prérequis</h2>{prereq.lead && <p className="tfp__lead">{prereq.lead}.</p>}{prereq.note && <p className="tfp__fine">{prereq.note}.</p>}</div>
              <ul className="tfp__arrows">{prereq.items.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </section>
          )}

          {/* ---- 7. Moyens pédagogiques ------------------------------------- */}
          {(moyens.lead || moyens.items.length > 0) && (
            <section className="tfp__two" data-bar="Moyens pédagogiques">
              <div><h2>Moyens pédagogiques</h2>{moyens.lead && <p className="tfp__lead">{moyens.lead}.</p>}{moyens.note && <p className="tfp__fine">{moyens.note}.</p>}</div>
              <ul className="tfp__arrows">{moyens.items.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </section>
          )}

          {/* ---- 8. Programme par jour, écrans sticky ------------------------ */}
          {program.length > 0 && (
            <>
              <section className="tfp__prog__intro" id="programme" data-bar="Programme">
                <span className="tfp__pill">{program.length} journée{program.length > 1 ? "s" : ""}{f.duration ? " · " + f.duration.split("·")[0].trim().toLowerCase() : ""}</span>
                <h2>Programme</h2>
                {notre ? String(notre.text).split(/\n\n/).map((p, i) => <p key={i}>{p}</p>) : <p>{program.length} jours, un par écran.</p>}
              </section>
              <div className="tfp__stack" data-bar="Programme" data-days>
                {program.map((d, i) => {
                  const mods = Array.isArray(d.modules) ? d.modules : [];
                  const pts = mods.reduce((n, m) => n + (Array.isArray(m.items) ? m.items.length : 0), 0);
                  const theme = d.title || mods.map((m) => moduleShort(m.title)).join(" et ");
                  const img = d.image || imgs[i % (imgs.length || 1)] || "";
                  const label = d.day ? d.day.charAt(0).toUpperCase() + d.day.slice(1) : "Jour " + (i + 1);
                  return (
                    <article className="tfp__day" key={i}>
                      <div className="tfp__day__txt">
                        <div className="tfp__day__num">{label}</div>
                        <h3>{theme}</h3>
                        {d.promise && <p>{d.promise}</p>}
                        <div className="tfp__day__mods">
                          {mods.map((m, j) => (
                            <div className="tfp__day__m" key={j}>
                              <h4>{m.title}</h4>
                              {Array.isArray(m.items) && <ul>{m.items.map((it, k) => <li key={k}>{it}</li>)}</ul>}
                            </div>
                          ))}
                        </div>
                        {Array.isArray(d.exercises) && d.exercises.length > 0 && (
                          <p className="tfp__day__ex"><b>Ateliers</b> {d.exercises.join(" · ")}</p>
                        )}
                        <div className="tfp__day__meta"><b>{hoursPerDay} h</b><span>·</span><span>{mods.length} module{mods.length > 1 ? "s" : ""}</span><span>·</span><span>{pts} points</span></div>
                      </div>
                      <div className="tfp__day__img">{img && <img src={img} alt="" loading="lazy" />}</div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {/* ---- 8 bis. Ce que tu repars avec (f.included) --------------- */}
          {Array.isArray(f.included) && f.included.length > 0 && (
            <section className="tfp__deliv" data-bar="Ce que tu repars avec">
              <h2>Ce que tu repars avec</h2>
              <p className="tfp__lead">Tu ne pars jamais d'une page blanche. Tout se construit sur ton projet réel, pendant la formation.</p>
              <div className="tfp__deliv__grid">
                {f.included.map((it, i) => {
                  const parts = String(it).split(/\s*:\s*/);
                  return <div key={i}>{parts[0]}{parts[1] && <small>{parts.slice(1).join(" : ")}</small>}</div>;
                })}
              </div>
            </section>
          )}

          {/* ---- 9. Certification ------------------------------------------- */}
          {f.rs && (
            <section className="tfp__split" data-bar="Certification">
              <div className="tfp__split__txt">
                <span className="tfp__pill">Après la formation</span>
                <h2>La certification</h2>
                <p>{certifText}</p>
                <p className="tfp__fine">{[f.rs.replace(/^RS/i, "RS "), "France Compétences", f.certifier && "certificateur " + f.certifier].filter(Boolean).join(" · ")}{f.franceCompetencesUrl && <> · <a href={f.franceCompetencesUrl} target="_blank" rel="noopener">référentiel</a></>}</p>
              </div>
              {imgs[1] && <div className="tfp__split__img" style={{ backgroundImage: "url(" + imgs[1] + ")" }} />}
            </section>
          )}

          {/* ---- 10. Formateur ---------------------------------------------- */}
          {trainer && (
            <section className={"tfp__trainer" + (trainerFiche.photo ? " has-photo" : "") + (plusieursFormateurs ? " is-multi" : "")} data-bar="Formateur">
              <div className="tfp__trainer__txt">
                <span className="tfp__pill">{plusieursFormateurs ? "Animée par" : "Animée par"}</span>
                {/* Un seul formateur : son nom EST le titre, et sa bio suit. À plusieurs,
                    on garde la liste dépliante du site (TrainersInline). */}
                <h2>{plusieursFormateurs ? "Les formateurs" : nomPropre(trainerCard.name || trainerFiche.name || "Le formateur")}</h2>
                {!plusieursFormateurs && (trainerCard.role || trainerFiche.role) && (
                  <p className="tfp__trainer__role">{trainerCard.role || trainerFiche.role}</p>
                )}
                {!plusieursFormateurs && (trainerBio || f.description) && String(trainerBio || f.description).split(/\n\n/).map((para, i) => (
                  <p className={i === 0 ? "tfp__lead" : "tfp__trainer__para"} key={i}>{para}</p>
                ))}
              </div>
              {plusieursFormateurs ? (
                <div className="tfp__trainer__list"><TrainersInline trainers={trainer} /></div>
              ) : trainerFiche.photo ? (
                <div className="tfp__trainer__photo" style={{ backgroundImage: "url(" + trainerFiche.photo + ")" }} />
              ) : null}
            </section>
          )}

          {/* ---- 11. Comment ça se passe ------------------------------------ */}
          <section className="tfp__steps" data-bar="Comment ça se passe">
            <h2>Comment ça se passe</h2>
            <div className="tfp__steps__grid">
              <div><span className="k">Étape 1</span><h3>Un entretien</h3><p>Par téléphone, en visio ou en présentiel. On vérifie que la formation répond à ton projet, et que tu as le matériel : ordinateur, connexion, téléphone.</p></div>
              <div><span className="k">Étape 2</span><h3>Ton dossier</h3><p>{text("faq.a_delais", "Réponse à toute demande sous 48h ouvrées. Inscription possible jusqu'à 14 jours avant le démarrage de la session, dans la limite des places disponibles.")}{f.cpf ? " Pour le CPF, la réservation se fait depuis Mon Compte Formation." : ""}</p></div>
              <div><span className="k">Étape 3</span><h3>{program.length > 1 ? (program.length === 4 ? "Quatre jours" : program.length + " jours") : "La formation"}</h3><p>{[f.duration && f.duration.toLowerCase(), f.format && f.format.toLowerCase()].filter(Boolean).join(" · ")}{f.rs ? ". Puis la certification, dans les semaines qui suivent, chez le certificateur." : "."}</p></div>
            </div>
          </section>

          {/* ---- 12. Programme détaillé + modalités (réglementaire) --------- */}
          <section className="tfp__reg" id="detail" data-bar="Programme détaillé et modalités">
            <h2>Programme détaillé et modalités</h2>
            <p className="tfp__hint">Tout ce que la formation professionnelle exige de publier, au complet.</p>
            <div className="tfp__reg__grid">
              {program.length > 0 && <details open><summary>Programme jour par jour</summary><div className="body"><ProgramAccordion program={program} /></div></details>}
              {f.evaluation && <details><summary>Modalités d'évaluation</summary><div className="body"><p>{f.evaluation}</p></div></details>}
              {f.accessibility && <details><summary>Accessibilité handicap</summary><div className="body"><p>{f.accessibility}</p></div></details>}
              <details><summary>Indicateurs</summary><div className="body"><p>Indicateurs de satisfaction et de recommandation publiés après chaque session. La Griothèque démarre sa première promotion en 2025 — les premiers chiffres seront disponibles à l'issue.</p></div></details>
              <details><summary>Contact</summary><div className="body"><p>Une question sur cette formation, sur le financement, ou sur l'inscription ? Écris-nous : <a href={"mailto:formations@lesgriots.com?subject=Question%20—%20" + encodeURIComponent(f.title)}>formations@lesgriots.com</a>. Référent handicap : <a href="mailto:formations@lesgriots.com?subject=Accessibilité">formations@lesgriots.com</a>.</p></div></details>
            </div>
          </section>

          {/* ---- 13. FAQ (textes du BO, section « faq ») -------------------- */}
          <section className="tfp__faq" data-bar="Questions fréquentes">
            <h2>Questions fréquentes</h2>
            <details><summary>{text("faq.q_cpf", "Puis-je financer cette formation via mon CPF ?")}</summary><div className="body">{f.cpf ? text("faq.a_cpf_yes", "Oui, cette formation est éligible CPF. Tu peux t'inscrire directement depuis Mon Compte Formation.") : text("faq.a_cpf_no", "Cette formation n'est pas éligible CPF, mais des prises en charge OPCO ou FAF sont possibles selon ton statut. Contacte-nous pour étudier un montage.")}</div></details>
            <details><summary>{text("faq.q_delais", "Quels sont les délais d'inscription ?")}</summary><div className="body">{text("faq.a_delais", "Réponse à toute demande sous 48h ouvrées. Inscription possible jusqu'à 14 jours avant le démarrage de la session, dans la limite des places disponibles.")}</div></details>
            <details><summary>{text("faq.q_apres", "Que se passe-t-il après la formation ?")}</summary><div className="body">{text("faq.a_apres", "Tu reçois une attestation de fin de formation. Pour les formations certifiantes, le passage de certification est intégré.")}</div></details>
            <details><summary>{text("faq.q_handicap", "La formation est-elle accessible aux personnes en situation de handicap ?")}</summary><div className="body">{f.accessibility || text("faq.a_handicap_fallback", "Oui. Contacte notre référent handicap pour un entretien préalable et adapter les modalités à ta situation.")}</div></details>
            {Array.isArray(f.faq) && f.faq.map((qa, i) => (
              <details key={i}><summary>{qa.q}</summary><div className="body">{qa.a}</div></details>
            ))}
          </section>

          {/* ---- 14. Prochaine session — calqué sur le « Upcoming Events »
               de TFP : colonne centrée 700 px, pastille, gros titre centré,
               sous-titre gris, puis les lignes date ↔ détail, justifiées. */}
          <section className="tfp__next" data-bar="Prochaine session">
            <div className="tfp__next__col">
              <p className="tfp__pill">Sessions</p>
              <h2 className="tfp__next__title">{upcoming.length > 1 ? "Prochaines sessions" : "Prochaine session"}</h2>
              <p className="tfp__next__sub">{[f.duration, f.format].filter(Boolean).join(" · ").toLowerCase()}</p>
              <ul className="tfp__next__list">
                {upcoming.length > 0 ? upcoming.slice(0, 5).map((s) => {
                  const st = normalizeStatus(s.status);
                  const meta = [s.location, st.label, s.places && st.class === "open" ? s.places + " place" + (Number(s.places) > 1 ? "s" : "") : ""].filter(Boolean).join(" · ");
                  return (
                    <li key={s.id} className="tfp__next__row">
                      <time className="tfp__next__date">{sessionDateLabel(s)}</time>
                      <span className={"tfp__next__meta is-" + st.class}>{meta}</span>
                    </li>
                  );
                }) : (
                  <li className="tfp__next__row">
                    <time className="tfp__next__date">Dates à venir</time>
                    <span className="tfp__next__meta">prochaine promotion en préparation · liste d'attente ouverte</span>
                  </li>
                )}
              </ul>
              <button type="button" className="tfp__btn tfp__next__cta" onClick={ctaAction}>{ctaTexte}</button>
            </div>
          </section>

          {/* ---- 14. Réserver : le seul bloc de prix, tout à la fin ---------- */}
          {blocReservation("Réserver ma place")}

                    {/* ---- 14. Avis + CTA final (repris de la fiche actuelle) ---------- */}
          <section className="lg__avis" aria-label="Avis" data-bar="Avis">
            <h2 className="lg__avis__title">Avis</h2>
            <p className="lg__avis__text">Les premiers avis seront publiés à l'issue des sessions 2025-2026. La Griothèque démarre sa première promotion en 2025 — les indicateurs de satisfaction et de recommandation seront accessibles ici dès le bilan de la promo.</p>
          </section>
          <div className="lg__cta-final">
            {heroVideo ? <video className="lg__cta-final__bg" src={heroVideo} poster={heroPoster || undefined} autoPlay loop muted playsInline aria-hidden="true" /> : heroPoster ? <img className="lg__cta-final__bg" src={heroPoster} alt="" aria-hidden="true" /> : null}
            <div className="lg__cta-final__veil" aria-hidden="true" />
            <div className="lg__cta-final__inner">
              <p className="lg__cta-final__kicker">Prêt à commencer ?</p>
              <h2 className="lg__cta-final__title">{f.title}</h2>
              {f.price && <p className="lg__cta-final__price">{f.price}<span className="lg__cta-final__price__ht"> HT</span></p>}
              <button type="button" className="lg__cta-final__btn" onClick={ctaAction}>{ctaTexte} →</button>
            </div>
          </div>
        </div>

        {/* ---- Modales (mêmes composants que la fiche actuelle) ------------- */}
        {downloadOpen && <DownloadModal item={item} onClose={() => setDownloadOpen(false)} />}
        {cpfOpen && <CpfModal item={item} onClose={() => setCpfOpen(false)} />}
        {showInscription && <InscriptionModal target={{ id: f.id, title: f.title }} kind="formation" onClose={() => setShowInscription(false)} />}
      </section>
    );
  }

  window.FormationTfp = FormationTfp;
})();
