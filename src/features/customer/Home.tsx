import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { barberService } from '@/services/api';
import { Star, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { BarberProfile } from '@/types';

export default function CustomerHome() {
  const navigate = useNavigate();
  const { data: barbers, isLoading } = useQuery<BarberProfile[]>({
    queryKey: ['barbers'],
    queryFn: () => barberService.getBarbers(),
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero Section */}
      <section className="relative h-64 rounded-3xl overflow-hidden bg-primary flex items-center px-8 md:px-12">
        <div className="relative z-10 max-w-md space-y-4">
          <h2 className="text-4xl font-bold text-white leading-tight">
            Find your perfect <span className="text-accent">style</span> today.
          </h2>
          <p className="text-neutral-400">Book top-rated barbers in your city with just a few taps.</p>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 pointer-events-none">
           <img 
            src="https://picsum.photos/seed/barber/800/600" 
            alt="" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
           />
        </div>
      </section>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search barbers, shops, or styles..." 
            className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-accent/20 transition-all"
          />
        </div>
        <button className="flex items-center justify-center gap-2 px-6 py-4 bg-white rounded-2xl shadow-sm font-medium hover:bg-stone-50 transition-colors">
          <SlidersHorizontal className="w-5 h-5" />
          Filters
        </button>
      </div>

      {/* Barber List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">Featured Barbers</h3>
          <button className="text-accent font-semibold text-sm hover:underline">View All</button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-80 bg-stone-200 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : !barbers || barbers.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-dashed border-stone-200 text-center space-y-4">
            <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-8 h-8 text-stone-300" />
            </div>
            <div>
              <p className="font-bold text-lg">No barbers found</p>
              <p className="text-neutral-500">Try adjusting your filters or search terms.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {barbers?.map((barber) => (
              <motion.div
                key={barber.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5 }}
                onClick={() => navigate(`/barber/${barber.id}`)}
                className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer border border-stone-100"
              >
                <div className="h-48 relative overflow-hidden">
                  <img 
                    src={`https://picsum.photos/seed/${barber.id}/400/300`} 
                    alt={barber.display_name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-bold">{barber.rating_avg || 'New'}</span>
                  </div>
                </div>
                <div className="p-6 space-y-3">
                  <div>
                    <h4 className="font-bold text-lg leading-tight">{barber.display_name}</h4>
                    <p className="text-neutral-500 text-sm">{barber.shop_name}</p>
                  </div>
                  <div className="flex items-center gap-1 text-neutral-400 text-sm">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{barber.address_text}</span>
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-stone-200 overflow-hidden">
                          <img src={`https://i.pravatar.cc/100?u=${i}`} alt="" />
                        </div>
                      ))}
                      <div className="w-6 h-6 rounded-full border-2 border-white bg-stone-100 flex items-center justify-center text-[8px] font-bold text-neutral-400">
                        +12
                      </div>
                    </div>
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                      {barber.experience_years}y Exp
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
