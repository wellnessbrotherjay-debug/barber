import React from 'react';
import { useForm, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/useAuthStore';
import { Scissors, Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';
import { ShorterMark } from '@/components/ShorterLogo';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { setToken } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

const signupSchema = z
  .object({
    fullName: z.string().min(2, 'Enter your full name'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupForm = z.infer<typeof signupSchema>;

// The card is drawn in four parts below: the mark and title, the role toggle,
// the four fields, and the legal footer. They are separate so that the sign-up
// request at the top of the screen is not buried in markup; every class name
// and every word is the Figma board's and is unchanged.

function SignupHeading() {
  return (
    <div className="text-center space-y-2">
      <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-black/10 mb-4">
        <ShorterMark tone="light" className="w-9" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
      <p className="text-neutral-500">Join Shorter in seconds</p>
    </div>
  );
}

function RoleToggle({
  role,
  setRole,
}: {
  role: 'customer' | 'barber';
  setRole: (r: 'customer' | 'barber') => void;
}) {
  return (
    /* Role Toggle */
    <div className="flex p-1 bg-stone-100 rounded-2xl">
      <button
        type="button"
        onClick={() => setRole('customer')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
          role === 'customer' ? 'bg-white shadow-sm text-primary' : 'text-neutral-500'
        }`}
      >
        <UserIcon className="w-4 h-4" />
        Customer
      </button>
      <button
        type="button"
        onClick={() => setRole('barber')}
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

function SignupFields({
  register,
  errors,
}: {
  register: UseFormRegister<SignupForm>;
  errors: FieldErrors<SignupForm>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="relative">
          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Full Name"
            {...register('fullName')}
            className="w-full pl-12 pr-4 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-accent/20 transition-all"
          />
        </div>
        {errors.fullName && (
          <p className="text-red-600 text-xs mt-1.5 ml-2">{errors.fullName.message}</p>
        )}
      </div>

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

      <div>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="password"
            placeholder="Confirm Password"
            {...register('confirmPassword')}
            className="w-full pl-12 pr-4 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-accent/20 transition-all"
          />
        </div>
        {errors.confirmPassword && (
          <p className="text-red-600 text-xs mt-1.5 ml-2">{errors.confirmPassword.message}</p>
        )}
      </div>
    </div>
  );
}

function SignupFooter({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <>
      <p className="text-center text-neutral-500 text-xs leading-5 px-2">
        By creating an account, you agree to our{' '}
        <button type="button" onClick={() => navigate('/terms')} className="font-semibold text-ink underline">
          Terms of Service
        </button>{' '}
        and{' '}
        <button type="button" onClick={() => navigate('/privacy')} className="font-semibold text-ink underline">
          Privacy Policy
        </button>
        .
      </p>

      <div className="text-center">
        <p className="text-neutral-500 text-sm">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-accent font-bold hover:underline"
          >
            Sign In
          </button>
        </p>
      </div>
    </>
  );
}

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, setSession } = useAuthStore();
  const initialRole = (location.state as { role?: 'customer' | 'barber' } | null)?.role ?? 'customer';
  const [role, setRole] = React.useState<'customer' | 'barber'>(initialRole);
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: SignupForm) => {
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          full_name: data.fullName,
          role,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || `Signup failed: ${response.status}`);
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
      toast.success(`Welcome to Shorter, ${body.user.full_name}!`);
      if (role === 'barber' && body.user.onboarding_completed === false) {
        navigate('/barber/onboarding');
      } else {
        navigate(role === 'customer' ? '/customer' : '/barber');
      }
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : err}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-[2.5rem] shadow-xl shadow-black/5 border border-stone-100">
        <SignupHeading />

        <RoleToggle role={role} setRole={setRole} />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <SignupFields register={register} errors={errors} />

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all active:scale-95 shadow-xl shadow-black/10 disabled:opacity-60"
          >
            {submitting ? 'Creating account…' : 'Create Account'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <SignupFooter navigate={navigate} />
      </div>
    </div>
  );
}
