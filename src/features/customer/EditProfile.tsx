import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Flag,
  HelpCircle,
  ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { DeleteAccountRow } from '@/components/DeleteAccountDialog';

// Board page 46 — customer "Edit Profile".
// Layout, section order and copy replicate the Figma frame exactly; the data
// (name/email) still round-trips through the auth store like before.

const SERVICE_TYPES = ['Haircut', 'Beard Trim', 'Haircut + Beard', 'Kids Haircut'];
const BOOKING_MODES = ['In-Shop', 'At-Home', 'Both'];

function PillInput({
  icon,
  ...props
}: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center gap-3 w-full rounded-full border-[0.75px] border-[#d2dbe9] bg-white px-5 py-[15px]">
      <span className="shrink-0 text-[#a09cab]">{icon}</span>
      <input
        {...props}
        className="flex-1 bg-transparent outline-none text-[14px] font-medium text-[#1c1b1f] placeholder:text-[#a09cab]"
      />
    </div>
  );
}

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [serviceTypes, setServiceTypes] = useState<string[]>(['Haircut', 'Beard Trim']);
  const [bookingMode, setBookingMode] = useState('In-Shop');
  const [saving, setSaving] = useState(false);

  const toggleServiceType = (t: string) =>
    setServiceTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

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
      {/* Header */}
      <div className="flex items-center gap-1.5 px-5 py-4 pt-14">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-6 h-6 flex items-center justify-center shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5 text-[#1c1b1f]" />
        </button>
        <p className="flex-1 text-center text-[16px] font-bold leading-6 text-[#1c1b1f]">
          Edit Profile
        </p>
        <span className="w-6 h-6 shrink-0" />
      </div>

      {/* Avatar block */}
      <div className="flex flex-col items-center px-5 pt-4">
        <div className="w-[100px] h-[100px] rounded-[16px] bg-[#f2f1fa] flex items-center justify-center overflow-hidden">
          {user?.avatar_url ? (
            <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
          ) : (
            <ImageIcon className="w-8 h-8 text-[#c9c6d4]" />
          )}
        </div>
        <h1 className="text-[22px] font-bold text-[#1c1b1f] mt-6">
          {fullName || user?.full_name || 'Your Name'}
        </h1>
        <button
          type="button"
          onClick={() => toast.info('Photo upload is coming soon')}
          className="text-[14px] font-medium text-[#6c6a75] mt-1"
        >
          Change Photo
        </button>
        <p className="text-[13px] font-medium text-[#a09cab] text-center leading-5 mt-2 max-w-[330px]">
          This information helps barbers identify you and find your location easily.
        </p>
      </div>

      {/* Personal Information */}
      <div className="px-5 mt-8">
        <h2 className="text-[20px] font-bold text-[#1c1b1f] mb-4">Personal Information</h2>
        <div className="flex flex-col gap-3">
          <PillInput
            icon={<User className="w-5 h-5" strokeWidth={1.5} />}
            placeholder="Sarah Khan"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <PillInput
            icon={<Phone className="w-5 h-5" strokeWidth={1.5} />}
            placeholder="+92 3XX XXXXXXX"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <PillInput
            icon={<Mail className="w-5 h-5" strokeWidth={1.5} />}
            placeholder="sarah@email.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PillInput
            icon={<MapPin className="w-5 h-5" strokeWidth={1.5} />}
            placeholder="F-11, Islamabad , House 12, Street 4, F-11"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <div className="flex items-start gap-3 w-full rounded-[24px] border-[0.75px] border-[#d2dbe9] bg-white px-5 py-[15px] min-h-[140px]">
            <FileText className="w-5 h-5 shrink-0 text-[#a09cab] mt-0.5" strokeWidth={1.5} />
            <textarea
              placeholder="Prefer low-fade styles and neat beard trims."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="flex-1 bg-transparent outline-none resize-none text-[14px] font-medium text-[#1c1b1f] placeholder:text-[#a09cab]"
            />
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="px-5 mt-8">
        <h2 className="text-[20px] font-bold text-[#1c1b1f] mb-4">Preferences</h2>
        <div className="rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white p-4">
          <p className="text-[15px] font-semibold text-[#1c1b1f]">Preferred Service Type</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {SERVICE_TYPES.map((t) => {
              const active = serviceTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleServiceType(t)}
                  className={`px-3.5 py-2 rounded-full text-[12px] font-semibold transition-colors ${
                    active ? 'bg-[#1c1b1f] text-white' : 'bg-[#f8f8f8] text-[#1c1b1f]'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          <p className="text-[15px] font-semibold text-[#1c1b1f] mt-5">Preferred Booking Mode</p>
          <div className="flex gap-2 mt-3">
            {BOOKING_MODES.map((m) => {
              const active = bookingMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setBookingMode(m)}
                  className={`flex-1 py-3 rounded-[12px] text-[13px] font-semibold transition-colors ${
                    active
                      ? 'bg-[#1c1b1f] text-white'
                      : 'bg-white text-[#1c1b1f] border-[0.75px] border-[#d2dbe9]'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-5">
            <p className="text-[15px] font-bold text-[#1c1b1f]">Preferred Time</p>
            <p className="text-[13px] font-medium text-[#a09cab]">Evenings / Weekends</p>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="px-5 mt-8">
        <h2 className="text-[20px] font-bold text-[#1c1b1f] mb-4">Account</h2>
        <div className="rounded-[16px] bg-[#f8f8f8] p-4 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-medium text-[#a09cab]">Current Role</p>
            <p className="text-[15px] font-semibold text-[#1c1b1f] mt-1">Customer</p>
          </div>
          <button
            type="button"
            onClick={() => toast.info('Role switching is coming soon')}
            className="text-[14px] font-bold text-[#1c1b1f]"
          >
            Switch Role
          </button>
        </div>
        <p className="text-[13px] font-medium text-[#6c6a75] mt-3">
          You can switch between Customer and Barber anytime
        </p>
        <div className="mt-3">
          <DeleteAccountRow />
        </div>
      </div>

      {/* Safety & Support */}
      <div className="px-5 mt-8">
        <h2 className="text-[20px] font-bold text-[#1c1b1f] mb-4">Safety &amp; Support</h2>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate('/customer/help')}
            className="w-full rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white px-4 py-[18px] flex items-center gap-3 text-left"
          >
            <Flag className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.75} />
            <span className="flex-1 text-[15px] font-semibold text-[#1c1b1f]">Report an issue</span>
            <ChevronRight className="w-5 h-5 text-[#a09cab]" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/customer/help')}
            className="w-full rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white px-4 py-[18px] flex items-center gap-3 text-left"
          >
            <HelpCircle className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.75} />
            <span className="flex-1 text-[15px] font-semibold text-[#1c1b1f]">Help/Support</span>
            <ChevronRight className="w-5 h-5 text-[#a09cab]" />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 mt-8 flex flex-col gap-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#1c1b1f] text-white rounded-full py-[18px] text-[15px] font-semibold disabled:opacity-40 active:scale-[0.99] transition-transform"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-full py-4 text-[15px] font-semibold text-[#a09cab]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
