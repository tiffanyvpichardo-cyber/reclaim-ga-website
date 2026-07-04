// netlify/functions/jotform-webhook.js
// Item 5 + 6: receive a JotForm intake submission, create a lead record, and
// automatically send the DocuSign contingency agreement to the client.
//
// Point your JotForm webhook (Settings -> Integrations -> Webhooks, or the
// generic "WebHooks" widget) at:
//    https://<your-site>.netlify.app/.netlify/functions/jotform-webhook
//
// The lead is queued in Netlify Blobs; the dashboard's "Sync Intake" button
// pulls it in via pending-leads.js. DocuSign is optional and fail-safe: if its
// env vars aren't set (or it errors), the lead is still created — it just lands
// in "Contacted" instead of "Agreement Sent", with the error logged.
//
// Netlify Functions v2 (ESM).
import { getStore } from "@netlify/blobs";

const STORE = "reclaim-ca-intake";
const CA_FEE_CAP = 10; // CCP § 1582

// ── Map JotForm answers -> lead fields ───────────────────────────────────────
// JotForm keys look like "q5_name", "q7_email", etc. We match by the token
// appearing anywhere in the key, so you usually don't need exact keys — but
// VERIFY against one real submission and tweak the token lists if needed.
const FIELD_TOKENS = {
  firstName: ["first"],
  lastName:  ["last"],
  name:      ["name", "fullname"],          // fallback if name is one field
  phone:     ["phone", "mobile", "cell"],
  email:     ["email"],
  address:   ["address", "street", "addr"],
  city:      ["city"],
  state:     ["state", "province"],
  zip:       ["zip", "postal"],
  propertyType:  ["propertytype", "type"],
  propertyValue: ["amount", "value", "estimatedvalue"],
  holdingEntity: ["holder", "institution", "bank", "company"],
};

function pick(answers, tokens) {
  for (const [key, val] of Object.entries(answers)) {
    const k = key.toLowerCase();
    if (tokens.some((t) => k.includes(t))) {
      if (val && typeof val === "object") {
        // JotForm composite fields: name {first,last}, address {addr_line1,...}
        return val.first || val.addr_line1 || val.city || Object.values(val).filter(Boolean)[0] || "";
      }
      if (val != null && String(val).trim() !== "") return String(val).trim();
    }
  }
  return "";
}

function nameParts(answers) {
  // Prefer explicit first/last; else split a combined name; else a name object.
  const first = pick(answers, FIELD_TOKENS.firstName);
  const last = pick(answers, FIELD_TOKENS.lastName);
  if (first || last) return { first, last };
  for (const [key, val] of Object.entries(answers)) {
    if (key.toLowerCase().includes("name") && val && typeof val === "object") {
      return { first: val.first || "", last: val.last || "" };
    }
  }
  const full = pick(answers, FIELD_TOKENS.name);
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return { first: parts[0], last: parts.slice(1).join(" ") };
  return { first: full, last: "" };
}

function toNumber(s) {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

async function parseSubmission(req) {
  // JotForm posts multipart/form-data with a `rawRequest` JSON blob.
  const ct = req.headers.get("content-type") || "";
  let answers = {};
  if (ct.includes("form")) {
    const fd = await req.formData();
    const raw = fd.get("rawRequest");
    if (raw) {
      try { answers = JSON.parse(raw); } catch (e) { /* fall through */ }
    }
    if (Object.keys(answers).length === 0) {
      for (const [k, v] of fd.entries()) answers[k] = v;
    }
  } else {
    try { answers = await req.json(); } catch (e) { answers = {}; }
  }
  return answers;
}

// ── DocuSign: send the contingency agreement template (fail-safe) ────────────
async function sendDocusign(lead) {
  const {
    DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID,
    DOCUSIGN_PRIVATE_KEY, DOCUSIGN_TEMPLATE_ID,
    DOCUSIGN_BASE_PATH = "https://demo.docusign.net/restapi",
    DOCUSIGN_OAUTH_HOST = "account-d.docusign.com", // demo; prod: account.docusign.com
    DOCUSIGN_TEMPLATE_ROLE = "Signer",
  } = process.env;

  if (!DOCUSIGN_INTEGRATION_KEY || !DOCUSIGN_USER_ID || !DOCUSIGN_ACCOUNT_ID ||
      !DOCUSIGN_PRIVATE_KEY || !DOCUSIGN_TEMPLATE_ID) {
    return { sent: false, reason: "DocuSign env not configured" };
  }
  if (!lead.email) return { sent: false, reason: "no client email on submission" };

  try {
    const docusign = await import("docusign-esign");
    const dsApi = docusign.default || docusign;
    const apiClient = new dsApi.ApiClient({ basePath: DOCUSIGN_BASE_PATH, oAuthBasePath: DOCUSIGN_OAUTH_HOST });
    const key = Buffer.from(DOCUSIGN_PRIVATE_KEY.replace(/\\n/g, "\n"), "utf8");
    const token = await apiClient.requestJWTUserToken(
      DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID,
      ["signature", "impersonation"], key, 3600
    );
    const accessToken = token.body.access_token;
    apiClient.addDefaultHeader("Authorization", "Bearer " + accessToken);

    const envelopesApi = new dsApi.EnvelopesApi(apiClient);
    const envelope = {
      templateId: DOCUSIGN_TEMPLATE_ID,
      templateRoles: [{
        email: lead.email,
        name: `${lead.firstName} ${lead.lastName}`.trim() || lead.email,
        roleName: DOCUSIGN_TEMPLATE_ROLE,
      }],
      status: "sent",
    };
    const result = await envelopesApi.createEnvelope(DOCUSIGN_ACCOUNT_ID, { envelopeDefinition: envelope });
    return { sent: true, envelopeId: result.envelopeId };
  } catch (e) {
    return { sent: false, reason: (e && e.message) || String(e) };
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const answers = await parseSubmission(req);
  const { first, last } = nameParts(answers);
  const today = new Date().toISOString().slice(0, 10);
  const id = "jf_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const lead = {
    id,
    firstName: first, lastName: last,
    phone: pick(answers, FIELD_TOKENS.phone),
    email: pick(answers, FIELD_TOKENS.email),
    address: pick(answers, FIELD_TOKENS.address),
    city: pick(answers, FIELD_TOKENS.city),
    state: pick(answers, FIELD_TOKENS.state) || "CA",
    zip: pick(answers, FIELD_TOKENS.zip),
    propertyType: pick(answers, FIELD_TOKENS.propertyType) || "Unclaimed Property",
    propertyValue: toNumber(pick(answers, FIELD_TOKENS.propertyValue)),
    propertyState: "CA",
    holdingEntity: pick(answers, FIELD_TOKENS.holdingEntity),
    propertyId: "",
    stage: "contacted",
    feePercent: CA_FEE_CAP,
    feeAmount: 0,
    outreachLog: [{ date: today, method: "JotForm", notes: "Client submitted intake form." }],
    docs: { agreementSigned: false, idVerified: false, proofOfOwnership: false, claimSubmitted: false, paymentReceived: false },
    paidDate: null,
    source: "JotForm Intake",
    leadDate: today,
    notes: "Created automatically from JotForm intake.",
    activity: [{ date: today, action: "Lead created from JotForm intake" }],
    aiNotes: "",
  };
  lead.feeAmount = Math.round(lead.propertyValue * CA_FEE_CAP / 100);

  // Item 6: fire the DocuSign contingency agreement.
  const ds = await sendDocusign(lead);
  if (ds.sent) {
    lead.stage = "agreement_sent";
    lead.outreachLog.push({ date: today, method: "DocuSign", notes: `Contingency agreement sent (envelope ${ds.envelopeId}).` });
    lead.activity.push({ date: today, action: "DocuSign agreement sent automatically" });
  } else {
    lead.activity.push({ date: today, action: `DocuSign not sent: ${ds.reason}` });
  }

  try {
    const store = getStore(STORE);
    await store.setJSON(id, lead);
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }

  // JotForm just needs a 2xx.
  return Response.json({ ok: true, id, docusign: ds.sent });
};
