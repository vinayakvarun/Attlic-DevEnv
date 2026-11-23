# attlic - Setup, Configuration & Cloud Run Deployment Guide

## 1. Environment Variables & Configuration
Define environment variables in `.env` based on `.env.example`:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Firebase Project Credentials (from firebase-applet-config.json)
VITE_FIREBASE_PROJECT_ID=gen-lang-client-0545259304
VITE_FIREBASE_APP_ID=1:327850521389:web:1b28314029bb9b969e59a4
VITE_FIREBASE_API_KEY=AIzaSyDXX_leu3IQePDfdAX2ZCAId8ARKpa6oAo
VITE_FIREBASE_AUTH_DOMAIN=gen-lang-client-0545259304.firebaseapp.com
VITE_FIREBASE_STORAGE_BUCKET=gen-lang-client-0545259304.firebasestorage.app
VITE_FIREBASE_FIRESTORE_DATABASE_ID=ai-studio-398d1008-1eb6-448a-908f-12937fcc37fc

# Google OAuth Client
VITE_GOOGLE_OAUTH_CLIENT_ID=327850521389-mjp9aip6a9mqqt4h4b9v34nnkd69fgtv.apps.googleusercontent.com
```

---

## 2. Firebase & Cloud Firestore Setup
1. **Google Cloud Console**: Ensure the Firebase Firestore database `ai-studio-398d1008-1eb6-448a-908f-12937fcc37fc` is active in `gen-lang-client-0545259304`.
2. **Deploy Security Rules**:
   Rules are stored in `firestore.rules`. Deploy using:
   ```bash
   firebase deploy --only firestore:rules
   ```
   (In AI Studio Build, deployed automatically via `fax.DeployRules` RPC).

---

## 3. Google OAuth & Google Forms API Setup
1. **Google Cloud Console Credentials**:
   - Go to **APIs & Services** > **OAuth consent screen**.
   - Set Application Name to `attlic`.
   - Add authorized origins: `https://<YOUR_DEPLOYED_DOMAIN>`.
   - Under **Scopes**, add:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `https://www.googleapis.com/auth/forms.body.readonly` (for Forms API import).
2. **Simplified Import**:
   attlic includes a **Simple Link Importer** (`/api/google-forms/extract-simple`) that extracts questions directly from public form URLs without requiring recruiters to configure OAuth tokens.

---

## 4. Google Cloud Run Deployment Guide

### Step 1: Build Container
Create a production container image using Google Cloud Build:
```bash
gcloud builds submit --tag gcr.io/gen-lang-client-0545259304/attlic-engine:latest
```

### Step 2: Deploy to Cloud Run
```bash
gcloud run deploy attlic \
  --image gcr.io/gen-lang-client-0545259304/attlic-engine:latest \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production,PORT=3000
```

### Step 3: Production Build Command
Before starting the Express server, compile the frontend assets:
```bash
npm run build
npm start # runs "tsx server.ts" which serves dist/ statically
```
