import { wrapAdapter } from "./interceptor.js";
export * from "./interceptor.js";

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
