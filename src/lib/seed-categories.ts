import { SupabaseClient } from "@supabase/supabase-js";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "./types";

export async function seedBuiltinCategories(
  supabase: SupabaseClient,
  userId: string
) {
  const rows = ALL_CATEGORIES.map((slug) => ({
    id: slug,
    label: CATEGORY_LABELS[slug],
    description: "",
    is_builtin: true,
    hidden: false,
    user_id: userId,
  }));

  const { error } = await supabase.from("categories").insert(rows);
  if (error) {
    console.error("Failed to seed categories:", error.message);
    throw error;
  }
}
