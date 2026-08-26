import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const EFFECTIVE_DATE = '16 August 2026';

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[16px] font-bold text-ink tracking-tight mt-8 mb-2">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] leading-[22px] text-[#514e59] mb-3">{children}</p>;
}

function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-[14px] leading-[22px] text-[#514e59] mb-2 pl-1 marker:text-[#a09cab]">
      {children}
    </li>
  );
}


// The legal text is split by section heading only. It is a legal document, so
// not one word of it has been touched — the split exists purely so that no
// single function runs past the length limit, and so a section can be found by
// name instead of by scrolling.

function TermsSectionsOneToFour() {
  return (
    <>
      <P>
        These terms are the agreement between you and Shorter. Shorter is operated by HTF Solutions
        (Hotel Fit Solutions) on behalf of Shorter (Armen Haroutunian). By creating an account or
        using the app, you agree to them. If you do not agree, do not use Shorter.
      </P>

      <H>1. What Shorter is</H>
      <P>
        Shorter is a marketplace. It helps customers find barbers, request a booking, and pay a
        booking fee. We are not a barbershop and we do not cut hair.
      </P>
      <P>
        Barbers on Shorter are independent — they are not our employees, agents, partners or
        contractors. They set their own services, prices and availability, and they are solely
        responsible for the haircut or service they provide, for their own licensing, insurance,
        tax and safety obligations, and for complying with the law. The contract for the haircut is
        between the customer and the barber. Shorter is not a party to it.
      </P>

      <H>2. Eligibility and your account</H>
      <ul className="list-disc pl-5 mb-3">
        <LI>You must be at least 16 years old to have a Shorter account.</LI>
        <LI>
          The details you give us — name, email, phone number and, for barbers, profile and service
          details — must be true and kept up to date.
        </LI>
        <LI>
          You are responsible for your password and for everything done through your account. Tell
          us straight away if you think someone else has access to it.
        </LI>
        <LI>One person, one account. Do not let someone else use yours.</LI>
      </ul>

      <H>3. Bookings and the booking fee</H>
      <P>
        When you request a booking, the barber decides whether to accept it. A booking fee is
        authorised and charged through Stripe. That fee is what you pay Shorter for using the
        platform.
      </P>
      <P>
        The price of the haircut itself is set by the barber and is paid directly to the barber at
        the appointment, outside the app. Shorter does not collect it, does not guarantee it, and
        is not responsible for disputes about it.
      </P>

      <H>4. Cancellations, no-shows and refunds</H>
      <ul className="list-disc pl-5 mb-3">
        <LI>
          <strong className="text-ink">Barber declines or cancels.</strong> If a barber declines
          your request or cancels a confirmed booking, your booking fee is refunded in full.
        </LI>
        <LI>
          <strong className="text-ink">You cancel.</strong> You can cancel a booking in the app. If
          you cancel well before the appointment, we will refund the booking fee. Cancelling close
          to the appointment time may mean the booking fee is not refunded, because the barber has
          already held that slot for you.
        </LI>
        <LI>
          <strong className="text-ink">No-show.</strong> If you do not turn up, the booking fee is
          not refunded. If the barber does not turn up, report it in the app and we will refund the
          booking fee.
        </LI>
        <LI>
          Refunds are returned to the payment method you used, through Stripe. Timing depends on
          your bank.
        </LI>
      </ul>
      <P>
        Nothing here limits your rights under the Australian Consumer Law, including guarantees
        that cannot be excluded.
      </P>
    </>
  );
}

function TermsSectionsFiveToEight() {
  return (
    <>
      <H>5. Barber verification — what it does and does not mean</H>
      <P>
        We ask barbers to submit identity or licence documents and we review them. This is a basic
        check, not a guarantee. A "verified" badge means we have seen documents that appear
        genuine. It is not a warranty about a barber's skill, qualifications, insurance, conduct,
        or the quality or safety of their work, and it is not a police check. Use your own judgment
        before booking, and read the reviews.
      </P>

      <H>6. Acceptable use</H>
      <P>You agree not to:</P>
      <ul className="list-disc pl-5 mb-3">
        <LI>impersonate anyone, or give false or misleading profile or service information;</LI>
        <LI>harass, threaten, abuse or discriminate against another user;</LI>
        <LI>post reviews that are fake, paid for, or not based on a real booking;</LI>
        <LI>upload photos you do not own the rights to, or that are obscene or unlawful;</LI>
        <LI>
          use Shorter to arrange anything unlawful, or to take bookings off-platform to avoid the
          booking fee;
        </LI>
        <LI>
          scrape, reverse engineer, overload or interfere with the app, or try to access accounts
          or data that are not yours.
        </LI>
      </ul>

      <H>7. Content you upload</H>
      <P>
        You keep ownership of the photos and text you upload. By uploading them you give Shorter a
        non-exclusive, worldwide, royalty-free licence to host, store, resize and display that
        content inside the app for the purpose of operating and promoting the Shorter service. You
        confirm you have the right to grant that licence — including permission from anyone
        identifiable in a photo. The licence ends when you remove the content or delete your
        account, except for copies we are legally required to keep or that remain in routine
        backups for a short period.
      </P>
      <P>
        We may remove content that breaches these terms, and we may remove or refuse reviews that
        are abusive or clearly not genuine.
      </P>
    </>
  );
}

function TermsSectionsNineToTwelve() {
  return (
    <>
      <H>8. Liability</H>
      <P>
        Shorter is provided "as is". We do not promise the app will always be available or
        error-free, and we do not guarantee the conduct, punctuality, skill or safety of any user.
      </P>
      <P>
        To the maximum extent the law allows, Shorter is not liable for the acts or omissions of
        barbers or customers, for the quality or outcome of any haircut or service, for injury,
        loss or damage arising from an appointment, or for indirect or consequential loss. Where
        liability cannot be excluded, our total liability to you for any claim is limited to the
        booking fees you paid us in the twelve months before the claim, or (where the Australian
        Consumer Law applies) to resupplying the service or paying the cost of having it resupplied.
      </P>

      <H>9. Suspension and termination</H>
      <P>
        You can stop using Shorter at any time and delete your account from your profile settings.
        We can suspend or terminate an account that breaches these terms, that we reasonably believe
        is being used fraudulently, or that puts other users at risk. Where it is reasonable to do
        so, we will tell you why. Any booking fee already earned for a completed booking is not
        refunded on termination.
      </P>

      <H>10. Changes to these terms</H>
      <P>
        We may update these terms as the service changes. The effective date at the top will change
        when we do, and we will notify you in the app or by email before a material change takes
        effect. If you keep using Shorter after that, you accept the new terms.
      </P>

      <H>11. Governing law</H>
      <P>
        These terms are governed by the laws of New South Wales, Australia. You and Shorter submit
        to the non-exclusive jurisdiction of the courts of New South Wales.
      </P>

      <H>12. Contact</H>
      <P>
        Questions about these terms: email{' '}
        <a className="text-ink font-semibold underline" href="mailto:Armen@getshorter.app">
          Armen@getshorter.app
        </a>
        .
      </P>
    </>
  );
}

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white pb-16">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-5 pt-14 pb-4 flex items-center gap-3 border-b border-[#d4d2e3]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-surface rounded-lg transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-ink" />
        </button>
        <h1 className="text-[16px] font-bold">Terms of Service</h1>
      </div>

      <div className="px-5 pt-6 max-w-[393px] mx-auto">
        <div className="rounded-xl bg-[#f2f1fa] px-4 py-3 mb-6">
          <p className="text-[12px] font-semibold text-ink">Shorter — Terms of Service</p>
          <p className="text-[12px] text-[#a09cab] mt-0.5">Effective {EFFECTIVE_DATE}</p>
        </div>

        <TermsSectionsOneToFour />

        <TermsSectionsFiveToEight />

        <TermsSectionsNineToTwelve />

        <button
          type="button"
          onClick={() => navigate('/privacy')}
          className="w-full mt-8 py-4 rounded-full border border-[#d4d2e3] text-[14px] font-semibold text-ink hover:bg-surface transition-colors"
        >
          Read the Privacy Policy
        </button>
      </div>
    </div>
  );
}
