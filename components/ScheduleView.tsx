
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, List as ListIcon, Clock, MapPin, Tag, 
  Search, Plus, CalendarDays, X, AlignLeft, ArrowUpRight, Trash2, CheckCircle2, AlertCircle, 
  CheckSquare, MessageSquareText, Circle
} from 'lucide-react';
import { Meeting, ScheduleItem, TodoItem } from '../types';

interface ScheduleViewProps {
  meetings: Meeting[];
  categories: string[];
  onUpdateSchedule: (meetingId: string, scheduleId: string, type: 'todo' | 'schedule', updates: Partial<ScheduleItem | TodoItem>) => void;
  onCreateSchedule?: (input: { 
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
  }) => string | void;
}

type ViewMode = 'month' | 'week' | 'day';

interface DraftSchedule {
  event: string;
  date: string;
  endDate: string;
  time: string;
  notes: string;
  allDay: boolean;
  location: string;
  attendees: string;
  repeat: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  reminder: 'none' | '5m' | '10m' | '30m' | '1h' | '1d';
  priority: 'low' | 'medium' | 'high';
  category: string;
}

interface EnrichedScheduleItem {
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
  confirmed?: boolean;
  deactivated?: boolean;
  notes?: string;
  meetingId: string;
  meetingTitle: string;
  category: string;
  meetingType: 'meeting' | 'selftalk' | 'list';
  sourceType: 'schedule' | 'todo'; 
  completed?: boolean;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ meetings, categories, onUpdateSchedule, onCreateSchedule }) => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) return 'week';
    return 'month';
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [draft, setDraft] = useState<DraftSchedule>({ 
    event: '', 
    date: '', 
    endDate: '', 
    time: '', 
    notes: '',
    allDay: false,
    location: '',
    attendees: '',
    repeat: 'none',
    reminder: 'none',
    priority: 'medium',
    category: ''
  });
  const [colorPickerCategory, setColorPickerCategory] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const scheduleCategoryOptions = useMemo(() => {
    const base = categories.filter(Boolean);
    if (base.includes('내 일정')) return base;
    return ['내 일정', ...base];
  }, [categories]);
  const filterCategories = ['All', ...categories];
  const weekDayLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const CATEGORY_COLORS_KEY = 'bmove_category_colors';
  const COLOR_PALETTE = ['#2563EB', '#F97316', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#14B8A6', '#64748B'];
  const repeatOptions = [
    { value: 'none', label: '반복 없음' },
    { value: 'daily', label: '매일' },
    { value: 'weekly', label: '매주' },
    { value: 'biweekly', label: '격주' },
    { value: 'monthly', label: '매월' },
    { value: 'yearly', label: '매년' },
  ];
  const reminderOptions = [
    { value: 'none', label: '알림 없음' },
    { value: '5m', label: '5분 전' },
    { value: '10m', label: '10분 전' },
    { value: '30m', label: '30분 전' },
    { value: '1h', label: '1시간 전' },
    { value: '1d', label: '1일 전' },
  ];
  const priorityOptions = [
    { value: 'low', label: '낮음' },
    { value: 'medium', label: '보통' },
    { value: 'high', label: '높음' },
  ];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CATEGORY_COLORS_KEY);
      if (raw) setCategoryColors(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CATEGORY_COLORS_KEY, JSON.stringify(categoryColors));
    } catch {}
  }, [categoryColors]);

  const allEvents: EnrichedScheduleItem[] = useMemo(() => {
    const events: EnrichedScheduleItem[] = [];
    meetings.forEach(m => {
      (m.minutes?.schedules || []).forEach(s => {
        events.push({
          ...s,
          meetingId: m.id,
          meetingTitle: m.title,
          category: s.category || m.category,
          meetingType: m.type,
          sourceType: 'schedule'
        });
      });
      (m.minutes?.todos || []).forEach(t => {
        if (t.dueDate) {
          events.push({
            id: t.id,
            event: t.task,
            date: t.dueDate,
            confirmed: t.confirmed,
            deactivated: t.deactivated,
            notes: t.notes,
            meetingId: m.id,
            meetingTitle: m.title,
            category: m.category,
            meetingType: m.type,
            sourceType: 'todo',
            completed: t.completed
          });
        }
      });
    });
    return events;
  }, [meetings]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter(e => {
      if (e.deactivated) return false;
      if (showPending) {
         if (e.confirmed !== false) return false;
      } else {
         if (e.confirmed === false) return false;
         const matchesCategory = selectedCategory === 'All' || e.category === selectedCategory;
         const matchesSearch = e.event.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               e.meetingTitle.toLowerCase().includes(searchTerm.toLowerCase());
         if (!matchesCategory || !matchesSearch) return false;
      }
      return true;
    });
  }, [allEvents, selectedCategory, searchTerm, showPending]);

  const selectedEvent = useMemo(() => 
    allEvents.find(e => e.id === selectedEventId), 
  [allEvents, selectedEventId]);
  
  const pendingCount = useMemo(() => allEvents.filter(e => e.confirmed === false && !e.deactivated).length, [allEvents]);

  const addDays = (base: Date, amount: number) => {
    const next = new Date(base);
    next.setDate(next.getDate() + amount);
    return next;
  };

  const getWeekStart = (base: Date) => {
    const d = new Date(base);
    const day = d.getDay();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  };

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
      return;
    }
    if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, -7));
      return;
    }
    setCurrentDate(addDays(currentDate, -1));
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
      return;
    }
    if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, 7));
      return;
    }
    setCurrentDate(addDays(currentDate, 1));
  };

  const handleUpdate = (updates: any) => {
    if (selectedEvent) {
      onUpdateSchedule(selectedEvent.meetingId, selectedEvent.id, selectedEvent.sourceType, updates);
    }
  };

  const normalizeDate = (dateStr?: string): string => {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const clean = dateStr.replace(/[\.\/년월일\s]/g, '-').replace(/-+/g, '-').replace(/-$/, '').replace(/^-/, '');
    const parts = clean.split('-');
    if (parts.length === 3) {
      const y = parts[0].length === 4 ? parts[0] : (parts[0].length === 2 ? `20${parts[0]}` : parts[0]);
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return clean.match(/^\d{4}-\d{2}-\d{2}$/) ? clean : '';
  };

  const isDateInRange = (target: string, start?: string, end?: string) => {
    const startKey = normalizeDate(start);
    const endKey = normalizeDate(end);
    if (!startKey) return false;
    if (!endKey || startKey === endKey) return target === startKey;
    return target >= startKey && target <= endKey;
  };

  const openAddModal = (presetDate?: string, presetEnd?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const defaultCategory = selectedCategory !== 'All' ? selectedCategory : (scheduleCategoryOptions[0] || '내 일정');
    setDraft({
      event: '',
      date: presetDate || today,
      endDate: presetEnd && presetEnd !== (presetDate || today) ? presetEnd : '',
      time: '',
      notes: '',
      allDay: false,
      location: '',
      attendees: '',
      repeat: 'none',
      reminder: 'none',
      priority: 'medium',
      category: defaultCategory
    });
    setShowAddModal(true);
  };

  const handleCreate = () => {
    if (!draft.event.trim() || !draft.date) return;
    const [orderedStart, orderedEnd] = draft.endDate ? orderDates(draft.date, draft.endDate) : [draft.date, ''];
    const attendeeList = draft.attendees
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    const payload = {
      event: draft.event.trim(),
      date: orderedStart,
      endDate: orderedEnd || undefined,
      time: draft.allDay ? undefined : (draft.time || undefined),
      notes: draft.notes || undefined,
      allDay: draft.allDay,
      location: draft.location || undefined,
      attendees: attendeeList.length ? attendeeList : undefined,
      repeat: draft.repeat,
      reminder: draft.reminder,
      priority: draft.priority,
      category: draft.category || undefined
    };
    const createdId = onCreateSchedule?.(payload);
    setShowAddModal(false);
    if (createdId) setSelectedEventId(createdId);
  };

  const hashCategory = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const getCategoryColor = (category: string) => {
    if (!category) return '#94A3B8';
    if (categoryColors[category]) return categoryColors[category];
    const idx = hashCategory(category) % COLOR_PALETTE.length;
    return COLOR_PALETTE[idx];
  };

  const hexToRgba = (hex: string, alpha: number) => {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const openColorPicker = (category: string) => {
    if (category === 'All') return;
    setColorPickerCategory(category);
  };

  const applyCategoryColor = (category: string, color: string) => {
    setCategoryColors(prev => ({ ...prev, [category]: color }));
    setColorPickerCategory(null);
  };

  const orderDates = (a: string, b: string) => {
    if (!a || !b) return [a, b] as const;
    return a <= b ? [a, b] as const : [b, a] as const;
  };

  useEffect(() => {
    if (!isSelectingRange) return;
    const handleUp = () => {
      setIsSelectingRange(false);
      setRangeStart(null);
      setRangeEnd(null);
    };
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, [isSelectingRange]);

  const toDate = (value: string) => {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const formatDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const diffDays = (from: string, to: string) => {
    const a = toDate(from);
    const b = toDate(to);
    const ms = b.getTime() - a.getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24));
  };

  const shiftDate = (base: string, offset: number) => {
    const d = toDate(base);
    d.setDate(d.getDate() + offset);
    return formatDate(d);
  };

  const renderMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const todayStr = new Date().toISOString().split('T')[0];
    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const allCells = [...blanks, ...days];

    return (
      <div className={`bg-white rounded-[24px] sm:rounded-[32px] border shadow-sm overflow-hidden ${showPending ? 'border-orange-200' : 'border-gray-100'}`}>
        <div className="grid grid-cols-7 bg-gray-50/50 border-b border-gray-100">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
            <div key={day} className={`py-2 sm:py-4 text-center text-[10px] sm:text-xs font-bold ${i === 0 ? 'text-red-400' : 'text-gray-500'}`}>
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(90px,auto)] sm:auto-rows-[minmax(120px,auto)]">
          {allCells.map((day, idx) => {
            if (!day) return <div key={`blank-${idx}`} className="bg-gray-50/20 border-b border-r border-gray-50 min-h-[90px] sm:min-h-[120px]" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const dayEvents = filteredEvents.filter(e => isDateInRange(dateStr, e.date, e.endDate));
            const limit = isMobile ? 2 : 4;
            const visibleEvents = dayEvents.slice(0, limit);
            const remaining = dayEvents.length - visibleEvents.length;
            const [selectionStart, selectionEnd] = rangeStart && rangeEnd ? orderDates(rangeStart, rangeEnd) : [rangeStart, rangeEnd];
            const isInRange = selectionStart && selectionEnd && isDateInRange(dateStr, selectionStart, selectionEnd);
            return (
              <div
                key={day}
                onMouseDown={(e) => {
                  if (isMobile) return;
                  if ((e.target as HTMLElement).closest('[data-role="event-item"]')) return;
                  if ((e.target as HTMLElement).closest('[data-role="day-button"]')) return;
                  if ((e.target as HTMLElement).closest('[data-role="add-button"]')) return;
                  setRangeStart(dateStr);
                  setRangeEnd(dateStr);
                  setIsSelectingRange(true);
                }}
                onMouseEnter={() => {
                  if (!isSelectingRange || isMobile) return;
                  setRangeEnd(dateStr);
                }}
                onMouseUp={(e) => {
                  if (isMobile) return;
                  if (!isSelectingRange) return;
                  e.stopPropagation();
                  const start = rangeStart || dateStr;
                  const end = rangeEnd || dateStr;
                  const [orderedStart, orderedEnd] = orderDates(start, end);
                  openAddModal(orderedStart, orderedEnd === orderedStart ? '' : orderedEnd);
                  setIsSelectingRange(false);
                  setRangeStart(null);
                  setRangeEnd(null);
                }}
                onClick={(e) => {
                  if (!isMobile) return;
                  if ((e.target as HTMLElement).closest('[data-role="event-item"]')) return;
                  if ((e.target as HTMLElement).closest('[data-role="add-button"]')) return;
                  const next = dateStr;
                  setSelectedDay(next);
                }}
                onDragOver={(e) => { if (!isMobile) { e.preventDefault(); setDragOverDate(dateStr); } }}
                onDragLeave={() => { if (!isMobile) setDragOverDate(null); }}
                onDrop={(e) => {
                  if (isMobile) return;
                  e.preventDefault();
                  setDragOverDate(null);
                  const raw = e.dataTransfer.getData('text/plain');
                  if (!raw) return;
                  let payload: any = null;
                  try { payload = JSON.parse(raw); } catch { return; }
                  if (!payload?.id || !payload?.sourceType) return;
                  const target = allEvents.find(ev => ev.id === payload.id);
                  if (!target) return;
                  const startKey = normalizeDate(target.date);
                  if (!startKey) return;
                  const offset = diffDays(startKey, dateStr);
                  if (target.sourceType === 'todo') {
                    onUpdateSchedule(target.meetingId, target.id, 'todo', { dueDate: dateStr });
                  } else {
                    const update: any = { date: dateStr };
                    const endKey = normalizeDate(target.endDate);
                    if (endKey) update.endDate = shiftDate(endKey, offset);
                    onUpdateSchedule(target.meetingId, target.id, 'schedule', update);
                  }
                }}
                className={`p-1.5 sm:p-2 border-b border-r border-gray-100 min-h-[110px] sm:min-h-[120px] group transition-colors hover:bg-blue-50/10 ${isToday ? 'bg-blue-50/30' : ''} ${dragOverDate === dateStr ? 'ring-2 ring-blue-400 ring-offset-1' : ''} ${isInRange ? 'bg-blue-50/50' : ''}`}
              >
                <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      if (isMobile) {
                        setSelectedDay(next);
                      } else {
                        setCurrentDate(new Date(year, month, day));
                        setViewMode('day');
                      }
                    }}
                    className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-[10px] sm:text-xs font-bold transition-colors ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'}`}
                    title={isMobile ? '선택 날짜 보기' : '일간 보기로 열기'}
                    data-role="day-button"
                  >
                    {day}
                  </button>
                  <div className="flex items-center gap-1">
                    {dayEvents.length > 0 && <span className="text-[7px] sm:text-[8px] font-bold text-gray-400">{dayEvents.length}개</span>}
                    <button
                      type="button"
                      data-role="add-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddModal(dateStr);
                      }}
                      className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all ${isMobile ? (selectedDay === dateStr ? 'opacity-100' : 'opacity-0 pointer-events-none') : 'opacity-0 group-hover:opacity-100'}`}
                      title="일정 추가"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {visibleEvents.map((event) => {
                    const startKey = normalizeDate(event.date);
                    const endKey = normalizeDate(event.endDate);
                    const isRange = !!endKey && endKey !== startKey;
                    const isStart = isRange && dateStr === startKey;
                    const isEnd = isRange && dateStr === endKey;
                    const label = event.event;
                    const rangeClass = isRange
                      ? `${isStart ? 'rounded-l-md sm:rounded-l-lg' : 'rounded-l-none'} ${isEnd ? 'rounded-r-md sm:rounded-r-lg' : 'rounded-r-none'}`
                      : 'rounded-md sm:rounded-lg';
                    const color = getCategoryColor(event.category);
                    return (
                    <div 
                      key={event.id} 
                      onClick={(e) => { e.stopPropagation(); setSelectedEventId(event.id); }}
                      draggable={!isMobile}
                      onDragStart={(e) => {
                        if (isMobile) return;
                        e.dataTransfer.setData('text/plain', JSON.stringify({ id: event.id, sourceType: event.sourceType }));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className={`px-2 py-1 border text-[9px] sm:text-[9px] font-medium cursor-pointer shadow-sm transition-all hover:scale-[1.02] active:scale-95 overflow-hidden ${rangeClass} ${selectedEventId === event.id ? 'ring-2 ring-blue-400 ring-offset-1' : ''} ${event.completed ? 'line-through text-gray-400' : 'text-slate-900'}`}
                      style={{ borderColor: color, backgroundColor: hexToRgba(color, 0.16) }}
                      data-role="event-item"
                    >
                      <span className="block w-full truncate whitespace-nowrap overflow-hidden">{label}</span>
                    </div>
                    );
                  })}
                  {remaining > 0 && (
                    <div className="text-[7px] sm:text-[8px] font-bold text-gray-400 px-2">+{remaining}개 더보기</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeek = () => {
    const start = getWeekStart(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const todayStr = new Date().toISOString().split('T')[0];

    if (isMobile) {
      return (
        <div className="space-y-3">
          {days.map((day) => {
            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            const dayEvents = filteredEvents.filter(e => isDateInRange(dateStr, e.date, e.endDate));
            return (
              <div key={dateStr} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${showPending ? 'border-orange-200' : 'border-gray-100'}`}>
                <div className={`px-3 py-2 flex items-center justify-between text-xs font-bold ${dateStr === todayStr ? 'text-blue-700 bg-blue-50/70' : 'text-gray-600 bg-gray-50/60'}`}>
                  <span>{day.getMonth() + 1}.{day.getDate()} ({weekDayLabels[day.getDay()]})</span>
                  {dayEvents.length > 0 && <span className="text-[10px] text-gray-400">{dayEvents.length}개</span>}
                </div>
                <div className="divide-y divide-gray-50">
                  {dayEvents.length === 0 ? (
                    <div className="px-3 py-3 text-[11px] text-gray-400">일정 없음</div>
                  ) : (
                    dayEvents.map((event) => {
                      const color = getCategoryColor(event.category);
                      return (
                      <div 
                        key={event.id}
                        onClick={() => setSelectedEventId(event.id)}
                        className={`px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${selectedEventId === event.id ? 'bg-blue-50/60' : 'hover:bg-blue-50/40'}`}
                      >
                        <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: color }}></div>
                        <div className="min-w-0 flex-1">
                          <div className={`text-[11px] font-medium truncate ${event.completed ? 'text-gray-400 line-through' : 'text-gray-900'} w-full`}>
                            {event.event}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[8px] text-gray-400">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                              {event.category}
                            </span>
                            {event.time && <span className="flex items-center gap-1"><Clock size={10} /> {event.time}</span>}
                          </div>
                          <div className="text-[8px] text-gray-400 truncate">From: {event.meetingTitle}</div>
                        </div>
                        <ChevronRight size={14} className="text-gray-300" />
                      </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className={`bg-white rounded-[24px] sm:rounded-[32px] border shadow-sm overflow-hidden ${showPending ? 'border-orange-200' : 'border-gray-100'}`}>
        <div className="grid grid-cols-7 bg-gray-50/50 border-b border-gray-100">
          {days.map((day) => {
            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            return (
              <div key={dateStr} className={`py-3 text-center text-xs font-bold ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                <div>{weekDayLabels[day.getDay()]}</div>
                <div className={`text-[11px] ${isToday ? 'text-blue-700' : 'text-gray-400'}`}>{day.getMonth() + 1}/{day.getDate()}</div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(140px,auto)]">
          {days.map((day) => {
            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            const dayEvents = filteredEvents.filter(e => isDateInRange(dateStr, e.date, e.endDate));
            return (
              <div
                key={dateStr}
                onDragOver={(e) => { e.preventDefault(); setDragOverDate(dateStr); }}
                onDragLeave={() => setDragOverDate(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverDate(null);
                  const raw = e.dataTransfer.getData('text/plain');
                  if (!raw) return;
                  let payload: any = null;
                  try { payload = JSON.parse(raw); } catch { return; }
                  if (!payload?.id || !payload?.sourceType) return;
                  const target = allEvents.find(ev => ev.id === payload.id);
                  if (!target) return;
                  const startKey = normalizeDate(target.date);
                  if (!startKey) return;
                  const offset = diffDays(startKey, dateStr);
                  if (target.sourceType === 'todo') {
                    onUpdateSchedule(target.meetingId, target.id, 'todo', { dueDate: dateStr });
                  } else {
                    const update: any = { date: dateStr };
                    const endKey = normalizeDate(target.endDate);
                    if (endKey) update.endDate = shiftDate(endKey, offset);
                    onUpdateSchedule(target.meetingId, target.id, 'schedule', update);
                  }
                }}
                className={`p-2 border-b border-r border-gray-100 space-y-1.5 ${dragOverDate === dateStr ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
              >
                {dayEvents.length === 0 ? (
                  <div className="text-[10px] text-gray-300">일정 없음</div>
                ) : (
                  dayEvents.map(event => {
                    const color = getCategoryColor(event.category);
                    return (
                    <div 
                      key={event.id}
                      onClick={() => setSelectedEventId(event.id)}
                      className={`px-2 py-1 rounded-md border text-[8px] font-medium cursor-pointer shadow-sm transition-all hover:scale-[1.02] active:scale-95 overflow-hidden ${selectedEventId === event.id ? 'ring-2 ring-blue-400 ring-offset-1' : ''} ${event.completed ? 'line-through text-gray-400' : 'text-slate-900'}`}
                      style={{ borderColor: color, backgroundColor: hexToRgba(color, 0.12) }}
                    >
                      <span className="block w-full truncate whitespace-nowrap overflow-hidden">{event.event}</span>
                    </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDay = () => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    const dayEvents = filteredEvents.filter(e => isDateInRange(dateStr, e.date, e.endDate));
    const dayLabel = `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월 ${currentDate.getDate()}일(${weekDayLabels[currentDate.getDay()]})`;

    return (
      <div className={`bg-white rounded-[24px] sm:rounded-[32px] border shadow-sm overflow-hidden ${showPending ? 'border-orange-200' : 'border-gray-100'}`}>
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="text-sm font-black text-gray-700">{dayLabel}</div>
          {dayEvents.length > 0 && <div className="text-[11px] font-bold text-gray-400">{dayEvents.length}개</div>}
        </div>
        {dayEvents.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm font-medium">오늘 일정이 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {dayEvents.map(event => {
              const color = getCategoryColor(event.category);
              return (
              <div 
                key={event.id}
                onClick={() => setSelectedEventId(event.id)}
                className={`p-4 sm:p-5 flex items-center gap-4 hover:bg-blue-50/30 transition-colors group cursor-pointer ${selectedEventId === event.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <h4 className={`text-[12px] sm:text-[11px] font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate w-full ${event.completed ? 'line-through text-gray-400' : ''}`}>
                    {event.event}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-[9px] text-gray-500 mt-1">
                    <span className={`px-2 py-0.5 rounded font-bold ${event.sourceType === 'todo' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                      {event.sourceType === 'todo' ? '할 일 마감' : '일정'}
                    </span>
                    {showPending && <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">검토 필요</span>}
                    <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded text-gray-400">
                      <Tag size={10} /> {event.category}
                    </span>
                    {event.time && <span className="flex items-center gap-1"><Clock size={10} /> {event.time}</span>}
                    <span className="truncate max-w-[200px] text-gray-400">From: {event.meetingTitle}</span>
                  </div>
                </div>
                <div className="text-gray-300 group-hover:text-blue-400 transition-colors">
                  <ChevronRight size={18} />
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full relative overflow-hidden">
        <div className={`flex-1 p-3 sm:p-6 lg:p-10 space-y-4 sm:space-y-8 overflow-y-auto custom-scrollbar transition-all duration-300 ${selectedEventId ? 'mr-0 lg:mr-[400px]' : ''}`}>
            <div className="flex flex-col gap-4 sm:gap-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
                <div className="space-y-1.5 sm:space-y-2">
                    <h2 className="text-xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2 sm:gap-3">
                    <CalendarDays className="text-blue-600" size={24} /> 일정 및 마감 관리
                    </h2>
                    <p className="text-gray-500 font-medium text-xs sm:text-sm">
                    회의록에서 추출된 주요 일정과 할 일의 마감 기한을 함께 관리합니다.
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                        placeholder="일정/작업 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-64 pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-2xl text-[13px] sm:text-sm font-medium focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all shadow-sm"
                        />
                    </div>
                    <button
                      onClick={() => openAddModal()}
                      className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-[11px] sm:text-sm font-bold rounded-2xl shadow-md hover:bg-blue-700 transition-all whitespace-nowrap"
                    >
                      <Plus size={14} /> <span className="hidden sm:inline">일정 추가</span>
                      <span className="sm:hidden">추가</span>
                    </button>
                </div>
                </div>
                <div className="flex flex-col xl:flex-row items-center justify-between gap-3 sm:gap-4 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 sm:gap-4 w-full xl:w-auto">
                    <div className="flex items-center gap-3 px-2 sm:px-4">
                        <button onClick={handlePrev} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><ChevronLeft size={18}/></button>
                        <span className="text-[13px] sm:text-lg font-black text-gray-900 min-w-[120px] sm:min-w-[160px] text-center">
                            {viewMode === 'month' && `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`}
                            {viewMode === 'week' && (() => {
                              const start = getWeekStart(currentDate);
                              const end = addDays(start, 6);
                              return `${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()}`;
                            })()}
                            {viewMode === 'day' && `${currentDate.getMonth() + 1}월 ${currentDate.getDate()}일`}
                        </span>
                        <button onClick={handleNext} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><ChevronRight size={18}/></button>
                    </div>
                    <div className="flex items-center bg-gray-100/80 p-1 rounded-xl ml-auto xl:ml-0 gap-1 flex-nowrap overflow-x-auto no-scrollbar">
                        <button 
                            onClick={() => setViewMode('month')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <CalendarIcon size={14} /> 월간
                        </button>
                        <button 
                            onClick={() => setViewMode('week')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ListIcon size={14} /> 주간
                        </button>
                        <button 
                            onClick={() => setViewMode('day')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${viewMode === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <AlignLeft size={14} /> 일간
                        </button>
                        <div className="w-px h-4 bg-gray-300 mx-1"></div>
                        <button
                            onClick={() => setShowPending(!showPending)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                                showPending 
                                ? 'bg-orange-500 text-white shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <AlertCircle size={14} />
                            <span>미배정 {pendingCount}</span>
                        </button>
                    </div>
                </div>
                {!showPending && (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full xl:w-auto px-2 border-t xl:border-t-0 pt-2 xl:pt-0 border-gray-50">
                        {filterCategories.map(cat => {
                          const color = getCategoryColor(cat);
                          const isAll = cat === 'All';
                          return (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold whitespace-nowrap transition-all border flex items-center gap-2 ${
                                    selectedCategory === cat 
                                    ? 'bg-gray-900 text-white border-gray-900' 
                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openColorPicker(cat);
                                  }}
                                  className={`w-3 h-3 rounded-full border ${isAll ? 'bg-gray-300 border-gray-300 cursor-default' : 'hover:scale-110 transition-transform'}`}
                                  style={!isAll ? { backgroundColor: color, borderColor: color } : {}}
                                  title={isAll ? '전체' : '색상 선택'}
                                  aria-label={`${cat} 색상 선택`}
                                />
                                {cat}
                            </button>
                          );
                        })}
                    </div>
                )}
                </div>
            </div>
            <div className="pb-20">
                {showPending && pendingCount === 0 && (
                    <div className="bg-orange-50 border border-orange-100 rounded-3xl p-10 text-center mb-6">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-orange-300 shadow-sm">
                            <CheckCircle2 size={32}/>
                        </div>
                        <h3 className="text-orange-800 font-bold text-lg mb-1">모든 일정이 확정되었습니다!</h3>
                        <p className="text-orange-600/70 text-sm">검토 대기 중인 항목이 없습니다.</p>
                        <button onClick={() => setShowPending(false)} className="mt-4 text-xs font-bold text-orange-700 hover:underline">
                            전체 일정 보기
                        </button>
                    </div>
                )}
                {viewMode === 'month' && renderMonth()}
                {viewMode === 'month' && isMobile && (
                  <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between text-xs font-bold text-gray-600">
                      <span>
                        선택 날짜: {selectedDay}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-blue-600 font-black"
                          onClick={() => {
                            const [y, m, d] = selectedDay.split('-').map(Number);
                            if (y && m && d) {
                              setCurrentDate(new Date(y, m - 1, d));
                              setViewMode('day');
                            }
                          }}
                        >
                          일간 보기
                        </button>
                        <button
                          className="px-2.5 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold"
                          onClick={() => openAddModal(selectedDay)}
                        >
                          일정 추가
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {filteredEvents.filter(e => isDateInRange(selectedDay, e.date, e.endDate)).length === 0 ? (
                        <div className="px-4 py-4 text-[11px] text-gray-400">선택한 날짜에 일정이 없습니다.</div>
                      ) : (
                        filteredEvents
                          .filter(e => isDateInRange(selectedDay, e.date, e.endDate))
                          .map(event => {
                            const color = getCategoryColor(event.category);
                            return (
                              <div
                                key={`${selectedDay}-${event.id}`}
                                onClick={() => setSelectedEventId(event.id)}
                                className="px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-blue-50/40"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className={`text-[11px] font-medium truncate w-full ${event.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                    {event.event}
                                  </div>
                                  <div className="text-[9px] text-gray-500 mt-1">
                                    {event.category} · {event.meetingTitle}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}
                {viewMode === 'week' && renderWeek()}
                {viewMode === 'day' && renderDay()}
            </div>
        </div>
        <div className={`fixed inset-y-0 right-0 w-full lg:w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 border-l border-gray-100 flex flex-col ${selectedEventId ? 'translate-x-0' : 'translate-x-full'}`}>
            {selectedEvent && (
                <>
                    <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2 text-gray-500">
                     {selectedEvent.sourceType === 'todo' ? <CheckSquare size={18} className="text-orange-500"/> : <CalendarDays size={18} className="text-blue-600"/>}
                     <span className="text-xs font-black uppercase tracking-widest">{selectedEvent.sourceType === 'todo' ? '할 일 마감 상세' : '일정 상세'}</span>
                </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setSelectedEventId(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                                <X size={20}/>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 custom-scrollbar">
                         <div className="space-y-2">
                             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{selectedEvent.sourceType === 'todo' ? '할 일 내용' : '일정 제목'}</label>
                             <input 
                                value={selectedEvent.event}
                                onChange={(e) => handleUpdate({ [selectedEvent.sourceType === 'todo' ? 'task' : 'event']: e.target.value })}
                                className="w-full text-xl font-bold text-gray-900 border-none outline-none bg-transparent placeholder:text-gray-300 border-b border-gray-200 focus:border-blue-500 transition-colors pb-2"
                             />
                             <div className="text-[11px] text-gray-500 font-bold mt-1">
                               목록: {selectedEvent.category} · From: {selectedEvent.meetingTitle}
                             </div>
                         </div>
                         {selectedEvent.confirmed === false && (
                             <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex flex-col gap-3">
                                <div className="flex items-center gap-2 text-orange-700 text-xs font-bold">
                                    <AlertCircle size={16}/> 미확정 항목 (Pending)
                                </div>
                                <button 
                                    onClick={() => handleUpdate({ confirmed: true })}
                                    className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl shadow-md hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 size={16}/> 이 항목 확정하기
                                </button>
                             </div>
                         )}
                         <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${selectedEvent.sourceType === 'schedule' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                             <div className="space-y-2">
                                 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><CalendarIcon size={12}/> 시작 날짜</label>
                                 <input 
                                    type="date"
                                    value={normalizeDate(selectedEvent.date)}
                                    onChange={(e) => handleUpdate({ [selectedEvent.sourceType === 'todo' ? 'dueDate' : 'date']: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                                 />
                             </div>
                             {selectedEvent.sourceType === 'schedule' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><CalendarIcon size={12}/> 종료 날짜</label>
                                    <input 
                                        type="date"
                                        value={normalizeDate(selectedEvent.endDate)}
                                        onChange={(e) => handleUpdate({ endDate: e.target.value || undefined })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                             )}
                             {selectedEvent.sourceType === 'schedule' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Clock size={12}/> 시간</label>
                                    <input 
                                        type="time"
                                        value={selectedEvent.allDay ? '' : (selectedEvent.time || '')}
                                        onChange={(e) => handleUpdate({ time: e.target.value })}
                                        disabled={!!selectedEvent.allDay}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                             )}
                         </div>
                         {selectedEvent.sourceType === 'schedule' && (
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                             <div className="space-y-2">
                               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">카테고리</label>
                               <div className="relative">
                                 <select
                                   value={selectedEvent.category}
                                   onChange={(e) => handleUpdate({ category: e.target.value })}
                                   className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                                 >
                                   {scheduleCategoryOptions.map(option => (
                                     <option key={option} value={option}>{option}</option>
                                   ))}
                                 </select>
                                 <span
                                   className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                                   style={{ backgroundColor: getCategoryColor(selectedEvent.category) }}
                                 />
                               </div>
                             </div>
                             <div className="space-y-2">
                               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">종일</label>
                               <button
                                 type="button"
                                 onClick={() => handleUpdate({ allDay: !selectedEvent.allDay, time: selectedEvent.allDay ? selectedEvent.time : undefined })}
                                 className={`w-full px-4 py-3 rounded-xl border text-sm font-bold transition-all ${selectedEvent.allDay ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                               >
                                 {selectedEvent.allDay ? '종일 일정' : '시간 지정'}
                               </button>
                             </div>
                             <div className="space-y-2">
                               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">반복</label>
                               <select
                                 value={selectedEvent.repeat || 'none'}
                                 onChange={(e) => handleUpdate({ repeat: e.target.value })}
                                 className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                               >
                                 {repeatOptions.map(option => (
                                   <option key={option.value} value={option.value}>{option.label}</option>
                                 ))}
                               </select>
                             </div>
                             <div className="space-y-2">
                               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">알림</label>
                               <select
                                 value={selectedEvent.reminder || 'none'}
                                 onChange={(e) => handleUpdate({ reminder: e.target.value })}
                                 className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                               >
                                 {reminderOptions.map(option => (
                                   <option key={option.value} value={option.value}>{option.label}</option>
                                 ))}
                               </select>
                             </div>
                             <div className="space-y-2">
                               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">우선순위</label>
                               <select
                                 value={selectedEvent.priority || 'medium'}
                                 onChange={(e) => handleUpdate({ priority: e.target.value })}
                                 className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                               >
                                 {priorityOptions.map(option => (
                                   <option key={option.value} value={option.value}>{option.label}</option>
                                 ))}
                               </select>
                             </div>
                             <div className="space-y-2">
                               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">장소</label>
                               <input
                                 value={selectedEvent.location || ''}
                                 onChange={(e) => handleUpdate({ location: e.target.value })}
                                 placeholder="예: 회의실 A"
                                 className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                               />
                             </div>
                             <div className="space-y-2 sm:col-span-2">
                               <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">참석자</label>
                               <input
                                 value={(selectedEvent.attendees || []).join(', ')}
                                 onChange={(e) => handleUpdate({ attendees: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })}
                                 placeholder="예: 홍길동, 김지수"
                                 className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                               />
                             </div>
                           </div>
                         )}
                         {selectedEvent.sourceType === 'todo' && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">상태 관리</label>
                                <button 
                                    onClick={() => handleUpdate({ completed: !selectedEvent.completed })}
                                    className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                                        selectedEvent.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-600'
                                    }`}
                                >
                                    {selectedEvent.completed ? <CheckCircle2 size={18}/> : <Circle size={18}/>}
                                    {selectedEvent.completed ? '완료됨' : '미완료'}
                                </button>
                            </div>
                         )}
                         <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                             <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1"><MessageSquareText size={10}/> 출처 회의록</span>
                                <ArrowUpRight size={14} className="text-blue-400"/>
                             </div>
                             <p className="text-sm font-bold text-gray-900 line-clamp-2">
                                {selectedEvent.meetingTitle}
                             </p>
                             <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                <Tag size={12} /> {selectedEvent.category}
                             </div>
                         </div>
                         <div className="space-y-2">
                             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                <AlignLeft size={12}/> 메모
                             </label>
                             <textarea 
                                value={selectedEvent.notes || ''}
                                onChange={(e) => handleUpdate({ notes: e.target.value })}
                                rows={4}
                                placeholder="추가 메모를 입력하세요"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                             />
                         </div>
                    </div>
                </>
            )}
        </div>
        {showAddModal && (
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-gray-900">일정 추가</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">제목</label>
                <input
                  value={draft.event}
                  onChange={(e) => setDraft(prev => ({ ...prev, event: e.target.value }))}
                  placeholder="예: 디자인 컨셉 회의"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">카테고리</label>
                  <div className="relative">
                    <select
                      value={draft.category}
                      onChange={(e) => setDraft(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full appearance-none px-4 py-3 rounded-2xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                    >
                      {scheduleCategoryOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <span
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                      style={{ backgroundColor: getCategoryColor(draft.category || scheduleCategoryOptions[0] || '내 일정') }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">종일</label>
                  <button
                    type="button"
                    onClick={() => setDraft(prev => ({ ...prev, allDay: !prev.allDay, time: prev.allDay ? prev.time : '' }))}
                    className={`w-full px-4 py-3 rounded-2xl border text-sm font-bold transition-all ${draft.allDay ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  >
                    {draft.allDay ? '종일 일정' : '시간 지정'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">시작 날짜</label>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(e) => setDraft(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">종료 날짜 (선택)</label>
                  <input
                    type="date"
                    value={draft.endDate}
                    onChange={(e) => setDraft(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              {!draft.allDay && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">시간 (선택)</label>
                  <input
                    type="time"
                    value={draft.time}
                    onChange={(e) => setDraft(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">반복</label>
                  <select
                    value={draft.repeat}
                    onChange={(e) => setDraft(prev => ({ ...prev, repeat: e.target.value as typeof draft.repeat }))}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                  >
                    {repeatOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">알림</label>
                  <select
                    value={draft.reminder}
                    onChange={(e) => setDraft(prev => ({ ...prev, reminder: e.target.value as typeof draft.reminder }))}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                  >
                    {reminderOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">우선순위</label>
                  <select
                    value={draft.priority}
                    onChange={(e) => setDraft(prev => ({ ...prev, priority: e.target.value as typeof draft.priority }))}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                  >
                    {priorityOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">장소 (선택)</label>
                  <input
                    value={draft.location}
                    onChange={(e) => setDraft(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="예: 회의실 A"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">참석자 (쉼표로 구분)</label>
                <input
                  value={draft.attendees}
                  onChange={(e) => setDraft(prev => ({ ...prev, attendees: e.target.value }))}
                  placeholder="예: 홍길동, 김지수"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">메모 (선택)</label>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="추가 메모를 입력하세요"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 py-2.5 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        )}
        {colorPickerCategory && (
          <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-gray-100 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-gray-900">색상 선택</h3>
                <button onClick={() => setColorPickerCategory(null)} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
                  <X size={18} />
                </button>
              </div>
              <div className="text-sm font-bold text-gray-500">
                {colorPickerCategory} 색상
              </div>
              <div className="grid grid-cols-4 gap-3">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => applyCategoryColor(colorPickerCategory, color)}
                    className="w-12 h-12 rounded-2xl border-2 border-white shadow-md hover:scale-105 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setColorPickerCategory(null)}
                  className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
