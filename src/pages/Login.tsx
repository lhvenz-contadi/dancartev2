import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import logo from '../assets/Logotipo.png';

const mapAuthError = (msg: string | undefined, isLogin: boolean): string => {
  if (!msg) return isLogin ? 'Erro ao fazer login.' : 'Erro ao criar conta.';
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials'))
    return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed'))
    return 'Confirme seu e-mail antes de entrar.';
  if (m.includes('user already registered') || m.includes('already registered'))
    return 'Já existe uma conta com este e-mail.';
  if (m.includes('password should be at least'))
    return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('invalid email'))
    return 'E-mail inválido.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Muitas tentativas. Aguarde alguns instantes e tente novamente.';
  if (m.includes('network'))
    return 'Sem conexão. Verifique sua internet.';
  return msg;
};

export const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSignupSuccess(false);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSignupSuccess(true);
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(mapAuthError(err?.message, isLogin));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] bg-[#F8F9FA] flex flex-col items-center justify-center px-4 sm:px-8 font-sans"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm md:max-w-md bg-white rounded-3xl p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50"
      >
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="DancArte" className="w-32 sm:w-40 h-auto" />
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-slate-800">
            {isLogin ? 'Bem-vinda' : 'Criar conta'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isLogin ? 'Acesse sua conta para continuar' : 'Cadastre-se para começar a usar'}
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2.5"
          >
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 font-medium leading-snug">{error}</p>
          </div>
        )}

        {signupSuccess && (
          <div
            role="status"
            className="mb-4 p-3.5 rounded-xl bg-green-50 border border-green-100"
          >
            <p className="text-sm text-green-700 font-medium leading-snug">
              Conta criada! Se necessário, confirme seu e-mail antes de entrar.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-[13px] font-bold text-primary mb-1.5 ml-1">
              E-mail
            </label>
            <div className="relative group">
              <Mail
                aria-hidden
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-secondary transition-colors"
              />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl text-base focus:bg-white focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/10 transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-[13px] font-bold text-primary mb-1.5 ml-1">
              Senha
            </label>
            <div className="relative group">
              <Lock
                aria-hidden
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-secondary transition-colors"
              />
              <input
                id="password"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl text-base focus:bg-white focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/10 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary hover:bg-secondary text-white font-bold rounded-2xl mt-2 transition-all shadow-lg shadow-primary/20 inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-base"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <span>{isLogin ? 'Entrar' : 'Criar conta'}</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setSignupSuccess(false);
            }}
            className="min-h-11 px-3 text-sm text-slate-500 hover:text-primary transition-colors"
          >
            {isLogin ? (
              <>Não tem conta? <span className="text-secondary font-bold">Cadastre-se</span></>
            ) : (
              <>Já tem conta? <span className="text-secondary font-bold">Entrar</span></>
            )}
          </button>
        </div>
      </motion.div>

      <p className="mt-6 sm:mt-8 text-slate-400 text-[10px] uppercase tracking-widest font-bold text-center px-4">
        © 2026 DancArte
      </p>
    </div>
  );
};
