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
export type IncomeExtraType = "additional_person" | "parking" | "contract_signing"

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
  notes: string | null
  room?: Room
  tenant_profile?: TenantProfile
}

export interface TenantProfile {
  id: string
  room_id: string
  contract_id: string
  name: string
  phone: string
}

export interface PaymentReceipt {
  id: string
  tenant_profile_id: string
  contract_id: string
  period_month: string
  storage_path: string
  uploaded_at: string
  verified: boolean
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
        Insert: Omit<Contract, "id" | "room" | "tenant_profile"> & { id?: string }
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
    }
  }
}
