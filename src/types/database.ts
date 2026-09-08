// Hand-written mirror of supabase/schema.sql. Regenerate with the Supabase CLI
// (`supabase gen types typescript`) once the project is linked, if you'd like
// fully generated types instead.

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          gender: string;
          avatar_url: string | null;
          onboarding_complete: boolean;
          preferred_styles: string[];
          favorite_colors: string[];
          disliked_colors: string[];
          occasions: string[];
          budget: string;
          location: { lat: number; lon: number; label: string } | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      wardrobe_items: {
        Row: {
          id: string;
          user_id: string;
          image_url: string | null;
          name: string;
          category: string;
          subcategory: string | null;
          primary_color: string;
          secondary_colors: string[];
          pattern: string;
          material: string | null;
          brand: string | null;
          size: string | null;
          fit: string;
          season: string[];
          formality: string;
          style_tags: string[];
          times_worn: number;
          last_worn_at: string | null;
          favorite: boolean;
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["wardrobe_items"]["Row"]> & {
          user_id: string;
          name: string;
          category: string;
          primary_color: string;
        };
        Update: Partial<Database["public"]["Tables"]["wardrobe_items"]["Row"]>;
        Relationships: [];
      };
      outfits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          item_ids: string[];
          reason: string;
          occasion: string | null;
          missing_items: unknown;
          saved: boolean;
          worn_at: string[];
          rating: string | null;
          feedback_reasons: string[];
          feedback_note: string | null;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["outfits"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["outfits"]["Row"]>;
        Relationships: [];
      };
      wishlist: {
        Row: { id: string; user_id: string; product: unknown; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["wishlist"]["Row"]> & {
          user_id: string;
          product: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["wishlist"]["Row"]>;
        Relationships: [];
      };
      trips: {
        Row: {
          id: string;
          user_id: string;
          destination: string;
          start_date: string | null;
          end_date: string | null;
          duration_days: number;
          activities: string[];
          notes: string | null;
          packing_list: unknown;
          missing_items: unknown;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["trips"]["Row"]> & {
          user_id: string;
          destination: string;
        };
        Update: Partial<Database["public"]["Tables"]["trips"]["Row"]>;
        Relationships: [];
      };
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["chat_sessions"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_sessions"]["Row"]>;
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: string;
          content: string;
          outfits: unknown;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["chat_messages"]["Row"]> & {
          session_id: string;
          role: string;
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
