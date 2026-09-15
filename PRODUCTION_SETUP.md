# SUBHA RIDE — Production connection checklist

This package now contains the server-side integration points for real OTP, Google Maps and Razorpay. **I cannot create or activate those third-party accounts or obtain private API keys for you from this chat.** You must create the accounts and place the secrets in your deployment environment.

### 1. Razorpay
Create a Razorpay account, generate Test keys first, then Live keys after testing. The server creates an Order and verifies the Checkout signature before crediting the wallet. Razorpay's current documentation requires server-side signature verification and recommends webhooks for production confirmation. 
Official docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/

Environment:
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET

### 2. Google Maps
Create a Google Cloud project, enable Maps JavaScript API and Routes/Geocoding as needed, create a restricted browser key, and set GOOGLE_MAPS_KEY. Google requires a Cloud project/billing setup and the relevant APIs for Routes. 
Official docs: https://developers.google.com/maps/documentation/javascript/add-google-map

### 3. MSG91 OTP
Create/configure the MSG91 OTP service, template and approved sender/channel settings. MSG91 documents Send OTP and Verify OTP as separate APIs. Set:
- MSG91_AUTHKEY
- MSG91_TEMPLATE_ID
- MSG91_SEND_URL
- MSG91_VERIFY_URL

Official docs: https://docs.msg91.com/otp

### 4. Production database
The development package currently stores data in data.json. For production, migrate users, rides, wallets, payments and driver locations to PostgreSQL/Supabase or another managed database with row-level security and backups. Supabase provides Postgres plus APIs and realtime capabilities. 
Official docs: https://supabase.com/docs/guides/api

### 5. Live driver tracking
A real tracking system needs a separate Driver App and Admin/Dispatch backend. The customer app cannot invent live driver coordinates. The driver app must periodically send GPS coordinates; the server authenticates those updates and broadcasts them to the customer's active ride.

### 6. Security before launch
- HTTPS only
- Keep all secrets server-side
- Never commit `.env`
- Rate-limit OTP/login/payment endpoints
- Validate all coordinates, fares and payment amounts server-side
- Verify Razorpay signatures before wallet credit
- Add payment webhooks/idempotency
- Use a real database and backups
- Add privacy policy, terms, cancellation/refund rules and required business/KYC compliance

## What is already connected in this package

- Real-provider configuration switches
- MSG91 OTP adapter
- Razorpay order creation + signature verification
- Google Maps key configuration endpoint
- Wallet credit only after verified Razorpay signature
- Development fallback remains available when provider credentials are not configured

Do not put secret keys in `public/index.html`.
