import React from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Bell, Calendar, Scissors, Star, ChevronRight, Info } from 'lucide-react';
import { motion } from 'motion/react';

export default function Notifications() {
  const notifications = [
    {
      id: '1',
      type: 'booking_confirmed',
      title: 'Booking Confirmed!',
      body: 'Your appointment with Marcus Thorne is confirmed for tomorrow at 2:00 PM.',
      time: '2 hours ago',
      is_read: false,
      icon: Calendar,
      color: 'bg-green-100 text-green-600'
    },
    {
      id: '2',
      type: 'review_request',
      title: 'How was your cut?',
      body: 'Share your experience with Elena Rodriguez from your visit yesterday.',
      time: '1 day ago',
      is_read: true,
      icon: Star,
      color: 'bg-yellow-100 text-yellow-600'
    },
    {
      id: '3',
      type: 'promo',
      title: 'Weekend Special',
      body: 'Get 20% off all beard trims this weekend at Elite Cuts Studio.',
      time: '2 days ago',
      is_read: true,
      icon: Scissors,
      color: 'bg-blue-100 text-blue-600'
    }
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notifications</h2>
        <button className="text-sm font-bold text-accent hover:underline">Mark all as read</button>
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-5 rounded-3xl border transition-all flex gap-4 group cursor-pointer ${
              notification.is_read ? 'bg-white border-stone-100' : 'bg-white border-accent/20 shadow-sm'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${notification.color}`}>
              <notification.icon className="w-6 h-6" />
            </div>
            
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm">{notification.title}</h4>
                <span className="text-[10px] text-neutral-400 font-medium">{notification.time}</span>
              </div>
              <p className="text-sm text-neutral-500 leading-relaxed">{notification.body}</p>
            </div>

            {!notification.is_read && (
              <div className="w-2 h-2 bg-accent rounded-full mt-2 shrink-0" />
            )}
          </motion.div>
        ))}
      </div>

      <div className="bg-stone-100 p-6 rounded-3xl flex items-start gap-4">
        <Info className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
        <p className="text-xs text-neutral-500 leading-relaxed">
          We'll send you reminders for upcoming appointments and special offers from your favorite barbers. You can manage these in settings.
        </p>
      </div>
    </div>
  );
}
