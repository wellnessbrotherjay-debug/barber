import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';

interface Card {
  id: string;
  brand: string;
  last4: string;
  isDefault: boolean;
}

export default function PaymentMethods() {
  const navigate = useNavigate();
  const [cards, setCards] = useState<Card[]>([
    { id: '1', brand: 'Visa', last4: '4242', isDefault: true },
  ]);
  const [adding, setAdding] = useState(false);
  const [number, setNumber] = useState('');

  const handleAdd = () => {
    const last4 = number.replace(/\D/g, '').slice(-4) || '0000';
    setCards((c) => [...c, { id: Date.now().toString(), brand: 'Card', last4, isDefault: c.length === 0 }]);
    setNumber('');
    setAdding(false);
    toast.success('Card added');
  };

  const handleRemove = (id: string) => {
    setCards((c) => c.filter((card) => card.id !== id));
    toast.success('Card removed');
  };

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-surface rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-ink" />
        </button>
        <h1 className="text-[16px] font-bold">Payment Methods</h1>
      </div>

      <div className="px-5 space-y-3">
        {cards.length === 0 && (
          <p className="text-sm text-[#a09cab] text-center py-8">No payment methods yet</p>
        )}
        {cards.map((card) => (
          <div key={card.id} className="flex items-center justify-between border border-[#d2dbe9] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-[#514e59]" />
              <div>
                <p className="text-sm font-semibold">{card.brand} •••• {card.last4}</p>
                {card.isDefault && <p className="text-xs text-[#a09cab]">Default</p>}
              </div>
            </div>
            <button type="button" onClick={() => handleRemove(card.id)} className="p-2 hover:bg-surface rounded-lg">
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        ))}

        {adding ? (
          <div className="border border-[#d2dbe9] rounded-xl p-4 space-y-3">
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Card number"
              inputMode="numeric"
              className="w-full px-4 py-3 rounded-xl bg-[#fafaff] text-sm outline-none focus:ring-2 focus:ring-ink/20"
            />
            <div className="flex gap-2">
              <Button onClick={handleAdd} className="flex-1">Add card</Button>
              <Button variant="secondary" onClick={() => setAdding(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl bg-[#fafaff] font-medium text-sm text-[#1c1b1f]"
          >
            <Plus className="w-4 h-4" /> Add payment method
          </button>
        )}
      </div>
    </div>
  );
}
