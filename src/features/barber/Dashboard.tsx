import React from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { 
  Calendar, 
  Users, 
  Scissors, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle,
  MoreVertical
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency } from '@/lib/utils';

export default function BarberDashboard() {
  const { user } = useAuthStore();

  const stats = [
    { label: 'Today Bookings', value: '8', icon: Calendar, color: 'bg-blue-500' },
    { label: 'Total Customers', value: '124', icon: Users, color: 'bg-purple-500' },
    { label: 'Services', value: '12', icon: Scissors, color: 'bg-orange-500' },
    { label: 'Revenue (MTD)', value: '$4,250', icon: TrendingUp, color: 'bg-green-500' },
  ];

  const upcomingBookings = [
    { id: '1', customer: 'David Miller', service: 'Classic Fade', time: '10:30 AM', status: 'confirmed' },
    { id: '2', customer: 'Sarah Wilson', service: 'Beard Trim', time: '11:15 AM', status: 'confirmed' },
    { id: '3', customer: 'Michael Chen', service: 'Haircut & Wash', time: '12:00 PM', status: 'pending' },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Welcome back, {user?.full_name.split(' ')[0]}!</h2>
          <p className="text-neutral-500">Here's what's happening in your shop today.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-bold flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Accepting Bookings
          </div>
          <button className="p-2 bg-white rounded-xl border border-stone-100 shadow-sm">
            <MoreVertical className="w-5 h-5 text-neutral-400" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm space-y-4">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white", stat.color)}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Bookings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Today's Schedule</h3>
            <button className="text-accent font-bold text-sm">View Full Calendar</button>
          </div>
          
          <div className="space-y-4">
            {upcomingBookings.map((booking) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-5 rounded-3xl border border-stone-100 shadow-sm flex items-center gap-4 group hover:border-accent/30 transition-all"
              >
                <div className="w-16 h-16 bg-stone-100 rounded-2xl flex flex-col items-center justify-center text-primary">
                  <span className="text-xs font-bold opacity-50 uppercase">{booking.time.split(' ')[1]}</span>
                  <span className="text-lg font-bold leading-none">{booking.time.split(' ')[0]}</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-lg truncate">{booking.customer}</h4>
                  <p className="text-sm text-neutral-500">{booking.service}</p>
                </div>

                <div className="flex items-center gap-2">
                  {booking.status === 'confirmed' ? (
                    <button className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors">
                      <CheckCircle2 className="w-6 h-6" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors">
                        <CheckCircle2 className="w-6 h-6" />
                      </button>
                      <button className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                        <XCircle className="w-6 h-6" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quick Actions / Activity */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-3">
            <button className="w-full flex items-center gap-3 p-4 bg-primary text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all">
              <Scissors className="w-5 h-5" />
              Add New Service
            </button>
            <button className="w-full flex items-center gap-3 p-4 bg-white border border-stone-100 rounded-2xl font-bold hover:bg-stone-50 transition-all">
              <Clock className="w-5 h-5" />
              Block Time Slot
            </button>
            <button className="w-full flex items-center gap-3 p-4 bg-white border border-stone-100 rounded-2xl font-bold hover:bg-stone-50 transition-all">
              <Users className="w-5 h-5" />
              Manage Customers
            </button>
          </div>

          <div className="bg-stone-900 p-6 rounded-[2rem] text-white space-y-4">
            <h4 className="font-bold">Pro Tip</h4>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Barbers who upload at least 5 photos of their work see a 40% increase in bookings.
            </p>
            <button className="text-accent text-sm font-bold hover:underline">Upload Photos</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
