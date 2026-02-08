
import React, { useState } from 'react';
import { Plus, Trash2, Search, Palette, Grid, List, Sparkles, Share2 } from 'lucide-react';
import { StickyNote } from '../types';

interface StickyNoteViewProps {
  stickers: StickyNote[];
  onSave: (sticker: StickyNote) => void;
  onDelete: (id: string) => void;
}

const COLORS = {
  yellow: 'bg-yellow-100 border-yellow-200 text-yellow-900',
  blue: 'bg-blue-100 border-blue-200 text-blue-900',
  green: 'bg-green-100 border-green-200 text-green-900',
  pink: 'bg-pink-100 border-pink-200 text-pink-900',
  purple: 'bg-purple-100 border-purple-200 text-purple-900'
};

export const StickyNoteView: React.FC<StickyNoteViewProps> = ({ stickers, onSave, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredStickers = stickers.filter(s => 
    s.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addNew = (color: StickyNote['color'] = 'yellow') => {
    const newSticker: StickyNote = {
      id: Math.random().toString(36).substr(2, 9),
      content: '',
      color,
      updatedAt: Date.now()
    };
    onSave(newSticker);
  };

  const handleShare = async (sticker: StickyNote) => {
    const textToShare = `[스티커 메모] ${new Date(sticker.updatedAt).toLocaleDateString()}
${sticker.content || '내용 없음'}

Milestone X에서 공유됨`;

    if (typeof navigator.share !== 'undefined') {
        try {
            await navigator.share({
                title: '스티커 메모 공유',
                text: textToShare
            });
        } catch (err) {
            console.log('공유 취소됨');
        }
    } else {
        navigator.clipboard.writeText(textToShare).then(() => {
            alert('메모 내용이 클립보드에 복사되었습니다.');
        });
    }
  };

  return (
    <div className="p-6 sm:p-10 space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
            <Palette className="text-blue-600" size={32} /> 스티커 메모
          </h2>
          <p className="text-gray-500 text-sm font-medium">아이디어를 빠르게 한 장의 카드로 기록하세요.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              placeholder="메모 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-4 focus:ring-blue-50 outline-none w-full sm:w-64"
            />
          </div>
          <button 
            onClick={() => addNew()}
            className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg hover:bg-blue-700 transition-all active:scale-95"
          >
            <Plus size={24} />
          </button>
        </div>
      </header>

      {/* Color Picker Quick Add */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        {Object.keys(COLORS).map((c) => (
          <button 
            key={c}
            onClick={() => addNew(c as any)}
            className={`w-8 h-8 rounded-full border-2 border-white shadow-sm flex-shrink-0 active:scale-90 transition-transform ${COLORS[c as keyof typeof COLORS].split(' ')[0]}`}
          />
        ))}
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 whitespace-nowrap">컬러별 즉시 추가</span>
      </div>

      {filteredStickers.length === 0 ? (
        <div className="py-24 text-center space-y-4">
          <div className="w-20 h-20 bg-gray-50 text-gray-200 rounded-[32px] flex items-center justify-center mx-auto">
            <Sparkles size={40} />
          </div>
          <p className="text-gray-400 font-bold">작성된 스티커 메모가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredStickers.map(sticker => (
            <div 
              key={sticker.id}
              className={`group relative p-6 rounded-[28px] border-2 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 flex flex-col min-h-[200px] ${COLORS[sticker.color]}`}
            >
              <textarea 
                className="flex-1 bg-transparent border-none outline-none resize-none text-sm font-bold leading-relaxed placeholder:text-black/20"
                placeholder="내용을 입력하세요..."
                value={sticker.content}
                onChange={(e) => onSave({ ...sticker, content: e.target.value, updatedAt: Date.now() })}
              />
              <div className="mt-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-1.5">
                  {Object.keys(COLORS).map((c) => (
                    <button 
                      key={c}
                      onClick={() => onSave({ ...sticker, color: c as any, updatedAt: Date.now() })}
                      className={`w-4 h-4 rounded-full border border-black/5 ${COLORS[c as keyof typeof COLORS].split(' ')[0]}`}
                    />
                  ))}
                </div>
                <div className="flex items-center">
                    <button 
                      onClick={() => handleShare(sticker)}
                      className="p-2 text-black/40 hover:text-blue-600 transition-colors"
                      title="공유하기"
                    >
                      <Share2 size={16} />
                    </button>
                    <button 
                      onClick={() => onDelete(sticker.id)}
                      className="p-2 text-black/40 hover:text-red-600 transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                </div>
              </div>
              <div className="absolute top-4 right-4 text-[9px] font-black opacity-30">
                {new Date(sticker.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
