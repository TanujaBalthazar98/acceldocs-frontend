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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          error_message: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          project_id: string | null
          success: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          project_id?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          project_id?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string | null
          content_html: string | null
          created_at: string
          google_doc_id: string
          google_modified_at: string | null
          id: string
          is_published: boolean
          last_synced_at: string | null
          owner_id: string | null
          project_id: string
          published_content_html: string | null
          slug: string | null
          title: string
          topic_id: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility_level"]
        }
        Insert: {
          content?: string | null
          content_html?: string | null
          created_at?: string
          google_doc_id: string
          google_modified_at?: string | null
          id?: string
          is_published?: boolean
          last_synced_at?: string | null
          owner_id?: string | null
          project_id: string
          published_content_html?: string | null
          slug?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility_level"]
        }
        Update: {
          content?: string | null
          content_html?: string | null
          created_at?: string
          google_doc_id?: string
          google_modified_at?: string | null
          id?: string
          is_published?: boolean
          last_synced_at?: string | null
          owner_id?: string | null
          project_id?: string
          published_content_html?: string | null
          slug?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility_level"]
        }
        Relationships: [
          {
            foreignKeyName: "documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_file: string | null
          errors: Json | null
          id: string
          pages_created: number
          processed_files: number
          project_id: string
          status: string
          topics_created: number
          total_files: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_file?: string | null
          errors?: Json | null
          id?: string
          pages_created?: number
          processed_files?: number
          project_id: string
          status?: string
          topics_created?: number
          total_files?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_file?: string | null
          errors?: Json | null
          id?: string
          pages_created?: number
          processed_files?: number
          project_id?: string
          status?: string
          topics_created?: number
          total_files?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string | null
          created_at: string
          custom_css: string | null
          domain: string
          drive_folder_id: string | null
          font_body: string | null
          font_heading: string | null
          hero_description: string | null
          hero_title: string | null
          id: string
          logo_url: string | null
          mcp_enabled: boolean | null
          name: string
          openapi_spec_json: Json | null
          openapi_spec_url: string | null
          owner_id: string
          primary_color: string | null
          secondary_color: string | null
          show_featured_projects: boolean | null
          show_search_on_landing: boolean | null
          slug: string | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          custom_css?: string | null
          domain: string
          drive_folder_id?: string | null
          font_body?: string | null
          font_heading?: string | null
          hero_description?: string | null
          hero_title?: string | null
          id?: string
          logo_url?: string | null
          mcp_enabled?: boolean | null
          name: string
          openapi_spec_json?: Json | null
          openapi_spec_url?: string | null
          owner_id: string
          primary_color?: string | null
          secondary_color?: string | null
          show_featured_projects?: boolean | null
          show_search_on_landing?: boolean | null
          slug?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          custom_css?: string | null
          domain?: string
          drive_folder_id?: string | null
          font_body?: string | null
          font_heading?: string | null
          hero_description?: string | null
          hero_title?: string | null
          id?: string
          logo_url?: string | null
          mcp_enabled?: boolean | null
          name?: string
          openapi_spec_json?: Json | null
          openapi_spec_url?: string | null
          owner_id?: string
          primary_color?: string | null
          secondary_color?: string | null
          show_featured_projects?: boolean | null
          show_search_on_landing?: boolean | null
          slug?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      page_feedback: {
        Row: {
          content: string
          created_at: string
          document_id: string
          feedback_type: string
          id: string
          is_resolved: boolean
          updated_at: string
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          content: string
          created_at?: string
          document_id: string
          feedback_type?: string
          id?: string
          is_resolved?: boolean
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string
          feedback_type?: string
          id?: string
          is_resolved?: boolean
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_feedback_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          google_refresh_token: string | null
          google_token_refreshed_at: string | null
          id: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          google_refresh_token?: string | null
          google_token_refreshed_at?: string | null
          id: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          google_refresh_token?: string | null
          google_token_refreshed_at?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          allow_indexing: boolean | null
          allow_llm_crawlers: string[] | null
          allow_llm_summarization: boolean | null
          allow_llm_training: boolean | null
          created_at: string
          created_by: string
          description: string | null
          disallowed_paths: string[] | null
          drive_folder_id: string | null
          id: string
          is_connected: boolean | null
          is_published: boolean
          mcp_enabled: boolean | null
          name: string
          openapi_spec_json: Json | null
          openapi_spec_url: string | null
          organization_id: string
          slug: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility_level"]
        }
        Insert: {
          allow_indexing?: boolean | null
          allow_llm_crawlers?: string[] | null
          allow_llm_summarization?: boolean | null
          allow_llm_training?: boolean | null
          created_at?: string
          created_by: string
          description?: string | null
          disallowed_paths?: string[] | null
          drive_folder_id?: string | null
          id?: string
          is_connected?: boolean | null
          is_published?: boolean
          mcp_enabled?: boolean | null
          name: string
          openapi_spec_json?: Json | null
          openapi_spec_url?: string | null
          organization_id: string
          slug?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility_level"]
        }
        Update: {
          allow_indexing?: boolean | null
          allow_llm_crawlers?: string[] | null
          allow_llm_summarization?: boolean | null
          allow_llm_training?: boolean | null
          created_at?: string
          created_by?: string
          description?: string | null
          disallowed_paths?: string[] | null
          drive_folder_id?: string | null
          id?: string
          is_connected?: boolean | null
          is_published?: boolean
          mcp_enabled?: boolean | null
          name?: string
          openapi_spec_json?: Json | null
          openapi_spec_url?: string | null
          organization_id?: string
          slug?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility_level"]
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      slug_history: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          old_slug: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          old_slug: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          old_slug?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          created_at: string
          display_order: number | null
          drive_folder_id: string
          id: string
          name: string
          parent_id: string | null
          project_id: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          drive_folder_id: string
          id?: string
          name: string
          parent_id?: string | null
          project_id: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          drive_folder_id?: string
          id?: string
          name?: string
          parent_id?: string | null
          project_id?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { invitation_token: string }
        Returns: boolean
      }
      accept_project_invitation: {
        Args: { invitation_token: string }
        Returns: boolean
      }
      can_access_drive: {
        Args: { _operation: string; _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      check_project_permission: {
        Args: { _action: string; _project_id: string; _user_id: string }
        Returns: boolean
      }
      ensure_unique_slug: {
        Args: {
          base_slug: string
          exclude_id?: string
          scope_column: string
          scope_value: string
          table_name: string
        }
        Returns: string
      }
      generate_slug: { Args: { title: string }; Returns: string }
      get_project_role: {
        Args: { _project_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["project_role"]
      }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_project_role: {
        Args: {
          _project_id: string
          _roles: Database["public"]["Enums"]["project_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      is_personal_email_domain: {
        Args: { email_domain: string }
        Returns: boolean
      }
      log_audit_action: {
        Args: {
          _action: string
          _entity_id: string
          _entity_type: string
          _error_message?: string
          _metadata?: Json
          _project_id: string
          _success?: boolean
        }
        Returns: string
      }
    }
    Enums: {
      account_type: "individual" | "team" | "enterprise"
      app_role: "owner" | "admin" | "editor" | "viewer"
      project_role: "admin" | "editor" | "reviewer" | "viewer"
      visibility_level: "internal" | "external" | "public"
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
    Enums: {
      account_type: ["individual", "team", "enterprise"],
      app_role: ["owner", "admin", "editor", "viewer"],
      project_role: ["admin", "editor", "reviewer", "viewer"],
      visibility_level: ["internal", "external", "public"],
    },
  },
} as const
