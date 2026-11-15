// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// POST /api/ask: "Ask NASA's records". Retrieval-augmented answers over the 23 PSI investigation records.
// Retrieve (BM25, deterministic) -> answer with any configured SI provider -> verify (citations, verbatim
// quotes, numbers, no safety verdicts) -> one correction attempt -> otherwise show the retrieved passages.
import passagesJson from "../../../../public/data/passages.json";
import { buildIndex, retrieve, type Passage } from "@/lib/retrieve";
import { QA_SYSTEM_PROMPT, REFUSAL, buildQaMessage, qaCorrection, validateAnswer, type QaSentence } from "@/lib/qa";
import { numericFirewall } from "@/lib/explain";
import { buildRequest, describeResponse, extractText, providerLabel, resolveProvider } from "@/lib/provider";

const INDEX = buildIndex(passagesJson as Passage[]);
const API_VERSION = process.env.ANTHROPIC_VERSION ?? "2023-06-01";
const cache = new Map<string, unknown>();
const hits = new Map<string, number[]>();
const LIMIT_PER_MIN = 8;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT_PER_MIN;
}

export async function POST(request: Request) {
  let question = "";
  try {
    const body = (await request.json()) as { question?: unknown };
    question = typeof body.question === "string" ? body.question.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (question.length < 3) return Response.json({ error: "Ask a question of at least 3 characters." }, { status: 400 });
  const key = question.toLowerCase();
  if (cache.has(key)) return Response.json(cache.get(key));

  const retrieved = retrieve(INDEX, question, 6).map((h) => h.passage);
  const resolved = resolveProvider(process.env);
  const model = resolved.ok ? providerLabel(resolved.config) : null;

  const respond = (source: "si" | "refusal" | "fallback", sentences: QaSentence[], problems: string[], note: string) => {
    const cited = new Set(sentences.flatMap((s) => s.cites));
    const passages = (source === "fallback" ? retrieved.slice(0, 3) : retrieved.filter((p) => cited.has(p.id)));
    const payload = { source, model: source === "fallback" ? null : model, sentences, passages, problems, note, generatedAt: new Date().toISOString() };
    // Cache only final answers and refusals, so a rejected draft is retried on the next request.
    if (source !== "fallback") cache.set(key, payload);
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    return Response.json(payload);
  };

  if (retrieved.length === 0) return respond("refusal", [{ text: REFUSAL, cites: [] }], [], "No NASA passage matched the question.");
  if (!resolved.ok) return respond("fallback", [], [], `SI unavailable: ${resolved.reason}. Showing the closest NASA passages instead.`);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return respond("fallback", [], [], "SI rate limit reached; showing the closest NASA passages instead.");

  const cfg = resolved.config;
  const ask = async (retry?: { draft: string; feedback: string }): Promise<{ text: string } | { note: string }> => {
    const req = buildRequest(cfg, QA_SYSTEM_PROMPT, buildQaMessage(question, retrieved), { anthropicVersion: API_VERSION, effort: process.env.SI_EFFORT, retry });
    const res = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: AbortSignal.timeout(25_000) });
    if (!res.ok) return { note: `SI request to ${cfg.name} failed (HTTP ${res.status}); showing the closest NASA passages instead.` };
    const data: unknown = await res.json();
    const text = extractText(cfg.wire, data);
    return text ? { text } : { note: `${cfg.name} returned no text (${describeResponse(cfg.wire, data)}); showing the closest NASA passages instead.` };
  };

  try {
    let draft = await ask();
    if ("note" in draft) return respond("fallback", [], [], draft.note);
    let v = validateAnswer(draft.text, retrieved, numericFirewall);
    if (!v.ok) {
      draft = await ask({ draft: draft.text, feedback: qaCorrection(v.problems) });
      if ("note" in draft) return respond("fallback", [], v.problems, draft.note);
      v = validateAnswer(draft.text, retrieved, numericFirewall);
    }
    if (!v.ok) {
      if (process.env.NODE_ENV === "development") console.log("[SI answer rejected]", v.problems, "\n" + draft.text);
      return respond("fallback", [], v.problems, "The SI answer failed verification twice, so the closest NASA passages are shown instead.");
    }
    if (v.refusal) return respond("refusal", v.sentences, [], "The retrieved NASA records do not answer this question.");
    return respond("si", v.sentences, [], "Answered by SI from NASA's records; it passed automated citation, quote and number checks against the cited passages.");
  } catch {
    return respond("fallback", [], [], `SI request to ${cfg.name} timed out or failed; showing the closest NASA passages instead.`);
  }
}
