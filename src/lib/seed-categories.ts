import { SupabaseClient } from "@supabase/supabase-js";

// Cette fonction n'est plus utilisée au signup.
// Les catégories sont créées via l'onboarding.
// Gardée comme référence uniquement.
export async function seedBuiltinCategories(
  _supabase: SupabaseClient,
  _userId: string
) {
  console.warn('seedBuiltinCategories is deprecated. Use onboarding flow instead.');
}
