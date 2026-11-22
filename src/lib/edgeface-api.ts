export const EDGEFACE_API = "http://127.0.0.1:8000";

export type AccessStatus = "GRANTED" | "DENIED";

export interface AccessEvent {
  id: number;
  user_id: string | null;
  user_name: string;
  timestamp: string;
  access: AccessStatus;
  recognition_distance: number | null;
  reason: string | null;
  event_type: string;
}

export interface FaceUser {
  user_id: string;
  name: string;
  details: string;
  enabled: boolean;
  face_samples: number;
  created_at: string;
  last_seen: string | null;
}

export interface DeviceStatus {
  backend_online: boolean;
  camera: { online: boolean; monitoring: boolean; message: string };
  ai: { online: boolean; engine: string; message: string };
  mqtt: { online: boolean; broker: string; message: string };
  esp32: { online: boolean; last_heartbeat: string | null; message: string };
  door: { state: "LOCKED" | "UNLOCKED" | "UNKNOWN"; updated_at: string | null };
  last_event: string | null;
}

export interface EdgeSettings {
  recognition_threshold: number;
  cooldown_seconds: number;
  camera_index: number;
  camera_width: number;
  camera_height: number;
  unlock_duration_ms: number;
  mqtt_broker: string;
  mqtt_port: number;
}

export interface AnalyticsData {
  total: number;
  granted: number;
  denied: number;
  unknown: number;
  hourly: Array<{ hour: string; granted: number; denied: number }>;
  daily: Array<{ day: string; granted: number; denied: number }>;
  users: Array<{ user_name: string; count: number }>;
}

export async function edgefaceRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${EDGEFACE_API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
    signal: init.signal ?? AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Local service returned ${response.status}`);
  }
  return (await response.json()) as T;
}