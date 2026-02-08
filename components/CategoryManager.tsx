
import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Check, Save, Tag } from 'lucide-react';

interface CategoryManagerProps {
  categories: string[];
  onClose: () => void;
  onAdd: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ 
  categories, onClose, onAdd, onRename, onDelete 
}) => {
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = () => {
    if (newCategory.trim()) {
      onAdd(newCategory.trim());
      setNewCategory('');
    }
  };

  const startEdit = (cat: string) => {
    setEditingCategory(cat);
    setEditValue(cat);
  };

  const saveEdit = () => {
    if (editingCategory && editValue.trim() && editValue !== editingCategory) {
      onRename(editingCategory, editValue.trim());
    }
    setEditingCategory(null);
  };

  const handleDelete = (cat: string) => {
    if (confirm(`'${cat}' 카테고리를 삭제하시겠습니까?\n해당 카테고리의 문서는 '기타'로 이동됩니다.`)) {
      onDelete(cat);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                <Tag size={18} />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">카테고리 관리</h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 border-b border-gray-100 bg-white">
          <div className="flex gap-2">
            <input 
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="새 카테고리 이름..." 
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            />
            <button 
              onClick={handleAdd}
              disabled={!newCategory.trim()}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2 custom-scrollbar bg-white">
          {categories.map((cat) => (
            <div key={cat} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 group transition-all">
              {editingCategory === cat ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <input 
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 px-2 py-1 bg-white border border-blue-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-100"
                    autoFocus
                  />
                  <button onClick={saveEdit} className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"><Check size={14}/></button>
                  <button onClick={() => setEditingCategory(null)} className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"><X size={14}/></button>
                </div>
              ) : (
                <>
                  <span className="flex-1 font-bold text-gray-700 text-sm ml-1">{cat}</span>
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(cat)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={14}/></button>
                    <button onClick={() => handleDelete(cat)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14}/></button>
                  </div>
                </>
              )}
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-center text-gray-300 text-sm py-10 font-medium">등록된 카테고리가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
};
