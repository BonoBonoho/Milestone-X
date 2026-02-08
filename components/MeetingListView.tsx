
import React, { useState, useMemo } from 'react';
import { Search, Calendar, Clock, UserCheck, ChevronRight, Library, SlidersHorizontal, LayoutGrid, Kanban, TableProperties, Settings2 } from 'lucide-react';
import { Meeting } from '../types';
import { CategoryManager } from './CategoryManager';

interface MeetingListViewProps {
  meetings: Meeting[];
  categories: string[];
  onSelectMeeting: (meeting: Meeting) => void;
  onStartNew: () => void;
  onAddCategory: (name: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  onDeleteCategory: (name: string) => void;
}

type ViewMode = 'card' | 'board' | 'table';

export const MeetingListView: React.FC<MeetingListViewProps> = ({ 
  meetings, categories, onSelectMeeting, onStartNew, onAddCategory, onRenameCategory, onDeleteCategory 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  const filterCategories = ['All', ...categories];

  // 필터링 및 검색 로직
  const filteredMeetings = useMemo(() => {
    return meetings.filter(meeting => {
      const matchesSearch = 
        meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        meeting.minutes?.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        meeting.transcript?.some(t => t.text.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'All' || meeting.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [meetings, searchTerm, selectedCategory]);

  const renderCardView = () => (
    <div className="grid grid-cols-1 gap-4">
      {filteredMeetings.map((meeting) => (
        <div 
          key={meeting.id}
          onClick={() => onSelectMeeting(meeting)}
          className="group bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer flex flex-col md:flex-row gap-6 relative overflow-hidden active:scale-[0.99]"
        >
          <div className={`absolute top-0 left-0 bottom-0 w-1.5 transition-colors ${meeting.type === 'meeting' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
          
          <div className="flex-1 space-y-3 pl-2">
             <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${
                    meeting.type === 'meeting' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-purple-50 text-purple-700 border-purple-100'
                }`}>
                    {meeting.category}
                </span>
                <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                    <Calendar size={10} /> {meeting.date}
                </span>
             </div>
             <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">{meeting.title}</h3>
             <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                {meeting.minutes?.summary || '요약 내용이 없습니다.'}
             </p>
             
             <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded-md">
                    <UserCheck size={12} /> {meeting.speakers.length}명 참석
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded-md">
                    <Clock size={12} /> {meeting.duration}
                </div>
             </div>
          </div>

          <div className="flex md:flex-col items-center justify-between border-t md:border-t-0 md:border-l border-gray-50 pt-4 md:pt-0 md:pl-6 min-w-[140px]">
             <div className="hidden md:flex flex-col items-center gap-1 text-center">
                <span className="text-3xl font-black text-gray-200 group-hover:text-blue-100 transition-colors">
                    {new Date(meeting.createdAt).getDate()}
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                    {new Date(meeting.createdAt).toLocaleString('en-US', { month: 'short' })}
                </span>
             </div>
             
             <button className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all ml-auto md:ml-0">
                상세 보기 <ChevronRight size={14} />
             </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderBoardView = () => (
    <div className="flex gap-6 overflow-x-auto pb-6 min-h-[600px] items-start">
      {categories.map(cat => {
        const items = filteredMeetings.filter(m => m.category === cat);
        if (selectedCategory !== 'All' && selectedCategory !== cat) return null;

        return (
          <div key={cat} className="min-w-[320px] max-w-[320px] flex-shrink-0 bg-gray-50/50 rounded-3xl p-4 border border-gray-100 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                {cat}
              </h3>
              <span className="bg-white px-2 py-0.5 rounded-md text-xs font-bold text-gray-400 shadow-sm border border-gray-100">{items.length}</span>
            </div>
            
            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-300px)] custom-scrollbar pr-1">
              {items.length === 0 ? (
                <div className="h-32 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-gray-300 text-xs font-bold">
                  비어있음
                </div>
              ) : (
                items.map(meeting => (
                  <div 
                    key={meeting.id}
                    onClick={() => onSelectMeeting(meeting)}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 cursor-pointer transition-all active:scale-95 group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${meeting.type === 'meeting' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                        {meeting.type === 'meeting' ? '회의' : '메모'}
                      </span>
                      <span className="text-[10px] text-gray-400">{meeting.date}</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2 leading-snug group-hover:text-blue-600 transition-colors">{meeting.title}</h4>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">{meeting.minutes?.summary || '내용 없음'}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                       <div className="flex -space-x-1.5">
                          {meeting.speakers.slice(0, 3).map((s, i) => (
                             <div key={i} className="w-5 h-5 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[8px] font-bold text-gray-500" title={s}>
                               {s[0]}
                             </div>
                          ))}
                          {meeting.speakers.length > 3 && <div className="w-5 h-5 rounded-full bg-gray-50 border border-white flex items-center justify-center text-[8px] font-bold text-gray-400">+{meeting.speakers.length - 3}</div>}
                       </div>
                       <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500"/>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderTableView = () => (
    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
              <th className="px-6 py-4 font-bold">날짜</th>
              <th className="px-6 py-4 font-bold">카테고리</th>
              <th className="px-6 py-4 font-bold w-1/3">제목</th>
              <th className="px-6 py-4 font-bold">작성자</th>
              <th className="px-6 py-4 font-bold">시간</th>
              <th className="px-6 py-4 font-bold text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredMeetings.map((meeting) => (
              <tr 
                key={meeting.id} 
                onClick={() => onSelectMeeting(meeting)}
                className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-500">{meeting.date}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                   <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        meeting.type === 'meeting' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-purple-50 text-purple-700 border-purple-100'
                    }`}>
                        {meeting.category}
                   </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{meeting.title}</span>
                    <span className="text-xs text-gray-400 line-clamp-1">{meeting.minutes?.summary?.slice(0, 50)}...</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 flex items-center gap-2">
                   <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">{meeting.author[0]}</div>
                   {meeting.author}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-400">{meeting.duration}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button className="p-2 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-8 animate-in fade-in duration-500 min-h-screen">
      <div className="flex flex-col gap-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <Library className="text-blue-600" size={32} /> 회의록 보관함
            </h2>
            <p className="text-gray-500 font-medium text-sm">
              총 <span className="text-blue-600 font-bold">{meetings.length}</span>개의 분석된 회의 기록이 있습니다.
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="relative flex-1 md:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  placeholder="검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full md:w-64 pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all shadow-sm"
                />
             </div>
             <button onClick={onStartNew} className="px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg active:scale-95 whitespace-nowrap">
                + 새 회의
             </button>
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100/80 p-1 rounded-xl w-full sm:w-auto">
             <button 
               onClick={() => setViewMode('card')}
               className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'card' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
               <LayoutGrid size={16} /> 카드
             </button>
             <button 
               onClick={() => setViewMode('board')}
               className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'board' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
               <Kanban size={16} /> 보드
             </button>
             <button 
               onClick={() => setViewMode('table')}
               className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
               <TableProperties size={16} /> 표
             </button>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto px-2">
            <button 
              onClick={() => setIsCategoryManagerOpen(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors flex-shrink-0"
              title="카테고리 관리"
            >
                <SlidersHorizontal size={14} />
            </button>
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
        </div>
      </div>

      {/* Main Content Area */}
      {filteredMeetings.length === 0 ? (
        <div className="bg-white rounded-[32px] p-20 border border-gray-100 text-center shadow-sm">
          <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">검색 결과가 없습니다</h3>
          <p className="text-gray-400 text-sm">다른 키워드로 검색하거나 새로운 회의를 시작해보세요.</p>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
           {viewMode === 'card' && renderCardView()}
           {viewMode === 'board' && renderBoardView()}
           {viewMode === 'table' && renderTableView()}
        </div>
      )}

      {isCategoryManagerOpen && (
        <CategoryManager 
            categories={categories}
            onClose={() => setIsCategoryManagerOpen(false)}
            onAdd={onAddCategory}
            onRename={onRenameCategory}
            onDelete={onDeleteCategory}
        />
      )}
    </div>
  );
};
