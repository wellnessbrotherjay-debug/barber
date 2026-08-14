import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!user) return;
    setSaving(true);
    setUser({ ...user, full_name: fullName, email });
    setTimeout(() => {
      setSaving(false);
      toast.success('Profile updated');
      navigate(-1);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-surface rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-ink" />
        </button>
        <h1 className="text-[16px] font-bold">Edit Profile</h1>
      </div>

      <div className="px-5 flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full bg-[#f2f1fa] flex items-center justify-center mb-2">
          {user?.avatar_url ? <img src={user.avatar_url} className="w-full h-full rounded-full object-cover" alt="" /> : <User className="w-8 h-8 text-[#a09cab]" />}
        </div>
      </div>

      <div className="px-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-[#514e59] block mb-1">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#fafaff] text-sm outline-none focus:ring-2 focus:ring-ink/20"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[#514e59] block mb-1">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="w-full px-4 py-3 rounded-xl bg-[#fafaff] text-sm outline-none focus:ring-2 focus:ring-ink/20"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
