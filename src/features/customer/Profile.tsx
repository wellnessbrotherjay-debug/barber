import React from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { User, Mail, Phone, MapPin, Bell, Shield, LogOut, ChevronRight, Camera, Scissors } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sections = [
    {
      title: 'Account Settings',
      items: [
        { label: 'Personal Information', icon: User, value: user?.full_name },
        { label: 'Email Address', icon: Mail, value: user?.email },
        { label: 'Phone Number', icon: Phone, value: '+1 (555) 000-0000' },
        ...(user?.role === 'barber' ? [
          { label: 'Shop Details', icon: Scissors, value: 'Elite Cuts Studio' },
          { label: 'Business Address', icon: MapPin, value: '123 Main St, Downtown' },
        ] : [
          { label: 'Default Location', icon: MapPin, value: 'New York, NY' },
        ]),
      ]
    },
    {
      title: 'Preferences',
      items: [
        { label: 'Notifications', icon: Bell, value: 'On' },
        { label: 'Privacy & Security', icon: Shield, value: '' },
      ]
    }
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      {/* Profile Header */}
      <div className="text-center space-y-4">
        <div className="relative w-32 h-32 mx-auto">
          <div className="w-full h-full rounded-full bg-stone-200 overflow-hidden border-4 border-white shadow-xl">
            <img 
              src={user?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`} 
              alt="" 
              className="w-full h-full object-cover"
            />
          </div>
          <button className="absolute bottom-0 right-0 w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center border-4 border-white shadow-lg hover:scale-110 transition-transform">
            <Camera className="w-5 h-5" />
          </button>
        </div>
        <div>
          <h2 className="text-2xl font-bold">{user?.full_name}</h2>
          <p className="text-neutral-500 capitalize">{user?.role}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-3xl border border-stone-100 text-center shadow-sm">
          <p className="text-xl font-bold">12</p>
          <p className="text-[10px] text-neutral-400 font-bold uppercase">Bookings</p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-stone-100 text-center shadow-sm">
          <p className="text-xl font-bold">4</p>
          <p className="text-[10px] text-neutral-400 font-bold uppercase">Favorites</p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-stone-100 text-center shadow-sm">
          <p className="text-xl font-bold">8</p>
          <p className="text-[10px] text-neutral-400 font-bold uppercase">Reviews</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="space-y-3">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest px-4">{section.title}</h3>
            <div className="bg-white rounded-[2rem] border border-stone-100 shadow-sm overflow-hidden">
              {section.items.map((item, i) => (
                <button 
                  key={item.label}
                  className={`w-full flex items-center justify-between p-5 hover:bg-stone-50 transition-colors ${
                    i !== section.items.length - 1 ? 'border-b border-stone-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-neutral-400">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold">{item.label}</p>
                      {item.value && <p className="text-xs text-neutral-500">{item.value}</p>}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-stone-300" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button 
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-3 p-5 bg-red-50 text-red-600 rounded-[2rem] font-bold hover:bg-red-100 transition-all"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>
    </div>
  );
}
