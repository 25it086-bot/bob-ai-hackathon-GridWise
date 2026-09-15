import axios from "axios";
import { env } from "@/config/env";

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// Request ID for tracing
apiClient.interceptors.request.use((config) => {
  config.headers["X-Request-ID"] = crypto.randomUUID();
  return config;
});

// Normalize responses
apiClient.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const apiErr = err.response?.data?.error ?? {
      code: "NETWORK_ERROR",
      message: err.message ?? "Network error",
    };
    return Promise.reject(apiErr);
  }
);
