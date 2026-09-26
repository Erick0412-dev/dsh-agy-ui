/**
 * Types this plugin's browser half renders.
 *
 * The shapes live in `../quota.ts` — a dependency-free module shared with the
 * Node entry so the view logic is unit-testable without a browser — and are
 * re-exported here as the client half's import surface.
 */
export type {
  QuotaWindow,
  QuotaGroup,
  LegacyModelQuota,
  LegacyQuota,
  AgyAccountView,
  FamilyQuotaInfo,
  AgyLinkQuotas,
  AgyQuotaSource,
  QuotaWindowRow,
  QuotaCard
} from "../quota.js";

export type { AgyAccountSource, AgyState, AgyLimitsOutcome, ConnectionLike, AgyRpc } from "../quota-source.js";

/**
 * Pre-0.3.0 name for an account row.
 *
 * Kept because the family/legacy fallback path still speaks it, and because the
 * name appears in this plugin's README and issue references.
 */
export type { AgyAccountView as AgyAccount } from "../quota.js";

/** @deprecated pre-0.3.0 reply shape of the removed `/agy/api/accounts` route. */
export interface AgyAccountsResponse {
  accounts: import("../quota.js").AgyAccountView[];
}
