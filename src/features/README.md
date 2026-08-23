# src/features/ — screens by role

Each file is one screen (or one Figma frame family). Built verbatim from the locked 63-frame Figma export (`docs/figma-pdf-index.md` maps frames to files).

## `onboarding/`
| File | Screen |
|---|---|
| `Splash.tsx` | Launch/splash frame |
| `RoleSelect.tsx` | "I'm a customer / I'm a barber" role picker |

## `auth/`
| File | Screen |
|---|---|
| `Login.tsx` | Sign in (email + password → JWT) |
| `Signup.tsx` | Account creation with role, phone capture |

## `customer/`
| File | Screen |
|---|---|
| `LocationPermission.tsx` | Location permission primer |
| `BrowseBarbers.tsx` | Nearby barber list (SQL geo endpoint, distance/ETA) |
| `BarbersMap.tsx` | Map view of nearby barbers (Leaflet) |
| `NoBarbersAvailable.tsx` | Empty-state frame |
| `BarberProfile.tsx` / `BarberProfileTabs.tsx` | Barber detail: services, gallery, reviews tabs |
| `BookingRequest.tsx` | Choose service/date/time, submit request |
| `BookingSent.tsx` / `BookingWaiting.tsx` / `BookingRequestStatus.tsx` | Pending-request states (chat locked card) |
| `BarberDeclined.tsx` / `BookingRejected.tsx` | Decline frames |
| `PayFee.tsx` / `PaymentMethods.tsx` | Booking-fee payment (Stripe intent; 501 until keys) |
| `BookingConfirmed.tsx` / `AppointmentConfirmed.tsx` | Accepted state; chat/call v1 via native `sms:`/`tel:` |
| `BarberArriving.tsx` | Confirmed booking status with ETA, chat/call |
| `BookingHistory.tsx` | Upcoming/Past tabs of the customer's bookings |
| `RateBarber.tsx` | Post-completion review (one per completed booking) |
| `CustomerNotifications.tsx` | Notifications tab — real data from `GET /api/notifications`, marks read on open |
| `CustomerProfile.tsx` / `EditProfile.tsx` | Profile view/edit |
| `HelpSupport.tsx` | Help/support frame |

## `barber/`
| File | Screen |
|---|---|
| `BarberOnboarding.tsx` | Multi-step onboarding (resumable via `onboarding_step`): profile, services, schedule, location, verification |
| `BarberPendingVerification.tsx` | Pending/in-review/approved verification gates |
| `BarberJobs.tsx` | Incoming/Upcoming/Past jobs; chat/call v1 with customer number after acceptance |
| `IncomingRequest.tsx` / `AcceptBooking.tsx` / `DeclineBooking.tsx` | Request handling frames |
| `JobDetail.tsx` / `BarberJobArriving.tsx` / `CompleteJob.tsx` / `CancelJob.tsx` | Job lifecycle screens |
| `CustomerCancelled.tsx` | Customer-cancelled frame |
| `NoShowReport.tsx` / `ReportIssue.tsx` | Issue/no-show reporting (writes `issue_reports`) |
| `BarberAvailability.tsx` | Hours, active days, booking mode, radius, buffer |
| `BarberServices.tsx` | Service CRUD (name/price/duration) |
| `BarberProfileEdit.tsx` | Profile edit incl. avatar + gallery uploads |
| `BarberReviews.tsx` / `BarberPerformance.tsx` / `BarberWallet.tsx` | Reviews, stats, earnings frames |
| `BarberCompanyDashboard.tsx` | Company-level dashboard (multi-tenant) |

## `admin/`
| File | Screen |
|---|---|
| `AdminDashboard.tsx` | Platform admin: companies, bookings, income (all `requireAdmin` APIs) |
| `CompanyDetail.tsx` | Per-company drill-down incl. barber verification approval |

## `legal/`
| File | Screen |
|---|---|
| `PrivacyPolicy.tsx` / `Terms.tsx` | App Store-required legal pages (`/privacy`, `/terms`; static fallbacks in `public/`) |
