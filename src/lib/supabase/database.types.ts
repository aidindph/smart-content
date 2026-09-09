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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
