import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/useAuthStore';
import { Scissors, Mail, Lock, ArrowRight, User as UserIcon } from 'lucide-react';
import { ShorterMark } from '@/components/ShorterLogo';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { setToken } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

// The brand block at the top of the card carries no state, so it stands alone.
function LoginHeader() {
  return (
    <div className="text-center space-y-2">
      <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-black/10 mb-4">
        <ShorterMark tone="light" className="w-9" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Welcome to Shorter</h1>
      <p className="text-neutral-500">Get a hair cut, wherever, whenever</p>
    </div>
  );
}

// The customer/barber switch is a small control over a single piece of state, so
// it is clearer as its own named component than as two near-identical buttons
// in the middle of the page.
function RoleToggle({
  role,
  onSelect,
}: {
  role: 'customer' | 'barber';
  onSelect: (r: 'customer' | 'barber') => void;
}) {
  return (
    <div className="flex p-1 bg-stone-100 rounded-2xl">
      <button
        onClick={() => onSelect('customer')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
          role === 'customer' ? 'bg-white shadow-sm text-primary' : 'text-neutral-500'
        }`}
      >
        <UserIcon className="w-4 h-4" />
        Customer
      </button>
      <button
        onClick={() => onSelect('barber')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
          role === 'barber' ? 'bg-white shadow-sm text-primary' : 'text-neutral-500'
        }`}
      >
        <Scissors className="w-4 h-4" />
        Barber
      </button>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { setUser, setSession, setLoading } = useAuthStore();
  const [role, setRole] = React.useState<'customer' | 'barber'>('customer');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || `Login failed: ${response.status}`);
      }

      setToken(body.token);
      setUser({
        id: body.user.id,
        full_name: body.user.full_name,
        email: body.user.email,
        role: body.user.role,
        avatar_url: body.user.avatar_url,
        onboarding_completed: body.user.onboarding_completed,
        is_verified: body.user.is_verified,
      });
      setSession({ access_token: body.token });
      toast.success(`Welcome back, ${body.user.full_name}!`);
      navigate(body.user.role === 'customer' ? '/' : '/barber');
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-[2.5rem] shadow-xl shadow-black/5 border border-stone-100">
        <LoginHeader />

        {/* Role Toggle */}
        <RoleToggle role={role} onSelect={setRole} />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="space-y-4">
            <div>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
                <input
                  type="email"
                  placeholder="Email Address"
                  {...register('email')}
                  className="w-full pl-12 pr-4 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-accent/20 transition-all"
                />
              </div>
              {errors.email && (
                <p className="text-red-600 text-xs mt-1.5 ml-2">{errors.email.message}</p>
              )}
            </div>
            <div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
                <input
                  type="password"
                  placeholder="Password"
                  {...register('password')}
                  className="w-full pl-12 pr-4 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-accent/20 transition-all"
                />
              </div>
              {errors.password && (
                <p className="text-red-600 text-xs mt-1.5 ml-2">{errors.password.message}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all active:scale-95 shadow-xl shadow-black/10"
          >
            Sign In
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="text-center">
          <p className="text-neutral-500 text-sm">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="text-accent font-bold hover:underline"
            >
              Create Account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
