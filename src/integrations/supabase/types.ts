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
      chain_tokens: {
        Row: {
          chain_id: number
          contract_address: string
          created_at: string | null
          decimals: number
          id: string
          is_active: boolean | null
          token_symbol: string
        }
        Insert: {
          chain_id: number
          contract_address: string
          created_at?: string | null
          decimals?: number
          id?: string
          is_active?: boolean | null
          token_symbol: string
        }
        Update: {
          chain_id?: number
          contract_address?: string
          created_at?: string | null
          decimals?: number
          id?: string
          is_active?: boolean | null
          token_symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_tokens_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "supported_chains"
            referencedColumns: ["chain_id"]
          },
        ]
      }
      cold_wallet_transfers: {
        Row: {
          admin_id: string
          amount: number
          cold_wallet_address: string
          completed_at: string | null
          created_at: string
          hot_wallet_address: string
          id: string
          notes: string | null
          status: string
          token: string
          transaction_hash: string | null
        }
        Insert: {
          admin_id: string
          amount: number
          cold_wallet_address: string
          completed_at?: string | null
          created_at?: string
          hot_wallet_address: string
          id?: string
          notes?: string | null
          status?: string
          token: string
          transaction_hash?: string | null
        }
        Update: {
          admin_id?: string
          amount?: number
          cold_wallet_address?: string
          completed_at?: string | null
          created_at?: string
          hot_wallet_address?: string
          id?: string
          notes?: string | null
          status?: string
          token?: string
          transaction_hash?: string | null
        }
        Relationships: []
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
      gas_fundings: {
        Row: {
          amount: number
          chain_name: string
          created_at: string | null
          id: string
          master_wallet_address: string
          reason: string | null
          token: string
          tx_hash: string | null
          user_id: string | null
          user_wallet_address: string
        }
        Insert: {
          amount: number
          chain_name: string
          created_at?: string | null
          id?: string
          master_wallet_address: string
          reason?: string | null
          token: string
          tx_hash?: string | null
          user_id?: string | null
          user_wallet_address: string
        }
        Update: {
          amount?: number
          chain_name?: string
          created_at?: string | null
          id?: string
          master_wallet_address?: string
          reason?: string | null
          token?: string
          tx_hash?: string | null
          user_id?: string | null
          user_wallet_address?: string
        }
        Relationships: []
      }
      kyc_verifications: {
        Row: {
          address: string
          country_code: string
          created_at: string | null
          date_of_birth: string
          full_name: string
          id: string
          id_document_url: string | null
          id_number: string
          id_type: string
          rejection_reason: string | null
          selfie_url: string | null
          status: string | null
          submitted_at: string | null
          updated_at: string | null
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          address: string
          country_code: string
          created_at?: string | null
          date_of_birth: string
          full_name: string
          id?: string
          id_document_url?: string | null
          id_number: string
          id_type: string
          rejection_reason?: string | null
          selfie_url?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          address?: string
          country_code?: string
          created_at?: string | null
          date_of_birth?: string
          full_name?: string
          id?: string
          id_document_url?: string | null
          id_number?: string
          id_type?: string
          rejection_reason?: string | null
          selfie_url?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      marketplace_bids: {
        Row: {
          bid_amount: number
          bidder_id: string
          created_at: string
          currency: string
          escrow_amount: number | null
          id: string
          listing_id: string
          message: string | null
          phone_number: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          bid_amount: number
          bidder_id: string
          created_at?: string
          currency?: string
          escrow_amount?: number | null
          id?: string
          listing_id: string
          message?: string | null
          phone_number?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          bid_amount?: number
          bidder_id?: string
          created_at?: string
          currency?: string
          escrow_amount?: number | null
          id?: string
          listing_id?: string
          message?: string | null
          phone_number?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_bids_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
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
          listing_type: string
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
          listing_type?: string
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
          listing_type?: string
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
          buyer_confirmation_date: string | null
          buyer_confirmed_delivery: boolean | null
          buyer_id: string
          confirmed_at: string | null
          created_at: string | null
          currency: string
          delivered_at: string | null
          delivery_address: string | null
          delivery_name: string | null
          delivery_phone: string | null
          escrow_amount: number | null
          escrow_released: boolean | null
          gifted_to_user_id: string | null
          id: string
          listing_id: string
          paid_at: string | null
          payment_tx_hash: string | null
          rider_amount: number | null
          seller_amount: number | null
          seller_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          buyer_confirmation_date?: string | null
          buyer_confirmed_delivery?: boolean | null
          buyer_id: string
          confirmed_at?: string | null
          created_at?: string | null
          currency: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_name?: string | null
          delivery_phone?: string | null
          escrow_amount?: number | null
          escrow_released?: boolean | null
          gifted_to_user_id?: string | null
          id?: string
          listing_id: string
          paid_at?: string | null
          payment_tx_hash?: string | null
          rider_amount?: number | null
          seller_amount?: number | null
          seller_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          buyer_confirmation_date?: string | null
          buyer_confirmed_delivery?: boolean | null
          buyer_id?: string
          confirmed_at?: string | null
          created_at?: string | null
          currency?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_name?: string | null
          delivery_phone?: string | null
          escrow_amount?: number | null
          escrow_released?: boolean | null
          gifted_to_user_id?: string | null
          id?: string
          listing_id?: string
          paid_at?: string | null
          payment_tx_hash?: string | null
          rider_amount?: number | null
          seller_amount?: number | null
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
          aa_wallet_address: string | null
          aa_wallet_deployed: boolean | null
          aa_wallet_salt: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          encryption_key_version: string | null
          id: string
          phone_number: string
          socials: Json | null
          updated_at: string
          wallet_address: string
          wallet_private_key_encrypted: string | null
        }
        Insert: {
          aa_wallet_address?: string | null
          aa_wallet_deployed?: boolean | null
          aa_wallet_salt?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          encryption_key_version?: string | null
          id: string
          phone_number: string
          socials?: Json | null
          updated_at?: string
          wallet_address: string
          wallet_private_key_encrypted?: string | null
        }
        Update: {
          aa_wallet_address?: string | null
          aa_wallet_deployed?: boolean | null
          aa_wallet_salt?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          encryption_key_version?: string | null
          id?: string
          phone_number?: string
          socials?: Json | null
          updated_at?: string
          wallet_address?: string
          wallet_private_key_encrypted?: string | null
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
      reward_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["reward_activity_type"]
          created_at: string
          id: string
          metadata: Json | null
          points_awarded: number
          user_id: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["reward_activity_type"]
          created_at?: string
          id?: string
          metadata?: Json | null
          points_awarded: number
          user_id: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["reward_activity_type"]
          created_at?: string
          id?: string
          metadata?: Json | null
          points_awarded?: number
          user_id?: string
        }
        Relationships: []
      }
      reward_rules: {
        Row: {
          activity_type: Database["public"]["Enums"]["reward_activity_type"]
          created_at: string
          id: string
          is_active: boolean | null
          max_points_per_period: number | null
          metadata: Json | null
          points_base: number
          points_multiplier: number | null
          updated_at: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["reward_activity_type"]
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_points_per_period?: number | null
          metadata?: Json | null
          points_base: number
          points_multiplier?: number | null
          updated_at?: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["reward_activity_type"]
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_points_per_period?: number | null
          metadata?: Json | null
          points_base?: number
          points_multiplier?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      staking_positions: {
        Row: {
          apy_rate: number
          created_at: string
          duration_days: number
          end_date: string
          id: string
          rewards_earned: number
          staked_amount: number
          start_date: string
          status: string
          token: string
          updated_at: string
          user_id: string
          withdrawn_at: string | null
        }
        Insert: {
          apy_rate?: number
          created_at?: string
          duration_days: number
          end_date: string
          id?: string
          rewards_earned?: number
          staked_amount: number
          start_date?: string
          status?: string
          token: string
          updated_at?: string
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          apy_rate?: number
          created_at?: string
          duration_days?: number
          end_date?: string
          id?: string
          rewards_earned?: number
          staked_amount?: number
          start_date?: string
          status?: string
          token?: string
          updated_at?: string
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      supported_chains: {
        Row: {
          block_explorer: string
          chain_id: number
          chain_name: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_testnet: boolean | null
          native_currency_decimals: number
          native_currency_symbol: string
          rpc_url: string
        }
        Insert: {
          block_explorer: string
          chain_id: number
          chain_name: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_testnet?: boolean | null
          native_currency_decimals?: number
          native_currency_symbol: string
          rpc_url: string
        }
        Update: {
          block_explorer?: string
          chain_id?: number
          chain_name?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_testnet?: boolean | null
          native_currency_decimals?: number
          native_currency_symbol?: string
          rpc_url?: string
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
      system_notifications: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          message: string
          notification_type: string
          priority: number | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          notification_type?: string
          priority?: number | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          notification_type?: string
          priority?: number | null
          title?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          chain_id: number | null
          chain_name: string | null
          created_at: string
          id: string
          recipient_id: string | null
          recipient_wallet: string
          sender_id: string | null
          sender_wallet: string
          status: string
          token: string
          transaction_hash: string | null
          transaction_type: string
          withdrawal_fee: number | null
        }
        Insert: {
          amount: number
          chain_id?: number | null
          chain_name?: string | null
          created_at?: string
          id?: string
          recipient_id?: string | null
          recipient_wallet: string
          sender_id?: string | null
          sender_wallet: string
          status?: string
          token: string
          transaction_hash?: string | null
          transaction_type: string
          withdrawal_fee?: number | null
        }
        Update: {
          amount?: number
          chain_id?: number | null
          chain_name?: string | null
          created_at?: string
          id?: string
          recipient_id?: string | null
          recipient_wallet?: string
          sender_id?: string | null
          sender_wallet?: string
          status?: string
          token?: string
          transaction_hash?: string | null
          transaction_type?: string
          withdrawal_fee?: number | null
        }
        Relationships: []
      }
      user_2fa_preferences: {
        Row: {
          created_at: string | null
          id: string
          require_on_login: boolean | null
          require_on_marketplace_purchase: boolean | null
          require_on_p2p_trade: boolean | null
          require_on_payment_method_changes: boolean | null
          require_on_security_changes: boolean | null
          require_on_send: boolean | null
          require_on_staking: boolean | null
          require_on_withdraw: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          require_on_login?: boolean | null
          require_on_marketplace_purchase?: boolean | null
          require_on_p2p_trade?: boolean | null
          require_on_payment_method_changes?: boolean | null
          require_on_security_changes?: boolean | null
          require_on_send?: boolean | null
          require_on_staking?: boolean | null
          require_on_withdraw?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          require_on_login?: boolean | null
          require_on_marketplace_purchase?: boolean | null
          require_on_p2p_trade?: boolean | null
          require_on_payment_method_changes?: boolean | null
          require_on_security_changes?: boolean | null
          require_on_send?: boolean | null
          require_on_staking?: boolean | null
          require_on_withdraw?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_description: string | null
          badge_image_url: string | null
          badge_name: string
          badge_type: Database["public"]["Enums"]["badge_type"]
          id: string
          nft_token_id: string | null
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_description?: string | null
          badge_image_url?: string | null
          badge_name: string
          badge_type: Database["public"]["Enums"]["badge_type"]
          id?: string
          nft_token_id?: string | null
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_description?: string | null
          badge_image_url?: string | null
          badge_name?: string
          badge_type?: Database["public"]["Enums"]["badge_type"]
          id?: string
          nft_token_id?: string | null
          user_id?: string
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
      user_rewards: {
        Row: {
          activity_points: number
          consecutive_active_months: number
          created_at: string
          current_level: number
          early_bird_points: number
          id: string
          last_active_month: string | null
          monthly_transaction_count: number
          total_points: number
          total_transaction_volume: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_points?: number
          consecutive_active_months?: number
          created_at?: string
          current_level?: number
          early_bird_points?: number
          id?: string
          last_active_month?: string | null
          monthly_transaction_count?: number
          total_points?: number
          total_transaction_volume?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_points?: number
          consecutive_active_months?: number
          created_at?: string
          current_level?: number
          early_bird_points?: number
          id?: string
          last_active_month?: string | null
          monthly_transaction_count?: number
          total_points?: number
          total_transaction_volume?: number
          updated_at?: string
          user_id?: string
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
      user_sessions: {
        Row: {
          created_at: string | null
          device_info: Json | null
          id: string
          last_active: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          last_active?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          last_active?: string | null
          session_id?: string
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
          chain_id: number | null
          created_at: string
          id: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          chain_id?: number | null
          created_at?: string
          id?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          chain_id?: number | null
          created_at?: string
          id?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_balances_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "supported_chains"
            referencedColumns: ["chain_id"]
          },
        ]
      }
      wallet_sweeps: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          id: string
          master_wallet_address: string
          status: string
          sweep_tx_hash: string | null
          token: string
          user_id: string
          user_wallet_address: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          id?: string
          master_wallet_address: string
          status?: string
          sweep_tx_hash?: string | null
          token: string
          user_id: string
          user_wallet_address: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          id?: string
          master_wallet_address?: string
          status?: string
          sweep_tx_hash?: string | null
          token?: string
          user_id?: string
          user_wallet_address?: string
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
      award_badge: {
        Args: {
          _badge_description?: string
          _badge_name: string
          _badge_type: Database["public"]["Enums"]["badge_type"]
          _user_id: string
        }
        Returns: string
      }
      award_points: {
        Args: {
          _activity_type: Database["public"]["Enums"]["reward_activity_type"]
          _metadata?: Json
          _user_id: string
        }
        Returns: number
      }
      calculate_staking_rewards: {
        Args: { _amount: number; _apy_rate: number; _duration_days: number }
        Returns: number
      }
      can_access_dispute_evidence: {
        Args: { _dispute_id: string; _user_id: string }
        Returns: boolean
      }
      can_insert_profile_for_new_user: { Args: never; Returns: boolean }
      check_rate_limit: {
        Args: {
          _action_type: string
          _max_requests?: number
          _time_window_minutes?: number
          _user_ip: string
        }
        Returns: boolean
      }
      generate_wallet_address: { Args: never; Returns: string }
      get_payment_request_public_info: {
        Args: { _request_id: string }
        Returns: {
          amount: number
          expires_at: string
          id: string
          message: string
          requester_name: string
          status: string
          token: string
        }[]
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
      hash_phone_number: { Args: { _phone: string }; Returns: string }
      is_listing_seller: {
        Args: { _listing_id: string; _user_id: string }
        Returns: boolean
      }
      lookup_user_by_phone: {
        Args: { phone: string }
        Returns: {
          user_id: string
          wallet_address: string
        }[]
      }
      process_internal_transfer: {
        Args: {
          _amount: number
          _recipient_id: string
          _recipient_wallet: string
          _sender_id: string
          _sender_wallet: string
          _token: string
          _transaction_type?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      badge_type:
        | "finmo_pioneer"
        | "volume_trader"
        | "steady_earner"
        | "kyc_verified"
        | "super_connector"
      p2p_listing_type: "buy" | "sell"
      p2p_order_status:
        | "pending"
        | "paid"
        | "completed"
        | "cancelled"
        | "disputed"
      reward_activity_type:
        | "account_creation"
        | "kyc_completion"
        | "contact_sync"
        | "user_invitation"
        | "first_transaction"
        | "transaction_volume"
        | "transaction_frequency"
        | "p2p_trade"
        | "marketplace_purchase"
        | "monthly_retention"
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
      badge_type: [
        "finmo_pioneer",
        "volume_trader",
        "steady_earner",
        "kyc_verified",
        "super_connector",
      ],
      p2p_listing_type: ["buy", "sell"],
      p2p_order_status: [
        "pending",
        "paid",
        "completed",
        "cancelled",
        "disputed",
      ],
      reward_activity_type: [
        "account_creation",
        "kyc_completion",
        "contact_sync",
        "user_invitation",
        "first_transaction",
        "transaction_volume",
        "transaction_frequency",
        "p2p_trade",
        "marketplace_purchase",
        "monthly_retention",
      ],
    },
  },
} as const
