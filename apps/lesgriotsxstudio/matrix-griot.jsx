/* global React */
// Matrix-style ASCII griot — displays the brand's griot figure as a grid
// of 0s and 1s that flicker like the Matrix. Sits as a faint background.
// Click → triggers a site-wide "binarize" easter egg: every text node
// across the page is briefly replaced with random 0/1 digits.

const ASCII_GRIOT = `
                                            000000                                          110101111         
                                        0111111111110                                       111 0011          
                                      0111111111111111                                     111  011           
                                     0111111110111111111                                  0 0100111 010       
                                    01111111101001000111                                 1  0000111           
                                    011111111110001   111                              11 100  1110010        
                                    01001111111001     01                             10 101100111  11        
                                    00011 111000000 0 011                            00 0011110110            
                                    00 010111 0  01   11                             0 1 10 11111 011         
                                   1111111111   11011111                           11 0 1 0  0111             
                                  1110111111010 101 111                           11 0 0 11010 01111          
                           010000111010111100001010 00                            101 0 11010111 000          
                      1001010100  11010111111010001111                          0001 0011110000001            
                 00101     010  1 010011111111110011                           01 1010111 011110111           
                00  0 1     010011  11111111111110  01                        0  1000 01 0  010               
              10         0   000  0100111110 11101   001                     1  0 10 111 000111111            
            10                0010 110  00  1  0010    11                   10 0 111 11   0111 11             
           11          01     0101 0101  0 10101 01      00                10 1 10  000 1111001               
          01  1     0   0   1  011110101 0  10110101 1    0               01 0 10 1001 011110111              
          1  0       0  010  0  1010011101  110010   0    011            01 1 1 0011000100101                 
        01  10        00 010     1 00 0100 1 100 10  0     111         011 0 1 010 0100 11110110              
        11  10         10111      10110 01  1 11001  1      111       011 0 1 1 0 01001 110                   
        0 1 0           1 111     1 10  011 11 1110  10 0    00      011 0 1 0 0  01 011111110                
      00 1010            101101    100111010100  10   11      01    1110  0 1 10 111  1111  000               
      10 010               1010    0111 00111100001   11  01   01  0111  1 1 1010001110101                    
     10 011         010     011     010010 011010000  1 0010 1001001 1101 0 0111 1100011110111                
     01 001            010   001    0011001 11000010  1111       11 1001 0 0111 1001 011                      
    010 0 0              0111 01    011010   1 0 1011 1   10     1 0000 010 11  10 011111111                  
    001000  00001       0   00101    0001101101001100 1 011110001 1101 1101110 10 00011  100                  
   10  1 1     101000110   0011101   01 101111 001000  1110   0000111001010 01 0 000110                       
   01 1101  011110 00     0    0101000010110101  1011101     011100 111110100111 10111                        
   0  101 0111110       0      0            100110  1 100001001  01111111110011 101111010100                  
  1   01 111111010   0 1     01           11 010010000 110001   11111111111101 1011110      010               
 10     01111110011                11    011111111111101 10 111110101101111 101111111        011              
 1   011111111101000 1 01010    1   01111111111111   011111111111          0  1101111011 1  01 0              
10 00111111001111010101001  0011100             11000100111111           010 1    011 1110  11  0             
10101100111 01111101011010101  10                 1110110011   110 0 001 10 011    01   11 100   1            
11     011  11101110111101   01  0  0              0111111   001111111101   1     011100001101   11           
11010   0      101 01       01  0   1 10            01111    1011111111101     01111     111111    1          
1  0000  10   110001    00  01001110010    0      01 111     0011111111110  001            11101   11         
110 11111    10  11     0   0111 110 01    1       00 11      01 11110 00  000             00111    10        
  1  10001  111010      0   0111011  11    0       11 1110  0011000010   0010              11110     0        
  110 1 111111  00     011  001111  100     1       01110 1110101      101                 00100     11       
   1110100101000       11   111111  011    10        1111  011001     1001               00001001     0    011
    111111110110       10   101111 110      0         11             110 010         010 01111000     10   011
     111101111110     110    00111 100      1 0        111          1110011 111110 0001 1110111011     01     
     000  1 001110   010     000111100      1 1         11101    1  1110000 01 000 0101 1 10100101     111    
    00 0 0010101111  0100    101011100     00010         101001010 10101010000101001001101111001000     10    
   110         0111101101    000101111    101101         0110100 11011000001110001111111111101101010     10   
    11000  101111010111100000   00001      01010          0110101010010100101101101111111100110011011111100   
      011100 0010 01111111111   0 111    010 001          011100101 11111111111111111111101 0001111111        
          000111101 1111111111110101      1010111111111110 0111111110111111111111111111111111111111111111     
                         011111111101     1 11111111111 11111111111111 11111111110   011111111101 1 11111110  
                                     100101111111111110    0110                                               
                                                                                                              
`.replace(/^\n/, "");

function MatrixGriot() {
  const [tick, setTick] = React.useState(0);
  const baseRef = React.useRef(ASCII_GRIOT.split("\n"));

  // Periodically swap random characters to create a flicker / glitch effect.
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 120);
    return () => clearInterval(id);
  }, []);

  // Build the current frame: original chars with ~6% randomly swapped to the
  // opposite bit. Spaces and newlines are preserved.
  const lines = React.useMemo(() => {
    return baseRef.current.map((row) =>
      row
        .split("")
        .map((ch) => {
          if (ch !== "0" && ch !== "1") return ch;
          return Math.random() < 0.06 ? (ch === "0" ? "1" : "0") : ch;
        })
        .join("")
    );
  }, [tick]);

  // Easter egg réactivé : click sur le griot → joue le son de kora
  // (uploadé via le BO si présent, sinon mélodie pentatonique synthétisée)
  // ET binarize les textes de la page (tous les chars deviennent 0/1
  // pendant 1.6s puis se restaurent).
  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const uploaded =
        typeof window !== "undefined"
        && window.SITE_CONTENT
        && window.SITE_CONTENT.koraSound
        && window.SITE_CONTENT.koraSound.path;

      if (uploaded) {
        // Fichier audio uploadé via le back office — lecture directe.
        const audio = window.__griotKoraAudio || new Audio();
        audio.src = uploaded;
        audio.currentTime = 0;
        audio.volume = 0.8;
        audio.play().catch(() => {/* autoplay bloqué */});
        window.__griotKoraAudio = audio;
      } else {
        // Fallback : mélodie pentatonique D mineure synthétisée
        // (D4 → F4 → A4 → C5 → D5 → A4 → F4), 4 harmoniques par note
        // avec enveloppe exponentielle qui mime un pluck de kora.
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          const ctx = window.__griotKoraCtx || (window.__griotKoraCtx = new AC());
          if (ctx.state === "suspended") ctx.resume();
          const now = ctx.currentTime;
          const MELODY = [
            [293.66, 0],    // D4
            [349.23, 130],  // F4
            [440.00, 260],  // A4
            [523.25, 390],  // C5
            [587.33, 530],  // D5
            [440.00, 720],  // A4 retour
            [349.23, 850],  // F4
          ];
          const playNote = (freq, when) => {
            const start = now + when / 1000;
            [1, 2, 3, 4].forEach((h) => {
              const osc = ctx.createOscillator();
              osc.type = "sine";
              osc.frequency.value = freq * h;
              const gain = ctx.createGain();
              const peak = 0.22 / (h * 1.6);
              gain.gain.setValueAtTime(0, start);
              gain.gain.linearRampToValueAtTime(peak, start + 0.005);
              gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(start);
              osc.stop(start + 0.6);
            });
          };
          MELODY.forEach(([freq, offset]) => playNote(freq, offset));
        }
      }
    } catch (_) {
      // Audio échoue ? L'effet 0/1 marche toujours sans le son.
    }
    // Tous les textes de la page flickerent en 0/1 pendant 1.6s puis
    // se restaurent. Le griot lui-même (skipEl) est exclu pour rester
    // visible et identifiable comme l'élément déclencheur.
    window.binarizePage && window.binarizePage({ duration: 1600, skipEl: e.currentTarget });
  };

  return (
    <pre
      className="matrix-griot"
      onClick={onClick}
      title="Click."
    >
      {lines.join("\n")}
    </pre>
  );
}

window.MatrixGriot = MatrixGriot;
// Expose la constante ASCII brute pour que d'autres composants puissent
// rendre une version STATIQUE du griot (sans flicker) — utile pour le
// menu mobile où le dessin doit rester stable.
window.ASCII_GRIOT = ASCII_GRIOT;

/* ============================================================
   binarizePage(opts) — site-wide flicker of every text node to
   random 0/1 digits, for `duration` ms, then restores.
   Options:
     - duration  (ms, default 1600)
     - skipEl    (Element to exclude, e.g. the griot itself)
     - onHalf    (fn called at midpoint — useful for swapping
                  the underlying content (lang switch) while the
                  binary noise hides the change)
     - onDone    (fn called once everything is restored)
   ============================================================ */
window.binarizePage = function binarizePage(opts) {
  opts = opts || {};
  const duration = opts.duration || 1600;
  if (window.__binarizing) return;
  window.__binarizing = true;

  // Build the skip set
  const skip = new Set();
  if (opts.skipEl) {
    skip.add(opts.skipEl);
    opts.skipEl.querySelectorAll("*").forEach((n) => skip.add(n));
  }

  function isBinaryNoise(s) {
    // Detects "current value is just 0/1/whitespace" — i.e. already binarized.
    return /^[01\s]+$/.test(s);
  }
  function shouldAcceptNode(node) {
    if (!node.nodeValue || !node.nodeValue.trim()) return false;
    let p = node.parentElement;
    while (p) {
      if (skip.has(p)) return false;
      const tag = p.tagName;
      if (tag === "STYLE" || tag === "SCRIPT") return false;
      p = p.parentElement;
    }
    return true;
  }

  // Map<Node, originalValue> — we add to it as we discover new text nodes
  // (e.g. after React re-renders following a language swap). We only store
  // a value the first time we see a node AND when its current content is
  // not already binarized.
  const originals = new Map();

  function sweepAndCapture() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      { acceptNode: (n) => shouldAcceptNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
    );
    const present = [];
    let n;
    while ((n = walker.nextNode())) {
      present.push(n);
      if (!originals.has(n) && !isBinaryNoise(n.nodeValue)) {
        originals.set(n, n.nodeValue);
      }
    }
    return present;
  }

  function binarize(value) {
    return value
      .split("")
      .map((ch) => (/\s/.test(ch) ? ch : Math.random() < 0.5 ? "0" : "1"))
      .join("");
  }

  let start = performance.now();
  let halfFired = false;
  let raf;
  function frame() {
    const elapsed = performance.now() - start;
    // Fire the swap callback at the midpoint, hidden by the noise.
    if (!halfFired && elapsed >= duration / 2) {
      halfFired = true;
      try { opts.onHalf && opts.onHalf(); } catch (e) {}
    }
    // Each frame: re-scan, capture any new nodes, binarize current ones
    const present = sweepAndCapture();
    present.forEach((node) => {
      const orig = originals.get(node);
      if (orig != null) node.nodeValue = binarize(orig);
    });
    if (elapsed < duration) {
      raf = requestAnimationFrame(frame);
    } else {
      // One last sweep to catch anything React rendered in the final frame
      sweepAndCapture();
      // Restore every captured node that's still in the DOM
      originals.forEach((value, node) => {
        if (node.isConnected) node.nodeValue = value;
      });
      window.__binarizing = false;
      try { opts.onDone && opts.onDone(); } catch (e) {}
    }
  }
  raf = requestAnimationFrame(frame);
};

/* ============================================================
   binarizeBackground(opts) — Matrix-rain plein écran de 0/1.
   Création d'un canvas overlay (z-index entre le content et le
   griot) qui dessine des colonnes de chiffres binaires qui
   tombent. Fade in/out géré sur la duration totale.
   Options identiques à binarizePage : duration, skipEl (ignoré).
   ============================================================ */
window.binarizeBackground = function binarizeBackground(opts) {
  opts = opts || {};
  const duration = opts.duration || 1600;
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__bg_binarizing) return;
  window.__bg_binarizing = true;

  // Création de l'overlay canvas.
  // mix-blend-mode: screen → la canvas devient ADDITIVE. Les chiffres
  // mustard apparaissent en ajoutant de la luminance par-dessus le
  // contenu (visible sur fond sombre, discret sur miniatures claires).
  // Plus de voile blanc qui obscurcit la grille des projets.
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.zIndex = "9000";
  canvas.style.pointerEvents = "none";
  canvas.style.opacity = "0";
  canvas.style.transition = "opacity 220ms ease-out";
  canvas.style.mixBlendMode = "screen";
  document.body.appendChild(canvas);

  // Promote skipEl (le griot) au-dessus du canvas pendant l'effet
  // pour qu'il reste visible et cliquable.
  let skipPrevPos = null;
  let skipPrevZ = null;
  let skipPrevWrapZ = null;
  let skipWrap = null;
  if (opts.skipEl && opts.skipEl.style) {
    skipPrevPos = opts.skipEl.style.position;
    skipPrevZ = opts.skipEl.style.zIndex;
    opts.skipEl.style.position = opts.skipEl.style.position || "relative";
    opts.skipEl.style.zIndex = "9500";
    // Le wrapper .ahome__griot doit aussi monter pour que son enfant soit visible
    skipWrap = opts.skipEl.closest(".ahome__griot");
    if (skipWrap) {
      skipPrevWrapZ = skipWrap.style.zIndex;
      skipWrap.style.zIndex = "9500";
    }
  }

  // Couleurs : encre mustard sur fond NOIR.
  // - ink = jaune mustard (couleur principale du site, visible en additive
  //   par-dessus n'importe quel contenu grâce à mix-blend-mode: screen)
  // - trail = noir profond (au lieu de paper/blanc) — combiné avec screen,
  //   il n'a aucun effet visuel sur le contenu mais permet aux chiffres
  //   précédents de s'estomper progressivement (effet de comète).
  const cs = getComputedStyle(document.body);
  const ink = (cs.getPropertyValue("--ink") || "#8a7a20").trim();
  const paper = "#000000";

  // High-DPI scaling
  const dpr = window.devicePixelRatio || 1;
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  resize();
  window.addEventListener("resize", resize);

  const ctx = canvas.getContext("2d");
  const FONT_SIZE = 14;
  const COL_W = FONT_SIZE * 0.9;
  ctx.font = `bold ${FONT_SIZE * dpr}px "Geist Mono", "JetBrains Mono", monospace`;
  ctx.textBaseline = "top";

  // Une colonne = un tableau de y positions (la "tête" qui descend)
  let cols = [];
  function setupCols() {
    const n = Math.ceil(canvas.width / (COL_W * dpr));
    cols = Array.from({ length: n }, () => Math.random() * canvas.height);
  }
  setupCols();

  // Forcer le fade in après mount
  requestAnimationFrame(() => { canvas.style.opacity = "0.92"; });

  const start = performance.now();
  let raf;
  function frame() {
    const elapsed = performance.now() - start;

    // Background : recouvrement avec papier semi-opaque (trail effect)
    ctx.fillStyle = paper;
    ctx.globalAlpha = 0.14;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;

    // Chiffres binaires en encre
    ctx.fillStyle = ink;
    for (let i = 0; i < cols.length; i++) {
      const char = Math.random() < 0.5 ? "0" : "1";
      const x = i * COL_W * dpr;
      const y = cols[i];
      ctx.fillText(char, x, y);

      // Reset aléatoire quand on dépasse en bas
      if (y > canvas.height && Math.random() > 0.975) {
        cols[i] = 0;
      }
      cols[i] = y + FONT_SIZE * dpr * 0.95;
    }

    if (elapsed < duration - 220) {
      raf = requestAnimationFrame(frame);
    } else {
      // Fade out + cleanup
      canvas.style.opacity = "0";
      setTimeout(() => {
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        window.removeEventListener("resize", resize);
        // Restore griot z-index/position
        if (opts.skipEl && opts.skipEl.style) {
          opts.skipEl.style.position = skipPrevPos || "";
          opts.skipEl.style.zIndex = skipPrevZ || "";
        }
        if (skipWrap) {
          skipWrap.style.zIndex = skipPrevWrapZ || "";
        }
        window.__bg_binarizing = false;
      }, 240);
    }
  }
  raf = requestAnimationFrame(frame);
};
