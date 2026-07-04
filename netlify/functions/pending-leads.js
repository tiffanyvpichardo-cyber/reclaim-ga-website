// netlify/functions/pending-leads.js
// Serves the JotForm intake leads that jotform-webhook.js has queued, and
// clears them once the dashboard has merged them into localStorage.
//
// GET  /.netlify/functions/pending-leads        -> JSON array of lead objects
// POST /.netlify/functions/pending-leads {ids}   -> deletes those queued leads
//
// Storage is Netlify Blobs (no external DB needed). Netlify Functions v2 (ESM).
import { getStore } from "@netlify/blobs";

const STORE = "reclaim-ca-intake";

export default async (req) => {
  const store = getStore(STORE);

  if (req.method === "GET") {
    const leads = [];
    try {
      const { blobs } = await store.list();
      for (const b of blobs) {
        const v = await store.get(b.key, { type: "json" });
        if (v) leads.push(v);
      }
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
    return Response.json(leads);
  }

  if (req.method === "POST") {
    let ids = [];
    try { ({ ids = [] } = await req.json()); } catch (e) { /* empty body */ }
    await Promise.all(ids.map((id) => store.delete(String(id)).catch(() => {})));
    return Response.json({ cleared: ids.length });
  }

  return new Response("Method not allowed", { status: 405 });
};
