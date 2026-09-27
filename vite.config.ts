import { defineConfig } from "vite";

export default defineConfig({
  server: {
    headers: securityHeaders(),
  },
  preview: {
    headers: securityHeaders(),
  },
  build: {
    target: "es2022",
  },
});

function securityHeaders(): Record<string, string> {
  return {
    // blob: required for Tone.js AudioWorklets and jsPDF/MIDI file downloads
    "Content-Security-Policy": "default-src 'self'; script-src 'self' blob:; worker-src 'self' blob:; style-src 'self'; connect-src 'self' ws: blob:; img-src 'self' data: blob:; media-src blob:; base-uri 'self'; form-action 'self'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}