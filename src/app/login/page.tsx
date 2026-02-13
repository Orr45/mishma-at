'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { loginSchema, signupSchema } from '@/lib/validations';
import { Shield, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    try {
      if (isSignup) {
        const parsed = signupSchema.parse(data);
        const { error: signupError } = await supabase.auth.signUp({
          email: parsed.email,
          password: parsed.password,
          options: {
            data: {
              full_name: parsed.full_name,
              role: parsed.role,
              platoon_id: parsed.platoon_id,
            },
          },
        });
        if (signupError) throw signupError;
      } else {
        const parsed = loginSchema.parse(data);
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: parsed.email,
          password: parsed.password,
        });
        if (loginError) throw loginError;
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('שגיאה לא צפויה');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">משמעת</h1>
          <p className="text-muted-foreground mt-1">מערכת לניהול חיילים</p>
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-6 text-center">
            {isSignup ? 'הרשמה' : 'כניסה למערכת'}
          </h2>

          {error && (
            <div className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/30 text-accent-red rounded-xl p-3 mb-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">שם מלא</label>
                  <input
                    name="full_name"
                    type="text"
                    required
                    className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="ישראל ישראלי"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">תפקיד</label>
                  <select
                    name="role"
                    className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="SL">מ&quot;כ (מפקד כיתה)</option>
                    <option value="SGT">סמל</option>
                    <option value="PC">מ&quot;פ (מפקד פלוגה)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">מזהה פלוגה</label>
                  <input
                    name="platoon_id"
                    type="text"
                    required
                    className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="פלוגה-א"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">אימייל</label>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="example@army.mil"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">סיסמה</label>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                className="w-full rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl px-4 py-3 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isSignup ? (
                <>
                  <UserPlus className="w-5 h-5" />
                  הרשמה
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  כניסה
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setIsSignup(!isSignup); setError(''); }}
              className="text-sm text-primary hover:text-primary-hover transition-colors"
            >
              {isSignup ? 'יש לך כבר חשבון? כניסה' : 'אין לך חשבון? הרשמה'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
