import { getFeatures } from "../features.ts";

export function getFeatureFlags(): Response {
  return Response.json(getFeatures());
}
