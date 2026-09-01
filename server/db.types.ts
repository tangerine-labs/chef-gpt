export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      cookbooks: {
        Row: {
          created_at: string;
          household_id: string | null;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          household_id?: string | null;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          household_id?: string | null;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cookbooks_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      household_cookbooks: {
        Row: {
          cookbook_id: string;
          enabled: boolean;
          household_id: string;
        };
        Insert: {
          cookbook_id: string;
          enabled?: boolean;
          household_id: string;
        };
        Update: {
          cookbook_id?: string;
          enabled?: boolean;
          household_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_cookbooks_cookbook_id_fkey";
            columns: ["cookbook_id"];
            isOneToOne: false;
            referencedRelation: "cookbooks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "household_cookbooks_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      households: {
        Row: {
          created_at: string;
          id: string;
          locale: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          locale?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          locale?: string;
          name?: string;
        };
        Relationships: [];
      };
      meal_plans: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          week_start: string;
        };
        Insert: {
          created_at?: string;
          household_id: string;
          id?: string;
          week_start: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meal_plans_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      members: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          name: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          household_id: string;
          id?: string;
          name: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          name?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      ranking_entries: {
        Row: {
          ranking_id: string;
          recipe_id: string;
          tier: Database["public"]["Enums"]["tier"];
        };
        Insert: {
          ranking_id: string;
          recipe_id: string;
          tier: Database["public"]["Enums"]["tier"];
        };
        Update: {
          ranking_id?: string;
          recipe_id?: string;
          tier?: Database["public"]["Enums"]["tier"];
        };
        Relationships: [
          {
            foreignKeyName: "ranking_entries_ranking_id_fkey";
            columns: ["ranking_id"];
            isOneToOne: false;
            referencedRelation: "rankings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ranking_entries_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      rankings: {
        Row: {
          id: string;
          member_id: string;
          round_id: string;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          round_id: string;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          round_id?: string;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rankings_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rankings_round_id_fkey";
            columns: ["round_id"];
            isOneToOne: false;
            referencedRelation: "rounds";
            referencedColumns: ["id"];
          },
        ];
      };
      recipes: {
        Row: {
          allergens: string[];
          based_on_recipe_id: string | null;
          cook_time_minutes: number | null;
          cookbook_id: string;
          created_at: string;
          cuisine: string | null;
          description: string;
          difficulty: string | null;
          external_id: string | null;
          id: string;
          image_url: string | null;
          ingredients: Json;
          instructions: string[];
          servings: string | null;
          source: string | null;
          tags: string[];
          title: string;
          updated_at: string;
          url: string | null;
        };
        Insert: {
          allergens?: string[];
          based_on_recipe_id?: string | null;
          cook_time_minutes?: number | null;
          cookbook_id: string;
          created_at?: string;
          cuisine?: string | null;
          description?: string;
          difficulty?: string | null;
          external_id?: string | null;
          id?: string;
          image_url?: string | null;
          ingredients?: Json;
          instructions?: string[];
          servings?: string | null;
          source?: string | null;
          tags?: string[];
          title: string;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          allergens?: string[];
          based_on_recipe_id?: string | null;
          cook_time_minutes?: number | null;
          cookbook_id?: string;
          created_at?: string;
          cuisine?: string | null;
          description?: string;
          difficulty?: string | null;
          external_id?: string | null;
          id?: string;
          image_url?: string | null;
          ingredients?: Json;
          instructions?: string[];
          servings?: string | null;
          source?: string | null;
          tags?: string[];
          title?: string;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recipes_based_on_recipe_id_fkey";
            columns: ["based_on_recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipes_cookbook_id_fkey";
            columns: ["cookbook_id"];
            isOneToOne: false;
            referencedRelation: "cookbooks";
            referencedColumns: ["id"];
          },
        ];
      };
      retired_recipes: {
        Row: {
          created_at: string;
          household_id: string;
          recipe_id: string;
        };
        Insert: {
          created_at?: string;
          household_id: string;
          recipe_id: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          recipe_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "retired_recipes_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "retired_recipes_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      round_candidates: {
        Row: {
          position: number;
          recipe_id: string;
          round_id: string;
        };
        Insert: {
          position?: number;
          recipe_id: string;
          round_id: string;
        };
        Update: {
          position?: number;
          recipe_id?: string;
          round_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "round_candidates_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "round_candidates_round_id_fkey";
            columns: ["round_id"];
            isOneToOne: false;
            referencedRelation: "rounds";
            referencedColumns: ["id"];
          },
        ];
      };
      round_participants: {
        Row: {
          member_id: string;
          round_id: string;
        };
        Insert: {
          member_id: string;
          round_id: string;
        };
        Update: {
          member_id?: string;
          round_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "round_participants_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "round_participants_round_id_fkey";
            columns: ["round_id"];
            isOneToOne: false;
            referencedRelation: "rounds";
            referencedColumns: ["id"];
          },
        ];
      };
      rounds: {
        Row: {
          closed_at: string | null;
          created_at: string;
          household_id: string;
          id: string;
          label: string;
          status: Database["public"]["Enums"]["round_status"];
        };
        Insert: {
          closed_at?: string | null;
          created_at?: string;
          household_id: string;
          id?: string;
          label?: string;
          status?: Database["public"]["Enums"]["round_status"];
        };
        Update: {
          closed_at?: string | null;
          created_at?: string;
          household_id?: string;
          id?: string;
          label?: string;
          status?: Database["public"]["Enums"]["round_status"];
        };
        Relationships: [
          {
            foreignKeyName: "rounds_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      shopping_items: {
        Row: {
          checked: boolean;
          created_at: string;
          household_id: string;
          id: string;
          name: string;
          position: number;
          quantity: string | null;
          recipe_id: string | null;
          unit: string | null;
        };
        Insert: {
          checked?: boolean;
          created_at?: string;
          household_id: string;
          id?: string;
          name: string;
          position?: number;
          quantity?: string | null;
          recipe_id?: string | null;
          unit?: string | null;
        };
        Update: {
          checked?: boolean;
          created_at?: string;
          household_id?: string;
          id?: string;
          name?: string;
          position?: number;
          quantity?: string | null;
          recipe_id?: string | null;
          unit?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "shopping_items_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shopping_items_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      slots: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          meal_plan_id: string;
          meal_type: Database["public"]["Enums"]["meal_type"];
          recipe_id: string | null;
          title: string | null;
        };
        Insert: {
          created_at?: string;
          date: string;
          id?: string;
          meal_plan_id: string;
          meal_type?: Database["public"]["Enums"]["meal_type"];
          recipe_id?: string | null;
          title?: string | null;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          meal_plan_id?: string;
          meal_type?: Database["public"]["Enums"]["meal_type"];
          recipe_id?: string | null;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "slots_meal_plan_id_fkey";
            columns: ["meal_plan_id"];
            isOneToOne: false;
            referencedRelation: "meal_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "slots_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cookbook_household: { Args: { cid: string }; Returns: string };
      ensure_household: { Args: never; Returns: string };
      is_member_of: { Args: { hid: string }; Returns: boolean };
      plan_household: { Args: { pid: string }; Returns: string };
      round_household: { Args: { rid: string }; Returns: string };
    };
    Enums: {
      meal_type: "breakfast" | "lunch" | "dinner" | "snack";
      round_status: "open" | "closed";
      tier: "S" | "A" | "B" | "C" | "D" | "F" | "GARBAGE";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      meal_type: ["breakfast", "lunch", "dinner", "snack"],
      round_status: ["open", "closed"],
      tier: ["S", "A", "B", "C", "D", "F", "GARBAGE"],
    },
  },
} as const;
