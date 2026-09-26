import { injectAgyUiStyles } from "./styles.js";
import { AgyQuotaBadge, setAgyUiConnection } from "./badge.js";
import type { ConnectionLike } from "../quota-source.js";

export const name = "dsh-agy-ui-client";

/**
 * The slot registry plus DSH's RPC carrier.
 *
 * `connection` is what makes the dsh-agy >= 0.3.0 management surface reachable:
 * the host serves it at `/api/agy` over this same channel, and the standalone
 * `/agy` dashboard it replaced no longer exists. dsh-agy's own Settings section
 * injects the same trio, so this is a proven static injection for a web-only
 * client plugin.
 */
export const inject = ["slots", "connection"];

export function apply(ctx: any) {
  injectAgyUiStyles();

  // The header-actions slot renders the registered component with EMPTY props,
  // so the connection service cannot arrive as a prop; hand it over through the
  // badge module's accessor instead. Reading it lazily at fetch time also means
  // a service that activates after this plugin still gets picked up.
  const connection = ctx.get("connection") as ConnectionLike | undefined;
  if (connection) {
    setAgyUiConnection(connection);
  } else {
    ctx.logger?.warn?.(
      "[dsh-agy-ui] connection service unavailable — falling back to the legacy quota channels"
    );
  }

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
