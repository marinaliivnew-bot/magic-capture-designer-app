export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      board_blocks: {
        Row: {
          block_type: string
          caption: string | null
          created_at: string
          id: string
          project_id: string
          sort_order: number
        }
        Insert: {
          block_type: string
          caption?: string | null
          created_at?: string
          id?: string
          project_id: string
          sort_order?: number
        }
        Update: {
          block_type?: string
          caption?: string | null
          created_at?: string
          id?: string
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "board_blocks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      board_images: {
        Row: {
          attribution: string | null
          block_id: string
          created_at: string
          id: string
          note: string | null
          source_type: string | null
          source_url: string | null
          url: string | null
        }
        Insert: {
          attribution?: string | null
          block_id: string
          created_at?: string
          id?: string
          note?: string | null
          source_type?: string | null
          source_url?: string | null
          url?: string | null
        }
        Update: {
          attribution?: string | null
          block_id?: string
          created_at?: string
          id?: string
          note?: string | null
          source_type?: string | null
          source_url?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "board_images_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "board_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      briefs: {
        Row: {
          completeness_score: number | null
          constraints_practical: string | null
          created_at: string
          id: string
          project_id: string
          scenarios: string | null
          storage: string | null
          style_dislikes: string | null
          style_likes: string | null
          success_criteria: string | null
          updated_at: string
          users_of_space: string | null
          zones: string | null
        }
        Insert: {
          completeness_score?: number | null
          constraints_practical?: string | null
          created_at?: string
          id?: string
          project_id: string
          scenarios?: string | null
          storage?: string | null
          style_dislikes?: string | null
          style_likes?: string | null
          success_criteria?: string | null
          updated_at?: string
          users_of_space?: string | null
          zones?: string | null
        }
        Update: {
          completeness_score?: number | null
          constraints_practical?: string | null
          created_at?: string
          id?: string
          project_id?: string
          scenarios?: string | null
          storage?: string | null
          style_dislikes?: string | null
          style_likes?: string | null
          success_criteria?: string | null
          updated_at?: string
          users_of_space?: string | null
          zones?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "briefs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          created_at: string
          evidence: string | null
          id: string
          impact: string | null
          project_id: string
          suggestion: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          evidence?: string | null
          id?: string
          impact?: string | null
          project_id: string
          suggestion?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          evidence?: string | null
          id?: string
          impact?: string | null
          project_id?: string
          suggestion?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          constraints: Json | null
          created_at: string
          dimensions_text: string | null
          id: string
          name: string
          raw_input: string | null
          room_type: string | null
          session_id: string
        }
        Insert: {
          constraints?: Json | null
          created_at?: string
          dimensions_text?: string | null
          id?: string
          name: string
          raw_input?: string | null
          room_type?: string | null
          session_id: string
        }
        Update: {
          constraints?: Json | null
          created_at?: string
          dimensions_text?: string | null
          id?: string
          name?: string
          raw_input?: string | null
          room_type?: string | null
          session_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          answer: string | null
          asked: boolean
          created_at: string
          id: string
          priority: string
          project_id: string
          text: string
          unlocks: string | null
        }
        Insert: {
          answer?: string | null
          asked?: boolean
          created_at?: string
          id?: string
          priority?: string
          project_id: string
          text: string
          unlocks?: string | null
        }
        Update: {
          answer?: string | null
          asked?: boolean
          created_at?: string
          id?: string
          priority?: string
          project_id?: string
          text?: string
          unlocks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
