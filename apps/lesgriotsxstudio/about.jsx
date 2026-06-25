/* global React, Type, useLang, tr, MatrixGriot */

// Helper — cumulative delay so each Type starts only after the previous
// ones in the sequence have finished typing. Same idea as the intro block.
function cascadeDelays(items, baseDelay = 0, gap = 200) {
  const delays = [];
  let acc = baseDelay;
  for (const it of items) {
    delays.push(acc);
    acc += it.text.length * it.speed + gap;
  }
  return delays;
}

function AboutView() {
  const lang = useLang();
  // Le back office peut surcharger l'intro via window.SITE_CONTENT.aboutIntro.
  // Si rien n'a été défini, on retombe sur la version i18n hard-codée.
  const override = (typeof window !== "undefined" && window.SITE_CONTENT && window.SITE_CONTENT.aboutIntro)
    ? window.SITE_CONTENT.aboutIntro[lang]
    : null;
  const intro = Array.isArray(override) && override.length ? override : tr("about.intro", lang);

  // Services — titre + N lignes de service, cascadées.
  // Le back office peut surcharger la liste via window.SITE_CONTENT.services
  // = { en: ["BRAND STRATEGY", ...], fr: ["STRATÉGIE DE MARQUE", ...] }.
  // Si rien n'est défini, on retombe sur les 4 services i18n hard-codés.
  const svcOverride = (typeof window !== "undefined" && window.SITE_CONTENT && window.SITE_CONTENT.services)
    ? window.SITE_CONTENT.services[lang]
    : null;
  const svcLines = (Array.isArray(svcOverride) && svcOverride.length)
    ? svcOverride
    : [
        tr("about.svc.brand",      lang),
        tr("about.svc.creative",   lang),
        tr("about.svc.stage",      lang),
        tr("about.svc.production", lang),
        tr("about.svc.special",    lang),
      ];
  const servicesItems = [
    { text: tr("about.services", lang), speed: 40, key: "sv" },
    ...svcLines.map((text, i) => ({ text, speed: 28, key: "s" + i })),
  ];
  const servicesDelays = cascadeDelays(servicesItems, 400, 250);

  // Contact — title + email + handle Instagram, cascaded
  const contactItems = [
    { text: tr("about.contact", lang),   speed: 40, key: "co"   },
    { text: "studio@lesgriots.com",      speed: 28, key: "co-m" },
    { text: "@lesgriotsxstudio",         speed: 28, key: "co-ig" },
  ];
  const contactDelays = cascadeDelays(contactItems, 600, 250);

  return (
    <div className="about-min">
      <section className="about-min__intro">
        {intro.map((t, i) => {
          // Each paragraph waits for the previous ones to finish typing
          // so the whole intro plays letter by letter, top to bottom.
          const speed = 22;
          const prevDuration = intro
            .slice(0, i)
            .reduce((acc, s) => acc + s.length * speed + 250, 0);
          return (
            <p key={lang + "-" + i}>
              <Type
                text={t}
                speed={speed}
                delay={prevDuration}
                cursor={i === intro.length - 1 ? "always" : "while"}
              />
            </p>
          );
        })}
      </section>

      <section className="about-min__col">
        <h6>
          <Type
            text={servicesItems[0].text}
            speed={servicesItems[0].speed}
            delay={servicesDelays[0]}
            cursor="while"
            key={servicesItems[0].key + "-" + lang}
          />
        </h6>
        <ul>
          {servicesItems.slice(1).map((it, i) => {
            // index in the full cascade = i + 1, last item gets persistent caret
            const idx = i + 1;
            const isLast = idx === servicesItems.length - 1;
            return (
              <li key={it.key + "-" + lang}>
                <Type
                  text={it.text}
                  speed={it.speed}
                  delay={servicesDelays[idx]}
                  cursor={isLast ? "always" : "while"}
                  key={it.key + "-" + lang}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="about-min__col">
        <h6>
          <Type
            text={contactItems[0].text}
            speed={contactItems[0].speed}
            delay={contactDelays[0]}
            cursor="while"
            key={contactItems[0].key + "-" + lang}
          />
        </h6>
        <p className="about-min__person">
          <a href="mailto:studio@lesgriots.com">
            <Type
              text={contactItems[1].text}
              speed={contactItems[1].speed}
              delay={contactDelays[1]}
              cursor="while"
              key={contactItems[1].key + "-" + lang}
            />
          </a>
        </p>
        <p className="about-min__person">
          <a
            href="https://www.instagram.com/lesgriotsxstudio"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Type
              text={contactItems[2].text}
              speed={contactItems[2].speed}
              delay={contactDelays[2]}
              cursor="always"
              key={contactItems[2].key + "-" + lang}
            />
          </a>
        </p>
      </section>

      <div className="about-min__griot" aria-hidden="true">
        <MatrixGriot />
      </div>

    </div>
  );
}

window.AboutView = AboutView;
