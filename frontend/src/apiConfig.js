// Centralised API base URL — reads from Vite env at build time.
// In development:  defaults to http://localhost:4000/api
// In production :  set VITE_API_BASE in your .env or hosting env vars.
export const API_BASE =
  import.meta.env.VITE_API_BASE || 'https://google-2k-1.onrender.com/api';
