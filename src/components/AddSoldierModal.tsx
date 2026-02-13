'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { soldierSchema } from '@/lib/validations';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onClose: () => void;
}

export default function AddSoldierModal({ onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const raw = Object.fromEntries(formData);

    try {
      // Get current user's platoon
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('לא מחובר');

      const { data: profile } = await supabase
        .from('profiles')
        .select('platoon_id')
        .eq('id', user.id)
        .single();

      const profileData = profile as unknown as { platoon_id: string } | null;
      if (!profileData?.platoon_id) throw new Error('לא נמצאה פלוגה');

      const parsed = soldierSchema.parse({
        ...raw,
        status: 'Base',
        platoon_id: profileData.platoon_id,
      });

      const { error: insertError } = await supabase
        .from('soldiers')
        .insert({ ...parsed, created_by: user.id } as never);

      if (insertError) throw insertError;
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">הוספת חייל חדש</h2>
          <button
            onClick={onClose}
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
            <label className="block text-sm font-medium mb-1">שם מלא *</label>
            <input
              name="full_name"
              required
              className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="ישראל ישראלי"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">תפקיד ביחידה</label>
            <input
              name="role_in_unit"
              className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="לוחם, נהג, קשר..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">מספר נשק</label>
            <input
              name="weapon_serial"
              className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="מס&apos; סידורי"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">מקצוע אזרחי</label>
            <input
              name="civilian_job"
              className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="מהנדס, רופא..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">הערות</label>
            <textarea
              name="notes"
              rows={3}
              className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="הערות נוספות..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl px-4 py-3 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                הוסף חייל
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
