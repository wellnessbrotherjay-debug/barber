import React, { useState } from 'react';
import ScreenHeader from '../../components/ScreenHeader';
import { useNavigate } from 'react-router-dom';
import { Scissors, Users, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/api';

type ReportedType = 'barber' | 'customer';

const TYPES: { key: ReportedType; label: string; icon: typeof Scissors }[] = [
  { key: 'barber', label: 'Barber', icon: Scissors },
  { key: 'customer', label: 'Customer', icon: Users },
];

export default function ReportIssue() {
  const navigate = useNavigate();
  const [reportedType, setReportedType] = useState<ReportedType>('barber');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comments.trim()) {
      toast.error('Please describe the issue before submitting');
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch('/api/issues', {
        method: 'POST',
        body: JSON.stringify({ reported_type: reportedType, comments: comments.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Failed to submit report: ${res.status}`);
      toast.success('Report submitted — our team will review it');
      navigate(-1);
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : err}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top Navigation Bar — Figma page 60 */}
      <ScreenHeader title="Report Issue" />

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        {/* Safety First headline */}
        <div className="px-5 py-4">
          <h2 className="text-[20px] leading-7 font-bold text-[#1c1b1f]">Safety First</h2>
          <p className="text-[14px] leading-5 font-medium text-[#a09cab] mt-1 max-w-[320px]">
            Select who you'd like to report and provide details about the incident.
          </p>
        </div>

        {/* I want to report a: */}
        <div className="px-5 py-4">
          <h3 className="text-[18px] leading-6 font-bold text-[#1c1b1f]">I want to report a:</h3>
        </div>
        <div className="px-5 grid grid-cols-2 gap-3">
          {TYPES.map((t) => {
            const selected = reportedType === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setReportedType(t.key)}
                className={`rounded-[12px] px-4 py-6 flex flex-col items-center gap-3 transition-colors ${
                  selected ? 'bg-[#1c1b1f]' : 'bg-[#fafafa]'
                }`}
              >
                <span className="w-[42px] h-[42px] bg-white rounded-[8px] flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
                </span>
                <span className={`text-[16px] leading-6 font-semibold ${selected ? 'text-white' : 'text-[#1c1b1f]'}`}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Additional Comments */}
        <div className="px-5 pt-8 pb-2">
          <p className="text-[16px] leading-6 font-semibold text-[#1c1b1f]">Additional Comments</p>
        </div>
        <div className="px-5">
          <div className="border-[0.75px] border-[#d2dbe9] rounded-[12px] p-4 flex items-start gap-2">
            <FileText className="w-5 h-5 text-[#a09cab] mt-0.5 shrink-0" strokeWidth={1.8} />
            <textarea
              placeholder="Describe the issue in detail"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={7}
              className="flex-1 bg-transparent text-[14px] leading-5 font-medium text-[#1c1b1f] placeholder:text-[#a09cab] resize-none outline-none"
            />
          </div>
        </div>

        <div className="flex-1" />

        {/* Submit Report — Figma page 60 bottom CTA */}
        <div className="px-5 pb-8 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#1c1b1f] rounded-full px-9 py-[18px] text-[14px] leading-5 font-semibold text-white text-center disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      </form>
    </div>
  );
}
