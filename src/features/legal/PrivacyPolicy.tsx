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

// The policy is one long legal document. It is broken into components by its own
// numbered headings so that no single function in this file is longer than a
// person can read in one go, and so a lawyer's amendment to one clause lands in
// one small place. The wording is the client's and is not ours to touch.

function PolicyBanner() {
  return (
    <div className="rounded-xl bg-[#f2f1fa] px-4 py-3 mb-6">
      <p className="text-[12px] font-semibold text-ink">Shorter — Privacy Policy</p>
      <p className="text-[12px] text-[#a09cab] mt-0.5">Effective {EFFECTIVE_DATE}</p>
    </div>
  );
}

function PolicyIntroduction() {
  return (
    <>
      <P>
        Shorter is an app that connects customers with barbers. This policy explains what personal
        information we collect, why we collect it, who we share it with, and the choices you have.
        We handle personal information in line with the Australian Privacy Principles under the
        Privacy Act 1988 (Cth).
      </P>
      <P>
        Shorter is operated by HTF Solutions (Hotel Fit Solutions) on behalf of Shorter (Armen
        Haroutunian). In this policy, "we", "us" and "Shorter" mean the Shorter service and its
        operator.
      </P>
    </>
  );
}

function SectionWhatWeCollect() {
  return (
    <>
      <H>1. What we collect and why</H>
      <P>We only collect what the app actually needs to work.</P>
      <ul className="list-disc pl-5 mb-3">
        <LI>
          <strong className="text-ink">Account details</strong> — your email address, full name,
          phone number, a password (which we store only as a bcrypt hash, never in plain text) and
          whether your account is a customer or a barber. We need these to create your account,
          sign you in, and let a barber and a customer identify and contact each other about a
          booking.
        </LI>
        <LI>
          <strong className="text-ink">Barber profile information</strong> — if you sign up as a
          barber: your bio, shop name, address, whether you work at a shop or travel to customers,
          your services and prices, and your availability. This is shown to customers so they can
          find and book you.
        </LI>
        <LI>
          <strong className="text-ink">Location</strong> — precise latitude and longitude. For
          barbers, this is the location where you provide your service. For customers, we use your
          device location to show nearby barbers and calculate distance. See section 2.
        </LI>
        <LI>
          <strong className="text-ink">Images</strong> — your profile photo and, for barbers, work
          gallery photos you upload.
        </LI>
        <LI>
          <strong className="text-ink">Verification documents</strong> — for barbers, images of
          identity or licence documents you submit so we can check you are who you say you are.
          See section 4.
        </LI>
        <LI>
          <strong className="text-ink">Booking and review data</strong> — the bookings you make or
          accept, their status and history, and any ratings and reviews you leave or receive.
        </LI>
        <LI>
          <strong className="text-ink">Payment records</strong> — a record that a booking fee was
          authorised or charged, and the identifiers Stripe gives us. See section 5.
        </LI>
      </ul>
      <P>
        We do not use advertising SDKs, analytics SDKs or third-party trackers, and we do not sell
        your personal information to anyone.
      </P>
    </>
  );
}

function SectionsLocationAndLegalBasis() {
  return (
    <>
      <H>2. Precise location, and how to turn it off</H>
      <P>
        Shorter asks for your device's precise location (latitude and longitude). We use it for one
        thing: showing you barbers near you and how far away they are. Barbers' service locations
        are shown to customers so a customer can decide whether a barber is close enough to book.
      </P>
      <P>
        You can refuse the location permission when the app asks, and you can withdraw it at any
        time in your device settings (on iOS: Settings → Privacy &amp; Security → Location Services
        → Shorter). If you turn it off, the app still works, but nearby-barber results and distance
        figures will be unavailable or less accurate. Addresses are converted to map coordinates
        using OpenStreetMap's Nominatim service.
      </P>

      <H>3. Legal basis for handling your information</H>
      <P>
        We collect and use your personal information because it is reasonably necessary to provide
        the Shorter service to you — that is, to create your account, run the marketplace, process
        the booking fee, verify barbers, and keep the platform safe. Where we ask for something
        that is not strictly necessary (for example, your precise location or an optional photo),
        we do it with your consent, and you can withdraw that consent as described in this policy.
        Some records are kept because we are required to keep them by Australian law.
      </P>
    </>
  );
}

function SectionsPhotosAndPayments() {
  return (
    <>
      <H>4. Photos and verification documents</H>
      <P>
        Photos you upload (profile and work gallery) are stored on our servers and are visible in
        the app — a barber's profile photo and gallery are public to customers browsing the app.
      </P>
      <P>
        Barber verification documents (for example a photo of an ID or licence) are handled
        differently: they are used only to verify identity, they are never shown to customers or
        other users, and access is limited to the people who carry out verification. We keep a
        verification document only for as long as needed to complete and evidence the check, and we
        delete it when it is no longer needed for that purpose or for a legal obligation. We do not
        run facial recognition or any other biometric matching on these images.
      </P>

      <H>5. Payments</H>
      <P>
        Booking fees are processed by Stripe. Card details are entered into and handled by Stripe —
        Shorter never receives or stores your card number, expiry or security code. Stripe is an
        independent controller of the payment data it collects; its handling is governed by
        Stripe's own privacy policy at{' '}
        <a
          className="text-ink font-semibold underline"
          href="https://stripe.com/au/privacy"
          target="_blank"
          rel="noreferrer noopener"
        >
          stripe.com/au/privacy
        </a>
        . The haircut itself is paid by you directly to the barber, outside the app; Shorter is not
        involved in that payment and does not collect information about it.
      </P>
    </>
  );
}

function SectionsSharingStorageRetention() {
  return (
    <>
      <H>6. Who else sees your information</H>
      <ul className="list-disc pl-5 mb-3">
        <LI>
          <strong className="text-ink">Other users</strong> — when a booking is made, the customer
          and the barber see the details needed to carry it out (name, contact details, service,
          time and location). A barber's public profile, photos, ratings and reviews are visible to
          customers in the app.
        </LI>
        <LI>
          <strong className="text-ink">Stripe</strong> — for processing the booking fee.
        </LI>
        <LI>
          <strong className="text-ink">OpenStreetMap (Nominatim)</strong> — receives address or
          coordinate queries to render maps and geocode addresses.
        </LI>
        <LI>
          <strong className="text-ink">Our hosting provider</strong> — Contabo, which operates the
          servers our database and files sit on.
        </LI>
        <LI>
          <strong className="text-ink">Law enforcement or regulators</strong> — only where we are
          required or authorised by law.
        </LI>
      </ul>

      <H>7. Where your information is stored</H>
      <P>
        Your account data is stored in a PostgreSQL database, and uploaded images on the same
        server's file system, hosted with Contabo in Germany. That means your personal information
        is transferred to and stored outside Australia. Germany is subject to the EU General Data
        Protection Regulation, which provides protections broadly comparable to the Australian
        Privacy Principles. Stripe may also process payment data in other countries in which it
        operates.
      </P>

      <H>8. How long we keep it</H>
      <ul className="list-disc pl-5 mb-3">
        <LI>
          Account, profile, photos and booking history — kept while your account is open, and
          deleted when you delete your account (see section 9).
        </LI>
        <LI>
          Barber verification documents — kept only as long as needed to complete and evidence the
          verification, then deleted.
        </LI>
        <LI>
          Records of booking fees and other transactions — kept for as long as Australian tax and
          financial record-keeping law requires (generally five years), even after account
          deletion.
        </LI>
      </ul>
    </>
  );
}

function SectionsRightsChildrenStorage() {
  return (
    <>
      <H>9. Deleting your account and your rights</H>
      <P>
        You can ask us to delete your account at any time, using the contact details in section
        12. We will remove your profile, your photos, your services and your booking history from
        the app. It cannot be undone, and it does not remove records we are legally required to
        retain (see section 8).
      </P>
      <P>You may also ask us to:</P>
      <ul className="list-disc pl-5 mb-3">
        <LI>give you access to the personal information we hold about you;</LI>
        <LI>correct information that is wrong, out of date or incomplete;</LI>
        <LI>delete information, where we are not required to keep it; or</LI>
        <LI>explain how we have handled your information.</LI>
      </ul>
      <P>
        Email us at{' '}
        <a className="text-ink font-semibold underline" href="mailto:Armen@getshorter.app">
          Armen@getshorter.app
        </a>{' '}
        and we will respond within 30 days. If you are not satisfied with our response, you can
        complain to the Office of the Australian Information Commissioner at oaic.gov.au.
      </P>

      <H>10. Children</H>
      <P>
        Shorter is not intended for people under 16. We do not knowingly create accounts for, or
        collect personal information from, anyone under 16. If you believe a person under 16 has
        created an account, contact us and we will delete it.
      </P>

      <H>11. Cookies and on-device storage</H>
      <P>
        Shorter does not use advertising or tracking cookies. After you sign in, we store an
        authentication token in your browser's or app's local storage so you stay signed in
        between sessions, along with a small amount of app preference data. Signing out or deleting
        your account clears the token. We do not use this storage to track you across other apps or
        websites.
      </P>
    </>
  );
}

function SectionsSecurityChangesContact() {
  return (
    <>
      <H>12. Security</H>
      <P>
        Passwords are stored only as bcrypt hashes. Traffic between the app and our servers is
        encrypted in transit using HTTPS. Access to the database and to verification documents is
        restricted to the people who need it to operate the service. No system is completely
        secure, so we cannot guarantee absolute security — but if a data breach happens that is
        likely to cause you serious harm, we will notify you and the Office of the Australian
        Information Commissioner as required by the Notifiable Data Breaches scheme.
      </P>

      <H>13. Changes to this policy</H>
      <P>
        We may update this policy as the app changes. The effective date at the top will change
        when we do. If a change materially affects how we handle your personal information, we will
        tell you in the app or by email before it takes effect. Continuing to use Shorter after a
        change means you accept the updated policy.
      </P>

      <H>14. Contact us</H>
      <P>
        Questions, requests or privacy complaints: email{' '}
        <a className="text-ink font-semibold underline" href="mailto:Armen@getshorter.app">
          Armen@getshorter.app
        </a>
        . Shorter is operated by HTF Solutions (Hotel Fit Solutions). This policy is governed by the
        laws of New South Wales, Australia.
      </P>
    </>
  );
}

export default function PrivacyPolicy() {
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
        <h1 className="text-[16px] font-bold">Privacy Policy</h1>
      </div>

      <div className="px-5 pt-6 max-w-[393px] mx-auto">
        <PolicyBanner />

        <PolicyIntroduction />

        <SectionWhatWeCollect />

        <SectionsLocationAndLegalBasis />

        <SectionsPhotosAndPayments />

        <SectionsSharingStorageRetention />

        <SectionsRightsChildrenStorage />

        <SectionsSecurityChangesContact />

        <button
          type="button"
          onClick={() => navigate('/terms')}
          className="w-full mt-8 py-4 rounded-full border border-[#d4d2e3] text-[14px] font-semibold text-ink hover:bg-surface transition-colors"
        >
          Read the Terms of Service
        </button>
      </div>
    </div>
  );
}
