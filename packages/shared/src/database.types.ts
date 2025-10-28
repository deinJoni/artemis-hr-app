export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
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
            referencedRelation: "employees"
            referencedColumns: ["id"]
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
          description: string | null
          employee_id: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          storage_path: string
          tenant_id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          description?: string | null
          employee_id: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          storage_path: string
          tenant_id: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          description?: string | null
          employee_id?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          storage_path?: string
          tenant_id?: string
          uploaded_at?: string
          uploaded_by?: string
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
            referencedRelation: "employees"
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
      employees: {
        Row: {
          created_at: string
          custom_fields: Json | null
          email: string
          id: string
          manager_id: string | null
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          custom_fields?: Json | null
          email: string
          id?: string
          manager_id?: string | null
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          custom_fields?: Json | null
          email?: string
          id?: string
          manager_id?: string | null
          name?: string
          tenant_id?: string
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
            referencedRelation: "employees"
            referencedColumns: ["id"]
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
            referencedRelation: "employees"
            referencedColumns: ["id"]
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
      tenants: {
        Row: {
          activated_at: string | null
          company_location: string | null
          company_name: string | null
          company_size: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          key_priorities: string | null
          name: string
          needs_summary: string | null
          onboarding_step: number
          setup_completed: boolean
        }
        Insert: {
          activated_at?: string | null
          company_location?: string | null
          company_name?: string | null
          company_size?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          key_priorities?: string | null
          name: string
          needs_summary?: string | null
          onboarding_step?: number
          setup_completed?: boolean
        }
        Update: {
          activated_at?: string | null
          company_location?: string | null
          company_name?: string | null
          company_size?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          key_priorities?: string | null
          name?: string
          needs_summary?: string | null
          onboarding_step?: number
          setup_completed?: boolean
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          clock_in_at: string
          clock_out_at: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          location: Json | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          location?: Json | null
          tenant_id: string
          user_id: string
        }
        Update: {
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          location?: Json | null
          tenant_id?: string
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
      time_off_requests: {
        Row: {
          approver_user_id: string | null
          created_at: string
          decided_at: string | null
          end_date: string
          id: string
          leave_type: string
          note: string | null
          start_date: string
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          approver_user_id?: string | null
          created_at?: string
          decided_at?: string | null
          end_date: string
          id?: string
          leave_type: string
          note?: string | null
          start_date: string
          status?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          approver_user_id?: string | null
          created_at?: string
          decided_at?: string | null
          end_date?: string
          id?: string
          leave_type?: string
          note?: string | null
          start_date?: string
          status?: string
          tenant_id?: string
          user_id?: string
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
            referencedRelation: "employees"
            referencedColumns: ["id"]
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
    }
    Functions: {
      app_create_tenant: {
        Args: { p_name: string }
        Returns: {
          activated_at: string | null
          company_location: string | null
          company_name: string | null
          company_size: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          key_priorities: string | null
          name: string
          needs_summary: string | null
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
      app_has_permission: {
        Args: { permission: string; tenant: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "employee" | "people_ops"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["owner", "admin", "manager", "employee", "people_ops"],
    },
  },
} as const

