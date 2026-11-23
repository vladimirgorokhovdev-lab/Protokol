export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      blocked_email_domains: {
        Row: {
          created_at: string;
          domain: string;
        };
        Insert: {
          created_at?: string;
          domain: string;
        };
        Update: {
          created_at?: string;
          domain?: string;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          message: string;
          name: string;
          read_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          message: string;
          name: string;
          read_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          message?: string;
          name?: string;
          read_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          message: string;
          page_url: string | null;
          user_id: string | null;
        };
        Insert: {
          category?: string;
          created_at?: string;
          id?: string;
          message: string;
          page_url?: string | null;
          user_id?: string | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          message?: string;
          page_url?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      folders: {
        Row: {
          case_number: string | null;
          color: string;
          created_at: string;
          id: string;
          name: string;
          team_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          case_number?: string | null;
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          team_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          case_number?: string | null;
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          team_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "folders_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          id: string;
          status: Database["public"]["Enums"]["payment_status"];
          tier: Database["public"]["Enums"]["subscription_tier"];
          user_id: string;
          yookassa_payment_id: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency?: string;
          id?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          tier: Database["public"]["Enums"]["subscription_tier"];
          user_id: string;
          yookassa_payment_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          tier?: Database["public"]["Enums"]["subscription_tier"];
          user_id?: string;
          yookassa_payment_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"];
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          palette: string;
          rejected_reason: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"];
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          palette?: string;
          rejected_reason?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"];
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          palette?: string;
          rejected_reason?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      replacement_rules: {
        Row: {
          created_at: string;
          find_text: string;
          id: string;
          replace_text: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          find_text: string;
          id?: string;
          replace_text: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          find_text?: string;
          id?: string;
          replace_text?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      speaker_presets: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      subscription_cancellations: {
        Row: {
          admin_notes: string | null;
          comment: string | null;
          contact_consent: boolean;
          created_at: string;
          id: string;
          outreach_called_at: string | null;
          outreach_email_sent_at: string | null;
          reason: string;
          tier: Database["public"]["Enums"]["subscription_tier"];
          user_id: string;
        };
        Insert: {
          admin_notes?: string | null;
          comment?: string | null;
          contact_consent?: boolean;
          created_at?: string;
          id?: string;
          outreach_called_at?: string | null;
          outreach_email_sent_at?: string | null;
          reason: string;
          tier: Database["public"]["Enums"]["subscription_tier"];
          user_id: string;
        };
        Update: {
          admin_notes?: string | null;
          comment?: string | null;
          contact_consent?: boolean;
          created_at?: string;
          id?: string;
          outreach_called_at?: string | null;
          outreach_email_sent_at?: string | null;
          reason?: string;
          tier?: Database["public"]["Enums"]["subscription_tier"];
          user_id?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          auto_renew: boolean;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          payment_method_id: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          team_id: string | null;
          tier: Database["public"]["Enums"]["subscription_tier"];
          updated_at: string;
          user_id: string;
          yookassa_subscription_id: string | null;
        };
        Insert: {
          auto_renew?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          payment_method_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          team_id?: string | null;
          tier?: Database["public"]["Enums"]["subscription_tier"];
          updated_at?: string;
          user_id: string;
          yookassa_subscription_id?: string | null;
        };
        Update: {
          auto_renew?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          payment_method_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          team_id?: string | null;
          tier?: Database["public"]["Enums"]["subscription_tier"];
          updated_at?: string;
          user_id?: string;
          yookassa_subscription_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          team_id: string | null;
          user_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          team_id?: string | null;
          user_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          team_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tags_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_activity_log: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          created_at: string;
          description: string;
          id: string;
          metadata: Json | null;
          team_id: string;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          metadata?: Json | null;
          team_id: string;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          metadata?: Json | null;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_activity_log_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          email_normalized: string;
          expires_at: string;
          id: string;
          invited_by: string;
          team_id: string;
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          email_normalized: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          team_id: string;
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          email_normalized?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          team_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_members: {
        Row: {
          id: string;
          joined_at: string;
          role: string;
          team_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          joined_at?: string;
          role?: string;
          team_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          joined_at?: string;
          role?: string;
          team_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_usage: {
        Row: {
          id: string;
          month_start: string;
          monthly_count: number;
          monthly_seconds: number;
          team_id: string;
          total_count: number;
          total_seconds: number;
        };
        Insert: {
          id?: string;
          month_start?: string;
          monthly_count?: number;
          monthly_seconds?: number;
          team_id: string;
          total_count?: number;
          total_seconds?: number;
        };
        Update: {
          id?: string;
          month_start?: string;
          monthly_count?: number;
          monthly_seconds?: number;
          team_id?: string;
          total_count?: number;
          total_seconds?: number;
        };
        Relationships: [
          {
            foreignKeyName: "team_usage_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: true;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          created_at: string;
          id: string;
          max_members: number;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          max_members?: number;
          name?: string;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          max_members?: number;
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transcription_jobs: {
        Row: {
          audio_path: string;
          created_at: string;
          error: string | null;
          estimated_seconds: number;
          file_name: string;
          id: string;
          num_speakers: number | null;
          segments: Json | null;
          status: Database["public"]["Enums"]["transcription_job_status"];
          status_message: string | null;
          transcription_id: string | null;
          updated_at: string;
          usage_billed_at: string | null;
          user_id: string;
        };
        Insert: {
          audio_path: string;
          created_at?: string;
          error?: string | null;
          estimated_seconds?: number;
          file_name: string;
          id?: string;
          num_speakers?: number | null;
          segments?: Json | null;
          status?: Database["public"]["Enums"]["transcription_job_status"];
          status_message?: string | null;
          transcription_id?: string | null;
          updated_at?: string;
          usage_billed_at?: string | null;
          user_id: string;
        };
        Update: {
          audio_path?: string;
          created_at?: string;
          error?: string | null;
          estimated_seconds?: number;
          file_name?: string;
          id?: string;
          num_speakers?: number | null;
          segments?: Json | null;
          status?: Database["public"]["Enums"]["transcription_job_status"];
          status_message?: string | null;
          transcription_id?: string | null;
          updated_at?: string;
          usage_billed_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      transcription_segments: {
        Row: {
          end_time: number;
          id: string;
          is_edited: boolean;
          segment_order: number;
          speaker: string;
          speaker_index: number;
          start_time: number;
          text: string;
          transcription_id: string;
        };
        Insert: {
          end_time?: number;
          id?: string;
          is_edited?: boolean;
          segment_order?: number;
          speaker: string;
          speaker_index?: number;
          start_time?: number;
          text: string;
          transcription_id: string;
        };
        Update: {
          end_time?: number;
          id?: string;
          is_edited?: boolean;
          segment_order?: number;
          speaker?: string;
          speaker_index?: number;
          start_time?: number;
          text?: string;
          transcription_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transcription_segments_transcription_id_fkey";
            columns: ["transcription_id"];
            isOneToOne: false;
            referencedRelation: "transcriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      transcription_tags: {
        Row: {
          created_at: string;
          tag_id: string;
          transcription_id: string;
        };
        Insert: {
          created_at?: string;
          tag_id: string;
          transcription_id: string;
        };
        Update: {
          created_at?: string;
          tag_id?: string;
          transcription_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transcription_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transcription_tags_transcription_id_fkey";
            columns: ["transcription_id"];
            isOneToOne: false;
            referencedRelation: "transcriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      transcription_usage: {
        Row: {
          id: string;
          month_start: string;
          monthly_count: number;
          monthly_seconds: number;
          total_count: number;
          total_seconds: number;
          user_id: string;
        };
        Insert: {
          id?: string;
          month_start?: string;
          monthly_count?: number;
          monthly_seconds?: number;
          total_count?: number;
          total_seconds?: number;
          user_id: string;
        };
        Update: {
          id?: string;
          month_start?: string;
          monthly_count?: number;
          monthly_seconds?: number;
          total_count?: number;
          total_seconds?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      transcriptions: {
        Row: {
          ai_summary: Json | null;
          audio_path: string | null;
          audio_size_bytes: number | null;
          created_at: string;
          duration: number;
          file_name: string;
          folder_id: string | null;
          id: string;
          segment_count: number;
          source_audio_paths: Json | null;
          source_file_names: Json | null;
          speaker_count: number;
          speaker_names: Json | null;
          team_id: string | null;
          user_id: string;
        };
        Insert: {
          ai_summary?: Json | null;
          audio_path?: string | null;
          audio_size_bytes?: number | null;
          created_at?: string;
          duration?: number;
          file_name: string;
          folder_id?: string | null;
          id?: string;
          segment_count?: number;
          source_audio_paths?: Json | null;
          source_file_names?: Json | null;
          speaker_count?: number;
          speaker_names?: Json | null;
          team_id?: string | null;
          user_id: string;
        };
        Update: {
          ai_summary?: Json | null;
          audio_path?: string | null;
          audio_size_bytes?: number | null;
          created_at?: string;
          duration?: number;
          file_name?: string;
          folder_id?: string | null;
          id?: string;
          segment_count?: number;
          source_audio_paths?: Json | null;
          source_file_names?: Json | null;
          speaker_count?: number;
          speaker_names?: Json | null;
          team_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transcriptions_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transcriptions_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      user_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_team_invitation: { Args: { _token: string }; Returns: string };
      admin_analytics_overview: { Args: { p_days?: number }; Returns: Json };
      admin_list_teams: { Args: never; Returns: Json };
      admin_metric_details: {
        Args: { p_days?: number; p_metric: string };
        Returns: Json;
      };
      admin_segment_users: {
        Args: { p_segment: string };
        Returns: {
          context: Json;
          email: string;
          last_event_at: string;
          monthly_count: number;
          period_end: string;
          registered_at: string;
          tier: string;
          total_count: number;
          total_seconds: number;
          user_id: string;
        }[];
      };
      admin_team_detail: { Args: { p_team_id: string }; Returns: Json };
      admin_user_card: { Args: { p_email: string }; Returns: Json };
      apply_team_usage: {
        Args: { p_seconds?: number; p_team_id: string };
        Returns: undefined;
      };
      apply_transcription_usage: {
        Args: { p_seconds?: number; p_user_id: string };
        Returns: undefined;
      };
      approve_user: { Args: { _user_id: string }; Returns: undefined };
      bill_my_transcription_job: {
        Args: { p_job_id: string };
        Returns: boolean;
      };
      bill_transcription_job: {
        Args: { p_job_id: string };
        Returns: boolean;
      };
      can_user_transcribe: {
        Args: { p_user_id: string; p_estimated_seconds?: number };
        Returns: boolean;
      };
      can_use_ai_summary: { Args: { p_user_id: string }; Returns: boolean };
      current_user_email: { Args: never; Returns: string };
      get_auth_user_count: { Args: never; Returns: number };
      get_feedback_with_email: {
        Args: { p_filter?: string };
        Returns: {
          category: string;
          created_at: string;
          id: string;
          message: string;
          page_url: string;
          user_email: string;
          user_id: string;
        }[];
      };
      get_my_approval_status: {
        Args: never;
        Returns: Database["public"]["Enums"]["approval_status"];
      };
      get_user_team_id: { Args: { _user_id: string }; Returns: string };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_auth_email_confirmed: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      increment_team_usage:
        | { Args: { p_team_id: string }; Returns: undefined }
        | {
            Args: { p_seconds?: number; p_team_id: string };
            Returns: undefined;
          };
      increment_transcription_usage:
        | { Args: { p_user_id: string }; Returns: undefined }
        | {
            Args: { p_seconds?: number; p_user_id: string };
            Returns: undefined;
          };
      is_team_member: {
        Args: { _team_id: string; _user_id: string };
        Returns: boolean;
      };
      is_team_owner: {
        Args: { _team_id: string; _user_id: string };
        Returns: boolean;
      };
      is_user_approved: { Args: { _user_id: string }; Returns: boolean };
      list_approval_requests: {
        Args: { _filter?: string };
        Returns: {
          approval_status: Database["public"]["Enums"]["approval_status"];
          approved_at: string;
          created_at: string;
          email: string;
          rejected_reason: string;
          user_id: string;
        }[];
      };
      mark_stalled_transcription_jobs: { Args: never; Returns: undefined };
      merge_transcription_segments: {
        Args: {
          p_first_id: string;
          p_merged_text: string;
          p_second_id: string;
        };
        Returns: undefined;
      };
      normalize_email: { Args: { _email: string }; Returns: string };
      reject_user: {
        Args: { _reason?: string; _user_id: string };
        Returns: undefined;
      };
      restore_transcription_segment: {
        Args: {
          p_end_time: number;
          p_id: string;
          p_is_edited: boolean;
          p_segment_order: number;
          p_speaker: string;
          p_speaker_index: number;
          p_start_time: number;
          p_text: string;
          p_transcription_id: string;
        };
        Returns: undefined;
      };
      search_transcriptions: {
        Args: { search_query: string };
        Returns: string[];
      };
      search_transcriptions_advanced: {
        Args: {
          p_case_number?: string;
          p_date_from?: string;
          p_date_to?: string;
          p_folder_id?: string;
          p_query?: string;
          p_speaker?: string;
          p_tag_ids?: string[];
        };
        Returns: {
          first_snippet: string;
          match_count: number;
          transcription_id: string;
        }[];
      };
      split_transcription_segment: {
        Args: {
          p_first_text: string;
          p_second_text: string;
          p_segment_id: string;
          p_split_time: number;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: "admin" | "user";
      approval_status: "pending" | "approved" | "rejected";
      payment_status: "pending" | "succeeded" | "cancelled" | "refunded";
      subscription_status: "active" | "cancelled" | "expired" | "pending";
      subscription_tier: "free" | "basic" | "pro" | "team";
      transcription_job_status:
        | "queued"
        | "processing"
        | "done"
        | "error"
        | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
      app_role: ["admin", "user"],
      approval_status: ["pending", "approved", "rejected"],
      payment_status: ["pending", "succeeded", "cancelled", "refunded"],
      subscription_status: ["active", "cancelled", "expired", "pending"],
      subscription_tier: ["free", "basic", "pro", "team"],
      transcription_job_status: [
        "queued",
        "processing",
        "done",
        "error",
        "cancelled",
      ],
    },
  },
} as const;
