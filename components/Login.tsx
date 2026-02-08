
import React, { useState } from 'react';
import { Loader2, Cloud, Mail, ArrowRight, WifiOff } from 'lucide-react';
import { cloudAuth, cloudData } from '../services/cloudService';

interface LoginProps {
  onLogin: (email: string) => void;
}

type AuthMode = 'login' | 'signup';

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  
  const getFriendlyErrorMessage = (msg: string) => {
    if (msg.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 일치하지 않습니다.';
    if (msg.includes('Email not confirmed')) return '이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.';
    if (msg.includes('User already registered')) return '이미 가입된 이메일입니다. 로그인해주세요.';
    if (msg.includes('Password should be')) return '비밀번호는 6자리 이상이어야 합니다.';
    if (msg.includes('fetch')) return '서버 연결 실패. 인터넷 연결을 확인하거나 서버 설정을 점검하세요.';
    return msg;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Admin Backdoor
    if (email === 'dp_hanbono@outlook.kr') {
        if (password === 'Qwert108!@') {
            setTimeout(() => { onLogin(email); }, 1000);
            return;
        }
    }

    cloudAuth.setForceLocal(false);

    try {
      if (mode === 'signup') {
        const res = await cloudAuth.signup(email, password, name);
        if (res.success) {
           if (cloudData.isCloudConnected()) setVerificationSent(true);
           else onLogin(email);
        }
        else setError(getFriendlyErrorMessage(res.message || '가입 실패'));
      } 
      else if (mode === 'login') {
        const res = await cloudAuth.login(email, password);
        if (res.success) onLogin(email);
        else setError(getFriendlyErrorMessage(res.message || '로그인 실패'));
      } 
    } catch (err: any) {
      setError(err.message || '통신 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setIsLoading(true);
    setError('');
    cloudAuth.setForceLocal(true);
    try {
      const demoEmail = 'guest@milestone.x';
      const demoPass = 'password';
      const demoName = '게스트';
      await cloudAuth.ensureAccount(demoEmail, demoPass, demoName);
      const res = await cloudAuth.login(demoEmail, demoPass);
      if (res.success) onLogin(demoEmail);
      else setError('데모 계정 접속 실패');
    } catch (e) {
      setError('오류 발생');
    } finally {
      setIsLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full mx-auto bg-white rounded-[32px] shadow-2xl p-8 border border-gray-100 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">인증 메일 발송 완료!</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            <span className="font-bold text-gray-900">{email}</span> 주소로 인증 메일을 보냈습니다.<br/>
            메일의 링크를 클릭하면 가입이 완료됩니다.
          </p>
          <button 
            onClick={() => { setVerificationSent(false); setMode('login'); }}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            로그인 하러 가기 <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto h-16 w-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-blue-200 mb-6">X</div>
        <h2 className="text-3xl font-extrabold text-gray-900">
          {mode === 'login' ? 'Milestone X Login' : 'Milestone X Sign Up'}
        </h2>
        
        <div className="mt-3 flex items-center justify-center gap-2">
           <span className="flex items-center gap-1.5 text-green-600 font-bold text-xs bg-green-50 px-3 py-1 rounded-full border border-green-100">
                <Cloud size={12} /> Secure Cloud
           </span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-gray-200/50 rounded-[32px] sm:px-10 border border-gray-100 relative overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-300">
              <Loader2 className="animate-spin text-blue-600" size={32} />
              <p className="text-xs font-bold text-blue-700">처리 중...</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">이름</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="홍길동"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">이메일</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="example@milestone.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">비밀번호</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg text-center animate-pulse border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="group w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-lg text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-[0.98]"
            >
              {mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              className="text-blue-600 font-bold text-sm hover:text-blue-500"
            >
              {mode === 'login' ? '새 계정 만들기' : '기존 계정으로 로그인'}
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
             <button 
                onClick={handleQuickDemoLogin}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold flex items-center justify-center gap-2 mx-auto transition-colors"
            >
                <WifiOff size={14}/> 오프라인 체험하기 (Guest Mode)
            </button>
        </div>
      </div>
    </div>
  );
};
