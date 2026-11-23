import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_CATEGORIES, categoryOptions } from "@/lib/categories";

export type UserCategory = { id: string; name: string; kind: string };

/** Trim, collapse repeated internal whitespace, Title Case. */
export function normalizeCategoryName(raw: string): string {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";
  return collapsed
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Returns the alphabetized union of default + this user's custom categories,
 * plus helpers to create/match a new category name.
 */
export function useCategoryOptions(storedValue?: string | null) {
  const qc = useQueryClient();
  const { userId } = useAuth();

  const { data: customs = [], isLoading } = useQuery({
    queryKey: ["user_categories", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_categories")
        .select("id,name,kind")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as UserCategory[]) ?? [];
    },
  });

  const merged = categoryOptions(customs.map((c) => c.name), storedValue);

  /**
   * Normalize + case-insensitive match against defaults + customs.
   * If it matches, returns the existing canonical name.
   * Otherwise inserts into user_categories and returns the normalized name.
   */
  async function createOrMatch(rawName: string): Promise<string> {
    const name = normalizeCategoryName(rawName);
    if (!name) throw new Error("Category name required");

    const key = name.toLowerCase();
    const existingDefault = DEFAULT_CATEGORIES.find((c) => c.toLowerCase() === key);
    if (existingDefault) return existingDefault;
    const existingCustom = customs.find((c) => c.name.toLowerCase() === key);
    if (existingCustom) return existingCustom.name;

    const { error } = await supabase
      .from("user_categories")
      .insert({ name })
      .select()
      .single();
    // On unique-violation race, treat as success (row exists now).
    if (error && !/duplicate|unique/i.test(error.message)) throw error;

    await qc.invalidateQueries({ queryKey: ["user_categories", userId] });
    return name;
  }

  return { categories: merged, customs, isLoading, createOrMatch };
}
