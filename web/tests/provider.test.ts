// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, detectFromKey, extractText, resolveProvider } from "../src/lib/provider.ts";

const cfgOf = (env: Record<string, string>) => {
  const r = resolveProvider(env);
  assert.equal(r.ok, true, r.ok ? "" : r.reason);
  return (r as { ok: true; config: import("../src/lib/provider.ts").ProviderConfig }).config;
};

test("no key means no provider, so the app falls back to the deterministic brief", () => {
  const r = resolveProvider({});
  assert.equal(r.ok, false);
});

test("each vendor key selects its vendor and default model", () => {
  assert.equal(cfgOf({ ANTHROPIC_API_KEY: "k" }).id, "anthropic");
  assert.equal(cfgOf({ OPENAI_API_KEY: "k" }).id, "openai");
  const ds = cfgOf({ DEEPSEEK_API_KEY: "k" });
  assert.equal(ds.id, "deepseek");
  assert.equal(ds.model, "deepseek-flash");
  assert.equal(ds.baseUrl, "https://api.deepseek.com");
  assert.equal(cfgOf({ GEMINI_API_KEY: "k" }).wire, "openai-compatible");
});

test("a generic SI_API_KEY is routed by its prefix", () => {
  assert.equal(detectFromKey("sk-ant-api03-x"), "anthropic");
  assert.equal(detectFromKey("AIzaSyX"), "gemini");
  assert.equal(detectFromKey("AQ.Ab8RN6x"), "gemini");
  assert.equal(detectFromKey("sk-proj-x"), "openai");
  assert.equal(cfgOf({ SI_API_KEY: "sk-ant-x" }).id, "anthropic");
});

test("SI_PROVIDER disambiguates a shared sk- key and accepts friendly aliases", () => {
  assert.equal(cfgOf({ SI_PROVIDER: "deepseek", SI_API_KEY: "sk-abc" }).id, "deepseek");
  assert.equal(cfgOf({ SI_PROVIDER: "ChatGPT", SI_API_KEY: "sk-abc" }).id, "openai");
  assert.equal(cfgOf({ SI_PROVIDER: "claude", ANTHROPIC_API_KEY: "k" }).id, "anthropic");
  const bad = resolveProvider({ SI_PROVIDER: "skynet", SI_API_KEY: "k" });
  assert.equal(bad.ok, false);
});

test("SI_MODEL and SI_BASE_URL override defaults; a custom endpoint needs both", () => {
  const c = cfgOf({ OPENAI_API_KEY: "k", SI_MODEL: "gpt-x" });
  assert.equal(c.model, "gpt-x");
  const custom = cfgOf({ SI_API_KEY: "k", SI_BASE_URL: "https://openrouter.ai/api/v1/", SI_MODEL: "vendor/model" });
  assert.equal(custom.id, "custom");
  assert.equal(custom.baseUrl, "https://openrouter.ai/api/v1");
  assert.equal(custom.name, "openrouter.ai");
  assert.equal(resolveProvider({ SI_PROVIDER: "custom", SI_API_KEY: "k" }).ok, false);
  assert.equal(cfgOf({ ANTHROPIC_API_KEY: "k", ANTHROPIC_MODEL: "claude-old" }).model, "claude-old");
});

test("requests use the right wire format and keep the key out of the body", () => {
  const a = buildRequest(cfgOf({ ANTHROPIC_API_KEY: "secret" }), "SYS", "USER");
  assert.equal(a.url, "https://api.anthropic.com/v1/messages");
  assert.equal(a.headers["x-api-key"], "secret");
  assert.equal(a.body.system, "SYS");
  const d = buildRequest(cfgOf({ DEEPSEEK_API_KEY: "secret" }), "SYS", "USER");
  assert.equal(d.url, "https://api.deepseek.com/chat/completions");
  assert.equal(d.headers.authorization, "Bearer secret");
  assert.deepEqual((d.body.messages as { role: string }[]).map((m) => m.role), ["system", "user"]);
  assert.ok("max_tokens" in d.body);
  const o = buildRequest(cfgOf({ OPENAI_API_KEY: "secret" }), "SYS", "USER");
  assert.ok("max_completion_tokens" in o.body && !("max_tokens" in o.body));
  for (const r of [a, d, o]) assert.ok(!JSON.stringify(r.body).includes("secret"));
});

test("answer text is extracted from both response shapes", () => {
  assert.equal(extractText("anthropic", { content: [{ type: "thinking" }, { type: "text", text: "Hi [E1]." }] }), "Hi [E1].");
  assert.equal(extractText("openai-compatible", { choices: [{ message: { content: " Hi [E1]. " } }] }), "Hi [E1].");
  assert.equal(extractText("openai-compatible", { choices: [{ message: { content: [{ type: "text", text: "Hi" }] } }] }), "Hi");
  assert.equal(extractText("openai-compatible", { error: "x" }), "");
  assert.equal(extractText("anthropic", null), "");
});
