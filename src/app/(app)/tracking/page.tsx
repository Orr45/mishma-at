'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import type { Soldier, Checklist, ChecklistCompletion } from '@/types/database';
import { checklistSchema } from '@/lib/validations';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  AlertTriangle,
  X,
  AlertCircle,
  ChevronDown,
  ClipboardList,
  UserPlus,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TrackingPage() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [completions, setCompletions] = useState<ChecklistCompletion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddSoldier, setShowAddSoldier] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [checklistsRes, soldiersRes, completionsRes] = await Promise.all([
        supabase.from('checklists').select('*').order('created_at', { ascending: false }),
        supabase.from('soldiers').select('*').order('full_name'),
        supabase.from('checklist_completions').select('*'),
      ]);

      if (checklistsRes.data) {
        const cls = checklistsRes.data as unknown as Checklist[];
        setChecklists(cls);
        if (cls.length > 0) setSelectedId(cls[0].id);
      }
      if (soldiersRes.data) setSoldiers(soldiersRes.data as unknown as Soldier[]);
      if (completionsRes.data) setCompletions(completionsRes.data as unknown as ChecklistCompletion[]);
      setLoading(false);
    }
    load();

    // Real-time for completions
    const channel = supabase
      .channel('tracking-completions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checklist_completions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setCompletions((prev) => [...prev, payload.new as ChecklistCompletion]);
          } else if (payload.eventType === 'DELETE') {
            setCompletions((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // Completions for selected checklist
  const currentCompletions = useMemo(
    () => completions.filter((c) => c.checklist_id === selectedId),
    [completions, selectedId]
  );

  const completedSoldierIds = useMemo(
    () => new Set(currentCompletions.map((c) => c.soldier_id)),
    [currentCompletions]
  );

  // All soldiers (not just base) for tracking
  const completedSoldiers = useMemo(
    () => soldiers.filter((s) => completedSoldierIds.has(s.id)),
    [soldiers, completedSoldierIds]
  );

  const missingSoldiers = useMemo(
    () => soldiers.filter((s) => !completedSoldierIds.has(s.id)),
    [soldiers, completedSoldierIds]
  );

  const progress = soldiers.length > 0
    ? Math.round((completedSoldiers.length / soldiers.length) * 100)
    : 0;

  async function toggleSoldier(soldierId: string) {
    if (!selectedId) return;

    if (completedSoldierIds.has(soldierId)) {
      const completion = currentCompletions.find((c) => c.soldier_id === soldierId);
      if (completion) {
        setCompletions((prev) => prev.filter((c) => c.id !== completion.id));
        await supabase.from('checklist_completions').delete().eq('id', completion.id);
      }
    } else {
      const tempId = crypto.randomUUID();
      const newCompletion: ChecklistCompletion = {
        id: tempId,
        checklist_id: selectedId,
        soldier_id: soldierId,
        completed_at: new Date().toISOString(),
      };
      setCompletions((prev) => [...prev, newCompletion]);
      const { data } = await supabase
        .from('checklist_completions')
        .insert({ checklist_id: selectedId, soldier_id: soldierId } as never)
        .select()
        .single();
      if (data) {
        setCompletions((prev) =>
          prev.map((c) => (c.id === tempId ? (data as unknown as ChecklistCompletion) : c))
        );
      }
    }
  }

  async function createChecklist(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setCreateLoading(true);

    const formData = new FormData(e.currentTarget);
    const raw = Object.fromEntries(formData);

    try {
      const parsed = checklistSchema.parse(raw);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('לא מחובר');

      const { data: profile } = await supabase
        .from('profiles')
        .select('platoon_id')
        .eq('id', user.id)
        .single();

      const profileData = profile as unknown as { platoon_id: string } | null;
      if (!profileData?.platoon_id) throw new Error('לא נמצאה פלוגה');

      const { data, error: insertError } = await supabase
        .from('checklists')
        .insert({
          title: parsed.title,
          platoon_id: profileData.platoon_id,
          created_by: user.id,
        } as never)
        .select()
        .single();

      if (insertError) throw insertError;
      if (data) {
        const cl = data as unknown as Checklist;
        setChecklists((prev) => [cl, ...prev]);
        setSelectedId(cl.id);
      }
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setCreateLoading(false);
    }
  }

  async function deleteChecklist(clId: string) {
    if (!confirm('למחוק את המעקב?')) return;

    // First delete completions, then the checklist
    await supabase.from('checklist_completions').delete().eq('checklist_id', clId);
    const { error: delError } = await supabase.from('checklists').delete().eq('id', clId);

    if (delError) {
      alert('שגיאה במחיקה: ' + delError.message);
      return;
    }

    setChecklists((prev) => prev.filter((c) => c.id !== clId));
    setCompletions((prev) => prev.filter((c) => c.checklist_id !== clId));
    if (selectedId === clId) {
      const remaining = checklists.filter((c) => c.id !== clId);
      setSelectedId(remaining.length > 0 ? remaining[0].id : null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">מעקבים</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white rounded-xl px-4 py-2.5 font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          מעקב חדש
        </button>
      </div>

      {/* Checklist Selector */}
      {checklists.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {checklists.map((cl) => (
            <button
              key={cl.id}
              onClick={() => setSelectedId(cl.id)}
              className={`flex items-center gap-2 shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium border transition-colors ${
                selectedId === cl.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card border-border hover:bg-card-hover'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              {cl.title}
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <>
          {/* Progress Bar */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {completedSoldiers.length} / {soldiers.length} חיילים השלימו
              </span>
              <span className="text-sm font-bold text-primary">{progress}%</span>
            </div>
            <div className="w-full h-3 bg-background rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShowAddSoldier(true)}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover transition-colors bg-primary/10 rounded-lg px-3 py-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                הוסף חיילים
              </button>
              <button
                onClick={() => deleteChecklist(selectedId)}
                className="flex items-center gap-1.5 text-xs text-accent-red hover:text-accent-red/80 transition-colors bg-accent-red/10 rounded-lg px-3 py-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                מחק מעקב
              </button>
            </div>
          </div>

          {/* Missing Soldiers */}
          {missingSoldiers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-accent-orange" />
                <h2 className="text-sm font-semibold text-accent-orange">
                  חסרים: {missingSoldiers.length} חיילים
                </h2>
              </div>
              {missingSoldiers.map((soldier) => (
                <motion.button
                  key={soldier.id}
                  onClick={() => toggleSoldier(soldier.id)}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 border border-accent-orange/30 bg-accent-orange/5 hover:bg-accent-orange/10 transition-colors text-start"
                >
                  <Circle className="w-6 h-6 text-accent-orange shrink-0" />
                  <span className="font-medium">{soldier.full_name}</span>
                  {soldier.role_in_unit && (
                    <span className="text-xs text-muted-foreground me-auto">
                      {soldier.role_in_unit}
                    </span>
                  )}
                  <span className="text-xs text-accent-orange">
                    {soldier.status === 'Base' ? 'בבסיס' : 'בבית'}
                  </span>
                </motion.button>
              ))}
            </div>
          )}

          {/* Completed Soldiers */}
          {completedSoldiers.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-accent-green flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                השלימו: {completedSoldiers.length} חיילים
              </h2>
              {completedSoldiers.map((soldier) => (
                <motion.button
                  key={soldier.id}
                  onClick={() => toggleSoldier(soldier.id)}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 border border-accent-green/30 bg-accent-green/10 transition-colors text-start"
                >
                  <CheckCircle2 className="w-6 h-6 text-accent-green shrink-0" />
                  <span className="font-medium text-accent-green">{soldier.full_name}</span>
                  {soldier.role_in_unit && (
                    <span className="text-xs text-muted-foreground me-auto">
                      {soldier.role_in_unit}
                    </span>
                  )}
                </motion.button>
              ))}
            </div>
          )}

          {soldiers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg">אין חיילים</p>
              <p className="text-sm">הוסף חיילים מלוח הבקרה</p>
            </div>
          )}
        </>
      )}

      {checklists.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg">אין מעקבים</p>
          <p className="text-sm">צור מעקב חדש כדי לעקוב אחר ביצוע משימות</p>
        </div>
      )}

      {/* Create Checklist Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowCreate(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">מעקב חדש</h2>
                <button
                  onClick={() => setShowCreate(false)}
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

              <form onSubmit={createChecklist} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">שם המעקב</label>
                  <input
                    name="title"
                    required
                    className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="לדוגמה: שיעור בטיחות, הדרכת נשק..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={createLoading}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl px-4 py-3 transition-colors disabled:opacity-50"
                >
                  {createLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      צור מעקב
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Soldiers Modal */}
      <AnimatePresence>
        {showAddSoldier && selectedId && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowAddSoldier(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">סמן חיילים</h2>
                <button
                  onClick={() => setShowAddSoldier(false)}
                  className="p-2 rounded-xl hover:bg-card-hover transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                לחץ על חייל כדי לסמן שהשלים את המשימה
              </p>

              <div className="space-y-2">
                {soldiers.map((soldier) => {
                  const isCompleted = completedSoldierIds.has(soldier.id);
                  return (
                    <button
                      key={soldier.id}
                      onClick={() => toggleSoldier(soldier.id)}
                      className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors text-start ${
                        isCompleted
                          ? 'bg-accent-green/10 border-accent-green/30'
                          : 'bg-background border-border hover:bg-card-hover'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-accent-green shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted shrink-0" />
                      )}
                      <span className={`text-sm font-medium ${isCompleted ? 'text-accent-green' : ''}`}>
                        {soldier.full_name}
                      </span>
                      {soldier.status === 'Home' && (
                        <span className="text-xs text-accent-yellow me-auto">בבית</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setShowAddSoldier(false)}
                className="w-full mt-4 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl px-4 py-3 transition-colors"
              >
                סיום
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
