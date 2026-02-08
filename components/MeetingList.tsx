
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, ChevronRight, Mic, User, MessageSquare, UserCheck, RefreshCcw, FileText, Plus, StickyNote as StickyIcon, Sparkles, Cloud, Database } from 'lucide-react';
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

export const MeetingList: React.FC<MeetingListProps> = ({ 
    meetings, notes, stickers, userEmail, isSyncing, 
    pendingJobs, onRetryJob,
    onSelectMeeting, onSelectNote, onSelectSticker, onStartNew, onNavigateToSettings 
}) => {
  const recentNotes = notes.slice(0, 3);
  const recentStickers = stickers.slice(0, 4);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const visibleJobs = (pendingJobs || []).filter(j => j.status !== 'completed');

  useEffect(() => {
    setIsCloudConnected(cloudData.isCloudConnected());
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
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
            className={`px-5 py-3.5 sm:px-6 sm:py-4 bg-white border rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 ${isSyncing ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            <RefreshCcw size={18} className={isSyncing ? "animate-spin" : ""} /> 
            {isSyncing ? '동기화 중...' : '기기 동기화'}
          </button>
          
          <button onClick={onStartNew} className="px-6 py-3.5 sm:px-8 sm:py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-base active:scale-95">
            <Mic size={20} /> 새 기록 시작
          </button>
        </div>
      </header>

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
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <FileText size={16} /> 최근 지식 베이스 페이지
          </h3>
          <button onClick={() => onSelectNote({ id: 'new' } as any)} className="text-xs text-blue-600 font-bold hover:underline">모두 보기</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {recentNotes.length === 0 ? (
            <div className="col-span-full bg-white/50 border border-dashed border-gray-200 rounded-3xl p-8 text-center">
              <p className="text-xs text-gray-400 font-bold italic">아직 작성된 페이지가 없습니다.</p>
            </div>
          ) : (
            recentNotes.map(note => (
              <div 
                key={note.id}
                onClick={() => onSelectNote(note)}
                className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group flex items-center gap-4"
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
            className="bg-gray-50/50 p-5 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 transition-all text-gray-400 hover:text-blue-600 hover:border-blue-200"
          >
            <Plus size={18} />
            <span className="text-sm font-bold">새 페이지 추가</span>
          </div>
        </div>
      </section>

      {/* 2. Sticky Notes Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <StickyIcon size={16} /> 최근 스티커 메모
          </h3>
          <button onClick={onSelectSticker} className="text-xs text-blue-600 font-bold hover:underline">모두 보기</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {recentStickers.length === 0 ? (
            <div className="col-span-full bg-white/50 border border-dashed border-gray-200 rounded-3xl p-6 text-center">
              <p className="text-xs text-gray-400 font-bold italic">메모를 추가해보세요.</p>
            </div>
          ) : (
            recentStickers.map(sticker => (
              <div 
                key={sticker.id}
                onClick={onSelectSticker}
                className={`p-4 rounded-2xl border shadow-sm cursor-pointer hover:shadow-md transition-all h-28 flex flex-col justify-between ${STICKER_COLORS[sticker.color]}`}
              >
                <p className="text-xs font-bold line-clamp-3 leading-relaxed">{sticker.content || '내용 없음'}</p>
                <div className="flex justify-between items-center opacity-40">
                  <Sparkles size={10} />
                  <span className="text-[8px] font-black">{new Date(sticker.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))
          )}
          <div 
            onClick={onSelectSticker}
            className="bg-white p-4 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 transition-all text-gray-400 hover:text-blue-600 h-28"
          >
            <Plus size={20} />
            <span className="text-[10px] font-black">새 메모</span>
          </div>
        </div>
      </section>

      <div className="w-full h-px bg-gray-100"></div>

      {/* 3. Meeting Reports Section */}
      <section className="space-y-4 pb-20">
        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <MessageSquare size={16} /> 최근 회의 리포트
        </h3>
        {meetings.length === 0 ? (
           <div className="bg-white rounded-[32px] p-20 border border-gray-100 text-center shadow-sm">
             <h3 className="text-xl font-bold text-gray-900 mb-2">기록이 없습니다</h3>
             <button onClick={onStartNew} className="px-8 py-3.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all">첫 기록 시작</button>
           </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {meetings.map((meeting) => (
              <div 
                key={meeting.id}
                onClick={() => onSelectMeeting(meeting)}
                className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-2xl hover:border-blue-100 transition-all cursor-pointer group relative overflow-hidden flex flex-col h-full active:scale-[0.98]"
              >
                <div className={`absolute top-0 left-0 w-1.5 h-full opacity-0 group-hover:opacity-100 transition-opacity ${meeting.type === 'meeting' ? 'bg-blue-600' : 'bg-purple-600'}`}></div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${meeting.type === 'meeting' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {meeting.category}
                  </div>
                  <ChevronRight className="text-gray-300 group-hover:text-blue-600" size={18} />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-4 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">{meeting.title}</h3>
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
    </div>
  );
};
