
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Check, Trash2, X, Star, Sun, User, 
  ChevronRight, ChevronLeft, ChevronDown, Inbox, Folder, 
  GripVertical, Tag, CalendarDays, Calendar as CalendarIcon, Bell, Edit2, 
  CheckSquare, PanelLeftClose, PanelLeftOpen, 
  Plus, FolderPlus, Clock, CalendarPlus, Repeat, FileText, AlertCircle, Circle,
  Layout, ChevronUp, Save, Eye, EyeOff, MoreVertical, CheckCircle2, Paperclip, Share2,
  Archive, RotateCcw, FolderEdit, ChevronUp as ChevronUpIcon
} from 'lucide-react';
import { Meeting, TodoItem, ScheduleItem, SubTask } from '../types';

interface TaskViewProps {
  meetings: Meeting[];
  onSelectMeeting: (m: Meeting) => void;
  onUpdateItem: (meetingId: string, itemId: string, type: 'todo' | 'schedule', updates: any) => void;
  onCreateList?: (title: string, category: string, group?: string) => void;
  onUpdateMeeting?: (meeting: Meeting) => void;
  onDeleteMeeting?: (id: string) => void;
}

type FilterType = 'myday' | 'important' | 'planned' | 'tasks' | 'all' | 'inbox' | 'deactivated';
type ViewState = 
  | { type: 'filter'; id: FilterType }
  | { type: 'category'; name: string };

interface CombinedItem {
  uid: string; 
  id: string;
  title: string;
  date?: string;
  time?: string;
  assignee?: string;
  completed?: boolean;
  confirmed?: boolean;
  deactivated?: boolean;
  important?: boolean;
  notes?: string;
  subTasks?: SubTask[];
  meetingId: string;
  meetingTitle: string;
  category: string;
  group: string;
  originalMeeting: Meeting;
  type: 'todo' | 'schedule';
}

export const TaskView: React.FC<TaskViewProps> = ({ 
  meetings = [], 
  onSelectMeeting, 
  onUpdateItem, 
  onCreateList, 
  onUpdateMeeting, 
  onDeleteMeeting 
}) => {
  const [viewState, setViewState] = useState<ViewState>({ type: 'filter', id: 'all' });
  const [selectedItemUid, setSelectedItemUid] = useState<string | null>(null);
  const [searchQuery, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mainInput, setMainInput] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  
  const [draggedItemUid, setDraggedItemUid] = useState<string | null>(null);
  const [draggedCategoryName, setDraggedCategoryName] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  const sidebarDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (isMobile) setIsSidebarOpen(false);
  }, [isMobile]);

  const { groups, categoryDataByGroup } = useMemo(() => {
    const groupMap: { [key: string]: Set<string> } = {};
    const categoryToGroup: { [key: string]: string } = {};
    
    const sortedMeetings = [...meetings].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    sortedMeetings.forEach(m => {
      const cat = m.category || '기타';
      const g = m.group || '회의록';
      if (!categoryToGroup[cat]) {
        categoryToGroup[cat] = g;
      }
    });

    Object.entries(categoryToGroup).forEach(([cat, g]) => {
      if (!groupMap[g]) groupMap[g] = new Set();
      groupMap[g].add(cat);
    });

    const groupsList = Object.keys(groupMap).sort();
    const catMap: { [key: string]: string[] } = {};
    groupsList.forEach(g => { catMap[g] = Array.from(groupMap[g]).sort(); });
    return { groups: groupsList, categoryDataByGroup: catMap };
  }, [meetings]);

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
    if (clean.length === 8 && /^\d+$/.test(clean)) {
      return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
    }
    return clean.match(/^\d{4}-\d{2}-\d{2}$/) ? clean : '';
  };

  const allItems = useMemo(() => {
    const items: CombinedItem[] = [];
    meetings.forEach(m => {
      (m.minutes?.todos || []).forEach(t => {
        items.push({
          uid: `todo-${m.id}-${t.id}`, id: t.id, title: t.task, date: t.dueDate, assignee: t.assignee, 
          completed: t.completed, confirmed: t.confirmed, deactivated: t.deactivated, important: t.important, notes: t.notes || '', subTasks: t.subTasks || [],
          meetingId: m.id, meetingTitle: m.title, category: m.category, group: m.group || '회의록',
          originalMeeting: m, type: 'todo'
        });
      });
    });
    return items;
  }, [meetings]);

  const filteredItems = useMemo(() => {
    let items = [...allItems];
    if (viewState.type === 'category') {
        items = items.filter(t => t.category === viewState.name && t.confirmed !== false && !t.deactivated);
    } else {
        const filterId = viewState.id;
        const todayStr = new Date().toISOString().split('T')[0];
        switch (filterId) {
            case 'deactivated':
                items = items.filter(t => t.deactivated === true);
                break;
            case 'inbox':
                items = items.filter(t => t.confirmed === false && !t.deactivated);
                break;
            case 'myday':
                items = items.filter(t => normalizeDate(t.date) === todayStr && t.confirmed !== false && !t.deactivated);
                break;
            case 'important':
                items = items.filter(t => t.important === true && t.confirmed !== false && !t.deactivated);
                break;
            case 'planned':
                items = items.filter(t => !!t.date && t.confirmed !== false && !t.deactivated);
                break;
            case 'tasks':
                items = items.filter(t => t.originalMeeting.type === 'list' && t.confirmed !== false && !t.deactivated);
                break;
            case 'all':
            default:
                items = items.filter(t => t.confirmed !== false && !t.deactivated);
                break;
        }
    }
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      items = items.filter(t => t.title.toLowerCase().includes(lower) || t.meetingTitle.toLowerCase().includes(lower));
    }
    return items;
  }, [allItems, viewState, searchQuery]);

  const activeTasks = filteredItems.filter(t => !t.completed);
  const completedTasks = filteredItems.filter(t => t.completed);

  const selectedCategoryName = viewState.type === 'category' ? viewState.name : null;
  const currentFilterId = viewState.type === 'filter' ? viewState.id : null;

  const handleAddItem = async (title?: string) => {
    const titleToUse = (title || mainInput).trim();
    if (!titleToUse || !onUpdateMeeting) return;
    setMainInput('');
    const targetCategory = selectedCategoryName || '기타';
    let targetMeeting = meetings.find(m => m.category === targetCategory);
    if (!targetMeeting) targetMeeting = meetings[0];
    if (!targetMeeting) return;
    const newTodo: TodoItem = {
      id: Math.random().toString(36).substr(2, 9),
      task: titleToUse,
      assignee: '미지정',
      completed: false,
      confirmed: true,
      deactivated: false,
      important: currentFilterId === 'important',
      dueDate: currentFilterId === 'myday' ? new Date().toISOString().split('T')[0] : undefined,
      subTasks: []
    };
    onUpdateMeeting({ 
      ...targetMeeting, 
      minutes: { ...targetMeeting.minutes, todos: [newTodo, ...(targetMeeting.minutes?.todos || [])] }, 
      updatedAt: Date.now() 
    });
  };

  const handleDragStart = (e: React.DragEvent, itemUid: string) => {
    setDraggedItemUid(itemUid);
    e.dataTransfer.setData('type', 'task');
    e.dataTransfer.setData('id', itemUid);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCategoryDragStart = (e: React.DragEvent, categoryName: string) => {
    setDraggedCategoryName(categoryName);
    e.dataTransfer.setData('type', 'category');
    e.dataTransfer.setData('id', categoryName);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnCategory = async (e: React.DragEvent, targetCat: string) => {
    e.preventDefault();
    setDragOverCategory(null);
    const type = e.dataTransfer.getData('type');
    if (type !== 'task') return;
    
    const taskId = e.dataTransfer.getData('id');
    if (!taskId || !onUpdateMeeting) return;

    const sourceItem = allItems.find(it => it.uid === taskId);
    if (!sourceItem || sourceItem.category === targetCat) return;

    const sourceMeeting = meetings.find(m => m.id === sourceItem.meetingId);
    const targetMeeting = meetings.find(m => m.category === targetCat);
    if (!sourceMeeting || !targetMeeting) return;

    const todoToMove = sourceMeeting.minutes.todos.find(t => t.id === sourceItem.id);
    if (!todoToMove) return;

    const updatedSource = { ...sourceMeeting, minutes: { ...sourceMeeting.minutes, todos: sourceMeeting.minutes.todos.filter(t => t.id !== sourceItem.id) }};
    const updatedTarget = { ...targetMeeting, minutes: { ...targetMeeting.minutes, todos: [todoToMove, ...targetMeeting.minutes.todos] }};

    onUpdateMeeting(updatedSource);
    onUpdateMeeting(updatedTarget);
    setDraggedItemUid(null);
  };

  const handleDropOnGroup = async (e: React.DragEvent, targetGroupName: string) => {
    e.preventDefault();
    setDragOverGroup(null);
    const type = e.dataTransfer.getData('type');
    if (type !== 'category') return;

    const catName = e.dataTransfer.getData('id');
    if (!catName || !onUpdateMeeting) return;

    const targetMeetings = meetings.filter(m => m.category === catName);
    targetMeetings.forEach(m => {
      if (m.group !== targetGroupName) {
        onUpdateMeeting({ ...m, group: targetGroupName, updatedAt: Date.now() });
      }
    });
    setDraggedCategoryName(null);
  };

  const handleRenameGroup = (oldName: string) => {
    const newName = prompt('변경할 그룹 이름을 입력하세요:', oldName);
    if (newName && newName !== oldName && onUpdateMeeting) {
      meetings.forEach(m => {
        if ((m.group || '회의록') === oldName) {
          onUpdateMeeting({ ...m, group: newName, updatedAt: Date.now() });
        }
      });
      if (collapsedGroups.has(oldName)) {
        setCollapsedGroups(prev => {
          const next = new Set(prev);
          next.delete(oldName);
          next.add(newName);
          return next;
        });
      }
    }
  };

  const handleCreateNewList = () => {
    const name = prompt('새로운 목록 이름을 입력하세요:');
    if (name && onCreateList) onCreateList(name, name, '회의록');
  };

  const handleRenameList = (oldName: string) => {
    const newName = prompt('변경할 이름을 입력하세요:', oldName);
    if (newName && onUpdateMeeting) {
      meetings.filter(m => m.category === oldName).forEach(m => onUpdateMeeting({ ...m, category: newName, updatedAt: Date.now() }));
      if (selectedCategoryName === oldName) setViewState({ type: 'category', name: newName });
    }
  };

  const handleDeleteList = (name: string) => {
    if (!confirm(`'${name}' 목록과 포함된 모든 항목을 삭제하시겠습니까?`)) return;
    meetings.filter(m => m.category === name).forEach(m => onDeleteMeeting?.(m.id));
    if (selectedCategoryName === name) setViewState({ type: 'filter', id: 'all' });
  };

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  const selectedItem = allItems.find(it => it.uid === selectedItemUid);

  const renderTaskItem = (item: CombinedItem) => {
    const isInboxItem = item.confirmed === false && !item.deactivated;
    const isDeactivated = item.deactivated === true;
    return (
        <div 
          key={item.uid}
          draggable={!isDeactivated}
          onDragStart={(e) => handleDragStart(e, item.uid)}
          onClick={() => setSelectedItemUid(item.uid)}
          className={`group flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-[16px] sm:rounded-[20px] border-2 transition-all cursor-pointer ${selectedItemUid === item.uid ? 'bg-slate-50 border-slate-200' : 'bg-white border-transparent hover:bg-gray-50'} ${item.completed ? 'opacity-50' : ''} ${isDeactivated ? 'opacity-40 grayscale' : ''}`}
        >
          {!isDeactivated && <div className="mt-1 text-gray-300 opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0"><GripVertical size={16}/></div>}
          {isDeactivated ? (
             <button 
                onClick={(e) => { e.stopPropagation(); onUpdateItem(item.meetingId, item.id, 'todo', { deactivated: false }); }}
                className="w-6 h-6 mt-1 rounded-lg border-2 border-gray-400 text-gray-400 flex items-center justify-center hover:bg-gray-400 hover:text-white transition-all shadow-sm flex-shrink-0"
                title="복구하기"
            >
                <RotateCcw size={12} strokeWidth={3} />
            </button>
          ) : isInboxItem ? (
            <button 
                onClick={(e) => { e.stopPropagation(); onUpdateItem(item.meetingId, item.id, 'todo', { confirmed: true }); }}
                className="w-6 h-6 mt-1 rounded-lg border-2 border-blue-600 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm flex-shrink-0"
                title="작업으로 확정"
            >
                <Plus size={14} strokeWidth={3} />
            </button>
          ) : (
            <button 
                onClick={(e) => { e.stopPropagation(); onUpdateItem(item.meetingId, item.id, 'todo', { completed: !item.completed }); }} 
                className={`w-6 h-6 mt-1 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${item.completed ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 hover:border-blue-400 bg-white'}`}
            >
                {item.completed && <Check size={14} strokeWidth={3}/>}
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-[13px] sm:text-[15px] font-bold ${item.completed ? 'text-gray-400 line-through' : 'text-slate-900'}`}>{item.title}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[9px] sm:text-[11px] font-bold text-gray-400">
               {isDeactivated && <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">비활성화됨</span>}
               {isInboxItem && <span className="text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">검토 필요</span>}
               <span className="flex items-center gap-1"><Inbox size={11}/> {item.category}</span>
               {item.date && <span className={`flex items-center gap-1 ${new Date(normalizeDate(item.date)) < new Date() && !item.completed ? 'text-red-500' : ''}`}><CalendarIcon size={11}/> {item.date} 마감</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
              {!isDeactivated && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onUpdateItem(item.meetingId, item.id, 'todo', { deactivated: true }); }}
                    className="mt-1 p-2 text-gray-300 hover:text-red-400 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    title="비활성화 (목록에서 숨기기)"
                  >
                    <EyeOff size={18} />
                  </button>
              )}
              {!isDeactivated && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onUpdateItem(item.meetingId, item.id, 'todo', { important: !item.important }); }} 
                    className={`mt-1 p-2 transition-all flex-shrink-0 ${item.important ? 'text-pink-500' : 'text-gray-300 hover:text-gray-400'}`}
                  >
                    <Star size={20} fill={item.important ? "currentColor" : "none"}/>
                  </button>
              )}
          </div>
        </div>
    );
  };

  const inboxCount = useMemo(() => allItems.filter(t => t.confirmed === false && !t.deactivated).length, [allItems]);
  const deactivatedCount = useMemo(() => allItems.filter(t => t.deactivated === true).length, [allItems]);

  return (
    <div className="flex min-h-[calc(100vh-64px)] md:min-h-screen bg-white overflow-hidden text-sm relative">
      {isMobile && isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/30 z-10"
          aria-label="사이드바 닫기"
        />
      )}
      <aside className={`${isSidebarOpen || !isMobile ? 'translate-x-0' : '-translate-x-full'} fixed md:static inset-y-0 left-0 w-64 sm:w-72 bg-gray-50 flex flex-col transition-transform duration-300 border-r overflow-hidden flex-shrink-0 z-20 shadow-2xl md:shadow-none`}>
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input value={searchQuery} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100" placeholder="검색" />
           </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-20 custom-scrollbar">
          <button onClick={() => setViewState({ type: 'filter', id: 'inbox' })} className={`w-full flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl transition-all ${currentFilterId === 'inbox' ? 'bg-white shadow-sm font-bold text-blue-600' : 'text-gray-600 hover:bg-white/50'}`}>
             <div className="flex items-center gap-3 sm:gap-4"><Inbox size={20} className={currentFilterId === 'inbox' ? "text-blue-500" : "text-gray-400"}/> 수신함 (미배정)</div>
             {inboxCount > 0 && <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{inboxCount}</span>}
          </button>
          <div className="h-px bg-gray-200 my-2 mx-2"></div>
          <button onClick={() => setViewState({ type: 'filter', id: 'myday' })} className={`w-full flex items-center gap-3 sm:gap-4 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl transition-all ${currentFilterId === 'myday' ? 'bg-white shadow-sm font-bold text-orange-600' : 'text-gray-600 hover:bg-white/50'}`}><Sun size={20} className="text-orange-500"/> 오늘 작업</button>
          <button onClick={() => setViewState({ type: 'filter', id: 'important' })} className={`w-full flex items-center gap-3 sm:gap-4 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl transition-all ${currentFilterId === 'important' ? 'bg-white shadow-sm font-bold text-pink-500' : 'text-gray-600 hover:bg-white/50'}`}><Star size={20} className="text-pink-500"/> 중요</button>
          <button onClick={() => setViewState({ type: 'filter', id: 'planned' })} className={`w-full flex items-center gap-3 sm:gap-4 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl transition-all ${currentFilterId === 'planned' ? 'bg-white shadow-sm font-bold text-teal-600' : 'text-gray-600 hover:bg-white/50'}`}><CalendarDays size={20} className="text-teal-500"/> 계획된 일정</button>
          <button onClick={() => setViewState({ type: 'filter', id: 'tasks' })} className={`w-full flex items-center gap-3 sm:gap-4 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl transition-all ${currentFilterId === 'tasks' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-600 hover:bg-white/50'}`}><CheckSquare size={20} className="text-indigo-500"/> 작업</button>
          <button onClick={() => setViewState({ type: 'filter', id: 'all' })} className={`w-full flex items-center gap-3 sm:gap-4 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl transition-all ${currentFilterId === 'all' ? 'bg-white shadow-sm font-bold text-gray-900' : 'text-gray-600 hover:bg-white/50'}`}><Layout size={20} className="text-gray-400"/> 모든 작업</button>
          <button onClick={() => setViewState({ type: 'filter', id: 'deactivated' })} className={`w-full flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl transition-all ${currentFilterId === 'deactivated' ? 'bg-white shadow-sm font-bold text-gray-500' : 'text-gray-500 hover:bg-white/50'}`}>
             <div className="flex items-center gap-3 sm:gap-4"><Archive size={20} className={currentFilterId === 'deactivated' ? "text-gray-600" : "text-gray-400"}/> 비활성화된 항목</div>
             {deactivatedCount > 0 && <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{deactivatedCount}</span>}
          </button>
          <div className="h-px bg-gray-200 my-4 mx-2"></div>
          <div className="px-3 sm:px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">목록 및 카테고리</div>
          
          {groups.map(groupName => {
            const isCollapsed = collapsedGroups.has(groupName);
            return (
              <div key={groupName} className="mt-2 mb-2">
                <div 
                  onDragOver={(e) => { e.preventDefault(); setDragOverGroup(groupName); }}
                  onDragLeave={() => setDragOverGroup(null)}
                  onDrop={(e) => handleDropOnGroup(e, groupName)}
                  className={`group/group flex items-center justify-between px-3 sm:px-4 py-2 text-xs font-black tracking-tight rounded-xl transition-all cursor-pointer ${dragOverGroup === groupName ? 'bg-blue-100 ring-2 ring-blue-400' : 'hover:bg-gray-100 text-slate-800'}`}
                  onClick={() => toggleGroup(groupName)}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                    <span className="uppercase">{groupName}</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRenameGroup(groupName); }} 
                    className="p-1 opacity-0 group-hover/group:opacity-100 hover:bg-gray-200 rounded text-gray-400 transition-opacity"
                    title="그룹 이름 수정"
                  >
                    <FolderEdit size={12}/>
                  </button>
                </div>
                
                {!isCollapsed && (
                  <div className="space-y-0.5 mt-1">
                    {categoryDataByGroup[groupName].map(cat => (
                      <div 
                        key={cat}
                        draggable
                        onDragStart={(e) => handleCategoryDragStart(e, cat)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverCategory(cat); }}
                        onDragLeave={() => setDragOverCategory(null)}
                        onDrop={(e) => handleDropOnCategory(e, cat)}
                        onClick={() => setViewState({ type: 'category', name: cat })}
                        className={`group/cat flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl cursor-pointer transition-all ml-1.5 sm:ml-2 ${selectedCategoryName === cat ? 'bg-white shadow-sm font-bold text-blue-600' : dragOverCategory === cat ? 'bg-blue-50 border-blue-400' : 'text-gray-500 hover:bg-white/50'}`}
                      >
                        <div className="flex items-center gap-4 truncate">
                          <Folder size={18} className={selectedCategoryName === cat ? 'text-blue-500' : 'text-gray-400'}/>
                          <span className="truncate text-[11px] sm:text-xs font-bold">{cat}</span>
                        </div>
                        <div className="flex items-center opacity-0 group-hover/cat:opacity-100 gap-1">
                          <button onClick={(e) => { e.stopPropagation(); handleRenameList(cat); }} className="p-1 hover:bg-gray-100 rounded text-gray-400"><Edit2 size={12}/></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteList(cat); }} className="p-1 hover:bg-gray-100 rounded text-red-400"><Trash2 size={12}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={handleCreateNewList} className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-4 text-blue-600 font-bold hover:bg-blue-50 rounded-xl transition-all mt-2 border border-dashed border-blue-100 text-xs sm:text-sm"><Plus size={18}/> 새 목록 만들기</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
        <div className="p-3 sm:p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">{isSidebarOpen ? <PanelLeftClose size={20}/> : <PanelLeftOpen size={20}/>}</button>
            <h2 className="text-lg sm:text-2xl font-black text-slate-900">
                {selectedCategoryName || (
                    currentFilterId === 'inbox' ? '수신함 (미배정)' :
                    currentFilterId === 'deactivated' ? '비활성화된 항목' :
                    currentFilterId === 'all' ? '모든 작업' : 
                    currentFilterId === 'myday' ? '오늘 작업' : 
                    currentFilterId === 'important' ? '중요' : 
                    currentFilterId === 'planned' ? '계획된 일정' : '작업'
                )}
            </h2>
          </div>
          {currentFilterId !== 'inbox' && currentFilterId !== 'deactivated' && (
            <div className="flex items-center gap-2.5 sm:gap-3 p-2 sm:p-3 bg-white border-2 border-blue-600 rounded-2xl sm:rounded-full shadow-lg w-full md:w-[400px] focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                <Plus size={18} className="text-blue-600 ml-1.5" />
                <input value={mainInput} onChange={(e) => setMainInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddItem()} placeholder="할 일 추가..." className="flex-1 border-none outline-none px-2 font-bold text-slate-900 bg-transparent text-[13px] sm:text-sm" />
                <button onClick={() => handleAddItem()} className="px-4 py-2 bg-blue-600 text-white font-black rounded-full shadow-md hover:bg-blue-700 transition-all active:scale-95 text-xs sm:text-sm">추가</button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-2.5 sm:space-y-4 custom-scrollbar">
           {currentFilterId === 'inbox' && activeTasks.length > 0 && (
              <div className="bg-orange-50 border border-orange-100 p-3 sm:p-4 rounded-xl flex items-center gap-3 mb-4 text-orange-700 text-xs sm:text-sm font-medium">
                 <AlertCircle size={20} />
                 <p>AI가 생성한 미배정 작업입니다. [+] 버튼을 눌러 작업을 확정하거나, [비활성화] 버튼을 눌러 목록에서 숨기세요.</p>
              </div>
           )}
           {currentFilterId === 'deactivated' && activeTasks.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 p-3 sm:p-4 rounded-xl flex items-center gap-3 mb-4 text-gray-700 text-xs sm:text-sm font-medium">
                 <Archive size={20} />
                 <p>비활성화된 항목입니다. 작업으로 복구하려면 왼쪽의 회전 화살표 버튼을 누르세요.</p>
              </div>
           )}
           {activeTasks.length > 0 ? activeTasks.map(renderTaskItem) : (
             <div className="py-16 sm:py-20 text-center text-gray-400 font-bold">
                {currentFilterId === 'inbox' ? '모든 작업이 배정되었습니다.' : 
                 currentFilterId === 'deactivated' ? '비활성화된 항목이 없습니다.' : 
                 '진행 중인 작업이 없습니다.'}
             </div>
           )}
           {completedTasks.length > 0 && (
             <div className="pt-4 sm:pt-8 border-t border-gray-100 space-y-3">
                <button onClick={() => setShowCompleted(!showCompleted)} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-black text-gray-500 transition-all">
                  {showCompleted ? <EyeOff size={14}/> : <Eye size={14}/>} 완료됨 {completedTasks.length} {showCompleted ? '숨기기' : '보기'}
                </button>
                {showCompleted && <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">{completedTasks.map(renderTaskItem)}</div>}
             </div>
           )}
        </div>
      </div>

      {selectedItemUid && selectedItem && (
        <div className="fixed md:absolute right-0 top-0 bottom-0 w-full md:w-[420px] bg-white border-l border-gray-200 z-30 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="p-3 sm:p-6 border-b flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">작업 상세 관리</span>
                <button onClick={() => setSelectedItemUid(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-8 space-y-4 sm:space-y-8 custom-scrollbar">
                <div className="flex items-start gap-3 sm:gap-4">
                    {selectedItem.deactivated ? (
                         <button 
                            onClick={() => onUpdateItem(selectedItem.meetingId, selectedItem.id, 'todo', { deactivated: false })} 
                            className="w-8 h-8 mt-1 rounded-lg border-2 border-gray-400 text-gray-400 flex items-center justify-center hover:bg-gray-400 hover:text-white transition-all shadow-sm flex-shrink-0"
                            title="복구하기"
                        >
                            <RotateCcw size={18} strokeWidth={3} />
                        </button>
                    ) : selectedItem.confirmed === false ? (
                       <button 
                         onClick={() => onUpdateItem(selectedItem.meetingId, selectedItem.id, 'todo', { confirmed: true })} 
                         className="w-8 h-8 mt-1 rounded-lg border-2 border-blue-600 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm flex-shrink-0"
                         title="작업 확정"
                       >
                         <Plus size={18} strokeWidth={3} />
                       </button>
                    ) : (
                       <button 
                        onClick={() => onUpdateItem(selectedItem.meetingId, selectedItem.id, 'todo', { completed: !selectedItem.completed })} 
                        className={`w-8 h-8 mt-1 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${selectedItem.completed ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 bg-white'}`}
                       >
                         {selectedItem.completed && <Check size={18} strokeWidth={3}/>}
                       </button>
                    )}
                    <textarea 
                      className={`flex-1 text-lg sm:text-2xl font-black text-slate-900 border-none outline-none bg-transparent resize-none leading-tight ${selectedItem.completed ? 'text-gray-400 line-through' : ''}`}
                      value={selectedItem.title}
                      onChange={(e) => onUpdateItem(selectedItem.meetingId, selectedItem.id, 'todo', { task: e.target.value })}
                    />
                    {!selectedItem.deactivated && (
                        <button onClick={() => onUpdateItem(selectedItem.meetingId, selectedItem.id, 'todo', { important: !selectedItem.important })} className={`mt-1 p-2 flex-shrink-0 ${selectedItem.important ? 'text-pink-500' : 'text-gray-300'}`}>
                        <Star size={24} fill={selectedItem.important ? "currentColor" : "none"}/>
                        </button>
                    )}
                </div>
                {selectedItem.deactivated ? (
                    <div className="bg-gray-50 p-4 rounded-xl text-center border border-gray-100">
                        <p className="text-[11px] sm:text-xs text-gray-500 font-bold mb-3">이 항목은 비활성화 상태입니다.</p>
                        <button 
                            onClick={() => onUpdateItem(selectedItem.meetingId, selectedItem.id, 'todo', { deactivated: false })} 
                            className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition-all"
                        >
                            다시 활성화하기
                        </button>
                    </div>
                ) : (
                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                        <p className="text-[11px] sm:text-xs text-slate-500 font-bold mb-3">
                            {selectedItem.confirmed === false ? '이 작업은 아직 미배정 상태입니다.' : '목록에서 이 작업을 숨기시겠습니까?'}
                        </p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => onUpdateItem(selectedItem.meetingId, selectedItem.id, 'todo', { deactivated: true })} 
                                className="flex-1 py-2 bg-white text-gray-500 border border-gray-200 font-bold rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                            >
                                <EyeOff size={14}/> 비활성화
                            </button>
                            {selectedItem.confirmed === false && (
                                <button 
                                    onClick={() => onUpdateItem(selectedItem.meetingId, selectedItem.id, 'todo', { confirmed: true })} 
                                    className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <Check size={14}/> 작업 확정
                                </button>
                            )}
                        </div>
                    </div>
                )}
                <div className="space-y-3">
                   {selectedItem.subTasks?.map(sub => (
                     <div key={sub.id} className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-2xl group/sub border border-transparent hover:border-gray-100">
                        <button onClick={() => {
                          const newSubs = selectedItem.subTasks?.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s);
                          onUpdateItem(selectedItem.meetingId, selectedItem.id, 'todo', { subTasks: newSubs });
                        }} className={`w-5 h-5 rounded border flex items-center justify-center ${sub.completed ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'}`}>
                           {sub.completed && <Check size={12}/>}
                        </button>
                        <span className={`text-sm font-bold flex-1 ${sub.completed ? 'text-gray-400 line-through' : 'text-slate-700'}`}>{sub.task}</span>
                        <button onClick={() => {
                           const newSubs = selectedItem.subTasks?.filter(s => s.id !== sub.id);
                           onUpdateItem(selectedItem.meetingId, selectedItem.id, 'todo', { subTasks: newSubs });
                        }} className="opacity-0 group-hover/sub:opacity-100 text-gray-300 hover:text-red-500"><X size={14}/></button>
                     </div>
                   ))}
                   <button 
                     onClick={() => {
                       const task = prompt('하위 할 일을 입력하세요:');
                       if (task) {
                         const newSubs = [...(selectedItem.subTasks || []), { id: Math.random().toString(36).substr(2, 9), task, completed: false }];
                         onUpdateItem(selectedItem.meetingId, selectedItem.id, 'todo', { subTasks: newSubs });
                       }
                     }}
                     className="w-full flex items-center gap-4 p-3 sm:p-4 text-blue-600 font-bold hover:bg-blue-50 rounded-2xl transition-all"
                   >
                     <Plus size={20}/> 다음 단계
                   </button>
                </div>
                <div className="h-px bg-gray-100"></div>
                <div className="space-y-1">
                   <button className="w-full flex items-center gap-4 p-3 sm:p-4 text-gray-500 hover:bg-gray-50 rounded-2xl transition-all text-sm font-bold"><Sun size={20}/> 나의 하루에 추가</button>
                   <button className="w-full flex items-center gap-4 p-3 sm:p-4 text-gray-500 hover:bg-gray-50 rounded-2xl transition-all text-sm font-bold"><Bell size={20}/> 미리 알림</button>
                   <div className="relative group/date">
                       <input 
                         type="date"
                         ref={sidebarDateRef}
                         className="absolute inset-0 opacity-0 cursor-pointer z-20 w-full"
                         value={normalizeDate(selectedItem.date)}
                         onChange={(e) => onUpdateItem(selectedItem.meetingId, selectedItem.id, 'todo', { dueDate: e.target.value })}
                       />
                       <div className={`flex items-center gap-2 p-3 sm:p-4 rounded-2xl transition-all group-hover/date:bg-gray-50 ${selectedItem.date ? 'text-blue-600 bg-blue-50/30 font-black' : 'text-gray-500'}`}>
                          <CalendarIcon size={20}/>
                          <span className="flex-1 text-sm">{selectedItem.date ? `${selectedItem.date} 마감` : '기한 설정'}</span>
                          {selectedItem.date && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); onUpdateItem(selectedItem.meetingId, selectedItem.id, 'todo', { dueDate: null }); }} 
                              className="p-1 hover:bg-blue-100 rounded-full relative z-30"
                              title="기한 삭제"
                            >
                                <X size={14}/>
                            </button>
                          )}
                       </div>
                   </div>
                   <button className="w-full flex items-center gap-4 p-3 sm:p-4 text-gray-500 hover:bg-gray-50 rounded-2xl transition-all text-sm font-bold"><Repeat size={20}/> 반복</button>
                   <button className="w-full flex items-center gap-4 p-3 sm:p-4 text-gray-500 hover:bg-gray-50 rounded-2xl transition-all text-sm font-bold"><User size={20}/> 할당 대상 {selectedItem.assignee && <span className="ml-auto text-blue-600">@{selectedItem.assignee}</span>}</button>
                   <button className="w-full flex items-center gap-4 p-3 sm:p-4 text-gray-500 hover:bg-gray-50 rounded-2xl transition-all text-sm font-bold"><Paperclip size={20}/> 파일 추가</button>
                </div>
                <div className="h-px bg-gray-100"></div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">메모 추가</label>
                  <textarea 
                    className="w-full min-h-[140px] p-3 sm:p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none text-sm text-slate-700 font-medium leading-relaxed" 
                    placeholder="상세 내용을 입력하세요..."
                    value={selectedItem.notes}
                    onChange={(e) => onUpdateItem(selectedItem.meetingId, selectedItem.id, 'todo', { notes: e.target.value })}
                  />
                </div>
            </div>
            <div className="p-3 sm:p-6 border-t bg-white flex items-center justify-between">
                <button onClick={() => { if(confirm('영구적으로 삭제하시겠습니까? (기록에서도 제거됩니다)')) { meetings.filter(m => m.id === selectedItem.meetingId).forEach(m => { const newTodos = m.minutes.todos.filter(t => t.id !== selectedItem.id); onUpdateMeeting?.({ ...m, minutes: { ...m.minutes, todos: newTodos } }); }); setSelectedItemUid(null); } }} className="p-3 sm:p-4 text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={22}/></button>
                <div className="text-[10px] font-bold text-gray-400">마지막 업데이트: {new Date(selectedItem.originalMeeting.updatedAt || Date.now()).toLocaleTimeString()}</div>
                <button onClick={() => setSelectedItemUid(null)} className="p-3 sm:p-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-all">닫기</button>
            </div>
        </div>
      )}
    </div>
  );
};
