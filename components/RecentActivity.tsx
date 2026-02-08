
import React from 'react';
import { History, Sparkles, Edit3, MessageSquare, ChevronRight, Clock, Calendar } from 'lucide-react';
import { Meeting } from '../types';

interface RecentActivityProps {
  meetings: Meeting[];
  onSelectMeeting: (m: Meeting) => void;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ meetings, onSelectMeeting }) => {
  // 생성일 기준 정렬
  const sortedMeetings = [...meetings].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-10">
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
          <History className="text-blue-600" size={32} /> 최근 활동
        </h2>
        <p className="text-gray-500 mt-2">사용자의 회의 기록 및 분석 활동 로그입니다.</p>
      </div>

      {meetings.length === 0 ? (
        <div className="bg-white rounded-[32px] p-16 border border-gray-100 text-center shadow-sm">
          <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <History size={32} />
          </div>
          <p className="text-gray-400 font-medium">기록된 활동이 없습니다.</p>
        </div>
      ) : (
        <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
          {sortedMeetings.map((meeting, idx) => (
            <div key={meeting.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              {/* Dot */}
              <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-white shadow-md text-blue-600 z-10 absolute left-0 md:left-1/2 md:-translate-x-1/2 group-hover:scale-110 transition-transform">
                <Sparkles size={18} />
              </div>
              
              {/* Content Card */}
              <div 
                onClick={() => onSelectMeeting(meeting)}
                className="w-[calc(100%-4rem)] md:w-[45%] bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all cursor-pointer ml-14 md:ml-0"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">분석 완료</span>
                  <time className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                    <Clock size={10} /> {meeting.duration}
                  </time>
                </div>
                <h4 className="font-bold text-gray-900 line-clamp-1">{meeting.title}</h4>
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-[11px] text-gray-400 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} /> {meeting.date}
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-600 transition-colors" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
