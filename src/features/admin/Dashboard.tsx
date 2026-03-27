import React from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { 
  Users, 
  Scissors, 
  Calendar, 
  ShieldCheck, 
  AlertCircle,
  TrendingUp,
  Search,
  Filter
} from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminDashboard() {
  const stats = [
    { label: 'Total Revenue', value: '$128,450', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Active Barbers', value: '452', icon: Scissors, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Total Customers', value: '12,840', icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'Pending Approvals', value: '14', icon: ShieldCheck, color: 'text-orange-600', bg: 'bg-orange-100' },
  ];

  const pendingBarbers = [
    { id: '1', name: 'James Wilson', shop: 'The Gentleman Cut', appliedAt: '2 hours ago' },
    { id: '2', name: 'Maria Garcia', shop: 'Modern Styles', appliedAt: '5 hours ago' },
    { id: '3', name: 'Robert Chen', shop: 'Classic Barber Co.', appliedAt: '1 day ago' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Admin Overview</h2>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white border border-stone-200 rounded-xl font-bold text-sm shadow-sm hover:bg-stone-50 transition-all">
            Export Data
          </button>
          <button className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-black/10 hover:bg-neutral-800 transition-all">
            System Settings
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${stat.bg}`}>
              <stat.icon className={`w-7 h-7 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-neutral-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pending Approvals */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-orange-500" />
              Pending Approvals
            </h3>
            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-md text-xs font-bold">14 New</span>
          </div>
          
          <div className="space-y-3">
            {pendingBarbers.map((barber) => (
              <div key={barber.id} className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm flex items-center justify-between group hover:border-orange-200 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center font-bold text-stone-400">
                    {barber.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{barber.name}</p>
                    <p className="text-xs text-neutral-500">{barber.shop}</p>
                  </div>
                </div>
                <button className="text-xs font-bold text-orange-600 hover:underline">Review</button>
              </div>
            ))}
            <button className="w-full py-3 text-sm font-bold text-neutral-400 hover:text-primary transition-colors">
              View All Applications
            </button>
          </div>
        </div>

        {/* Recent Bookings / Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Recent System Activity</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search logs..." 
                  className="pl-9 pr-4 py-2 bg-stone-100 rounded-xl border-none text-sm focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <button className="p-2 bg-stone-100 rounded-xl">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {[
                  { action: 'New Booking', user: 'David M.', status: 'Success', time: '2m ago' },
                  { action: 'Barber Signup', user: 'James W.', status: 'Pending', time: '15m ago' },
                  { action: 'Review Flagged', user: 'System', status: 'Alert', time: '1h ago' },
                  { action: 'Promo Created', user: 'Admin', status: 'Success', time: '3h ago' },
                ].map((log, i) => (
                  <tr key={i} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-sm">{log.action}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{log.user}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                        log.status === 'Success' ? 'bg-green-100 text-green-700' :
                        log.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-neutral-400">{log.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
