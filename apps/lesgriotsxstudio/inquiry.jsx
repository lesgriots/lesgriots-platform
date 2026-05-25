/* global React, useLang, tr */
// Inquiry modal — terminal-styled contact form.

const { useState: useStateQ, useEffect: useEffectQ } = React;

function InquiryModal({ open, onClose }) {
  const lang = useLang();
  const [form, setForm] = useStateQ({
    name: "", company: "", email: "",
    services: { campaign: false, video: false, production: false, brand: false, stage: false },
    description: "", budget: "",
  });
  const [sent, setSent] = useStateQ(false);

  useEffectQ(() => {
    if (!open) { setSent(false); }
  }, [open]);

  useEffectQ(() => {
    const onKey = (e) => { if (e.key === "Escape" && open) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleSvc = (k) => setForm((f) => ({ ...f, services: { ...f.services, [k]: !f.services[k] } }));

  const submit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  const services = [
    { id: "brand",      label: tr("about.svc.brand",      lang) },
    { id: "creative",   label: tr("about.svc.creative",   lang) },
    { id: "stage",      label: tr("about.svc.stage",      lang) },
    { id: "production", label: tr("about.svc.production", lang) },
    { id: "video",      label: tr("filt.music",           lang) + " / FILM" },
  ];

  const budgets = [
    "< 25K €",
    "25K – 50K €",
    "50K – 100K €",
    "100K € +",
  ];

  return (
    <div className="inq" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="inq__panel" onClick={(e) => e.stopPropagation()}>
        <div className="inq__head">
          <span><span className="dot"></span>{tr("inq.title", lang)}</span>
          <button onClick={onClose} className="inq__close">
            <span className="key">[X]</span> {tr("inq.close", lang)}
          </button>
        </div>

        {sent ? (
          <div className="inq__thanks">
            <pre className="inq__ascii">{`
  ✓ TRANSMITTED
  ─────────────`}</pre>
            <p>{tr("inq.thanks", lang)}</p>
            <button className="inq__send" onClick={onClose}>{tr("inq.close", lang)}</button>
          </div>
        ) : (
          <form className="inq__form" onSubmit={submit}>
            <p className="inq__lead">{tr("inq.subtitle", lang)}</p>

            <div className="inq__grid">
              <label className="inq__field">
                <span>{tr("inq.name", lang)} <em>*</em></span>
                <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
              </label>
              <label className="inq__field">
                <span>{tr("inq.company", lang)}</span>
                <input value={form.company} onChange={(e) => set("company", e.target.value)} />
              </label>
              <label className="inq__field inq__field--full">
                <span>{tr("inq.email", lang)} <em>*</em></span>
                <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </label>
            </div>

            <fieldset className="inq__group">
              <legend>{tr("inq.services", lang)}</legend>
              <div className="inq__chips">
                {services.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={"inq__chip" + (form.services[s.id] ? " is-on" : "")}
                    onClick={() => toggleSvc(s.id)}>
                    <span className="box">[{form.services[s.id] ? "×" : " "}]</span> {s.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="inq__group">
              <legend>{tr("inq.budget", lang)} <em>*</em></legend>
              <div className="inq__chips">
                {budgets.map((b) => (
                  <button
                    type="button"
                    key={b}
                    className={"inq__chip" + (form.budget === b ? " is-on" : "")}
                    onClick={() => set("budget", b)}>
                    <span className="box">[{form.budget === b ? "×" : " "}]</span> {b}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="inq__field inq__field--full">
              <span>{tr("inq.description", lang)} <em>*</em></span>
              <textarea required rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </label>

            <div className="inq__actions">
              <button type="button" className="inq__cancel" onClick={onClose}>{tr("inq.cancel", lang)}</button>
              <button type="submit" className="inq__send">{tr("inq.send", lang)} ▶</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

window.InquiryModal = InquiryModal;
