import { wrapAdapter } from "./interceptor.js";
export * from "./interceptor.js";

// The quota view helpers are dependency-free on purpose: they are re-exported
// from this Node entry so they can be unit-tested without a browser, while the
// client half imports the same module and inlines it into the web bundle.
export * from "./quota.js";
export * from "./quota-source.js";

export const name = "dsh-agy-ui";
export const inject = ["llm"];

export function apply(ctx: any) {
  console.log("[dsh-agy-ui] apply called! Initializing plugin...");
  ctx.logger?.info?.("[dsh-agy-ui] Initializing plugin...");

  const tryWrap = () => {
    const llmService = ctx.get("llm");
    if (!llmService?.adapters) return false;
    const agyReg = llmService.adapters.get("agy");
    if (agyReg?.adapter) {
      wrapAdapter(agyReg.adapter, ctx.logger);
      return true;
    }
    return false;
  };

  if (!tryWrap()) {
    ctx.logger.info("[dsh-agy-ui] agy adapter not found yet, listening for updates...");
  }

  ctx.on("llm/adapters-updated", () => {
    tryWrap();
  });
}
