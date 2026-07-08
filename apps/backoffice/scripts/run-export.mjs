import { exportToDataJsx } from "../lib/exporter.js";
exportToDataJsx().then(r=>console.log("EXPORT_OK",(r&&r.bytes)||"")).catch(e=>{console.error(e);process.exit(1);});
