
export interface TranscriptPart {
  speaker: string;
  text: string;
  timestamp: string;
}

export interface SubTask {
  id: string;
  task: string;
  completed: boolean;
}

export interface TodoItem {
  id: string;
  task: string;
  assignee: string;
  dueDate?: string;
  completed?: boolean;
  confirmed?: boolean;
  deactivated?: boolean; // [New] 비활성화 상태 추가
  important?: boolean;
  repeat?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  subTasks?: SubTask[];
  notes?: string;
}

export interface ScheduleItem {
  id: string;
  event: string;
  date: string;
  endDate?: string;
  time?: string;
  allDay?: boolean;
  location?: string;
  attendees?: string[];
  repeat?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  reminder?: 'none' | '5m' | '10m' | '30m' | '1h' | '1d';
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  confirmed?: boolean;
  deactivated?: boolean; // [New] 비활성화 상태 추가
  notes?: string;
}

export interface MeetingMinutes {
  agenda: string[];
  summary: string;
  todos: TodoItem[];
  schedules: ScheduleItem[];
}

export type MeetingType = 'meeting' | 'selftalk' | 'list';

export interface KeywordCorrection {
  original: string;
  corrected: string;
}

export interface Meeting {
  id: string;
  title: string;
  author: string;
  date: string;
  category: string;
  group?: string; 
  speakers: string[];
  duration: string;
  type: MeetingType;
  transcript: TranscriptPart[];
  minutes: MeetingMinutes;
  audioBlobUrl?: string;
  keywords?: KeywordCorrection[];
  jobId?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  icon: string;
  updatedAt: number;
  category?: string;
  parentId?: string;
}

export interface StickyNote {
  id: string;
  content: string;
  color: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
  updatedAt: number;
}

export type View = 'dashboard' | 'recorder' | 'detail' | 'activity' | 'settings' | 'tasks' | 'schedule' | 'notes' | 'stickers' | 'meetings' | 'admin';

export interface AnalysisResponse {
  transcript: TranscriptPart[];
  minutes: MeetingMinutes;
}

export interface BackgroundJobStatus {
  jobId: string;
  title: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'unknown';
  createdAt: number;
  totalSegments?: number;
  completedSegments?: number;
  error?: string;
  noteId?: string;
}
