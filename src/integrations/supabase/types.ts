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
      admin_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      card_transactions: {
        Row: {
          amount: number
          card_id: string
          created_at: string | null
          currency: string
          id: string
          merchant_category: string | null
          merchant_name: string | null
          status: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          card_id: string
          created_at?: string | null
          currency: string
          id?: string
          merchant_category?: string | null
          merchant_name?: string | null
          status?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          card_id?: string
          created_at?: string | null
          currency?: string
          id?: string
          merchant_category?: string | null
          merchant_name?: string | null
          status?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "virtual_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_invitations: {
        Row: {
          contact_name: string
          contact_phone: string
          created_at: string
          id: string
          inviter_id: string
          status: string
        }
        Insert: {
          contact_name: string
          contact_phone: string
          created_at?: string
          id?: string
          inviter_id: string
          status?: string
        }
        Update: {
          contact_name?: string
          contact_phone?: string
          created_at?: string
          id?: string
          inviter_id?: string
          status?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          contact_name: string
          contact_phone: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          contact_name: string
          contact_phone: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          contact_name?: string
          contact_phone?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      p2p_disputes: {
        Row: {
          created_at: string | null
          evidence_urls: string[] | null
          id: string
          order_id: string
          raised_by: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          evidence_urls?: string[] | null
          id?: string
          order_id: string
          raised_by: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          evidence_urls?: string[] | null
          id?: string
          order_id?: string
          raised_by?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "p2p_disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "p2p_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_listings: {
        Row: {
          available_amount: number
          country_code: string
          created_at: string | null
          currency_code: string
          id: string
          is_active: boolean | null
          listing_type: Database["public"]["Enums"]["p2p_listing_type"]
          max_amount: number
          min_amount: number
          payment_method_id: string | null
          payment_time_limit: number | null
          rate: number
          terms: string | null
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_amount: number
          country_code: string
          created_at?: string | null
          currency_code: string
          id?: string
          is_active?: boolean | null
          listing_type: Database["public"]["Enums"]["p2p_listing_type"]
          max_amount: number
          min_amount: number
          payment_method_id?: string | null
          payment_time_limit?: number | null
          rate: number
          terms?: string | null
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_amount?: number
          country_code?: string
          created_at?: string | null
          currency_code?: string
          id?: string
          is_active?: boolean | null
          listing_type?: Database["public"]["Enums"]["p2p_listing_type"]
          max_amount?: number
          min_amount?: number
          payment_method_id?: string | null
          payment_time_limit?: number | null
          rate?: number
          terms?: string | null
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_listings_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_orders: {
        Row: {
          buyer_id: string
          cancelled_at: string | null
          completed_at: string | null
          created_at: string | null
          crypto_amount: number
          currency_code: string
          expires_at: string
          fiat_amount: number
          id: string
          listing_id: string
          paid_at: string | null
          payment_method_id: string | null
          rate: number
          seller_id: string
          status: Database["public"]["Enums"]["p2p_order_status"] | null
          token: string
          updated_at: string | null
        }
        Insert: {
          buyer_id: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          crypto_amount: number
          currency_code: string
          expires_at: string
          fiat_amount: number
          id?: string
          listing_id: string
          paid_at?: string | null
          payment_method_id?: string | null
          rate: number
          seller_id: string
          status?: Database["public"]["Enums"]["p2p_order_status"] | null
          token: string
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          crypto_amount?: number
          currency_code?: string
          expires_at?: string
          fiat_amount?: number
          id?: string
          listing_id?: string
          paid_at?: string | null
          payment_method_id?: string | null
          rate?: number
          seller_id?: string
          status?: Database["public"]["Enums"]["p2p_order_status"] | null
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "p2p_orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "p2p_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_orders_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_name: string
          account_number: string
          additional_info: Json | null
          bank_name: string | null
          country_code: string
          created_at: string | null
          id: string
          is_verified: boolean | null
          method_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          additional_info?: Json | null
          bank_name?: string | null
          country_code: string
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          method_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          additional_info?: Json | null
          bank_name?: string | null
          country_code?: string
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          method_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone_number: string
          socials: Json | null
          updated_at: string
          wallet_address: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          phone_number: string
          socials?: Json | null
          updated_at?: string
          wallet_address: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone_number?: string
          socials?: Json | null
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      supported_countries: {
        Row: {
          country_code: string
          country_name: string
          created_at: string | null
          currency_code: string
          currency_symbol: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string | null
          currency_code: string
          currency_symbol: string
          id?: string
          is_active?: boolean | null
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string | null
          currency_code?: string
          currency_symbol?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          recipient_id: string | null
          recipient_wallet: string
          sender_id: string
          sender_wallet: string
          status: string
          token: string
          transaction_hash: string | null
          transaction_type: string
          withdrawal_fee: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          recipient_id?: string | null
          recipient_wallet: string
          sender_id: string
          sender_wallet: string
          status?: string
          token: string
          transaction_hash?: string | null
          transaction_type: string
          withdrawal_fee?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          recipient_id?: string | null
          recipient_wallet?: string
          sender_id?: string
          sender_wallet?: string
          status?: string
          token?: string
          transaction_hash?: string | null
          transaction_type?: string
          withdrawal_fee?: number | null
        }
        Relationships: []
      }
      user_registry: {
        Row: {
          created_at: string
          id: string
          phone_number: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          phone_number: string
          user_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          phone_number?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      virtual_cards: {
        Row: {
          balance: number | null
          card_holder_name: string
          card_number_encrypted: string
          created_at: string | null
          currency: string | null
          cvv_encrypted: string
          expiry_month: number
          expiry_year: number
          external_card_id: string | null
          id: string
          is_active: boolean | null
          is_frozen: boolean | null
          spending_limit: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          card_holder_name: string
          card_number_encrypted: string
          created_at?: string | null
          currency?: string | null
          cvv_encrypted: string
          expiry_month: number
          expiry_year: number
          external_card_id?: string | null
          id?: string
          is_active?: boolean | null
          is_frozen?: boolean | null
          spending_limit?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          card_holder_name?: string
          card_number_encrypted?: string
          created_at?: string | null
          currency?: string | null
          cvv_encrypted?: string
          expiry_month?: number
          expiry_year?: number
          external_card_id?: string | null
          id?: string
          is_active?: boolean | null
          is_frozen?: boolean | null
          spending_limit?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallet_balances: {
        Row: {
          balance: number
          created_at: string
          id: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_insert_profile_for_new_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      generate_wallet_address: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_public_profile: {
        Args: { user_uuid: string }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lookup_user_by_phone: {
        Args: { phone: string }
        Returns: {
          user_id: string
          wallet_address: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      p2p_listing_type: "buy" | "sell"
      p2p_order_status:
        | "pending"
        | "paid"
        | "completed"
        | "cancelled"
        | "disputed"
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
      app_role: ["admin", "moderator", "user"],
      p2p_listing_type: ["buy", "sell"],
      p2p_order_status: [
        "pending",
        "paid",
        "completed",
        "cancelled",
        "disputed",
      ],
    },
  },
} as const
