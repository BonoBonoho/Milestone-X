
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Mic, Settings, History, LogOut, CheckSquare, Download, X, FileText, StickyNote as StickyIcon, Library, RefreshCw, Shield, PanelLeftClose, PanelLeftOpen, CalendarDays } from 'lucide-react';
import { View } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: View;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  isAdmin?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeView, onNavigate, onLogout, isAdmin }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // 메인 사이드바 상태

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);
    if (standalone) setShowInstallBtn(false);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert('크롬 메뉴(⋮)에서 “홈 화면에 추가”를 선택하면 설치할 수 있습니다.');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowInstallBtn(false);
    setDeferredPrompt(null);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 z-40">
        <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm">X</div>
          Milestone X
        </h1>
        <div className="flex items-center gap-2">
          {!isStandalone && (
            <button 
              onClick={handleInstallClick}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-full shadow-lg ${showInstallBtn ? 'bg-blue-600 text-white animate-bounce' : 'bg-white text-blue-600 border border-blue-100'}`}
            >
              <Download size={12} /> {showInstallBtn ? '앱 설치' : '설치 방법'}
            </button>
          )}
          <button onClick={onLogout} className="text-gray-400 p-2 active:bg-gray-100 rounded-full transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Sidebar - Tablet & Desktop */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-white border-r border-gray-200 hidden md:flex flex-col transition-all duration-300 relative overflow-hidden group/sidebar`}>
        <div className="p-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">X</div>
              Milestone X
            </h1>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-900 transition-colors"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Minutes AI</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar pb-10">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeView === 'dashboard' ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="truncate">대시보드</span>
          </button>

          <div className="pt-4 pb-2 px-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Workspace</p>
          </div>
          
          <button
            onClick={() => onNavigate('notes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeView === 'notes' ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <FileText size={20} />
            <span className="truncate">지식 베이스</span>
          </button>
          
          <button
            onClick={() => onNavigate('stickers')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeView === 'stickers' ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <StickyIcon size={20} />
            <span className="truncate">스티커 메모</span>
          </button>

          <div className="pt-4 pb-2 px-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Meeting & Planner</p>
          </div>

          <button
            onClick={() => onNavigate('meetings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeView === 'meetings' ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Library size={20} />
            <span className="truncate">회의록 보관함</span>
          </button>

          <button
             onClick={() => onNavigate('recorder')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeView === 'recorder' ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Mic size={20} />
            <span className="truncate">새 회의 시작</span>
          </button>
          <button
             onClick={() => onNavigate('tasks')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeView === 'tasks' ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <CheckSquare size={20} />
            <span className="truncate">작업</span>
          </button>
          <button
             onClick={() => onNavigate('schedule')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeView === 'schedule' ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <CalendarDays size={20} />
            <span className="truncate">일정</span>
          </button>
          <button
             onClick={() => onNavigate('activity')}
             className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
               activeView === 'activity' ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' : 'text-gray-500 hover:bg-gray-50'
             }`}
          >
            <History size={20} />
            <span className="truncate">최근 활동</span>
          </button>
          
          {isAdmin && (
            <>
                <div className="pt-4 pb-2 px-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Administration</p>
                </div>
                <button
                    onClick={() => onNavigate('admin')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeView === 'admin' ? 'bg-slate-800 text-white font-semibold shadow-lg' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <Shield size={20} />
                    <span className="truncate">슈퍼 관리자</span>
                </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2 flex-shrink-0">
          <button
            onClick={() => onNavigate('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeView === 'settings' ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Settings size={20} />
            <span className="truncate">설정</span>
          </button>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={20} />
            <span className="truncate">로그아웃</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!isSidebarOpen && (
          <div className="hidden md:flex fixed top-4 left-4 z-[60] animate-in fade-in slide-in-from-left-2 duration-300">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-3 bg-white text-gray-400 hover:text-blue-600 border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition-all"
              title="메뉴 열기"
            >
              <PanelLeftOpen size={20} />
            </button>
          </div>
        )}
        
        <main className="flex-1 overflow-y-auto relative pt-16 md:pt-0 pb-20 md:pb-0 scroll-smooth">
          <div className="max-w-[1600px] mx-auto h-full">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 flex justify-around items-center px-2 py-2 z-50 h-18">
         <button 
           onClick={() => onNavigate('dashboard')} 
           className={`flex-1 flex flex-col items-center gap-1 p-2 transition-all active:scale-90 ${activeView === 'dashboard' ? 'text-blue-600' : 'text-gray-400'}`}
         >
           <LayoutDashboard size={20} />
           <span className="text-[8px] font-bold">홈</span>
         </button>

         <button 
           onClick={() => onNavigate('schedule')} 
           className={`flex-1 flex flex-col items-center gap-1 p-2 transition-all active:scale-90 ${activeView === 'schedule' ? 'text-blue-600' : 'text-gray-400'}`}
         >
           <CalendarDays size={20} />
           <span className="text-[8px] font-bold">일정</span>
         </button>

         <div className="flex-1 flex justify-center -mt-10">
           <button 
             onClick={() => onNavigate('recorder')} 
             className="w-14 h-14 bg-blue-600 rounded-full text-white shadow-xl shadow-blue-200 border-4 border-white active:scale-95 transition-transform flex items-center justify-center"
           >
             <Mic size={24} />
           </button>
         </div>
         
         <button 
           onClick={() => onNavigate('tasks')} 
           className={`flex-1 flex flex-col items-center gap-1 p-2 transition-all active:scale-90 ${activeView === 'tasks' ? 'text-blue-600' : 'text-gray-400'}`}
         >
           <CheckSquare size={20} />
           <span className="text-[8px] font-bold">작업</span>
         </button>

         <button
           onClick={() => onNavigate('meetings')} 
           className={`flex-1 flex flex-col items-center gap-1 p-2 transition-all active:scale-90 ${activeView === 'meetings' ? 'text-blue-600' : 'text-gray-400'}`}
         >
           <Library size={20} />
           <span className="text-[8px] font-bold">보관함</span>
         </button>
      </div>

      {/* Global Refresh Button */}
      <button 
        onClick={() => window.location.reload()}
        className="fixed z-50 p-2.5 bg-white/80 backdrop-blur text-gray-400 rounded-full shadow-lg border border-gray-200 hover:bg-white hover:text-blue-600 transition-all bottom-24 right-4 md:bottom-6 md:right-6 active:scale-90"
        title="새로고침"
      >
        <RefreshCw size={18} />
      </button>
    </div>
  );
};
