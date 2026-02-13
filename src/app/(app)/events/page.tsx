'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import type { AppEvent, Soldier } from '@/types/database';
import { eventSchema } from '@/lib/validations';
import {
  Plus,
  CalendarClock,
  Stethoscope,
  DoorOpen,
  User,
  Truck,
  AlertCircle,
  X,
  Users,
  CheckCircle2,
  Trash2,
  ChevronDown,
  Clock,
  MessageCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const categories = [
  { value: 'HR/Logistics', label: 'שלישות', icon: Truck, color: 'text-blue-400 bg-blue-400/10' },
  { value: 'Medical', label: 'רפואה', icon: Stethoscope, color: 'text-accent-red bg-accent-red/10' },
  { value: 'Leaves', label: 'יציאות', icon: DoorOpen, color: 'text-accent-yellow bg-accent-yellow/10' },
  { value: 'Personal', label: 'אישי', icon: User, color: 'text-purple-400 bg-purple-400/10' },
] as const;

export default function EventsPage() {
  const [events, setEvents] = useState<(AppEvent & { soldier?: { full_name: string } })[]>([]);
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [eventType, setEventType] = useState<'general' | 'soldier'>('general');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [eventsRes, soldiersRes] = await Promise.all([
        supabase
          .from('events')
          .select('*, soldier:soldiers(full_name)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('soldiers').select('*').order('full_name'),
      ]);
      if (eventsRes.data) setEvents(eventsRes.data as unknown as (AppEvent & { soldier?: { full_name: string } })[]);
      if (soldiersRes.data) setSoldiers(soldiersRes.data as unknown as Soldier[]);
      setLoading(false);
    }
    load();

    // Real-time
    const channel = supabase
      .channel('events-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newEvent = payload.new as AppEvent;
            if (newEvent.soldier_id) {
              const { data: soldier } = await supabase
                .from('soldiers')
                .select('full_name')
                .eq('id', newEvent.soldier_id)
                .single();
              setEvents((prev) => [{ ...newEvent, soldier: soldier as unknown as { full_name: string } }, ...prev]);
            } else {
              setEvents((prev) => [newEvent, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            setEvents((prev) =>
              prev.map((ev) => (ev.id === (payload.new as AppEvent).id ? { ...ev, ...(payload.new as AppEvent) } : ev))
            );
          } else if (payload.eventType === 'DELETE') {
            setEvents((prev) => prev.filter((ev) => ev.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitLoading(true);

    const formData = new FormData(e.currentTarget);
    const raw = Object.fromEntries(formData);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('לא מחובר');

      const parsed = eventSchema.parse({
        title: raw.title,
        soldier_id: eventType === 'soldier' ? raw.soldier_id : null,
        description: raw.description || '',
        category: raw.category,
      });

      const { error: insertError } = await supabase.from('events').insert({
        ...parsed,
        creator_id: user.id,
      } as never);

      if (insertError) throw insertError;
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setSubmitLoading(false);
    }
  }

  async function endEvent(eventId: string) {
    // Optimistic update
    setEvents((prev) =>
      prev.map((ev) => (ev.id === eventId ? { ...ev, ended_at: new Date().toISOString() } : ev))
    );
    await supabase
      .from('events')
      .update({ ended_at: new Date().toISOString() } as never)
      .eq('id', eventId);
  }

  async function deleteEvent(eventId: string) {
    if (!confirm('למחוק את האירוע?')) return;
    setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    await supabase.from('events').delete().eq('id', eventId);
  }

  function shareEventWhatsApp(event: AppEvent & { soldier?: { full_name: string } }) {
    const cat = categories.find((c) => c.value === event.category);
    const dateStr = new Date(event.created_at).toLocaleDateString('he-IL', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });

    let msg = '';
    msg += `${event.title || 'אירוע'}\n`;
    msg += `קטגוריה: ${cat?.label || event.category}\n`;
    msg += `תאריך: ${dateStr}\n`;
    if (event.soldier) msg += `חייל: ${event.soldier.full_name}\n`;
    if (event.description) msg += `\nתיאור:\n${event.description}\n`;
    if (event.ended_at) {
      const endStr = new Date(event.ended_at).toLocaleDateString('he-IL', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
      msg += `\nהסתיים: ${endStr}`;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const activeEvents = events.filter((ev) => !ev.ended_at);
  const endedEvents = events.filter((ev) => ev.ended_at);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">אירועים</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white rounded-xl px-4 py-2.5 font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          אירוע חדש
        </button>
      </div>

      {/* Active Events */}
      <div className="space-y-3">
        {activeEvents.length > 0 && (
          <h2 className="text-sm font-semibold text-muted-foreground">אירועים פעילים</h2>
        )}
        {activeEvents.map((event) => {
          const cat = categories.find((c) => c.value === event.category);
          const Icon = cat?.icon || CalendarClock;
          const isExpanded = expandedId === event.id;
          return (
            <motion.div
              key={event.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl overflow-hidden"
            >
              {/* Clickable header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : event.id)}
                className="w-full flex items-center gap-3 p-4 text-start hover:bg-card-hover transition-colors"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${cat?.color || 'bg-card-hover text-muted'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {event.title && (
                      <span className="font-semibold text-sm">{event.title}</span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat?.color || ''}`}>
                      {cat?.label || event.category}
                    </span>
                    {event.source === 'soldier' && (
                      <span className="text-[10px] bg-orange-400/20 text-orange-400 px-2 py-0.5 rounded-full font-medium">בקשת חייל</span>
                    )}
                  </div>
                  <span className="text-xs text-muted mt-0.5 block">
                    {new Date(event.created_at).toLocaleDateString('he-IL', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <ChevronDown className={`w-5 h-5 text-muted shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Expanded details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                      {event.soldier && (
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted" />
                          <span className="text-sm">חייל: <strong>{event.soldier.full_name}</strong></span>
                        </div>
                      )}
                      {event.description && (
                        <div>
                          <span className="text-xs text-muted-foreground block mb-1">תיאור:</span>
                          <p className="text-sm bg-background rounded-xl p-3">{event.description}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <Clock className="w-3.5 h-3.5" />
                        נוצר: {new Date(event.created_at).toLocaleDateString('he-IL', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); endEvent(event.id); }}
                          className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-accent-green/10 text-accent-green hover:bg-accent-green/20 rounded-xl px-3 py-2.5 transition-colors font-medium"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          סיים אירוע
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); shareEventWhatsApp(event); }}
                          className="flex items-center justify-center gap-1.5 text-sm bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 rounded-xl px-4 py-2.5 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteEvent(event.id); }}
                          className="flex items-center justify-center gap-1.5 text-sm bg-accent-red/10 text-accent-red hover:bg-accent-red/20 rounded-xl px-4 py-2.5 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Ended Events */}
      {endedEvents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">אירועים שהסתיימו</h2>
          {endedEvents.map((event) => {
            const cat = categories.find((c) => c.value === event.category);
            const Icon = cat?.icon || CalendarClock;
            const isExpanded = expandedId === event.id;
            return (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl overflow-hidden opacity-60"
              >
                {/* Clickable header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}
                  className="w-full flex items-center gap-3 p-4 text-start hover:bg-card-hover transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${cat?.color || 'bg-card-hover text-muted'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {event.title && (
                        <span className="font-semibold text-sm">{event.title}</span>
                      )}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat?.color || ''}`}>
                        {cat?.label || event.category}
                      </span>
                      {event.source === 'soldier' && (
                        <span className="text-[10px] bg-orange-400/20 text-orange-400 px-2 py-0.5 rounded-full font-medium">בקשת חייל</span>
                      )}
                      <span className="text-xs text-accent-green flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        הסתיים
                      </span>
                    </div>
                    <span className="text-xs text-muted mt-0.5 block">
                      {new Date(event.created_at).toLocaleDateString('he-IL', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-muted shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Expanded details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                        {event.soldier && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted" />
                            <span className="text-sm">חייל: <strong>{event.soldier.full_name}</strong></span>
                          </div>
                        )}
                        {event.description && (
                          <div>
                            <span className="text-xs text-muted-foreground block mb-1">תיאור:</span>
                            <p className="text-sm bg-background rounded-xl p-3">{event.description}</p>
                          </div>
                        )}
                        <div className="space-y-1 text-xs text-muted">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            נוצר: {new Date(event.created_at).toLocaleDateString('he-IL', {
                              day: '2-digit', month: '2-digit', year: '2-digit',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                          {event.ended_at && (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-accent-green" />
                              הסתיים: {new Date(event.ended_at).toLocaleDateString('he-IL', {
                                day: '2-digit', month: '2-digit', year: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); shareEventWhatsApp(event); }}
                            className="flex items-center justify-center gap-1.5 text-sm bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 rounded-xl px-4 py-2.5 transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteEvent(event.id); }}
                            className="flex items-center justify-center gap-1.5 text-sm bg-accent-red/10 text-accent-red hover:bg-accent-red/20 rounded-xl px-4 py-2.5 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {events.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg">אין אירועים</p>
        </div>
      )}

      {/* Add Event Modal */}
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
                <h2 className="text-xl font-bold">אירוע חדש</h2>
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

              {/* Event Type Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setEventType('general')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    eventType === 'general' ? 'bg-primary text-white' : 'bg-card-hover'
                  }`}
                >
                  אירוע כללי
                </button>
                <button
                  onClick={() => setEventType('soldier')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    eventType === 'soldier' ? 'bg-primary text-white' : 'bg-card-hover'
                  }`}
                >
                  אירוע לחייל
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">שם האירוע</label>
                  <input
                    name="title"
                    required
                    className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="לדוגמה: חייל חולה, בדיקת נשק..."
                  />
                </div>

                {eventType === 'soldier' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">חייל</label>
                    <select
                      name="soldier_id"
                      required
                      className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">בחר חייל...</option>
                      {soldiers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">קטגוריה</label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((cat) => {
                      const CatIcon = cat.icon;
                      return (
                        <label
                          key={cat.value}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="category"
                            value={cat.value}
                            defaultChecked={cat.value === 'HR/Logistics'}
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
                  <label className="block text-sm font-medium mb-1">תיאור (אופציונלי)</label>
                  <textarea
                    name="description"
                    rows={3}
                    className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="תאר את האירוע..."
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
                      הוסף אירוע
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
