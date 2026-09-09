export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      providers: {
        Row: {
          id: string;
          slug: string;
          name: string;
          kind: "text" | "image" | "multimodal";
          enabled: boolean;
          supports_byok: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          kind: "text" | "image" | "multimodal";
          enabled?: boolean;
          supports_byok?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["providers"]["Insert"]>;
        Relationships: [];
      };
      provider_models: {
        Row: { id: string; provider_id: string; model_key: string; display_name: string; kind: "text" | "image" | "multimodal"; enabled: boolean; capabilities: Json; created_at: string; updated_at: string };
        Insert: { id?: string; provider_id: string; model_key: string; display_name: string; kind: "text" | "image" | "multimodal"; enabled?: boolean; capabilities?: Json; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["provider_models"]["Insert"]>;
        Relationships: [];
      };
      provider_pricing: {
        Row: { id: string; provider_model_id: string; unit: "input_million_tokens" | "output_million_tokens" | "image" | "request"; price_usd: number; effective_from: string; effective_until: string | null; created_at: string; created_by: string | null };
        Insert: { id?: string; provider_model_id: string; unit: "input_million_tokens" | "output_million_tokens" | "image" | "request"; price_usd: number; effective_from: string; effective_until?: string | null; created_at?: string; created_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["provider_pricing"]["Insert"]>;
        Relationships: [];
      };
      user_api_keys: {
        Row: {
          id: string;
          user_id: string;
          provider_id: string;
          label: string;
          encrypted_key: string;
          encryption_iv: string;
          encryption_tag: string;
          key_version: string;
          key_hint: string;
          is_active: boolean;
          test_status: "valid" | "invalid" | "untested";
          last_tested_at: string | null;
          last_error_code: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider_id: string;
          label: string;
          encrypted_key: string;
          encryption_iv: string;
          encryption_tag: string;
          key_version: string;
          key_hint: string;
          is_active?: boolean;
          test_status?: "valid" | "invalid" | "untested";
          last_tested_at?: string | null;
          last_error_code?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_api_keys"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "user_api_keys_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "providers";
            referencedColumns: ["id"];
          },
        ];
      };
      system_api_keys: {
        Row: {
          id: string;
          provider_id: string;
          label: string;
          encrypted_key: string;
          encryption_iv: string;
          encryption_tag: string;
          key_version: string;
          key_hint: string;
          is_active: boolean;
          test_status: "valid" | "invalid" | "untested";
          last_tested_at: string | null;
          last_error_code: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          provider_id: string;
          label: string;
          encrypted_key: string;
          encryption_iv: string;
          encryption_tag: string;
          key_version: string;
          key_hint: string;
          is_active?: boolean;
          test_status?: "valid" | "invalid" | "untested";
          last_tested_at?: string | null;
          last_error_code?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_api_keys"]["Insert"]>;
        Relationships: [];
      };
      content_requests: {
        Row: {
          id: string; user_id: string; topic: string; keywords: string[]; language: string; audience: string;
          tone: "professional" | "friendly" | "persuasive" | "educational" | "creative"; target_words: number;
          text_api_key_id: string | null; text_system_api_key_id: string | null; text_provider_slug: string; text_model: string; image_api_key_id: string | null; image_system_api_key_id: string | null;
          image_provider_slug: string | null; image_model: string | null; image_count: number; settings_snapshot: Json; created_at: string;
          keyword_targets: Json; seo_settings: Json; content_brief: string | null; required_headings: string[]; image_topics: string[];
        };
        Insert: {
          id?: string; user_id: string; topic: string; keywords?: string[]; language?: string; audience: string;
          tone?: "professional" | "friendly" | "persuasive" | "educational" | "creative"; target_words: number;
          text_api_key_id?: string | null; text_system_api_key_id?: string | null; text_provider_slug: string; text_model: string; image_api_key_id?: string | null; image_system_api_key_id?: string | null;
          image_provider_slug?: string | null; image_model?: string | null; image_count?: number; settings_snapshot?: Json; created_at?: string;
          keyword_targets?: Json; seo_settings?: Json; content_brief?: string | null; required_headings?: string[]; image_topics?: string[];
        };
        Update: Partial<Database["public"]["Tables"]["content_requests"]["Insert"]>;
        Relationships: [];
      };
      generation_jobs: {
        Row: {
          id: string; request_id: string; user_id: string; status: "queued" | "running" | "completed" | "failed" | "cancelled";
          progress: number; current_step: string | null; attempt: number; max_attempts: number; cancel_requested: boolean;
          locked_at: string | null; started_at: string | null; completed_at: string | null; error_code: string | null;
          error_message: string | null; output_title: string | null; output_markdown: string | null; input_tokens: number;
          output_html: string | null; seo_analysis: Json; image_suggestions: Json;
          output_tokens: number; estimated_cost_usd: number | null; idempotency_key: string; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; request_id: string; user_id: string; status?: "queued" | "running" | "completed" | "failed" | "cancelled";
          progress?: number; current_step?: string | null; attempt?: number; max_attempts?: number; cancel_requested?: boolean;
          locked_at?: string | null; started_at?: string | null; completed_at?: string | null; error_code?: string | null;
          error_message?: string | null; output_title?: string | null; output_markdown?: string | null; input_tokens?: number;
          output_html?: string | null; seo_analysis?: Json; image_suggestions?: Json;
          output_tokens?: number; estimated_cost_usd?: number | null; idempotency_key: string; created_at?: string; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["generation_jobs"]["Insert"]>;
        Relationships: [];
      };
      generation_steps: {
        Row: {
          id: string; job_id: string; user_id: string; kind: "article" | "hero_image" | "inline_image"; position: number;
          status: "pending" | "running" | "completed" | "failed" | "cancelled"; attempt: number; provider_slug: string;
          model_key: string; error_code: string | null; error_message: string | null; started_at: string | null;
          completed_at: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; job_id: string; user_id: string; kind: "article" | "hero_image" | "inline_image"; position?: number;
          status?: "pending" | "running" | "completed" | "failed" | "cancelled"; attempt?: number; provider_slug: string;
          model_key: string; error_code?: string | null; error_message?: string | null; started_at?: string | null;
          completed_at?: string | null; created_at?: string; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["generation_steps"]["Insert"]>;
        Relationships: [];
      };
      content_assets: {
        Row: { id: string; job_id: string; user_id: string; step_id: string | null; storage_path: string; mime_type: string; alt_text: string; position: number; created_at: string };
        Insert: { id?: string; job_id: string; user_id: string; step_id?: string | null; storage_path: string; mime_type: string; alt_text: string; position?: number; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["content_assets"]["Insert"]>;
        Relationships: [];
      };
      usage_ledger: {
        Row: { id: number; job_id: string; user_id: string; provider_slug: string; model_key: string; unit: "input_million_tokens" | "output_million_tokens" | "image" | "request"; quantity: number; estimated_cost_usd: number | null; provider_request_id: string | null; created_at: string };
        Insert: { id?: never; job_id: string; user_id: string; provider_slug: string; model_key: string; unit: "input_million_tokens" | "output_million_tokens" | "image" | "request"; quantity: number; estimated_cost_usd?: number | null; provider_request_id?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["usage_ledger"]["Insert"]>;
        Relationships: [];
      };
      user_invitations: {
        Row: { id: string; email: string; role: "customer" | "system_admin"; token_hash: string; invited_by: string | null; expires_at: string; accepted_at: string | null; accepted_by: string | null; revoked_at: string | null; created_at: string };
        Insert: { id?: string; email: string; role?: "customer" | "system_admin"; token_hash: string; invited_by?: string | null; expires_at: string; accepted_at?: string | null; accepted_by?: string | null; revoked_at?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["user_invitations"]["Insert"]>;
        Relationships: [];
      };
      gsc_connections: {
        Row: { id: string; user_id: string; google_email: string | null; auth_type: "oauth" | "service_account"; encrypted_access_token: string | null; access_iv: string | null; access_tag: string | null; access_key_version: string | null; encrypted_refresh_token: string | null; refresh_iv: string | null; refresh_tag: string | null; refresh_key_version: string | null; token_expires_at: string | null; encrypted_service_account: string | null; service_account_iv: string | null; service_account_tag: string | null; service_account_key_version: string | null; status: "active" | "expired" | "revoked"; last_synced_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; google_email?: string | null; auth_type?: "oauth" | "service_account"; encrypted_access_token?: string | null; access_iv?: string | null; access_tag?: string | null; access_key_version?: string | null; encrypted_refresh_token?: string | null; refresh_iv?: string | null; refresh_tag?: string | null; refresh_key_version?: string | null; token_expires_at?: string | null; encrypted_service_account?: string | null; service_account_iv?: string | null; service_account_tag?: string | null; service_account_key_version?: string | null; status?: "active" | "expired" | "revoked"; last_synced_at?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["gsc_connections"]["Insert"]>;
        Relationships: [];
      };
      gsc_properties: {
        Row: { id: string; connection_id: string; user_id: string; site_url: string; permission_level: string; selected: boolean; last_synced_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; connection_id: string; user_id: string; site_url: string; permission_level: string; selected?: boolean; last_synced_at?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["gsc_properties"]["Insert"]>;
        Relationships: [];
      };
      gsc_metrics_daily: {
        Row: { id: number; property_id: string; user_id: string; metric_date: string; query: string; page: string; country: string; device: string; search_type: string; clicks: number; impressions: number; ctr: number; position: number; synced_at: string };
        Insert: { id?: never; property_id: string; user_id: string; metric_date: string; query?: string; page?: string; country?: string; device?: string; search_type?: string; clicks?: number; impressions?: number; ctr?: number; position?: number; synced_at?: string };
        Update: Partial<Database["public"]["Tables"]["gsc_metrics_daily"]["Insert"]>;
        Relationships: [];
      };
      gsc_sync_runs: {
        Row: { id: string; connection_id: string; user_id: string; trigger_type: "manual" | "scheduled"; status: "running" | "completed" | "partial" | "failed"; started_at: string; completed_at: string | null; properties_found: number; properties_synced: number; rows_written: number; search_types: string[]; error_code: string | null; error_message: string | null; error_details: Json };
        Insert: { id?: string; connection_id: string; user_id: string; trigger_type: "manual" | "scheduled"; status?: "running" | "completed" | "partial" | "failed"; started_at?: string; completed_at?: string | null; properties_found?: number; properties_synced?: number; rows_written?: number; search_types?: string[]; error_code?: string | null; error_message?: string | null; error_details?: Json };
        Update: Partial<Database["public"]["Tables"]["gsc_sync_runs"]["Insert"]>;
        Relationships: [];
      };
      gsc_sitemaps: {
        Row: { id: string; property_id: string; user_id: string; path: string; sitemap_type: string | null; is_pending: boolean; is_sitemaps_index: boolean; last_submitted_at: string | null; last_downloaded_at: string | null; warnings: number; errors: number; contents: Json; synced_at: string };
        Insert: { id?: string; property_id: string; user_id: string; path: string; sitemap_type?: string | null; is_pending?: boolean; is_sitemaps_index?: boolean; last_submitted_at?: string | null; last_downloaded_at?: string | null; warnings?: number; errors?: number; contents?: Json; synced_at?: string };
        Update: Partial<Database["public"]["Tables"]["gsc_sitemaps"]["Insert"]>;
        Relationships: [];
      };
      title_suggestions: {
        Row: { id: string; user_id: string; property_id: string; source_query: string; source_page: string; suggested_title: string; suggestion_type: string; analysis: Json; evidence: Json; score: number; status: "pending" | "accepted" | "rejected"; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; property_id: string; source_query: string; source_page: string; suggested_title: string; suggestion_type?: string; analysis?: Json; evidence: Json; score: number; status?: "pending" | "accepted" | "rejected"; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["title_suggestions"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
