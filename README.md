# GamingPlatform

Demo gaming platform with:

- React frontend
- Node.js/Express backend
- File-backed demo database
- Login/signup with JWT
- Demo wallet coins only
- Demo games with no real betting or real payment
- Admin panel
- Capacitor setup for Android APK

## Run Locally

```bash
npm run install:all
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:4000

## Demo Accounts

Admin:

- Email: `admin@gaming.demo`
- Password: `Admin@12345`

Create normal users from the signup page.

## Android APK

After installing Android Studio and accepting SDK licenses:

```bash
cd frontend
npm run build
npm run android:sync
npm run android:open
```

Then build APK from Android Studio.

## Deployment

Recommended free stack:

- Frontend: Vercel
- Backend: Render
- Database: Supabase/PostgreSQL for production

This demo uses a local file database for fast local testing. Before public launch, replace it with Supabase/PostgreSQL.
