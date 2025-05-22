export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      beta_keys: {
        Row: {
          created_at: string | null
          id: string
          is_used: boolean | null
          key: string
          used_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_used?: boolean | null
          key: string
          used_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_used?: boolean | null
          key?: string
          used_by?: string | null
        }
        Relationships: []
      }
      clips: {
        Row: {
          clip_url: string | null
          created_at: string | null
          data: Json | null
          favorite: boolean | null
          id: string
          match_id: string | null
          streamer_id: string | null
          timestamp: string | null
          title: string | null
          vod_url: string | null
        }
        Insert: {
          clip_url?: string | null
          created_at?: string | null
          data?: Json | null
          favorite?: boolean | null
          id?: string
          match_id?: string | null
          streamer_id?: string | null
          timestamp?: string | null
          title?: string | null
          vod_url?: string | null
        }
        Update: {
          clip_url?: string | null
          created_at?: string | null
          data?: Json | null
          favorite?: boolean | null
          id?: string
          match_id?: string | null
          streamer_id?: string | null
          timestamp?: string | null
          title?: string | null
          vod_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clips_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clips_streamer_id_fkey"
            columns: ["streamer_id"]
            isOneToOne: false
            referencedRelation: "streamers"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string | null
          data: Json | null
          date_time: string | null
          id: string
          map: string | null
          match_id: string | null
          score: string | null
          url: string | null
          valorant_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          date_time?: string | null
          id?: string
          map?: string | null
          match_id?: string | null
          score?: string | null
          url?: string | null
          valorant_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          date_time?: string | null
          id?: string
          map?: string | null
          match_id?: string | null
          score?: string | null
          url?: string | null
          valorant_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          beta_key: string | null
          created_at: string | null
          discord: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          tiktok: string | null
          twitch: string | null
          twitter: string | null
          updated_at: string | null
          username: string | null
          youtube: string | null
        }
        Insert: {
          avatar_url?: string | null
          beta_key?: string | null
          created_at?: string | null
          discord?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          tiktok?: string | null
          twitch?: string | null
          twitter?: string | null
          updated_at?: string | null
          username?: string | null
          youtube?: string | null
        }
        Update: {
          avatar_url?: string | null
          beta_key?: string | null
          created_at?: string | null
          discord?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          tiktok?: string | null
          twitch?: string | null
          twitter?: string | null
          updated_at?: string | null
          username?: string | null
          youtube?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_beta_key_fkey"
            columns: ["beta_key"]
            isOneToOne: false
            referencedRelation: "beta_keys"
            referencedColumns: ["key"]
          },
        ]
      }
      streamers: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          twitch_id: string | null
          twitch_username: string | null
          valorant_name: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          twitch_id?: string | null
          twitch_username?: string | null
          valorant_name?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          twitch_id?: string | null
          twitch_username?: string | null
          valorant_name?: string | null
        }
        Relationships: []
      }
      tracked_players: {
        Row: {
          created_at: string | null
          id: string
          last_tracked: string | null
          status: string | null
          valorant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_tracked?: string | null
          status?: string | null
          valorant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_tracked?: string | null
          status?: string | null
          valorant_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          discord: string | null
          email: string
          motivation: string | null
          tiktok: string | null
          twitch: string | null
          twitter: string | null
          user_type: string | null
          valorant_id: string | null
          youtube: string | null
        }
        Insert: {
          created_at?: string
          discord?: string | null
          email: string
          motivation?: string | null
          tiktok?: string | null
          twitch?: string | null
          twitter?: string | null
          user_type?: string | null
          valorant_id?: string | null
          youtube?: string | null
        }
        Update: {
          created_at?: string
          discord?: string | null
          email?: string
          motivation?: string | null
          tiktok?: string | null
          twitch?: string | null
          twitter?: string | null
          user_type?: string | null
          valorant_id?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_beta_keys: {
        Args: { key_count?: number }
        Returns: {
          created_at: string | null
          id: string
          is_used: boolean | null
          key: string
          used_by: string | null
        }[]
      }
      generate_random_key: {
        Args: { length?: number }
        Returns: string
      }
      get_beta_key: {
        Args: { lookup_key: string }
        Returns: {
          id: string
          key: string
          is_used: boolean
          used_by: string
          created_at: string
        }[]
      }
      get_beta_keys_with_user: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          key: string
          is_used: boolean
          used_by: string
          created_at: string
          user_email: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
