// Feature flag runtime — Story 1.8.
// Aligné sur supabase/migrations/0004_create_feature_flags.sql.

export type FeatureFlagScope = "internal" | "alpha" | "beta" | "prod";

export interface FeatureFlag {
  id: string;
  flag_code: string;
  /** NULL = scope global ; non-NULL = override pour ce spawter. */
  spawter_id: string | null;
  enabled: boolean;
  scope: FeatureFlagScope;
  /** NULL = pas d'expiration. */
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}
