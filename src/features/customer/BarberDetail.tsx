import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { barberService } from '@/services/api';
import { Star, MapPin, Clock, ChevronLeft, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency } from '@/lib/utils';
import { BarberProfile } from '@/types';

export default function BarberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: barber, isLoading } = useQuery<BarberProfile>({
    queryKey: ['barber', id],
    queryFn: () => barberService.getBarberDetail(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8 text-center">Loading barber details...</div>;
  if (!barber) return <div className="p-8 text-center">Barber not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <div className="relative h-80 rounded-3xl overflow-hidden">
        <img 
          src={`https://picsum.photos/seed/${barber.id}/1200/800`} 
          alt="" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{barber.display_name}</h1>
                <p className="text-neutral-500 text-lg">{barber.shop_name}</p>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full font-bold">
                  <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                  {barber.rating_avg}
                </div>
                <p className="text-xs text-neutral-400 mt-1">{barber.rating_count} reviews</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
              <div className="flex items-center gap-2 bg-stone-100 px-3 py-2 rounded-xl">
                <MapPin className="w-4 h-4 text-accent" />
                {barber.address_text}
              </div>
              <div className="flex items-center gap-2 bg-stone-100 px-3 py-2 rounded-xl">
                <Clock className="w-4 h-4 text-accent" />
                9:00 AM - 6:00 PM
              </div>
            </div>

            <div className="pt-4">
              <h3 className="font-bold text-lg mb-2">About</h3>
              <p className="text-neutral-600 leading-relaxed">
                {barber.bio || "No bio available for this barber."}
              </p>
            </div>
          </div>

          {/* Services */}
          <div className="space-y-4">
            <h3 className="font-bold text-xl">Services</h3>
            <div className="grid gap-4">
              {barber.services?.map((service: any) => (
                <div 
                  key={service.id}
                  className="bg-white p-5 rounded-3xl border border-stone-100 shadow-sm flex items-center justify-between hover:border-accent/30 transition-all group"
                >
                  <div className="space-y-1">
                    <h4 className="font-bold text-lg">{service.name}</h4>
                    <div className="flex items-center gap-3 text-sm text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {service.duration_minutes} mins
                      </span>
                      <span className="w-1 h-1 bg-stone-300 rounded-full" />
                      <span>{service.description || 'Standard service'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary mb-2">{formatCurrency(service.price)}</p>
                    <button 
                      onClick={() => navigate(`/book/${barber.id}/${service.id}`)}
                      className="bg-primary text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-neutral-800 transition-all active:scale-95"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Quick Actions / Stats */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-6">
            <h3 className="font-bold text-lg">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-stone-50 p-4 rounded-2xl text-center">
                <p className="text-2xl font-bold text-primary">{barber.experience_years}+</p>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Years Exp</p>
              </div>
              <div className="bg-stone-50 p-4 rounded-2xl text-center">
                <p className="text-2xl font-bold text-primary">500+</p>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Cuts</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-neutral-600">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Verified Professional
              </div>
              <div className="flex items-center gap-3 text-sm text-neutral-600">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Sanitized Equipment
              </div>
              <div className="flex items-center gap-3 text-sm text-neutral-600">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Instant Confirmation
              </div>
            </div>
          </div>

          <div className="bg-accent/10 p-6 rounded-3xl border border-accent/20 space-y-4">
            <h3 className="font-bold text-lg text-accent">Special Offer</h3>
            <p className="text-sm text-neutral-700">Get 10% off your first booking with this barber using code <span className="font-bold">FIRSTCUT</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
