'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import type { Soldier, AppEvent } from '@/types/database';
import {
  ArrowRight,
  Shield,
  Briefcase,
  Crosshair,
  StickyNote,
  Edit3,
  Save,
  X,
  CalendarClock,
  Stethoscope,
  DoorOpen,
  User,
  Truck,
  Trash2,
} from 'lucide-react';
import { motion } from 'framer-motion';

const categoryConfig: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  'HR/Logistics': { label: 'שלישות', icon: Truck, color: 'text-blue-400' },
  Medical: { label: 'רפואה', icon: Stethoscope, color: 'text-accent-red' },
  Leaves: { label: 'יציאות', icon: DoorOpen, color: 'text-accent-yellow' },
  Personal: { label: 'אישי', icon: User, color: 'text-purple-400' },
};

export default function SoldierProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [soldier, setSoldier] = useState<Soldier | null>(null);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ weapon_serial: '', civilian_job: '', notes: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [soldierRes, eventsRes] = await Promise.all([
        supabase.from('soldiers').select('*').eq('id', id).single(),
        supabase
          .from('events')
          .select('*')
          .eq('soldier_id', id)
          .order('created_at', { ascending: false }),
      ]);

      if (soldierRes.data) {
        const s = soldierRes.data as unknown as Soldier;
        setSoldier(s);
        setEditData({
          weapon_serial: s.weapon_serial || '',
          civilian_job: s.civilian_job || '',
          notes: s.notes || '',
        });
      }
      if (eventsRes.data) setEvents(eventsRes.data as unknown as AppEvent[]);
      setLoading(false);
    }
    load();

    // Real-time events for this soldier
    const channel = supabase
      .channel(`soldier-events-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: `soldier_id=eq.${id}` },
        (payload) => {
          setEvents((prev) => [payload.new as AppEvent, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, supabase]);

  async function handleSave() {
    if (!soldier) return;
    await supabase
      .from('soldiers')
      .update({
        weapon_serial: editData.weapon_serial || null,
        civilian_job: editData.civilian_job || null,
        notes: editData.notes || null,
      } as never)
      .eq('id', soldier.id);

    setSoldier({
      ...soldier,
      weapon_serial: editData.weapon_serial || null,
      civilian_job: editData.civilian_job || null,
      notes: editData.notes || null,
    });
    setEditing(false);
  }

  async function handleDelete() {
    if (!soldier) return;
    if (!confirm(`למחוק את ${soldier.full_name}? פעולה זו לא ניתנת לביטול.`)) return;
    await supabase.from('soldiers').delete().eq('id', soldier.id);
    router.push('/');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!soldier) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-muted-foreground">חייל לא נמצא</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowRight className="w-5 h-5" />
        חזור
      </button>

      {/* Soldier Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{soldier.full_name}</h1>
            {soldier.role_in_unit && (
              <p className="text-muted-foreground mt-1">{soldier.role_in_unit}</p>
            )}
          </div>
          <span
            className={`text-sm font-medium px-3 py-1.5 rounded-full ${
              soldier.status === 'Base'
                ? 'bg-accent-green/20 text-accent-green'
                : 'bg-accent-yellow/20 text-accent-yellow'
            }`}
          >
            {soldier.status === 'Base' ? 'בבסיס' : 'בבית'}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Crosshair className="w-4 h-4 text-muted shrink-0" />
            <span className="text-muted-foreground">מס&apos; נשק:</span>
            {editing ? (
              <input
                value={editData.weapon_serial}
                onChange={(e) => setEditData((d) => ({ ...d, weapon_serial: e.target.value }))}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            ) : (
              <span>{soldier.weapon_serial || '—'}</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Briefcase className="w-4 h-4 text-muted shrink-0" />
            <span className="text-muted-foreground">מקצוע אזרחי:</span>
            {editing ? (
              <input
                value={editData.civilian_job}
                onChange={(e) => setEditData((d) => ({ ...d, civilian_job: e.target.value }))}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            ) : (
              <span>{soldier.civilian_job || '—'}</span>
            )}
          </div>

          <div className="flex items-start gap-3 text-sm">
            <StickyNote className="w-4 h-4 text-muted shrink-0 mt-0.5" />
            <span className="text-muted-foreground shrink-0">הערות:</span>
            {editing ? (
              <textarea
                value={editData.notes}
                onChange={(e) => setEditData((d) => ({ ...d, notes: e.target.value }))}
                rows={2}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            ) : (
              <span className="whitespace-pre-wrap">{soldier.notes || '—'}</span>
            )}
          </div>
        </div>

        {/* Edit/Save buttons */}
        <div className="flex gap-2 mt-4">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                שמור
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-2 bg-card-hover rounded-xl px-4 py-2 text-sm font-medium transition-colors"
              >
                <X className="w-4 h-4" />
                ביטול
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 bg-card-hover hover:bg-border rounded-xl px-4 py-2 text-sm font-medium transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                עריכה
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 bg-accent-red/10 hover:bg-accent-red/20 text-accent-red rounded-xl px-4 py-2 text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                מחק חייל
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Event Timeline */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CalendarClock className="w-5 h-5" />
          ציר אירועים
        </h2>

        {events.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            אין אירועים רשומים לחייל זה
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute right-[19px] top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-4">
              {events.map((event, i) => {
                const config = categoryConfig[event.category];
                const Icon = config?.icon || CalendarClock;
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex gap-4 relative"
                  >
                    <div className={`w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shrink-0 z-10 ${config?.color || 'text-muted'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 bg-card border border-border rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-card-hover ${config?.color || ''}`}>
                          {config?.label || event.category}
                        </span>
                        <span className="text-xs text-muted">
                          {new Date(event.created_at).toLocaleDateString('he-IL', {
                            day: '2-digit',
                            month: '2-digit',
                            year: undefined,
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm">{event.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
