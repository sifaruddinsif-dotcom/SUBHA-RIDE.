# SUBHA RIDE — All Completed Customer Package

This package combines the customer UI with a small **dependency-free Node.js backend** so the customer flow is connected end-to-end for development/testing.

## Run

Requires Node.js 18+.

```bash
npm start
```

Then open:

`http://localhost:3000`

No `npm install` is required because the server uses Node's built-in modules only.

## Customer features

- Mobile-first premium SUBHA RIDE UI
- OTP login flow (development OTP is displayed on screen)
- Pickup/drop fields
- Device geolocation permission
- Mini Truck and Tempo / Mini selection
- Fare estimate
- `SUBHA50` coupon
- Ride booking saved to backend
- My Rides from backend
- Wallet balance + demo ₹500 top-up
- Saved Places
- Notifications screen
- Support screen
- Profile/logout
- Responsive design

## Backend API

- `GET /api/health`
- `POST /api/auth/request-otp`
- `POST /api/auth/verify-otp`
- `GET /api/me`
- `POST /api/logout`
- `GET /api/rides`
- `POST /api/rides`
- `GET /api/wallet`
- `POST /api/wallet/demo-topup`
- `GET /api/saved-places`
- `POST /api/saved-places`

Data is stored in `data.json` for this development package.

## GitHub

1. Create a repository named `subha-ride-customer`.
2. Upload the contents of this folder: `server.js`, `package.json`, `README.md`, `GITHUB_STEPS.txt`, and `public/index.html`.
3. GitHub can store the source, but GitHub Pages cannot run the Node backend. Use a Node-compatible host for the full connected version (Render, Railway, Fly.io, VPS, etc.).
4. After deploying the Node server, open its public URL to use the connected customer app.

## Production work still requiring real accounts/services

This package is an end-to-end development build, not a claim that third-party production services are already provisioned.

Before launch, connect:
- Real SMS OTP provider (Twilio/MSG91/etc.)
- Production database (PostgreSQL/MySQL/Supabase/Firebase)
- Google Maps or another maps provider + geocoding/routing
- Real driver discovery and live GPS tracking
- Payment gateway and webhook verification
- Push notifications
- Driver app and admin panel
- HTTPS, rate limiting, secure session/JWT handling, validation and audit logs
- Production fare rules, cancellation/refund logic and legal/privacy documents

Never put secret API keys in `public/index.html`.


See `PRODUCTION_SETUP.md` and `.env.example` for real-provider configuration. Third-party accounts and secret keys must be created by the owner; they are not included in the ZIP.

The wallet button now opens Razorpay Checkout when Razorpay keys are configured. Without provider credentials it will show a configuration error rather than pretending a real payment succeeded.
