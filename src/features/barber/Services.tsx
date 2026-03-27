import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { barberService } from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';
import { Plus, Scissors, Clock, DollarSign, Trash2, Edit2, ChevronRight, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function BarberServices() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  
  // In a real app, we'd fetch the barber's specific services
  const { data: barber, isLoading } = useQuery({
    queryKey: ['barber-detail', 'b1'], // Using mock barber b1 for demo
    queryFn: () => barberService.getBarberDetail('b1'),
  });

  const services = barber?.services || [];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Services</h2>
          <p className="text-neutral-500">Manage the services you offer and their pricing.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-neutral-800 transition-all shadow-xl shadow-black/10">
          <Plus className="w-5 h-5" />
          Add Service
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} className="h-40 bg-stone-200 animate-pulse rounded-[2.5rem]" />
          ))
        ) : (
          services.map((service) => (
            <div 
              key={service.id}
              className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm flex flex-col justify-between group hover:border-accent/30 transition-all"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center text-neutral-400">
                    <Scissors className="w-6 h-6" />
                  </div>
                  <div className="flex gap-1">
                    <button className="p-2 text-neutral-400 hover:bg-stone-50 rounded-xl transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h4 className="text-lg font-bold">{service.name}</h4>
                  <p className="text-sm text-neutral-500 line-clamp-2 leading-relaxed">{service.description}</p>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-stone-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-neutral-400">
                    <Clock className="w-4 h-4" />
                    {service.duration_minutes}m
                  </div>
                  <div className="w-1 h-1 bg-stone-200 rounded-full" />
                  <div className="flex items-center gap-1 text-lg font-black text-primary">
                    <span className="text-sm font-bold text-neutral-400">$</span>
                    {service.price}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Active</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-stone-100 p-8 rounded-[2.5rem] flex items-start gap-4">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
          <Info className="w-5 h-5 text-neutral-400" />
        </div>
        <div className="space-y-1">
          <h5 className="font-bold text-sm">Pro Tip: Keep it fresh</h5>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Barbers who update their service descriptions and add seasonal specials see a 25% increase in bookings. Try adding a "Summer Fade" or "Holiday Shave" to attract more clients.
          </p>
        </div>
      </div>
    </div>
  );
}
