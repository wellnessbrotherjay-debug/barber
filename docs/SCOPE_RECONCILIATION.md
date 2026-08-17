# Shorter — Scope Reconciliation

**Prepared:** 16 August 2026
**Basis:** Technical Infrastructure & Service Agreement (Shorter x HTF Solutions, v2, August 2026 start)
**Specification of record:** the approved Figma designs — 63-frame export, indexed in `docs/figma-pdf-index.md`
**Method:** every line below was checked against three sources — (1) the approved Figma frame, (2) the live production database and API on `barber.safetykat.com`, (3) the contract clause. Nothing here is inferred from the design export alone.

---

## 1. Contract clauses this document relies on

| Clause | Effect |
|---|---|
| 3.1 | Scope = iOS/Android app, web app, backend infrastructure, admin dashboard, deployment |
| 3.2 / 14.1 | The approved Figma designs and written scope are the **primary functional and visual specification** |
| 3.3 | Anything **not** expressly in the approved Figma or written scope is **excluded** unless added by written change order |
| 3.4 | Expressly excluded: new user flows, new screens, redesigned layouts, additional dashboards, **additional roles**, **extra payment flows**, **third-party integrations not approved at kick-off**, **legal/compliance work** |
| 3.5 | Any request changing **architecture, database structure, permissions, platform requirements, user flows, checkout/payment logic, dispatch logic, security model, app store requirements, or third-party account implementation is a change order — even if described as a small change** |
| 4.4 | Approved change orders bill at **AUD $150/hour**; no work starts until quote approved and payment received |
| 8.2 | Re-quote trigger: Client changes the **business model, marketplace logic, payment model, user roles, compliance assumptions, or operating requirements after commencement** |
| 11.1 | Client is solely responsible for third-party fees including **KYC, verification, Stripe, hosting, maps** |
| 12.4 | **Compliance remediation or additional functionality required by Apple, Google or Stripe is out-of-scope and billable separately** |
| 14.2 / 14.3 | One consolidated minor-revision round included; layout, structural and user-flow changes are billable |

---

## 2. Category A — In scope, and already DELIVERED

Verified working on production. No further cost.

| Item | Evidence |
|---|---|
| All 63 Figma frames built | Every screen implemented verbatim, including duplicates and copy as drawn |
| Customer + barber accounts, roles, sign-in | bcrypt + JWT, role-gated routes, server-enforced |
| Barber profile, services, pricing | Relational `services` table, ownership-scoped CRUD |
| Availability: hours, active days, booking mode, radius, buffer | `barber_schedule` + profile columns, persisted |
| Online/offline status | `is_online`, `PATCH /api/barber/online` |
| Shop location + precise map pin | Leaflet + OpenStreetMap Nominatim geocoding, lat/lng stored |
| In-shop vs travel-to-customer mode | `service_mode` (in_shop / mobile / both) |
| Avatar + work gallery upload | Real authenticated upload, MIME + magic-byte validation, 8MB cap, ownership-scoped delete/reorder |
| Geographic discovery | SQL distance in Postgres (earthdistance + GiST index), radius filtering, distance ordering, DB-level pagination |
| Booking lifecycle | pending → confirmed → completed / cancelled / no_show |
| Accept / decline / cancel / complete | Ownership-enforced endpoints |
| Reviews + ratings | Must own a **completed** booking; one review per booking |
| Report an issue (barber/customer), no-show reporting | `issue_reports` |
| Verification document upload + admin review + statuses | `barber_verification_documents`; status enum below |
| Onboarding resume | `onboarding_step` persisted; verified on device — log out mid-flow, log back in, resume at the saved step |
| Basic admin dashboard + verification approval | `requireAdmin`-guarded |
| Multi-tenant architecture | One DB per tenant company; barbers are rows scoped `tenant → user → barber_profile` |

### A2 — Delivered, but arguably billable under clause 12.4

These were **required by Apple**, not by the Figma. Clause 12.4 makes Apple-mandated compliance work out-of-scope and billable. They have been built and delivered anyway.

| Item | Why it was required |
|---|---|
| **In-app account deletion** | Apple Guideline 5.1.1(v) — automatic rejection without it. Full flow: confirmation, active-booking guard, transactional cascade delete, upload cleanup |
| **Privacy Policy + Terms pages** | Required field in App Store Connect; live at `/privacy` and `/terms` plus static fallbacks |
| **Permission usage strings** | Location / camera / photo-library. App crashes on first use without them |
| **Native layout + safe-area work** | Content rendered under the Dynamic Island; long screens could not scroll to their submit button |
| **Richer verification statuses** | `verification_status`: unsubmitted / pending / in_review / approved / rejected — replacing a boolean, because the approved Figma itself shows Pending Review, Review in Progress and Approved |

> **Commercial note:** these are legitimately chargeable under 12.4. Recommend presenting them as **delivered at no extra cost** — it is real goodwill and makes the change-order conversation below far easier.

---

## 3. Category B — In scope, still OUTSTANDING

Contracted work not yet complete. Listing honestly so the delta is measured against a true baseline.

| Item | Status | Blocker |
|---|---|---|
| **Stripe booking fee** | `POST /api/payments/create-intent` returns **501 — Stripe not configured** | Needs Client's Stripe account + keys (clause 11.1, Client cost). Core Figma flow; cannot launch without it |
| **Chat & call** | Buttons present, labelled "coming soon"; no messaging table or endpoints exist | Figma shows these as what the booking fee unlocks. See §5 — needs a scope decision |
| **Notifications** | `notifications` table exists but unused; no endpoints, no push, no email | Figma has a Notifications screen and nav tab |
| **Android build** | iOS shell builds and runs; Android not yet generated | Clause 3.1(a) covers both platforms |
| **Customer location capture** | **No customer address/lat/lng exists anywhere** in `bookings` | Required for "come to customer" mode, which is in the Figma. See §4.1 |

---

## 4. Category C — CHANGE ORDERS (outside approved scope)

Each maps to a specific exclusion clause.

### 4.1 Approximate location until booking confirmation — **CHANGE ORDER (3.5)**
**Important factual correction:** the Figma appears to show a customer address to the barber pre-acceptance (`1242 Oakwood Ave, Silver Lake, CA 90026`), but that is **placeholder text in the design**. In the built system that field renders the **barber's own shop address**, and the `bookings` table has **no customer address, latitude or longitude columns at all**.

So there is no privacy defect to remediate. The request is to build a **new** capability: capture customer location, store approximate vs exact, gate exact behind acceptance, and enforce it at the API layer. That touches database structure, permissions, user flow and security model — four separate triggers under 3.5.

*Efficiency note:* because the field does not exist yet, building it correctly now is materially cheaper than retrofitting later. Worth quoting promptly rather than deferring.

### 4.2 Third-party identity/KYC provider — **CHANGE ORDER (3.4, 11.1)**
Approved Figma specifies manual document upload with admin review — which is built. Replacing it with Persona / Stripe Identity / Veriff is a third-party integration not approved at kick-off (3.4), requiring new webhook/callback architecture (3.5). Provider fees are the Client's (11.1).

### 4.3 Multi-role admin RBAC — **CHANGE ORDER (3.4 — "additional roles")**
Contract includes *an* admin dashboard, and role separation exists today (admin / barber / customer, server-enforced). Adding owner / support / trust & safety / finance with a permissions matrix is expressly excluded by 3.4 and is a permissions/security-model change under 3.5.

### 4.4 Immutable audit / event ledger — **PARTIAL: mostly CHANGE ORDER (3.5)**
An `audit_log` table already exists in the admin database and account deletion writes to it. A full immutable ledger of every booking transition (`requested → payment_authorized → provider_notified → accepted → address_revealed → started → completed`) is new database architecture.

### 4.5 Terms/Provider-Agreement version + acceptance records — **CHANGE ORDER (3.4, 3.5)**
Figma specifies acceptance text only, which is built and linked. Versioned agreements with immutable timestamped acceptance history is database structure (3.5) and legal/compliance work (3.4).

### 4.6 Dispute management system — **CHANGE ORDER (3.4)**
Reporting and no-show flows are built. Case assignment, evidence handling, investigation workflow, resolution, appeals and refunds are new screens and new user flows.

### 4.7 Integrated provider payments (Stripe Connect, wallets, split payments, payouts) — **CHANGE ORDER (3.4, 3.5)**
The approved model is booking fee via platform + service paid directly to the barber, stated repeatedly in the Figma. Processing the service payment is an extra payment flow (3.4) and changes checkout/payment logic (3.5). Also a payment-model change under 8.2.

**Accepted as a design principle at no cost:** the schema will not be hard-coded against this being added later. That is not a contractual deliverable.

### 4.8 18+ age gate — **DEPENDS**
Terms wording only = trivial, absorb it. An enforced age-verification step at signup is a new user flow (3.4/3.5).

### 4.9 Hairdressing / category expansion — **FUTURE PHASE**
Not in the approved Figma. Not automatically included.

---

## 5. Recommended position on chat & call

This is the one item where the Figma and reality disagree in the Client's favour, and it should be handled openly rather than argued.

The approved Figma repeatedly presents chat and call as the benefit unlocked by paying the booking fee. No messaging system was ever specified — there are no chat screens, no conversation list, no message composer in any of the 63 frames. Building real in-app messaging (with moderation, push notifications, abuse handling and retention) is a substantial system.

**Recommendation:** deliver v1 by having the unlocked Chat and Call buttons open the device's native SMS and dialler using the phone numbers both parties already provide. That honours the Figma promise, is honest to users, and is cheap. Full in-app messaging is then a clean, separately quoted change order.

---

## 6. Commercial position

1. Continue building the approved Figma and contracted architecture (§3 outstanding items).
2. All §2 items are delivered — including the Apple-mandated work that clause 12.4 would have permitted billing for.
3. §4 items are logged, priced individually, and **not started** until a written change order is approved and paid (4.4).
4. Where an item is **mandatory for App Store submission**, it is flagged as such: it must be built for launch, and it is billable under 12.4. It cannot simply be deferred without deferring launch.
5. Estimates for §4 are given once the base build is substantially complete, so they are grounded in the real codebase rather than speculation.

**Rate for all approved change-order work: AUD $150/hour (clause 4.4).**

> Per clause 4.2, scope changes are effective only via written change order approved by the Developer. This document is a classification for discussion; it is not itself approval of any additional work.
