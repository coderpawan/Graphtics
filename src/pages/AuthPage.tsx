import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [isRegister, setIsRegister] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterValues>({ resolver: zodResolver(isRegister ? registerSchema : loginSchema) as any });

  // Get the page user was trying to access
  const from = (location.state as any)?.from?.pathname ?? '/';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  useEffect(() => {
    document.title = `Graphtics | ${isRegister ? 'Create Account' : 'Sign In'}`;
  }, [isRegister]);

  const onSubmit = async (data: LoginValues | RegisterValues) => {
    try {
      if (isRegister) {
        const registerData = data as RegisterValues;
        await signUp(registerData.name, registerData.email, registerData.password);
      } else {
        const loginData = data as LoginValues;
        await signIn(loginData.email, loginData.password);
      }
      navigate(from, { replace: true });
    } catch (error) {
      console.error(error);
    }
  };

  const handleResetPassword = async () => {
    const email = window.prompt('Enter your email address for password reset');
    if (email) {
      await resetPassword(email);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-lg space-y-8 rounded-[32px] border border-white/10 bg-slate-950/90 p-10 shadow-2xl">
        <div className="space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.28em] text-violet-300">{isRegister ? 'Create account' : 'Welcome back'}</p>
          <h1 className="text-3xl font-semibold text-white">{isRegister ? 'Start your Graphtics journey' : 'Login to Graphtics'}</h1>
          <p className="text-sm text-slate-400">Secure access to your profile, orders, wishlist, and premium drops.</p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {isRegister && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Name</label>
              <Input type="text" placeholder="Your name" {...register('name')} />
              {errors.name && <p className="mt-2 text-sm text-rose-400">{errors.name.message}</p>}
            </div>
          )}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">Email</label>
            <Input type="email" placeholder="hello@graphtics.com" {...register('email')} />
            {errors.email && <p className="mt-2 text-sm text-rose-400">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">Password</label>
            <Input type="password" placeholder="••••••••" {...register('password')} />
            {errors.password && <p className="mt-2 text-sm text-rose-400">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full">{isRegister ? 'Create account' : 'Sign in'}</Button>
        </form>
        <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={handleResetPassword} className="text-violet-300 hover:text-white">Forgot password?</button>
          <button type="button" onClick={() => setIsRegister(prev => !prev)} className="text-violet-300 hover:text-white">
            {isRegister ? 'Already have an account?' : 'Create account'}
          </button>
        </div>
        <div className="border-t border-white/10 pt-6 text-center text-sm text-slate-400">
          <p>Or continue with</p>
          <Button
            type="button"
            onClick={async () => {
              try {
                await signInWithGoogle();
                navigate(from, { replace: true });
              } catch (error) {
                console.error(error);
              }
            }}
            className="mt-4 w-full rounded-3xl border border-white/10 bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
