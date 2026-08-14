import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';

const FAQS = [
  { q: 'How do I book a barber?', a: 'Browse barbers on the home screen, pick a service, and send a booking request. The barber confirms and you\'re set.' },
  { q: 'How do I cancel a booking?', a: 'Go to Booking History, open the appointment, and choose Cancel. Cancellation fees may apply within 24 hours of the appointment.' },
  { q: 'When am I charged?', a: 'A small booking fee is charged when the barber accepts your request. The remaining balance is paid at the appointment.' },
  { q: 'How do I contact my barber?', a: 'Once a booking is confirmed, you can message your barber directly from the booking details screen.' },
];

export default function HelpSupport() {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = () => {
    if (!message.trim()) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setMessage('');
      toast.success('Message sent — we\'ll reply within 24 hours');
    }, 500);
  };

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-surface rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-ink" />
        </button>
        <h1 className="text-[16px] font-bold">Help & Support</h1>
      </div>

      <div className="px-5 space-y-2 mb-6">
        {FAQS.map((faq, i) => (
          <div key={i} className="border border-[#d2dbe9] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-4 text-left"
            >
              <span className="text-sm font-medium">{faq.q}</span>
              <ChevronDown className={`w-4 h-4 text-[#a09cab] transition-transform ${openIndex === i ? 'rotate-180' : ''}`} />
            </button>
            {openIndex === i && (
              <p className="px-4 pb-4 text-xs text-[#514e59]">{faq.a}</p>
            )}
          </div>
        ))}
      </div>

      <div className="px-5">
        <p className="text-xs font-medium text-[#514e59] mb-2 flex items-center gap-1">
          <Mail className="w-3.5 h-3.5" /> Still need help? Message support
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Describe your issue..."
          className="w-full px-4 py-3 rounded-xl bg-[#fafaff] text-sm outline-none focus:ring-2 focus:ring-ink/20 resize-none"
        />
        <Button onClick={handleSend} disabled={sending || !message.trim()} className="w-full mt-3">
          {sending ? 'Sending…' : 'Send message'}
        </Button>
      </div>
    </div>
  );
}
