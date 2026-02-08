
import React, { useState, useMemo } from 'react';
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
}

type ViewMode = 'calendar' | 'list';

interface EnrichedScheduleItem {
  id: string;
  event: string;
  date: string;
  time?: string;
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

export const ScheduleView: React.FC<ScheduleViewProps> = ({ meetings, categories, onUpdateSchedule }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(false);

  const filterCategories = ['All', ...categories];

  const allEvents: EnrichedScheduleItem[] = useMemo(() => {
    const events: EnrichedScheduleItem[] = [];
    meetings.forEach(m => {
      (m.minutes?.schedules || []).forEach(s => {
        events.push({
          ...s,
          meetingId: m.id,
          meetingTitle: m.title,
          category: m.category,
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

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
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

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const todayStr = new Date().toISOString().split('T')[0];
    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const allCells = [...blanks, ...days];

    return (
      <div className={`bg-white rounded-[32px] border shadow-sm overflow-hidden ${showPending ? 'border-orange-200' : 'border-gray-100'}`}>
        <div className="grid grid-cols-7 bg-gray-50/50 border-b border-gray-100">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
            <div key={day} className={`py-4 text-center text-xs font-bold ${i === 0 ? 'text-red-400' : 'text-gray-500'}`}>
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)]">
          {allCells.map((day, idx) => {
            if (!day) return <div key={`blank-${idx}`} className="bg-gray-50/20 border-b border-r border-gray-50 min-h-[120px]" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const dayEvents = filteredEvents.filter(e => normalizeDate(e.date).includes(dateStr));
            return (
              <div key={day} className={`p-2 border-b border-r border-gray-100 min-h-[120px] group transition-colors hover:bg-blue-50/10 ${isToday ? 'bg-blue-50/30' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700'}`}>
                    {day}
                  </span>
                  {dayEvents.length > 0 && <span className="text-[10px] font-bold text-gray-400">{dayEvents.length}개</span>}
                </div>
                <div className="space-y-1.5">
                  {dayEvents.map((event) => (
                    <div 
                      key={event.id} 
                      onClick={(e) => { e.stopPropagation(); setSelectedEventId(event.id); }}
                      className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold truncate cursor-pointer shadow-sm transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-1 ${
                        event.sourceType === 'todo'
                          ? event.completed ? 'bg-emerald-50 text-emerald-600 border-emerald-100 line-through' : 'bg-orange-50 text-orange-700 border-orange-100'
                          : event.meetingType === 'meeting' 
                             ? 'bg-blue-50 text-blue-700 border-blue-100' 
                             : 'bg-purple-50 text-purple-700 border-purple-100'
                      } ${selectedEventId === event.id ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                    >
                      {event.sourceType === 'todo' ? <CheckSquare size={10} className="flex-shrink-0" /> : <div className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />}
                      <span className="truncate">{event.event}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderList = () => {
    const grouped = filteredEvents.reduce((acc, curr) => {
        const d = curr.date || '날짜 미정';
        if (!acc[d]) acc[d] = [];
        acc[d].push(curr);
        return acc;
    }, {} as Record<string, EnrichedScheduleItem[]>);
    const sortedDates = Object.keys(grouped).sort();
    return (
      <div className="space-y-6">
        {sortedDates.length === 0 ? (
            <div className="bg-white rounded-[32px] p-20 border border-gray-100 text-center shadow-sm">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${showPending ? 'bg-orange-50 text-orange-300' : 'bg-gray-50 text-gray-300'}`}>
                    {showPending ? <AlertCircle size={32}/> : <CalendarDays size={32} />}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{showPending ? '검토할 일정이 없습니다' : '일정이 없습니다'}</h3>
                <p className="text-gray-400 text-sm">{showPending ? '모든 일정이 확정되었습니다.' : '선택한 카테고리나 기간에 예정된 일정이 없습니다.'}</p>
            </div>
        ) : (
            sortedDates.map(date => (
            <div key={date} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h3 className="flex items-center gap-3 text-sm font-black text-gray-500 uppercase tracking-widest mb-3 ml-2">
                    <CalendarIcon size={14} /> {date}
                </h3>
                <div className={`bg-white rounded-3xl border shadow-sm overflow-hidden divide-y divide-gray-50 ${showPending ? 'border-orange-200' : 'border-gray-100'}`}>
                {grouped[date].map(event => (
                    <div 
                      key={event.id} 
                      onClick={() => setSelectedEventId(event.id)}
                      className={`p-5 flex items-center gap-4 hover:bg-blue-50/30 transition-colors group cursor-pointer ${selectedEventId === event.id ? 'bg-blue-50' : ''}`}
                    >
                        <div className={`w-1.5 h-12 rounded-full ${
                            event.sourceType === 'todo' ? 'bg-orange-400' :
                            event.meetingType === 'meeting' ? 'bg-blue-500' : 'bg-purple-500'
                        }`}></div>
                        <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors flex items-center gap-2 ${event.completed ? 'line-through text-gray-400' : ''}`}>
                                {event.sourceType === 'todo' && <CheckSquare size={14} className="text-orange-500" />}
                                {event.event}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
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
                ))}
                </div>
            </div>
            ))
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full relative overflow-hidden">
        <div className={`flex-1 p-4 sm:p-6 lg:p-10 space-y-8 overflow-y-auto custom-scrollbar transition-all duration-300 ${selectedEventId ? 'mr-0 lg:mr-[400px]' : ''}`}>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    <CalendarDays className="text-blue-600" size={32} /> 일정 및 마감 관리
                    </h2>
                    <p className="text-gray-500 font-medium text-sm">
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
                        className="w-full md:w-64 pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all shadow-sm"
                        />
                    </div>
                </div>
                </div>
                <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4 w-full xl:w-auto">
                    {viewMode === 'calendar' && (
                        <div className="flex items-center gap-4 px-4">
                            <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><ChevronLeft size={20}/></button>
                            <span className="text-lg font-black text-gray-900 min-w-[140px] text-center">
                                {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
                            </span>
                            <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><ChevronRight size={20}/></button>
                        </div>
                    )}
                    <div className="flex items-center bg-gray-100/80 p-1 rounded-xl ml-auto xl:ml-0 gap-1">
                        <button 
                            onClick={() => setViewMode('calendar')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <CalendarIcon size={16} /> 월간
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ListIcon size={16} /> 목록
                        </button>
                        <div className="w-px h-4 bg-gray-300 mx-1"></div>
                        <button
                            onClick={() => setShowPending(!showPending)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                showPending 
                                ? 'bg-orange-500 text-white shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <AlertCircle size={16} />
                            <span>미배정 {pendingCount}</span>
                        </button>
                    </div>
                </div>
                {!showPending && (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full xl:w-auto px-2 border-t xl:border-t-0 pt-2 xl:pt-0 border-gray-50">
                        {filterCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all border ${
                                    selectedCategory === cat 
                                    ? 'bg-gray-900 text-white border-gray-900' 
                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
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
                {viewMode === 'calendar' ? renderCalendar() : renderList()}
            </div>
        </div>
        <div className={`fixed inset-y-0 right-0 w-full lg:w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 border-l border-gray-100 flex flex-col ${selectedEventId ? 'translate-x-0' : 'translate-x-full'}`}>
            {selectedEvent && (
                <>
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
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
                    <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                         <div className="space-y-2">
                             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{selectedEvent.sourceType === 'todo' ? '할 일 내용' : '일정 제목'}</label>
                             <input 
                                value={selectedEvent.event}
                                onChange={(e) => handleUpdate({ [selectedEvent.sourceType === 'todo' ? 'task' : 'event']: e.target.value })}
                                className="w-full text-xl font-bold text-gray-900 border-none outline-none bg-transparent placeholder:text-gray-300 border-b border-gray-200 focus:border-blue-500 transition-colors pb-2"
                             />
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
                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><CalendarIcon size={12}/> 날짜</label>
                                 <input 
                                    type="date"
                                    value={normalizeDate(selectedEvent.date)}
                                    onChange={(e) => handleUpdate({ [selectedEvent.sourceType === 'todo' ? 'dueDate' : 'date']: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                                 />
                             </div>
                             {selectedEvent.sourceType === 'schedule' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Clock size={12}/> 시간</label>
                                    <input 
                                        type="time"
                                        value={selectedEvent.time || ''}
                                        onChange={(e) => handleUpdate({ time: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                             )}
                         </div>
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
    </div>
  );
};
