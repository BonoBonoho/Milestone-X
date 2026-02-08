
import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Shield, Trash2, Cpu, UploadCloud, FileSearch, AlertTriangle, CheckCircle2, Copy, Database, ChevronDown, ChevronUp, RefreshCcw, Link2 } from 'lucide-react';
import { getCloudConfig, cloudData, checkSystemHealth, updateCloudConfig } from '../services/cloudService';

interface SettingsProps {
  userEmail: string;
  onLogout: () => void;
  // [Fix] Add message property to the return type of onMigrateToCloud to resolve compilation error
  onMigrateToCloud?: () => Promise<{success: boolean, count: number, message?: string}>;
}

const REPAIR_SQL = `create table if not exists public.meetings (
  id text primary key,
  user_email text not null,
  content jsonb,
  created_at timestamptz default now()
);

create index if not exists meetings_user_email_idx on public.meetings(user_email);

create table if not exists public.notes (
  id text primary key,
  user_email text not null,
  content jsonb,
  updated_at timestamptz default now()
);

create index if not exists notes_user_email_idx on public.notes(user_email);

create table if not exists public.stickers (
  id text primary key,
  user_email text not null,
  content jsonb,
  updated_at timestamptz default now()
);

create index if not exists stickers_user_email_idx on public.stickers(user_email);

alter table public.meetings enable row level security;
alter table public.notes enable row level security;
alter table public.stickers enable row level security;

create policy "meetings_select_own" on public.meetings
  for select using (auth.jwt() ->> 'email' = user_email);
create policy "meetings_insert_own" on public.meetings
  for insert with check (auth.jwt() ->> 'email' = user_email);
create policy "meetings_update_own" on public.meetings
  for update using (auth.jwt() ->> 'email' = user_email) with check (auth.jwt() ->> 'email' = user_email);
create policy "meetings_delete_own" on public.meetings
  for delete using (auth.jwt() ->> 'email' = user_email);

create policy "notes_select_own" on public.notes
  for select using (auth.jwt() ->> 'email' = user_email);
create policy "notes_insert_own" on public.notes
  for insert with check (auth.jwt() ->> 'email' = user_email);
create policy "notes_update_own" on public.notes
  for update using (auth.jwt() ->> 'email' = user_email) with check (auth.jwt() ->> 'email' = user_email);
create policy "notes_delete_own" on public.notes
  for delete using (auth.jwt() ->> 'email' = user_email);

create policy "stickers_select_own" on public.stickers
  for select using (auth.jwt() ->> 'email' = user_email);
create policy "stickers_insert_own" on public.stickers
  for insert with check (auth.jwt() ->> 'email' = user_email);
create policy "stickers_update_own" on public.stickers
  for update using (auth.jwt() ->> 'email' = user_email) with check (auth.jwt() ->> 'email' = user_email);
create policy "stickers_delete_own" on public.stickers
  for delete using (auth.jwt() ->> 'email' = user_email);`;

export const Settings: React.FC<SettingsProps> = ({ userEmail, onLogout, onMigrateToCloud }) => {
  const [isCloudActive, setIsCloudActive] = useState(false);
  const [localDataCount, setLocalDataCount] = useState(0);
  const [demoDataCount, setDemoDataCount] = useState(0);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const runHealthCheck = async () => {
    setIsChecking(true);
    const status = await checkSystemHealth();
    setHealthStatus(status);
    setTimeout(() => setIsChecking(false), 500);
  };

  useEffect(() => {
    const config = getCloudConfig();
    const connected = !!config;
    setIsCloudActive(connected);

    try {
        const dbStr = localStorage.getItem('bmove_local_db');
        const db = dbStr ? JSON.parse(dbStr) : { meetings: {} };
        setLocalDataCount((db.meetings?.[userEmail.toLowerCase()] || []).length);
        setDemoDataCount((db.meetings?.['guest@milestone.x'] || []).length);
    } catch { }

    runHealthCheck();
  }, [userEmail]);

  const handleManualMigrate = async () => {
    if (!onMigrateToCloud) return;
    const confirmMsg = `현재 기기에 저장된 ${localDataCount}개의 회의 기록을 클라우드로 통합하시겠습니까?`;
    if (confirm(confirmMsg)) {
        const res = await onMigrateToCloud();
        if(res.success) {
            alert('데이터 통합이 완료되었습니다.');
            window.location.reload();
        } else {
            // [Fix] res.message now exists thanks to the interface update
            alert('오류 발생: ' + (res.message || '알 수 없는 오류'));
        }
    }
  };

  const handleImportDemo = async () => {
     if(confirm(`체험하기 모드에서 생성된 ${demoDataCount}개의 데이터를 현재 계정으로 가져오시겠습니까?`)) {
         const res = await cloudData.importLocalDemoData(userEmail);
         if(res.success) {
             alert('데이터 가져오기 완료!');
             window.location.reload();
         } else {
             alert('오류 발생: ' + (res as any).message);
         }
     }
  };

  const copySQL = () => {
    navigator.clipboard.writeText(REPAIR_SQL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sections = [
    {
      title: "계정 및 클라우드",
      icon: <User className="text-blue-500" size={20} />,
      items: [
        { label: "로그인 계정", value: userEmail, action: "정보" },
        { 
          label: "데이터 서버 연결", 
          value: isCloudActive ? "Supabase (Secure)" : "Local Mode", 
          action: "상태" 
        }
      ]
    },
    {
      title: "보안",
      icon: <Shield className="text-green-500" size={20} />,
      items: [
        { label: "데이터 암호화", value: "활성화됨", toggle: true, checked: true, onToggle: () => {} }
      ]
    },
    {
      title: "AI 엔진",
      icon: <Cpu className="text-purple-500" size={20} />,
      items: [
        { label: "분석 엔진", value: "Gemini 3 Flash", action: "정보" }
      ]
    }
  ];

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500 pb-32">
      <div className="mb-10">
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
          <SettingsIcon className="text-blue-600" size={32} /> 설정
        </h2>
        <p className="text-gray-500 mt-2">클라우드 연결 상태 및 앱 환경설정을 관리합니다.</p>
      </div>

      <div className="space-y-6">
        {/* DB Health Alert - Only show if specifically error */}
        {healthStatus && healthStatus.status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-[32px] p-6 animate-pulse-once">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-800 mb-1">데이터베이스 연결 문제</h3>
                <p className="text-sm text-red-600 mb-4">
                  Supabase 연결에 실패했습니다. 테이블이 없거나 네트워크 문제일 수 있습니다.<br/>
                  관리자에게 문의하거나 아래 SQL을 실행하여 테이블을 생성하세요.
                </p>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={copySQL}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-red-700 transition-all flex items-center gap-2"
                    >
                        {copied ? <CheckCircle2 size={16}/> : <Copy size={16}/>}
                        {copied ? '복사 완료!' : 'SQL 복사'}
                    </button>
                    <button 
                        onClick={runHealthCheck}
                        disabled={isChecking}
                        className="px-4 py-2 bg-white text-red-600 border border-red-200 text-sm font-bold rounded-xl shadow-sm hover:bg-red-50 transition-all flex items-center gap-2"
                    >
                        {isChecking ? <RefreshCcw className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>}
                        연결 재시도
                    </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {sections.map((section, idx) => (
          <div key={idx} className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-50 flex items-center gap-3">
              {section.icon}
              <h3 className="font-bold text-gray-800 text-sm">{section.title}</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {section.items.map((item, i) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-xs text-gray-400 font-medium">{item.label}</p>
                    <p className={`text-sm font-bold ${item.value.includes('Secure') ? 'text-green-600' : 'text-gray-900'}`}>{item.value}</p>
                  </div>
                  {item.toggle ? (
                    <button className={`w-12 h-6 rounded-full relative transition-colors ${item.checked ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${item.checked ? 'right-1' : 'left-1'}`}></div>
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                      {item.action}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {isCloudActive && demoDataCount > 0 && (
            <button 
              onClick={handleImportDemo}
              className="w-full flex items-center justify-center gap-2 p-5 bg-amber-50 text-amber-700 border border-amber-100 rounded-3xl font-bold hover:bg-amber-100 transition-colors active:scale-[0.98]"
            >
              <FileSearch size={20} /> 체험하기 데이터({demoDataCount}개) 가져오기
            </button>
        )}

        {isCloudActive && localDataCount > 0 && (
            <button 
              onClick={handleManualMigrate}
              className="w-full flex items-center justify-center gap-2 p-5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-3xl font-bold hover:bg-indigo-100 transition-colors active:scale-[0.98]"
            >
              <UploadCloud size={20} /> 현재 로컬 데이터({localDataCount}개) 클라우드 업로드
            </button>
        )}

        {/* 고급 설정 (SQL 수동 확인) */}
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
           <button 
             onClick={() => setShowAdvanced(!showAdvanced)}
             className="w-full px-6 py-4 bg-gray-50/50 border-b border-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
           >
             <div className="flex items-center gap-3">
               <Database className="text-gray-400" size={20} />
               <h3 className="font-bold text-gray-600 text-sm">시스템 정보 (디버그)</h3>
             </div>
             {showAdvanced ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
           </button>
           
           {showAdvanced && (
             <div className="p-6 space-y-4 bg-gray-50/30">
                <p className="text-xs text-gray-500 leading-relaxed">
                  문제 발생 시 아래 SQL을 사용하여 데이터베이스 구조를 복구할 수 있습니다.
                </p>
                <div className="bg-gray-900 rounded-xl p-4 relative group">
                  <pre className="text-[10px] text-gray-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-40 custom-scrollbar">
                    {REPAIR_SQL}
                  </pre>
                  <button 
                    onClick={copySQL}
                    className="absolute top-2 right-2 p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                    title="SQL 복사"
                  >
                    {copied ? <CheckCircle2 size={14} className="text-green-400"/> : <Copy size={14}/>}
                  </button>
                </div>
             </div>
           )}
        </div>

        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 p-5 bg-gray-100 text-gray-900 rounded-3xl font-bold hover:bg-gray-200 transition-colors active:scale-[0.98]"
        >
          로그아웃
        </button>
        
        <button 
            onClick={() => {
              if(confirm('주의: 모든 로컬 데이터가 삭제됩니다.')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="w-full flex items-center justify-center gap-2 p-4 text-red-400 text-xs font-bold hover:text-red-600 transition-colors"
          >
            <Trash2 size={14} /> 앱 초기화
        </button>
      </div>
    </div>
  );
};
