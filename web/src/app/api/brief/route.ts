// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// POST /api/brief: SI evidence briefing, server-side only. Provider-agnostic: Anthropic, OpenAI,
// DeepSeek, Gemini or any OpenAI-compatible endpoint, chosen by environment variables (lib/provider.ts).
// The client sends only the scenario query string. The server rebuilds the ranking from the
// canonical NASA bundle, sends the model nothing but that evidence pack, validates the draft
// (citations, numeric firewall, no safety verdicts) and falls back to a deterministic brief.
import bundleJson from "../../../../public/data/flamebound.json";
import type { Bundle } from "@/lib/types";
import { hazard as computeHazard, rank } from "@/lib/bcms";
import { numericFirewall } from "@/lib/explain";
import { DEFAULT_TARGET, MATERIAL_OPTIONS } from "@/lib/presets";
import { searchFromTarget, targetFromSearch } from "@/lib/url";
import { buildRequest, describeResponse, extractText, providerLabel, resolveProvider } from "@/lib/provider";
import { SYSTEM_PROMPT, buildEvidence, correctionMessage, buildUserMessage, fallbackBrief, validateBrief, type Sentence } from "@/lib/brief";

const bundle = bundleJson as unknown as Bundle;
const MATERIAL_KEYS: ReadonlySet<string> = new Set(MATERIAL_OPTIONS.map((m) => m.key));
const API_VERSION = process.env.ANTHROPIC_VERSION ?? "2023-06-01";

// Small per-instance cache and rate limit: a public demo must not run up API cost.
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
  let query = "";
  try {
    const body = (await request.json()) as { query?: unknown };
    query = typeof body.query === "string" ? body.query.slice(0, 400) : "";
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const target = { ...DEFAULT_TARGET, ...targetFromSearch(query, MATERIAL_KEYS) };
  const key = searchFromTarget(target);
  if (cache.has(key)) return Response.json(cache.get(key));

  const ranked = rank(bundle.records, bundle.investigations, target);
  const hz = computeHazard(ranked, target);
  const label = MATERIAL_OPTIONS.find((m) => m.key === target.materialKey)?.label ?? target.materialKey;
  const pack = buildEvidence(ranked, target, hz, label);
  const evidence = pack.evidence.map((e) => ({
    id: e.id, label: `${e.investigation} ${e.record}`.trim(), doi: e.doi, doiUrl: e.doiUrl, portalUrl: e.portalUrl,
  }));

  const resolved = resolveProvider(process.env);
  const modelLabel = resolved.ok ? providerLabel(resolved.config) : null;

  const respond = (source: "si" | "fallback", sentences: Sentence[], problems: string[], note: string) => {
    const payload = {
      source,
      model: source === "si" ? modelLabel : null,
      provider: source === "si" && resolved.ok ? resolved.config.name : null,
      sentences, evidence, problems, note, generatedAt: new Date().toISOString(),
    };
    // Cache only verified briefings, so a rejected draft is retried on the next request.
    if (source === "si") cache.set(key, payload);
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    return Response.json(payload);
  };

  if (!resolved.ok) return respond("fallback", fallbackBrief(pack), [], `SI unavailable: ${resolved.reason}.`);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return respond("fallback", fallbackBrief(pack), [], "SI rate limit reached; showing the deterministic brief.");

  const cfg = resolved.config;
  // One call to the provider. Returns the answer text, or a fallback note explaining why there is none.
  const ask = async (retry?: { draft: string; feedback: string }): Promise<{ text: string } | { note: string }> => {
    const req = buildRequest(cfg, SYSTEM_PROMPT, buildUserMessage(pack), { anthropicVersion: API_VERSION, effort: process.env.SI_EFFORT, retry });
    const res = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: AbortSignal.timeout(25_000) });
    if (!res.ok) return { note: `SI request to ${cfg.name} failed (HTTP ${res.status}); showing the deterministic brief.` };
    const data: unknown = await res.json();
    const text = extractText(cfg.wire, data);
    return text ? { text } : { note: `${cfg.name} returned no text (${describeResponse(cfg.wire, data)}); showing the deterministic brief.` };
  };

  try {
    // Draft, verify, and on failure give the model its exact problems once to correct them.
    let draft = await ask();
    if ("note" in draft) return respond("fallback", fallbackBrief(pack), [], draft.note);
    let v = validateBrief(draft.text, pack, numericFirewall);
    if (!v.ok) {
      const first = draft.text;
      draft = await ask({ draft: first, feedback: correctionMessage(v.problems) });
      if ("note" in draft) return respond("fallback", fallbackBrief(pack), v.problems, draft.note);
      v = validateBrief(draft.text, pack, numericFirewall);
    }
    if (!v.ok) {
      // Development only: expose the rejected draft for prompt tuning. Never in production.
      if (process.env.NODE_ENV === "development") console.log("[SI draft rejected]", v.problems, "\n" + draft.text);
      return respond("fallback", fallbackBrief(pack), v.problems, "The SI draft failed verification twice, so the deterministic brief is shown.");
    }
    return respond("si", v.sentences, [], "Generated by SI; it passed automated citation and number checks against the cited NASA records.");
  } catch {
    return respond("fallback", fallbackBrief(pack), [], `SI request to ${cfg.name} timed out or failed; showing the deterministic brief.`);
  }
}
