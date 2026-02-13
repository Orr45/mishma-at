'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import type { Soldier, AppEvent, News } from '@/types/database';
import {
  Shield,
  Building2,
  Home,
  CalendarClock,
  Plus,
  X,
  AlertCircle,
  Stethoscope,
  DoorOpen,
  User,
  Truck,
  CheckCircle2,
  Clock,
  Pencil,
  Save,
  Newspaper,
  Reply,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const categories = [
  { value: 'HR/Logistics', label: 'שלישות', icon: Truck, color: 'text-blue-400 bg-blue-400/10' },
  { value: 'Medical', label: 'רפואה', icon: Stethoscope, color: 'text-accent-red bg-accent-red/10' },
  { value: 'Leaves', label: 'יציאות', icon: DoorOpen, color: 'text-accent-yellow bg-accent-yellow/10' },
  { value: 'Personal', label: 'אישי', icon: User, color: 'text-purple-400 bg-purple-400/10' },
] as const;

export default function SoldierPortalPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [soldier, setSoldier] = useState<Soldier | null>(null);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newsList, setNewsList] = useState<News[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    role_in_unit: '',
    weapon_serial: '',
    civilian_job: '',
    notes: '',
  });

  useEffect(() => {
    async function load() {
      const [soldierRes, eventsRes, newsRes] = await Promise.all([
        supabase.from('soldiers').select('*').eq('id', id).single(),
        supabase
          .from('events')
          .select('*')
          .eq('soldier_id', id)
          .order('created_at', { ascending: false }),
        supabase.from('news').select('*').order('created_at', { ascending: false }),
      ]);

      if (soldierRes.data) {
        const s = soldierRes.data as unknown as Soldier;
        setSoldier(s);
        setEditForm({
          full_name: s.full_name || '',
          role_in_unit: s.role_in_unit || '',
          weapon_serial: s.weapon_serial || '',
          civilian_job: s.civilian_job || '',
          notes: s.notes || '',
        });
      }
      if (eventsRes.data) setEvents(eventsRes.data as unknown as AppEvent[]);
      if (newsRes.data) setNewsList(newsRes.data as unknown as News[]);
      setLoading(false);
    }
    load();

    // Real-time for events related to this soldier
    const channel = supabase
      .channel(`soldier-portal-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `soldier_id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setEvents((prev) => [payload.new as AppEvent, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setEvents((prev) =>
              prev.map((ev) => (ev.id === (payload.new as AppEvent).id ? (payload.new as AppEvent) : ev))
            );
          } else if (payload.eventType === 'DELETE') {
            setEvents((prev) => prev.filter((ev) => ev.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'news' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNewsList((prev) => [payload.new as News, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setNewsList((prev) =>
              prev.map((n) => (n.id === (payload.new as News).id ? (payload.new as News) : n))
            );
          } else if (payload.eventType === 'DELETE') {
            setNewsList((prev) => prev.filter((n) => n.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, supabase]);

  function startEditing() {
    if (!soldier) return;
    setEditForm({
      full_name: soldier.full_name || '',
      role_in_unit: soldier.role_in_unit || '',
      weapon_serial: soldier.weapon_serial || '',
      civilian_job: soldier.civilian_job || '',
      notes: soldier.notes || '',
    });
    setEditing(true);
  }

  async function saveProfile() {
    if (!editForm.full_name.trim()) {
      setError('שם מלא הוא שדה חובה');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('soldiers')
        .update({
          full_name: editForm.full_name.trim(),
          role_in_unit: editForm.role_in_unit.trim() || null,
          weapon_serial: editForm.weapon_serial.trim() || null,
          civilian_job: editForm.civilian_job.trim() || null,
          notes: editForm.notes.trim() || null,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      setSoldier((prev) =>
        prev
          ? {
              ...prev,
              full_name: editForm.full_name.trim(),
              role_in_unit: editForm.role_in_unit.trim() || null,
              weapon_serial: editForm.weapon_serial.trim() || null,
              civilian_job: editForm.civilian_job.trim() || null,
              notes: editForm.notes.trim() || null,
            }
          : prev
      );
      setEditing(false);
      setSuccess('הפרטים עודכנו בהצלחה!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון הפרטים');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitLoading(true);

    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const description = (formData.get('description') as string) || '';

    if (!title.trim()) {
      setError('יש להזין שם לבקשה');
      setSubmitLoading(false);
      return;
    }

    try {
      const { error: insertError } = await supabase.from('events').insert({
        title,
        soldier_id: id,
        category,
        description,
        source: 'soldier',
        creator_id: null,
      } as never);

      if (insertError) throw insertError;
      setShowForm(false);
      setSuccess('הבקשה נשלחה בהצלחה!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשליחת הבקשה');
    } finally {
      setSubmitLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!soldier) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-3 text-muted opacity-50" />
          <p className="text-lg text-muted-foreground">חייל לא נמצא</p>
        </div>
      </div>
    );
  }

  const activeEvents = events.filter((ev) => !ev.ended_at);
  const endedEvents = events.filter((ev) => ev.ended_at);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 justify-center">
        <Shield className="w-6 h-6 text-primary" />
        <span className="text-lg font-bold">משמעת</span>
      </div>

      {/* Soldier Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-5"
      >
        {editing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">עריכת פרטים</h2>
              <button
                onClick={() => setEditing(false)}
                className="p-1.5 rounded-lg hover:bg-card-hover transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">שם מלא *</label>
              <input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">תפקיד</label>
              <input
                value={editForm.role_in_unit}
                onChange={(e) => setEditForm({ ...editForm, role_in_unit: e.target.value })}
                className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="לדוגמה: קשר, חובש..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">מספר נשק</label>
              <input
                value={editForm.weapon_serial}
                onChange={(e) => setEditForm({ ...editForm, weapon_serial: e.target.value })}
                className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">עבודה אזרחית</label>
              <input
                value={editForm.civilian_job}
                onChange={(e) => setEditForm({ ...editForm, civilian_job: e.target.value })}
                className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">הערות</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
                className="w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-accent-green hover:bg-accent-green/80 text-white font-medium rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  שמור
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">{soldier.full_name}</h1>
                {soldier.role_in_unit && (
                  <p className="text-sm text-muted-foreground mt-0.5">{soldier.role_in_unit}</p>
                )}
              </div>
              <span
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${
                  soldier.status === 'Base'
                    ? 'bg-accent-green/20 text-accent-green'
                    : 'bg-accent-yellow/20 text-accent-yellow'
                }`}
              >
                {soldier.status === 'Base' ? (
                  <><Building2 className="w-4 h-4" /> בבסיס</>
                ) : (
                  <><Home className="w-4 h-4" /> בבית</>
                )}
              </span>
            </div>

            {/* Additional info */}
            {(soldier.weapon_serial || soldier.civilian_job || soldier.notes) && (
              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                {soldier.weapon_serial && (
                  <p className="text-sm text-muted-foreground">נשק: <span className="text-foreground">{soldier.weapon_serial}</span></p>
                )}
                {soldier.civilian_job && (
                  <p className="text-sm text-muted-foreground">עבודה: <span className="text-foreground">{soldier.civilian_job}</span></p>
                )}
                {soldier.notes && (
                  <p className="text-sm text-muted-foreground">הערות: <span className="text-foreground">{soldier.notes}</span></p>
                )}
              </div>
            )}

            <button
              onClick={startEditing}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-card-hover hover:bg-border text-muted-foreground hover:text-foreground rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
            >
              <Pencil className="w-4 h-4" />
              עריכת פרטים אישיים
            </button>
          </>
        )}
      </motion.div>

      {/* News */}
      {newsList.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Newspaper className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">חדשות</h2>
          </div>
          <div className="space-y-2">
            {newsList.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl p-4"
              >
                <h3 className="font-semibold text-sm">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.content}</p>
                <span className="text-[10px] text-muted mt-2 block">
                  {new Date(item.created_at).toLocaleDateString('he-IL', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Success message */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/30 text-accent-green rounded-xl p-3"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Request Button */}
      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white rounded-xl px-4 py-3 font-medium transition-colors"
      >
        <Plus className="w-5 h-5" />
        שליחת בקשה חדשה
      </button>

      {/* My Events */}
      <div>
        <h2 className="text-lg font-semibold mb-3">הבקשות שלי</h2>

        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarClock className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">אין בקשות עדיין</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeEvents.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground">פעילות</p>
                {activeEvents.map((event) => {
                  const cat = categories.find((c) => c.value === event.category);
                  const Icon = cat?.icon || CalendarClock;
                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-border rounded-2xl p-4"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cat?.color || 'bg-card-hover text-muted'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-sm block">{event.title || 'בקשה'}</span>
                          <span className="text-xs text-muted">
                            {new Date(event.created_at).toLocaleDateString('he-IL', {
                              day: '2-digit', month: '2-digit',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {event.source === 'soldier' && (
                          <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">בקשה שלי</span>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground bg-background rounded-lg p-2.5">{event.description}</p>
                      )}
                      {event.commander_note && (
                        <div className="mt-2 bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Reply className="w-3 h-3 text-primary" />
                            <span className="text-[10px] font-medium text-primary">תגובת מפקד</span>
                          </div>
                          <p className="text-sm">{event.commander_note}</p>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </>
            )}

            {endedEvents.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground mt-4">הסתיימו</p>
                {endedEvents.map((event) => {
                  const cat = categories.find((c) => c.value === event.category);
                  const Icon = cat?.icon || CalendarClock;
                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-border rounded-2xl p-4 opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cat?.color || 'bg-card-hover text-muted'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-sm block">{event.title || 'בקשה'}</span>
                          <span className="text-xs text-muted">
                            {new Date(event.created_at).toLocaleDateString('he-IL', {
                              day: '2-digit', month: '2-digit',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <span className="text-xs text-accent-green flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          טופל
                        </span>
                      </div>
                      {event.commander_note && (
                        <div className="mt-2 bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Reply className="w-3 h-3 text-primary" />
                            <span className="text-[10px] font-medium text-primary">תגובת מפקד</span>
                          </div>
                          <p className="text-sm">{event.commander_note}</p>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Request Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">בקשה חדשה</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 rounded-xl hover:bg-card-hover transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/30 text-accent-red rounded-xl p-3 mb-4">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">נושא הבקשה</label>
                  <input
                    name="title"
                    required
                    className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="לדוגמה: בקשה ליציאה, תור רופא..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">קטגוריה</label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((cat) => {
                      const CatIcon = cat.icon;
                      return (
                        <label key={cat.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="category"
                            value={cat.value}
                            defaultChecked={cat.value === 'Personal'}
                            className="sr-only peer"
                          />
                          <div className="flex-1 flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 peer-checked:border-primary peer-checked:bg-primary/10 transition-colors">
                            <CatIcon className="w-4 h-4" />
                            <span className="text-sm">{cat.label}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">פירוט (אופציונלי)</label>
                  <textarea
                    name="description"
                    rows={3}
                    className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="פרט את הבקשה..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitLoading}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl px-4 py-3 transition-colors disabled:opacity-50"
                >
                  {submitLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      שלח בקשה
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
