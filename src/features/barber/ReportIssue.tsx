import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/api';

type ReportedType = 'barber' | 'customer';

export default function ReportIssue() {
  const navigate = useNavigate();
  const [reportedType, setReportedType] = useState<ReportedType>('customer');
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
    <div className="min-h-screen bg-white pb-10">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[16px] font-bold">Report an Issue</h1>
      </div>

      <div className="px-5 flex flex-col items-center text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-[#1c1b1f] flex items-center justify-center mb-3">
          <ShieldAlert className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-lg font-bold">Safety First</h2>
        <p className="text-sm text-[#a09cab] mt-1 max-w-[280px]">
          Select who you'd like to report and provide details about the incident.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 space-y-5">
        <div>
          <p className="text-sm font-semibold mb-2">I want to report a:</p>
          <div className="flex bg-[#f2f1fa] rounded-full p-1">
            {(['barber', 'customer'] as ReportedType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setReportedType(type)}
                className={`flex-1 py-2 rounded-full text-sm font-semibold capitalize transition-colors ${
                  reportedType === type ? 'bg-[#1c1b1f] text-white' : 'text-[#6c6a75]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold mb-2">Additional Comments</p>
          <textarea
            placeholder="Describe the issue in detail"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={6}
            className="w-full px-4 py-3 bg-[#fafaff] rounded-xl text-sm resize-none"
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Report'}
        </Button>
      </form>
    </div>
  );
}
