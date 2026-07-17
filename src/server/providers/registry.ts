import type { ProviderAdapterMetadata } from "@/server/collectors/contracts";

/**
 * Typed registry of built-in provider adapters.
 *
 * Every capability state below is a truthful statement about what is possible
 * today, not a promise dressed as a feature:
 *  - Consumer subscriptions (ChatGPT, Claude) expose NO official usage/quota
 *    API — those capabilities are "unsupported" and cost is "manual".
 *  - Official APIs (OpenAI, Anthropic, Gemini) have legitimate usage/billing
 *    endpoints — those are "planned" (not implemented yet; demo data is shown
 *    where seeded, always labeled demo).
 *  - Claude Code writes local metadata that a future local-file collector can
 *    read safely — "planned".
 */
export const PROVIDER_REGISTRY: ProviderAdapterMetadata[] = [
  {
    providerId: "openai",
    providerName: "OpenAI",
    category: "ai-model-provider",
    websiteUrl: "https://openai.com",
    connections: [
      {
        connectionId: "chatgpt-subscription",
        name: "ChatGPT subscription",
        kind: "subscription",
        collectionMethod: "manual-entry",
        capabilities: [
          { capability: "usage", state: "unsupported", note: "No official API exposes ChatGPT subscription usage." },
          { capability: "quota", state: "unsupported", note: "Message limits are not exposed by any supported interface." },
          { capability: "reset-time", state: "unsupported" },
          { capability: "cost", state: "manual", note: "Track the subscription fee manually." },
          { capability: "model-attribution", state: "unsupported" },
          { capability: "input-tokens", state: "unsupported" },
          { capability: "output-tokens", state: "unsupported" },
          { capability: "health", state: "unsupported" },
          { capability: "actions", state: "unsupported" },
        ],
        configurationRequirements: ["Monthly fee (manual entry)"],
        privacyNotes:
          "Nothing is read from your ChatGPT account. This app never scrapes chatgpt.com, browser sessions, or cookies. Only the fee you enter manually is stored.",
        supportedActions: [],
      },
      {
        connectionId: "openai-api",
        name: "OpenAI API",
        kind: "api",
        collectionMethod: "planned-official-api",
        capabilities: [
          { capability: "usage", state: "planned", note: "Official OpenAI usage API (demo data shown today)." },
          { capability: "model-attribution", state: "planned" },
          { capability: "input-tokens", state: "planned" },
          { capability: "output-tokens", state: "planned" },
          { capability: "cost", state: "planned", note: "Official costs endpoint (demo estimates shown today)." },
          { capability: "quota", state: "unavailable", note: "Rate limits are per-request headers, not a queryable quota." },
          { capability: "reset-time", state: "unavailable" },
          { capability: "health", state: "planned" },
          { capability: "actions", state: "planned" },
        ],
        configurationRequirements: ["Admin API key (stored locally, never committed)"],
        privacyNotes:
          "A future integration would read aggregate usage and billing metadata from the official OpenAI API only. No prompts or completions are ever collected.",
        supportedActions: [],
      },
    ],
  },
  {
    providerId: "anthropic",
    providerName: "Anthropic",
    category: "ai-model-provider",
    websiteUrl: "https://anthropic.com",
    connections: [
      {
        connectionId: "claude-subscription",
        name: "Claude subscription",
        kind: "subscription",
        collectionMethod: "manual-entry",
        capabilities: [
          { capability: "usage", state: "unsupported", note: "No official API exposes Claude subscription usage." },
          { capability: "quota", state: "unsupported", note: "Session limits are not exposed by any supported interface." },
          { capability: "reset-time", state: "unsupported" },
          { capability: "cost", state: "manual", note: "Track the subscription fee manually." },
          { capability: "model-attribution", state: "unsupported" },
          { capability: "input-tokens", state: "unsupported" },
          { capability: "output-tokens", state: "unsupported" },
          { capability: "health", state: "unsupported" },
          { capability: "actions", state: "unsupported" },
        ],
        configurationRequirements: ["Monthly fee (manual entry)"],
        privacyNotes:
          "Nothing is read from your Claude account. This app never scrapes claude.ai, browser sessions, or cookies. Only the fee you enter manually is stored.",
        supportedActions: [],
      },
      {
        connectionId: "claude-code",
        name: "Claude Code (local collector)",
        kind: "local-tool",
        collectionMethod: "local-file",
        capabilities: [
          { capability: "usage", state: "available", note: "Manual import from local Claude Code session metadata." },
          { capability: "model-attribution", state: "available" },
          { capability: "input-tokens", state: "available", note: "Includes separate cache-creation/cache-read counts when present." },
          { capability: "output-tokens", state: "available" },
          { capability: "cost", state: "unavailable", note: "No provider-billed cost exists locally; estimates are not implemented. The subscription fee is tracked manually." },
          { capability: "quota", state: "unavailable", note: "Plan limits are not exposed in a supported machine-readable way." },
          { capability: "reset-time", state: "unavailable", note: "No official, verifiable local source for reset schedules." },
          { capability: "health", state: "available", note: "Source detection and last-import status." },
          { capability: "actions", state: "unsupported" },
        ],
        configurationRequirements: ["Local data collection enabled in Settings"],
        privacyNotes:
          "Reads only usage metadata from local Claude Code session records: timestamps, model identifiers, and token counts. Prompts, responses, source code, file names, project names, and directory paths are never read into the result, persisted, or displayed.",
        supportedActions: [],
      },
      {
        connectionId: "anthropic-api",
        name: "Anthropic API",
        kind: "api",
        collectionMethod: "planned-official-api",
        capabilities: [
          { capability: "usage", state: "planned", note: "Official Admin Usage API (demo data shown today)." },
          { capability: "model-attribution", state: "planned" },
          { capability: "input-tokens", state: "planned" },
          { capability: "output-tokens", state: "planned" },
          { capability: "cost", state: "planned", note: "Official Cost API (demo estimates shown today)." },
          { capability: "quota", state: "unavailable", note: "Rate limits are per-request headers, not a queryable quota." },
          { capability: "reset-time", state: "unavailable" },
          { capability: "health", state: "planned" },
          { capability: "actions", state: "planned" },
        ],
        configurationRequirements: ["Admin API key (stored locally, never committed)"],
        privacyNotes:
          "A future integration would read aggregate usage and cost metadata from the official Anthropic Admin API only. No prompts or completions are ever collected.",
        supportedActions: [],
      },
    ],
  },
  {
    providerId: "google",
    providerName: "Google",
    category: "ai-model-provider",
    websiteUrl: "https://ai.google.dev",
    connections: [
      {
        connectionId: "gemini-api",
        name: "Google Gemini API",
        kind: "api",
        collectionMethod: "planned-official-api",
        capabilities: [
          { capability: "usage", state: "planned", note: "Via Google Cloud monitoring/billing APIs." },
          { capability: "model-attribution", state: "planned" },
          { capability: "input-tokens", state: "planned" },
          { capability: "output-tokens", state: "planned" },
          { capability: "cost", state: "planned", note: "Via Google Cloud Billing export." },
          { capability: "quota", state: "planned", note: "Google Cloud quotas API." },
          { capability: "reset-time", state: "unavailable" },
          { capability: "health", state: "planned" },
          { capability: "actions", state: "planned" },
        ],
        configurationRequirements: ["Google Cloud project + service credentials (stored locally)"],
        privacyNotes:
          "Not connected. A future integration would read aggregate usage and billing metadata from official Google Cloud APIs only.",
        supportedActions: [],
      },
    ],
  },
];

export function getProviderMetadata(providerId: string) {
  return PROVIDER_REGISTRY.find((p) => p.providerId === providerId);
}

export function getConnectionDeclaration(connectionId: string) {
  for (const provider of PROVIDER_REGISTRY) {
    const conn = provider.connections.find((c) => c.connectionId === connectionId);
    if (conn) return { provider, connection: conn };
  }
  return undefined;
}

/** Initial user-facing status per connection (seeded into the database). */
export const INITIAL_CONNECTION_STATUS: Record<string, string> = {
  "chatgpt-subscription": "manual",
  "claude-subscription": "manual",
  "claude-code": "local",
  "openai-api": "demo",
  "anthropic-api": "demo",
  "gemini-api": "not-connected",
};
