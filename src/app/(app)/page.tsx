'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import type { Soldier } from '@/types/database';
import { Search, Users, Home, Building2, Plus, Filter, Trash2, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import AddSoldierModal from '@/components/AddSoldierModal';

export default function DashboardPage() {
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Base' | 'Home'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Fetch soldiers
  useEffect(() => {
    async function fetchSoldiers() {
      const { data } = await supabase
        .from('soldiers')
        .select('*')
        .order('full_name');
      if (data) setSoldiers(data as unknown as Soldier[]);
      setLoading(false);
    }
    fetchSoldiers();

    // Real-time subscription
    const channel = supabase
      .channel('soldiers-changes')
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Toggle status
  async function toggleStatus(soldier: Soldier) {
    const newStatus = soldier.status === 'Base' ? 'Home' : 'Base';
    // Optimistic update
    setSoldiers((prev) =>
      prev.map((s) => (s.id === soldier.id ? { ...s, status: newStatus } : s))
    );
    await supabase
      .from('soldiers')
      .update({ status: newStatus } as never)
      .eq('id', soldier.id);
  }

  // Delete soldier
  async function deleteSoldier(soldier: Soldier) {
    if (!confirm(`למחוק את ${soldier.full_name}?`)) return;
    setSoldiers((prev) => prev.filter((s) => s.id !== soldier.id));
    await supabase.from('soldiers').delete().eq('id', soldier.id);
  }

  // Move all soldiers
  async function moveAll(status: 'Base' | 'Home') {
    setSoldiers((prev) => prev.map((s) => ({ ...s, status })));
    const ids = soldiers.map((s) => s.id);
    for (const id of ids) {
      await supabase.from('soldiers').update({ status } as never).eq('id', id);
    }
  }

  // WhatsApp report
  function sendWhatsAppReport() {
    const hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const now = new Date();
    const dayName = hebrewDays[now.getDay()];
    const dateStr = now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });

    const baseSoldiers = soldiers.filter((s) => s.status === 'Base');
    const homeSoldiers = soldiers.filter((s) => s.status === 'Home');

    let msg = `יום ${dayName} (${dateStr})\n`;
    msg += `מחלקה 1\n\n`;
    msg += `בבסיס (${baseSoldiers.length}):\n`;
    baseSoldiers.forEach((s) => { msg += `• ${s.full_name}\n`; });
    msg += `\nבבית (${homeSoldiers.length}):\n`;
    homeSoldiers.forEach((s) => { msg += `• ${s.full_name}\n`; });

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  // Filtered and searched soldiers
  const filtered = useMemo(() => {
    return soldiers.filter((s) => {
      const matchesSearch = s.full_name.includes(search) ||
        (s.role_in_unit && s.role_in_unit.includes(search));
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [soldiers, search, statusFilter]);

  const totalCount = soldiers.length;
  const baseCount = soldiers.filter((s) => s.status === 'Base').length;
  const homeCount = soldiers.filter((s) => s.status === 'Home').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">לוח בקרה</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={sendWhatsAppReport}
            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-xl px-4 py-2.5 font-medium transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            דוח 1
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white rounded-xl px-4 py-2.5 font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            הוסף חייל
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div
          whileTap={{ scale: 0.97 }}
          onClick={() => setStatusFilter('all')}
          className={`cursor-pointer rounded-2xl p-4 border transition-colors ${
            statusFilter === 'all'
              ? 'bg-primary/20 border-primary'
              : 'bg-card border-border hover:bg-card-hover'
          }`}
        >
          <Users className="w-6 h-6 text-primary mb-2" />
          <div className="text-3xl font-bold">{totalCount}</div>
          <div className="text-sm text-muted-foreground">סה&quot;כ</div>
        </motion.div>

        <motion.div
          whileTap={{ scale: 0.97 }}
          onClick={() => setStatusFilter('Base')}
          className={`cursor-pointer rounded-2xl p-4 border transition-colors ${
            statusFilter === 'Base'
              ? 'bg-accent-green/20 border-accent-green'
              : 'bg-card border-border hover:bg-card-hover'
          }`}
        >
          <Building2 className="w-6 h-6 text-accent-green mb-2" />
          <div className="text-3xl font-bold text-accent-green">{baseCount}</div>
          <div className="text-sm text-muted-foreground">בבסיס</div>
        </motion.div>

        <motion.div
          whileTap={{ scale: 0.97 }}
          onClick={() => setStatusFilter('Home')}
          className={`cursor-pointer rounded-2xl p-4 border transition-colors ${
            statusFilter === 'Home'
              ? 'bg-accent-yellow/20 border-accent-yellow'
              : 'bg-card border-border hover:bg-card-hover'
          }`}
        >
          <Home className="w-6 h-6 text-accent-yellow mb-2" />
          <div className="text-3xl font-bold text-accent-yellow">{homeCount}</div>
          <div className="text-sm text-muted-foreground">בבית</div>
        </motion.div>
      </div>

      {/* Move All Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => moveAll('Base')}
          className="flex-1 flex items-center justify-center gap-2 bg-accent-green/10 hover:bg-accent-green/20 text-accent-green border border-accent-green/30 rounded-xl px-4 py-2.5 font-medium transition-colors text-sm"
        >
          <Building2 className="w-4 h-4" />
          כולם לבסיס
        </button>
        <button
          onClick={() => moveAll('Home')}
          className="flex-1 flex items-center justify-center gap-2 bg-accent-yellow/10 hover:bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/30 rounded-xl px-4 py-2.5 font-medium transition-colors text-sm"
        >
          <Home className="w-4 h-4" />
          כולם הביתה
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או תפקיד..."
            className="w-full rounded-xl bg-card border border-border pe-10 ps-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={() => setStatusFilter(statusFilter === 'all' ? 'Base' : statusFilter === 'Base' ? 'Home' : 'all')}
          className="flex items-center gap-2 rounded-xl bg-card border border-border px-4 py-3 hover:bg-card-hover transition-colors"
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Soldier Feed */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map((soldier) => (
            <motion.div
              key={soldier.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card border border-border rounded-2xl p-4 hover:bg-card-hover transition-colors"
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/soldiers/${soldier.id}`}
                  className="flex-1 min-w-0"
                >
                  <h3 className="font-semibold text-lg truncate">
                    {soldier.full_name}
                  </h3>
                  {soldier.role_in_unit && (
                    <p className="text-sm text-muted-foreground truncate">
                      {soldier.role_in_unit}
                    </p>
                  )}
                </Link>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      soldier.status === 'Base'
                        ? 'bg-accent-green/20 text-accent-green'
                        : 'bg-accent-yellow/20 text-accent-yellow'
                    }`}
                  >
                    {soldier.status === 'Base' ? 'בבסיס' : 'בבית'}
                  </span>
                  <button
                    onClick={(e) => { e.preventDefault(); toggleStatus(soldier); }}
                    className={`toggle-switch ${soldier.status === 'Base' ? 'active' : 'inactive'}`}
                    aria-label={`שנה סטטוס ${soldier.full_name}`}
                  />
                  <button
                    onClick={(e) => { e.preventDefault(); deleteSoldier(soldier); }}
                    className="p-2 rounded-xl text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors"
                    aria-label={`מחק ${soldier.full_name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">לא נמצאו חיילים</p>
            <p className="text-sm">נסה לשנות את החיפוש או הפילטר</p>
          </div>
        )}
      </div>

      {/* Add Soldier Modal */}
      {showAddModal && (
        <AddSoldierModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
