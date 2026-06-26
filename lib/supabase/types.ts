export type RoomStatus = "available" | "occupied" | "expiring_soon" | "renovation"
export type ContractStatus = "active" | "ended"
export type ExpenseCategory =
  | "guardian_salary"
  | "commission"
  | "internet"
  | "iusi"
  | "electricity"
  | "water"
export type ExpenseType = "fixed" | "variable"
export type IncomeExtraType = "additional_person" | "parking" | "contract_signing" | "deposit"

export interface Property {
  id: string
  name: string
  slug: string
  address: string
}

export interface RoomType {
  id: string
  slug: "pequena" | "estandar" | "grande" | "loft"
  label: string
  price: number
  description: string
}

export interface RoomPhoto {
  id: string
  room_id: string
  storage_path: string
  display_order: number
  created_at: string
}

export interface Room {
  id: string
  property_id: string
  identifier: string
  type_id: string | null
  price: number | null
  status: RoomStatus
  sort_order: number
  property?: Property
  room_type?: RoomType
  room_photos?: RoomPhoto[]
}

export interface Contract {
  id: string
  room_id: string
  tenant_profile_id: string
  start_date: string
  duration_months: number
  end_date: string
  payment_day: number
  whatsapp_template: string | null
  status: ContractStatus
  signed_at: string | null
  credentials_sent_at: string | null
  monthly_rent: number | null
  notes: string | null
  contract_file_path: string | null
  has_additional_person: boolean
  additional_person_name: string
  additional_person_dpi: string
  additional_person_phone: string
  additional_person_phone_alt: string
  has_parking: boolean
  parking_vehicle_type: string
  parking_vehicle_brand: string
  parking_vehicle_line: string
  parking_vehicle_color: string
  parking_vehicle_plate: string
  room?: Room
  tenant_profile?: TenantProfile
}

export interface TenantProfile {
  id: string
  room_id: string
  contract_id: string
  name: string
  phone: string
  phone_alt: string
  email: string
  dpi: string
}

export interface PaymentReceipt {
  id: string
  tenant_profile_id: string
  contract_id: string
  period_month: string
  storage_path: string
  file_hash: string | null
  uploaded_at: string
  verified: boolean
  rejected: boolean
  rejection_reason: string | null
  // Agrupa varios meses pagados en una sola transferencia (mismo archivo). null = pago de un mes.
  payment_group_id: string | null
}

export interface Expense {
  id: string
  property_id: string | null
  category: ExpenseCategory
  type: ExpenseType
  amount: number
  period: string
  notes: string | null
}

export interface IncomeExtra {
  id: string
  contract_id: string
  room_id: string
  type: IncomeExtraType
  amount: number
  date: string
  notes: string | null
}

export type RecurringChargeType = "additional_person" | "parking"

export interface RecurringCharge {
  id: string
  contract_id: string
  room_id: string
  type: RecurringChargeType
  amount: number
  created_at: string
}

export interface AuditLog {
  ticket: number
  actor_id: string | null
  actor_email: string | null
  actor_role: string | null
  action: string
  entity: string | null
  entity_ref: string | null
  created_at: string
}

export type IssueStatus = "open" | "in_progress" | "resolved"

export interface IssueReport {
  id: string
  contract_id: string | null
  tenant_profile_id: string | null
  room_id: string
  property_id: string
  tenant_name: string | null
  description: string
  status: IssueStatus
  created_at: string
  resolved_at: string | null
}

export type WaiverConcept =
  | "rent"
  | "deposit"
  | "contract_signing"
  | "parking"
  | "additional_person"
  | "other"

export interface ChargeWaiver {
  id: string
  contract_id: string
  room_id: string
  period_month: string
  concept: WaiverConcept
  recurring_charge_id: string | null
  income_extra_id: string | null
  amount: number
  reason: string | null
  created_by: string | null
  created_at: string
}

export interface MonthlyPayment {
  id: string
  contract_id: string
  room_id: string
  period_month: string
  amount: number
  source: "receipt" | "manual" | "abono"
  receipt_id: string | null
  registered_by: string | null
  registered_at: string
  notes: string | null
}

export type AbonoStatus = "pending" | "authorized" | "rejected"

export interface AbonoRequest {
  id: string
  contract_id: string
  tenant_profile_id: string
  room_id: string
  period_month: string
  requested_amount: number
  month_total: number | null
  status: AbonoStatus
  authorized_amount: number | null
  admin_notes: string | null
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
}

export interface AbonoPayment {
  id: string
  abono_request_id: string
  contract_id: string
  tenant_profile_id: string
  room_id: string
  period_month: string
  amount: number
  storage_path: string
  file_hash: string | null
  verified: boolean
  rejected: boolean
  rejection_reason: string | null
  created_at: string
  registered_by: string | null
}

export interface Database {
  public: {
    Tables: {
      properties: {
        Row: Property
        Insert: Omit<Property, "id"> & { id?: string }
        Update: Partial<Property>
      }
      room_types: {
        Row: RoomType
        Insert: Omit<RoomType, "id"> & { id?: string }
        Update: Partial<RoomType>
      }
      room_photos: {
        Row: RoomPhoto
        Insert: Omit<RoomPhoto, "id" | "created_at"> & { id?: string; room_id: string }
        Update: Partial<RoomPhoto>
      }
      rooms: {
        Row: Room
        Insert: Omit<Room, "id" | "property" | "room_type"> & { id?: string }
        Update: Partial<Omit<Room, "property" | "room_type">>
      }
      contracts: {
        Row: Contract
        Insert: Omit<Contract, "id" | "room" | "tenant_profile" | "signed_at" | "credentials_sent_at" | "contract_file_path" | "monthly_rent" | "has_additional_person" | "additional_person_name" | "additional_person_dpi" | "additional_person_phone" | "additional_person_phone_alt" | "has_parking" | "parking_vehicle_type" | "parking_vehicle_brand" | "parking_vehicle_line" | "parking_vehicle_color" | "parking_vehicle_plate"> & {
          id?: string
          signed_at?: string | null
          credentials_sent_at?: string | null
          contract_file_path?: string | null
          monthly_rent?: number | null
          has_additional_person?: boolean
          additional_person_name?: string
          additional_person_dpi?: string
          additional_person_phone?: string
          additional_person_phone_alt?: string
          has_parking?: boolean
          parking_vehicle_type?: string
          parking_vehicle_brand?: string
          parking_vehicle_line?: string
          parking_vehicle_color?: string
          parking_vehicle_plate?: string
        }
        Update: Partial<Omit<Contract, "room" | "tenant_profile">>
      }
      tenant_profiles: {
        Row: TenantProfile
        Insert: TenantProfile
        Update: Partial<TenantProfile>
      }
      payment_receipts: {
        Row: PaymentReceipt
        Insert: Omit<PaymentReceipt, "id" | "uploaded_at"> & { id?: string }
        Update: Partial<PaymentReceipt>
      }
      expenses: {
        Row: Expense
        Insert: Omit<Expense, "id"> & { id?: string }
        Update: Partial<Expense>
      }
      income_extras: {
        Row: IncomeExtra
        Insert: Omit<IncomeExtra, "id"> & { id?: string }
        Update: Partial<IncomeExtra>
      }
      recurring_charges: {
        Row: RecurringCharge
        Insert: Omit<RecurringCharge, "id" | "created_at"> & { id?: string }
        Update: Partial<RecurringCharge>
      }
      audit_log: {
        Row: AuditLog
        Insert: Omit<AuditLog, "ticket" | "created_at">
        Update: never
      }
      issue_reports: {
        Row: IssueReport
        Insert: Omit<IssueReport, "id" | "created_at" | "resolved_at"> & { id?: string; resolved_at?: string | null }
        Update: Partial<IssueReport>
      }
      charge_waivers: {
        Row: ChargeWaiver
        Insert: Omit<ChargeWaiver, "id" | "created_at"> & { id?: string }
        Update: Partial<ChargeWaiver>
      }
      abono_requests: {
        Row: AbonoRequest
        Insert: Omit<AbonoRequest, "id" | "created_at" | "resolved_at" | "resolved_by"> & { id?: string; status?: AbonoStatus; resolved_at?: string | null; resolved_by?: string | null }
        Update: Partial<AbonoRequest>
      }
      abono_payments: {
        Row: AbonoPayment
        Insert: Omit<AbonoPayment, "id" | "created_at"> & { id?: string }
        Update: Partial<AbonoPayment>
      }
    }
  }
}
