import fs from "fs";
const AUTH = "Basic " + Buffer.from("moos:mgriot").toString("base64");
const BASE = "https://admin.lesgriots.com/lesgriots/api";
const text_en = fs.readFileSync(new URL("./about-en.txt", import.meta.url), "utf8").trim();
const about = await (await fetch(`${BASE}/about`, { headers: { Authorization: AUTH } })).json();
const saved = await (await fetch(`${BASE}/about`, {
  method: "POST",
  headers: { Authorization: AUTH, "Content-Type": "application/json" },
  body: JSON.stringify({ ...about, text_en }),
})).json();
if (saved.error) throw new Error(saved.error);
const exp = await (await fetch(`${BASE}/export`, { method: "POST", headers: { Authorization: AUTH } })).json();
console.log("EN:", (saved.text_en || "").slice(0, 50) + "… | export:", exp.ok ? "OK" : exp.error);
