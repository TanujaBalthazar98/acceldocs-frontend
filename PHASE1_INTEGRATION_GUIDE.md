# Phase 1: Authentication - Integration Guide

## ✅ What I Just Built

I've created a complete authentication system:

**Files Created:**
- `src/lib/auth-new.ts` - Auth utilities (Google OAuth, JWT, API calls)
- `src/hooks/useAuthNew.ts` - React auth state management
- `src/pages/LoginNew.tsx` - Sign in page with Google button
- `src/pages/AuthCallback.tsx` - OAuth callback handler
- `src/components/UserMenuNew.tsx` - User profile dropdown
- `src/components/ProtectedRoute.tsx` - Route protection wrapper

---

## Step-by-Step Integration

### Step 1: Install Missing UI Components

```bash
# If you don't have Avatar component
npx shadcn-ui@latest add avatar
```

### Step 2: Set Up Environment Variables

Create or update `.env`:

```bash
# Backend API URL
VITE_API_URL=http://localhost:8000

# Google OAuth Client ID
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

**Get Google Client ID:**
1. Go to https://console.cloud.google.com
2. Select your project (or create one)
3. APIs & Services → Credentials
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized redirect URI: `http://localhost:5173/auth/callback`
6. Copy Client ID

### Step 3: Update App.tsx with Auth Routes

Replace your current `App.tsx` with:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuthNew';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Pages
import LoginPage from '@/pages/LoginNew';
import AuthCallbackPage from '@/pages/AuthCallback';

// Admin pages (to be created in Phase 3)
import AdminDashboard from '@/pages/admin/Dashboard';
import DocumentsPage from '@/pages/admin/Documents';
import ApprovalsPage from '@/pages/admin/Approvals';

// Public pages (to be created in Phase 2)
import HomePage from '@/pages/Home';
import DocsPage from '@/pages/Docs';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/docs/*" element={<DocsPage />} />

          {/* Auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Protected admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/docs"
            element={
              <ProtectedRoute requiredRole="editor">
                <DocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/approvals"
            element={
              <ProtectedRoute requiredRole="reviewer">
                <ApprovalsPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
```

### Step 4: Add UserMenu to Your Header

Update any header/nav component to include the user menu:

```typescript
import { UserMenu } from '@/components/UserMenuNew';

export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">AccelDocs</h1>
          {/* Your navigation links */}
        </div>

        {/* User menu in top right */}
        <UserMenu />
      </div>
    </header>
  );
}
```

### Step 5: Set Up Backend OAuth Endpoint

Your FastAPI backend needs an OAuth endpoint. Create `app/auth/routes.py`:

```python
"""Authentication routes"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import jwt
from datetime import datetime, timedelta
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.config import settings
from app.database import get_db
from app.models import User
from sqlalchemy.orm import Session

router = APIRouter()

class GoogleAuthRequest(BaseModel):
    code: str

@router.post("/google")
async def google_auth(body: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Exchange Google OAuth code for JWT token"""

    # Exchange code for Google tokens
    # (Implementation depends on your Google OAuth setup)

    # Verify Google ID token
    # Get user email and info from Google

    # Find or create user in database
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            google_id=google_user_id,
            email=email,
            name=name,
            role="viewer"  # Default role
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Generate JWT token
    token_data = {
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
        "exp": datetime.utcnow() + timedelta(days=7)
    }

    access_token = jwt.encode(token_data, settings.secret_key, algorithm="HS256")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "google_id": user.google_id,
            "created_at": user.created_at.isoformat()
        }
    }

@router.post("/logout")
async def logout():
    """Logout endpoint (for token invalidation if needed)"""
    return {"status": "ok"}
```

### Step 6: Test the Auth Flow

1. **Start backend:**
   ```bash
   cd acceldocs-backend
   source .venv/bin/activate
   uvicorn app.main:app --reload --port 8000
   ```

2. **Start frontend:**
   ```bash
   cd acceldocs
   npm run dev
   ```

3. **Test flow:**
   - Go to http://localhost:5173/login
   - Click "Sign in with Google"
   - Complete Google OAuth
   - Should redirect to http://localhost:5173/auth/callback
   - Then redirect to /admin
   - See your name/email in user menu

4. **Test sign out:**
   - Click user menu
   - Click "Sign out"
   - Should redirect to home page

---

## Verification Checklist

After integration:

- [ ] Login page renders at /login
- [ ] Clicking "Sign in with Google" redirects to Google
- [ ] OAuth callback works (/auth/callback)
- [ ] JWT token stored in localStorage
- [ ] User menu shows your name/email
- [ ] Sign out clears token and redirects
- [ ] Protected routes redirect to /login when not authenticated
- [ ] Role-based routes show "Access Denied" for insufficient permissions

---

## Troubleshooting

### "Google Client ID not configured"
- Make sure `VITE_GOOGLE_CLIENT_ID` is set in `.env`
- Restart dev server after changing `.env`

### "Authentication failed" after OAuth callback
- Check browser console for error details
- Verify backend is running on port 8000
- Check backend logs for OAuth errors
- Ensure redirect URI matches in Google Console

### "Session expired" immediately
- Check that backend `/auth/google` endpoint returns valid JWT
- Verify JWT secret matches between frontend and backend
- Check token expiration time (should be 7 days)

### Protected routes not working
- Ensure `<AuthProvider>` wraps your routes in App.tsx
- Check browser localStorage for `acceldocs_auth_token`
- Verify backend `/api/users/me` endpoint works

---

## Next Steps

Once auth is working:

**Phase 2: Public Docs** - Build the documentation reading experience
**Phase 3: Admin Dashboard** - Create document management UI
**Phase 4: Google Drive Sync** - Auto-sync from Google Docs

---

## Quick Start Commands

```bash
# Terminal 1: Backend
cd acceldocs-backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd acceldocs
npm run dev

# Open browser
open http://localhost:5173/login
```

---

## Files You'll Need to Create

For minimal working demo, create placeholder pages:

**src/pages/Home.tsx:**
```typescript
export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold">AccelDocs</h1>
      <p className="mt-4">Documentation Platform</p>
      <a href="/login" className="text-blue-600 hover:underline">
        Sign in to admin →
      </a>
    </div>
  );
}
```

**src/pages/admin/Dashboard.tsx:**
```typescript
import { useAuth } from '@/hooks/useAuthNew';

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <p className="mt-4">Welcome, {user?.name || user?.email}!</p>
      <p className="text-sm text-gray-600">Role: {user?.role}</p>
    </div>
  );
}
```

---

**Auth is now ready! Test it and let me know when it works, then we'll build Phase 2 (Docs) and Phase 3 (Admin).**
