export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  auth: {
    Tables: {
      audit_log_entries: {
        Row: {
          created_at: string | null
          id: string
          instance_id: string | null
          ip_address: string
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          id: string
          instance_id?: string | null
          ip_address?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_id?: string | null
          ip_address?: string
          payload?: Json | null
        }
        Relationships: []
      }
      flow_state: {
        Row: {
          auth_code: string
          auth_code_issued_at: string | null
          authentication_method: string
          code_challenge: string
          code_challenge_method: Database["auth"]["Enums"]["code_challenge_method"]
          created_at: string | null
          id: string
          provider_access_token: string | null
          provider_refresh_token: string | null
          provider_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auth_code: string
          auth_code_issued_at?: string | null
          authentication_method: string
          code_challenge: string
          code_challenge_method: Database["auth"]["Enums"]["code_challenge_method"]
          created_at?: string | null
          id: string
          provider_access_token?: string | null
          provider_refresh_token?: string | null
          provider_type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auth_code?: string
          auth_code_issued_at?: string | null
          authentication_method?: string
          code_challenge?: string
          code_challenge_method?: Database["auth"]["Enums"]["code_challenge_method"]
          created_at?: string | null
          id?: string
          provider_access_token?: string | null
          provider_refresh_token?: string | null
          provider_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      identities: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          identity_data: Json
          last_sign_in_at: string | null
          provider: string
          provider_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          identity_data: Json
          last_sign_in_at?: string | null
          provider: string
          provider_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          identity_data?: Json
          last_sign_in_at?: string | null
          provider?: string
          provider_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      instances: {
        Row: {
          created_at: string | null
          id: string
          raw_base_config: string | null
          updated_at: string | null
          uuid: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          raw_base_config?: string | null
          updated_at?: string | null
          uuid?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          raw_base_config?: string | null
          updated_at?: string | null
          uuid?: string | null
        }
        Relationships: []
      }
      mfa_amr_claims: {
        Row: {
          authentication_method: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          authentication_method: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
        }
        Update: {
          authentication_method?: string
          created_at?: string
          id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfa_amr_claims_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_challenges: {
        Row: {
          created_at: string
          factor_id: string
          id: string
          ip_address: unknown
          otp_code: string | null
          verified_at: string | null
          web_authn_session_data: Json | null
        }
        Insert: {
          created_at: string
          factor_id: string
          id: string
          ip_address: unknown
          otp_code?: string | null
          verified_at?: string | null
          web_authn_session_data?: Json | null
        }
        Update: {
          created_at?: string
          factor_id?: string
          id?: string
          ip_address?: unknown
          otp_code?: string | null
          verified_at?: string | null
          web_authn_session_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mfa_challenges_auth_factor_id_fkey"
            columns: ["factor_id"]
            isOneToOne: false
            referencedRelation: "mfa_factors"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_factors: {
        Row: {
          created_at: string
          factor_type: Database["auth"]["Enums"]["factor_type"]
          friendly_name: string | null
          id: string
          last_challenged_at: string | null
          last_webauthn_challenge_data: Json | null
          phone: string | null
          secret: string | null
          status: Database["auth"]["Enums"]["factor_status"]
          updated_at: string
          user_id: string
          web_authn_aaguid: string | null
          web_authn_credential: Json | null
        }
        Insert: {
          created_at: string
          factor_type: Database["auth"]["Enums"]["factor_type"]
          friendly_name?: string | null
          id: string
          last_challenged_at?: string | null
          last_webauthn_challenge_data?: Json | null
          phone?: string | null
          secret?: string | null
          status: Database["auth"]["Enums"]["factor_status"]
          updated_at: string
          user_id: string
          web_authn_aaguid?: string | null
          web_authn_credential?: Json | null
        }
        Update: {
          created_at?: string
          factor_type?: Database["auth"]["Enums"]["factor_type"]
          friendly_name?: string | null
          id?: string
          last_challenged_at?: string | null
          last_webauthn_challenge_data?: Json | null
          phone?: string | null
          secret?: string | null
          status?: Database["auth"]["Enums"]["factor_status"]
          updated_at?: string
          user_id?: string
          web_authn_aaguid?: string | null
          web_authn_credential?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mfa_factors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_authorizations: {
        Row: {
          approved_at: string | null
          authorization_code: string | null
          authorization_id: string
          client_id: string
          code_challenge: string | null
          code_challenge_method:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at: string
          expires_at: string
          id: string
          redirect_uri: string
          resource: string | null
          response_type: Database["auth"]["Enums"]["oauth_response_type"]
          scope: string
          state: string | null
          status: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          authorization_code?: string | null
          authorization_id: string
          client_id: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string
          expires_at?: string
          id: string
          redirect_uri: string
          resource?: string | null
          response_type?: Database["auth"]["Enums"]["oauth_response_type"]
          scope: string
          state?: string | null
          status?: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          authorization_code?: string | null
          authorization_id?: string
          client_id?: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string
          expires_at?: string
          id?: string
          redirect_uri?: string
          resource?: string | null
          response_type?: Database["auth"]["Enums"]["oauth_response_type"]
          scope?: string
          state?: string | null
          status?: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorizations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_authorizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_clients: {
        Row: {
          client_name: string | null
          client_secret_hash: string | null
          client_type: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri: string | null
          created_at: string
          deleted_at: string | null
          grant_types: string
          id: string
          logo_uri: string | null
          redirect_uris: string
          registration_type: Database["auth"]["Enums"]["oauth_registration_type"]
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          client_secret_hash?: string | null
          client_type?: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri?: string | null
          created_at?: string
          deleted_at?: string | null
          grant_types: string
          id: string
          logo_uri?: string | null
          redirect_uris: string
          registration_type: Database["auth"]["Enums"]["oauth_registration_type"]
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          client_secret_hash?: string | null
          client_type?: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri?: string | null
          created_at?: string
          deleted_at?: string | null
          grant_types?: string
          id?: string
          logo_uri?: string | null
          redirect_uris?: string
          registration_type?: Database["auth"]["Enums"]["oauth_registration_type"]
          updated_at?: string
        }
        Relationships: []
      }
      oauth_consents: {
        Row: {
          client_id: string
          granted_at: string
          id: string
          revoked_at: string | null
          scopes: string
          user_id: string
        }
        Insert: {
          client_id: string
          granted_at?: string
          id: string
          revoked_at?: string | null
          scopes: string
          user_id: string
        }
        Update: {
          client_id?: string
          granted_at?: string
          id?: string
          revoked_at?: string | null
          scopes?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      one_time_tokens: {
        Row: {
          created_at: string
          id: string
          relates_to: string
          token_hash: string
          token_type: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          relates_to: string
          token_hash: string
          token_type: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          relates_to?: string
          token_hash?: string
          token_type?: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      refresh_tokens: {
        Row: {
          created_at: string | null
          id: number
          instance_id: string | null
          parent: string | null
          revoked: boolean | null
          session_id: string | null
          token: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          instance_id?: string | null
          parent?: string | null
          revoked?: boolean | null
          session_id?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          instance_id?: string | null
          parent?: string | null
          revoked?: boolean | null
          session_id?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refresh_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      saml_providers: {
        Row: {
          attribute_mapping: Json | null
          created_at: string | null
          entity_id: string
          id: string
          metadata_url: string | null
          metadata_xml: string
          name_id_format: string | null
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          attribute_mapping?: Json | null
          created_at?: string | null
          entity_id: string
          id: string
          metadata_url?: string | null
          metadata_xml: string
          name_id_format?: string | null
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          attribute_mapping?: Json | null
          created_at?: string | null
          entity_id?: string
          id?: string
          metadata_url?: string | null
          metadata_xml?: string
          name_id_format?: string | null
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saml_providers_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      saml_relay_states: {
        Row: {
          created_at: string | null
          flow_state_id: string | null
          for_email: string | null
          id: string
          redirect_to: string | null
          request_id: string
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          flow_state_id?: string | null
          for_email?: string | null
          id: string
          redirect_to?: string | null
          request_id: string
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          flow_state_id?: string | null
          for_email?: string | null
          id?: string
          redirect_to?: string | null
          request_id?: string
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saml_relay_states_flow_state_id_fkey"
            columns: ["flow_state_id"]
            isOneToOne: false
            referencedRelation: "flow_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saml_relay_states_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          version: string
        }
        Insert: {
          version: string
        }
        Update: {
          version?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          aal: Database["auth"]["Enums"]["aal_level"] | null
          created_at: string | null
          factor_id: string | null
          id: string
          ip: unknown
          not_after: string | null
          oauth_client_id: string | null
          refresh_token_counter: number | null
          refresh_token_hmac_key: string | null
          refreshed_at: string | null
          tag: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          aal?: Database["auth"]["Enums"]["aal_level"] | null
          created_at?: string | null
          factor_id?: string | null
          id: string
          ip?: unknown
          not_after?: string | null
          oauth_client_id?: string | null
          refresh_token_counter?: number | null
          refresh_token_hmac_key?: string | null
          refreshed_at?: string | null
          tag?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          aal?: Database["auth"]["Enums"]["aal_level"] | null
          created_at?: string | null
          factor_id?: string | null
          id?: string
          ip?: unknown
          not_after?: string | null
          oauth_client_id?: string | null
          refresh_token_counter?: number | null
          refresh_token_hmac_key?: string | null
          refreshed_at?: string | null
          tag?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_domains: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id: string
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_domains_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_providers: {
        Row: {
          created_at: string | null
          disabled: boolean | null
          id: string
          resource_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          disabled?: boolean | null
          id: string
          resource_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          disabled?: boolean | null
          id?: string
          resource_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          aud: string | null
          banned_until: string | null
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          email_change: string | null
          email_change_confirm_status: number | null
          email_change_sent_at: string | null
          email_change_token_current: string | null
          email_change_token_new: string | null
          email_confirmed_at: string | null
          encrypted_password: string | null
          id: string
          instance_id: string | null
          invited_at: string | null
          is_anonymous: boolean
          is_sso_user: boolean
          is_super_admin: boolean | null
          last_sign_in_at: string | null
          phone: string | null
          phone_change: string | null
          phone_change_sent_at: string | null
          phone_change_token: string | null
          phone_confirmed_at: string | null
          raw_app_meta_data: Json | null
          raw_user_meta_data: Json | null
          reauthentication_sent_at: string | null
          reauthentication_token: string | null
          recovery_sent_at: string | null
          recovery_token: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id: string
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean
          is_sso_user?: boolean
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id?: string
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean
          is_sso_user?: boolean
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      email: { Args: never; Returns: string }
      jwt: { Args: never; Returns: Json }
      role: { Args: never; Returns: string }
      uid: { Args: never; Returns: string }
    }
    Enums: {
      aal_level: "aal1" | "aal2" | "aal3"
      code_challenge_method: "s256" | "plain"
      factor_status: "unverified" | "verified"
      factor_type: "totp" | "webauthn" | "phone"
      oauth_authorization_status: "pending" | "approved" | "denied" | "expired"
      oauth_client_type: "public" | "confidential"
      oauth_registration_type: "dynamic" | "manual"
      oauth_response_type: "code"
      one_time_token_type:
        | "confirmation_token"
        | "reauthentication_token"
        | "recovery_token"
        | "email_change_token_new"
        | "email_change_token_current"
        | "phone_change_token"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_grants: {
        Row: {
          created_at: string
          employee_id: string
          granted_at: string
          granted_by: string | null
          id: string
          notes: string | null
          revoked_at: string | null
          revoked_by: string | null
          system_name: string
          system_type: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          system_name: string
          system_type?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          system_name?: string
          system_type?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "access_grants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          application_answers: Json | null
          candidate_id: string
          created_at: string
          current_stage_id: string | null
          id: string
          job_id: string
          match_score: number | null
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          application_answers?: Json | null
          candidate_id: string
          created_at?: string
          current_stage_id?: string | null
          id?: string
          job_id: string
          match_score?: number | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          application_answers?: Json | null
          candidate_id?: string
          created_at?: string
          current_stage_id?: string | null
          id?: string
          job_id?: string
          match_score?: number | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          approver_user_id: string | null
          attachments: Json
          category: string
          created_at: string
          decided_at: string | null
          decision_reason: string | null
          details: Json
          id: string
          justification: string
          needed_by: string | null
          requested_at: string
          requested_by_employee_id: string | null
          requested_by_user_id: string
          status: string
          summary: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          approver_user_id?: string | null
          attachments?: Json
          category: string
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          details?: Json
          id?: string
          justification: string
          needed_by?: string | null
          requested_at?: string
          requested_by_employee_id?: string | null
          requested_by_user_id: string
          status?: string
          summary?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          approver_user_id?: string | null
          attachments?: Json
          category?: string
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          details?: Json
          id?: string
          justification?: string
          needed_by?: string | null
          requested_at?: string
          requested_by_employee_id?: string | null
          requested_by_user_id?: string
          status?: string
          summary?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "approval_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blackout_periods: {
        Row: {
          created_at: string
          department_id: string | null
          end_date: string
          id: string
          leave_type_id: string | null
          name: string
          reason: string | null
          start_date: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          end_date: string
          id?: string
          leave_type_id?: string | null
          name: string
          reason?: string | null
          start_date: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          end_date?: string
          id?: string
          leave_type_id?: string | null
          name?: string
          reason?: string | null
          start_date?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blackout_periods_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blackout_periods_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "blackout_periods_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["department_id_full"]
          },
          {
            foreignKeyName: "blackout_periods_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blackout_periods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          applied_at: string
          cover_letter: string | null
          created_at: string
          email: string
          id: string
          linkedin_url: string | null
          name: string
          phone: string | null
          portfolio_url: string | null
          resume_url: string | null
          source: string
          source_details: Json | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          applied_at?: string
          cover_letter?: string | null
          created_at?: string
          email: string
          id?: string
          linkedin_url?: string | null
          name: string
          phone?: string | null
          portfolio_url?: string | null
          resume_url?: string | null
          source: string
          source_details?: Json | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          applied_at?: string
          cover_letter?: string | null
          created_at?: string
          email?: string
          id?: string
          linkedin_url?: string | null
          name?: string
          phone?: string | null
          portfolio_url?: string | null
          resume_url?: string | null
          source?: string
          source_details?: Json | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      check_in_agendas: {
        Row: {
          accomplishments: string | null
          check_in_id: string
          notes_json: Json | null
          priorities: string | null
          roadblocks: string | null
          updated_at: string
        }
        Insert: {
          accomplishments?: string | null
          check_in_id: string
          notes_json?: Json | null
          priorities?: string | null
          roadblocks?: string | null
          updated_at?: string
        }
        Update: {
          accomplishments?: string | null
          check_in_id?: string
          notes_json?: Json | null
          priorities?: string | null
          roadblocks?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_in_agendas_check_in_id_fkey"
            columns: ["check_in_id"]
            isOneToOne: true
            referencedRelation: "check_ins"
            referencedColumns: ["id"]
          },
        ]
      }
      check_in_private_notes: {
        Row: {
          body: string | null
          check_in_id: string
          created_at: string
          manager_user_id: string
        }
        Insert: {
          body?: string | null
          check_in_id: string
          created_at?: string
          manager_user_id: string
        }
        Update: {
          body?: string | null
          check_in_id?: string
          created_at?: string
          manager_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_in_private_notes_check_in_id_fkey"
            columns: ["check_in_id"]
            isOneToOne: true
            referencedRelation: "check_ins"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          completed_at: string | null
          created_at: string
          employee_id: string
          id: string
          last_updated_by: string | null
          manager_user_id: string
          scheduled_for: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          last_updated_by?: string | null
          manager_user_id: string
          scheduled_for?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          last_updated_by?: string | null
          manager_user_id?: string
          scheduled_for?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "check_ins_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "check_ins_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "check_ins_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "check_ins_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "check_ins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          candidate_id: string
          clicked_at: string | null
          content: string
          created_at: string
          delivered_at: string | null
          direction: string
          id: string
          opened_at: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string | null
          template_id: string | null
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          clicked_at?: string | null
          content: string
          created_at?: string
          delivered_at?: string | null
          direction: string
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          clicked_at?: string | null
          content?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_news: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string
          id: string
          publish_at: string | null
          published_at: string | null
          published_by: string | null
          status: string
          summary: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          created_by: string
          id?: string
          publish_at?: string | null
          published_at?: string | null
          published_by?: string | null
          status?: string
          summary?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          publish_at?: string | null
          published_at?: string | null
          published_by?: string | null
          status?: string
          summary?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_news_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_news_activity: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          news_id: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          news_id: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          news_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_news_activity_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "company_news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_news_activity_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          status: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          cost_center: string | null
          created_at: string
          description: string | null
          head_employee_id: string | null
          id: string
          name: string
          office_location_id: string | null
          parent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cost_center?: string | null
          created_at?: string
          description?: string | null
          head_employee_id?: string | null
          id?: string
          name: string
          office_location_id?: string | null
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cost_center?: string | null
          created_at?: string
          description?: string | null
          head_employee_id?: string | null
          id?: string
          name?: string
          office_location_id?: string | null
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["head_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["head_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["head_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["head_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["head_employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["head_employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["head_employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["head_employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "departments_office_location_id_fkey"
            columns: ["office_location_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_office_location_id_fkey"
            columns: ["office_location_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["department_id_full"]
          },
          {
            foreignKeyName: "departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_expiry_notifications: {
        Row: {
          created_at: string
          document_id: string
          id: string
          notification_sent_at: string
          notification_type: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          notification_sent_at?: string
          notification_type: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          notification_sent_at?: string
          notification_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_expiry_notifications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "employee_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_audit_log: {
        Row: {
          action: string
          change_reason: string | null
          changed_by: string
          created_at: string
          employee_id: string
          field_name: string | null
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          change_reason?: string | null
          changed_by: string
          created_at?: string
          employee_id: string
          field_name?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          change_reason?: string | null
          changed_by?: string
          created_at?: string
          employee_id?: string
          field_name?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "employee_audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "employee_audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "employee_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_custom_field_defs: {
        Row: {
          created_at: string
          id: string
          key: string
          name: string
          options: Json | null
          position: number
          required: boolean
          tenant_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          name: string
          options?: Json | null
          position?: number
          required?: boolean
          tenant_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          name?: string
          options?: Json | null
          position?: number
          required?: boolean
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_custom_field_defs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          category: string | null
          description: string | null
          employee_id: string
          expiry_date: string | null
          file_name: string
          file_size: number
          id: string
          is_current: boolean
          mime_type: string
          previous_version_id: string | null
          storage_path: string
          tenant_id: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string
          version: number
        }
        Insert: {
          category?: string | null
          description?: string | null
          employee_id: string
          expiry_date?: string | null
          file_name: string
          file_size: number
          id?: string
          is_current?: boolean
          mime_type: string
          previous_version_id?: string | null
          storage_path: string
          tenant_id: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
          version?: number
        }
        Update: {
          category?: string | null
          description?: string | null
          employee_id?: string
          expiry_date?: string | null
          file_name?: string
          file_size?: number
          id?: string
          is_current?: boolean
          mime_type?: string
          previous_version_id?: string | null
          storage_path?: string
          tenant_id?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "employee_documents_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "employee_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_journey_views: {
        Row: {
          created_at: string
          cta_label: string | null
          hero_copy: string | null
          last_viewed_at: string | null
          run_id: string
          share_token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          hero_copy?: string | null
          last_viewed_at?: string | null
          run_id: string
          share_token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          hero_copy?: string | null
          last_viewed_at?: string | null
          run_id?: string
          share_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_journey_views_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string
          employee_id: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          employee_id: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          employee_id?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "employee_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "employee_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "employee_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_profile_change_requests: {
        Row: {
          approval_request_id: string | null
          approver_user_id: string | null
          created_at: string
          current_snapshot: Json
          decided_at: string | null
          decision_reason: string | null
          employee_id: string
          fields: Json
          id: string
          justification: string | null
          status: string
          submitted_at: string | null
          submitted_by_user_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approval_request_id?: string | null
          approver_user_id?: string | null
          created_at?: string
          current_snapshot?: Json
          decided_at?: string | null
          decision_reason?: string | null
          employee_id: string
          fields?: Json
          id?: string
          justification?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by_user_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approval_request_id?: string | null
          approver_user_id?: string | null
          created_at?: string
          current_snapshot?: Json
          decided_at?: string | null
          decision_reason?: string | null
          employee_id?: string
          fields?: Json
          id?: string
          justification?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by_user_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_profile_change_requests_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_request_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_profile_change_requests_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_profile_change_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_profile_change_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_profile_change_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "employee_profile_change_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_profile_change_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_profile_change_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "employee_profile_change_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_profile_change_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "employee_profile_change_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_status_history: {
        Row: {
          created_at: string
          created_by: string
          effective_date: string
          employee_id: string
          id: string
          reason: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_date: string
          employee_id: string
          id?: string
          reason?: string | null
          status: string
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_date?: string
          employee_id?: string
          id?: string
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_status_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_status_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_status_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "employee_status_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_status_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_status_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "employee_status_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_status_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
        ]
      }
      employees: {
        Row: {
          bank_account_encrypted: string | null
          created_at: string
          custom_fields: Json | null
          date_of_birth: string | null
          department_id: string | null
          dotted_line_manager_id: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_number: string | null
          employment_type: string | null
          end_date: string | null
          home_address: Json | null
          id: string
          job_title: string | null
          manager_id: string | null
          name: string
          nationality: string | null
          office_location_id: string | null
          phone_personal: string | null
          phone_work: string | null
          profile_completion_pct: number | null
          salary_amount: number | null
          salary_currency: string | null
          salary_frequency: string | null
          sensitive_data_flags: Json | null
          start_date: string | null
          status: string
          tax_id_encrypted: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
          work_location: string | null
        }
        Insert: {
          bank_account_encrypted?: string | null
          created_at?: string
          custom_fields?: Json | null
          date_of_birth?: string | null
          department_id?: string | null
          dotted_line_manager_id?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_number?: string | null
          employment_type?: string | null
          end_date?: string | null
          home_address?: Json | null
          id?: string
          job_title?: string | null
          manager_id?: string | null
          name: string
          nationality?: string | null
          office_location_id?: string | null
          phone_personal?: string | null
          phone_work?: string | null
          profile_completion_pct?: number | null
          salary_amount?: number | null
          salary_currency?: string | null
          salary_frequency?: string | null
          sensitive_data_flags?: Json | null
          start_date?: string | null
          status?: string
          tax_id_encrypted?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
          work_location?: string | null
        }
        Update: {
          bank_account_encrypted?: string | null
          created_at?: string
          custom_fields?: Json | null
          date_of_birth?: string | null
          department_id?: string | null
          dotted_line_manager_id?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_number?: string | null
          employment_type?: string | null
          end_date?: string | null
          home_address?: Json | null
          id?: string
          job_title?: string | null
          manager_id?: string | null
          name?: string
          nationality?: string | null
          office_location_id?: string | null
          phone_personal?: string | null
          phone_work?: string | null
          profile_completion_pct?: number | null
          salary_amount?: number | null
          salary_currency?: string | null
          salary_frequency?: string | null
          sensitive_data_flags?: Json | null
          start_date?: string | null
          status?: string
          tax_id_encrypted?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "employees_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["department_id_full"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "employees_office_location_fk"
            columns: ["office_location_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_office_location_fk"
            columns: ["office_location_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_items: {
        Row: {
          assigned_at: string | null
          brand: string | null
          created_at: string
          employee_id: string | null
          id: string
          model: string | null
          notes: string | null
          returned_at: string | null
          serial_number: string | null
          status: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          brand?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          returned_at?: string | null
          serial_number?: string | null
          status?: string
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          brand?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          returned_at?: string | null
          serial_number?: string | null
          status?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "equipment_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          created_at: string
          evaluator_id: string
          id: string
          interview_id: string
          notes: string | null
          overall_rating: number | null
          recommendation: string | null
          scores: Json
          submitted_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evaluator_id: string
          id?: string
          interview_id: string
          notes?: string | null
          overall_rating?: number | null
          recommendation?: string | null
          scores: Json
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evaluator_id?: string
          id?: string
          interview_id?: string
          notes?: string | null
          overall_rating?: number | null
          recommendation?: string | null
          scores?: Json
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      exit_interviews: {
        Row: {
          company_culture_rating: number | null
          conducted_at: string
          conducted_by: string | null
          created_at: string
          employee_id: string
          feedback_json: Json | null
          id: string
          is_anonymous: boolean
          job_satisfaction_rating: number | null
          manager_relationship_rating: number | null
          reason_for_leaving: string | null
          tenant_id: string
          updated_at: string
          would_recommend: boolean | null
        }
        Insert: {
          company_culture_rating?: number | null
          conducted_at?: string
          conducted_by?: string | null
          created_at?: string
          employee_id: string
          feedback_json?: Json | null
          id?: string
          is_anonymous?: boolean
          job_satisfaction_rating?: number | null
          manager_relationship_rating?: number | null
          reason_for_leaving?: string | null
          tenant_id: string
          updated_at?: string
          would_recommend?: boolean | null
        }
        Update: {
          company_culture_rating?: number | null
          conducted_at?: string
          conducted_by?: string | null
          created_at?: string
          employee_id?: string
          feedback_json?: Json | null
          id?: string
          is_anonymous?: boolean
          job_satisfaction_rating?: number | null
          manager_relationship_rating?: number | null
          reason_for_leaving?: string | null
          tenant_id?: string
          updated_at?: string
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "exit_interviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      features: {
        Row: {
          created_at: string
          default_enabled: boolean
          description: string | null
          group_id: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          group_id: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          group_id?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "features_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "feature_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_key_results: {
        Row: {
          created_at: string
          current_value: number | null
          goal_id: string
          id: string
          label: string
          status: string
          target_value: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          goal_id: string
          id?: string
          label: string
          status?: string
          target_value?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_value?: number | null
          goal_id?: string
          id?: string
          label?: string
          status?: string
          target_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_key_results_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_updates: {
        Row: {
          author_id: string
          body: string
          created_at: string
          goal_id: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          goal_id: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          goal_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_updates_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          employee_id: string
          id: string
          progress_pct: number
          status: string
          tenant_id: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          employee_id: string
          id?: string
          progress_pct?: number
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          employee_id?: string
          id?: string
          progress_pct?: number
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_calendars: {
        Row: {
          country: string | null
          created_at: string
          date: string
          id: string
          is_half_day: boolean
          name: string
          region: string | null
          tenant_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          date: string
          id?: string
          is_half_day?: boolean
          name: string
          region?: string | null
          tenant_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          date?: string
          id?: string
          is_half_day?: boolean
          name?: string
          region?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holiday_calendars_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          application_id: string
          created_at: string
          duration_minutes: number | null
          id: string
          interviewer_ids: Json
          location: string | null
          meeting_link: string | null
          notes: string | null
          scheduled_at: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          interviewer_ids: Json
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          scheduled_at: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          interviewer_ids?: Json
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          scheduled_at?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          budget: number | null
          channel: string
          created_at: string
          external_post_id: string | null
          id: string
          job_id: string
          posted_at: string | null
          spent: number | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          channel: string
          created_at?: string
          external_post_id?: string | null
          id?: string
          job_id: string
          posted_at?: string | null
          spent?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          channel?: string
          created_at?: string
          external_post_id?: string | null
          id?: string
          job_id?: string
          posted_at?: string | null
          spent?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          application_deadline: string | null
          approved_by: string | null
          benefits: Json | null
          created_at: string
          created_by: string
          department_id: string | null
          description: string
          employment_type: string | null
          id: string
          job_id: string
          location_id: string | null
          published_at: string | null
          requirements: Json | null
          salary_currency: string | null
          salary_hidden: boolean
          salary_max: number | null
          salary_min: number | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
          work_location: string | null
        }
        Insert: {
          application_deadline?: string | null
          approved_by?: string | null
          benefits?: Json | null
          created_at?: string
          created_by: string
          department_id?: string | null
          description: string
          employment_type?: string | null
          id?: string
          job_id: string
          location_id?: string | null
          published_at?: string | null
          requirements?: Json | null
          salary_currency?: string | null
          salary_hidden?: boolean
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          work_location?: string | null
        }
        Update: {
          application_deadline?: string | null
          approved_by?: string | null
          benefits?: Json | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string
          employment_type?: string | null
          id?: string
          job_id?: string
          location_id?: string | null
          published_at?: string | null
          requirements?: Json | null
          salary_currency?: string | null
          salary_hidden?: boolean
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "jobs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["department_id_full"]
          },
          {
            foreignKeyName: "jobs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          balance_days: number
          created_at: string
          employee_id: string
          id: string
          leave_type_id: string
          notes: string | null
          period_end: string
          period_start: string
          tenant_id: string
          updated_at: string
          used_ytd: number
        }
        Insert: {
          balance_days?: number
          created_at?: string
          employee_id: string
          id?: string
          leave_type_id: string
          notes?: string | null
          period_end: string
          period_start: string
          tenant_id: string
          updated_at?: string
          used_ytd?: number
        }
        Update: {
          balance_days?: number
          created_at?: string
          employee_id?: string
          id?: string
          leave_type_id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          tenant_id?: string
          updated_at?: string
          used_ytd?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_request_audit: {
        Row: {
          action: string
          changed_by: string
          created_at: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          reason: string | null
          request_id: string
          tenant_id: string
        }
        Insert: {
          action: string
          changed_by: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          request_id: string
          tenant_id: string
        }
        Update: {
          action?: string
          changed_by?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          request_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_request_audit_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "leave_request_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_request_audit_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "team_leave_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_request_audit_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "time_off_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_request_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          allow_negative_balance: boolean
          code: string
          color: string | null
          created_at: string
          enforce_minimum_entitlement: boolean
          id: string
          is_active: boolean
          max_balance: number | null
          minimum_entitlement_days: number | null
          name: string
          requires_approval: boolean
          requires_certificate: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allow_negative_balance?: boolean
          code: string
          color?: string | null
          created_at?: string
          enforce_minimum_entitlement?: boolean
          id?: string
          is_active?: boolean
          max_balance?: number | null
          minimum_entitlement_days?: number | null
          name: string
          requires_approval?: boolean
          requires_certificate?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allow_negative_balance?: boolean
          code?: string
          color?: string | null
          created_at?: string
          enforce_minimum_entitlement?: boolean
          id?: string
          is_active?: boolean
          max_balance?: number | null
          minimum_entitlement_days?: number | null
          name?: string
          requires_approval?: boolean
          requires_certificate?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_id: string | null
          author_type: Database["public"]["Enums"]["message_author_type"]
          content: Json
          conversation_id: string
          created_at: string
          id: string
          tenant_id: string
        }
        Insert: {
          author_id?: string | null
          author_type: Database["public"]["Enums"]["message_author_type"]
          content: Json
          conversation_id: string
          created_at?: string
          id?: string
          tenant_id: string
        }
        Update: {
          author_id?: string | null
          author_type?: Database["public"]["Enums"]["message_author_type"]
          content?: Json
          conversation_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      office_locations: {
        Row: {
          address: Json | null
          created_at: string
          id: string
          name: string
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: Json | null
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: Json | null
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_balances: {
        Row: {
          carry_over_hours: number
          created_at: string
          id: string
          overtime_hours: number
          overtime_multiplier: number
          period: string
          regular_hours: number
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          carry_over_hours?: number
          created_at?: string
          id?: string
          overtime_hours?: number
          overtime_multiplier?: number
          period: string
          regular_hours?: number
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          carry_over_hours?: number
          created_at?: string
          id?: string
          overtime_hours?: number
          overtime_multiplier?: number
          period?: string
          regular_hours?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_requests: {
        Row: {
          approver_user_id: string | null
          created_at: string
          decided_at: string | null
          denial_reason: string | null
          end_date: string
          estimated_hours: number
          id: string
          reason: string
          start_date: string
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approver_user_id?: string | null
          created_at?: string
          decided_at?: string | null
          denial_reason?: string | null
          end_date: string
          estimated_hours: number
          id?: string
          reason: string
          start_date: string
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approver_user_id?: string | null
          created_at?: string
          decided_at?: string | null
          denial_reason?: string | null
          end_date?: string
          estimated_hours?: number
          id?: string
          reason?: string
          start_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_rules: {
        Row: {
          created_at: string
          daily_multiplier: number
          daily_threshold: number
          id: string
          is_default: boolean
          name: string
          tenant_id: string
          updated_at: string
          weekly_multiplier: number
          weekly_threshold: number
        }
        Insert: {
          created_at?: string
          daily_multiplier?: number
          daily_threshold?: number
          id?: string
          is_default?: boolean
          name: string
          tenant_id: string
          updated_at?: string
          weekly_multiplier?: number
          weekly_threshold?: number
        }
        Update: {
          created_at?: string
          daily_multiplier?: number
          daily_threshold?: number
          id?: string
          is_default?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
          weekly_multiplier?: number
          weekly_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "overtime_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          key: string
        }
        Insert: {
          key: string
        }
        Update: {
          key?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          auto_action: Json | null
          created_at: string
          id: string
          job_id: string
          name: string
          order_index: number
          stage_type: string
          updated_at: string
        }
        Insert: {
          auto_action?: Json | null
          created_at?: string
          id?: string
          job_id: string
          name: string
          order_index: number
          stage_type: string
          updated_at?: string
        }
        Update: {
          auto_action?: Json | null
          created_at?: string
          id?: string
          job_id?: string
          name?: string
          order_index?: number
          stage_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          pto_balance_days: number
          sick_balance_days: number
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          pto_balance_days?: number
          sick_balance_days?: number
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          pto_balance_days?: number
          sick_balance_days?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          permission_key?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      superadmins: {
        Row: {
          granted_at: string
          granted_by: string | null
          notes: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          notes?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      talent_pool: {
        Row: {
          added_at: string
          added_by: string | null
          candidate_id: string
          created_at: string
          engagement_score: number | null
          id: string
          last_contact_at: string | null
          notes: string | null
          tags: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          candidate_id: string
          created_at?: string
          engagement_score?: number | null
          id?: string
          last_contact_at?: string | null
          notes?: string | null
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          candidate_id?: string
          created_at?: string
          engagement_score?: number | null
          id?: string
          last_contact_at?: string | null
          notes?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_pool_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_pool_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          employee_id: string
          joined_at: string
          team_id: string
        }
        Insert: {
          employee_id: string
          joined_at?: string
          team_id: string
        }
        Update: {
          employee_id?: string
          joined_at?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          name: string
          office_location_id: string | null
          team_lead_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name: string
          office_location_id?: string | null
          team_lead_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name?: string
          office_location_id?: string | null
          team_lead_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "teams_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["department_id_full"]
          },
          {
            foreignKeyName: "teams_office_location_id_fkey"
            columns: ["office_location_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_office_location_id_fkey"
            columns: ["office_location_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "teams_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "teams_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "teams_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "teams_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "teams_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          feature_id: string
          id: string
          notes: string | null
          reason: string | null
          tenant_id: string
          toggled_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled: boolean
          feature_id: string
          id?: string
          notes?: string | null
          reason?: string | null
          tenant_id: string
          toggled_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_id?: string
          id?: string
          notes?: string | null
          reason?: string | null
          tenant_id?: string
          toggled_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_flags_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_feature_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          activated_at: string | null
          company_name: string | null
          company_size: string | null
          created_at: string
          id: string
          language: string | null
          name: string
          onboarding_step: number
          setup_completed: boolean
        }
        Insert: {
          activated_at?: string | null
          company_name?: string | null
          company_size?: string | null
          created_at?: string
          id?: string
          language?: string | null
          name: string
          onboarding_step?: number
          setup_completed?: boolean
        }
        Update: {
          activated_at?: string | null
          company_name?: string | null
          company_size?: string | null
          created_at?: string
          id?: string
          language?: string | null
          name?: string
          onboarding_step?: number
          setup_completed?: boolean
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          approval_status: string
          approved_at: string | null
          approver_user_id: string | null
          break_minutes: number
          clock_in_at: string
          clock_out_at: string | null
          created_at: string
          duration_minutes: number | null
          edited_by: string | null
          entry_type: string
          id: string
          location: Json | null
          notes: string | null
          project_task: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approver_user_id?: string | null
          break_minutes?: number
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          edited_by?: string | null
          entry_type?: string
          id?: string
          location?: Json | null
          notes?: string | null
          project_task?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approver_user_id?: string | null
          break_minutes?: number
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          edited_by?: string | null
          entry_type?: string
          id?: string
          location?: Json | null
          notes?: string | null
          project_task?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_audit: {
        Row: {
          change_reason: string | null
          changed_by: string
          created_at: string
          field_name: string
          id: string
          new_value: Json | null
          old_value: Json | null
          time_entry_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_by: string
          created_at?: string
          field_name: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          time_entry_id: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string
          created_at?: string
          field_name?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_audit_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "pending_time_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_audit_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_audit_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entry_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off_requests: {
        Row: {
          approver_user_id: string | null
          attachment_path: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          days_count: number | null
          decided_at: string | null
          denial_reason: string | null
          end_date: string
          half_day_end: boolean | null
          half_day_start: boolean | null
          id: string
          leave_type: string
          leave_type_id: string | null
          note: string | null
          start_date: string
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approver_user_id?: string | null
          attachment_path?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          days_count?: number | null
          decided_at?: string | null
          denial_reason?: string | null
          end_date: string
          half_day_end?: boolean | null
          half_day_start?: boolean | null
          id?: string
          leave_type: string
          leave_type_id?: string | null
          note?: string | null
          start_date: string
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approver_user_id?: string | null
          attachment_path?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          days_count?: number | null
          decided_at?: string | null
          denial_reason?: string | null
          end_date?: string
          half_day_end?: boolean | null
          half_day_start?: boolean | null
          id?: string
          leave_type?: string
          leave_type_id?: string | null
          note?: string | null
          start_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_action_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          metadata: Json | null
          node_id: string | null
          resume_at: string
          run_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          metadata?: Json | null
          node_id?: string | null
          resume_at: string
          run_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          metadata?: Json | null
          node_id?: string | null
          resume_at?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_action_queue_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_action_queue_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_edges: {
        Row: {
          condition: Json | null
          created_at: string
          id: string
          position: number
          source_node_id: string
          target_node_id: string
          version_id: string
        }
        Insert: {
          condition?: Json | null
          created_at?: string
          id?: string
          position?: number
          source_node_id: string
          target_node_id: string
          version_id: string
        }
        Update: {
          condition?: Json | null
          created_at?: string
          id?: string
          position?: number
          source_node_id?: string
          target_node_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_edges_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          payload: Json | null
          run_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          run_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_nodes: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          label: string | null
          node_key: string
          type: string
          ui_position: Json | null
          version_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          label?: string | null
          node_key: string
          type: string
          ui_position?: Json | null
          version_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          label?: string | null
          node_key?: string
          type?: string
          ui_position?: Json | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_nodes_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_run_steps: {
        Row: {
          assigned_to: Json | null
          completed_at: string | null
          due_at: string | null
          error: string | null
          id: string
          node_id: string
          payload: Json | null
          result: Json | null
          run_id: string
          started_at: string | null
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          assigned_to?: Json | null
          completed_at?: string | null
          due_at?: string | null
          error?: string | null
          id?: string
          node_id: string
          payload?: Json | null
          result?: Json | null
          run_id: string
          started_at?: string | null
          status?: string
          task_type?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: Json | null
          completed_at?: string | null
          due_at?: string | null
          error?: string | null
          id?: string
          node_id?: string
          payload?: Json | null
          result?: Json | null
          run_id?: string
          started_at?: string | null
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_run_steps_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          canceled_at: string | null
          completed_at: string | null
          context: Json | null
          created_at: string
          employee_id: string | null
          failed_at: string | null
          id: string
          last_error: string | null
          started_at: string | null
          status: string
          tenant_id: string
          trigger_source: string | null
          version_id: string
          workflow_id: string
        }
        Insert: {
          canceled_at?: string | null
          completed_at?: string | null
          context?: Json | null
          created_at?: string
          employee_id?: string | null
          failed_at?: string | null
          id?: string
          last_error?: string | null
          started_at?: string | null
          status?: string
          tenant_id: string
          trigger_source?: string | null
          version_id: string
          workflow_id: string
        }
        Update: {
          canceled_at?: string | null
          completed_at?: string | null
          context?: Json | null
          created_at?: string
          employee_id?: string | null
          failed_at?: string | null
          id?: string
          last_error?: string | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          trigger_source?: string | null
          version_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "workflow_runs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "workflow_runs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "workflow_runs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "workflow_runs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "workflow_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          blocks: Json
          created_at: string
          description: string | null
          id: string
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          blocks: Json
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          name: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      workflow_versions: {
        Row: {
          created_at: string
          created_by: string | null
          definition: Json
          id: string
          is_active: boolean
          published_at: string | null
          version_number: number
          workflow_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition: Json
          id?: string
          is_active?: boolean
          published_at?: string | null
          version_number: number
          workflow_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          id?: string
          is_active?: boolean
          published_at?: string | null
          version_number?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_versions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          active_version_id: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          slug: string
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_version_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          name: string
          slug: string
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_version_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          slug?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflows_active_version_fk"
            columns: ["active_version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      access_grants_summary: {
        Row: {
          created_at: string | null
          employee_email: string | null
          employee_id: string | null
          employee_name: string | null
          employee_number: string | null
          granted_at: string | null
          granted_by: string | null
          granted_by_name: string | null
          id: string | null
          is_active: boolean | null
          notes: string | null
          revoked_at: string | null
          revoked_by: string | null
          revoked_by_name: string | null
          system_name: string | null
          system_type: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "access_grants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_request_summary: {
        Row: {
          approver_user_id: string | null
          attachments: Json | null
          category: string | null
          created_at: string | null
          decided_at: string | null
          decision_reason: string | null
          department_name: string | null
          details: Json | null
          id: string | null
          justification: string | null
          needed_by: string | null
          requested_at: string | null
          requested_by_employee_id: string | null
          requested_by_user_id: string | null
          requestor_job_title: string | null
          requestor_name: string | null
          status: string | null
          summary: string | null
          tenant_id: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "approval_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      department_hierarchy: {
        Row: {
          cost_center: string | null
          description: string | null
          employee_count: number | null
          full_path: string | null
          head_email: string | null
          head_employee_id: string | null
          head_name: string | null
          id: string | null
          level: number | null
          name: string | null
          office_location_id: string | null
          office_location_name: string | null
          office_location_timezone: string | null
          parent_id: string | null
          path: string[] | null
          tenant_id: string | null
        }
        Relationships: []
      }
      employee_goal_summaries: {
        Row: {
          active_goals: number | null
          avg_progress_pct: number | null
          completed_goals: number | null
          employee_id: string | null
          last_check_in_at: string | null
          tenant_id: string | null
          total_goals: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_summary: {
        Row: {
          created_at: string | null
          department_id: string | null
          department_name: string | null
          email: string | null
          employee_number: string | null
          id: string | null
          job_title: string | null
          manager_id: string | null
          manager_name: string | null
          name: string | null
          profile_completion_pct: number | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employees_public: {
        Row: {
          bank_account_encrypted: string | null
          created_at: string | null
          custom_fields: Json | null
          date_of_birth: string | null
          department_id: string | null
          dotted_line_manager_id: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_number: string | null
          employment_type: string | null
          end_date: string | null
          home_address: Json | null
          id: string | null
          job_title: string | null
          manager_id: string | null
          name: string | null
          nationality: string | null
          office_location_id: string | null
          phone_personal: string | null
          phone_work: string | null
          profile_completion_pct: number | null
          salary_amount: number | null
          salary_currency: string | null
          salary_frequency: string | null
          sensitive_data_flags: Json | null
          start_date: string | null
          status: string | null
          tax_id_encrypted: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
          work_location: string | null
        }
        Insert: {
          bank_account_encrypted?: never
          created_at?: string | null
          custom_fields?: Json | null
          date_of_birth?: string | null
          department_id?: string | null
          dotted_line_manager_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_number?: string | null
          employment_type?: string | null
          end_date?: string | null
          home_address?: Json | null
          id?: string | null
          job_title?: string | null
          manager_id?: string | null
          name?: string | null
          nationality?: string | null
          office_location_id?: string | null
          phone_personal?: string | null
          phone_work?: string | null
          profile_completion_pct?: number | null
          salary_amount?: never
          salary_currency?: never
          salary_frequency?: never
          sensitive_data_flags?: Json | null
          start_date?: string | null
          status?: string | null
          tax_id_encrypted?: never
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          work_location?: string | null
        }
        Update: {
          bank_account_encrypted?: never
          created_at?: string | null
          custom_fields?: Json | null
          date_of_birth?: string | null
          department_id?: string | null
          dotted_line_manager_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_number?: string | null
          employment_type?: string | null
          end_date?: string | null
          home_address?: Json | null
          id?: string | null
          job_title?: string | null
          manager_id?: string | null
          name?: string | null
          nationality?: string | null
          office_location_id?: string | null
          phone_personal?: string | null
          phone_work?: string | null
          profile_completion_pct?: number | null
          salary_amount?: never
          salary_currency?: never
          salary_frequency?: never
          sensitive_data_flags?: Json | null
          start_date?: string | null
          status?: string | null
          tax_id_encrypted?: never
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "employees_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["department_id_full"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "employees_office_location_fk"
            columns: ["office_location_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_office_location_fk"
            columns: ["office_location_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_summary: {
        Row: {
          assigned_at: string | null
          brand: string | null
          created_at: string | null
          employee_email: string | null
          employee_id: string | null
          employee_name: string | null
          employee_number: string | null
          id: string | null
          model: string | null
          notes: string | null
          returned_at: string | null
          serial_number: string | null
          status: string | null
          tenant_id: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "equipment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "equipment_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exit_interview_summary: {
        Row: {
          company_culture_rating: number | null
          conducted_at: string | null
          conducted_by: string | null
          conducted_by_name: string | null
          created_at: string | null
          employee_email: string | null
          employee_id: string | null
          employee_name: string | null
          employee_number: string | null
          feedback_json: Json | null
          id: string | null
          is_anonymous: boolean | null
          job_satisfaction_rating: number | null
          manager_relationship_rating: number | null
          reason_for_leaving: string | null
          tenant_id: string | null
          updated_at: string | null
          would_recommend: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "exit_interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "exit_interviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balance_forecast: {
        Row: {
          approved_days_pending: number | null
          current_balance: number | null
          days_until_period_end: number | null
          employee_email: string | null
          employee_id: string | null
          employee_name: string | null
          leave_type_code: string | null
          leave_type_id: string | null
          leave_type_name: string | null
          pending_days_requested: number | null
          period_end: string | null
          projected_balance: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balance_summary: {
        Row: {
          allow_negative_balance: boolean | null
          balance_days: number | null
          created_at: string | null
          employee_email: string | null
          employee_id: string | null
          employee_name: string | null
          employee_number: string | null
          id: string | null
          leave_type_code: string | null
          leave_type_color: string | null
          leave_type_id: string | null
          leave_type_name: string | null
          notes: string | null
          period_end: string | null
          period_start: string | null
          remaining_balance: number | null
          requires_approval: boolean | null
          requires_certificate: boolean | null
          tenant_id: string | null
          updated_at: string | null
          used_ytd: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_request_summary: {
        Row: {
          approver_name: string | null
          approver_user_id: string | null
          attachment_path: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_name: string | null
          created_at: string | null
          days_count: number | null
          decided_at: string | null
          denial_reason: string | null
          employee_email: string | null
          employee_name: string | null
          employee_number: string | null
          end_date: string | null
          half_day_end: boolean | null
          half_day_start: boolean | null
          id: string | null
          leave_type: string | null
          leave_type_color: string | null
          leave_type_name: string | null
          note: string | null
          requires_certificate: boolean | null
          start_date: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_trends_monthly: {
        Row: {
          avg_days_per_request: number | null
          employee_count: number | null
          leave_type_code: string | null
          leave_type_id: string | null
          leave_type_name: string | null
          max_days: number | null
          min_days: number | null
          month: string | null
          request_count: number | null
          tenant_id: string | null
          total_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_utilization_summary: {
        Row: {
          balance_at_period_start: number | null
          days_taken: number | null
          department_id: string | null
          department_name: string | null
          employee_email: string | null
          employee_id: string | null
          employee_name: string | null
          leave_type_code: string | null
          leave_type_id: string | null
          leave_type_name: string | null
          period_month: string | null
          period_year: string | null
          request_count: number | null
          tenant_id: string | null
          used_ytd_total: number | null
          utilization_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "employees_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["department_id_full"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      org_structure_view: {
        Row: {
          cost_center: string | null
          department_head_id: string | null
          department_id: string | null
          department_id_full: string | null
          department_location_id: string | null
          department_name: string | null
          department_parent_id: string | null
          dotted_line_manager_email: string | null
          dotted_line_manager_employee_id: string | null
          dotted_line_manager_id: string | null
          dotted_line_manager_job_title: string | null
          dotted_line_manager_name: string | null
          email: string | null
          employee_id: string | null
          employee_name: string | null
          employee_number: string | null
          job_title: string | null
          location_address: Json | null
          location_id: string | null
          location_name: string | null
          location_timezone: string | null
          manager_email: string | null
          manager_employee_id: string | null
          manager_id: string | null
          manager_job_title: string | null
          manager_name: string | null
          office_location_id: string | null
          status: string | null
          teams: Json | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["department_head_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["department_head_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["department_head_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["department_head_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["department_head_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["department_head_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["department_head_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["department_head_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "departments_office_location_id_fkey"
            columns: ["department_location_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_office_location_id_fkey"
            columns: ["department_location_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["department_parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["department_parent_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["department_parent_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["department_id_full"]
          },
          {
            foreignKeyName: "employees_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "employees_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["department_id_full"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_dotted_line_manager_id_fkey"
            columns: ["dotted_line_manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "employees_office_location_fk"
            columns: ["office_location_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_office_location_fk"
            columns: ["office_location_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_requests_summary: {
        Row: {
          approver_email: string | null
          approver_name: string | null
          approver_user_id: string | null
          created_at: string | null
          decided_at: string | null
          denial_reason: string | null
          employee_email: string | null
          employee_name: string | null
          end_date: string | null
          estimated_hours: number | null
          id: string | null
          reason: string | null
          start_date: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "overtime_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_time_approvals: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approver_name: string | null
          approver_user_id: string | null
          break_minutes: number | null
          clock_in_at: string | null
          clock_out_at: string | null
          created_at: string | null
          duration_minutes: number | null
          edited_by: string | null
          editor_name: string | null
          employee_email: string | null
          employee_name: string | null
          employee_number: string | null
          entry_type: string | null
          id: string | null
          manager_email: string | null
          manager_id: string | null
          manager_name: string | null
          net_minutes: number | null
          notes: string | null
          project_task: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "time_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_leave_calendar: {
        Row: {
          approver_name: string | null
          approver_user_id: string | null
          attachment_path: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_name: string | null
          created_at: string | null
          days_count: number | null
          decided_at: string | null
          denial_reason: string | null
          employee_email: string | null
          employee_name: string | null
          employee_number: string | null
          end_date: string | null
          half_day_end: boolean | null
          half_day_start: boolean | null
          id: string | null
          leave_type: string | null
          leave_type_color: string | null
          leave_type_name: string | null
          manager_email: string | null
          manager_id: string | null
          manager_name: string | null
          note: string | null
          requires_certificate: boolean | null
          start_date: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_goal_summaries"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["dotted_line_manager_employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "org_structure_view"
            referencedColumns: ["manager_employee_id"]
          },
          {
            foreignKeyName: "time_off_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_summary: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approver_name: string | null
          approver_user_id: string | null
          break_minutes: number | null
          clock_in_at: string | null
          clock_out_at: string | null
          created_at: string | null
          duration_minutes: number | null
          edited_by: string | null
          editor_name: string | null
          employee_email: string | null
          employee_name: string | null
          employee_number: string | null
          entry_type: string | null
          id: string | null
          net_minutes: number | null
          notes: string | null
          project_task: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      app_create_tenant: {
        Args: { p_name: string }
        Returns: {
          activated_at: string | null
          company_name: string | null
          company_size: string | null
          created_at: string
          id: string
          language: string | null
          name: string
          onboarding_step: number
          setup_completed: boolean
        }
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      app_current_user_id: { Args: never; Returns: string }
      app_get_manager_employee_ids: {
        Args: { p_tenant_id: string }
        Returns: string[]
      }
      app_get_tenant_features: {
        Args: { p_tenant: string }
        Returns: {
          default_enabled: boolean
          description: string
          enabled: boolean
          feature_id: string
          group_key: string
          group_name: string
          name: string
          slug: string
          source: string
        }[]
      }
      app_get_user_employee_id: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      app_has_permission: {
        Args: { permission: string; tenant: string }
        Returns: boolean
      }
      app_is_employee_manager: {
        Args: { p_employee_id: string; p_tenant_id: string }
        Returns: boolean
      }
      calculate_profile_completion: {
        Args: { employee_row: Database["public"]["Tables"]["employees"]["Row"] }
        Returns: number
      }
      calculate_working_days: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: number
      }
      check_blackout_periods: {
        Args: {
          p_department_id?: string
          p_end_date: string
          p_leave_type_id?: string
          p_start_date: string
          p_tenant_id: string
        }
        Returns: Json
      }
      check_leave_balance: {
        Args: {
          p_check_minimum_entitlement?: boolean
          p_days_requested: number
          p_employee_id: string
          p_leave_type_id: string
        }
        Returns: Json
      }
      check_time_entry_overlap: {
        Args: {
          p_end_time: string
          p_exclude_id?: string
          p_start_time: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      check_unused_leave_alert: {
        Args: { p_days_before_period_end?: number; p_tenant_id?: string }
        Returns: {
          current_balance: number
          days_to_use: number
          days_until_period_end: number
          employee_email: string
          employee_id: string
          employee_name: string
          leave_type_id: string
          leave_type_name: string
          minimum_entitlement: number
          period_end: string
        }[]
      }
      create_default_pipeline_stages: {
        Args: { job_uuid: string }
        Returns: undefined
      }
      create_leave_request_audit: {
        Args: {
          p_action: string
          p_changed_by: string
          p_ip_address?: string
          p_new_values?: Json
          p_old_values?: Json
          p_reason?: string
          p_request_id: string
        }
        Returns: string
      }
      create_time_entry_audit: {
        Args: {
          p_change_reason?: string
          p_changed_by: string
          p_field_name: string
          p_new_value: Json
          p_old_value: Json
          p_time_entry_id: string
        }
        Returns: string
      }
      generate_employee_number: { Args: never; Returns: string }
      generate_job_id: { Args: { tenant_uuid: string }; Returns: string }
      requires_time_entry_approval: {
        Args: { entry_date: string; entry_type: string; user_id: string }
        Returns: boolean
      }
      validate_leave_request_compliance: {
        Args: {
          p_days_requested: number
          p_department_id?: string
          p_employee_id: string
          p_end_date: string
          p_leave_type_id: string
          p_start_date: string
          p_tenant_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "employee" | "people_ops"
      conversation_status: "open" | "closed" | "archived"
      message_author_type: "user" | "assistant" | "tool"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          format: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          format?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          level: number | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      prefixes: {
        Row: {
          bucket_id: string
          created_at: string | null
          level: number
          name: string
          updated_at: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string | null
          level?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string | null
          level?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prefixes_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_prefixes: {
        Args: { _bucket_id: string; _name: string }
        Returns: undefined
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      delete_leaf_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      delete_prefix: {
        Args: { _bucket_id: string; _name: string }
        Returns: boolean
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_level: { Args: { name: string }; Returns: number }
      get_prefix: { Args: { name: string }; Returns: string }
      get_prefixes: { Args: { name: string }; Returns: string[] }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          start_after?: string
        }
        Returns: {
          id: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      lock_top_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_legacy_v1: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v1_optimised: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS"
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
  auth: {
    Enums: {
      aal_level: ["aal1", "aal2", "aal3"],
      code_challenge_method: ["s256", "plain"],
      factor_status: ["unverified", "verified"],
      factor_type: ["totp", "webauthn", "phone"],
      oauth_authorization_status: ["pending", "approved", "denied", "expired"],
      oauth_client_type: ["public", "confidential"],
      oauth_registration_type: ["dynamic", "manual"],
      oauth_response_type: ["code"],
      one_time_token_type: [
        "confirmation_token",
        "reauthentication_token",
        "recovery_token",
        "email_change_token_new",
        "email_change_token_current",
        "phone_change_token",
      ],
    },
  },
  public: {
    Enums: {
      app_role: ["owner", "admin", "manager", "employee", "people_ops"],
      conversation_status: ["open", "closed", "archived"],
      message_author_type: ["user", "assistant", "tool"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS"],
    },
  },
} as const

