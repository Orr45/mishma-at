'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import type { Soldier, News } from '@/types/database';
import { Search, Users, Home, Building2, Plus, Filter, Trash2, MessageCircle, Newspaper, Pencil, X, Save, StickyNote, Check } from 'lucide-react';
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

  // Quick note state
  const [noteEditId, setNoteEditId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // News state
  const [newsList, setNewsList] = useState<News[]>([]);
  const [showNewsForm, setShowNewsForm] = useState(false);
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsSaving, setNewsSaving] = useState(false);

  // Fetch soldiers + news
  useEffect(() => {
    async function fetchData() {
      const [soldiersRes, newsRes] = await Promise.all([
        supabase.from('soldiers').select('*').order('full_name'),
        supabase.from('news').select('*').order('created_at', { ascending: false }),
      ]);
      if (soldiersRes.data) setSoldiers(soldiersRes.data as unknown as Soldier[]);
      if (newsRes.data) setNewsList(newsRes.data as unknown as News[]);
      setLoading(false);
    }
    fetchData();

    // Real-time subscription
    const channel = supabase
      .channel('dashboard-changes')
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

  // Quick note
  function openNote(soldier: Soldier) {
    setNoteEditId(soldier.id);
    setNoteText(soldier.notes || '');
  }

  async function saveNote(soldierId: string) {
    const trimmed = noteText.trim() || null;
    setSoldiers((prev) =>
      prev.map((s) => (s.id === soldierId ? { ...s, notes: trimmed } : s))
    );
    setNoteEditId(null);
    await supabase.from('soldiers').update({ notes: trimmed } as never).eq('id', soldierId);
  }

  // News CRUD
  function openNewsForm(item?: News) {
    if (item) {
      setEditingNews(item);
      setNewsTitle(item.title);
      setNewsContent(item.content);
    } else {
      setEditingNews(null);
      setNewsTitle('');
      setNewsContent('');
    }
    setShowNewsForm(true);
  }

  async function saveNews() {
    if (!newsTitle.trim() || !newsContent.trim()) return;
    setNewsSaving(true);
    try {
      if (editingNews) {
        const { error } = await supabase
          .from('news')
          .update({ title: newsTitle.trim(), content: newsContent.trim(), updated_at: new Date().toISOString() } as never)
          .eq('id', editingNews.id);
        if (error) throw error;
        setNewsList((prev) =>
          prev.map((n) =>
            n.id === editingNews.id ? { ...n, title: newsTitle.trim(), content: newsContent.trim(), updated_at: new Date().toISOString() } : n
          )
        );
      } else {
        const { data, error } = await supabase
          .from('news')
          .insert({ title: newsTitle.trim(), content: newsContent.trim(), platoon_id: 'default' } as never)
          .select()
          .single();
        if (error) throw error;
        if (data) setNewsList((prev) => [data as unknown as News, ...prev]);
      }
      setShowNewsForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'שגיאה בשמירה');
    } finally {
      setNewsSaving(false);
    }
  }

  async function deleteNews(id: string) {
    if (!confirm('למחוק את ההודעה?')) return;
    setNewsList((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from('news').delete().eq('id', id);
    if (error) alert('שגיאה במחיקה: ' + error.message);
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

      {/* News Section */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">חדשות</h2>
          </div>
          <button
            onClick={() => openNewsForm()}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl px-3 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            הודעה חדשה
          </button>
        </div>

        {newsList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">אין הודעות עדיין</p>
        ) : (
          <div className="space-y-2">
            {newsList.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-background border border-border rounded-xl p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{item.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.content}</p>
                    <span className="text-[10px] text-muted mt-2 block">
                      {new Date(item.created_at).toLocaleDateString('he-IL', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                      {item.updated_at !== item.created_at && ' (עודכן)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openNewsForm(item)}
                      className="p-1.5 rounded-lg hover:bg-card-hover text-muted hover:text-foreground transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteNews(item.id)}
                      className="p-1.5 rounded-lg hover:bg-accent-red/10 text-muted hover:text-accent-red transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* News Form Modal */}
      <AnimatePresence>
        {showNewsForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowNewsForm(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{editingNews ? 'עריכת הודעה' : 'הודעה חדשה'}</h2>
                <button onClick={() => setShowNewsForm(false)} className="p-2 rounded-xl hover:bg-card-hover transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">כותרת</label>
                  <input
                    value={newsTitle}
                    onChange={(e) => setNewsTitle(e.target.value)}
                    className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="כותרת ההודעה..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">תוכן</label>
                  <textarea
                    value={newsContent}
                    onChange={(e) => setNewsContent(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="תוכן ההודעה..."
                  />
                </div>
                <button
                  onClick={saveNews}
                  disabled={newsSaving || !newsTitle.trim() || !newsContent.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl px-4 py-3 transition-colors disabled:opacity-50"
                >
                  {newsSaving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {editingNews ? 'עדכן' : 'פרסם'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                    onClick={(e) => { e.preventDefault(); openNote(soldier); }}
                    className={`p-2 rounded-xl transition-colors ${
                      soldier.notes
                        ? 'text-accent-yellow hover:bg-accent-yellow/10'
                        : 'text-muted hover:text-foreground hover:bg-card-hover'
                    }`}
                    aria-label={`הערה ${soldier.full_name}`}
                  >
                    <StickyNote className="w-4 h-4" />
                  </button>
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

              {/* Show existing note */}
              {soldier.notes && noteEditId !== soldier.id && (
                <p className="text-xs text-accent-yellow/80 mt-2 bg-accent-yellow/5 rounded-lg px-2.5 py-1.5 border border-accent-yellow/10">
                  {soldier.notes}
                </p>
              )}

              {/* Inline note editor */}
              {noteEditId === soldier.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 flex gap-2"
                >
                  <input
                    autoFocus
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveNote(soldier.id); if (e.key === 'Escape') setNoteEditId(null); }}
                    placeholder="הערה מהירה..."
                    className="flex-1 rounded-xl bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={() => saveNote(soldier.id)}
                    className="p-2 rounded-xl bg-accent-green/10 text-accent-green hover:bg-accent-green/20 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setNoteEditId(null)}
                    className="p-2 rounded-xl bg-card-hover text-muted hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
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
