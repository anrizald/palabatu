# Palabatu - Project Overview

## Project Purpose
A community web app for Indonesian bouldering enthusiasts. Users can discover bouldering spots on an interactive map, create climber profiles, and connect with the local community.

**Live Site:** https://palabatu.id  
**Status:** Work in Progress

---

## Tech Stack

### Frontend
- **Framework:** React 19.1.0 with TypeScript
- **Build Tool:** Vite 7.0.4
- **Styling:** Tailwind CSS 4.1.11
- **Maps:** Leaflet + React Leaflet with marker clustering
- **Animation:** Framer Motion 12.23.12
- **Routing:** React Router DOM 7.7.1
- **Image Handling:** Cloudinary, Multer
- **Auth UI:** Supabase Auth UI (pre-built components)
- **Animation Tool:** Rive.js for interactive animations

### Backend
- **Runtime:** Node.js
- **Server:** Express 5.2.1
- **Language:** TypeScript
- **Database:** PostgreSQL
- **Auth:** JWT (jsonwebtoken 9.0.3)
- **Password Hashing:** Bcrypt 6.0.0
- **Email:** Nodemailer 8.0.7
- **CORS:** Enabled for client requests
- **File Upload:** Multer 2.1.1, Cloudinary integration

### DevTools
- **Frontend Linting:** ESLint with React hooks/refresh plugins
- **Backend Dev:** ts-node-dev with auto-respawn
- **PWA Support:** vite-plugin-pwa (installable web app)

---

## Project Structure

```
kepalabatu/
├── src/                      # React frontend
│   ├── components/           # React components
│   │   ├── AddProblemModal.tsx
│   │   ├── Auth.tsx
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── ProblemDetails.tsx
│   │   ├── ProblemList.tsx
│   │   ├── HorizontalScrollCarousel.tsx
│   │   ├── PinpointMarker.tsx
│   │   └── Toast.tsx
│   ├── pages/                # Page components
│   │   ├── Landing.tsx
│   │   ├── Map.tsx
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── Auth.tsx
│   │   ├── ForgotPassword.tsx
│   │   ├── ResetPassword.tsx
│   │   ├── VerifyEmail.tsx
│   │   └── profile.tsx
│   ├── lib/
│   │   ├── api.ts            # API client with JWT auth
│   │   ├── AuthContext.tsx    # Auth state management
│   │   └── constants.ts
│   ├── types/
│   │   └── problem.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── assets/
│
├── server/                   # Express backend
│   ├── index.ts
│   ├── db/
│   │   └── client.ts         # PostgreSQL connection
│   ├── lib/
│   │   └── mailer.ts         # Email with Nodemailer
│   ├── middleware/
│   │   └── auth.ts           # JWT verification
│   └── routes/
│       ├── api.ts            # Problem CRUD endpoints
│       └── auth.ts           # Auth endpoints
│
├── public/                   # Static assets & PWA manifest
│   ├── index.html
│   ├── manifest.json
│   └── icons/
│
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── eslint.config.ts
└── package.json
```

---

## Key Data Models

### Problem (Bouldering Route)
```typescript
type NewProblem = {
    name: string              // Route name
    grade: string             // Climbing grade
    location: string          // Location name
    lat: number | null        // Latitude
    lng: number | null        // Longitude
    imageFiles: File[]        // Uploaded images
    imagePreviews: string[]   // Preview URLs
}

type ProblemRow = {
    id: string | number
    name: string
    location_name: string
    latitude: number
    longitude: number
    grade: string
    creator_name: string
    created_by: string
    image_urls?: string[]     // Cloudinary URLs
    send_count?: number       // Times completed
}
```

---

## Authentication Flow

1. **JWT-based authentication** stored in localStorage
2. **Email verification** required during signup
3. **Password reset** via email link
4. **Protected API routes** via Bearer token in Authorization header
5. **Auth middleware** validates JWT on backend

---

## API Client Architecture

- **Base URL:** `VITE_API_URL` env var (defaults to `http://localhost:3001`)
- **Methods:** `api.get()`, `api.post()`, `api.put()`, `api.upload()`
- **Auth:** JWT token automatically added to all requests
- **Image uploads:** FormData multipart requests to Cloudinary

---

## Development Scripts

### Frontend
- `npm run dev` - Vite dev server (port 5173)
- `npm run build` - Production build to dist/
- `npm run lint` - ESLint check
- `npm run preview` - Preview production build

### Backend
- `npm run dev` - ts-node-dev with auto-restart (port 3001)

---

## Environment Variables

### Frontend (.env)
- `VITE_API_URL` - Backend API URL

### Backend (.env)
- Database credentials (PostgreSQL)
- JWT secret
- Email provider credentials (Nodemailer)
- Cloudinary credentials
- CORS allowed origins

---

## Current Status & Notes

- **Status:** WIP - actively in development
- **PWA Support:** Configured but may need manifest adjustments
- **Image Hosting:** Cloudinary integrated for problem photos
- **Email:** Nodemailer configured for verification & password reset

---

## Development Workflow

1. Frontend runs on Vite dev server → uses proxy/env to reach backend
2. Backend Express server handles API routes & serves public/
3. PostgreSQL stores problems, users, auth data
4. Cloudinary stores climbing route photos
5. Nodemailer sends verification & password reset emails

---

## Common Patterns

- **Components:** Functional React components with TypeScript
- **Routing:** React Router for client-side navigation
- **State:** Context API for authentication (AuthContext)
- **Styling:** Tailwind utility classes
- **Maps:** Leaflet with marker clustering for problem locations
- **API Calls:** Centralized api.ts client
