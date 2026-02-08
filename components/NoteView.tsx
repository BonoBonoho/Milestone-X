
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, Search, Trash2, ChevronRight, FileText, 
  Heading1, Heading2, Heading3, Quote, 
  List, ListOrdered, CheckSquare, ToggleRight, 
  GripVertical, ChevronDown, CalendarDays, Calendar, Clock, ArrowLeft, Type,
  Smile, User, File, Check, Mic, Square, Sparkles, Loader2, StopCircle
} from 'lucide-react';
import { Note, Meeting, BackgroundJobStatus } from '../types';
import { enqueueAudioMeeting } from '../services/geminiService';

interface NoteViewProps {
  notes: Note[];
  userEmail: string;
  onSaveNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onCreateMeeting?: (meeting: Meeting) => void; // New prop for saving to archive
  onJobQueued?: (job: BackgroundJobStatus) => void;
}

// --- Block Types & Parser ---

type BlockType = 'text' | 'h1' | 'h2' | 'h3' | 'bullet' | 'number' | 'todo' | 'quote' | 'toggle' | 'audio-rec';

interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  isOpen?: boolean;
  depth: number;
}

const generateBlockId = () => Math.random().toString(36).substr(2, 9);

const parseMarkdownToBlocks = (text: string): Block[] => {
  if (!text) return [{ id: generateBlockId(), type: 'text', content: '', depth: 0 }];
  
  return text.split('\n').map(line => {
    const id = generateBlockId();
    const indentMatch = line.match(/^(\s*)/);
    const spaces = indentMatch ? indentMatch[1].length : 0;
    const depth = Math.floor(spaces / 2);
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith('# ')) return { id, type: 'h1', content: trimmed.slice(2), depth };
    if (trimmed.startsWith('## ')) return { id, type: 'h2', content: trimmed.slice(3), depth };
    if (trimmed.startsWith('### ')) return { id, type: 'h3', content: trimmed.slice(4), depth };
    
    // Checkboxes (Todo)
    const todoMatch = trimmed.match(/^(-|\*|•)?\s*\[(x| )\]\s*(.*)/i);
    if (todoMatch) {
      return { 
        id, 
        type: 'todo', 
        checked: todoMatch[2].toLowerCase() === 'x', 
        content: todoMatch[3], 
        depth 
      };
    }

    // Bullets
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      return { id, type: 'bullet', content: trimmed.slice(2), depth };
    }

    // Numbers
    if (trimmed.match(/^\d+\.\s/)) return { id, type: 'number', content: trimmed.replace(/^\d+\.\s/, ''), depth };
    
    // Quotes
    if (trimmed.startsWith('> ')) return { id, type: 'quote', content: trimmed.slice(2), depth };
    
    // Toggles
    if (trimmed.startsWith('>>! ')) return { id, type: 'toggle', content: trimmed.slice(4), isOpen: true, depth };
    if (trimmed.startsWith('>> ')) return { id, type: 'toggle', content: trimmed.slice(3), isOpen: false, depth };

    // Audio Recorder Block
    if (trimmed === ':::audio-rec') return { id, type: 'audio-rec', content: '', depth };
    
    return { id, type: 'text', content: trimmed, depth };
  });
};

const serializeBlocksToMarkdown = (blocks: Block[]): string => {
  return blocks.map((b) => {
    const indent = '  '.repeat(b.depth);
    
    let prefix = '';
    switch (b.type) {
      case 'h1': prefix = '# '; break;
      case 'h2': prefix = '## '; break;
      case 'h3': prefix = '### '; break;
      case 'bullet': prefix = '- '; break;
      case 'number': prefix = '1. '; break;
      case 'quote': prefix = '> '; break;
      case 'todo': prefix = `- [${b.checked ? 'x' : ' '}] `; break;
      case 'toggle': prefix = `>>${b.isOpen ? '! ' : ' '}`; break;
      case 'audio-rec': return ':::audio-rec'; // Special case, ignore indent
      default: prefix = ''; break;
    }
    
    return `${indent}${prefix}${b.content}`;
  }).join('\n');
};

const getBlockNumber = (currentIndex: number, blocks: Block[]): number => {
  const currentBlock = blocks[currentIndex];
  let count = 1;
  
  for (let i = currentIndex - 1; i >= 0; i--) {
    const prevBlock = blocks[i];
    if (prevBlock.depth < currentBlock.depth) break;
    if (prevBlock.depth === currentBlock.depth) {
      if (prevBlock.type === 'number') count++; else break;
    }
  }
  return count;
};

// --- Menus ---

const SLASH_ITEMS = [
  { label: '텍스트', type: 'text', icon: <Type size={16}/>, desc: '일반 텍스트' },
  { label: '제목 1', type: 'h1', icon: <Heading1 size={16}/>, desc: '대제목' },
  { label: '제목 2', type: 'h2', icon: <Heading2 size={16}/>, desc: '중제목' },
  { label: '제목 3', type: 'h3', icon: <Heading3 size={16}/>, desc: '소제목' },
  { label: '글머리 기호', type: 'bullet', icon: <List size={16}/>, desc: '리스트' },
  { label: '번호 매기기', type: 'number', icon: <ListOrdered size={16}/>, desc: '순서 리스트' },
  { label: '토글 목록', type: 'toggle', icon: <ToggleRight size={16}/>, desc: '접기/펼치기' },
  { label: '할 일', type: 'todo', icon: <CheckSquare size={16}/>, desc: '체크박스' },
  { label: '인용구', type: 'quote', icon: <Quote size={16}/>, desc: '인용' },
  { label: '음성 회의/녹음', type: 'audio-rec', icon: <Mic size={16}/>, desc: 'AI 회의록 작성' },
];

const getFormattedDate = (offsetDays: number = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${weekDays[d.getDay()]})`;
};

const MEMBER_ITEMS = [
  { label: '김철수', value: '김철수', icon: <User size={16}/>, type: 'member', desc: '팀원' },
  { label: '이영희', value: '이영희', icon: <User size={16}/>, type: 'member', desc: '팀원' },
  { label: '박지민', value: '박지민', icon: <User size={16}/>, type: 'member', desc: '팀원' },
  { label: 'Guest', value: 'Guest', icon: <User size={16}/>, type: 'member', desc: '게스트' },
];

const AT_ITEMS = [
  { label: '오늘', value: getFormattedDate(0), icon: <CalendarDays size={16}/>, type: 'date', desc: getFormattedDate(0) },
  { label: '내일', value: getFormattedDate(1), icon: <Calendar size={16}/>, type: 'date', desc: getFormattedDate(1) },
  { label: '다음 주', value: getFormattedDate(7), icon: <Calendar size={16}/>, type: 'date', desc: getFormattedDate(7) },
  { label: '날짜 선택...', value: 'PICK_DATE', icon: <Clock size={16}/>, type: 'date', desc: '달력 열기' },
  ...MEMBER_ITEMS
];

const EMOJI_LIST = ["📄", "📝", "💡", "✅", "🔥", "🚀", "⭐", "📌", "📁", "📊", "🎨", "📅", "❤️", "🎉", "⚠️", "🏠", "🏢", "✈️", "📚", "💼"];

// --- Inline Recorder Component ---

const InlineRecorder: React.FC<{ 
  userEmail: string;
  onQueued: (payload: { jobId: string; title: string; duration: string; segmentCount: number }) => void;
  onCancel: () => void; 
}> = ({ userEmail, onQueued, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [timer, setTimer] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(30).fill(5));
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const updateVisualizer = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const newLevels = [];
        const step = Math.floor(dataArray.length / 30);
        for (let i = 0; i < 30; i++) {
          newLevels.push(Math.max(5, dataArray[i * step] / 3));
        }
        setAudioLevels(newLevels);
        animationFrameRef.current = requestAnimationFrame(updateVisualizer);
      };
      updateVisualizer();

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.start();
      setIsRecording(true);
      timerIntervalRef.current = window.setInterval(() => setTimer(t => t + 1), 1000);
    } catch (e) {
      console.error(e);
      alert('마이크 권한이 필요합니다.');
    }
  };

  const stopAndAnalyze = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsAnalyzing(true);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        const file = new File([audioBlob], `note-recording-${Date.now()}.webm`, { type: 'audio/webm;codecs=opus' });
        const controller = new AbortController();
        uploadAbortRef.current = controller;
        try {
          const formattedDuration = formatTime(timer);
          const title = `노트 녹음 (${new Date().toLocaleString()})`;
          const res = await enqueueAudioMeeting(
            [{ file, mimeType: 'audio/webm;codecs=opus', duration: timer }],
            formattedDuration,
            'meeting',
            [],
            {
              title,
              author: userEmail,
              date: new Date().toISOString().split('T')[0],
              category: '지식 베이스 녹음',
              speakers: []
            },
            userEmail,
            { signal: controller.signal }
          );
          onQueued({ jobId: res.jobId, title, duration: formattedDuration, segmentCount: res.segmentCount });
        } catch (e) {
          if (controller.signal.aborted) {
            alert('업로드를 취소했습니다.');
          } else {
            alert('업로드 실패: ' + e);
          }
          setIsAnalyzing(false);
        } finally {
          uploadAbortRef.current = null;
        }
      };
    }
  };

  return (
    <div className="my-4 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex flex-col items-center gap-4 select-none animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
        {isAnalyzing ? <Sparkles className="animate-spin" size={16}/> : <Mic size={16}/>}
        {isAnalyzing ? '업로드 중...' : isRecording ? '회의 기록 중...' : '음성 회의 시작'}
      </div>
      
      {isAnalyzing ? (
         <div className="w-full max-w-xs flex flex-col items-center gap-3">
            <div className="w-full bg-white/50 h-1.5 rounded-full overflow-hidden">
               <div className="h-full bg-blue-500 animate-progress-indeterminate"></div>
            </div>
            <button
              onClick={() => {
                uploadAbortRef.current?.abort();
              }}
              className="px-4 py-2 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
            >
              업로드 취소
            </button>
         </div>
      ) : (
        <>
            <div className="h-12 flex items-center justify-center gap-1">
                {audioLevels.map((h, i) => (
                <div key={i} className={`w-1 rounded-full transition-all duration-75 ${isRecording ? 'bg-blue-500' : 'bg-gray-300'}`} style={{ height: `${h}px` }} />
                ))}
            </div>
            
            <div className="text-2xl font-mono font-bold text-gray-700">{formatTime(timer)}</div>

            <div className="flex gap-4">
                {!isRecording ? (
                <button onClick={startRecording} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2">
                    <Mic size={18}/> 녹음 시작
                </button>
                ) : (
                <button onClick={stopAndAnalyze} className="px-6 py-2 bg-red-500 text-white font-bold rounded-xl shadow-lg hover:bg-red-600 transition-all active:scale-95 flex items-center gap-2 animate-pulse">
                    <StopCircle size={18}/> 중지 및 분석
                </button>
                )}
                {!isRecording && <button onClick={onCancel} className="px-4 py-2 text-gray-400 hover:text-gray-600 font-bold transition-colors">취소</button>}
            </div>
        </>
      )}
    </div>
  );
};

export const NoteView: React.FC<NoteViewProps> = ({ notes, userEmail, onSaveNote, onDeleteNote, onCreateMeeting, onJobQueued }) => {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileList, setIsMobileList] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('bmove_sidebar_expanded');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem('bmove_sidebar_expanded', JSON.stringify(Array.from(expandedIds)));
  }, [expandedIds]);
  
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  
  const [slashMenu, setSlashMenu] = useState<{
    isOpen: boolean; blockId: string | null; filter: string; selectedIndex: number; position: { top: number; left: number };
  }>({ isOpen: false, blockId: null, filter: '', selectedIndex: 0, position: { top: 0, left: 0 } });

  const [atMenu, setAtMenu] = useState<{
    isOpen: boolean; blockId: string | null; filter: string; selectedIndex: number; position: { top: number; left: number };
  }>({ isOpen: false, blockId: null, filter: '', selectedIndex: 0, position: { top: 0, left: 0 } });

  const blockRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
  const dateInputRef = useRef<HTMLInputElement>(null);
  const blocksRef = useRef(blocks);

  const activeNote = notes.find(n => n.id === selectedNoteId);
  const rootNotes = notes.filter(n => !n.parentId);
  const childNotes = activeNote ? notes.filter(n => n.parentId === activeNote.id) : [];

  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  // [Fix] Note Synchronization Logic
  const prevNoteIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeNote) {
      if (activeNote.id !== prevNoteIdRef.current) {
         setBlocks(parseMarkdownToBlocks(activeNote.content));
         prevNoteIdRef.current = activeNote.id;
      }
    } else {
        prevNoteIdRef.current = null;
    }
  }, [activeNote?.id]);

  useEffect(() => {
    if (!selectedNoteId && notes.length > 0) {
      const roots = notes.filter(n => !n.parentId);
      setSelectedNoteId(roots.length > 0 ? roots[0].id : notes[0].id);
    }
  }, [notes, selectedNoteId]);

  useEffect(() => {
    blocks.forEach(block => {
      const el = blockRefs.current[block.id];
      if (el) {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      }
    });
  }, [blocks, activeBlockId]);

  const hiddenBlockIds = useMemo(() => {
    const hiddenIds = new Set<string>();
    let hideUntilDepth: number | null = null;
    for (const block of blocks) {
      if (hideUntilDepth !== null) {
        if (block.depth > hideUntilDepth) hiddenIds.add(block.id); else hideUntilDepth = null;
      }
      if (hideUntilDepth === null && block.type === 'toggle' && !block.isOpen) hideUntilDepth = block.depth;
    }
    return hiddenIds;
  }, [blocks]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveBlocks = (newBlocks: Block[]) => {
    setBlocks(newBlocks);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (activeNote) {
        const markdown = serializeBlocksToMarkdown(newBlocks);
        if (markdown !== activeNote.content) {
          onSaveNote({ ...activeNote, content: markdown, updatedAt: Date.now() });
        }
      }
    }, 500);
  };

  const handleCreateNote = (parentId?: string) => {
    const newNote: Note = { id: Math.random().toString(36).substr(2, 9), title: '', content: '', icon: '📄', updatedAt: Date.now(), parentId };
    onSaveNote(newNote);
    if (!parentId) { setSelectedNoteId(newNote.id); setIsMobileList(false); }
    if (parentId) setExpandedIds(prev => new Set(prev).add(parentId));
  };

  const updateBlock = (id: string, updates: Partial<Block>) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, ...updates } : b);
    saveBlocks(newBlocks);
  };

  const handleBlockChange = (id: string, content: string) => {
    updateBlock(id, { content });
    
    if (content.startsWith('/')) {
      const el = blockRefs.current[id];
      if (el) {
        const rect = el.getBoundingClientRect();
        setSlashMenu({ isOpen: true, blockId: id, filter: content.substring(1), selectedIndex: 0, position: { top: rect.bottom + 5, left: rect.left } });
        setAtMenu(p => ({ ...p, isOpen: false }));
        return;
      }
    } else {
      setSlashMenu(p => ({ ...p, isOpen: false }));
    }

    const cursor = (blockRefs.current[id]?.selectionStart || 0);
    const textBefore = content.substring(0, cursor);
    const atMatch = textBefore.match(/(?:^|\s)@([^ ]*)$/);
    if (atMatch && atMatch.index !== undefined) {
      const el = blockRefs.current[id];
      if (el) {
        const rect = el.getBoundingClientRect();
        const charWidth = 8;
        const matchIndex = atMatch.index + (atMatch[0].startsWith(' ') ? 1 : 0);
        const leftOffset = Math.min(rect.width - 200, matchIndex * charWidth);
        setAtMenu({ isOpen: true, blockId: id, filter: atMatch[1], selectedIndex: 0, position: { top: rect.bottom + 5, left: rect.left + leftOffset } });
        setSlashMenu(p => ({ ...p, isOpen: false }));
      }
    } else {
      setAtMenu(p => ({ ...p, isOpen: false }));
    }
  };

  const handleMeetingQueued = (blockId: string, payload: { jobId: string; title: string; duration: string; segmentCount: number }) => {
    const index = blocks.findIndex(b => b.id === blockId);
    if (index === -1) return;

    const newBlocks = [...blocks];
    // Remove the audio-rec block
    newBlocks.splice(index, 1);
    
    const insert = (type: BlockType, content: string, extra: any = {}) => {
        newBlocks.splice(index + newBlocks.length - blocks.length, 0, { 
            id: generateUUID(), type, content, depth: 0, ...extra 
        });
    };
    
    const generateUUID = () => Math.random().toString(36).substr(2, 9);

    insert('h1', '🎙️ 녹음 업로드 완료');
    insert('quote', '분석은 백그라운드에서 진행됩니다. 완료 후 회의 목록에서 확인하세요.');
    insert('bullet', `작업 ID: ${payload.jobId}`);
    insert('bullet', `제목: ${payload.title}`);
    insert('bullet', `길이: ${payload.duration}`);

    saveBlocks(newBlocks);

    if (onJobQueued) {
      onJobQueued({
        jobId: payload.jobId,
        title: payload.title,
        status: 'queued',
        createdAt: Date.now(),
        totalSegments: payload.segmentCount,
        completedSegments: 0,
        noteId: activeNote?.id
      });
    }
  };

  const applySlashItem = (type: string) => {
    if (slashMenu.blockId) {
      const extra = type === 'toggle' ? { isOpen: true } : {};
      updateBlock(slashMenu.blockId, { type: type as BlockType, content: '', ...extra });
      setSlashMenu(p => ({ ...p, isOpen: false }));
      // Focus handled later or no focus needed for recorder
      if (type !== 'audio-rec') {
         setTimeout(() => blockRefs.current[slashMenu.blockId!]?.focus(), 0);
      }
    }
  };

  const applyAtItem = (value: string) => {
    if (value === 'PICK_DATE') {
      try { dateInputRef.current?.showPicker(); } catch { dateInputRef.current?.click(); }
      return;
    }
    
    const id = atMenu.blockId;
    if (!id) return;
    const block = blocks.find(b => b.id === id);
    if (block) {
      const el = blockRefs.current[id];
      const cursor = el?.selectionStart || 0;
      const textBefore = block.content.substring(0, cursor);
      const match = textBefore.match(/(?:^|\s)@([^ ]*)$/);
      if (match && match.index !== undefined) {
        const idx = match.index + (match[0].startsWith(' ') ? 1 : 0);
        const tag = `@[${value}] `;
        const newContent = block.content.substring(0, idx) + tag + block.content.substring(cursor);
        updateBlock(id, { content: newContent });
        
        setTimeout(() => {
          const updatedEl = blockRefs.current[id];
          if (updatedEl) {
            updatedEl.focus();
            const newPos = idx + tag.length;
            updatedEl.setSelectionRange(newPos, newPos);
          }
        }, 10);
      }
    }
    setAtMenu(p => ({ ...p, isOpen: false }));
  };

  const handleDatePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    if (date) {
      const [y, m, d] = date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
      // [Fix] Change d.getDay() to dateObj.getDay() to resolve compilation error
      applyAtItem(`${y}년 ${m}월 ${d}일(${weekDays[dateObj.getDay()]})`);
    }
    e.target.value = '';
  };

  const findVisibleIndex = (curr: number, dir: 'prev' | 'next'): number | null => {
    let next = curr + (dir === 'next' ? 1 : -1);
    while (next >= 0 && next < blocks.length) {
      if (!hiddenBlockIds.has(blocks[next].id)) return next;
      next += (dir === 'next' ? 1 : -1);
    }
    return null;
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string, index: number) => {
    if (e.nativeEvent.isComposing) return;
    const block = blocks[index];
    if (!block) return;

    if (slashMenu.isOpen || atMenu.isOpen) {
      const isSlash = slashMenu.isOpen;
      const items = isSlash ? 
        SLASH_ITEMS.filter(i => i.label.includes(slashMenu.filter) || i.type.includes(slashMenu.filter)) : 
        AT_ITEMS.filter(i => i.label.includes(atMenu.filter));
      const setMenu = isSlash ? setSlashMenu : setAtMenu;
      const menuState = isSlash ? slashMenu : atMenu;

      if (e.key === 'ArrowUp') { e.preventDefault(); setMenu(p => ({ ...p, selectedIndex: Math.max(0, p.selectedIndex - 1) })); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenu(p => ({ ...p, selectedIndex: Math.min(items.length - 1, p.selectedIndex + 1) })); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (items[menuState.selectedIndex]) {
           if (isSlash) applySlashItem((items[menuState.selectedIndex] as any).type);
           else applyAtItem((items[menuState.selectedIndex] as any).value);
        }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setMenu(p => ({ ...p, isOpen: false })); return; }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Audio Block cannot be split by Enter
      if (block.type === 'audio-rec') {
          const newBlock: Block = { id: generateBlockId(), type: 'text', content: '', depth: 0 };
          const newBlocks = [...blocks];
          newBlocks.splice(index + 1, 0, newBlock);
          saveBlocks(newBlocks);
          setTimeout(() => blockRefs.current[newBlock.id]?.focus(), 0);
          return;
      }

      if (block.content === '' && block.type !== 'text') { updateBlock(id, { type: 'text' }); return; }
      const newBlock: Block = { id: generateBlockId(), type: 'text', content: '', checked: false, depth: block.depth };
      const el = e.target as HTMLTextAreaElement;
      const before = block.content.slice(0, el.selectionStart);
      const after = block.content.slice(el.selectionStart);
      const newBlocks = [...blocks];
      newBlocks[index] = { ...block, content: before };
      newBlock.content = after;
      if (['bullet', 'number', 'todo', 'toggle'].includes(block.type)) {
        newBlock.type = block.type;
        if (newBlock.type === 'toggle') newBlock.isOpen = true;
      }
      newBlocks.splice(index + 1, 0, newBlock);
      saveBlocks(newBlocks);
      setTimeout(() => { blockRefs.current[newBlock.id]?.focus(); blockRefs.current[newBlock.id]?.setSelectionRange(0, 0); }, 0);
    }

    if (e.key === 'Backspace') {
      const el = e.target as HTMLTextAreaElement;
      // Audio block deletion
      if (block.type === 'audio-rec') {
          // If backspace on audio block, verify deletion
           if(confirm('녹음기 블록을 삭제하시겠습니까?')) {
               const newBlocks = [...blocks];
               newBlocks.splice(index, 1);
               saveBlocks(newBlocks);
           }
           return;
      }

      if (el.selectionStart === 0) {
        if (block.type !== 'text') { e.preventDefault(); updateBlock(id, { type: 'text' }); return; }
        if (block.depth > 0) { e.preventDefault(); updateBlock(id, { depth: block.depth - 1 }); return; }
        if (index > 0) {
          e.preventDefault();
          const prevIdx = findVisibleIndex(index, 'prev');
          if (prevIdx === null) return;
          const prevBlock = blocks[prevIdx];
          
          // Cannot merge into audio block
          if (prevBlock.type === 'audio-rec') {
             blockRefs.current[prevBlock.id]?.focus(); // Actually audio block isn't focusable text area
             return; 
          }

          const cursor = prevBlock.content.length;
          const newBlocks = [...blocks];
          newBlocks[prevIdx] = { ...prevBlock, content: prevBlock.content + block.content };
          newBlocks.splice(index, 1);
          saveBlocks(newBlocks);
          setTimeout(() => { const el = blockRefs.current[prevBlock.id]; if(el) { el.focus(); el.setSelectionRange(cursor, cursor); } }, 0);
        }
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const dir = e.shiftKey ? -1 : 1;
      updateBlock(id, { depth: Math.max(0, Math.min(8, block.depth + dir)) });
    }

    if (e.key === 'ArrowUp') {
      const prev = findVisibleIndex(index, 'prev');
      if (prev !== null) { 
          e.preventDefault(); 
          // If prev is audio, just skip focus (or handle selection visually later)
          if(blocks[prev].type !== 'audio-rec') blockRefs.current[blocks[prev].id]?.focus(); 
      }
    }
    if (e.key === 'ArrowDown') {
      const next = findVisibleIndex(index, 'next');
      if (next !== null) { 
          e.preventDefault(); 
          if(blocks[next].type !== 'audio-rec') blockRefs.current[blocks[next].id]?.focus(); 
      }
    }

    if (e.key === ' ' && (e.target as HTMLTextAreaElement).selectionStart === block.content.length) {
      const t = block.content;
      let type: BlockType | null = null;
      let extra = {};
      if (t === '-' || t === '*') type = 'bullet';
      if (t === '1.') type = 'number';
      if (t === '[]') type = 'todo';
      if (t === '>>') { type = 'toggle'; extra = { isOpen: true }; }
      if (t === '#') type = 'h1';
      if (t === '##') type = 'h2';
      if (t === '###') type = 'h3';
      if (t === '>') type = 'quote';
      if (type) { e.preventDefault(); updateBlock(id, { type, content: '', ...extra }); }
    }
  };

  const renderBlockContent = (content: string) => {
    const parts = content.split(/(@\[[^\]]+\])/g);
    return parts.map((part, index) => {
      if (part.startsWith('@[') && part.endsWith(']')) {
        const value = part.slice(2, -1);
        return (
          <span key={index} className="inline-flex items-center px-1.5 py-0.5 rounded mx-0.5 bg-blue-100 text-blue-700 font-bold text-[0.9em] select-none align-baseline">
            @{value}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const renderSidebarItem = (note: Note, depth: number) => {
    const children = notes.filter(n => n.parentId === note.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(note.id);
    const isSelected = selectedNoteId === note.id;

    return (
      <div key={note.id}>
        <div
          onClick={() => { setSelectedNoteId(note.id); setIsMobileList(false); }}
          className={`group flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all mb-0.5 cursor-pointer ${isSelected ? 'bg-white shadow-sm border border-gray-100 text-blue-600' : 'text-gray-500 hover:bg-white/50'}`}
          style={{ paddingLeft: `${12 + depth * 12}px` }}
        >
          <div 
             className={`flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 text-gray-400 ${hasChildren ? 'visible' : 'invisible'}`}
             onClick={(e) => { e.stopPropagation(); setExpandedIds(p => { const n = new Set(p); if(n.has(note.id)) n.delete(note.id); else n.add(note.id); return n; }); }}
          >
             {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
          </div>
          <span className="text-base flex-shrink-0">{note.icon || '📄'}</span>
          <span className="flex-1 text-xs font-bold truncate select-none">{note.title || '제목 없음'}</span>
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
             <div onClick={(e) => { e.stopPropagation(); handleCreateNote(note.id); }} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-blue-500"><Plus size={10}/></div>
             <div onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-red-500"><Trash2 size={10}/></div>
          </div>
        </div>
        {hasChildren && isExpanded && children.map(child => renderSidebarItem(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-screen bg-white overflow-hidden relative text-gray-900">
      <div className={`${isMobileList ? 'flex' : 'hidden'} md:flex w-full md:w-72 bg-gray-50 border-r border-gray-100 flex-col`}>
        <div className="p-4 space-y-4">
          <div className="flex justify-between items-center">
             <h2 className="font-black text-gray-900 text-lg flex items-center gap-2"><FileText className="text-blue-600" size={18}/> 지식 베이스</h2>
             <button onClick={() => handleCreateNote()} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"><Plus size={18}/></button>
          </div>
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
             <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="검색..." className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-100 outline-none text-gray-900" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-10 space-y-0.5 custom-scrollbar">
           {rootNotes.map(note => renderSidebarItem(note, 0))}
           {rootNotes.length === 0 && <div className="py-20 text-center text-xs text-gray-300 font-bold">페이지가 없습니다.</div>}
        </div>
      </div>

      <div className={`${!isMobileList ? 'flex' : 'hidden'} md:flex flex-1 flex-col bg-white overflow-hidden relative`}>
        {activeNote ? (
          <>
             {slashMenu.isOpen && (
                <div className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-100 w-48 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-100" style={{top: slashMenu.position.top, left: slashMenu.position.left}}>
                  {SLASH_ITEMS.filter(i => i.label.includes(slashMenu.filter) || (i.type === 'audio-rec' && '음성'.includes(slashMenu.filter))).map((item, idx) => (
                    <button key={item.type} onClick={() => applySlashItem(item.type)} className={`w-full flex items-center gap-3 px-3 py-2 text-left text-xs font-bold ${idx === slashMenu.selectedIndex ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}>
                      <div className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center bg-white">{item.icon}</div>
                      {item.label}
                    </button>
                  ))}
                </div>
             )}
             {atMenu.isOpen && (
                <div className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-100 w-56 animate-in fade-in zoom-in-95 duration-100" style={{top: atMenu.position.top, left: atMenu.position.left}}>
                   <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
                     {AT_ITEMS.map((item, idx) => (
                        <button key={item.label} onClick={() => applyAtItem(item.value)} className={`w-full flex items-center gap-3 px-3 py-2 text-left text-xs font-bold rounded-lg ${idx === atMenu.selectedIndex ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}>
                           <div className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center bg-white flex-shrink-0">{item.icon}</div>
                           <div className="flex flex-col flex-1 min-w-0">
                               <span>{item.label}</span>
                               <span className="text-[10px] text-gray-400 truncate">{item.desc}</span>
                           </div>
                        </button>
                     ))}
                   </div>
                   <input type="date" ref={dateInputRef} className="hidden" onChange={handleDatePick} />
                </div>
             )}

             <div className="flex-1 overflow-y-auto px-8 pt-16 pb-20 sm:px-12 sm:pt-24 sm:pb-32 custom-scrollbar">
                <div className="max-w-3xl mx-auto pb-32">
                  <div className="group flex items-center gap-3 mb-2 -ml-2">
                      <div className="relative">
                          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-gray-100 rounded-lg transition-colors">{activeNote.icon}</button>
                          {showEmojiPicker && (
                              <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-64 animate-in fade-in zoom-in-95 duration-150">
                                  <div className="grid grid-cols-6 gap-2">
                                      {EMOJI_LIST.map(emoji => (
                                          <button key={emoji} onClick={() => { onSaveNote({ ...activeNote, icon: emoji }); setShowEmojiPicker(false); }} className="text-xl p-1.5 hover:bg-gray-100 rounded-lg transition-colors">{emoji}</button>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>
                      <input 
                        value={activeNote.title}
                        onChange={(e) => onSaveNote({ ...activeNote, title: e.target.value, updatedAt: Date.now() })}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if(blocks.length > 0) blockRefs.current[blocks[0].id]?.focus(); } }}
                        placeholder="제목 없음"
                        className="flex-1 text-4xl font-black text-gray-900 placeholder:text-gray-300 border-none outline-none bg-transparent leading-tight"
                      />
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 mb-6 ml-1">
                      {childNotes.map(child => (
                          <div key={child.id} onClick={() => setSelectedNoteId(child.id)} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-lg cursor-pointer transition-colors text-sm text-gray-600">
                             <span>{child.icon}</span>
                             <span className="font-bold border-b border-transparent hover:border-gray-400">{child.title || '제목 없음'}</span>
                          </div>
                      ))}
                      <button onClick={() => handleCreateNote(activeNote.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"><Plus size={14} /> 하위 페이지 추가</button>
                  </div>

                  <div className="space-y-1">
                     {blocks.map((block, index) => {
                       if (hiddenBlockIds.has(block.id)) return null;
                       const isFocused = activeBlockId === block.id;
                       
                       const typographyClasses = `
                          font-sans antialiased tracking-tight
                          ${block.type === 'h1' ? 'text-3xl font-bold mt-6 mb-2 leading-[1.2]' : ''}
                          ${block.type === 'h2' ? 'text-2xl font-bold mt-4 mb-2 leading-[1.3]' : ''}
                          ${block.type === 'h3' ? 'text-xl font-bold mt-2 mb-1 leading-[1.4]' : ''}
                          ${block.type === 'quote' ? 'text-lg italic text-gray-600 leading-relaxed' : ''}
                          ${['text', 'bullet', 'number', 'todo', 'toggle'].includes(block.type) ? 'text-base leading-relaxed py-0.5' : ''}
                          ${block.type === 'todo' && block.checked ? 'text-gray-400' : 'text-gray-900'}
                       `;

                       if (block.type === 'audio-rec') {
                         return (
                            <div key={block.id} className="group flex items-start gap-2 relative min-h-[1.5rem]" style={{ paddingLeft: `${block.depth * 24}px` }}>
                                <div className="flex-1">
                                    <InlineRecorder 
                                        userEmail={userEmail}
                                        onQueued={(payload) => handleMeetingQueued(block.id, payload)}
                                        onCancel={() => {
                                            const newBlocks = [...blocks];
                                            newBlocks.splice(index, 1, { id: generateBlockId(), type: 'text', content: '', depth: block.depth });
                                            saveBlocks(newBlocks);
                                        }}
                                    />
                                </div>
                            </div>
                         );
                       }

                       return (
                         <div key={block.id} className="group flex items-start gap-2 relative min-h-[1.5rem]" style={{ paddingLeft: `${block.depth * 24}px` }}>
                            <div className="absolute -left-6 top-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-grab text-gray-300 hover:text-gray-500"><GripVertical size={14}/></div>
                            <div className="flex-1 flex items-start gap-2 relative">
                               {block.type === 'bullet' && <div className="mt-2.5 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0"/>}
                               {block.type === 'number' && <div className="mt-1 min-w-[1.2rem] text-right font-bold text-gray-500 text-sm select-none">{getBlockNumber(index, blocks)}.</div>}
                               {block.type === 'todo' && (
                                  <div className={`mt-1.5 w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-all ${block.checked ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 hover:border-gray-400'}`} onClick={() => updateBlock(block.id, { checked: !block.checked })}>
                                     {block.checked && <Check size={12} strokeWidth={4}/>}
                                  </div>
                               )}
                               {block.type === 'toggle' && (
                                  <div className="mt-1 w-5 h-5 flex items-center justify-center cursor-pointer text-gray-400 hover:bg-gray-100 rounded" onClick={() => updateBlock(block.id, { isOpen: !block.isOpen })}>
                                     {block.isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                  </div>
                               )}
                               {block.type === 'quote' && <div className="mt-0.5 w-1 self-stretch bg-gray-900 rounded-full mr-2"/>}
                               
                               <div className="relative flex-1">
                                   <textarea
                                    // [Fix] Return void instead of the assigned element to resolve compilation error
                                    ref={el => { blockRefs.current[block.id] = el; }}
                                    value={block.content}
                                    onChange={(e) => { handleBlockChange(block.id, e.target.value); }}
                                    onKeyDown={(e) => handleKeyDown(e, block.id, index)}
                                    onFocus={() => setActiveBlockId(block.id)}
                                    placeholder={!isFocused ? '' : (block.type === 'h1' ? '제목 1' : block.type === 'h2' ? '제목 2' : block.type === 'h3' ? '제목 3' : block.type === 'text' ? "명령어는 '/' 입력" : '내용 입력')}
                                    className={`
                                        w-full bg-transparent border-none outline-none resize-none overflow-hidden block
                                        ${typographyClasses}
                                        ${block.type === 'todo' && block.checked ? 'line-through' : ''}
                                        caret-blue-600
                                    `}
                                    rows={1}
                                    spellCheck={false}
                                    />
                               </div>
                            </div>
                         </div>
                       );
                     })}
                     <div className="h-32 cursor-text" onClick={() => { if (blocks.length > 0) { setActiveBlockId(blocks[blocks.length-1].id); setTimeout(() => blockRefs.current[blocks[blocks.length-1].id]?.focus(), 0); } }} />
                  </div>
                </div>
             </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
             <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6"><FileText size={48} className="opacity-20"/></div>
             <p className="font-bold">페이지를 선택하거나 새로 만드세요.</p>
          </div>
        )}
        {!isMobileList && <button className="md:hidden absolute top-4 left-4 p-2 bg-white/80 backdrop-blur border border-gray-200 rounded-lg text-gray-600 z-10" onClick={() => setIsMobileList(true)}><ArrowLeft size={20}/></button>}
      </div>
    </div>
  );
};
