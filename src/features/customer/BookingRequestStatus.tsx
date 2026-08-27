import React from 'react';
import { RoundIconTile } from '../../components/ScreenPieces';
import CustomerScreenHeader from '../../components/CustomerScreenHeader';
import { useNavigate, useParams } from 'react-router-dom';
import { CircleCheck, Clock, Scissors, ShieldCheck, MessageSquare, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { authFetch } from '@/lib/api';

const STEPS = [
  { key: 'sent', label: 'Request Sent', icon: CircleCheck },
  { key: 'awaiting', label: 'Awaiting Barber', icon: Clock },
  { key: 'service', label: 'Service', icon: Scissors },
] as const;

// The stepper is a repeated shape driven only by which step is active, so it is
// its own component.
function RequestStepper({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex items-start justify-between mt-4">
      {STEPS.map(({ key, label, icon: Icon }, i) => (
        <React.Fragment key={key}>
          <div className="flex flex-col items-center w-[88px]">
            <span
              className={cn(
                'w-12 h-12 rounded-[14px] flex items-center justify-center',
                i <= activeIndex ? 'bg-ink' : 'bg-[#efeff4]'
              )}
            >
              <Icon className={cn('w-5 h-5', i <= activeIndex ? 'text-white' : 'text-[#b7b4c0]')} strokeWidth={1.8} />
            </span>
            <span
              className={cn(
                'text-[13px] mt-2 text-center whitespace-nowrap',
                i <= activeIndex ? 'font-bold text-ink' : 'font-medium text-[#b7b4c0]'
              )}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <span className={cn('flex-1 h-px mt-6', i < activeIndex ? 'bg-ink' : 'bg-[#d4d2e3]')} style={i === 0 ? { backgroundColor: '#1c1b1f' } : undefined} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// The locked chat card is entirely static markup, so it belongs on its own.
function ChatLockedCard() {
  return (
    <div className="border-[0.75px] border-[#d2dbe9] rounded-[20px] p-4 mt-5">
      <div className="flex flex-col items-center pt-4">
        <div className="w-[120px] h-[120px] rounded-[16px] bg-surface flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-9 h-9 text-[#d4d2e3]" fill="currentColor" aria-hidden>
            <circle cx="14.5" cy="8.5" r="2.5" />
            <path d="M4 18l5-6 4 4.5L16 13l4 5H4z" />
          </svg>
        </div>
        <p className="text-[18px] font-bold text-ink mt-5">Chat is locked</p>
        <p className="text-[14px] text-muted text-center leading-5 mt-1 max-w-[260px]">
          Chat unlocks after a barber accepts your request.
        </p>
      </div>
      <div className="border-t-[1.5px] border-dashed border-[#e3e1ec] mt-6" />
      <div className="flex gap-3 mt-4">
        <button
          type="button"
          disabled
          className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full py-4 text-[15px] font-semibold text-ink disabled:opacity-100"
        >
          <MessageSquare className="w-5 h-5" strokeWidth={1.8} /> Chat
        </button>
        <button
          type="button"
          disabled
          className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full py-4 text-[15px] font-semibold text-ink disabled:opacity-100"
        >
          <Phone className="w-5 h-5" strokeWidth={1.8} /> Call
        </button>
      </div>
    </div>
  );
}

// Figma page 21 — Booking Request status: stepper, payment-authorized status,
// locked chat card, and Cancel Booking Request.
export default function BookingRequestStatus() {
  const { id: bookingId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  async function handleCancel() {
    if (!bookingId || !user?.id) {
      navigate('/customer');
      return;
    }
    try {
      const response = await authFetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: {
        },
      });
      if (!response.ok) throw new Error(`Failed to cancel: ${response.status}`);
      toast.success('Request cancelled');
      navigate('/customer');
    } catch (err) {
      toast.error(`${err}`);
    }
  }

  const activeIndex = 0; // request just sent

  return (
    <div className="min-h-screen bg-white flex flex-col pb-8">
      {/* Header */}
      <CustomerScreenHeader title="Booking Request" onBack={() => navigate(-1)} />

      <div className="px-6 flex-1">
        {/* Stepper */}
        <RequestStepper activeIndex={activeIndex} />

        {/* Status card */}
        <div className="bg-[#f6f7fb] rounded-[18px] p-5 mt-8 flex items-start gap-4">
          <RoundIconTile>
            <ShieldCheck className="w-5 h-5 text-ink" strokeWidth={1.8} />
          </RoundIconTile>
          <div>
            <p className="text-[16px] font-bold text-ink">Status: Payment Authorizes</p>
            <p className="text-[14px] text-muted leading-6 mt-1">
              Your card is temporarily authorizes. The booking fee will only be charged once the
              barber accepts your request.
            </p>
          </div>
        </div>

        {/* Chat locked card */}
        <ChatLockedCard />

        {/* Note */}
        <div className="bg-[#f6f7fb] rounded-[14px] p-4 mt-5">
          <p className="text-[14px] text-ink leading-6">
            <span className="font-bold">Note:</span> You will be notified immediately once a barber
            accepts. Most requests are accepted within 3 minutes.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 mt-8">
        <button
          type="button"
          onClick={handleCancel}
          className="w-full bg-ink text-white text-[16px] font-semibold py-[20px] rounded-full"
        >
          Cancel Booking Request
        </button>
      </div>
    </div>
  );
}
