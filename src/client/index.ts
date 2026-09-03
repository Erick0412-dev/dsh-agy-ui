import { injectAgyUiStyles } from "./styles.js";
import { AgyQuotaBadge } from "./badge.js";

export const name = "dsh-agy-ui-client";
export const inject = ["slots"];

export function apply(ctx: any) {
  console.log("[dsh-agy-ui-client] Client plugin apply called!");
  injectAgyUiStyles();

  ctx.slots.inject("conversation.session.header.actions", () => {
    return ctx.slots.register(
      {
        name: "conversation.session.header.actions",
        id: "agy-ui-quota-badge",
        order: 8,
        label: "Antigravity Quota"
      },
      AgyQuotaBadge
    );
  });
}
