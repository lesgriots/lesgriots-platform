const AUTH = "Basic " + Buffer.from("moos:mgriot").toString("base64");
const BASE = "https://admin.lesgriots.com/lesgriots/api";
const about = await (await fetch(`${BASE}/about`, { headers: { Authorization: AUTH } })).json();

const SECTIONS = {
  lesgriotsxstudio: {
    title: "LESGRIOTSxSTUDIO",
    desc: "L’agence structure et amplifie les récits des artistes, des marques et des institutions qui les lui confient. Stratégie, direction créative, production audiovisuelle et direction du mouvement y procèdent d’une même traversée : la chorégraphie, la réalisation et la direction artistique, unifiées par le récit. Le studio a accompagné Vacra (Universal Music France) de MOTO à GALATÉE, disque d’or, signé les images de Médine et d’Oumar (Sony Music France), et co-dirigé le live de Rilès des Zéniths à l’Accor Arena.",
  },
  "lesgriots.com": {
    title: "PRODUCTION ORIGINALE & IPs",
    desc: "La maison initie et détient ses propres récits : séries photographiques, documentaires, installations et formats hybrides pensés pour exister à travers plusieurs médiums à la fois. Des séries d’auteur COLORISME et MWENDWA, qui regardent la couleur de peau et l’intime dans la diaspora, à INDIGO CRISTAL et TABASKI, le catalogue construit une archive vivante des récits du continent et de ses diasporas : exposée, publiée, transmise.",
  },
  lagriotheque: {
    title: "LA GRIOTHÈQUE",
    desc: "L’école transmet les outils du récit à celles et ceux qui choisissent de se raconter eux-mêmes : créatifs, entrepreneurs, institutions. Formations certifiées, workshops et masterclasses y sont conçus et animés par des praticiens en activité, pas des théoriciens. Ce qui s’y enseigne a d’abord été éprouvé sur le terrain, des majors aux scènes de Zénith, avant d’être rendu transmissible.",
  },
};

for (const l of about.links) {
  for (const [k, v] of Object.entries(SECTIONS)) {
    if ((l.url || "").includes(k) || (l.label || "").includes(k)) Object.assign(l, v);
  }
}
const saved = await (await fetch(`${BASE}/about`, {
  method: "POST",
  headers: { Authorization: AUTH, "Content-Type": "application/json" },
  body: JSON.stringify(about),
})).json();
if (saved.error) throw new Error(saved.error);
console.log(saved.links.map((l) => l.title + " (" + (l.desc || "").length + " car.)").join(" · "));
