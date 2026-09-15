/// <reference types="vite/client" />

export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1",
  appVersion: import.meta.env.VITE_APP_VERSION ?? "1.0.0",
  appEnv: import.meta.env.VITE_APP_ENV ?? "development",
} as const;
