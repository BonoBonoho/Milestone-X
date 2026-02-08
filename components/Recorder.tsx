
import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Users, User, Settings2, Plus, X, Tag, Info, ArrowRight, Edit2, Calendar, UserCheck, Bookmark, UserPlus, Upload, FileAudio, Clock, PlayCircle, Trash2, StopCircle, Lightbulb, Loader2, AlertCircle } from 'lucide-react';
import { MeetingType, KeywordCorrection } from '../types';
import { CategoryManager } from './CategoryManager';

interface RecorderProps {
  currentUser: string;
  categories: string[];
  onRecordingComplete: (
    audioSegments: { base64?: string; file?: File; mimeType: string; duration?: number }[],
    totalDuration: string, 
    type: MeetingType, 
    keywords: KeywordCorrection[], 
    metadata: { title: string; author: string; date: string; category: string; speakers: string[] }
  ) => void;
  onAddCategory: (name: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  onDeleteCategory: (name: string) => void;
}

interface AudioSegment {
  id: string;
  base64?: string;
  file?: File;
  mime: string;
  duration: number; // 초 단위
  name: string;
  source: 'recording' | 'upload';
  isLarge?: boolean;
}

export const Recorder: React.FC<RecorderProps> = ({ 
  currentUser, categories, onRecordingComplete, onAddCategory, onRenameCategory, onDeleteCategory 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  
  // 멀티 세그먼트 상태 관리
  const [segments, setSegments] = useState<AudioSegment[]>([]);
  const [currentSegmentTimer, setCurrentSegmentTimer] = useState(0);

  const [mode, setMode] = useState<MeetingType>('meeting');
  const [keywords, setKeywords] = useState<KeywordCorrection[]>([
    { original: '마일스톤 엑스', corrected: 'Milestone X' }
  ]);
  const [showKeywordModal, setShowKeywordModal] = useState(false);
  const [newOriginal, setNewOriginal] = useState('');
  const [newCorrected, setNewCorrected] = useState('');
  
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState(currentUser);
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('프로젝트 회의');
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [newSpeaker, setNewSpeaker] = useState('');

  const [visualizerCount, setVisualizerCount] = useState(40);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(40).fill(5));
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingStartRef = useRef<number | null>(null);
  const segmentStartRef = useRef<number | null>(null);
  const segmentIndexRef = useRef<number>(0);

  const SEGMENT_SLICE_MS = 120000;

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const count = width < 640 ? 20 : width < 1024 ? 35 : 50;
      setVisualizerCount(count);
      setAudioLevels(new Array(count).fill(5));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 전체 길이 계산
  const getTotalDuration = () => {
    return segments.reduce((acc, curr) => acc + curr.duration, 0);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 32000 
      };
      
      const finalOptions = MediaRecorder.isTypeSupported(options.mimeType) ? options : undefined;
      const mediaRecorder = new MediaRecorder(stream, finalOptions);
      
      mediaRecorderRef.current = mediaRecorder;
      segmentIndexRef.current = segments.length;
      recordingStartRef.current = Date.now();
      segmentStartRef.current = Date.now();

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const updateVisualizer = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const newLevels = [];
        const step = Math.floor(dataArray.length / visualizerCount);
        for (let i = 0; i < visualizerCount; i++) {
          newLevels.push(Math.max(5, dataArray[i * step] / 3));
        }
        setAudioLevels(newLevels);
        animationFrameRef.current = requestAnimationFrame(updateVisualizer);
      };
      updateVisualizer();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size <= 0) return;
        const now = Date.now();
        const segmentStart = segmentStartRef.current ?? now;
        const durationSec = Math.max(1, Math.round((now - segmentStart) / 1000));
        segmentStartRef.current = now;
        segmentIndexRef.current += 1;

        const segmentFile = new File([event.data], `segment-${segmentIndexRef.current}.webm`, {
          type: mediaRecorder.mimeType
        });

        const newSegment: AudioSegment = {
          id: Math.random().toString(36).substr(2, 9),
          file: segmentFile,
          mime: mediaRecorder.mimeType,
          duration: durationSec,
          name: `녹음 #${segmentIndexRef.current}`,
          source: 'recording',
          isLarge: false
        };
        setSegments(prev => [...prev, newSegment]);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) {
           audioContextRef.current.close();
           audioContextRef.current = null;
        }
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setAudioLevels(new Array(visualizerCount).fill(5));
      };

      mediaRecorder.start(SEGMENT_SLICE_MS);
      setIsRecording(true);
      setCurrentSegmentTimer(0);
      timerIntervalRef.current = window.setInterval(() => {
        if (!recordingStartRef.current) return;
        const elapsed = Math.floor((Date.now() - recordingStartRef.current) / 1000);
        setCurrentSegmentTimer(elapsed);
      }, 1000);
    } catch (err) {
      console.error(err);
      alert("마이크 권한이 필요하거나 오류가 발생했습니다.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      recordingStartRef.current = null;
      segmentStartRef.current = null;
    }
  };

  // Helper to safely extract duration from large files without decoding entire buffer
  const getDurationFromMedia = (file: File): Promise<number> => {
    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const audio = new Audio(objectUrl);
        audio.onloadedmetadata = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(audio.duration);
        };
        audio.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(0); // Failed to get duration
        };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      alert("오디오/비디오 파일만 업로드 가능합니다.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessingFile(true);

    try {
        let mimeType = file.type;
        // MIME Type Normalization
        if (!mimeType || mimeType === '') {
             const ext = file.name.split('.').pop()?.toLowerCase();
             if (ext === 'mp3') mimeType = 'audio/mp3';
             else if (ext === 'wav') mimeType = 'audio/wav';
             else if (ext === 'm4a') mimeType = 'audio/mp4'; 
             else if (ext === 'aac') mimeType = 'audio/aac';
             else mimeType = 'audio/mp3'; 
        }
        if (mimeType === 'audio/x-m4a') mimeType = 'audio/mp4';

        // [Logic] 20MB 분기 처리
        // 20MB 이상: File API 사용 (Base64 변환 X)
        // 20MB 미만: Inline Base64 사용
        const isLargeFile = file.size > 20 * 1024 * 1024;
        let durationInSeconds = 0;
        const base64String: string | undefined = undefined;

        if (isLargeFile) {
            // 대용량 파일: HTMLAudioElement로 메타데이터만 로드 (메모리 절약)
            durationInSeconds = await getDurationFromMedia(file);
            console.log(`Large file detected (${(file.size / 1024 / 1024).toFixed(2)}MB). Using File API.`);
        } else {
            // 소용량 파일: AudioContext로 정확한 디코딩 및 Base64 변환
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            try {
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                durationInSeconds = Math.round(audioBuffer.duration);
            } catch (err) {
                console.warn("Audio decoding warning, using fallback duration:", err);
                durationInSeconds = await getDurationFromMedia(file);
            } finally {
                audioContext.close();
            }

            // Base64 is no longer needed for background processing
        }

        const isVeryLong = durationInSeconds >= 60 * 60;
        const isVeryLarge = file.size >= 200 * 1024 * 1024;
        if (isVeryLong || isVeryLarge) {
            const confirmMsg = '긴 파일은 처리 시간이 길고 브라우저 탭을 계속 열어둬야 합니다. 계속하시겠습니까?';
            if (!confirm(confirmMsg)) {
                setIsProcessingFile(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
        }

        const newSegment: AudioSegment = {
            id: Math.random().toString(36).substr(2, 9),
            base64: base64String, // Large file has undefined base64
            file,
            mime: mimeType,
            duration: Math.round(durationInSeconds) || 0,
            name: file.name,
            source: 'upload',
            isLarge: isLargeFile
        };
        setSegments(prev => [...prev, newSegment]);

    } catch(e) {
        console.error(e);
        alert("파일 처리 중 오류가 발생했습니다.");
    } finally {
        setIsProcessingFile(false);
        if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteSegment = (id: string) => {
    if(confirm('이 구간을 삭제하시겠습니까?')) {
        setSegments(segments.filter(s => s.id !== id));
    }
  };

  const handleProceedToReview = () => {
    if (segments.length === 0) {
      alert("녹음된 내용이 없습니다.");
      return;
    }
    
    const now = new Date();
    const defaultTitle = mode === 'meeting' 
      ? `회의 (${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes()})`
      : `셀프 메모 (${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes()})`;
    
    if(!title) setTitle(defaultTitle);
    if(!date) setDate(now.toISOString().split('T')[0]);
    if(speakers.length === 0) setSpeakers([currentUser]);

    setCategory(mode === 'meeting' ? '프로젝트 회의' : '개인 메모');
    setIsReviewing(true);
  };

  const handleStartAnalysis = () => {
    onRecordingComplete(
      segments.map(s => ({ base64: s.base64, file: s.file, mimeType: s.mime, duration: s.duration })),
      formatTime(getTotalDuration()),
      mode,
      keywords,
      { title, author, date, category, speakers }
    );
  };

  const addKeyword = () => {
    if (newOriginal && newCorrected) {
      setKeywords([...keywords, { original: newOriginal, corrected: newCorrected }]);
      setNewOriginal('');
      setNewCorrected('');
    }
  };

  const removeKeyword = (idx: number) => {
    setKeywords(keywords.filter((_, i) => i !== idx));
  };

  const addSpeaker = () => {
    if (newSpeaker.trim() && !speakers.includes(newSpeaker.trim())) {
      setSpeakers([...speakers, newSpeaker.trim()]);
      setNewSpeaker('');
    }
  };

  const removeSpeaker = (name: string) => {
    setSpeakers(speakers.filter(s => s !== name));
  };

  if (isReviewing) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white rounded-[28px] sm:rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 sm:p-8 border-b border-gray-100 bg-blue-50/30 flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">기록 정보 설정</h2>
              <p className="text-gray-500 text-xs sm:text-sm mt-1">총 {segments.length}개의 오디오 구간이 분석됩니다.</p>
            </div>
            <div className="hidden sm:flex w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-xl md:rounded-2xl items-center justify-center text-white shadow-lg">
              <Info size={22} />
            </div>
          </div>

          <div className="p-5 sm:p-8 space-y-6 md:space-y-8 flex-1 bg-white overflow-y-auto max-h-[70vh] no-scrollbar">
            {/* 오디오 파일 리스트 요약 표시 */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wide">
                    <span>분석 대상 파일</span>
                    <span>총 길이: {formatTime(getTotalDuration())}</span>
                </div>
                <div className="space-y-1">
                    {segments.map((seg, idx) => (
                        <div key={seg.id} className="flex justify-between items-center text-sm bg-white p-2 rounded-lg border border-gray-100">
                            <span className="flex items-center gap-2">
                                <FileAudio size={14} className={seg.isLarge ? "text-orange-500" : "text-blue-500"}/> 
                                {seg.name}
                                {seg.isLarge && <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 rounded ml-2">대용량</span>}
                            </span>
                            <span className="font-mono text-gray-500 text-xs">{formatTime(seg.duration)}</span>
                        </div>
                    ))}
                </div>
                {segments.some(s => s.isLarge) && (
                    <div className="flex items-center gap-2 text-[10px] text-orange-600 bg-orange-50 p-2 rounded-lg">
                        <AlertCircle size={12}/> 대용량 파일(20MB+)이 포함되어 업로드 및 분석에 시간이 더 소요될 수 있습니다.
                    </div>
                )}
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Edit2 size={10} /> 기록 제목
              </label>
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-white border border-gray-200 rounded-xl sm:rounded-2xl text-base sm:text-lg font-bold text-gray-900 focus:ring-4 focus:ring-blue-50 focus:border-blue-400 outline-none transition-all"
                placeholder="제목을 입력하세요"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              <div className="space-y-4 sm:space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <UserCheck size={10} /> 작성자
                  </label>
                  <input 
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={10} /> 작성 일자
                  </label>
                  <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Bookmark size={10} /> 카테고리
                  </label>
                  <div className="flex gap-2">
                      <select 
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-100 outline-none appearance-none"
                      >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => setIsCategoryManagerOpen(true)}
                        className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-gray-600"
                        title="카테고리 편집"
                      >
                          <Settings2 size={18} />
                      </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Users size={10} /> 회의 참석자
                  </label>
                  
                  {/* Speaker Input Guidance */}
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 mb-2 flex items-start gap-2">
                     <Lightbulb size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                     <p className="text-[11px] text-blue-700 font-medium leading-snug">
                       참석자 이름을 모두 입력하면 AI가 목소리 주인을 더 정확하게 찾아냅니다. (예: 김철수, 이영희)
                     </p>
                  </div>

                  <div className="flex gap-2">
                    <input 
                      value={newSpeaker}
                      onChange={(e) => setNewSpeaker(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addSpeaker()}
                      className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-100 outline-none"
                      placeholder="참석자 이름 추가"
                    />
                    <button 
                      onClick={addSpeaker}
                      className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      <UserPlus size={20} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3 min-h-[60px] p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl border border-gray-100">
                    {speakers.length === 0 ? (
                        <p className="text-xs text-gray-400 w-full text-center py-2">등록된 참석자가 없습니다.</p>
                    ) : (
                        speakers.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-2.5 py-1 bg-white border border-blue-100 rounded-lg shadow-sm">
                            <span className="text-[11px] font-bold text-blue-700">{s}</span>
                            <button onClick={() => removeSpeaker(s)} className="text-gray-300 hover:text-red-500">
                            <X size={12} />
                            </button>
                        </div>
                        ))
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">분석 모드</label>
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
                    <button 
                      onClick={() => setMode('meeting')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-bold transition-all ${mode === 'meeting' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                    >
                      <Users size={14} /> 회의
                    </button>
                    <button 
                      onClick={() => setMode('selftalk')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-bold transition-all ${mode === 'selftalk' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-400'}`}
                    >
                      <User size={14} /> 메모
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-sm">
                  <Tag size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">보정 키워드 {keywords.length}개</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">정확한 인식을 위한 전처리 설정이 완료되었습니다.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowKeywordModal(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-white text-blue-600 text-xs font-bold border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors shadow-sm"
              >
                사전 관리
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-8 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button 
              onClick={() => { setIsReviewing(false); }} 
              className="px-6 py-4 bg-white border border-gray-200 text-gray-900 font-bold rounded-2xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 shadow-sm order-2 sm:order-1"
            >
              녹음 계속하기
            </button>
            <button 
              onClick={handleStartAnalysis}
              className="flex-1 px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-lg order-1 sm:order-2"
            >
              분석 시작 <ArrowRight size={20} />
            </button>
          </div>
        </div>

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
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh] md:min-h-[70vh] space-y-6 sm:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="text-center space-y-3 sm:space-y-4 px-4">
        <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
          {isRecording ? '회의를 기록하고 있습니다' : '새로운 기록을 시작하세요'}
        </h2>
        <p className="text-gray-500 text-sm sm:text-base md:text-lg font-medium max-w-lg mx-auto">
          {isRecording ? 'AI가 실시간으로 대화를 분석할 준비를 하고 있습니다.' : '회의 녹음 또는 오디오 파일 업로드를 통해 스마트 분석을 시작합니다.'}
        </p>
      </div>

      {/* Visualizer */}
      <div className="relative flex items-center justify-center w-full max-w-2xl h-24 sm:h-32 px-4">
        <div className="absolute inset-0 flex items-center justify-center gap-1 sm:gap-1.5">
          {audioLevels.map((level, i) => (
            <div 
              key={i} 
              className={`w-0.5 sm:w-1 rounded-full transition-all duration-75 ${isRecording ? 'bg-blue-500' : 'bg-gray-200'}`}
              style={{ height: `${level}%`, opacity: isRecording ? 1 : 0.3 }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 sm:gap-8 w-full">
        {/* 모드 선택 */}
        <div className="flex items-center gap-2 sm:gap-4 bg-white p-1.5 sm:p-2 rounded-2xl sm:rounded-[24px] shadow-sm border border-gray-100">
          <button 
            onClick={() => setMode('meeting')}
            className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl text-[11px] sm:text-sm font-bold transition-all ${mode === 'meeting' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <Users size={16} /> 회의
          </button>
          <button 
            onClick={() => setMode('selftalk')}
            className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl text-[11px] sm:text-sm font-bold transition-all ${mode === 'selftalk' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <User size={16} /> 메모
          </button>
        </div>

        {/* 녹음 버튼 그룹 */}
        <div className="flex items-center gap-6 sm:gap-8">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center transition-all shadow-2xl ${isRecording ? 'bg-red-500 hover:bg-red-600 shadow-red-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'} active:scale-90 relative`}
          >
            {isRecording ? <Square size={32} className="text-white fill-white sm:size-10" /> : <Mic size={40} className="text-white sm:size-12" />}
            
            {/* 녹음 중 인디케이터 */}
            {isRecording && (
                <span className="absolute -top-2 -right-2 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                </span>
            )}
          </button>
          
          {!isRecording && (
            <button 
              onClick={() => { if(!isProcessingFile) fileInputRef.current?.click(); }}
              disabled={isProcessingFile}
              className={`w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors active:scale-90 ${isProcessingFile ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isProcessingFile ? <Loader2 className="animate-spin" size={22} /> : <Upload size={22} className="sm:size-6" />}
            </button>
          )}
        </div>

        {/* 타이머 & 상태 표시 */}
        {isRecording ? (
          <div className="flex items-center gap-3 px-6 py-2.5 sm:py-3 bg-red-50 text-red-600 rounded-full font-mono text-lg sm:text-xl font-bold border border-red-100 animate-pulse">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            {formatTime(currentSegmentTimer)}
          </div>
        ) : (
          segments.length > 0 && (
             <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase">녹음 리스트 (총 {formatTime(getTotalDuration())})</h4>
                    <button 
                        onClick={handleProceedToReview}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        완료 및 분석하기
                    </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {segments.map((seg, idx) => (
                        <div key={seg.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">{idx + 1}</div>
                                <div>
                                    <p className="text-xs font-bold text-gray-900 flex items-center gap-1">
                                        {seg.name}
                                        {seg.isLarge && <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>}
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-mono">{formatTime(seg.duration)}</p>
                                </div>
                            </div>
                            <button onClick={() => deleteSegment(seg.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="mt-3 text-center">
                    <p className="text-[10px] text-gray-400">녹음 버튼을 눌러 이어서 녹음하거나 파일을 추가하세요.</p>
                </div>
             </div>
          )
        )}

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept="audio/*,video/*" 
          className="hidden" 
        />
      </div>

      <div className="pt-6 sm:pt-8 border-t border-gray-100 w-full flex flex-col items-center gap-4">
        <button 
          onClick={() => setShowKeywordModal(true)}
          className="flex items-center gap-2 text-gray-400 hover:text-blue-600 font-bold transition-colors text-xs sm:text-sm"
        >
          <Settings2 size={16} /> 키워드 보정 사전 설정 ({keywords.length})
        </button>
      </div>

      {showKeywordModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[28px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-blue-50/30">
              <div className="flex items-center gap-2">
                <Tag className="text-blue-600" size={18} />
                <h3 className="font-bold text-gray-900 text-base sm:text-lg">키워드 보정 사전</h3>
              </div>
              <button onClick={() => setShowKeywordModal(false)} className="p-2 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            
            <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-6 no-scrollbar">
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">새 키워드 추가</p>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input 
                      placeholder="오인식 단어" 
                      className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100" 
                      value={newOriginal}
                      onChange={(e) => setNewOriginal(e.target.value)}
                    />
                    <input 
                      placeholder="보정 단어" 
                      className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100" 
                      value={newCorrected}
                      onChange={(e) => setNewCorrected(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={addKeyword}
                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Plus size={18} /> 추가하기
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">보정 리스트 ({keywords.length})</p>
                <div className="space-y-2 text-gray-900">
                  {keywords.length === 0 ? (
                    <p className="text-center text-xs text-gray-300 py-8">등록된 키워드가 없습니다.</p>
                  ) : keywords.map((kw, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-xl group">
                      <div className="flex items-center gap-3 text-[11px] sm:text-xs">
                        <span className="text-gray-400 line-through decoration-red-300 decoration-1">{kw.original}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-bold text-blue-700">{kw.corrected}</span>
                      </div>
                      <button onClick={() => removeKeyword(idx)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setShowKeywordModal(false)}
                className="w-full sm:w-auto px-8 py-3 bg-gray-900 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all"
              >
                적용 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
