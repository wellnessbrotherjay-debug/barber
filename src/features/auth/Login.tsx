import React from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Scissors, Mail, Lock, ArrowRight, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();
  const { setUser, setSession, setLoading } = useAuthStore();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<'customer' | 'barber'>('customer');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Mock login for demo purposes
    // In a real app, use supabase.auth.signInWithPassword
    setTimeout(() => {
      const mockUser = {
        id: '123',
        full_name: role === 'customer' ? 'John Customer' : 'Alex Barber',
        email: email,
        role: role,
        avatar_url: `https://i.pravatar.cc/150?u=${role}`
      };
      
      setUser(mockUser);
      setSession({ access_token: 'mock-token' });
      setLoading(false);
      toast.success(`Welcome back, ${mockUser.full_name}!`);
      navigate(role === 'customer' ? '/' : '/barber');
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-[2.5rem] shadow-xl shadow-black/5 border border-stone-100">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-black/10 mb-4">
            <Scissors className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to BarberSync</h1>
          <p className="text-neutral-500">Sign in to book your next cut</p>
        </div>

        {/* Role Toggle */}
        <div className="flex p-1 bg-stone-100 rounded-2xl">
          <button
            onClick={() => setRole('customer')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
              role === 'customer' ? 'bg-white shadow-sm text-primary' : 'text-neutral-500'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            Customer
          </button>
          <button
            onClick={() => setRole('barber')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
              role === 'barber' ? 'bg-white shadow-sm text-primary' : 'text-neutral-500'
            }`}
          >
            <Scissors className="w-4 h-4" />
            Barber
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
              <input
                type="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-accent/20 transition-all"
              />
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
            <button className="text-accent font-bold hover:underline">Create Account</button>
          </p>
        </div>
      </div>
    </div>
  );
}
