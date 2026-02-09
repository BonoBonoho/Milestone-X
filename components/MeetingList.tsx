
import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, ChevronRight, Mic, User, MessageSquare, UserCheck, RefreshCcw, FileText, Plus, StickyNote as StickyIcon, Sparkles, Cloud, Database, Search, X, CheckSquare } from 'lucide-react';
import { Meeting, Note, StickyNote, BackgroundJobStatus } from '../types';
import { cloudData } from '../services/cloudService';

interface MeetingListProps {
  meetings: Meeting[];
  notes: Note[];
  stickers: StickyNote[];
  userEmail: string;
  isSyncing?: boolean;
  pendingJobs?: BackgroundJobStatus[];
  onRetryJob?: (jobId: string) => void;
  onSelectMeeting: (meeting: Meeting) => void;
  onSelectNote: (note: Note) => void;
  onSelectSticker: () => void;
  onStartNew: () => void;
  onNavigateToSettings?: () => void; 
}

const STICKER_COLORS = {
  yellow: 'bg-yellow-100 text-yellow-900 border-yellow-200',
  blue: 'bg-blue-100 text-blue-900 border-blue-200',
  green: 'bg-green-100 text-green-900 border-green-200',
  pink: 'bg-pink-100 text-pink-900 border-pink-200',
  purple: 'bg-purple-100 text-purple-900 border-purple-200'
};

type SearchKind = 'all' | 'meeting' | 'note' | 'todo' | 'schedule';

type SearchResult = {
  id: string;
  type: Exclude<SearchKind, 'all'>;
  title: string;
  subtitle: string;
  meta?: string;
  meeting?: Meeting;
  note?: Note;
};

export const MeetingList: React.FC<MeetingListProps> = ({ 
    meetings, notes, stickers, userEmail, isSyncing, 
    pendingJobs, onRetryJob,
    onSelectMeeting, onSelectNote, onSelectSticker, onStartNew, onNavigateToSettings 
}) => {
  const recentNotes = notes.slice(0, 3);
  const recentStickers = stickers.slice(0, 4);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const visibleJobs = (pendingJobs || []).filter(j => j.status !== 'completed');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<SearchKind>('all');
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const hasQuery = normalizedQuery.length > 0;

  useEffect(() => {
    setIsCloudConnected(cloudData.isCloudConnected());
  }, []);

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!normalizedQuery) return [];
    const results: SearchResult[] = [];
    const matches = (value?: string) =>
      value ? value.toLowerCase().includes(normalizedQuery) : false;

    meetings.forEach((meeting) => {
      const meetingHit = [
        meeting.title,
        meeting.category,
        meeting.author,
        meeting.minutes?.summary,
        ...(meeting.minutes?.agenda || []),
        ...(meeting.speakers || [])
      ].some(matches);

      if (meetingHit) {
        results.push({
          id: `meeting-${meeting.id}`,
          type: 'meeting',
          title: meeting.title || '회의록',
          subtitle: meeting.minutes?.summary || meeting.date || '회의 요약',
          meta: `카테고리: ${meeting.category || '기타'}`,
          meeting,
        });
      }

      (meeting.minutes?.todos || []).forEach((todo) => {
        const todoHit = [todo.task, todo.assignee, todo.dueDate, todo.notes].some(matches);
        if (!todoHit) return;
        results.push({
          id: `todo-${meeting.id}-${todo.id}`,
          type: 'todo',
          title: todo.task || '할 일',
          subtitle: todo.dueDate ? `마감: ${todo.dueDate}` : '마감일 없음',
          meta: `회의록: ${meeting.title}`,
          meeting,
        });
      });

      (meeting.minutes?.schedules || []).forEach((schedule) => {
        const scheduleHit = [schedule.event, schedule.date, schedule.time, schedule.notes].some(matches);
        if (!scheduleHit) return;
        const dateLabel = schedule.date ? `${schedule.date}${schedule.time ? ` ${schedule.time}` : ''}` : '날짜 미정';
        results.push({
          id: `schedule-${meeting.id}-${schedule.id}`,
          type: 'schedule',
          title: schedule.event || '일정',
          subtitle: dateLabel,
          meta: `회의록: ${meeting.title}`,
          meeting,
        });
      });
    });

    notes.forEach((note) => {
      const noteHit = [note.title, note.content].some(matches);
      if (!noteHit) return;
      results.push({
        id: `note-${note.id}`,
        type: 'note',
        title: note.title || '노트',
        subtitle: (note.content || '').replace(/\n/g, ' ') || '내용 없음',
        meta: `수정: ${new Date(note.updatedAt).toLocaleDateString()}`,
        note,
      });
    });

    return results;
  }, [meetings, notes, normalizedQuery]);

  const filteredResults = useMemo(() => {
    if (searchFilter === 'all') return searchResults;
    return searchResults.filter((result) => result.type === searchFilter);
  }, [searchFilter, searchResults]);

  const resultCounts = useMemo(() => {
    return searchResults.reduce(
      (acc, curr) => {
        acc[curr.type] += 1;
        acc.all += 1;
        return acc;
      },
      { all: 0, meeting: 0, note: 0, todo: 0, schedule: 0 }
    );
  }, [searchResults]);

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-[11px] sm:text-xs md:text-sm bg-blue-50 w-fit px-3 py-1 rounded-full border border-blue-100">
                <User size={14} /> {userEmail}
            </div>
            
            {/* Cloud Status Badge */}
            {isCloudConnected ? (
                <div className="flex items-center gap-1.5 text-green-600 font-bold text-[11px] sm:text-xs bg-green-50 w-fit px-3 py-1 rounded-full border border-green-100 select-none cursor-default">
                    <Cloud size={12} /> Cloud Connected
                </div>
            ) : (
                <div className="flex items-center gap-1.5 text-gray-500 font-bold text-[11px] sm:text-xs bg-gray-100 w-fit px-3 py-1 rounded-full border border-gray-200 cursor-default">
                    <Database size={12} /> Local Mode
                </div>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">Home Dashboard</h2>
          <p className="text-gray-400 md:text-gray-500 text-sm md:text-lg font-medium">당신의 비즈니스 기록 파트너 <span className="text-blue-600">Milestone X</span></p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button 
            onClick={() => window.location.reload()}
            className={`w-full sm:w-auto px-5 py-3.5 sm:px-6 sm:py-4 bg-white border rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 ${isSyncing ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            <RefreshCcw size={18} className={isSyncing ? "animate-spin" : ""} /> 
            {isSyncing ? '동기화 중...' : '기기 동기화'}
          </button>
          
          <button onClick={onStartNew} className="w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-base active:scale-95">
            <Mic size={20} /> 새 기록 시작
          </button>
        </div>
      </header>

      <section className="bg-white border border-gray-100 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="회의록, 노트, 일정 통합 검색"
              className="w-full pl-11 pr-10 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-700 placeholder:text-gray-400 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                aria-label="검색 초기화"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([
            { key: 'all', label: '전체' },
            { key: 'meeting', label: '회의록' },
            { key: 'note', label: '노트' },
            { key: 'todo', label: '작업' },
            { key: 'schedule', label: '일정' },
          ] as { key: SearchKind; label: string }[]).map((filter) => (
            <button
              key={filter.key}
              onClick={() => setSearchFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                searchFilter === filter.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {filter.label} <span className="ml-1 text-[10px] opacity-70">{resultCounts[filter.key]}</span>
            </button>
          ))}
        </div>
      </section>

      {hasQuery && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Search size={16} /> 검색 결과
            </h3>
            <span className="text-xs font-bold text-gray-400">{filteredResults.length}건</span>
          </div>
          {filteredResults.length === 0 ? (
            <div className="bg-white rounded-[24px] p-8 sm:p-12 border border-dashed border-gray-200 text-center">
              <p className="text-sm font-semibold text-gray-400">검색 결과가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {filteredResults.map((result) => {
                const typeLabel =
                  result.type === 'meeting'
                    ? '회의록'
                    : result.type === 'note'
                    ? '노트'
                    : result.type === 'todo'
                    ? '작업'
                    : '일정';
                const typeIcon =
                  result.type === 'meeting'
                    ? <MessageSquare size={14} />
                    : result.type === 'note'
                    ? <FileText size={14} />
                    : result.type === 'todo'
                    ? <CheckSquare size={14} />
                    : <Calendar size={14} />;
                return (
                  <div
                    key={result.id}
                    onClick={() => {
                      if (result.type === 'note' && result.note) onSelectNote(result.note);
                      else if (result.meeting) onSelectMeeting(result.meeting);
                    }}
                    className="bg-white border border-gray-100 rounded-2xl p-3 sm:p-5 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full w-fit">
                          {typeIcon} {typeLabel}
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                          {result.title}
                        </h4>
                        <p className="text-xs text-gray-500 line-clamp-2">{result.subtitle}</p>
                        {result.meta && <p className="text-[11px] text-gray-400 font-medium">{result.meta}</p>}
                      </div>
                      <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {visibleJobs.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Cloud size={16} /> 백그라운드 처리
          </h3>
          <div className="space-y-3">
            {visibleJobs.map((job) => {
              const isFailed = job.status === 'failed';
              const isProcessing = job.status === 'processing';
              const total = job.totalSegments || 0;
              const done = job.completedSegments || 0;
              const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
              return (
                <div key={job.jobId} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{job.title || '오디오 분석'}</p>
                      <p className="text-[11px] text-gray-500 font-medium">
                        상태: {job.status === 'queued' ? '대기 중' : job.status === 'processing' ? '분석 중' : job.status === 'failed' ? '실패' : '알 수 없음'}
                      </p>
                    </div>
                    {isFailed && onRetryJob && (
                      <button
                        onClick={() => onRetryJob(job.jobId)}
                        className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100"
                      >
                        재시도
                      </button>
                    )}
                  </div>
                  {isProcessing && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold mb-1">
                        <span>진행률</span>
                        <span>{done}/{total || '?'}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  )}
                  {isFailed && job.error && (
                    <p className="mt-2 text-[11px] text-red-500 font-medium">{job.error}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 1. Knowledge Base (Pages) Section */}
      {!hasQuery && (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <FileText size={16} /> 최근 지식 베이스 페이지
          </h3>
          <button onClick={() => onSelectNote({ id: 'new' } as any)} className="text-xs text-blue-600 font-bold hover:underline">모두 보기</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {recentNotes.length === 0 ? (
            <div className="col-span-full bg-white/50 border border-dashed border-gray-200 rounded-3xl p-8 text-center">
              <p className="text-xs text-gray-400 font-bold italic">아직 작성된 페이지가 없습니다.</p>
            </div>
          ) : (
            recentNotes.map(note => (
              <div 
                key={note.id}
                onClick={() => onSelectNote(note)}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group flex items-center gap-3 sm:gap-4"
              >
                <div className="text-2xl group-hover:scale-110 transition-transform">{note.icon || '📄'}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-gray-900 truncate group-hover:text-blue-600">{note.title || '제목 없음'}</h4>
                  <p className="text-[10px] text-gray-400 font-medium">수정: {new Date(note.updatedAt).toLocaleDateString()}</p>
                </div>
                <ChevronRight size={14} className="text-gray-200 group-hover:text-blue-600" />
              </div>
            ))
          )}
          <div 
            onClick={() => onSelectNote({ id: 'new' } as any)}
            className="bg-gray-50/50 p-4 sm:p-5 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 transition-all text-gray-400 hover:text-blue-600 hover:border-blue-200"
          >
            <Plus size={18} />
            <span className="text-sm font-bold">새 페이지 추가</span>
          </div>
        </div>
      </section>
      )}

      {/* 2. Sticky Notes Section */}
      {!hasQuery && (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <StickyIcon size={16} /> 최근 스티커 메모
          </h3>
          <button onClick={onSelectSticker} className="text-xs text-blue-600 font-bold hover:underline">모두 보기</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {recentStickers.length === 0 ? (
            <div className="col-span-full bg-white/50 border border-dashed border-gray-200 rounded-3xl p-6 text-center">
              <p className="text-xs text-gray-400 font-bold italic">메모를 추가해보세요.</p>
            </div>
          ) : (
            recentStickers.map(sticker => (
              <div 
                key={sticker.id}
                onClick={onSelectSticker}
                className={`p-3 sm:p-4 rounded-2xl border shadow-sm cursor-pointer hover:shadow-md transition-all h-24 sm:h-28 flex flex-col justify-between ${STICKER_COLORS[sticker.color]}`}
              >
                <p className="text-[11px] sm:text-xs font-bold line-clamp-3 leading-relaxed">{sticker.content || '내용 없음'}</p>
                <div className="flex justify-between items-center opacity-40">
                  <Sparkles size={10} />
                  <span className="text-[8px] font-black">{new Date(sticker.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))
          )}
          <div 
            onClick={onSelectSticker}
            className="bg-white p-3 sm:p-4 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 transition-all text-gray-400 hover:text-blue-600 h-24 sm:h-28"
          >
            <Plus size={20} />
            <span className="text-[10px] font-black">새 메모</span>
          </div>
        </div>
      </section>
      )}

      {!hasQuery && <div className="w-full h-px bg-gray-100"></div>}

      {/* 3. Meeting Reports Section */}
      {!hasQuery && (
      <section className="space-y-4 pb-16 sm:pb-20">
        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <MessageSquare size={16} /> 최근 회의 리포트
        </h3>
        {meetings.length === 0 ? (
           <div className="bg-white rounded-2xl sm:rounded-[32px] p-8 sm:p-20 border border-gray-100 text-center shadow-sm">
             <h3 className="text-xl font-bold text-gray-900 mb-2">기록이 없습니다</h3>
             <button onClick={onStartNew} className="px-8 py-3.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all">첫 기록 시작</button>
           </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {meetings.map((meeting) => (
              <div 
                key={meeting.id}
                onClick={() => onSelectMeeting(meeting)}
                className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[32px] border border-gray-100 shadow-sm hover:shadow-2xl hover:border-blue-100 transition-all cursor-pointer group relative overflow-hidden flex flex-col h-full active:scale-[0.98]"
              >
                <div className={`absolute top-0 left-0 w-1.5 h-full opacity-0 group-hover:opacity-100 transition-opacity ${meeting.type === 'meeting' ? 'bg-blue-600' : 'bg-purple-600'}`}></div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${meeting.type === 'meeting' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {meeting.category}
                  </div>
                  <ChevronRight className="text-gray-300 group-hover:text-blue-600" size={18} />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-4 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">{meeting.title}</h3>
                <div className="space-y-1.5 pt-4 border-t border-gray-50 mt-auto text-xs text-gray-500">
                  <div className="flex items-center gap-2 font-medium text-gray-600"><UserCheck size={12}/> {meeting.author}</div>
                  <div className="flex items-center gap-2 font-medium text-gray-600"><Calendar size={12}/> {meeting.date}</div>
                  <div className="flex items-center gap-2 font-medium text-gray-600"><Clock size={12}/> {meeting.duration}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  );
};
