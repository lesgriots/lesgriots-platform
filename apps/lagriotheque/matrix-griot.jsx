/* global React */
// Matrix-style ASCII griot — identique au site studio (lesgriotsxstudio.com).
// Affiche le griot en grille de 0 et 1 qui scintillent comme dans Matrix.
// Click → easter egg "binarize" : tous les textes de la page deviennent
// brièvement des 0/1 aléatoires.

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

  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 120);
    return () => clearInterval(id);
  }, []);

  // Pixel-art rendering : 1 → █ (bloc plein), 0 → ▓ (bloc moyen).
  // Le flicker swap entre les deux blocs pour créer un effet shimmer.
  const lines = React.useMemo(() => {
    return baseRef.current.map((row) =>
      row
        .split("")
        .map((ch) => {
          if (ch !== "0" && ch !== "1") return ch;
          const flipped = Math.random() < 0.06 ? (ch === "0" ? "1" : "0") : ch;
          return flipped === "1" ? "█" : "▓";
        })
        .join("")
    );
  }, [tick]);

  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
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

/* ============================================================
   binarizePage(opts) — identique au site studio.
   ============================================================ */
window.binarizePage = function binarizePage(opts) {
  opts = opts || {};
  const duration = opts.duration || 1600;
  if (window.__binarizing) return;
  window.__binarizing = true;

  const skip = new Set();
  if (opts.skipEl) {
    skip.add(opts.skipEl);
    opts.skipEl.querySelectorAll("*").forEach((n) => skip.add(n));
  }

  function isBinaryNoise(s) {
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
    if (!halfFired && elapsed >= duration / 2) {
      halfFired = true;
      try { opts.onHalf && opts.onHalf(); } catch (e) {}
    }
    const present = sweepAndCapture();
    present.forEach((node) => {
      const orig = originals.get(node);
      if (orig != null) node.nodeValue = binarize(orig);
    });
    if (elapsed < duration) {
      raf = requestAnimationFrame(frame);
    } else {
      sweepAndCapture();
      originals.forEach((value, node) => {
        if (node.isConnected) node.nodeValue = value;
      });
      window.__binarizing = false;
      try { opts.onDone && opts.onDone(); } catch (e) {}
    }
  }
  raf = requestAnimationFrame(frame);
};
