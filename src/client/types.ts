export interface AgyModelQuota {
  id: string;
  remainingFraction: number;
  resetTime: string | null;
}

export interface FamilyQuotaInfo {
  remainingFraction?: number;
  resetTime?: string | null;
  weeklyFraction?: number;
  weeklyResetTime?: string | null;
  description?: string;
}

export interface AgyLinkQuotas {
  google?: FamilyQuotaInfo;
  anthropic?: FamilyQuotaInfo;
  openai?: FamilyQuotaInfo;
}

export interface AgyAccount {
  index: number;
  email: string;
  projectId: string;
  active: boolean;
  state: "active" | "cooling" | "rate-limited" | "verification-required" | "disabled" | string;
  cooldownUntil: number | null;
  cooldownReason?: string | null;
  quota?: {
    modelCount: number;
    models: AgyModelQuota[];
  };
}

export interface AgyAccountsResponse {
  accounts: AgyAccount[];
}
