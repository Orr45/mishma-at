import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים'),
});

export const signupSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים'),
  full_name: z.string().min(2, 'שם מלא חייב להכיל לפחות 2 תווים'),
  role: z.enum(['PC', 'SGT', 'SL']),
  platoon_id: z.string().min(1, 'יש לבחור פלוגה'),
});

export const soldierSchema = z.object({
  full_name: z.string().min(2, 'שם מלא חייב להכיל לפחות 2 תווים'),
  role_in_unit: z.string().optional(),
  weapon_serial: z.string().optional(),
  civilian_job: z.string().optional(),
  status: z.enum(['Base', 'Home']),
  notes: z.string().optional(),
  platoon_id: z.string(),
});

export const eventSchema = z.object({
  title: z.string().min(1, 'יש להזין שם לאירוע'),
  soldier_id: z.string().uuid().nullable(),
  description: z.string().optional(),
  category: z.enum(['HR/Logistics', 'Medical', 'Leaves', 'Personal']),
});

export const checklistSchema = z.object({
  title: z.string().min(1, 'יש להזין כותרת'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type SoldierInput = z.infer<typeof soldierSchema>;
export type EventInput = z.infer<typeof eventSchema>;
export type ChecklistInput = z.infer<typeof checklistSchema>;
