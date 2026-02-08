
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Meeting, Note, StickyNote } from '../types';

// [Production Config] Prefer env, fallback to bundled defaults
const PROJECT_ID = 'aycfjxdnlnenyynabfsl';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || `https://${PROJECT_ID}.supabase.co`;
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Y2ZqeGRubG5lbnl5bmFiZnNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5Njk5NjgsImV4cCI6MjA4NTU0NTk2OH0.JmPXEtxeAte0WhAjuQsnZ5CSeN6X49mXH1o-IjnqdsM';

// Helper to check if credentials exist (Always true now)
export const hasSavedCredentials = () => true;

let supabase: SupabaseClient | null = null;
let forceLocal = false;

try {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error("Failed to initialize Supabase client:", e);
}

// Deprecated: No-op as config is hardcoded
export const updateCloudConfig = (url: string, key: string) => {
    console.warn("Cloud config is hardcoded in production build.");
};

export const getCloudConfig = () => {
  if (supabase && !forceLocal) return { url: SUPABASE_URL };
  return null;
};

// Local DB Helpers (Fallback / Offline support)
const DB_KEY = 'bmove_local_db';
const INITIAL_DB = { users: {}, meetings: {}, notes: {}, stickers: {} };

export const loadLocalDB = () => {
  try {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : INITIAL_DB;
  } catch {
    return INITIAL_DB;
  }
};

const saveLocalDB = (data: any) => {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
};

export const checkSystemHealth = async () => {
  if (!supabase || forceLocal) return { status: 'local', message: 'Running in local mode' };
  try {
    const { error } = await supabase.from('meetings').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return { status: 'healthy', message: 'Connected to Supabase' };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
};

export const cloudAuth = {
  setForceLocal: (val: boolean) => { forceLocal = val; },
  
  getCurrentUser: async () => {
    if (supabase && !forceLocal) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) return { user: { email: user.email, id: user.id } };
    }
    return { user: null };
  },

  signup: async (email: string, password: string, name: string) => {
    if (supabase && !forceLocal) {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: { full_name: name } }
      });
      if (error) return { success: false, message: error.message };
      return { success: true };
    }
    
    // Local Signup Fallback
    const db = loadLocalDB();
    if (db.users[email]) return { success: false, message: 'User already registered' };
    db.users[email] = { name, password }; 
    saveLocalDB(db);
    return { success: true };
  },

  login: async (email: string, password: string) => {
    if (supabase && !forceLocal) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, message: error.message };
      return { success: true };
    }

    // Local Login Fallback
    const db = loadLocalDB();
    const user = db.users[email];
    if (user && user.password === password) return { success: true };
    return { success: false, message: 'Invalid login credentials' };
  },

  ensureAccount: async (email: string, password: string, name: string) => {
     // Usually for guest mode in local only
     const db = loadLocalDB();
     if (!db.users[email]) {
         db.users[email] = { name, password };
         saveLocalDB(db);
     }
     return true;
  }
};

export const cloudData = {
  isCloudConnected: () => !!supabase && !forceLocal,

  findLocalDemoData: (email: string) => {
      const db = loadLocalDB();
      return (db.meetings['guest@milestone.x'] || []).length;
  },

  importLocalDemoData: async (targetEmail: string) => {
      const db = loadLocalDB();
      const demoData = db.meetings['guest@milestone.x'] || [];
      if(demoData.length === 0) return { success: false, message: 'No demo data found' };

      // In production, we might want to push this to cloud
      // For now, we just merge locally or if online, try to save to cloud
      if (supabase && !forceLocal) {
          for (const m of demoData) {
              await cloudData.saveMeeting(targetEmail, m);
          }
          return { success: true };
      }

      if(!db.meetings[targetEmail]) db.meetings[targetEmail] = [];
      db.meetings[targetEmail] = [...db.meetings[targetEmail], ...demoData];
      saveLocalDB(db);
      return { success: true };
  },

  fetchMeetings: async (email: string) => {
    if (supabase && !forceLocal) {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false });
        
      if (!error && data) {
         return { data: data.map((d: any) => ({ ...d.content, id: d.id })) };
      }
    }
    const db = loadLocalDB();
    return { data: db.meetings[email] || [] };
  },

  saveMeeting: async (email: string, meeting: Meeting) => {
    if (supabase && !forceLocal) {
      const { error } = await supabase
        .from('meetings')
        .upsert({ 
            id: meeting.id, 
            user_email: email, 
            content: meeting,
            created_at: new Date(meeting.createdAt).toISOString()
        });
      if (error) throw error;
      return;
    }
    const db = loadLocalDB();
    const list = db.meetings[email] || [];
    const idx = list.findIndex((m: Meeting) => m.id === meeting.id);
    if (idx >= 0) list[idx] = meeting;
    else list.unshift(meeting);
    db.meetings[email] = list;
    saveLocalDB(db);
  },

  fetchNotes: async (email: string) => {
    if (supabase && !forceLocal) {
        const { data } = await supabase.from('notes').select('*').eq('user_email', email);
        if (data) return data.map((d: any) => ({ ...d.content, id: d.id }));
    }
    const db = loadLocalDB();
    return db.notes[email] || [];
  },

  saveNote: async (email: string, note: Note) => {
     if (supabase && !forceLocal) {
         await supabase.from('notes').upsert({ id: note.id, user_email: email, content: note });
         return;
     }
     const db = loadLocalDB();
     const list = db.notes[email] || [];
     const idx = list.findIndex((n: Note) => n.id === note.id);
     if (idx >= 0) list[idx] = note;
     else list.unshift(note);
     db.notes[email] = list;
     saveLocalDB(db);
  },

  deleteNote: async (email: string, id: string) => {
     if (supabase && !forceLocal) {
         await supabase.from('notes').delete().eq('id', id);
         return;
     }
     const db = loadLocalDB();
     if(db.notes[email]) {
         db.notes[email] = db.notes[email].filter((n: Note) => n.id !== id);
         saveLocalDB(db);
     }
  },

  fetchStickers: async (email: string) => {
    if (supabase && !forceLocal) {
        const { data } = await supabase.from('stickers').select('*').eq('user_email', email);
        if (data) return data.map((d: any) => ({ ...d.content, id: d.id }));
    }
    const db = loadLocalDB();
    return db.stickers[email] || [];
  },

  saveSticker: async (email: string, sticker: StickyNote) => {
     if (supabase && !forceLocal) {
         await supabase.from('stickers').upsert({ id: sticker.id, user_email: email, content: sticker });
         return;
     }
     const db = loadLocalDB();
     const list = db.stickers[email] || [];
     const idx = list.findIndex((s: StickyNote) => s.id === sticker.id);
     if (idx >= 0) list[idx] = sticker;
     else list.unshift(sticker);
     db.stickers[email] = list;
     saveLocalDB(db);
  },

  deleteSticker: async (email: string, id: string) => {
     if (supabase && !forceLocal) {
         await supabase.from('stickers').delete().eq('id', id);
         return;
     }
     const db = loadLocalDB();
     if(db.stickers[email]) {
         db.stickers[email] = db.stickers[email].filter((s: StickyNote) => s.id !== id);
         saveLocalDB(db);
     }
  }
};
