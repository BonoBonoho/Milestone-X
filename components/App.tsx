
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { MeetingList } from './components/MeetingList';
import { Recorder } from './components/Recorder';
import { MeetingDetail } from './components/MeetingDetail';
import { RecentActivity } from './components/RecentActivity';
import { Settings } from './components/Settings';
import { TaskView } from './components/TaskView';
import { NoteView } from './components/NoteView';
import { StickyNoteView } from './components/StickyNoteView';
import { MeetingListView } from './components/MeetingListView';
import { AdminView } from './components/AdminView';
import { Login } from './components/Login';
import { Meeting, Note, StickyNote, View, MeetingType, KeywordCorrection } from './types';
import { processAudioMeeting } from './services/geminiService';
import { cloudData, cloudAuth } from './services/cloudService';
import { Sparkles, BrainCircuit, MessageSquareText } from 'lucide-react';

const AUTH_KEY = 'bmove_user_session';
const ADMIN_EMAIL = 'dp_hanbono@outlook.kr';

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [view, setView] = useState<View>('dashboard');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [stickers, setStickers] = useState<StickyNote[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const localSession = localStorage.getItem(AUTH_KEY);
      if (localSession) {
        setIsAuthenticated(true);
        setUserEmail(localSession);
        if (localSession === ADMIN_EMAIL) setIsAdmin(true);
      } else {
        const { user } = await cloudAuth.getCurrentUser();
        if (user) handleLogin(user.email);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (userEmail && isAuthenticated) {
      fetchCloudData(userEmail);
    }
  }, [userEmail, isAuthenticated]);

  useEffect(() => {
    if (!userEmail || !isAuthenticated) return;
    const syncInterval = setInterval(() => {
      if (!document.hidden) fetchCloudData(userEmail);
    }, 5000);
    const handleFocus = () => fetchCloudData(userEmail);
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [userEmail, isAuthenticated]);

  const fetchCloudData = async (email: string) => {
    setIsSyncing(true);
    try {
      const [mRes, nRes, sRes] = await Promise.all([
        cloudData.fetchMeetings(email),
        cloudData.fetchNotes(email),
        cloudData.fetchStickers(email)
      ]);
      setMeetings(mRes.data || []);
      setNotes(nRes || []);
      setStickers(sRes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogin = (email: string) => {
    setIsAuthenticated(true);
    setUserEmail(email);
    localStorage.setItem(AUTH_KEY, email);
    if (email === ADMIN_EMAIL) {
        setIsAdmin(true);
        setView('admin');
    } else {
        setIsAdmin(false);
        setView('dashboard');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserEmail(null);
    setIsAdmin(false);
    localStorage.removeItem(AUTH_KEY);
    window.location.reload(); 
  };

  const handleRecordingComplete = async (audioSegments: { base64: string, mimeType: string }[], duration: string, type: MeetingType, keywords: KeywordCorrection[], metadata: any) => {
    if (!userEmail) return;
    setIsProcessing(true);
    try {
      const result = await processAudioMeeting(audioSegments, duration, metadata.title, type, keywords, metadata.speakers);
      
      const meetingDate = new Date(metadata.date).toISOString().split('T')[0];
      
      const newMeeting: Meeting = {
        id: generateUUID(),
        title: metadata.title,
        author: metadata.author,
        category: metadata.category,
        group: '회의록',
        speakers: metadata.speakers,
        date: meetingDate,
        duration,
        type,
        transcript: result.transcript,
        minutes: result.minutes,
        keywords,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await cloudData.saveMeeting(userEmail, newMeeting);
      setMeetings(prev => [newMeeting, ...prev]);
      setSelectedMeeting(newMeeting);
      setView('detail');
    } catch (error) {
      alert("분석 중 오류 발생");
    } finally { setIsProcessing(false); }
  };

  // [New] 노트에서 생성된 회의록을 저장하는 함수
  const handleCreateMeetingFromNote = async (meeting: Meeting) => {
    if (!userEmail) return;
    await cloudData.saveMeeting(userEmail, meeting);
    setMeetings(prev => [meeting, ...prev]);
  };

  const handleCreateList = async (title: string, category: string, group: string = '회의록') => {
    if (!userEmail) return;
    const newList: Meeting = {
      id: generateUUID(),
      title,
      author: userEmail,
      category,
      group,
      speakers: [],
      date: new Date().toISOString().split('T')[0],
      duration: '00:00',
      type: 'list',
      transcript: [],
      minutes: { agenda: [], summary: '', todos: [], schedules: [] },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await cloudData.saveMeeting(userEmail, newList);
    setMeetings(prev => [newList, ...prev]);
  };

  const handleUpdateMeeting = async (updated: Meeting) => {
    if (!userEmail) return;
    const finalUpdate = { ...updated, updatedAt: Date.now() };
    setMeetings(meetings.map(m => m.id === finalUpdate.id ? finalUpdate : m));
    setSelectedMeeting(prev => prev?.id === finalUpdate.id ? finalUpdate : prev);
    await cloudData.saveMeeting(userEmail, finalUpdate);
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!userEmail) return;
    setMeetings(prev => prev.filter(m => m.id !== id));
  };

  const handleUpdateTaskItem = async (meetingId: string, itemId: string, type: 'todo' | 'schedule', updates: any) => {
    if (!userEmail) return;
    const targetMeeting = meetings.find(m => m.id === meetingId);
    if (!targetMeeting) return;
    const newMinutes = JSON.parse(JSON.stringify(targetMeeting.minutes));
    if (type === 'todo') {
        newMinutes.todos = newMinutes.todos.map((t: any) =>
            t.id === itemId ? { ...t, ...updates } : t
        );
    } else {
        newMinutes.schedules = newMinutes.schedules.map((s: any) =>
            s.id === itemId ? { ...s, ...updates } : s
        );
    }
    const updatedMeeting = { ...targetMeeting, minutes: newMinutes, updatedAt: Date.now() };
    setMeetings(prev => prev.map(m => m.id === meetingId ? updatedMeeting : m));
    await cloudData.saveMeeting(userEmail, updatedMeeting);
  };

  const handleSaveNote = async (note: Note) => {
    if (!userEmail) return;
    const existing = notes.find(n => n.id === note.id);
    if (existing) setNotes(notes.map(n => n.id === note.id ? note : n));
    else setNotes([note, ...notes]);
    await cloudData.saveNote(userEmail, note);
  };

  const handleDeleteNote = async (id: string) => {
    if (!userEmail) return;
    setNotes(notes.filter(n => n.id !== id));
    await cloudData.deleteNote(userEmail, id);
  };

  const handleSaveSticker = async (sticker: StickyNote) => {
    if (!userEmail) return;
    const existing = stickers.find(s => s.id === sticker.id);
    if (existing) setStickers(stickers.map(s => s.id === sticker.id ? sticker : s));
    else setStickers([sticker, ...stickers]);
    await cloudData.saveSticker(userEmail, sticker);
  };

  const handleDeleteSticker = async (id: string) => {
    if (!userEmail) return;
    setStickers(stickers.filter(s => s.id !== id));
    await cloudData.deleteSticker(userEmail, id);
  };

  const loadingMessages = [
    { icon: <MessageSquareText className="text-blue-500" />, text: "긴 회의 내용을 분석 중입니다..." },
    { icon: <BrainCircuit className="text-purple-500" />, text: "문맥을 파악하고 요약하는 중..." },
    { icon: <Sparkles className="text-orange-500" />, text: "리포트를 작성하고 있습니다..." }
  ];

  useEffect(() => {
    if (isProcessing) {
      const interval = setInterval(() => setLoadingStep(prev => (prev + 1) % loadingMessages.length), 4000);
      return () => clearInterval(interval);
    }
  }, [isProcessing]);

  if (!isAuthenticated && view !== 'recorder') return <Login onLogin={handleLogin} />;

  return (
    <Layout activeView={view} onNavigate={(v) => { setView(v); setSelectedMeeting(null); }} onLogout={handleLogout} isAdmin={isAdmin}>
      {isProcessing ? (
        <div className="fixed inset-0 bg-white/95 z-[100] flex flex-col items-center justify-center p-6 text-center">
          <div className="relative mb-8">
            <div className="w-24 h-24 border-4 border-blue-100 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center scale-150">{loadingMessages[loadingStep].icon}</div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{loadingMessages[loadingStep].text}</h2>
        </div>
      ) : (
        <>
          {view === 'dashboard' && (
            <MeetingList 
              meetings={meetings} 
              notes={notes}
              stickers={stickers}
              userEmail={userEmail || 'Guest'} 
              isSyncing={isSyncing} 
              onSelectMeeting={(m) => { setSelectedMeeting(m); setView('detail'); }} 
              onSelectNote={(n) => { setView('notes'); }}
              onSelectSticker={() => { setView('stickers'); }}
              onStartNew={() => setView('recorder')} 
              onNavigateToSettings={() => setView('settings')}
            />
          )}
          {view === 'meetings' && (
            <MeetingListView 
              meetings={meetings}
              onSelectMeeting={(m) => { setSelectedMeeting(m); setView('detail'); }}
              onStartNew={() => setView('recorder')}
            />
          )}
          {view === 'notes' && (
            <NoteView 
              notes={notes} 
              userEmail={userEmail || 'Guest'}
              onSaveNote={handleSaveNote} 
              onDeleteNote={handleDeleteNote}
              onCreateMeeting={handleCreateMeetingFromNote}
            />
          )}
          {view === 'stickers' && <StickyNoteView stickers={stickers} onSave={handleSaveSticker} onDelete={handleDeleteSticker} />}
          {view === 'recorder' && <Recorder currentUser={userEmail || 'Guest'} onRecordingComplete={handleRecordingComplete} />}
          {view === 'detail' && selectedMeeting && (
            <MeetingDetail 
              key={selectedMeeting.id}
              meeting={selectedMeeting} 
              onBack={() => setView('dashboard')} 
              onUpdate={handleUpdateMeeting} 
            />
          )}
          {view === 'activity' && <RecentActivity meetings={meetings} onSelectMeeting={(m) => { setSelectedMeeting(m); setView('detail'); }} />}
          {view === 'tasks' && (
            <TaskView 
              meetings={meetings} 
              onSelectMeeting={(m) => { setSelectedMeeting(m); setView('detail'); }} 
              onUpdateItem={handleUpdateTaskItem}
              onCreateList={handleCreateList}
              onUpdateMeeting={handleUpdateMeeting}
              onDeleteMeeting={handleDeleteMeeting}
            />
          )}
          {view === 'settings' && <Settings userEmail={userEmail || 'Guest'} onLogout={handleLogout} />}
          {view === 'admin' && isAdmin && <AdminView onLogout={handleLogout} />}
        </>
      )}
    </Layout>
  );
};

export default App;
