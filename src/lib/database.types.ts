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
      centers: {
        Row: {
          created_at: string
          id: number
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      classrooms: {
        Row: {
          center_id: number
          created_at: string
          id: number
          name: string
        }
        Insert: {
          center_id: number
          created_at?: string
          id?: never
          name: string
        }
        Update: {
          center_id?: number
          created_at?: string
          id?: never
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
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
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: string
        }
        Relationships: []
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
      students: {
        Row: {
          center_id: number
          created_at: string
          dob: string | null
          gender: string | null
          id: number
          name: string
          profile_picture_url: string | null
        }
        Insert: {
          center_id: number
          created_at?: string
          dob?: string | null
          gender?: string | null
          id?: never
          name: string
          profile_picture_url?: string | null
        }
        Update: {
          center_id?: number
          created_at?: string
          dob?: string | null
          gender?: string | null
          id?: never
          name?: string
          profile_picture_url?: string | null
        }
        Relationships: [
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
      [_ in never]: never
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
      add_entries: {
        Args: {
          p_activity_ids?: number[]
          p_classroom_id: number
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
          p_dob: string
          p_enrollments: Json
          p_gender: string
          p_guardians: Json
          p_name: string
          p_photo_url: string
        }
        Returns: number
      }
      add_teacher: {
        Args: {
          p_assignments: Json
          p_dob: string
          p_email: string
          p_gender: string
          p_name: string
          p_phone: string
          p_photo_url: string
        }
        Returns: number
      }
      block_user: { Args: { p_other: string }; Returns: undefined }
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
      current_push_webhook_secret: { Args: never; Returns: string }
      delete_device_token: { Args: { p_token: string }; Returns: undefined }
      is_user_blocked: { Args: { p_other: string }; Returns: boolean }
      list_blocked_users: {
        Args: never
        Returns: {
          name: string
          role: string
          user_id: string
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
      my_linked_guardian_emails: { Args: never; Returns: string[] }
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
      send_broadcast: {
        Args: {
          p_audience: string
          p_body?: string
          p_classroom_ids?: number[]
        }
        Returns: number
      }
      set_entry_activities: {
        Args: { p_activity_ids: number[]; p_entry_id: number }
        Returns: undefined
      }
      set_my_classrooms: { Args: { p_names: string[] }; Returns: number }
      set_plan_order: { Args: { p_ids: number[] }; Returns: undefined }
      start_conversation: { Args: { p_other: string }; Returns: number }
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
      update_my_parent_profile: {
        Args: { p_full_name: string; p_phone: string }
        Returns: undefined
      }
      update_student: {
        Args: {
          p_dob: string
          p_enrollments: Json
          p_gender: string
          p_guardians: Json
          p_id: number
          p_name: string
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
