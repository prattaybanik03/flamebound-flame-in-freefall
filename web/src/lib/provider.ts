// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Provider-agnostic SI layer. Two wire formats cover almost every vendor:
//   - Anthropic Messages API (Claude)
//   - OpenAI-compatible Chat Completions (OpenAI/ChatGPT, DeepSeek, Google Gemini, and any
//     compatible endpoint such as OpenRouter, Groq, Mistral, Together or a local Ollama).
// Pure functions only (no runtime imports), so the Node test runner can exercise them directly.
// API keys are read on the server only and never reach the browser.

export type WireFormat = "anthropic" | "openai-compatible";
export type ProviderId = "anthropic" | "openai" | "deepseek" | "gemini" | "custom";

export interface ProviderPreset {
  name: string;
  wire: WireFormat;
  baseUrl: string;
  model: string;
  keyEnv: string;
}

/** Defaults per vendor. Any of them can be overridden with SI_MODEL / SI_BASE_URL. */
export const PROVIDERS: Record<Exclude<ProviderId, "custom">, ProviderPreset> = {
  anthropic: { name: "Anthropic", wire: "anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-haiku-5-5", keyEnv: "ANTHROPIC_API_KEY" },
  openai: { name: "OpenAI", wire: "openai-compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-5.4-mini", keyEnv: "OPENAI_API_KEY" },
  deepseek: { name: "DeepSeek", wire: "openai-compatible", baseUrl: "https://api.deepseek.com", model: "deepseek-flash", keyEnv: "DEEPSEEK_API_KEY" },
  gemini: { name: "Google Gemini", wire: "openai-compatible", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.8-flash", keyEnv: "GEMINI_API_KEY" },
};

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  wire: WireFormat;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export type Resolved = { ok: true; config: ProviderConfig } | { ok: false; reason: string };
type Env = Record<string, string | undefined>;

const clean = (v: string | undefined) => (v ?? "").trim();
const stripSlash = (u: string) => u.replace(/\/+$/, "");
const ALIASES: Record<string, ProviderId> = {
  anthropic: "anthropic", claude: "anthropic",
  openai: "openai", chatgpt: "openai", gpt: "openai",
  deepseek: "deepseek",
  gemini: "gemini", google: "gemini",
  custom: "custom", "openai-compatible": "custom", compatible: "custom",
};

/** Guess the vendor from the key's shape. Plain `sk-` keys are shared by OpenAI and DeepSeek, so they default to OpenAI. */
export function detectFromKey(key: string): Exclude<ProviderId, "custom"> {
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("AIza") || key.startsWith("AQ.")) return "gemini"; // legacy and current Google AI Studio key formats
  return "openai";
}

/**
 * Work out which SI provider to call from environment variables.
 * Order: SI_PROVIDER (explicit) → SI_API_KEY (generic, vendor detected from the key) → vendor keys
 * (ANTHROPIC_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY, GEMINI_API_KEY, first one set wins).
 * SI_MODEL and SI_BASE_URL override the vendor defaults; SI_BASE_URL alone selects a custom endpoint.
 */
export function resolveProvider(env: Env): Resolved {
  const explicitRaw = clean(env.SI_PROVIDER).toLowerCase();
  const explicit = explicitRaw ? ALIASES[explicitRaw] : undefined;
  if (explicitRaw && !explicit) {
    return { ok: false, reason: `Unknown SI_PROVIDER "${explicitRaw}". Use anthropic, openai, deepseek, gemini or custom.` };
  }
  const genericKey = clean(env.SI_API_KEY);
  const baseOverride = stripSlash(clean(env.SI_BASE_URL));
  const modelOverride = clean(env.SI_MODEL) || undefined;

  let id: ProviderId | undefined = explicit;
  let apiKey = "";
  if (id && id !== "custom") apiKey = clean(env[PROVIDERS[id].keyEnv]) || genericKey;
  else if (id === "custom") apiKey = genericKey;
  else if (genericKey) {
    apiKey = genericKey;
    id = baseOverride ? "custom" : detectFromKey(genericKey);
  } else {
    for (const p of ["anthropic", "openai", "deepseek", "gemini"] as const) {
      const k = clean(env[PROVIDERS[p].keyEnv]);
      if (k) { id = p; apiKey = k; break; }
    }
  }

  if (!id || !apiKey) return { ok: false, reason: "no API key configured on the server" };

  if (id === "custom") {
    if (!baseOverride || !modelOverride) {
      return { ok: false, reason: "a custom provider needs both SI_BASE_URL and SI_MODEL" };
    }
    return { ok: true, config: { id, name: hostName(baseOverride), wire: "openai-compatible", apiKey, baseUrl: baseOverride, model: modelOverride } };
  }

  const preset = PROVIDERS[id];
  // Backwards compatibility with the original Anthropic-only variable.
  const legacyModel = id === "anthropic" ? clean(env.ANTHROPIC_MODEL) || undefined : undefined;
  return {
    ok: true,
    config: {
      id, name: preset.name, wire: preset.wire, apiKey,
      baseUrl: baseOverride || preset.baseUrl,
      model: modelOverride ?? legacyModel ?? preset.model,
    },
  };
}

function hostName(url: string): string {
  const m = /^https?:\/\/([^/:]+)/i.exec(url);
  return m ? m[1] : "custom endpoint";
}

export interface WireRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** Build the HTTP request for one briefing. Token caps leave room for models that reason before answering. */
export interface RequestOptions {
  anthropicVersion?: string;
  /** Anthropic effort level (low | medium | high | xhigh | max), or "none" to omit it for models without effort support. */
  effort?: string;
  /** A rejected draft and the correction request, sent as a second turn. */
  retry?: { draft: string; feedback: string };
}

export function buildRequest(cfg: ProviderConfig, system: string, user: string, opts: RequestOptions = {}): WireRequest {
  if (cfg.wire === "anthropic") {
    // Current Claude models think by default and thinking counts toward max_tokens, so leave room for it.
    // Low effort keeps that thinking short (a 3-5 sentence brief does not need more), which cuts cost and latency.
    const effort = (opts.effort ?? "low").trim().toLowerCase();
    const body: Record<string, unknown> = { model: cfg.model, max_tokens: 4000, system, messages: turns(user, opts) };
    if (effort && effort !== "none") body.output_config = { effort };
    return {
      url: `${cfg.baseUrl}/messages`,
      headers: { "x-api-key": cfg.apiKey, "anthropic-version": opts.anthropicVersion ?? "2023-06-01", "content-type": "application/json" },
      body,
    };
  }
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: [{ role: "system", content: system }, ...turns(user, opts)],
  };
  // OpenAI's current models take max_completion_tokens; most compatible servers take max_tokens.
  if (cfg.id === "openai") body.max_completion_tokens = 2000;
  else body.max_tokens = 2000;
  if (cfg.id === "gemini") body.reasoning_effort = "low";
  return {
    url: `${cfg.baseUrl}/chat/completions`,
    headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
    body,
  };
}

function turns(user: string, opts: RequestOptions): { role: string; content: string }[] {
  const t = [{ role: "user", content: user }];
  if (opts.retry) t.push({ role: "assistant", content: opts.retry.draft }, { role: "user", content: opts.retry.feedback });
  return t;
}

/** Pull the answer text out of either response shape. Returns "" when there is none. */
export function extractText(wire: WireFormat, data: unknown): string {
  const d = data as Record<string, unknown> | null;
  if (!d || typeof d !== "object") return "";
  if (wire === "anthropic") {
    const content = Array.isArray(d.content) ? (d.content as { type?: string; text?: string }[]) : [];
    return content.filter((b) => b?.type === "text").map((b) => b.text ?? "").join(" ").trim();
  }
  const choices = Array.isArray(d.choices) ? (d.choices as { message?: { content?: unknown } }[]) : [];
  const content = choices[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return (content as { type?: string; text?: string }[])
      .filter((p) => typeof p?.text === "string" && (p.type === undefined || p.type === "text" || p.type === "output_text"))
      .map((p) => p.text)
      .join(" ")
      .trim();
  }
  return "";
}

/** Non-secret summary of a response shape, for diagnosing an empty answer (no content is included). */
export function describeResponse(wire: WireFormat, data: unknown): string {
  const d = data as Record<string, unknown> | null;
  if (!d || typeof d !== "object") return "non-JSON response";
  if (wire === "anthropic") {
    const types = Array.isArray(d.content) ? (d.content as { type?: string }[]).map((b) => b?.type ?? "?").join(",") : "none";
    return `stop_reason ${String(d.stop_reason ?? "?")}; blocks ${types || "none"}`;
  }
  const c = Array.isArray(d.choices) ? (d.choices as { finish_reason?: string }[])[0] : undefined;
  return `finish_reason ${String(c?.finish_reason ?? "?")}`;
}

/** Short label for the UI and disclosure, e.g. "deepseek-flash (DeepSeek)". */
export function providerLabel(cfg: Pick<ProviderConfig, "model" | "name">): string {
  return `${cfg.model} (${cfg.name})`;
}
