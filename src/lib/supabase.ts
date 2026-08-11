import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabase } from "./supabase-mock";

export type Company = {
  id: string;
  company_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  min_service_fee: number;
  house_wash_rate_per_sqft: number;
  driveway_small_fee: number;
  driveway_medium_fee: number;
  driveway_large_fee: number;
  roof_cleaning_addon: number;
  gutter_cleaning_addon: number;
  created_at: string | null;
};

export type QuoteStatus =
  | "new"
  | "contacted"
  | "booked"
  | "completed"
  | "cancelled"
  | "declined"
  | "archived";

export type Quote = {
  id: string;
  company_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_address: string;
  zip_code: string | null;
  service_type: string;
  property_size: number | null;
  driveway_size: string | null;
  addons: string[];
  line_items: unknown;
  subtotal: number;
  total: number;
  quote_type: "instant" | "custom";
  status: QuoteStatus;
  preferred_date: string | null;
  preferred_time_window: "morning" | "afternoon" | null;
  pricing_snapshot: unknown;
  created_at: string;
  updated_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: Company;
        Insert: Company;
        Update: Partial<Company>;
        Relationships: [];
      };
      quotes: {
        Row: Quote;
        Insert: Omit<Quote, "id" | "created_at" | "updated_at">;
        Update: Partial<Quote>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isPlaceholder =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes("your-project-ref") ||
  supabaseAnonKey.includes("your-anon-key");

export const supabase: SupabaseClient<Database> = isPlaceholder
  ? (createMockSupabase() as unknown as SupabaseClient<Database>)
  : createClient<Database>(supabaseUrl, supabaseAnonKey);
