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
          contact_phone_hash: string | null
          created_at: string
          id: string
          inviter_id: string
          status: string
        }
        Insert: {
          contact_name: string
          contact_phone: string
          contact_phone_hash?: string | null
          created_at?: string
          id?: string
          inviter_id: string
          status?: string
        }
        Update: {
          contact_name?: string
          contact_phone?: string
          contact_phone_hash?: string | null
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
      marketplace_categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      marketplace_delivery_bids: {
        Row: {
          accepted_at: string | null
          bid_amount: number
          completed_at: string | null
          created_at: string | null
          currency: string | null
          estimated_delivery_time: number | null
          id: string
          message: string | null
          order_id: string
          rider_id: string
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          bid_amount: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          estimated_delivery_time?: number | null
          id?: string
          message?: string | null
          order_id: string
          rider_id: string
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          bid_amount?: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          estimated_delivery_time?: number | null
          id?: string
          message?: string | null
          order_id?: string
          rider_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_delivery_bids_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          category_id: string | null
          condition: string | null
          created_at: string | null
          currency: string | null
          description: string
          id: string
          images: string[] | null
          is_active: boolean | null
          is_service: boolean | null
          location: string | null
          price: number
          seller_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          condition?: string | null
          created_at?: string | null
          currency?: string | null
          description: string
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_service?: boolean | null
          location?: string | null
          price: number
          seller_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          condition?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_service?: boolean | null
          location?: string | null
          price?: number
          seller_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          listing_id: string | null
          message: string
          order_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          listing_id?: string | null
          message: string
          order_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          listing_id?: string | null
          message?: string
          order_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_notifications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          amount: number
          buyer_id: string
          confirmed_at: string | null
          created_at: string | null
          currency: string
          delivered_at: string | null
          delivery_address: string | null
          delivery_name: string | null
          delivery_phone: string | null
          gifted_to_user_id: string | null
          id: string
          listing_id: string
          paid_at: string | null
          payment_tx_hash: string | null
          seller_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          buyer_id: string
          confirmed_at?: string | null
          created_at?: string | null
          currency: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_name?: string | null
          delivery_phone?: string | null
          gifted_to_user_id?: string | null
          id?: string
          listing_id: string
          paid_at?: string | null
          payment_tx_hash?: string | null
          seller_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          confirmed_at?: string | null
          created_at?: string | null
          currency?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_name?: string | null
          delivery_phone?: string | null
          gifted_to_user_id?: string | null
          id?: string
          listing_id?: string
          paid_at?: string | null
          payment_tx_hash?: string | null
          seller_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_disputes: {
        Row: {
          admin_only_evidence: boolean | null
          created_at: string | null
          evidence_access_expires_at: string | null
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
          admin_only_evidence?: boolean | null
          created_at?: string | null
          evidence_access_expires_at?: string | null
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
          admin_only_evidence?: boolean | null
          created_at?: string | null
          evidence_access_expires_at?: string | null
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
            foreignKeyName: "p2p_orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "p2p_listings_public"
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
          account_number_encrypted: string | null
          additional_info: Json | null
          bank_name: string | null
          country_code: string
          created_at: string | null
          encryption_key_id: string | null
          id: string
          is_verified: boolean | null
          method_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          account_number_encrypted?: string | null
          additional_info?: Json | null
          bank_name?: string | null
          country_code: string
          created_at?: string | null
          encryption_key_id?: string | null
          id?: string
          is_verified?: boolean | null
          method_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          account_number_encrypted?: string | null
          additional_info?: Json | null
          bank_name?: string | null
          country_code?: string
          created_at?: string | null
          encryption_key_id?: string | null
          id?: string
          is_verified?: boolean | null
          method_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          created_at: string | null
          expires_at: string
          id: string
          message: string | null
          paid_at: string | null
          payer_id: string | null
          recipient_email: string
          recipient_name: string | null
          requester_id: string
          status: string
          token: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          expires_at: string
          id?: string
          message?: string | null
          paid_at?: string | null
          payer_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          requester_id: string
          status?: string
          token?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          expires_at?: string
          id?: string
          message?: string | null
          paid_at?: string | null
          payer_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          requester_id?: string
          status?: string
          token?: string
          updated_at?: string | null
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
      rate_limit_log: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          user_id: string | null
          user_ip: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          user_id?: string | null
          user_ip: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          user_id?: string | null
          user_ip?: string
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
      virtual_card_poll: {
        Row: {
          created_at: string
          id: string
          response: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          response: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          response?: string
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
      p2p_listings_public: {
        Row: {
          available_amount: number | null
          country_code: string | null
          created_at: string | null
          currency_code: string | null
          id: string | null
          is_active: boolean | null
          listing_type: Database["public"]["Enums"]["p2p_listing_type"] | null
          max_amount: number | null
          min_amount: number | null
          payment_time_limit: number | null
          rate: number | null
          terms: string | null
          token: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          available_amount?: number | null
          country_code?: string | null
          created_at?: string | null
          currency_code?: string | null
          id?: string | null
          is_active?: boolean | null
          listing_type?: Database["public"]["Enums"]["p2p_listing_type"] | null
          max_amount?: number | null
          min_amount?: number | null
          payment_time_limit?: number | null
          rate?: number | null
          terms?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          available_amount?: number | null
          country_code?: string | null
          created_at?: string | null
          currency_code?: string | null
          id?: string | null
          is_active?: boolean | null
          listing_type?: Database["public"]["Enums"]["p2p_listing_type"] | null
          max_amount?: number | null
          min_amount?: number | null
          payment_time_limit?: number | null
          rate?: number | null
          terms?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_dispute_evidence: {
        Args: { _dispute_id: string; _user_id: string }
        Returns: boolean
      }
      can_insert_profile_for_new_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          _action_type: string
          _max_requests?: number
          _time_window_minutes?: number
          _user_ip: string
        }
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
      hash_phone_number: {
        Args: { _phone: string }
        Returns: string
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
