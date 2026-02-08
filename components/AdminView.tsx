
import React, { useState, useEffect } from 'react';
import { Shield, Users, Database, Server, Activity, Search, AlertTriangle, Lock, LogOut, CheckCircle2, XCircle, Plus, Save, X } from 'lucide-react';
import { cloudData, loadLocalDB } from '../services/cloudService';

interface AdminViewProps {
  onLogout: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onLogout }) => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeMeetings: 0,
    storageUsage: '0 MB',
    systemHealth: 'Normal'
  });
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'system'>('users');
  const [jobLogs, setJobLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<'failed' | 'all'>('failed');
  const [logError, setLogError] = useState<string | null>(null);
  
  // Add User Modal State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'User' });

  const loadAdminData = async () => {
    const db = loadLocalDB();
    const userList = Object.keys(db.users).map(email => ({
      email,
      name: db.users[email].name,
      joinedAt: new Date().toLocaleDateString(), // Mock
      status: 'Active',
      role: email === 'dp_hanbono@outlook.kr' ? 'Super Admin' : (db.users[email].role || 'User')
    }));
    
    let meetingCount = 0;
    Object.keys(db.meetings).forEach(key => {
      meetingCount += db.meetings[key].length;
    });

    setUsers(userList);
    setStats({
      totalUsers: userList.length,
      activeMeetings: meetingCount,
      storageUsage: `${(meetingCount * 2.5).toFixed(1)} MB`,
      systemHealth: 'Healthy'
    });
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadJobLogs = async (filter: 'failed' | 'all' = logFilter) => {
    setIsLoadingLogs(true);
    setLogError(null);
    try {
      const qs = filter === 'failed' ? '?status=failed&limit=30' : '?limit=30';
      const res = await fetch(`/api/jobs/admin${qs}`);
      const json = await res.json();
      setJobLogs(json.data || []);
    } catch (e: any) {
      setLogError(e?.message || '로그를 불러오지 못했습니다.');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'system') {
      loadJobLogs();
    }
  }, [activeTab]);

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email) return;

    // 1. Update Local DB (Persistence)
    const db = loadLocalDB();
    // Don't overwrite existing if not needed, but here we act as Admin adding/updating
    if (!db.users[newUser.email.toLowerCase()]) {
        db.users[newUser.email.toLowerCase()] = { 
            name: newUser.name, 
            password: 'password', // Default password
            role: newUser.role
        };
        localStorage.setItem('bmove_local_db', JSON.stringify(db));
        
        // 2. Reload Data
        loadAdminData();
        
        // 3. Reset & Close
        setNewUser({ name: '', email: '', role: 'User' });
        setIsAddUserOpen(false);
        alert(`사용자(${newUser.name})가 추가되었습니다. 초기 비밀번호는 'password' 입니다.`);
    } else {
        alert('이미 존재하는 이메일입니다.');
    }
  };

  const deleteUser = (email: string) => {
      if(email === 'dp_hanbono@outlook.kr') {
          alert('슈퍼 관리자는 삭제할 수 없습니다.');
          return;
      }
      if(confirm('정말 이 사용자를 삭제하시겠습니까? 로컬 데이터베이스에서 제거됩니다.')) {
          const db = loadLocalDB();
          delete db.users[email.toLowerCase()];
          localStorage.setItem('bmove_local_db', JSON.stringify(db));
          loadAdminData();
      }
  }

  return (
    <div className="p-6 lg:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-slate-50 min-h-screen">
      <header className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
            <Shield size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Super Admin Console</h1>
            <p className="text-sm text-slate-500 font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              System Operational
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-4">
             <span className="text-sm font-bold text-slate-900">dp_hanbono@outlook.kr</span>
             <span className="text-xs text-slate-400 font-medium">Root Access</span>
          </div>
          <button onClick={onLogout} className="px-5 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2">
            <LogOut size={18} /> 로그아웃
          </button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Users</p>
            <p className="text-2xl font-black text-slate-900">{stats.totalUsers}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Database size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Meetings</p>
            <p className="text-2xl font-black text-slate-900">{stats.activeMeetings}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <Server size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Storage Used</p>
            <p className="text-2xl font-black text-slate-900">{stats.storageUsage}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">System Health</p>
            <p className="text-2xl font-black text-green-600">{stats.systemHealth}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-8 py-5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'users' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <Users size={18} /> 사용자 관리
          </button>
          <button 
            onClick={() => setActiveTab('system')}
            className={`px-8 py-5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'system' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <Lock size={18} /> 보안 및 로그
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'users' && (
            <div className="space-y-4">
               <div className="flex justify-between items-center mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-200" placeholder="사용자 검색..." />
                  </div>
                  <button 
                    onClick={() => setIsAddUserOpen(true)}
                    className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Plus size={16} /> 새 관리자 추가
                  </button>
               </div>
               
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                     <th className="py-3 pl-2">User</th>
                     <th className="py-3">Role</th>
                     <th className="py-3">Status</th>
                     <th className="py-3">Joined</th>
                     <th className="py-3 text-right">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {users.map((user, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                        <td className="py-4 pl-2">
                           <div>
                             <p className="text-sm font-bold text-slate-900">{user.name}</p>
                             <p className="text-xs text-slate-500">{user.email}</p>
                           </div>
                        </td>
                        <td className="py-4">
                           <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${user.role === 'Super Admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                             {user.role}
                           </span>
                        </td>
                        <td className="py-4">
                           <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                             <CheckCircle2 size={14} /> Active
                           </div>
                        </td>
                        <td className="py-4 text-xs font-mono text-slate-500">
                           {user.joinedAt}
                        </td>
                        <td className="py-4 text-right">
                           {user.role !== 'Super Admin' && (
                             <button 
                                onClick={() => deleteUser(user.email)}
                                className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                             >
                               Ban
                             </button>
                           )}
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
            </div>
          )}

          {activeTab === 'system' && (
             <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-6">
                   <h3 className="text-yellow-800 font-bold flex items-center gap-2 mb-2">
                     <AlertTriangle size={20} /> 보안 경고
                   </h3>
                   <p className="text-sm text-yellow-700 leading-relaxed">
                      현재 <b>클라이언트 사이드</b> 환경에서 관리자 모드가 실행 중입니다.<br/>
                      완전한 보안을 위해서는 서버 사이드 인증(Server-Side Auth) 및 RLS 정책 강화가 필요합니다.<br/>
                      이 대시보드는 로컬 및 연결된 클라우드의 데이터를 시각화하는 용도로 제한됩니다.
                   </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setLogFilter('failed');
                          loadJobLogs('failed');
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${logFilter === 'failed' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-slate-500 border-slate-200'}`}
                      >
                        실패만 보기
                      </button>
                      <button
                        onClick={() => {
                          setLogFilter('all');
                          loadJobLogs('all');
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${logFilter === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}
                      >
                        전체 보기
                      </button>
                    </div>
                    <button
                      onClick={() => loadJobLogs()}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      새로고침
                    </button>
                  </div>

                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <AlertTriangle size={16} className="text-red-500" /> 작업 실패 로그
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">최근 작업 상태 및 실패 원인을 확인합니다.</p>
                  </div>

                  {logError && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-600 font-medium">
                      {logError}
                    </div>
                  )}

                  {isLoadingLogs ? (
                    <div className="text-sm text-slate-400 font-bold">로그 불러오는 중...</div>
                  ) : jobLogs.length === 0 ? (
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 text-sm text-slate-400 font-bold">
                      표시할 로그가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {jobLogs.map((log) => (
                        <div key={log.jobId} className="bg-white border border-slate-100 rounded-2xl p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {log.title || '작업'}
                              </p>
                              <p className="text-[11px] text-slate-500 font-medium">
                                Job ID: {log.jobId}
                              </p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${log.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                              {log.status}
                            </span>
                          </div>
                          <div className="mt-2 text-[11px] text-slate-500 font-medium space-y-1">
                            <div>User: {log.userEmail || '-'}</div>
                            <div>Stage: {log.stage || '-'}</div>
                            <div>Segment: {log.segmentIndex ?? '-'} {log.segmentKey ? `(${log.segmentKey})` : ''}</div>
                            <div>Updated: {log.updatedAt || '-'}</div>
                          </div>
                          {log.error && (
                            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-700 whitespace-pre-wrap">
                              {log.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
             </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Users size={20} className="text-slate-500" /> 사용자 추가
                    </h3>
                    <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">이름</label>
                        <input 
                            value={newUser.name}
                            onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 font-medium"
                            placeholder="사용자 이름"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">이메일</label>
                        <input 
                            value={newUser.email}
                            onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 font-medium"
                            placeholder="user@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">권한</label>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setNewUser({...newUser, role: 'User'})}
                                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${newUser.role === 'User' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            >
                                User
                            </button>
                            <button 
                                onClick={() => setNewUser({...newUser, role: 'Admin'})}
                                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${newUser.role === 'Admin' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            >
                                Admin
                            </button>
                        </div>
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button 
                            onClick={() => setIsAddUserOpen(false)}
                            className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50"
                        >
                            취소
                        </button>
                        <button 
                            onClick={handleAddUser}
                            className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200"
                        >
                            추가하기
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
