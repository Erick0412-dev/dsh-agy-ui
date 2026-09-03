export const WRAPPED_FLAG = Symbol.for("dsh.agy-ui.wrapped");

export interface LlmModelInfo {
  provider: string;
  id: string;
  name: string;
  description?: string;
  inputModalities?: readonly string[];
}

export interface LlmResolvedModelInfo {
  provider: string;
  id: string;
  name: string;
  description?: string;
  inputModalities?: readonly string[];
  context?: { contextWindow: number };
  defaultMaxTokens?: number;
  reasoning?: {
    efforts: Array<{ id: string; name: string }>;
    defaultEffort?: string;
  };
}

/** Check if a model is an internal ghost model (chat_\d+ or tab_) */
export function isGhostModel(modelId: string): boolean {
  if (!modelId || typeof modelId !== "string") return true;
  if (/^chat_\d+$/.test(modelId)) return true;
  if (/^tab_/.test(modelId)) return true;
  return false;
}

/** Format dynamic tiered model id to brand display name (e.g. 'gemini-3.8-flash-tiered' -> 'Gemini 3.8 Flash') */
export function formatTieredModelName(modelId: string): string {
  const base = modelId.replace(/-tiered$/, "");
  return base
    .split("-")
    .map(part => /^\d+(\.\d+)*$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Standard Reasoning efforts for Level-thinking / Tiered models */
export const STANDARD_REASONING = Object.freeze({
  efforts: Object.freeze([
    { id: "low", name: "Low" },
    { id: "medium", name: "Medium" },
    { id: "high", name: "High" }
  ]),
  defaultEffort: "medium"
});

export const PRO_REASONING = Object.freeze({
  efforts: Object.freeze([
    { id: "low", name: "Low" },
    { id: "high", name: "High" }
  ]),
  defaultEffort: "high"
});

/** Canonical friendly names */
export const CANONICAL_NAMES: Record<string, string> = {
  "gemini-3.8-flash-tiered": "Gemini 3.8 Flash",
  "gemini-3.7-flash-tiered": "Gemini 3.7 Flash",
  "gemini-3.6-flash-tiered": "Gemini 3.6 Flash",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gemini-3-flash": "Gemini 3 Flash",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
  "gemini-3.1-flash-image": "Gemini 3.1 Flash Image",
  "gemini-3.1-pro": "Gemini 3.1 Pro",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-flash-thinking": "Gemini 2.5 Flash Thinking",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
  "claude-sonnet-4-6": "Claude Sonnet 4.6 (Thinking)",
  "claude-opus-4-6-thinking": "Claude Opus 4.6 (Thinking)",
  "gpt-oss-120b-medium": "GPT-OSS 120B (Medium)"
};

/** Explicit priority ranking: 3.8 Flash -> 3.7 Flash -> 3.6 Flash -> 3.5 Flash -> 3 Flash -> 3.1 Flash Lite/Image -> 3.1 Pro -> 2.5 Series -> Claude -> GPT-OSS */
export const MODEL_PRIORITY: Record<string, number> = {
  "gemini-3.8-flash-tiered": 10,
  "gemini-3.7-flash-tiered": 20,
  "gemini-3.6-flash-tiered": 30,
  "gemini-3.5-flash": 40,
  "gemini-3-flash": 50,
  "gemini-3.1-flash-lite": 60,
  "gemini-3.1-flash-image": 70,
  "gemini-3.1-pro": 80,
  "gemini-2.5-pro": 90,
  "gemini-2.5-flash": 100,
  "gemini-2.5-flash-thinking": 110,
  "gemini-2.5-flash-lite": 120,
  "claude-sonnet-4-6": 130,
  "claude-opus-4-6-thinking": 140,
  "gpt-oss-120b-medium": 150
};

/** Check if this model is an expanded effort variant that should be folded */
export function isFoldedVariant(modelId: string): boolean {
  if (modelId.startsWith("gemini-")) {
    if (
      modelId.endsWith("-low") ||
      modelId.endsWith("-medium") ||
      modelId.endsWith("-high") ||
      modelId.endsWith("-extra-low") ||
      modelId === "gemini-pro-agent" ||
      modelId === "gemini-3-flash-agent"
    ) {
      return true;
    }
  }
  return false;
}

/** Wrap agy LlmAdapter with clean priority sorting, ghost filtering, folding, and tiered model enhancements */
export function wrapAdapter(adapter: any, logger?: any) {
  if (!adapter || adapter[WRAPPED_FLAG]) return;
  adapter[WRAPPED_FLAG] = true;

  const originalListModels = adapter.listModels?.bind(adapter);
  const originalResolveModel = adapter.resolveModel?.bind(adapter);
  const originalStream = adapter.stream?.bind(adapter);

  if (originalListModels) {
    adapter.listModels = async function (provider: string): Promise<readonly LlmModelInfo[]> {
      try {
        const rawModels: LlmModelInfo[] = await originalListModels(provider);
        if (!Array.isArray(rawModels)) return rawModels;

        const allIds = new Set(rawModels.map(m => m.id));
        const filtered: LlmModelInfo[] = [];
        const seen = new Set<string>();

        // 1. Inject consolidated Gemini 3.1 Pro if its variants exist
        const has31ProVariants =
          allIds.has("gemini-3.1-pro-low") ||
          allIds.has("gemini-3.1-pro-high") ||
          allIds.has("gemini-pro-agent");
        if (has31ProVariants && !seen.has("gemini-3.1-pro")) {
          seen.add("gemini-3.1-pro");
          filtered.push({
            provider,
            id: "gemini-3.1-pro",
            name: "Gemini 3.1 Pro",
            inputModalities: ["text", "image"]
          });
        }

        // 2. Inject consolidated Gemini 3.5 Flash if its variants exist
        const has35FlashVariants =
          allIds.has("gemini-3.5-flash-low") ||
          allIds.has("gemini-3.5-flash-extra-low") ||
          allIds.has("gemini-3-flash-agent");
        if (has35FlashVariants && !seen.has("gemini-3.5-flash")) {
          seen.add("gemini-3.5-flash");
          filtered.push({
            provider,
            id: "gemini-3.5-flash",
            name: "Gemini 3.5 Flash",
            inputModalities: ["text", "image"]
          });
        }

        for (const m of rawModels) {
          if (!m || typeof m.id !== "string") continue;

          // Filter internal ghost models (chat_*, tab_*)
          if (isGhostModel(m.id)) continue;

          // Effort folding: skip scattered effort variants
          if (isFoldedVariant(m.id)) continue;

          if (seen.has(m.id)) continue;
          seen.add(m.id);

          // Canonical name formatting
          let displayName = m.name;
          if (CANONICAL_NAMES[m.id]) {
            displayName = CANONICAL_NAMES[m.id];
          } else if (m.id.endsWith("-tiered")) {
            displayName = formatTieredModelName(m.id);
          }

          filtered.push({
            ...m,
            name: displayName
          });
        }

        // 3. Exact priority sort
        filtered.sort((a, b) => {
          const pA = MODEL_PRIORITY[a.id] ?? 999;
          const pB = MODEL_PRIORITY[b.id] ?? 999;
          return pA - pB;
        });

        return filtered;
      } catch (err) {
        logger?.warn?.("[dsh-agy-ui] listModels interceptor fallback on error:", err);
        return originalListModels(provider);
      }
    };
  }

  if (originalResolveModel) {
    adapter.resolveModel = async function (provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
      try {
        // Consolidated Gemini 3.1 Pro
        if (model === "gemini-3.1-pro") {
          let base: LlmResolvedModelInfo | undefined;
          try {
            base = await originalResolveModel(provider, "gemini-pro-agent", signal);
          } catch {
            try {
              base = await originalResolveModel(provider, "gemini-3.1-pro-low", signal);
            } catch {
              // fallback
            }
          }
          return {
            provider,
            id: "gemini-3.1-pro",
            name: "Gemini 3.1 Pro",
            inputModalities: ["text", "image"],
            context: base?.context ?? { contextWindow: 1048576 },
            defaultMaxTokens: base?.defaultMaxTokens ?? 65535,
            reasoning: {
              ...PRO_REASONING,
              efforts: [...PRO_REASONING.efforts]
            }
          };
        }

        // Consolidated Gemini 3.5 Flash
        if (model === "gemini-3.5-flash") {
          let base: LlmResolvedModelInfo | undefined;
          try {
            base = await originalResolveModel(provider, "gemini-3.5-flash-low", signal);
          } catch {
            try {
              base = await originalResolveModel(provider, "gemini-3-flash-agent", signal);
            } catch {
              // fallback
            }
          }
          return {
            provider,
            id: "gemini-3.5-flash",
            name: "Gemini 3.5 Flash",
            inputModalities: ["text", "image"],
            context: base?.context ?? { contextWindow: 1048576 },
            defaultMaxTokens: base?.defaultMaxTokens ?? 65536,
            reasoning: {
              ...STANDARD_REASONING,
              efforts: [...STANDARD_REASONING.efforts]
            }
          };
        }

        let resolved: LlmResolvedModelInfo;
        try {
          resolved = await originalResolveModel(provider, model, signal);
        } catch (err) {
          // Backward compatibility: If original failed, try resolving tiered counterpart
          const match = model.match(/^(.*)-(low|medium|high|extra-low)$/);
          if (match) {
            const tieredId = `${match[1]}-tiered`;
            const fallbackResolved = await originalResolveModel(provider, tieredId, signal);
            resolved = {
              ...fallbackResolved,
              id: model,
              name: `${formatTieredModelName(tieredId)} (${match[2].toUpperCase()})`
            };
          } else {
            throw err;
          }
        }

        // Tiered models: ensure clean name and standard reasoning efforts
        if (model.endsWith("-tiered") || resolved.id?.endsWith("-tiered")) {
          resolved = {
            ...resolved,
            name: formatTieredModelName(resolved.id),
            reasoning: {
              ...STANDARD_REASONING,
              efforts: [...STANDARD_REASONING.efforts]
            }
          };
        } else if (CANONICAL_NAMES[resolved.id]) {
          resolved = {
            ...resolved,
            name: CANONICAL_NAMES[resolved.id]
          };
        }

        return resolved;
      } catch (err) {
        logger?.warn?.(`[dsh-agy-ui] resolveModel interceptor error for model "${model}":`, err);
        return originalResolveModel(provider, model, signal);
      }
    };
  }

  if (originalStream) {
    adapter.stream = async function* (options: any) {
      let streamOptions = options;
      if (options?.model) {
        // Consolidated Gemini 3.1 Pro dispatch
        if (options.model === "gemini-3.1-pro") {
          const effort = options.reasoningEffort?.toLowerCase();
          const targetModel = effort === "low" ? "gemini-3.1-pro-low" : "gemini-pro-agent";
          streamOptions = {
            ...options,
            model: targetModel
          };
        }
        // Consolidated Gemini 3.5 Flash dispatch
        else if (options.model === "gemini-3.5-flash") {
          const effort = options.reasoningEffort?.toLowerCase();
          const targetModel =
            effort === "low"
              ? "gemini-3.5-flash-extra-low"
              : effort === "high"
              ? "gemini-3-flash-agent"
              : "gemini-3.5-flash-low";
          streamOptions = {
            ...options,
            model: targetModel
          };
        }
        // Backward compatibility for tiered variants
        else {
          const match = options.model.match(/^(.*)-(low|medium|high|extra-low)$/);
          if (match && (match[1] === "gemini-3.6-flash" || match[1] === "gemini-3.7-flash" || match[1] === "gemini-3.8-flash")) {
            const prefix = match[1];
            const suffix = match[2];
            const tieredId = `${prefix}-tiered`;
            streamOptions = {
              ...options,
              model: tieredId,
              reasoningEffort: options.reasoningEffort || (suffix === "extra-low" ? "low" : suffix)
            };
          }
        }
      }
      yield* originalStream(streamOptions);
    };
  }

  logger?.info?.("[dsh-agy-ui] Successfully wrapped agy LlmAdapter");
}
