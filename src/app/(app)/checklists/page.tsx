'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import type { Soldier } from '@/types/database';
import {
  CheckCircle2,
  Circle,
  RotateCcw,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function AttendancePage() {
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('soldiers')
        .select('*')
        .order('full_name');
      if (data) setSoldiers(data as unknown as Soldier[]);
      setLoading(false);
    }
    load();

    // Real-time for soldier status changes
    const channel = supabase
      .channel('soldiers-attendance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'soldiers' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSoldiers((prev) => [...prev, payload.new as Soldier].sort((a, b) =>
              a.full_name.localeCompare(b.full_name)
            ));
          } else if (payload.eventType === 'UPDATE') {
            setSoldiers((prev) =>
              prev.map((s) => (s.id === (payload.new as Soldier).id ? (payload.new as Soldier) : s))
            );
          } else if (payload.eventType === 'DELETE') {
            setSoldiers((prev) => prev.filter((s) => s.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const baseSoldiers = useMemo(
    () => soldiers.filter((s) => s.status === 'Base'),
    [soldiers]
  );

  const checkedCount = useMemo(
    () => baseSoldiers.filter((s) => checkedIds.has(s.id)).length,
    [baseSoldiers, checkedIds]
  );

  const progress = baseSoldiers.length > 0
    ? Math.round((checkedCount / baseSoldiers.length) * 100)
    : 0;

  function toggleSoldier(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function resetAll() {
    setCheckedIds(new Set());
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
        <h1 className="text-2xl font-bold">נוכחות</h1>
        <button
          onClick={resetAll}
          disabled={checkedIds.size === 0}
          className="flex items-center gap-2 bg-accent-red/10 hover:bg-accent-red/20 text-accent-red rounded-xl px-4 py-2.5 font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-5 h-5" />
          איפוס סימונים
        </button>
      </div>

      {/* Progress Bar */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {checkedCount} / {baseSoldiers.length} חיילים בבסיס
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
      </div>

      {/* Soldier List */}
      <div className="space-y-2">
        {baseSoldiers.map((soldier) => {
          const isChecked = checkedIds.has(soldier.id);
          return (
            <motion.button
              key={soldier.id}
              onClick={() => toggleSoldier(soldier.id)}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 border transition-colors text-start ${
                isChecked
                  ? 'bg-accent-green/10 border-accent-green/30'
                  : 'bg-card border-border hover:bg-card-hover'
              }`}
            >
              {isChecked ? (
                <CheckCircle2 className="w-6 h-6 text-accent-green shrink-0" />
              ) : (
                <Circle className="w-6 h-6 text-muted shrink-0" />
              )}
              <span className={`font-medium ${isChecked ? 'text-accent-green' : ''}`}>
                {soldier.full_name}
              </span>
              {soldier.role_in_unit && (
                <span className="text-xs text-muted-foreground me-auto">
                  {soldier.role_in_unit}
                </span>
              )}
            </motion.button>
          );
        })}

        {baseSoldiers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">אין חיילים בבסיס</p>
          </div>
        )}
      </div>
    </div>
  );
}
