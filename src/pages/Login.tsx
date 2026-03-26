import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { GraduationCap, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        // Supabase usually requires email confirmation. If disabled, it auto-logs in.
        // We'll show an alert just in case it requires confirmation.
        alert('Conta criada com sucesso! (Se necessário, verifique seu e-mail).');
        setIsLogin(true); // Switch back to login view or let it auto redirect if session updates
      }
    } catch (err: any) {
      setError(err.message || (isLogin ? 'Erro ao fazer login. Verifique suas credenciais.' : 'Erro ao criar conta.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px] bg-white rounded-[32px] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary rounded-2xl p-3 shadow-lg shadow-primary/20 mb-4">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-primary tracking-tight">DancArte</h1>
          <p className="text-accent text-sm font-medium uppercase tracking-[0.2em] mt-1">Gestão Escolar</p>
        </div>

        <div className="mb-8 text-center">
          <h2 className="text-xl font-bold text-slate-800">{isLogin ? 'Bem-vindo' : 'Criar Conta'}</h2>
          <p className="text-slate-400 text-sm mt-1">
            {isLogin ? 'Acesse sua conta para continuar' : 'Cadastre-se no sistema para continuar'}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3"
          >
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 font-medium leading-relaxed">{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-bold text-primary mb-2 ml-1">E-mail</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-secondary transition-colors" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:bg-white focus:outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/5 transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 ml-1">
              <label className="block text-[13px] font-bold text-primary">Senha</label>
              {isLogin && (
                <button type="button" className="text-[11px] font-bold text-secondary hover:underline">Esqueceu a senha?</button>
              )}
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-secondary transition-colors" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:bg-white focus:outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/5 transition-all outline-none"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-secondary hover:bg-primary text-white font-bold py-4 rounded-2xl mt-4 transition-all shadow-lg shadow-secondary/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <span>{isLogin ? 'Entrar no Sistema' : 'Criar Conta'}</span>
                {isLogin && (
                  <motion.span 
                    className="inline-block"
                    whileHover={{ x: 4 }}
                  >
                    →
                  </motion.span>
                )}
              </>
            )}
          </button>
        </form>

        <p className="text-center text-slate-400 text-xs mt-8">
          {isLogin ? 'Ainda não tem acesso?' : 'Já tem uma conta?'}{' '}
          <button 
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-secondary font-bold hover:underline"
          >
            {isLogin ? 'Crie uma agora' : 'Faça login'}
          </button>
        </p>
      </motion.div>

      <p className="mt-8 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
        © 2026 DancArte • Todos os direitos reservados
      </p>
    </div>
  );
};
