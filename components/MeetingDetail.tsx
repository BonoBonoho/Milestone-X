
import React, { useState, useEffect } from 'react';
import { Download, ChevronLeft, Calendar, UserCheck, Check, Edit3, Save, Trash2, Plus, Share2, User as UserIcon, CheckCircle2, ListTodo, CalendarDays, AlertCircle, Circle, EyeOff } from 'lucide-react';
import { Meeting, MeetingMinutes, TodoItem, ScheduleItem, TranscriptPart } from '../types';

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
  onUpdate: (updated: Meeting) => void;
}

const ensureId = (id?: string) => id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const MeetingDetail: React.FC<MeetingDetailProps> = ({ meeting, onBack, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'minutes' | 'transcript'>('minutes');
  const [isEditing, setIsEditing] = useState(false);
  const [editedMinutes, setEditedMinutes] = useState<MeetingMinutes>(() => {
    const m = JSON.parse(JSON.stringify(meeting.minutes));
    m.todos = (m.todos || []).map((t: any) => ({ ...t, id: ensureId(t.id) }));
    m.schedules = (m.schedules || []).map((s: any) => ({ ...s, id: ensureId(s.id) }));
    return m;
  });
  const [editedTranscript, setEditedTranscript] = useState<TranscriptPart[]>(meeting.transcript || []);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const m = JSON.parse(JSON.stringify(meeting.minutes));
    m.todos = (m.todos || []).map((t: any) => ({ ...t, id: ensureId(t.id) }));
    m.schedules = (m.schedules || []).map((s: any) => ({ ...s, id: ensureId(s.id) }));
    setEditedMinutes(m);
    setEditedTranscript(meeting.transcript || []);
  }, [meeting]);

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

  const handleSave = () => {
    onUpdate({ ...meeting, minutes: editedMinutes, transcript: editedTranscript, updatedAt: Date.now() });
    setIsEditing(false);
  };

  const updateTodo = (id: string, updates: Partial<TodoItem>) => {
    if (isEditing) {
      setEditedMinutes(prev => ({
        ...prev,
        todos: prev.todos.map(t => t.id === id ? { ...t, ...updates } : t)
      }));
    } else {
      const newMinutes = JSON.parse(JSON.stringify(meeting.minutes));
      newMinutes.todos = newMinutes.todos.map((t: any) => t.id === id ? { ...t, ...updates } : t);
      onUpdate({ ...meeting, minutes: newMinutes, updatedAt: Date.now() });
    }
  };

  const updateSchedule = (id: string, updates: Partial<ScheduleItem>) => {
    if (isEditing) {
        setEditedMinutes(prev => ({
        ...prev,
        schedules: prev.schedules.map(s => s.id === id ? { ...s, ...updates } : s)
        }));
    } else {
        const newMinutes = JSON.parse(JSON.stringify(meeting.minutes));
        newMinutes.schedules = newMinutes.schedules.map((s: any) => s.id === id ? { ...s, ...updates } : s);
        onUpdate({ ...meeting, minutes: newMinutes, updatedAt: Date.now() });
    }
  };

  const deleteTodo = (id: string) => {
    setEditedMinutes(prev => ({ ...prev, todos: prev.todos.filter(t => t.id !== id) }));
  };

  const deleteSchedule = (id: string) => {
    setEditedMinutes(prev => ({ ...prev, schedules: prev.schedules.filter(s => s.id !== id) }));
  };

  const addEmptyTodo = () => {
    setEditedMinutes(prev => ({
      ...prev,
      todos: [...prev.todos, { id: ensureId(), task: '', assignee: '미지정', completed: false, confirmed: true, deactivated: false }]
    }));
  };

  const addEmptySchedule = () => {
    setEditedMinutes(prev => ({
      ...prev,
      schedules: [...prev.schedules, { id: ensureId(), event: '', date: meeting.date, confirmed: true, deactivated: false }]
    }));
  };

  const handleShare = async () => {
    const textToShare = `[회의록] ${meeting.title}\n일시: ${meeting.date}\n요약: ${editedMinutes.summary}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: meeting.title, text: textToShare });
      } catch (e) { console.log('공유 취소'); }
    } else {
      navigator.clipboard.writeText(textToShare).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const confirmItem = (type: 'todo' | 'schedule', id: string) => {
      if(type === 'todo') updateTodo(id, { confirmed: true, deactivated: false });
      else updateSchedule(id, { confirmed: true, deactivated: false });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500 pb-32">
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 font-bold text-sm transition-colors">
          <ChevronLeft size={16} /> 목록으로
        </button>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">취소</button>
              <button onClick={handleSave} className="px-5 py-2.5 text-white bg-blue-600 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"><Save size={16}/> 저장</button>
            </>
          ) : (
            <>
              <button onClick={handleShare} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-100">
                {copied ? <Check size={18} className="text-green-500"/> : <Share2 size={18}/>}
              </button>
              <button onClick={() => setIsEditing(true)} className="px-5 py-2.5 text-blue-600 bg-blue-50 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-100 transition-all border border-blue-100"><Edit3 size={16}/> 편집</button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[32px] p-6 sm:p-10 shadow-sm border border-slate-100">
        <div className="border-b border-slate-50 pb-8 mb-8">
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 mb-4 tracking-tight leading-tight">{meeting.title}</h1>
            <div className="flex flex-wrap gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 bg-slate-50 text-slate-500 px-3 py-1.5 rounded-xl border border-slate-100"><UserCheck size={14}/> {meeting.author}</span>
                <span className="flex items-center gap-1.5 bg-slate-50 text-slate-500 px-3 py-1.5 rounded-xl border border-slate-100"><Calendar size={14}/> {meeting.date}</span>
            </div>
        </div>

        <div className="flex border-b border-slate-100 mb-8 overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('minutes')} className={`px-6 py-4 font-bold text-sm border-b-2 whitespace-nowrap transition-all ${activeTab === 'minutes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>리포트</button>
          <button onClick={() => setActiveTab('transcript')} className={`px-6 py-4 font-bold text-sm border-b-2 whitespace-nowrap transition-all ${activeTab === 'transcript' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>녹취록</button>
        </div>

        <div className="space-y-12">
          {activeTab === 'minutes' ? (
            <>
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 size={20} className="text-blue-600" />
                    <h3 className="text-lg font-bold text-slate-900">핵심 요약</h3>
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest ml-1">요약 편집</label>
                    <textarea 
                      className="w-full bg-white p-6 sm:p-8 rounded-2xl border-2 border-blue-100 text-slate-900 text-base leading-relaxed min-h-[300px] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium shadow-inner"
                      value={editedMinutes.summary}
                      onChange={(e) => setEditedMinutes({ ...editedMinutes, summary: e.target.value })}
                      placeholder="회의 내용을 요약해 주세요..."
                    />
                  </div>
                ) : (
                  <div className="bg-slate-50/80 p-6 sm:p-10 rounded-[32px] border border-slate-100 text-slate-900 text-base sm:text-lg leading-relaxed whitespace-pre-wrap font-medium">
                    {editedMinutes.summary || '요약 내용이 없습니다.'}
                  </div>
                )}
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <section className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ListTodo size={20} className="text-emerald-600"/>
                        <h3 className="text-lg font-bold text-slate-900">액션 아이템</h3>
                    </div>
                    {isEditing && (
                        <button onClick={addEmptyTodo} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors">
                            <Plus size={16}/>
                        </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {editedMinutes.todos.map((todo) => (
                      <div key={todo.id} className={`p-5 bg-white border rounded-2xl flex items-center justify-between gap-4 shadow-sm group hover:border-emerald-200 transition-all ${todo.confirmed === false ? 'border-orange-200 bg-orange-50/20' : 'border-slate-100'} ${todo.completed ? 'opacity-60 bg-slate-50/50' : ''} ${todo.deactivated ? 'opacity-40 grayscale bg-gray-50' : ''}`}>
                        <div className="flex-1 space-y-2">
                          {isEditing ? (
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <input 
                                        className="flex-1 text-sm font-bold bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 focus:border-emerald-400 focus:bg-white outline-none transition-all text-slate-900" 
                                        value={todo.task} 
                                        onChange={(e) => updateTodo(todo.id, { task: e.target.value })} 
                                        placeholder="할 일을 입력하세요"
                                    />
                                    <button 
                                        onClick={() => updateTodo(todo.id, { deactivated: !todo.deactivated })}
                                        className={`p-2 rounded-lg border transition-all ${todo.deactivated ? 'bg-slate-200 border-slate-300 text-slate-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
                                        title={todo.deactivated ? '다시 활성화' : '비활성화'}
                                    >
                                        <EyeOff size={14}/>
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <input 
                                        className="text-[11px] font-bold bg-emerald-50 px-3 py-1.5 rounded-lg flex-1 border border-emerald-100 focus:border-emerald-400 focus:bg-white outline-none text-emerald-800" 
                                        value={todo.assignee} 
                                        onChange={(e) => updateTodo(todo.id, { assignee: e.target.value })} 
                                        placeholder="담당자"
                                    />
                                    <input 
                                        type="date"
                                        className="text-[11px] font-bold bg-slate-50 px-3 py-1.5 rounded-lg flex-1 border border-slate-100 focus:border-blue-400 focus:bg-white outline-none text-slate-500" 
                                        value={normalizeDate(todo.dueDate)} 
                                        onChange={(e) => updateTodo(todo.id, { dueDate: e.target.value })} 
                                    />
                                </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-3">
                                    {todo.deactivated ? (
                                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                                            <EyeOff size={10} className="text-slate-500"/>
                                        </div>
                                    ) : todo.confirmed === false ? (
                                        <div className="w-5 h-5 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center flex-shrink-0">
                                            <AlertCircle size={10} className="text-orange-500"/>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => updateTodo(todo.id, { completed: !todo.completed })}
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${todo.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 hover:border-emerald-400 bg-white'}`}
                                        >
                                            {todo.completed && <Check size={12} strokeWidth={3}/>}
                                        </button>
                                    )}
                                    <span className={`text-sm font-bold text-slate-900 leading-tight ${todo.completed ? 'text-slate-400 line-through' : ''} ${todo.deactivated ? 'text-slate-400 italic line-through' : ''}`}>
                                        {todo.task}
                                    </span>
                                    {todo.deactivated && <span className="text-[9px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">제외됨</span>}
                                    {!todo.deactivated && todo.confirmed === false && <span className="text-[9px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">검토 필요</span>}
                                </div>
                                <div className="flex gap-2 ml-8 pl-0.5">
                                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase">@{todo.assignee}</span>
                                    {todo.dueDate && (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap flex items-center gap-1 ${new Date(normalizeDate(todo.dueDate)) < new Date() && !todo.completed ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'}`}>
                                            <Calendar size={10}/> {todo.dueDate} 마감
                                        </span>
                                    )}
                                </div>
                            </div>
                          )}
                        </div>
                        {isEditing ? (
                            <button onClick={() => deleteTodo(todo.id)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-xl transition-all">
                                <Trash2 size={18}/>
                            </button>
                        ) : (
                            !todo.deactivated && todo.confirmed === false && (
                                <button 
                                    onClick={() => confirmItem('todo', todo.id)}
                                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                    title="작업 확정"
                                >
                                    <Check size={16} />
                                </button>
                            )
                        )}
                      </div>
                    ))}
                  </div>
                </section>
                <section className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarDays size={20} className="text-purple-600"/>
                        <h3 className="text-lg font-bold text-slate-900">주요 일정</h3>
                    </div>
                    {isEditing && (
                        <button onClick={addEmptySchedule} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors">
                            <Plus size={16}/>
                        </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {editedMinutes.schedules.map((s) => (
                      <div key={s.id} className={`p-5 bg-white border rounded-2xl flex items-center justify-between gap-4 shadow-sm hover:border-purple-200 transition-all ${s.confirmed === false ? 'border-orange-200 bg-orange-50/20' : 'border-slate-100'} ${s.deactivated ? 'opacity-40 grayscale bg-gray-50' : ''}`}>
                        <div className="flex-1 space-y-2">
                          {isEditing ? (
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <input 
                                        className="flex-1 text-sm font-bold bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 focus:border-purple-400 focus:bg-white outline-none transition-all text-slate-900" 
                                        value={s.event} 
                                        onChange={(e) => updateSchedule(s.id, { event: e.target.value })} 
                                        placeholder="일정 명칭"
                                    />
                                    <button 
                                        onClick={() => updateSchedule(s.id, { deactivated: !s.deactivated })}
                                        className={`p-2 rounded-lg border transition-all ${s.deactivated ? 'bg-slate-200 border-slate-300 text-slate-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <EyeOff size={14}/>
                                    </button>
                                </div>
                                <input 
                                    type="date"
                                    className="text-[11px] font-bold bg-purple-50 px-4 py-2 rounded-xl border border-purple-100 focus:border-purple-400 focus:bg-white outline-none text-purple-800" 
                                    value={normalizeDate(s.date)} 
                                    onChange={(e) => updateSchedule(s.id, { date: e.target.value })} 
                                />
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-3">
                                    <div className={`w-1.5 h-1.5 rounded-full ${s.deactivated ? 'bg-gray-400' : s.confirmed === false ? 'bg-orange-400' : 'bg-purple-500'}`}></div>
                                    <span className={`text-sm font-bold text-slate-900 leading-tight ${s.deactivated ? 'text-slate-400 italic line-through' : ''}`}>
                                        {s.event}
                                    </span>
                                    {s.deactivated && <span className="text-[9px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">제외됨</span>}
                                    {!s.deactivated && s.confirmed === false && <span className="text-[9px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">검토 필요</span>}
                                </div>
                                <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md w-fit ml-4.5 pl-0.5">{s.date}</span>
                            </div>
                          )}
                        </div>
                        {isEditing ? (
                            <button onClick={() => deleteSchedule(s.id)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-xl transition-all">
                                <Trash2 size={18}/>
                            </button>
                        ) : (
                            !s.deactivated && s.confirmed === false && (
                                <button 
                                    onClick={() => confirmItem('schedule', s.id)}
                                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                    title="일정 확정"
                                >
                                    <Check size={16} />
                                </button>
                            )
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className="space-y-6 max-w-4xl">
              {editedTranscript.map((t, i) => (
                <div key={i} className="flex gap-4 group animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="w-10 h-10 flex-shrink-0 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center font-black text-sm group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors border border-slate-100 uppercase">
                    {t.speaker ? t.speaker[0] : '?'}
                  </div>
                  <div className="flex-1 pb-4 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-black text-sm text-slate-900">{t.speaker}</span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{t.timestamp}</span>
                    </div>
                    <p className="text-slate-700 text-sm sm:text-base leading-relaxed font-medium">{t.text}</p>
                  </div>
                </div>
              ))}
              {editedTranscript.length === 0 && (
                  <div className="py-20 text-center text-slate-300 font-bold italic">녹취록 데이터가 없습니다.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
