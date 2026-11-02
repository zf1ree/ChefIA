// Gerado a partir do banco (Supabase MCP generate_typescript_types).
// Para regenerar: npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type StorageLocation = 'fridge' | 'freezer' | 'pantry';
type IngredientSource = 'scan' | 'manual' | 'catalog';
type PlanTier = 'free' | 'premium';
type AiUsageKind = 'scan' | 'recipes';

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' };
  public: {
    Tables: {
      ai_usage_events: {
        Row: { created_at: string; id: number; kind: AiUsageKind; user_id: string };
        Insert: { created_at?: string; id?: never; kind: AiUsageKind; user_id: string };
        Update: { created_at?: string; id?: never; kind?: AiUsageKind; user_id?: string };
        Relationships: [];
      };
      cooking_history: {
        Row: { cooked_at: string; id: string; recipe_id: string; user_id: string };
        Insert: { cooked_at?: string; id?: string; recipe_id: string; user_id?: string };
        Update: { cooked_at?: string; id?: string; recipe_id?: string; user_id?: string };
        Relationships: [
          { foreignKeyName: 'cooking_history_recipe_id_fkey'; columns: ['recipe_id']; isOneToOne: false; referencedRelation: 'recipes'; referencedColumns: ['id'] },
        ];
      };
      favorites: {
        Row: { created_at: string; recipe_id: string; user_id: string };
        Insert: { created_at?: string; recipe_id: string; user_id?: string };
        Update: { created_at?: string; recipe_id?: string; user_id?: string };
        Relationships: [
          { foreignKeyName: 'favorites_recipe_id_fkey'; columns: ['recipe_id']; isOneToOne: false; referencedRelation: 'recipes'; referencedColumns: ['id'] },
        ];
      };
      ingredients: {
        Row: { category: string; default_location: StorageLocation; id: number; name: string };
        Insert: { category: string; default_location?: StorageLocation; id?: never; name: string };
        Update: { category?: string; default_location?: StorageLocation; id?: never; name?: string };
        Relationships: [];
      };
      plan_limits: {
        Row: { plan: PlanTier; recipe_generations_per_day: number; scans_per_day: number };
        Insert: { plan: PlanTier; recipe_generations_per_day: number; scans_per_day: number };
        Update: { plan?: PlanTier; recipe_generations_per_day?: number; scans_per_day?: number };
        Relationships: [];
      };
      profiles: {
        Row: {
          allergies: string[];
          created_at: string;
          cuisine_preferences: string[];
          default_servings: number;
          dietary_restrictions: string[];
          disliked_ingredients: string[];
          display_name: string | null;
          id: string;
          image_processing_consent_at: string | null;
          max_cooking_minutes: number | null;
          pantry_staples: string[];
          plan: PlanTier;
          updated_at: string;
        };
        Insert: {
          allergies?: string[];
          created_at?: string;
          cuisine_preferences?: string[];
          default_servings?: number;
          dietary_restrictions?: string[];
          disliked_ingredients?: string[];
          display_name?: string | null;
          id: string;
          image_processing_consent_at?: string | null;
          max_cooking_minutes?: number | null;
          pantry_staples?: string[];
          plan?: PlanTier;
          updated_at?: string;
        };
        Update: {
          allergies?: string[];
          created_at?: string;
          cuisine_preferences?: string[];
          default_servings?: number;
          dietary_restrictions?: string[];
          disliked_ingredients?: string[];
          display_name?: string | null;
          id?: string;
          image_processing_consent_at?: string | null;
          max_cooking_minutes?: number | null;
          pantry_staples?: string[];
          plan?: PlanTier;
          updated_at?: string;
        };
        Relationships: [];
      };
      recipe_feedback: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          rating: number;
          recipe_id: string;
          updated_at: string;
          user_id: string;
          worked: boolean | null;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating: number;
          recipe_id: string;
          updated_at?: string;
          user_id?: string;
          worked?: boolean | null;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating?: number;
          recipe_id?: string;
          updated_at?: string;
          user_id?: string;
          worked?: boolean | null;
        };
        Relationships: [
          { foreignKeyName: 'recipe_feedback_recipe_id_fkey'; columns: ['recipe_id']; isOneToOne: false; referencedRelation: 'recipes'; referencedColumns: ['id'] },
        ];
      };
      recipes: {
        Row: {
          created_at: string;
          data: Json;
          difficulty: string | null;
          id: string;
          meal_type: string | null;
          model: string;
          scan_id: string | null;
          servings: number | null;
          title: string;
          total_minutes: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          data: Json;
          difficulty?: string | null;
          id?: string;
          meal_type?: string | null;
          model: string;
          scan_id?: string | null;
          servings?: number | null;
          title: string;
          total_minutes?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          difficulty?: string | null;
          id?: string;
          meal_type?: string | null;
          model?: string;
          scan_id?: string | null;
          servings?: number | null;
          title?: string;
          total_minutes?: number | null;
          user_id?: string;
        };
        Relationships: [
          { foreignKeyName: 'recipes_scan_id_fkey'; columns: ['scan_id']; isOneToOne: false; referencedRelation: 'scans'; referencedColumns: ['id'] },
        ];
      };
      scan_ingredients: {
        Row: {
          category: string;
          confidence: number | null;
          id: string;
          name: string;
          needs_confirmation: boolean;
          quantity_estimate: string | null;
          scan_id: string;
          user_id: string;
        };
        Insert: {
          category: string;
          confidence?: number | null;
          id?: string;
          name: string;
          needs_confirmation?: boolean;
          quantity_estimate?: string | null;
          scan_id: string;
          user_id: string;
        };
        Update: {
          category?: string;
          confidence?: number | null;
          id?: string;
          name?: string;
          needs_confirmation?: boolean;
          quantity_estimate?: string | null;
          scan_id?: string;
          user_id?: string;
        };
        Relationships: [
          { foreignKeyName: 'scan_ingredients_scan_id_fkey'; columns: ['scan_id']; isOneToOne: false; referencedRelation: 'scans'; referencedColumns: ['id'] },
        ];
      };
      scans: {
        Row: { created_at: string; id: string; image_issue: string | null; image_usable: boolean; model: string; notes: string | null; user_id: string };
        Insert: { created_at?: string; id?: string; image_issue?: string | null; image_usable: boolean; model: string; notes?: string | null; user_id: string };
        Update: { created_at?: string; id?: string; image_issue?: string | null; image_usable?: boolean; model?: string; notes?: string | null; user_id?: string };
        Relationships: [];
      };
      shopping_list_items: {
        Row: {
          category: string;
          checked: boolean;
          created_at: string;
          id: string;
          list_id: string;
          name: string;
          normalized_name: string;
          quantity: string | null;
          recipe_titles: string[];
          user_id: string;
        };
        Insert: {
          category?: string;
          checked?: boolean;
          created_at?: string;
          id?: string;
          list_id: string;
          name: string;
          normalized_name: string;
          quantity?: string | null;
          recipe_titles?: string[];
          user_id?: string;
        };
        Update: {
          category?: string;
          checked?: boolean;
          created_at?: string;
          id?: string;
          list_id?: string;
          name?: string;
          normalized_name?: string;
          quantity?: string | null;
          recipe_titles?: string[];
          user_id?: string;
        };
        Relationships: [
          { foreignKeyName: 'shopping_list_items_list_id_fkey'; columns: ['list_id']; isOneToOne: false; referencedRelation: 'shopping_lists'; referencedColumns: ['id'] },
        ];
      };
      shopping_lists: {
        Row: { created_at: string; id: string; name: string; user_id: string };
        Insert: { created_at?: string; id?: string; name?: string; user_id?: string };
        Update: { created_at?: string; id?: string; name?: string; user_id?: string };
        Relationships: [];
      };
      user_ingredients: {
        Row: {
          category: string;
          created_at: string;
          expires_on: string | null;
          id: string;
          ingredient_id: number | null;
          location: StorageLocation;
          name: string;
          notes: string | null;
          quantity: string | null;
          source: IngredientSource;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          expires_on?: string | null;
          id?: string;
          ingredient_id?: number | null;
          location?: StorageLocation;
          name: string;
          notes?: string | null;
          quantity?: string | null;
          source?: IngredientSource;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          expires_on?: string | null;
          id?: string;
          ingredient_id?: number | null;
          location?: StorageLocation;
          name?: string;
          notes?: string | null;
          quantity?: string | null;
          source?: IngredientSource;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          { foreignKeyName: 'user_ingredients_ingredient_id_fkey'; columns: ['ingredient_id']; isOneToOne: false; referencedRelation: 'ingredients'; referencedColumns: ['id'] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      consume_ai_quota: { Args: { p_kind: AiUsageKind }; Returns: { event_id: number; quota: number; used: number }[] };
      delete_my_account: { Args: never; Returns: undefined };
      get_ai_usage: { Args: never; Returns: { kind: AiUsageKind; plan: PlanTier; quota: number; used: number }[] };
      refund_ai_quota: { Args: { p_event_id: number }; Returns: undefined };
    };
    Enums: {
      ai_usage_kind: AiUsageKind;
      ingredient_source: IngredientSource;
      plan_tier: PlanTier;
      storage_location: StorageLocation;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
