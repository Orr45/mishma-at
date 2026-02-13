import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerSupabaseClient } from '@/lib/supabase-server';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Fetch all relevant data in parallel
    const [soldiersRes, eventsRes, checklistsRes, newsRes] = await Promise.all([
      supabase.from('soldiers').select('*'),
      supabase.from('events').select('*, soldier:soldiers(full_name)').order('created_at', { ascending: false }).limit(50),
      supabase.from('checklists').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('news').select('*').order('created_at', { ascending: false }).limit(10),
    ]);

    const soldiers = soldiersRes.data || [];
    const events = eventsRes.data || [];
    const checklists = checklistsRes.data || [];
    const news = newsRes.data || [];

    // Build data summary for system prompt
    const baseSoldiers = soldiers.filter((s) => s.status === 'Base');
    const homeSoldiers = soldiers.filter((s) => s.status === 'Home');
    const activeEvents = events.filter((e) => !e.ended_at);
    const soldierRequests = activeEvents.filter((e) => e.source === 'soldier');

    const systemPrompt = `אתה עוזר AI חכם למפקד בצה"ל. אתה עוזר לנהל חיילים, אירועים, נוכחות וחדשות.
ענה תמיד בעברית. תהיה תמציתי ומדויק.

נתונים נוכחיים של הפלוגה:

📊 סיכום:
- סה"כ חיילים: ${soldiers.length}
- בבסיס: ${baseSoldiers.length}
- בבית: ${homeSoldiers.length}
- אירועים פתוחים: ${activeEvents.length}
- בקשות חיילים ממתינות: ${soldierRequests.length}

👥 חיילים בבסיס:
${baseSoldiers.map((s) => `- ${s.full_name}${s.role_in_unit ? ` (${s.role_in_unit})` : ''}${s.notes ? ` [הערה: ${s.notes}]` : ''}`).join('\n') || 'אין'}

🏠 חיילים בבית:
${homeSoldiers.map((s) => `- ${s.full_name}${s.role_in_unit ? ` (${s.role_in_unit})` : ''}${s.notes ? ` [הערה: ${s.notes}]` : ''}`).join('\n') || 'אין'}

📋 אירועים פתוחים:
${activeEvents.map((e) => {
  const soldierName = (e as Record<string, unknown>).soldier && ((e as Record<string, unknown>).soldier as { full_name: string }).full_name;
  return `- [${e.category}] ${e.description}${soldierName ? ` (${soldierName})` : ''}${e.source === 'soldier' ? ' ⚠️ בקשת חייל' : ''} - ${new Date(e.created_at).toLocaleDateString('he-IL')}`;
}).join('\n') || 'אין אירועים פתוחים'}

📰 חדשות אחרונות:
${news.map((n) => `- ${n.title}: ${n.content}`).join('\n') || 'אין חדשות'}

✅ רשימות נוכחות אחרונות:
${checklists.map((c) => `- ${c.title} (${new Date(c.created_at).toLocaleDateString('he-IL')})`).join('\n') || 'אין'}

אתה יכול לעזור עם:
- סיכומי מצב הפלוגה
- מידע על חיילים ספציפיים
- ניתוח אירועים ומגמות
- טיפים לניהול
- כל שאלה שקשורה לפלוגה`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10), // Keep last 10 messages for context
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const reply = response.choices[0]?.message?.content || 'לא הצלחתי לענות, נסה שוב.';

    return NextResponse.json({ message: reply });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}
