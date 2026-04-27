# ReliefMesh – Web Dashboard & API

An emergency response platform with a React web dashboard and Express/MongoDB backend API.

## Project Structure

```
Website/
├── frontend/          # Vite + React web dashboard
│   ├── src/
│   │   ├── pages/     # Route pages (CitizenMap, Admin, Reports, etc.)
│   │   ├── components/# Shared components (GlobalNav, AdminPanel, etc.)
│   │   ├── utils/     # BLE mesh, crypto, AI, team seeding
│   │   ├── data/      # Fallback location data
│   │   ├── config.js  # Firebase & API keys
│   │   ├── apiConfig.js # Centralised API base URL
│   │   └── firebase.js
│   ├── public/        # PWA manifest, service worker, icons
│   └── .env           # Frontend environment variables
├── backend/           # Express + MongoDB API server
│   ├── routes/        # /api/reports, /api/locations
│   ├── models/        # Mongoose schemas
│   ├── index.js       # Server entry (serves frontend in production)
│   └── .env           # Backend environment variables
└── package.json       # Root scripts for unified dev/build/deploy
```

## Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **MongoDB** running locally (or a remote URI)

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Development mode
Runs the backend API and Vite dev server concurrently:
```bash
npm install          # install root devDependencies (concurrently)
npm run dev
```
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

### 3. Production build & start
```bash
npm run deploy
```
This builds the React frontend and starts the Express server which serves both the API and the static frontend on port 4000.

## Environment Variables

### Frontend (`frontend/.env`)
| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE` | Backend API base URL | `http://localhost:4000/api` |

### Backend (`backend/.env`)
| Variable | Description | Default |
|---|---|---|
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/sos_reports` |
| `PORT` | Server port | `4000` |

## Deployment

### Option A: Single server (recommended)
1. Build the frontend: `npm run build`
2. Start the server: `npm start`
3. The Express server serves both the API and the built frontend on the same port.

### Option B: Separate hosting
- Deploy `frontend/` to any static hosting (Vercel, Netlify, etc.)
  - Set `VITE_API_BASE` to your backend URL
- Deploy `backend/` to a Node.js host (Railway, Render, etc.)
  - Set `MONGO_URI` to your MongoDB Atlas connection string

## Tech Stack
- **Frontend**: React 19, Vite, React Router, Leaflet, Firebase, TanStack Query, Lucide Icons
- **Backend**: Express 5, Mongoose 9, MongoDB
- **Auth & Realtime**: Firebase Auth, Firestore, Realtime Database
