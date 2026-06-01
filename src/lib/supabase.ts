import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://ibjsdafxjggjyamkdjeh.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_ztTyEdZPNNfk5PjttJimDg_-g3fmC0D";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type Transaction = {
  id: string;
  occurred_at: string;
  amount: number;
  direction: "credit" | "debit";
  category: string | null;
  subcategory: string | null;
  description: string | null;
  source: "manual" | "csv" | "recurring";
  is_recurring: boolean | null;
  recurring_label: string | null;
  notes: string | null;
  created_at: string;
};

export type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number | null;
  target_date: string;
  priority: number | null;
  status: "active" | "paused" | "completed";
  created_at: string;
};

export type FixedExpense = {
  id: string;
  name: string;
  amount: number;
  category: string | null;
  day_of_month: number | null;
  active: boolean | null;
  created_at: string;
};
