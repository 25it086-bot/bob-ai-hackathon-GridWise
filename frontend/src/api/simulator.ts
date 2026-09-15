import { apiClient } from "./client";
import type { SimulatorInput, SimulatorResult } from "@/types/simulator";

export const simulatorApi = {
  /** POST /simulator/score — stateless, does not modify stored scores */
  score: (payload: SimulatorInput): Promise<SimulatorResult> =>
    apiClient.post("/simulator/score", payload),
};
