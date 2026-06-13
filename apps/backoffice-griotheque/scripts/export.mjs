// Script utilitaire : ré-exporte data.jsx depuis griotheque.json sans passer
// par l'API HTTP (utile quand le serveur dev n'est pas accessible).
import { exportToDataJsx } from "../lib/exporter.js";

const result = await exportToDataJsx();
console.log("✓ Export OK →", result);
