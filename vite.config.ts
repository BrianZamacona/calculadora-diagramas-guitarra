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
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ws:; img-src 'self' data:; base-uri 'self'; form-action 'self'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}