export type UserRole = 'PC' | 'SGT' | 'SL';
export type SoldierStatus = 'Base' | 'Home';
export type EventCategory = 'HR/Logistics' | 'Medical' | 'Leaves' | 'Personal';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  platoon_id: string | null;
  created_at: string;
}

export interface Soldier {
  id: string;
  full_name: string;
  role_in_unit: string | null;
  weapon_serial: string | null;
  civilian_job: string | null;
  status: SoldierStatus;
  notes: string | null;
  platoon_id: string;
  created_by: string | null;
  created_at: string;
}

export interface AppEvent {
  id: string;
  title: string | null;
  soldier_id: string | null;
  creator_id: string | null;
  description: string;
  category: EventCategory;
  source: 'commander' | 'soldier';
  ended_at: string | null;
  created_at: string;
}

export interface Checklist {
  id: string;
  title: string;
  platoon_id: string;
  created_by: string;
  created_at: string;
}

export interface ChecklistCompletion {
  id: string;
  checklist_id: string;
  soldier_id: string;
  completed_at: string;
}

export interface News {
  id: string;
  title: string;
  content: string;
  created_by: string | null;
  platoon_id: string;
  created_at: string;
  updated_at: string;
}
