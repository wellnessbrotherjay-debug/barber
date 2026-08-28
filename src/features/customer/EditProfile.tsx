import React, { useRef, useState } from 'react';
import { CentredTitle, IconButton, PanelCard } from '../../components/ScreenPieces';
import { useNavigate } from 'react-router-dom';
import { uploadMyAvatar } from '../../lib/api';
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

/** The user record as the auth store hands it out, so the pieces below can be
 *  typed without exporting a new shape from the store. */
type AuthUser = ReturnType<typeof useAuthStore.getState>['user'];

// The title bar. Its own piece because the board draws a back arrow, a centred
// title and a matching spacer as one unit, and reading the screen is easier
// when that unit is one line rather than fourteen. It is deliberately NOT the
// shared ScreenHeader: this one's arrow and padding differ from that
// component's, and the design is contractually fixed, so swapping it would
// change what renders.
function EditProfileHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center gap-1.5 px-5 py-4 pt-14">
      <IconButton label="Back" onClick={onBack}>
        <ChevronLeft className="w-5 h-5 text-[#1c1b1f]" />
      </IconButton>
      <CentredTitle>
        Edit Profile
      </CentredTitle>
      <span className="w-6 h-6 shrink-0" />
    </div>
  );
}

// Kept together because the picture, the name under it, the hidden file input
// and the "Change Photo" button are one feature: everything here exists to
// serve the avatar, and the file input is only useful next to the button that
// opens it.
function AvatarBlock({
  user,
  setUser,
  fullName,
  photoInputRef,
  uploadingPhoto,
  setUploadingPhoto,
}: {
  user: AuthUser;
  setUser: (user: AuthUser) => void;
  fullName: string;
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  uploadingPhoto: boolean;
  setUploadingPhoto: (uploading: boolean) => void;
}) {
  return (
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
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            setUploadingPhoto(true);
            const url = await uploadMyAvatar(file);
            setUser(user ? { ...user, avatar_url: url } : user);
            toast.success('Photo updated');
          } catch (err) {
            console.error('[EditProfile] photo upload failed:', err);
            toast.error(err instanceof Error ? err.message : 'Photo upload failed');
          } finally {
            setUploadingPhoto(false);
          }
        }}
      />
      <button
        type="button"
        disabled={uploadingPhoto}
        onClick={() => photoInputRef.current?.click()}
        className="text-[14px] font-medium text-[#6c6a75] mt-1 disabled:opacity-50"
      >
        {uploadingPhoto ? 'Uploading…' : 'Change Photo'}
      </button>
      <p className="text-[13px] font-medium text-[#a09cab] text-center leading-5 mt-2 max-w-[330px]">
        This information helps barbers identify you and find your location easily.
      </p>
    </div>
  );
}

// One block on the board, so one component here: the five fields the customer
// gives about themselves, in the order the board sets.
function PersonalInformationSection({
  fullName,
  setFullName,
  phone,
  setPhone,
  email,
  setEmail,
  address,
  setAddress,
  notes,
  setNotes,
}: {
  fullName: string;
  setFullName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
}) {
  return (
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
          placeholder="Email address"
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
  );
}

// The two choice groups and the read-only "Preferred Time" line share one card
// on the board, so they move together as one piece.
function PreferencesSection({
  serviceTypes,
  toggleServiceType,
  bookingMode,
  setBookingMode,
}: {
  serviceTypes: string[];
  toggleServiceType: (t: string) => void;
  bookingMode: string;
  setBookingMode: (m: string) => void;
}) {
  return (
    <div className="px-5 mt-8">
      <h2 className="text-[20px] font-bold text-[#1c1b1f] mb-4">Preferences</h2>
      <PanelCard>
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
      </PanelCard>
    </div>
  );
}

// The role card, the sentence explaining it and the delete row are the whole
// "Account" block on the board; separating any one of them would leave the
// other two stranded.
function AccountSection({ onSwitchRole }: { onSwitchRole: () => void }) {
  return (
    <div className="px-5 mt-8">
      <h2 className="text-[20px] font-bold text-[#1c1b1f] mb-4">Account</h2>
      <div className="rounded-[16px] bg-[#f8f8f8] p-4 flex items-center justify-between">
        <div>
          <p className="text-[12px] font-medium text-[#a09cab]">Current Role</p>
          <p className="text-[15px] font-semibold text-[#1c1b1f] mt-1">Customer</p>
        </div>
        <button
          type="button"
          onClick={onSwitchRole}
          className="text-[14px] font-bold text-[#1c1b1f]"
        >
          Switch Role
        </button>
      </div>
      <p className="text-[13px] font-medium text-[#6c6a75] mt-3">
        You can switch between Customer and Barber anytime
      </p>
      <div className="mt-3">
      </div>
    </div>
  );
}

// Two rows that differ only by icon and label but are written out in full
// because the board draws them that way; they are their own piece so the main
// component isn't carrying twenty lines of near-identical markup.
function SafetyAndSupportSection({ onOpenHelp }: { onOpenHelp: () => void }) {
  return (
    <div className="px-5 mt-8">
      <h2 className="text-[20px] font-bold text-[#1c1b1f] mb-4">Safety &amp; Support</h2>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onOpenHelp}
          className="w-full rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white px-4 py-[18px] flex items-center gap-3 text-left"
        >
          <Flag className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.75} />
          <span className="flex-1 text-[15px] font-semibold text-[#1c1b1f]">Report an issue</span>
          <ChevronRight className="w-5 h-5 text-[#a09cab]" />
        </button>
        <button
          type="button"
          onClick={onOpenHelp}
          className="w-full rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white px-4 py-[18px] flex items-center gap-3 text-left"
        >
          <HelpCircle className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.75} />
          <span className="flex-1 text-[15px] font-semibold text-[#1c1b1f]">Help/Support</span>
          <ChevronRight className="w-5 h-5 text-[#a09cab]" />
        </button>
      </div>
    </div>
  );
}

// The footer call to action. Its own piece so the two buttons that end the
// screen sit together and away from the form above them.
function EditProfileActions({
  saving,
  onSave,
  onCancel,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="px-5 mt-8 flex flex-col gap-1">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="w-full bg-[#1c1b1f] text-white rounded-full py-[18px] text-[15px] font-semibold disabled:opacity-40 active:scale-[0.99] transition-transform"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="w-full py-4 text-[15px] font-semibold text-[#a09cab]"
      >
        Cancel
      </button>
    </div>
  );
}

export default function EditProfile() {
  const navigate = useNavigate();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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
      <EditProfileHeader onBack={() => navigate(-1)} />

      {/* Avatar block */}
      <AvatarBlock
        user={user}
        setUser={setUser}
        fullName={fullName}
        photoInputRef={photoInputRef}
        uploadingPhoto={uploadingPhoto}
        setUploadingPhoto={setUploadingPhoto}
      />

      {/* Personal Information */}
      <PersonalInformationSection
        fullName={fullName}
        setFullName={setFullName}
        phone={phone}
        setPhone={setPhone}
        email={email}
        setEmail={setEmail}
        address={address}
        setAddress={setAddress}
        notes={notes}
        setNotes={setNotes}
      />

      {/* Preferences */}
      <PreferencesSection
        serviceTypes={serviceTypes}
        toggleServiceType={toggleServiceType}
        bookingMode={bookingMode}
        setBookingMode={setBookingMode}
      />

      {/* Account */}
      <AccountSection onSwitchRole={() => navigate('/welcome')} />

      {/* Safety & Support */}
      <SafetyAndSupportSection onOpenHelp={() => navigate('/customer/help')} />

      {/* Actions */}
      <EditProfileActions
        saving={saving}
        onSave={handleSave}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}

