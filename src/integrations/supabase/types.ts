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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_keys_registry: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string | null
          last_validated_at: string | null
          last_validation_status: string
          metadata: Json
          service_name: string
          updated_at: string
          vault_secret_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_validated_at?: string | null
          last_validation_status?: string
          metadata?: Json
          service_name: string
          updated_at?: string
          vault_secret_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_validated_at?: string | null
          last_validation_status?: string
          metadata?: Json
          service_name?: string
          updated_at?: string
          vault_secret_name?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          repository_id: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          repository_id: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          repository_id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_scores: {
        Row: {
          ai_summary: string | null
          analyzed_at: string
          analyzed_by: string | null
          confidence: number
          created_at: string
          dependencies: Json
          effort: number
          id: string
          impact: number
          issue_key: string
          project_key: string
          reach: number
          rice_score: number
          suggested_sprint: number
          updated_at: string
          urgency_score: number
        }
        Insert: {
          ai_summary?: string | null
          analyzed_at?: string
          analyzed_by?: string | null
          confidence?: number
          created_at?: string
          dependencies?: Json
          effort?: number
          id?: string
          impact?: number
          issue_key: string
          project_key: string
          reach?: number
          rice_score?: number
          suggested_sprint?: number
          updated_at?: string
          urgency_score?: number
        }
        Update: {
          ai_summary?: string | null
          analyzed_at?: string
          analyzed_by?: string | null
          confidence?: number
          created_at?: string
          dependencies?: Json
          effort?: number
          id?: string
          impact?: number
          issue_key?: string
          project_key?: string
          reach?: number
          rice_score?: number
          suggested_sprint?: number
          updated_at?: string
          urgency_score?: number
        }
        Relationships: []
      }
      issues: {
        Row: {
          ai_category: string | null
          ai_dependencies: Json
          ai_duplicates: Json
          ai_score_effort: number | null
          ai_score_impact: number | null
          ai_score_rice: number | null
          ai_score_urgency: number | null
          ai_summary: string | null
          analyzed_at: string | null
          body: string | null
          created_at: string
          github_assignees: Json
          github_issue_id: number
          github_issue_number: number
          github_labels: Json
          github_milestone: Json | null
          html_url: string | null
          id: string
          priority_rank: number | null
          repository_id: string
          state: string
          suggested_label: string | null
          suggested_milestone: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_category?: string | null
          ai_dependencies?: Json
          ai_duplicates?: Json
          ai_score_effort?: number | null
          ai_score_impact?: number | null
          ai_score_rice?: number | null
          ai_score_urgency?: number | null
          ai_summary?: string | null
          analyzed_at?: string | null
          body?: string | null
          created_at?: string
          github_assignees?: Json
          github_issue_id: number
          github_issue_number: number
          github_labels?: Json
          github_milestone?: Json | null
          html_url?: string | null
          id?: string
          priority_rank?: number | null
          repository_id: string
          state?: string
          suggested_label?: string | null
          suggested_milestone?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_category?: string | null
          ai_dependencies?: Json
          ai_duplicates?: Json
          ai_score_effort?: number | null
          ai_score_impact?: number | null
          ai_score_rice?: number | null
          ai_score_urgency?: number | null
          ai_summary?: string | null
          analyzed_at?: string | null
          body?: string | null
          created_at?: string
          github_assignees?: Json
          github_issue_id?: number
          github_issue_number?: number
          github_labels?: Json
          github_milestone?: Json | null
          html_url?: string | null
          id?: string
          priority_rank?: number | null
          repository_id?: string
          state?: string
          suggested_label?: string | null
          suggested_milestone?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          is_approved: boolean
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          is_approved?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_approved?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      repositories: {
        Row: {
          created_at: string
          description: string | null
          full_name: string
          github_repo_id: number
          id: string
          is_active: boolean
          last_synced_at: string | null
          name: string
          owner: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          full_name: string
          github_repo_id: number
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name: string
          owner: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          full_name?: string
          github_repo_id?: number
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name?: string
          owner?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          issues_processed: number
          repository_id: string | null
          started_at: string
          status: string
          sync_type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          issues_processed?: number
          repository_id?: string | null
          started_at?: string
          status: string
          sync_type: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          issues_processed?: number
          repository_id?: string | null
          started_at?: string
          status?: string
          sync_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_recreate_auth_trigger: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      vault_delete_secret: { Args: { p_service: string }; Returns: boolean }
      vault_read_secret: { Args: { p_service: string }; Returns: string }
      vault_upsert_secret: {
        Args: { p_service: string; p_value: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "agent"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "supervisor", "agent"],
    },
  },
} as const
