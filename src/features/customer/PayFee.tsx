import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  Scissors,
  Calendar,
  MessageCircle,
  Phone,
  FileText,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/useAuthStore';
import { authFetch } from '@/lib/api';

// Figma node 1:1972 "Pay Booking Fee" — appointment summary, booking fee
// breakdown, "What this unlocks" card, black pill CTA pinned at the bottom.

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

// Only load Stripe.js if a publishable key was baked in at build time.
// Without it there's nothing to load — the UI shows the honest
// "not enabled yet" state instead of a broken/blank payment form.
let stripePromise: Promise<StripeJs | null> | null = null;
function getStripe() {
  if (!STRIPE_PUBLISHABLE_KEY) return null;
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
}

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[8px] w-[38px] h-[38px] flex items-center justify-center shrink-0">
      {children}
    </div>
  );
}

function CheckoutForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handlePay() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message || 'Payment failed. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSuccess();
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <PaymentElement />
      </Card>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* CTA — Figma 1:1992 */}
      <div className="flex flex-col gap-1 w-full">
        <button
          type="button"
          disabled={!stripe || !elements || submitting}
          onClick={handlePay}
          className="w-full bg-[#1c1b1f] text-white rounded-[999px] px-9 py-[18px] text-[14px] font-semibold leading-5 text-center disabled:opacity-40 active:scale-[0.99] transition-transform"
        >
          {submitting ? 'Processing…' : 'Pay Booking Fee & Send Request'}
        </button>
        <p className="w-full px-9 py-[18px] text-[14px] font-semibold leading-5 text-[#a09cab] text-center">
          Secure Payment via Stripe
        </p>
      </div>
    </div>
  );
}

// Board page 30 — "Authorizes Payment". A distinct pre-checkout state of this
// screen: summary + fee breakdown + saved card, reached with ?view=authorize.
// Confirming drops the param and hands off to the real Stripe checkout below.
function AuthorizesPayment({ onConfirm }: { onConfirm: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white pb-8 flex flex-col">
      {/* Header */}
      <div className="bg-white flex items-center gap-1.5 px-5 py-4 pt-14">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-6 h-6 flex items-center justify-center shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5 text-[#1c1b1f]" />
        </button>
        <p className="flex-1 text-center text-[16px] font-bold leading-6 text-[#1c1b1f]">
          Authorizes Payment
        </p>
        <span className="w-6 h-6 shrink-0" />
      </div>

      {/* Appointment summary */}
      <div className="px-5 mt-2">
        <div className="bg-[#fafafa] rounded-[12px] p-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <IconTile>
              <Scissors className="w-4 h-4 text-[#1c1b1f]" />
            </IconTile>
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-medium leading-[14px] text-[#a09cab]">
                Classic Fade &amp; Beard
              </p>
              <p className="text-[13px] font-semibold leading-4 text-[#1c1b1f]">with Marcus V.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <IconTile>
              <Calendar className="w-4 h-4 text-[#1c1b1f]" />
            </IconTile>
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-medium leading-[14px] text-[#a09cab]">Oct 24</p>
              <p className="text-[13px] font-semibold leading-4 text-[#1c1b1f]">2:30 PM</p>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown + payment method */}
      <div className="px-5 mt-4">
        <div className="rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white p-4">
          <div className="flex items-center justify-between py-2">
            <p className="text-[13px] font-semibold text-[#1c1b1f]">Service Total</p>
            <p className="text-[13px] font-bold text-[#1c1b1f]">$45.00</p>
          </div>
          <div className="border-t border-dashed border-[#d2dbe9]" />
          <div className="flex items-center justify-between py-2">
            <p className="text-[13px] font-semibold text-[#1c1b1f]">Booking Fee</p>
            <p className="text-[13px] font-bold text-[#1c1b1f]">$20.00</p>
          </div>
          <div className="border-t border-dashed border-[#d2dbe9]" />
          <div className="flex items-center justify-between py-2">
            <p className="text-[13px] font-semibold text-[#1c1b1f]">Due at shop</p>
            <p className="text-[13px] font-bold text-[#1c1b1f]">$25.00</p>
          </div>
          <div className="border-t border-dashed border-[#d2dbe9]" />

          <div className="bg-[#f8f8f8] rounded-[10px] px-4 py-4 mt-3">
            <p className="text-[13px] font-medium text-[#1c1b1f]">
              &ldquo;We&rsquo;ll only charge after the barber accepts.&rdquo;
            </p>
          </div>

          <p className="text-[16px] font-bold text-[#1c1b1f] mt-5">Select Payment Method</p>
          <div className="rounded-[12px] border-[0.75px] border-[#d2dbe9] bg-white p-4 mt-3 flex items-center gap-3">
            <div className="bg-[#f8f8f8] rounded-[8px] w-[38px] h-[38px] flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 text-[#1c1b1f]" />
            </div>
            <p className="flex-1 text-[14px] font-bold text-[#1c1b1f] tracking-wide">
              &bull;&bull;&bull;&bull; 4242
            </p>
            <button
              type="button"
              onClick={() => toast.info('Card management is coming soon')}
              className="text-[13px] font-medium text-[#a09cab]"
            >
              Change
            </button>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-auto px-5 pt-10 flex flex-col gap-1">
        <button
          type="button"
          onClick={onConfirm}
          className="w-full bg-[#1c1b1f] text-white rounded-[999px] px-9 py-[18px] text-[14px] font-semibold leading-5 text-center active:scale-[0.99] transition-transform"
        >
          Authorizes Booking Fee ($20)
        </button>
        <p className="w-full px-9 py-[18px] text-[14px] font-semibold leading-5 text-[#a09cab] text-center">
          Secure Payment via Stripe
        </p>
      </div>
    </div>
  );
}

export default function PayFee() {
  const { id: bookingId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const stripe = useMemo(() => getStripe(), []);

  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState('');
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingId) return;

    // No publishable key baked into this build → Stripe isn't wired up in
    // this environment yet. Don't even attempt the API call, and don't
    // silently fall back to a fake payment — show the honest pending state.
    if (!stripe) {
      setNotConfigured(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function createIntent() {
      try {
        setLoading(true);
        const response = await authFetch(`/api/payments/create-intent`, {
          method: 'POST',
          body: JSON.stringify({ booking_id: bookingId }),
        });

        if (response.status === 501) {
          if (!cancelled) setNotConfigured(true);
          return;
        }

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || `Failed to start payment: ${response.status}`);
        }

        const data = await response.json();
        if (!cancelled) setClientSecret(data.client_secret);
      } catch (err) {
        if (!cancelled) setError(`${err}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    createIntent();
    return () => { cancelled = true; };
  }, [bookingId, stripe, user?.id]);

  function handleSuccess() {
    toast.success('Booking fee paid!');
    navigate('/customer/bookings');
  }

  // Page-30 review state: confirming clears the param, revealing the real
  // Stripe checkout so the actual authorization still happens for real.
  if (searchParams.get('view') === 'authorize') {
    return (
      <AuthorizesPayment
        onConfirm={() => {
          const next = new URLSearchParams(searchParams);
          next.delete('view');
          setSearchParams(next, { replace: true });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white pb-8">
      {/* Top navigation bar — Figma 1:1985 */}
      <div className="bg-white flex items-center gap-1.5 px-5 py-4 pt-14">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-6 h-6 flex items-center justify-center shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5 text-[#1c1b1f]" />
        </button>
        <p className="flex-1 text-center text-[16px] font-bold leading-6 text-[#1c1b1f]">
          Pay Booking Fee
        </p>
        <span className="w-6 h-6 shrink-0" />
      </div>

      {/* Appointment — Figma 1:1996 */}
      <div className="bg-white flex flex-col gap-4 px-5 py-4">
        <div className="flex items-center gap-1.5 w-full">
          <FileText className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.75} />
          <p className="text-[18px] font-semibold leading-6 text-[#1c1b1f]">Appointment</p>
        </div>
        <div className="bg-[#fafafa] rounded-[12px] p-3 flex flex-col gap-4 w-full">
          <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center gap-3">
              <IconTile>
                <Scissors className="w-4 h-4 text-[#1c1b1f]" />
              </IconTile>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-semibold leading-[14px] text-[#a09cab]">
                  Service Selected
                </p>
                <p className="text-[12px] font-semibold leading-4 text-[#1c1b1f]">
                  Signature Skin Fade &amp; Beard Trim
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <IconTile>
                <Calendar className="w-4 h-4 text-[#1c1b1f]" />
              </IconTile>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-semibold leading-[14px] text-[#a09cab]">
                  Date &amp; Time
                </p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[12px] font-semibold leading-4 text-[#1c1b1f]">
                    Tuesday, Oct 24
                  </p>
                  <span className="w-1 h-1 rounded-full bg-[#a09cab]" />
                  <p className="text-[12px] font-semibold leading-4 text-[#1c1b1f]">10:00 AM</p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-[12px] font-semibold leading-4 text-[#1c1b1f]">
            with Marcus 'The Fade' Rivera
          </p>
        </div>
      </div>

      {/* Booking Fee — Figma 1:2022 */}
      <div className="bg-white flex flex-col gap-4 px-5 py-4">
        <div className="flex items-center justify-between w-full">
          <p className="text-[18px] font-semibold leading-6 text-[#1c1b1f]">Booking Fee</p>
          <p className="text-[12px] font-bold leading-4 text-[#1c1b1f]">$20.00</p>
        </div>
        <div className="bg-[#f6f7fb] rounded-[12px] p-4 flex items-center justify-between w-full">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold leading-[14px] text-[#a09cab]">
              To confirm appointment
            </p>
            <p className="text-[12px] font-semibold leading-4 text-[#1c1b1f]">Booking Fee</p>
          </div>
          <p className="text-[12px] font-bold leading-4 text-[#1c1b1f]">$20.00</p>
        </div>
        <p className="text-[12px] font-medium leading-4 text-[#1c1b1f]">
          Your card is temporarily authorizes. The booking fee will only be charged once the
          barber accepts your request.
        </p>
      </div>

      {/* What this unlocks — Figma 1:2034 */}
      <div className="px-5">
        <div className="bg-[#fafafa] rounded-[12px] p-3 flex flex-col gap-4 w-full">
          <p className="text-[18px] font-semibold leading-6 text-[#1c1b1f]">What this unlocks:</p>
          <div className="flex items-center gap-3 w-full">
            <IconTile>
              <Scissors className="w-4 h-4 text-[#1c1b1f]" />
            </IconTile>
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-semibold leading-[14px] text-[#a09cab]">
                Confirmed Request
              </p>
              <p className="text-[12px] font-semibold leading-4 text-[#1c1b1f] max-w-[279px]">
                Your card is temporarily authorizes. The booking fee will only be charged once the
                barber accepts your request.
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full">
            <span className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-[999px] px-7 py-3.5 text-[14px] font-semibold leading-5 text-[#1c1b1f]">
              <MessageCircle className="w-5 h-5" /> Chat
            </span>
            <span className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-[999px] px-7 py-3.5 text-[14px] font-semibold leading-5 text-[#1c1b1f]">
              <Phone className="w-5 h-5" /> Call
            </span>
          </div>
        </div>
      </div>

      {/* Payment / CTA */}
      <div className="px-5 mt-4 space-y-4">
        {notConfigured && (
          <>
            <Card className="p-5 flex items-start gap-3 border-amber-200 bg-amber-50">
              <CreditCard className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-ink">Card payments aren't enabled yet</p>
                <p className="text-xs text-muted mt-1">
                  Your booking fee will be collected another way for now. We're finishing
                  the setup with our payment provider — this screen will accept cards
                  automatically once that's live, no action needed from you.
                </p>
              </div>
            </Card>
            <div className="flex flex-col gap-1 w-full">
              <button
                type="button"
                disabled
                className="w-full bg-[#1c1b1f] text-white rounded-[999px] px-9 py-[18px] text-[14px] font-semibold leading-5 text-center opacity-40"
              >
                Pay Booking Fee &amp; Send Request
              </button>
              <p className="w-full px-9 py-[18px] text-[14px] font-semibold leading-5 text-[#a09cab] text-center">
                Secure Payment via Stripe
              </p>
            </div>
          </>
        )}

        {!notConfigured && error && (
          <Card className="p-5 flex items-start gap-3 border-red-200 bg-red-50">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </Card>
        )}

        {!notConfigured && loading && (
          <p className="text-sm text-muted text-center">Setting up secure payment…</p>
        )}

        {!notConfigured && !loading && !error && stripe && clientSecret && (
          <Elements stripe={stripe} options={{ clientSecret }}>
            <CheckoutForm onSuccess={handleSuccess} />
          </Elements>
        )}
      </div>
    </div>
  );
}
