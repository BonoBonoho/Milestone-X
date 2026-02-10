
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
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
import { ScheduleView } from './components/ScheduleView';
import { AdminView } from './components/AdminView';
import { Login } from './components/Login';
import { Meeting, Note, StickyNote, View, MeetingType, KeywordCorrection, BackgroundJobStatus, ScheduleItem } from './types';
import { enqueueAudioMeeting, fetchJobStatus, retryJob } from './services/geminiService';
import { cloudData, cloudAuth } from './services/cloudService';
import { Sparkles, BrainCircuit, MessageSquareText } from 'lucide-react';

const AUTH_KEY = 'bmove_user_session';
const ADMIN_EMAIL = 'dp_hanbono@outlook.kr';
const PENDING_JOBS_KEY = 'bmove_pending_jobs';
const JOB_APPLIED_KEY = 'bmove_job_applied';
const JOB_NOTIFIED_KEY = 'bmove_job_notified';
const DEFAULT_CATEGORIES = ['프로젝트 회의', '데일리 스크럼', '아이디어 브레인스토밍', '개인 회고', '파일 업로드', '기타'];
const PERSONAL_SCHEDULE_TITLE = '내 일정';
const PERSONAL_SCHEDULE_CATEGORY = '내 일정';
const PERSONAL_SCHEDULE_GROUP = '개인';

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
  const [pendingJobs, setPendingJobs] = useState<BackgroundJobStatus[]>([]);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const userEmailRef = useRef<string | null>(null);
  const meetingsRef = useRef<Meeting[]>([]);
  const notesRef = useRef<Note[]>([]);
  const isPopStateRef = useRef(false);
  const shouldTrapBackRef = useRef(false);

  const requestNotificationPermission = async () => {
    if (Capacitor.isNativePlatform()) {
      try { await LocalNotifications.requestPermissions(); } catch {}
      return;
    }
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
  };

  const shouldNotifyForJob = (jobId: string) => {
    if (!userEmail) return false;
    try {
      const raw = localStorage.getItem(`${JOB_NOTIFIED_KEY}:${userEmail}`);
      const set = new Set<string>(raw ? JSON.parse(raw) : []);
      if (set.has(jobId)) return false;
      set.add(jobId);
      localStorage.setItem(`${JOB_NOTIFIED_KEY}:${userEmail}`, JSON.stringify(Array.from(set)));
      return true;
    } catch {
      return true;
    }
  };

  const markAppliedJob = (jobId: string) => {
    if (!userEmail) return;
    try {
      const raw = localStorage.getItem(`${JOB_APPLIED_KEY}:${userEmail}`);
      const set = new Set<string>(raw ? JSON.parse(raw) : []);
      set.add(jobId);
      localStorage.setItem(`${JOB_APPLIED_KEY}:${userEmail}`, JSON.stringify(Array.from(set)));
    } catch {}
  };

  const isJobApplied = (jobId: string) => {
    if (!userEmail) return false;
    try {
      const raw = localStorage.getItem(`${JOB_APPLIED_KEY}:${userEmail}`);
      const set = new Set<string>(raw ? JSON.parse(raw) : []);
      return set.has(jobId);
    } catch {
      return false;
    }
  };

  const notifyJobCompleted = (job: BackgroundJobStatus) => {
    try {
      const title = '분석 완료';
      const body = job.title ? `${job.title} 회의록이 준비되었습니다.` : '회의록이 준비되었습니다.';
      if (Capacitor.isNativePlatform()) {
        if (!shouldNotifyForJob(job.jobId)) return;
        LocalNotifications.schedule({
          notifications: [{
            id: Date.now() % 2147483647,
            title,
            body,
            extra: { jobId: job.jobId },
          }],
        }).catch(() => {});
        return;
      }
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      if (!shouldNotifyForJob(job.jobId)) return;
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (!reg) throw new Error('no-sw');
          return reg.showNotification(title, {
            body,
            tag: job.jobId,
            data: { jobId: job.jobId },
            actions: [{ action: 'open', title: '회의록 열기' }],
            renotify: false,
          } as any);
        }).catch(() => {
          const notification = new Notification(title, { body });
          notification.onclick = () => {
            try { window.focus(); } catch {}
            openMeetingForJob(job.jobId);
          };
        });
      } else {
        const notification = new Notification(title, { body });
        notification.onclick = () => {
          try { window.focus(); } catch {}
          openMeetingForJob(job.jobId);
        };
      }
    } catch {}
  };

  const openMeetingForJob = async (jobId: string) => {
    const existing = meetingsRef.current.find(m => m.jobId === jobId);
    if (existing) {
      setSelectedMeeting(existing);
      setView('detail');
      return;
    }
    const email = userEmailRef.current;
    if (!email) return;
    const data = await fetchCloudData(email);
    const meeting = data.meetings.find(m => m.jobId === jobId);
    if (meeting) {
      setSelectedMeeting(meeting);
      setView('detail');
    }
  };

  const appendMeetingToNote = async (job: BackgroundJobStatus): Promise<boolean> => {
    if (!job.noteId || !userEmail) return true;
    if (isJobApplied(job.jobId)) return true;
    const meeting = meetingsRef.current.find(m => m.jobId === job.jobId);
    if (!meeting) return false;
    const note = notesRef.current.find(n => n.id === job.noteId);
    if (!note) return true;
    const lines: string[] = [];
    lines.push('');
    lines.push('## 🎙️ 녹음 요약');
    lines.push(`- 작업 ID: ${job.jobId}`);
    if (meeting.minutes?.summary) {
      lines.push('');
      lines.push('> ' + meeting.minutes.summary);
    }
    if (meeting.minutes?.agenda?.length) {
      lines.push('');
      lines.push('### 📌 주요 안건');
      meeting.minutes.agenda.forEach(a => lines.push(`- ${a}`));
    }
    if (meeting.minutes?.todos?.length) {
      lines.push('');
      lines.push('### ✅ 액션 아이템');
      meeting.minutes.todos.forEach(t => {
        const assignee = t.assignee ? ` (@${t.assignee})` : '';
        const due = t.dueDate ? ` 📅 ${t.dueDate}` : '';
        lines.push(`- [ ] ${t.task}${assignee}${due}`);
      });
    }
    if (meeting.minutes?.schedules?.length) {
      lines.push('');
      lines.push('### 📅 주요 일정');
      meeting.minutes.schedules.forEach(s => {
        const time = s.time ? ` ${s.time}` : '';
        lines.push(`- ${s.event} (${s.date}${time})`);
      });
    }

    const updated = {
      ...note,
      content: (note.content || '') + lines.join('\n'),
      updatedAt: Date.now()
    };
    await handleSaveNote(updated);
    markAppliedJob(job.jobId);
    return true;
  };
  
  const [savedCategories, setSavedCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bmove_custom_categories');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('bmove_custom_categories', JSON.stringify(savedCategories));
  }, [savedCategories]);

  const allCategories = useMemo(() => {
    const usedCategories = new Set(meetings.map(m => m.category || '기타'));
    const merged = new Set([...DEFAULT_CATEGORIES, ...savedCategories, ...Array.from(usedCategories)]);
    return Array.from(merged).sort();
  }, [meetings, savedCategories]);

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
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'OPEN_MEETING' && event.data?.jobId) {
        openMeetingForJob(event.data.jobId);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler as any);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handler as any);
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listener: any = null;
    LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const jobId = event?.notification?.extra?.jobId;
      if (jobId) openMeetingForJob(jobId);
    }).then((handle) => {
      listener = handle;
    }).catch(() => {});
    return () => {
      try { listener?.remove?.(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (!userEmail || !isAuthenticated) return;
    const url = new URL(window.location.href);
    const jobId = url.searchParams.get('openJob');
    if (!jobId) return;
    openMeetingForJob(jobId);
    url.searchParams.delete('openJob');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, [userEmail, isAuthenticated]);

  useEffect(() => {
    userEmailRef.current = userEmail;
  }, [userEmail]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    shouldTrapBackRef.current = Capacitor.isNativePlatform() || window.matchMedia('(max-width: 767px)').matches;
    const baseState = { __app: true, view: 'dashboard', meetingId: null };
    if (!window.history.state || !window.history.state.__app) {
      window.history.replaceState(baseState, '');
      if (shouldTrapBackRef.current) {
        window.history.pushState(baseState, '');
      }
    }
    const handlePop = (event: PopStateEvent) => {
      const state = event.state;
      isPopStateRef.current = true;
      if (state?.__app && state.view) {
        if (state.view === 'detail' && state.meetingId) {
          const meeting = meetingsRef.current.find(m => m.id === state.meetingId);
          if (meeting) {
            setSelectedMeeting(meeting);
            setView('detail');
          } else {
            setSelectedMeeting(null);
            setView('dashboard');
          }
        } else {
          setSelectedMeeting(null);
          setView(state.view);
        }
        if (shouldTrapBackRef.current && state.view === 'dashboard') {
          window.history.pushState(baseState, '');
        }
        return;
      }
      setSelectedMeeting(null);
      setView('dashboard');
      if (shouldTrapBackRef.current) {
        window.history.pushState(baseState, '');
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isPopStateRef.current) {
      isPopStateRef.current = false;
      return;
    }
    const state = {
      __app: true,
      view,
      meetingId: view === 'detail' ? selectedMeeting?.id ?? null : null,
    };
    const currentState = window.history.state;
    if (currentState?.__app && currentState.view === state.view && currentState.meetingId === state.meetingId) {
      return;
    }
    window.history.pushState(state, '');
  }, [view, selectedMeeting?.id]);

  useEffect(() => {
    meetingsRef.current = meetings;
  }, [meetings]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    if (!userEmail) return;
    try {
      const raw = localStorage.getItem(`${PENDING_JOBS_KEY}:${userEmail}`);
      setPendingJobs(raw ? JSON.parse(raw) : []);
    } catch {
      setPendingJobs([]);
    }
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail) return;
    localStorage.setItem(`${PENDING_JOBS_KEY}:${userEmail}`, JSON.stringify(pendingJobs));
  }, [pendingJobs, userEmail, meetings]);

  useEffect(() => {
    if (!userEmail || !isAuthenticated) return;
    const syncInterval = setInterval(() => {
      if (!document.hidden) fetchCloudData(userEmail);
    }, 10000); 
    const handleFocus = () => fetchCloudData(userEmail);
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [userEmail, isAuthenticated]);

  useEffect(() => {
    if (!userEmail || pendingJobs.length === 0) return;
    let cancelled = false;

    const pollStatuses = async () => {
      try {
        const updates = await Promise.all(
          pendingJobs.map(async (job) => {
            try {
              const status = await fetchJobStatus(job.jobId);
              return { jobId: job.jobId, status };
            } catch (e) {
              return { jobId: job.jobId, status: { status: job.status } };
            }
          })
        );

        if (cancelled) return;
        setPendingJobs((prev) => {
          return prev.map((job) => {
            const update = updates.find((u) => u.jobId === job.jobId);
            if (!update) return job;
            const status = update.status;
            return {
              ...job,
              status: status.status || job.status,
              totalSegments: status.totalSegments ?? job.totalSegments,
              completedSegments: status.completedSegments ?? job.completedSegments,
              error: status.error,
            };
          });
        });
      } catch (e) {
        console.error(e);
      }
    };

    pollStatuses();
    const interval = setInterval(() => {
      if (!document.hidden) pollStatuses();
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pendingJobs, userEmail]);

  useEffect(() => {
    if (!userEmail || pendingJobs.length === 0) return;
    const completed = pendingJobs.filter((j) => j.status === 'completed');
    if (completed.length === 0) return;

    const run = async () => {
      await fetchCloudData(userEmail);
      const appliedJobIds = new Set<string>();
      for (const job of completed) {
        notifyJobCompleted(job);
        const applied = await appendMeetingToNote(job);
        if (applied) appliedJobIds.add(job.jobId);
      }
      setPendingJobs((prev) =>
        prev.filter((j) => j.status !== 'completed' || !appliedJobIds.has(j.jobId))
      );
    };

    run();
  }, [pendingJobs, userEmail]);

  const fetchCloudData = async (email: string) => {
    setIsSyncing(true);
    try {
      const [mRes, nRes, sRes] = await Promise.all([
        cloudData.fetchMeetings(email),
        cloudData.fetchNotes(email),
        cloudData.fetchStickers(email)
      ]);
      const meetingsData = mRes.data || [];
      const notesData = nRes || [];
      const stickersData = sRes || [];
      meetingsRef.current = meetingsData;
      notesRef.current = notesData;
      setMeetings(prev => JSON.stringify(prev) !== JSON.stringify(meetingsData) ? meetingsData : prev);
      setNotes(prev => JSON.stringify(prev) !== JSON.stringify(notesData) ? notesData : prev);
      setStickers(prev => JSON.stringify(prev) !== JSON.stringify(stickersData) ? stickersData : prev);
      return { meetings: meetingsData, notes: notesData, stickers: stickersData };
    } catch (e) {
      console.error(e);
      return { meetings: [], notes: [], stickers: [] };
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

  const handleAddCategory = (name: string) => {
    if (!savedCategories.includes(name)) {
      setSavedCategories([...savedCategories, name]);
    }
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    if (!userEmail) return;
    if (savedCategories.includes(oldName)) {
      setSavedCategories(savedCategories.map(c => c === oldName ? newName : c));
    } else if (!DEFAULT_CATEGORIES.includes(oldName)) {
        setSavedCategories([...savedCategories, newName]);
    }
    setMeetings(prev => prev.map(m => m.category === oldName ? { ...m, category: newName, updatedAt: Date.now() } : m));
    const targets = meetings.filter(m => m.category === oldName);
    for (const m of targets) {
       await cloudData.saveMeeting(userEmail, { ...m, category: newName, updatedAt: Date.now() });
    }
  };

  const handleDeleteCategory = async (name: string) => {
    if (!userEmail) return;
    setSavedCategories(savedCategories.filter(c => c !== name));
    setMeetings(prev => prev.map(m => m.category === name ? { ...m, category: '기타', updatedAt: Date.now() } : m));
    const targets = meetings.filter(m => m.category === name);
    for (const m of targets) {
       await cloudData.saveMeeting(userEmail, { ...m, category: '기타', updatedAt: Date.now() });
    }
  };

  const handleRecordingComplete = async (audioSegments: { base64?: string, file?: File, mimeType: string, duration?: number }[], duration: string, type: MeetingType, keywords: KeywordCorrection[], metadata: any) => {
    if (!userEmail) return;
    setIsProcessing(true);
    let retry = false;
    do {
      retry = false;
      const controller = new AbortController();
      uploadAbortRef.current = controller;
      try {
        const res = await enqueueAudioMeeting(
          audioSegments,
          duration,
          type,
          keywords,
          metadata,
          userEmail,
          { signal: controller.signal }
        );
        setPendingJobs((prev) => [
          {
            jobId: res.jobId,
            title: metadata.title,
            status: 'queued',
            createdAt: Date.now(),
            totalSegments: res.segmentCount,
            completedSegments: 0,
          },
          ...prev,
        ]);
        requestNotificationPermission();
        alert('업로드가 완료되었습니다. 분석은 백그라운드에서 진행되며 완료 후 목록에 표시됩니다.');
        setView('dashboard');
      } catch (error: any) {
        if (controller.signal.aborted) {
          alert('업로드를 취소했습니다.');
        } else {
          retry = confirm(`업로드 실패: ${error.message}\n다시 시도할까요?`);
        }
      } finally {
        uploadAbortRef.current = null;
      }
    } while (retry);
    setIsProcessing(false);
  };

  const handleJobQueued = (job: BackgroundJobStatus) => {
    setPendingJobs((prev) => [job, ...prev]);
    requestNotificationPermission();
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await retryJob(jobId);
      setPendingJobs((prev) =>
        prev.map((j) =>
          j.jobId === jobId ? { ...j, status: 'queued', error: undefined } : j
        )
      );
    } catch (e) {
      alert('재시도 요청 실패');
    }
  };

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

  const handleCreateSchedule = (input: { 
    event: string; 
    date: string; 
    endDate?: string; 
    time?: string; 
    notes?: string;
    allDay?: boolean;
    location?: string;
    attendees?: string[];
    repeat?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
    reminder?: 'none' | '5m' | '10m' | '30m' | '1h' | '1d';
    priority?: 'low' | 'medium' | 'high';
    category?: string;
  }) => {
    if (!userEmail) return;
    const scheduleId = generateUUID();
    const newSchedule: ScheduleItem = {
      id: scheduleId,
      event: input.event,
      date: input.date,
      endDate: input.endDate,
      time: input.allDay ? undefined : input.time,
      allDay: input.allDay,
      location: input.location,
      attendees: input.attendees,
      repeat: input.repeat,
      reminder: input.reminder,
      priority: input.priority,
      category: input.category,
      notes: input.notes,
      confirmed: true,
      deactivated: false
    };

    let target = meetings.find(m => m.title === PERSONAL_SCHEDULE_TITLE && m.category === PERSONAL_SCHEDULE_CATEGORY);
    if (!target) {
      const newMeeting: Meeting = {
        id: generateUUID(),
        title: PERSONAL_SCHEDULE_TITLE,
        author: userEmail,
        category: PERSONAL_SCHEDULE_CATEGORY,
        group: PERSONAL_SCHEDULE_GROUP,
        speakers: [],
        date: input.date,
        duration: '00:00',
        type: 'list',
        transcript: [],
        minutes: { agenda: [], summary: '', todos: [], schedules: [newSchedule] },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      cloudData.saveMeeting(userEmail, newMeeting);
      setMeetings(prev => [newMeeting, ...prev]);
      return scheduleId;
    }

    const updated = {
      ...target,
      minutes: { ...target.minutes, schedules: [newSchedule, ...(target.minutes?.schedules || [])] },
      updatedAt: Date.now()
    };
    setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m));
    cloudData.saveMeeting(userEmail, updated);
    return scheduleId;
  };

  const handleUpdateMeeting = async (updated: Meeting) => {
    if (!userEmail) return;
    const finalUpdate = { ...updated, updatedAt: Date.now() };
    setMeetings(prev => prev.map(m => m.id === finalUpdate.id ? finalUpdate : m));
    setSelectedMeeting(prev => prev?.id === finalUpdate.id ? finalUpdate : prev);
    await cloudData.saveMeeting(userEmail, finalUpdate);
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!userEmail) return;
    setMeetings(prev => prev.filter(m => m.id !== id));
  };

  const handleUpdateTaskItem = async (meetingId: string, itemId: string, type: 'todo' | 'schedule', updates: any) => {
    if (!userEmail) return;
    setMeetings(prev => {
        const newMeetings = prev.map(targetMeeting => {
            if (targetMeeting.id !== meetingId) return targetMeeting;
            const newMinutes = JSON.parse(JSON.stringify(targetMeeting.minutes));
            if (type === 'todo') {
                newMinutes.todos = newMinutes.todos.map((t: any) => t.id === itemId ? { ...t, ...updates } : t);
            } else {
                newMinutes.schedules = newMinutes.schedules.map((s: any) => s.id === itemId ? { ...s, ...updates } : s);
            }
            const updatedMeeting = { ...targetMeeting, minutes: newMinutes, updatedAt: Date.now() };
            
            // Cloud save in background
            cloudData.saveMeeting(userEmail, updatedMeeting);
            
            // Update selected meeting if it's the one being modified
            if (selectedMeeting?.id === meetingId) {
                setTimeout(() => setSelectedMeeting(updatedMeeting), 0);
            }
            
            return updatedMeeting;
        });
        return newMeetings;
    });
  };

  const handleSaveNote = async (note: Note) => {
    if (!userEmail) return;
    setNotes(prev => {
        const existing = prev.find(n => n.id === note.id);
        if (existing) return prev.map(n => n.id === note.id ? note : n);
        return [note, ...prev];
    });
    await cloudData.saveNote(userEmail, note);
  };

  const handleDeleteNote = async (id: string) => {
    if (!userEmail) return;
    setNotes(prev => prev.filter(n => n.id !== id));
    await cloudData.deleteNote(userEmail, id);
  };

  const handleSaveSticker = async (sticker: StickyNote) => {
    if (!userEmail) return;
    setStickers(prev => {
        const existing = prev.find(s => s.id === sticker.id);
        if (existing) return prev.map(s => s.id === sticker.id ? sticker : s);
        return [sticker, ...prev];
    });
    await cloudData.saveSticker(userEmail, sticker);
  };

  const handleDeleteSticker = async (id: string) => {
    if (!userEmail) return;
    setStickers(prev => prev.filter(s => s.id !== id));
    await cloudData.deleteSticker(userEmail, id);
  };

  const loadingMessages = [
    { icon: <MessageSquareText className="text-blue-500" />, text: "오디오를 업로드하는 중..." },
    { icon: <BrainCircuit className="text-purple-500" />, text: "서버에서 분석 작업을 준비 중..." },
    { icon: <Sparkles className="text-orange-500" />, text: "완료되면 목록에 자동 반영됩니다." }
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
          <button
            onClick={() => uploadAbortRef.current?.abort()}
            className="mt-6 px-5 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors"
          >
            업로드 취소
          </button>
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
              pendingJobs={pendingJobs}
              onRetryJob={handleRetryJob}
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
              categories={allCategories}
              onSelectMeeting={(m) => { setSelectedMeeting(m); setView('detail'); }}
              onStartNew={() => setView('recorder')}
              onAddCategory={handleAddCategory}
              onRenameCategory={handleRenameCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          )}
          {view === 'notes' && (
            <NoteView 
              notes={notes} 
              userEmail={userEmail || 'Guest'}
              onSaveNote={handleSaveNote} 
              onDeleteNote={handleDeleteNote}
              onCreateMeeting={handleCreateMeetingFromNote}
              onJobQueued={handleJobQueued}
            />
          )}
          {view === 'stickers' && <StickyNoteView stickers={stickers} onSave={handleSaveSticker} onDelete={handleDeleteSticker} />}
          {view === 'recorder' && (
             <Recorder 
               currentUser={userEmail || 'Guest'} 
               onRecordingComplete={handleRecordingComplete} 
               categories={allCategories}
               onAddCategory={handleAddCategory}
               onRenameCategory={handleRenameCategory}
               onDeleteCategory={handleDeleteCategory}
             />
          )}
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
          {view === 'schedule' && (
            <ScheduleView 
              meetings={meetings}
              categories={allCategories}
              onUpdateSchedule={(mId, sId, type, updates) => handleUpdateTaskItem(mId, sId, type, updates)}
              onCreateSchedule={handleCreateSchedule}
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
