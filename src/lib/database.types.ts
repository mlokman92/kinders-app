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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          center_id: number
          created_at: string
          description: string | null
          id: number
          instructions: string[]
          materials: string[]
          title: string
        }
        Insert: {
          center_id: number
          created_at?: string
          description?: string | null
          id?: never
          instructions?: string[]
          materials?: string[]
          title: string
        }
        Update: {
          center_id?: number
          created_at?: string
          description?: string | null
          id?: never
          instructions?: string[]
          materials?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_skills: {
        Row: {
          activity_id: number
          id: number
          skill_id: number
        }
        Insert: {
          activity_id: number
          id?: never
          skill_id: number
        }
        Update: {
          activity_id?: number
          id?: never
          skill_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_skills_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "learning_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_domains: {
        Row: {
          code: string | null
          id: number
          section_id: number
          sort: number
          title: string
        }
        Insert: {
          code?: string | null
          id?: never
          section_id: number
          sort?: number
          title: string
        }
        Update: {
          code?: string | null
          id?: never
          section_id?: number
          sort?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_domains_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "assessment_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_frameworks: {
        Row: {
          code: string
          country: string
          description: string | null
          id: number
          max_age_months: number | null
          min_age_months: number | null
          name: string
          scoring_model: string
          sort: number
        }
        Insert: {
          code: string
          country?: string
          description?: string | null
          id?: never
          max_age_months?: number | null
          min_age_months?: number | null
          name: string
          scoring_model: string
          sort?: number
        }
        Update: {
          code?: string
          country?: string
          description?: string | null
          id?: never
          max_age_months?: number | null
          min_age_months?: number | null
          name?: string
          scoring_model?: string
          sort?: number
        }
        Relationships: []
      }
      assessment_item_levels: {
        Row: {
          descriptor: string
          id: number
          item_id: number
          label: string | null
          level: number
        }
        Insert: {
          descriptor: string
          id?: never
          item_id: number
          label?: string | null
          level: number
        }
        Update: {
          descriptor?: string
          id?: never
          item_id?: number
          label?: string | null
          level?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_item_levels_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "assessment_items"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_items: {
        Row: {
          code: string | null
          description: string | null
          domain_id: number
          id: number
          item_kind: string
          sort: number
          title: string
        }
        Insert: {
          code?: string | null
          description?: string | null
          domain_id: number
          id?: never
          item_kind: string
          sort?: number
          title: string
        }
        Update: {
          code?: string | null
          description?: string | null
          domain_id?: number
          id?: never
          item_kind?: string
          sort?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_items_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "assessment_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_sections: {
        Row: {
          code: string
          framework_id: number
          id: number
          max_age_months: number | null
          min_age_months: number | null
          sort: number
          subtitle: string | null
          title: string
        }
        Insert: {
          code: string
          framework_id: number
          id?: never
          max_age_months?: number | null
          min_age_months?: number | null
          sort?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          code?: string
          framework_id?: number
          id?: never
          max_age_months?: number | null
          min_age_months?: number | null
          sort?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sections_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "assessment_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: number
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: never
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: never
        }
        Relationships: []
      }
      branch_geofences: {
        Row: {
          accuracy_ceiling_m: number
          branch_id: number
          center_id: number
          enforce_geofence: boolean
          geofence_enabled: boolean
          geofence_radius_m: number
          latitude: number | null
          longitude: number | null
          updated_at: string
        }
        Insert: {
          accuracy_ceiling_m?: number
          branch_id: number
          center_id: number
          enforce_geofence?: boolean
          geofence_enabled?: boolean
          geofence_radius_m?: number
          latitude?: number | null
          longitude?: number | null
          updated_at?: string
        }
        Update: {
          accuracy_ceiling_m?: number
          branch_id?: number
          center_id?: number
          enforce_geofence?: boolean
          geofence_enabled?: boolean
          geofence_radius_m?: number
          latitude?: number | null
          longitude?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_geofences_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_geofences_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          center_id: number
          created_at: string
          id: number
          name: string
          phone: string | null
          timezone: string | null
        }
        Insert: {
          address?: string | null
          center_id: number
          created_at?: string
          id?: number
          name: string
          phone?: string | null
          timezone?: string | null
        }
        Update: {
          address?: string | null
          center_id?: number
          created_at?: string
          id?: number
          name?: string
          phone?: string | null
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      centers: {
        Row: {
          created_at: string
          description: string | null
          enrollment_required_fields: Json
          facebook: string | null
          id: number
          instagram: string | null
          logo_url: string | null
          name: string
          owner_id: string
          slug: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enrollment_required_fields?: Json
          facebook?: string | null
          id?: never
          instagram?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          slug?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enrollment_required_fields?: Json
          facebook?: string | null
          id?: never
          instagram?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          slug?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      classrooms: {
        Row: {
          branch_id: number
          center_id: number
          created_at: string
          id: number
          level_id: number | null
          name: string
        }
        Insert: {
          branch_id: number
          center_id: number
          created_at?: string
          id?: never
          level_id?: number | null
          name: string
        }
        Update: {
          branch_id?: number
          center_id?: number
          created_at?: string
          id?: never
          level_id?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classrooms_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classrooms_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          conversation_id: number | null
          created_at: string
          details: string | null
          id: number
          message_id: number | null
          reason: string | null
          reported_user_id: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          conversation_id?: number | null
          created_at?: string
          details?: string | null
          id?: never
          message_id?: number | null
          reason?: string | null
          reported_user_id?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          conversation_id?: number | null
          created_at?: string
          details?: string | null
          id?: never
          message_id?: number | null
          reason?: string | null
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: number
          created_at: string
          id: number
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: number
          created_at?: string
          id?: never
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: number
          created_at?: string
          id?: never
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          center_id: number | null
          created_at: string
          created_by: string
          id: number
          is_broadcast: boolean
          last_message_at: string
          title: string | null
        }
        Insert: {
          center_id?: number | null
          created_at?: string
          created_by: string
          id?: never
          is_broadcast?: boolean
          last_message_at?: string
          title?: string | null
        }
        Update: {
          center_id?: number | null
          created_at?: string
          created_by?: string
          id?: never
          is_broadcast?: boolean
          last_message_at?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_frameworks: {
        Row: {
          code: string
          country: string | null
          id: number
          name: string
          sort: number
        }
        Insert: {
          code: string
          country?: string | null
          id?: never
          name: string
          sort?: number
        }
        Update: {
          code?: string
          country?: string | null
          id?: never
          name?: string
          sort?: number
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: number
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      enrollment_applications: {
        Row: {
          center_id: number
          child_dob: string | null
          child_gender: string | null
          child_name: string
          child_nric: string | null
          created_at: string
          id: number
          note: string | null
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          reviewed_at: string | null
          status: string
          student_id: number | null
        }
        Insert: {
          center_id: number
          child_dob?: string | null
          child_gender?: string | null
          child_name: string
          child_nric?: string | null
          created_at?: string
          id?: never
          note?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          reviewed_at?: string | null
          status?: string
          student_id?: number | null
        }
        Update: {
          center_id?: number
          child_dob?: string | null
          child_gender?: string | null
          child_name?: string
          child_nric?: string | null
          created_at?: string
          id?: never
          note?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          reviewed_at?: string | null
          status?: string
          student_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_applications_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          classroom_id: number
          created_at: string
          days: string[]
          enrollment_date: string
          id: number
          status: string
          student_id: number
        }
        Insert: {
          classroom_id: number
          created_at?: string
          days?: string[]
          enrollment_date?: string
          id?: never
          status?: string
          student_id: number
        }
        Update: {
          classroom_id?: number
          created_at?: string
          days?: string[]
          enrollment_date?: string
          id?: never
          status?: string
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          center_id: number
          classroom_id: number
          client_token: string | null
          created_at: string
          data: Json
          entry_date: string
          id: number
          media: Json
          student_id: number
          type: string
        }
        Insert: {
          center_id: number
          classroom_id: number
          client_token?: string | null
          created_at?: string
          data?: Json
          entry_date?: string
          id?: never
          media?: Json
          student_id: number
          type: string
        }
        Update: {
          center_id?: number
          classroom_id?: number
          client_token?: string | null
          created_at?: string
          data?: Json
          entry_date?: string
          id?: never
          media?: Json
          student_id?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_activities: {
        Row: {
          activity_id: number
          entry_id: number
          id: number
        }
        Insert: {
          activity_id: number
          entry_id: number
          id?: never
        }
        Update: {
          activity_id?: number
          entry_id?: number
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "entry_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_activities_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          center_id: number
          created_at: string
          ends_on: string | null
          id: number
          name: string
          starts_on: string | null
          term: string | null
          year: number | null
        }
        Insert: {
          center_id: number
          created_at?: string
          ends_on?: string | null
          id?: never
          name: string
          starts_on?: string | null
          term?: string | null
          year?: number | null
        }
        Update: {
          center_id?: number
          created_at?: string
          ends_on?: string | null
          id?: never
          name?: string
          starts_on?: string | null
          term?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exams_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          created_at: string
          email: string | null
          id: number
          name: string | null
          phone: string | null
          relationship: string | null
          student_id: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: never
          name?: string | null
          phone?: string | null
          relationship?: string | null
          student_id: number
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: never
          name?: string | null
          phone?: string | null
          relationship?: string | null
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_audit: {
        Row: {
          created_at: string
          director_email: string | null
          director_id: string
          id: number
          ip: string | null
          mode: string
          origin: string | null
          target_email: string
          target_id: string | null
        }
        Insert: {
          created_at?: string
          director_email?: string | null
          director_id: string
          id?: never
          ip?: string | null
          mode?: string
          origin?: string | null
          target_email: string
          target_id?: string | null
        }
        Update: {
          created_at?: string
          director_email?: string | null
          director_id?: string
          id?: never
          ip?: string | null
          mode?: string
          origin?: string | null
          target_email?: string
          target_id?: string | null
        }
        Relationships: []
      }
      learning_areas: {
        Row: {
          area_name: string
          code: string
          framework_id: number
          id: number
          sort: number
          subarea_name: string | null
        }
        Insert: {
          area_name: string
          code: string
          framework_id: number
          id?: never
          sort?: number
          subarea_name?: string | null
        }
        Update: {
          area_name?: string
          code?: string
          framework_id?: number
          id?: never
          sort?: number
          subarea_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_areas_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "curriculum_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_skills: {
        Row: {
          area_id: number
          code: string
          id: number
          label: number
          name: string
          sort: number
        }
        Insert: {
          area_id: number
          code: string
          id?: never
          label: number
          name: string
          sort?: number
        }
        Update: {
          area_id?: number
          code?: string
          id?: never
          label?: number
          name?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_skills_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "learning_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          center_id: number
          created_at: string
          id: number
          max_age_months: number | null
          min_age_months: number | null
          name: string
          sort_order: number
        }
        Insert: {
          center_id: number
          created_at?: string
          id?: number
          max_age_months?: number | null
          min_age_months?: number | null
          name: string
          sort_order?: number
        }
        Update: {
          center_id?: number
          created_at?: string
          id?: number
          max_age_months?: number | null
          min_age_months?: number | null
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "levels_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: number
          created_at: string
          id: number
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: number
          created_at?: string
          id?: never
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: number
          created_at?: string
          id?: never
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          role?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          allowed: boolean
          capability: string
          center_id: number
          created_at: string
          id: number
          role: string
        }
        Insert: {
          allowed: boolean
          capability: string
          center_id: number
          created_at?: string
          id?: number
          role: string
        }
        Update: {
          allowed?: boolean
          capability?: string
          center_id?: number
          created_at?: string
          id?: number
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_items: {
        Row: {
          activity_id: number
          center_id: number
          classroom_id: number
          created_at: string
          date: string
          id: number
          sort_order: number
        }
        Insert: {
          activity_id: number
          center_id: number
          classroom_id: number
          created_at?: string
          date: string
          id?: never
          sort_order?: number
        }
        Update: {
          activity_id?: number
          center_id?: number
          classroom_id?: number
          created_at?: string
          date?: string
          id?: never
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance: {
        Row: {
          accepted_with_tolerance: boolean
          accuracy_m: number | null
          branch_id: number
          center_id: number
          created_at: string
          device_id: string | null
          distance_m: number | null
          id: number
          kind: string
          latitude: number | null
          location_unavailable: boolean
          longitude: number | null
          low_accuracy: boolean
          mocked: boolean
          needs_review: boolean
          profile_id: string | null
          recorded_at: string
          review_status: string
          source: string
          teacher_id: number | null
          within_geofence: boolean | null
        }
        Insert: {
          accepted_with_tolerance?: boolean
          accuracy_m?: number | null
          branch_id: number
          center_id: number
          created_at?: string
          device_id?: string | null
          distance_m?: number | null
          id?: never
          kind: string
          latitude?: number | null
          location_unavailable?: boolean
          longitude?: number | null
          low_accuracy?: boolean
          mocked?: boolean
          needs_review?: boolean
          profile_id?: string | null
          recorded_at?: string
          review_status?: string
          source?: string
          teacher_id?: number | null
          within_geofence?: boolean | null
        }
        Update: {
          accepted_with_tolerance?: boolean
          accuracy_m?: number | null
          branch_id?: number
          center_id?: number
          created_at?: string
          device_id?: string | null
          distance_m?: number | null
          id?: never
          kind?: string
          latitude?: number | null
          location_unavailable?: boolean
          longitude?: number | null
          low_accuracy?: boolean
          mocked?: boolean
          needs_review?: boolean
          profile_id?: string | null
          recorded_at?: string
          review_status?: string
          source?: string
          teacher_id?: number | null
          within_geofence?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance_consent: {
        Row: {
          acknowledged_at: string
          center_id: number
          id: number
          notice_version: number
          profile_id: string | null
          teacher_id: number | null
        }
        Insert: {
          acknowledged_at?: string
          center_id: number
          id?: never
          notice_version: number
          profile_id?: string | null
          teacher_id?: number | null
        }
        Update: {
          acknowledged_at?: string
          center_id?: number
          id?: never
          notice_version?: number
          profile_id?: string | null
          teacher_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_consent_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_consent_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_consent_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_branches: {
        Row: {
          branch_id: number
          created_at: string
          id: number
          teacher_id: number
        }
        Insert: {
          branch_id: number
          created_at?: string
          id?: number
          teacher_id: number
        }
        Update: {
          branch_id?: number
          created_at?: string
          id?: number
          teacher_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branches_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_role_assignments: {
        Row: {
          created_at: string
          id: number
          staff_role_id: number
          teacher_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          staff_role_id: number
          teacher_id: number
        }
        Update: {
          created_at?: string
          id?: number
          staff_role_id?: number
          teacher_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_role_assignments_staff_role_id_fkey"
            columns: ["staff_role_id"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_role_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          branch_id: number | null
          center_id: number
          created_at: string
          id: number
          level_id: number | null
          name: string
        }
        Insert: {
          branch_id?: number | null
          center_id: number
          created_at?: string
          id?: number
          level_id?: number | null
          name: string
        }
        Update: {
          branch_id?: number | null
          center_id?: number
          created_at?: string
          id?: number
          level_id?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_roles_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_roles_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      student_assessment_results: {
        Row: {
          achieved: boolean | null
          assessment_id: number
          id: number
          item_id: number
          level: number | null
          note: string | null
          observed_on: string | null
        }
        Insert: {
          achieved?: boolean | null
          assessment_id: number
          id?: never
          item_id: number
          level?: number | null
          note?: string | null
          observed_on?: string | null
        }
        Update: {
          achieved?: boolean | null
          assessment_id?: number
          id?: never
          item_id?: number
          level?: number | null
          note?: string | null
          observed_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_assessment_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "student_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_assessment_results_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "assessment_items"
            referencedColumns: ["id"]
          },
        ]
      }
      student_assessments: {
        Row: {
          assessed_by: string | null
          assessed_on: string
          center_id: number
          created_at: string
          exam_id: number | null
          framework_id: number
          id: number
          notes: string | null
          section_id: number | null
          status: string
          student_id: number
          updated_at: string
        }
        Insert: {
          assessed_by?: string | null
          assessed_on?: string
          center_id: number
          created_at?: string
          exam_id?: number | null
          framework_id: number
          id?: never
          notes?: string | null
          section_id?: number | null
          status?: string
          student_id: number
          updated_at?: string
        }
        Update: {
          assessed_by?: string | null
          assessed_on?: string
          center_id?: number
          created_at?: string
          exam_id?: number | null
          framework_id?: number
          id?: never
          notes?: string | null
          section_id?: number | null
          status?: string
          student_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_assessments_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_assessments_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_assessments_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_assessments_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "assessment_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_assessments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "assessment_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          branch_id: number
          center_id: number
          created_at: string
          dob: string | null
          gender: string | null
          id: number
          name: string
          nric: string | null
          profile_picture_url: string | null
        }
        Insert: {
          branch_id: number
          center_id: number
          created_at?: string
          dob?: string | null
          gender?: string | null
          id?: never
          name: string
          nric?: string | null
          profile_picture_url?: string | null
        }
        Update: {
          branch_id?: number
          center_id?: number
          created_at?: string
          dob?: string | null
          gender?: string | null
          id?: never
          name?: string
          nric?: string | null
          profile_picture_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          classroom_id: number
          created_at: string
          days: string[]
          id: number
          status: string
          teacher_id: number
        }
        Insert: {
          classroom_id: number
          created_at?: string
          days?: string[]
          id?: never
          status?: string
          teacher_id: number
        }
        Update: {
          classroom_id?: number
          created_at?: string
          days?: string[]
          id?: never
          status?: string
          teacher_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          center_id: number
          created_at: string
          dob: string | null
          email: string | null
          gender: string | null
          id: number
          is_admin: boolean
          is_teacher: boolean
          name: string
          phone: string | null
          profile_picture_url: string | null
        }
        Insert: {
          center_id: number
          created_at?: string
          dob?: string | null
          email?: string | null
          gender?: string | null
          id?: never
          is_admin?: boolean
          is_teacher?: boolean
          name: string
          phone?: string | null
          profile_picture_url?: string | null
        }
        Update: {
          center_id?: number
          created_at?: string
          dob?: string | null
          email?: string | null
          gender?: string | null
          id?: never
          is_admin?: boolean
          is_teacher?: boolean
          name?: string
          phone?: string | null
          profile_picture_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      staff_attendance_anomalies: {
        Row: {
          branch_id: number | null
          center_id: number | null
          id: number | null
          identical_coords: boolean | null
          impossible_travel: boolean | null
          kind: string | null
          needs_review: boolean | null
          profile_id: string | null
          recorded_at: string | null
          review_status: string | null
          shared_device: boolean | null
          teacher_id: number | null
          within_geofence: boolean | null
          zero_accuracy: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_activity: {
        Args: {
          p_description?: string
          p_instructions?: string[]
          p_materials?: string[]
          p_skill_ids?: number[]
          p_title: string
        }
        Returns: number
      }
      add_classroom: {
        Args: { p_branch_id?: number; p_name: string }
        Returns: number
      }
      add_entries: {
        Args: {
          p_activity_ids?: number[]
          p_classroom_id: number
          p_client_token?: string
          p_data: Json
          p_entry_date: string
          p_media: Json
          p_student_ids: number[]
          p_type: string
        }
        Returns: number
      }
      add_planned_activities: {
        Args: {
          p_activity_id: number
          p_classroom_id: number
          p_dates: string[]
        }
        Returns: number
      }
      add_student: {
        Args: {
          p_branch_id?: number
          p_dob: string
          p_enrollments: Json
          p_gender: string
          p_guardians: Json
          p_name: string
          p_nric?: string
          p_photo_url: string
        }
        Returns: number
      }
      add_teacher: {
        Args: {
          p_assignments: Json
          p_branch_ids?: number[]
          p_dob: string
          p_email: string
          p_gender: string
          p_is_admin?: boolean
          p_is_teacher?: boolean
          p_name: string
          p_phone: string
          p_photo_url: string
        }
        Returns: number
      }
      approve_enrollment_application: {
        Args: { p_classroom_id?: number; p_id: number }
        Returns: number
      }
      block_user: { Args: { p_other: string }; Returns: undefined }
      bulk_add_students: {
        Args: { p_branch_id?: number; p_rows: Json }
        Returns: Json
      }
      bulk_add_teachers: {
        Args: { p_branch_id?: number; p_rows: Json }
        Returns: Json
      }
      can_impersonate_email: { Args: { p_email: string }; Returns: boolean }
      check_in: {
        Args: {
          p_accuracy_m?: number
          p_branch_id: number
          p_device_id?: string
          p_lat: number
          p_lng: number
          p_mocked?: boolean
        }
        Returns: {
          accepted_with_tolerance: boolean
          accuracy_m: number | null
          branch_id: number
          center_id: number
          created_at: string
          device_id: string | null
          distance_m: number | null
          id: number
          kind: string
          latitude: number | null
          location_unavailable: boolean
          longitude: number | null
          low_accuracy: boolean
          mocked: boolean
          needs_review: boolean
          profile_id: string | null
          recorded_at: string
          review_status: string
          source: string
          teacher_id: number | null
          within_geofence: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "staff_attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_out: {
        Args: {
          p_accuracy_m?: number
          p_branch_id: number
          p_device_id?: string
          p_lat: number
          p_lng: number
          p_mocked?: boolean
        }
        Returns: {
          accepted_with_tolerance: boolean
          accuracy_m: number | null
          branch_id: number
          center_id: number
          created_at: string
          device_id: string | null
          distance_m: number | null
          id: number
          kind: string
          latitude: number | null
          location_unavailable: boolean
          longitude: number | null
          low_accuracy: boolean
          mocked: boolean
          needs_review: boolean
          profile_id: string | null
          recorded_at: string
          review_status: string
          source: string
          teacher_id: number | null
          within_geofence: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "staff_attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      conversation_header: {
        Args: { p_conversation_id: number }
        Returns: {
          is_broadcast: boolean
          other_name: string
          other_role: string
          other_user_id: string
        }[]
      }
      copy_schedule_week: {
        Args: {
          p_classroom_id: number
          p_from_monday: string
          p_to_monday: string
        }
        Returns: number
      }
      create_my_center: {
        Args: {
          p_center_name: string
          p_classroom_names: string[]
          p_full_name?: string
          p_phone?: string
        }
        Returns: number
      }
      current_push_webhook_secret: { Args: never; Returns: string }
      debug_scope_preview: { Args: { p_target: string }; Returns: Json }
      delete_device_token: { Args: { p_token: string }; Returns: undefined }
      delete_my_center: { Args: never; Returns: boolean }
      get_center_public: { Args: { p_slug: string }; Returns: Json }
      home_summary: { Args: { p_branch_id?: number; p_today?: string }; Returns: Json }
      impersonation_targets: { Args: never; Returns: Json }
      is_user_blocked: { Args: { p_other: string }; Returns: boolean }
      list_blocked_users: {
        Args: never
        Returns: {
          name: string
          role: string
          user_id: string
        }[]
      }
      list_branch_attendance: {
        Args: { p_branch_id: number; p_from: string; p_to: string }
        Returns: {
          accepted_with_tolerance: boolean
          branch_id: number
          branch_name: string
          id: number
          kind: string
          local_time: string
          location_unavailable: boolean
          low_accuracy: boolean
          mocked: boolean
          needs_review: boolean
          recorded_at: string
          review_status: string
          staff_name: string
          within_geofence: boolean
        }[]
      }
      list_message_contacts: {
        Args: never
        Returns: {
          name: string
          role: string
          user_id: string
        }[]
      }
      list_my_attendance_branches: {
        Args: never
        Returns: {
          branch_id: number
          geofence_enabled: boolean
          name: string
        }[]
      }
      list_my_conversations: {
        Args: never
        Returns: {
          conversation_id: number
          is_broadcast: boolean
          last_message_at: string
          last_message_body: string
          last_message_mine: boolean
          other_name: string
          other_role: string
          other_user_id: string
          unread_count: number
        }[]
      }
      mark_conversation_read: {
        Args: { p_conversation_id: number }
        Returns: undefined
      }
      my_attendance_consent: {
        Args: never
        Returns: {
          acknowledged_at: string
          center_id: number
          notice_version: number
        }[]
      }
      my_attendance_recent: {
        Args: { p_limit?: number }
        Returns: {
          accepted_with_tolerance: boolean
          branch_id: number
          branch_name: string
          id: number
          kind: string
          local_time: string
          location_unavailable: boolean
          low_accuracy: boolean
          mocked: boolean
          needs_review: boolean
          recorded_at: string
          review_status: string
          within_geofence: boolean
        }[]
      }
      my_attendance_status: {
        Args: never
        Returns: {
          branch_id: number
          branch_name: string
          is_open: boolean
          last_kind: string
          since: string
        }[]
      }
      my_linked_guardian_emails: { Args: never; Returns: string[] }
      my_permissions: { Args: never; Returns: Json }
      my_profile: { Args: never; Returns: Json }
      my_unread_count: { Args: never; Returns: number }
      push_targets_for_message: {
        Args: { p_message_id: number }
        Returns: {
          body: string
          conversation_id: number
          is_broadcast: boolean
          platform: string
          recipient: string
          sender_name: string
          token: string
        }[]
      }
      reconcile_my_role: { Args: never; Returns: string }
      record_attendance_consent: {
        Args: { p_notice_version: number }
        Returns: undefined
      }
      reject_enrollment_application: {
        Args: { p_id: number }
        Returns: undefined
      }
      report_content: {
        Args: {
          p_conversation_id?: number
          p_details?: string
          p_message_id?: number
          p_reason?: string
          p_reported_user?: string
        }
        Returns: undefined
      }
      request_manual_attendance: {
        Args: { p_branch_id: number; p_kind: string }
        Returns: {
          accepted_with_tolerance: boolean
          accuracy_m: number | null
          branch_id: number
          center_id: number
          created_at: string
          device_id: string | null
          distance_m: number | null
          id: number
          kind: string
          latitude: number | null
          location_unavailable: boolean
          longitude: number | null
          low_accuracy: boolean
          mocked: boolean
          needs_review: boolean
          profile_id: string | null
          recorded_at: string
          review_status: string
          source: string
          teacher_id: number | null
          within_geofence: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "staff_attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_broadcast: {
        Args: {
          p_audience: string
          p_body?: string
          p_classroom_ids?: number[]
        }
        Returns: number
      }
      set_attendance_review: {
        Args: { p_id: number; p_status: string }
        Returns: {
          accepted_with_tolerance: boolean
          accuracy_m: number | null
          branch_id: number
          center_id: number
          created_at: string
          device_id: string | null
          distance_m: number | null
          id: number
          kind: string
          latitude: number | null
          location_unavailable: boolean
          longitude: number | null
          low_accuracy: boolean
          mocked: boolean
          needs_review: boolean
          profile_id: string | null
          recorded_at: string
          review_status: string
          source: string
          teacher_id: number | null
          within_geofence: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "staff_attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_entry_activities: {
        Args: { p_activity_ids: number[]; p_entry_id: number }
        Returns: undefined
      }
      set_my_classrooms: { Args: { p_names: string[] }; Returns: number }
      set_plan_order: { Args: { p_ids: number[] }; Returns: undefined }
      start_conversation: { Args: { p_other: string }; Returns: number }
      submit_enrollment_application: {
        Args: {
          p_child_dob: string
          p_child_gender: string
          p_child_name: string
          p_child_nric?: string
          p_note: string
          p_parent_email: string
          p_parent_name: string
          p_parent_phone: string
          p_slug: string
        }
        Returns: undefined
      }
      unblock_user: { Args: { p_other: string }; Returns: undefined }
      update_activity: {
        Args: {
          p_description?: string
          p_id: number
          p_instructions?: string[]
          p_materials?: string[]
          p_skill_ids?: number[]
          p_title: string
        }
        Returns: undefined
      }
      update_center_settings: {
        Args: {
          p_center_id: number
          p_description: string
          p_enrollment_required_fields?: Json
          p_facebook: string
          p_instagram: string
          p_logo_url: string
          p_name: string
          p_slug: string
          p_website: string
          p_whatsapp: string
        }
        Returns: undefined
      }
      update_my_parent_profile: {
        Args: { p_full_name: string; p_phone: string }
        Returns: undefined
      }
      update_my_profile: {
        Args: {
          p_dob: string
          p_full_name: string
          p_gender: string
          p_phone: string
          p_photo_url: string
        }
        Returns: undefined
      }
      update_student: {
        Args: {
          p_branch_id?: number
          p_dob: string
          p_enrollments: Json
          p_gender: string
          p_guardians: Json
          p_id: number
          p_name: string
          p_nric?: string
          p_photo_url: string
        }
        Returns: number
      }
      update_teacher: {
        Args: {
          p_assignments: Json
          p_branch_ids?: number[]
          p_dob: string
          p_email: string
          p_gender: string
          p_id: number
          p_is_admin?: boolean
          p_is_teacher?: boolean
          p_name: string
          p_phone: string
          p_photo_url: string
        }
        Returns: number
      }
      upsert_device_token: {
        Args: { p_platform: string; p_token: string }
        Returns: undefined
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
    Enums: {},
  },
} as const
