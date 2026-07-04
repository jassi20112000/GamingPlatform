# DoremonKing

DoremonKing skill-gaming platform with:

- React frontend
- Node.js/Express backend
- File-backed JSON database for MVP testing
- Login/signup with JWT
- Wallet ledger and admin-controlled manual real-money mode
- Fair 1v1 escrow match flow
- TDS/GST ledger fields for compliance review
- Manual real-money mode disabled by default
- Admin panel
- Capacitor setup for Android and iOS apps

## Run Locally

```bash
npm run install:all
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:4000

## Access Accounts

Admin:

- Email: `admin@doremonking.app`
- User ID: `ADMIN`
- Password: `Admin@12345`

Member:

- Email: `member@doremonking.app`
- User ID: `MEMBER`
- Password: `Member@12345`

Create new users from the signup page.

## Signup OTP / Forgot Password

Signup and forgot password now use a 6 digit OTP.

For Telegram bot delivery, add these environment variables on Render:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID=your_admin_chat_id
```

If Telegram is not configured yet, the app shows a temporary setup OTP so testing does not stop. Configure Telegram before public launch.

## Legal/Compliance Mode

Manual real-money mode is disabled by default until written approval:

```text
manualRealMoneyMode = false
complianceStatus = pending_written_legal_approval
```

Only enable it from the admin panel after written lawyer/CA/payment-gateway approval is available.

Required before public real-money launch:

- 18+ age gate and KYC provider
- Approved payment gateway and webhook reconciliation
- State-wise legal review
- GST and TDS reporting process
- Responsible gaming limits and grievance workflow
- Privacy policy, terms, refund policy, and fair-play rules

## Android APK / AAB

After installing Android Studio and accepting SDK licenses:

```bash
cd frontend
npm run build
npm run android:sync
npm run android:open
```

Then build APK/AAB from Android Studio.

Current Windows blocker if APK build fails:

```text
JAVA_HOME must point to a valid JDK installation.
```

## iOS App

iOS builds require macOS with Xcode and an Apple Developer account.

On a Mac:

```bash
cd frontend
npm install
npm run build
npm run ios:add
npm run ios:sync
npm run ios:open
```

Then archive/sign the app in Xcode for TestFlight/App Store.

## Mobile Login

The Capacitor app points to the hosted website:

```text
https://gaming-platform-jassi20112000s-projects.vercel.app
```

So Android and iOS users use the same login/signup backend as the web app.

## Deployment

Recommended free stack:

- Frontend: Vercel
- Backend: Render
- Database: Supabase/PostgreSQL for production

This version uses a local file database for MVP testing. Before real users, replace it with Supabase/PostgreSQL or another managed database.
