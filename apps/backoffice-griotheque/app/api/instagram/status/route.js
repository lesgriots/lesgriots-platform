// État du branchement Instagram : config présente, jeton, compte, journal.
import { NextResponse } from "next/server";
import { igConfig, tokenInfo, getAccount } from "../../../../lib/instagram-api.js";
import { loadIg } from "../../../../lib/instagram-store.js";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = igConfig();
  let account = null, accountError = null;
  if (config.hasToken) {
    try { account = await getAccount(); } catch (e) { accountError = e.message; }
  }
  let s = { contacts: [], log: [], automations: [] };
  try { s = loadIg(); } catch (e) { accountError = accountError || e.message; }
  return NextResponse.json({
    config, token: tokenInfo(), account, accountError,
    counts: {
      automations: s.automations.length,
      actives: s.automations.filter((a) => a.active).length,
      contacts: s.contacts.length,
      emails: s.contacts.filter((c) => c.email).length,
    },
    log: [...(s.log || [])].reverse().slice(0, 120),
  });
}
