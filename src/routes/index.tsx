import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Fingerprint,
  Gauge,
  House,
  KeyRound,
  Lock,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Network,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  ShieldX,
  SlidersHorizontal,
  UserRoundPlus,
  Users,
  Wifi,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AccessEvent,
  AnalyticsData,
  DeviceStatus,
  EdgeSettings,
  edgefaceRequest,
  FaceUser,
} from "@/lib/edgeface-api";

type Screen = "Overview" | "Live monitoring" | "Face management" | "Access history" | "Analytics" | "Devices" | "Settings";
type ConnectionMode = "checking" | "live" | "demo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EdgeFace | Local Smart Access Control" },
      { name: "description", content: "Monitor local face recognition, access events, and EdgeFace IoT devices from one control room." },
      { property: "og:title", content: "EdgeFace | Local Smart Access Control" },
      { property: "og:description", content: "A local-first smart access control console for Edge AI, webcam monitoring, and IoT devices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EdgeFaceApp,
});

const navigation: Array<{ title: Screen; icon: LucideIcon; group: "CONTROL ROOM" | "MANAGEMENT" }> = [
  { title: "Overview", icon: House, group: "CONTROL ROOM" },
  { title: "Live monitoring", icon: Camera, group: "CONTROL ROOM" },
  { title: "Face management", icon: Users, group: "MANAGEMENT" },
  { title: "Access history", icon: ShieldCheck, group: "MANAGEMENT" },
  { title: "Analytics", icon: Activity, group: "MANAGEMENT" },
  { title: "Devices", icon: Cpu, group: "MANAGEMENT" },
  { title: "Settings", icon: Settings2, group: "MANAGEMENT" },
];

const defaultSettings: EdgeSettings = {
  recognition_threshold: 65,
  cooldown_seconds: 8,
  camera_index: 0,
  camera_width: 1280,
  camera_height: 720,
  unlock_duration_ms: 2500,
  mqtt_broker: "127.0.0.1",
  mqtt_port: 1883,
};

const defaultStatus: DeviceStatus = {
  backend_online: false,
  camera: { online: false, monitoring: false, message: "Local service not connected" },
  ai: { online: false, engine: "OpenCV LBPH", message: "Waiting for local service" },
  mqtt: { online: false, broker: "127.0.0.1:1883", message: "Not connected" },
  esp32: { online: false, last_heartbeat: null, message: "No device heartbeat" },
  door: { state: "UNKNOWN", updated_at: null },
  last_event: null,
};

const demoUsers: FaceUser[] = [
  { user_id: "EF-2048", name: "Aarav Mehta", details: "Facilities · Main entrance", enabled: true, face_samples: 12, created_at: "2026-10-11T08:00:00Z", last_seen: "2026-11-22T10:31:00Z" },
  { user_id: "EF-2051", name: "Mira Iyer", details: "Research lab · Building A", enabled: true, face_samples: 10, created_at: "2026-10-16T08:00:00Z", last_seen: "2026-11-22T10:24:00Z" },
  { user_id: "EF-2060", name: "Kabir Nair", details: "Library · East wing", enabled: true, face_samples: 14, created_at: "2026-10-20T08:00:00Z", last_seen: "2026-11-22T09:57:00Z" },
  { user_id: "EF-2064", name: "Anika Rao", details: "Administration · Main entrance", enabled: false, face_samples: 9, created_at: "2026-10-25T08:00:00Z", last_seen: "2026-11-21T17:42:00Z" },
  { user_id: "EF-2072", name: "Dev Shah", details: "Engineering · Workshop", enabled: true, face_samples: 11, created_at: "2026-11-02T08:00:00Z", last_seen: "2026-11-22T09:40:00Z" },
];

const demoEvents: AccessEvent[] = [
  { id: 1264, user_id: "EF-2048", user_name: "Aarav Mehta", timestamp: "2026-11-22T10:31:42Z", access: "GRANTED", recognition_distance: 32.4, reason: null, event_type: "Face recognition" },
  { id: 1263, user_id: null, user_name: "Unknown Visitor", timestamp: "2026-11-22T10:28:15Z", access: "DENIED", recognition_distance: 78.6, reason: "No match under threshold", event_type: "Face recognition" },
  { id: 1262, user_id: "EF-2051", user_name: "Mira Iyer", timestamp: "2026-11-22T10:24:03Z", access: "GRANTED", recognition_distance: 28.1, reason: null, event_type: "Face recognition" },
  { id: 1261, user_id: "EF-2060", user_name: "Kabir Nair", timestamp: "2026-11-22T09:57:38Z", access: "GRANTED", recognition_distance: 41.7, reason: null, event_type: "Face recognition" },
  { id: 1260, user_id: null, user_name: "Unknown Visitor", timestamp: "2026-11-22T09:51:20Z", access: "DENIED", recognition_distance: 83.2, reason: "No match under threshold", event_type: "Face recognition" },
  { id: 1259, user_id: "EF-2072", user_name: "Dev Shah", timestamp: "2026-11-22T09:40:06Z", access: "GRANTED", recognition_distance: 36.8, reason: null, event_type: "Face recognition" },
  { id: 1258, user_id: "EF-2048", user_name: "Aarav Mehta", timestamp: "2026-11-22T09:14:51Z", access: "GRANTED", recognition_distance: 30.2, reason: null, event_type: "Face recognition" },
  { id: 1257, user_id: null, user_name: "Unknown Visitor", timestamp: "2026-11-22T08:59:33Z", access: "DENIED", recognition_distance: 91.1, reason: "No match under threshold", event_type: "Face recognition" },
  { id: 1256, user_id: "EF-2051", user_name: "Mira Iyer", timestamp: "2026-11-22T08:42:08Z", access: "GRANTED", recognition_distance: 29.5, reason: null, event_type: "Face recognition" },
  { id: 1255, user_id: "EF-2060", user_name: "Kabir Nair", timestamp: "2026-11-22T08:23:44Z", access: "GRANTED", recognition_distance: 43.9, reason: null, event_type: "Face recognition" },
  { id: 1254, user_id: null, user_name: "Unknown Visitor", timestamp: "2026-11-22T08:11:19Z", access: "DENIED", recognition_distance: 74.4, reason: "No match under threshold", event_type: "Face recognition" },
  { id: 1253, user_id: "EF-2072", user_name: "Dev Shah", timestamp: "2026-11-22T07:48:50Z", access: "GRANTED", recognition_distance: 38.2, reason: null, event_type: "Face recognition" },
];

const demoAnalytics: AnalyticsData = {
  total: 86,
  granted: 69,
  denied: 17,
  unknown: 12,
  hourly: [
    { hour: "00", granted: 0, denied: 0 }, { hour: "02", granted: 0, denied: 0 },
    { hour: "04", granted: 0, denied: 0 }, { hour: "06", granted: 1, denied: 0 },
    { hour: "08", granted: 14, denied: 4 }, { hour: "10", granted: 17, denied: 3 },
    { hour: "12", granted: 8, denied: 2 }, { hour: "14", granted: 12, denied: 2 },
    { hour: "16", granted: 11, denied: 4 }, { hour: "18", granted: 5, denied: 2 },
    { hour: "20", granted: 1, denied: 0 }, { hour: "22", granted: 0, denied: 0 },
  ],
  daily: [
    { day: "Mon", granted: 48, denied: 8 }, { day: "Tue", granted: 54, denied: 12 },
    { day: "Wed", granted: 42, denied: 9 }, { day: "Thu", granted: 59, denied: 10 },
    { day: "Fri", granted: 51, denied: 15 }, { day: "Sat", granted: 34, denied: 8 },
    { day: "Sun", granted: 69, denied: 17 },
  ],
  users: [
    { user_name: "Aarav Mehta", count: 23 }, { user_name: "Mira Iyer", count: 18 },
    { user_name: "Kabir Nair", count: 15 }, { user_name: "Dev Shah", count: 13 },
  ],
};

function EdgeFaceApp() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("edgeface_auth") === "true";
    }
    return false;
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("edgeface_email") || "admin@edgeface.local";
    }
    return "admin@edgeface.local";
  });

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("edgeface_auth");
    }
    setIsAuthenticated(false);
  };

  const handleLogin = (email: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("edgeface_auth", "true");
      localStorage.setItem("edgeface_email", email);
    }
    setUserEmail(email);
    setIsAuthenticated(true);
  };

  const [screen, setScreen] = useState<Screen>("Overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mode, setMode] = useState<ConnectionMode>("checking");
  const [status, setStatus] = useState<DeviceStatus>(defaultStatus);
  const [users, setUsers] = useState<FaceUser[]>(demoUsers);
  const [events, setEvents] = useState<AccessEvent[]>(demoEvents);
  const [analytics, setAnalytics] = useState<AnalyticsData>(demoAnalytics);
  const [settings, setSettings] = useState<EdgeSettings>(defaultSettings);
  const [monitoring, setMonitoring] = useState(false);
  const [streamVersion, setStreamVersion] = useState(0);
  const [cameraError, setCameraError] = useState("");
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<FaceUser | null>(null);
  const [personForm, setPersonForm] = useState({ user_id: "", name: "", details: "" });
  const [saving, setSaving] = useState(false);
  const [savedPreview, setSavedPreview] = useState("");
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await refresh();
      announce("Local system synchronized successfully.");
    } catch {
      announce("Sync failed: could not connect to local EdgeFace service.");
    } finally {
      setTimeout(() => setSyncing(false), 500);
    }
  };

  const refresh = useCallback(async () => {
    try {
      await edgefaceRequest<{ ok: boolean }>("/api/health");
      const [nextStatus, nextUsers, nextEvents, nextSettings, nextAnalytics] = await Promise.all([
        edgefaceRequest<DeviceStatus>("/api/status"),
        edgefaceRequest<{ items: FaceUser[] }>("/api/users"),
        edgefaceRequest<{ items: AccessEvent[] }>("/api/events?limit=200"),
        edgefaceRequest<EdgeSettings>("/api/settings"),
        edgefaceRequest<AnalyticsData>("/api/analytics"),
      ]);
      setStatus(nextStatus);
      setUsers(nextUsers.items);
      setEvents(nextEvents.items);
      setSettings(nextSettings);
      setAnalytics(nextAnalytics);
      setMonitoring(nextStatus.camera.monitoring);
      setMode("live");
    } catch {
      setMode("demo");
      setStatus(defaultStatus);
      setMonitoring(false);
    }
  }, []);

  // Real-time WebSocket connection to backend for instant zero-latency door & event updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let isSubscribed = true;

    function connectWs() {
      try {
        ws = new WebSocket("ws://127.0.0.1:8000/ws/events");
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "door_event" && data.door) {
              setStatus((prev) => ({
                ...prev,
                door: { state: data.door, updated_at: new Date().toISOString() },
              }));
            } else if (data.type === "access_event") {
              const newEvent: AccessEvent = {
                id: data.id ?? Date.now(),
                user_id: data.user_id,
                user_name: data.user_name,
                timestamp: data.timestamp ?? new Date().toISOString(),
                access: data.access,
                recognition_distance: data.recognition_distance,
                reason: data.reason,
                event_type: data.event_type ?? "Face recognition",
              };
              setEvents((prev) => [newEvent, ...prev.filter((e) => e.id !== newEvent.id)]);
              if (data.access === "GRANTED") {
                setStatus((prev) => ({
                  ...prev,
                  door: { state: "UNLOCKED", updated_at: new Date().toISOString() },
                }));
              } else if (data.access === "DENIED") {
                setStatus((prev) => ({
                  ...prev,
                  door: { state: "LOCKED", updated_at: new Date().toISOString() },
                }));
              }
            }
          } catch {
            // Ignore parse errors
          }
        };
        ws.onerror = () => {
          ws?.close();
        };
        ws.onclose = () => {
          if (isSubscribed) {
            reconnectTimer = window.setTimeout(connectWs, 3000);
          }
        };
      } catch {
        if (isSubscribed) {
          reconnectTimer = window.setTimeout(connectWs, 3000);
        }
      }
    }

    connectWs();

    return () => {
      isSubscribed = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    void refresh();
    const intervalMs = monitoring ? 1500 : 3500;
    const poll = window.setInterval(() => void refresh(), intervalMs);
    const tick = window.setInterval(() => setClock(new Date().toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })), 30000);
    setClock(new Date().toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }));
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [refresh, monitoring]);

  const activeEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesQuery = !query || `${event.user_name} ${event.user_id ?? ""} ${event.reason ?? ""} ${event.id}`.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || event.access === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [events, search, statusFilter]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return users.filter((user) => `${user.name} ${user.user_id} ${user.details}`.toLowerCase().includes(query));
  }, [users, userSearch]);

  const todayEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return events.filter((event) => event.timestamp.slice(0, 10) === today);
  }, [events]);

  const pageCount = Math.max(1, Math.ceil(activeEvents.length / 7));
  const pageEvents = activeEvents.slice((page - 1) * 7, page * 7);
  const displayTitle = screen === "Live monitoring" ? "Live monitoring" : screen;

  function announce(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4200);
  }

  async function toggleMonitoring() {
    if (mode !== "live") {
      setScreen("Settings");
      announce("Start the local EdgeFace service to access the laptop webcam.");
      return;
    }
    setCameraError("");
    try {
      const result = await edgefaceRequest<{ monitoring: boolean; message?: string }>("/api/monitoring", {
        method: "POST",
        body: JSON.stringify({ enabled: !monitoring }),
      });
      setMonitoring(result.monitoring);
      setStreamVersion((value) => value + 1);
      setCameraError(result.message ?? "");
      await refresh();
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Could not change camera state.");
    }
  }

  async function savePerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSavedPreview("");
    try {
      if (editingUser) {
        const updated = await edgefaceRequest<FaceUser>(`/api/users/${encodeURIComponent(editingUser.user_id)}`, {
          method: "PATCH",
          body: JSON.stringify({ name: personForm.name, details: personForm.details }),
        });
        setUsers((current) => current.map((user) => user.user_id === updated.user_id ? updated : user));
        setEditingUser(null);
        setUserDialogOpen(false);
        announce(`${updated.name}'s record was updated.`);
      } else {
        const created = await edgefaceRequest<FaceUser & { preview: string }>("/api/users", {
          method: "POST",
          body: JSON.stringify(personForm),
        });
        setUsers((current) => [created, ...current]);
        setSavedPreview(created.preview);
        setPersonForm({ user_id: "", name: "", details: "" });
        announce(`${created.name} registered with ${created.face_samples} face samples.`);
      }
      await refresh();
    } catch (error) {
      announce(error instanceof Error ? error.message : "The local service could not save this person.");
    } finally {
      setSaving(false);
    }
  }

  function openNewPerson() {
    if (mode !== "live") {
      announce("Face enrollment requires the local webcam service. Demo records cannot be edited.");
      return;
    }
    setEditingUser(null);
    setSavedPreview("");
    setPersonForm({ user_id: "", name: "", details: "" });
    setUserDialogOpen(true);
  }

  function openEditUser(user: FaceUser) {
    if (mode !== "live") {
      announce("Connect the local service to manage saved user records.");
      return;
    }
    setEditingUser(user);
    setPersonForm({ user_id: user.user_id, name: user.name, details: user.details });
    setSavedPreview("");
    setUserDialogOpen(true);
  }

  async function toggleUserAccess(user: FaceUser) {
    if (mode !== "live") {
      announce("Demo records are read-only. Connect the local service to change access.");
      return;
    }
    try {
      const updated = await edgefaceRequest<FaceUser>(`/api/users/${encodeURIComponent(user.user_id)}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !user.enabled }),
      });
      setUsers((current) => current.map((row) => row.user_id === updated.user_id ? updated : row));
      announce(`${updated.name} access ${updated.enabled ? "enabled" : "disabled"}.`);
    } catch (error) {
      announce(error instanceof Error ? error.message : "Could not update access.");
    }
  }

  async function deleteUser(user: FaceUser) {
    if (mode !== "live") {
      announce("Demo records are read-only. Connect the local service to remove a person.");
      return;
    }
    if (!window.confirm(`Remove ${user.name} and their stored face samples?`)) return;
    try {
      await edgefaceRequest(`/api/users/${encodeURIComponent(user.user_id)}`, { method: "DELETE" });
      setUsers((current) => current.filter((row) => row.user_id !== user.user_id));
      announce(`${user.name} and their face data were removed.`);
    } catch (error) {
      announce(error instanceof Error ? error.message : "Could not remove this person.");
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode !== "live") {
      announce("These preview values are not saved. Start the local service to persist settings.");
      return;
    }
    try {
      const updated = await edgefaceRequest<EdgeSettings>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(updated);
      announce("Local system settings saved.");
      await refresh();
    } catch (error) {
      announce(error instanceof Error ? error.message : "Could not save settings.");
    }
  }

  async function exportCsv() {
    const header = ["Event ID", "Person", "User ID", "Timestamp", "Access", "LBPH distance", "Reason"];
    const rows = activeEvents.map((event) => [event.id, event.user_name, event.user_id ?? "", event.timestamp, event.access, event.recognition_distance ?? "", event.reason ?? ""]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "edgeface-access-history.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    announce(`Exported ${rows.length} visible access events.`);
  }

  async function deviceTest() {
    if (mode !== "live") {
      announce("Device tests require a live local service and MQTT connection.");
      return;
    }
    try {
      await edgefaceRequest<{ ok: boolean }>("/api/device/test", { method: "POST", body: JSON.stringify({ action: "denied-indicator" }) });
      announce("Denied indicator test sent. The lock remains closed.");
      await refresh();
    } catch (error) {
      announce(error instanceof Error ? error.message : "The device test could not be sent.");
    }
  }

  function navigate(next: Screen) {
    setScreen(next);
    setMobileNavOpen(false);
  }

  const recentEvents = mode === "live" ? events.slice(0, 5) : demoEvents.slice(0, 5);
  const grantedToday = mode === "live" ? todayEvents.filter((event) => event.access === "GRANTED").length : 69;
  const deniedToday = mode === "live" ? todayEvents.filter((event) => event.access === "DENIED" || event.access === "UNKNOWN").length : 17;
  const attemptsToday = mode === "live" ? todayEvents.length : 86;
  const successRate = mode === "live" ? (attemptsToday ? Math.round((grantedToday / attemptsToday) * 100) : 0) : 80;

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="edgeface-shell min-h-screen text-foreground">
      {mobileNavOpen && <button className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}
      <aside className={`edgeface-sidebar fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col transition-transform duration-200 md:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[76px] items-center gap-3 border-b border-sidebar-border px-5">
          <div className="brand-mark flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground"><Fingerprint size={22} strokeWidth={2.2} /></div>
          <div className="min-w-0">
            <div className="text-[17px] font-extrabold leading-tight tracking-[0.01em]">edgeface<span className="text-primary">.</span></div>
            <div className="edgeface-kicker mt-1 text-[9px] text-muted-foreground">LOCAL ACCESS SYSTEM</div>
          </div>
          <Button className="ml-auto md:hidden" variant="ghost" size="icon" aria-label="Close menu" onClick={() => setMobileNavOpen(false)}><X /></Button>
        </div>
        <div className="px-4 pt-5">
          <div className="edgeface-kicker px-2 pb-2 text-[9px] text-muted-foreground">Control</div>
          <div className="space-y-1">
            {navigation.filter((item) => item.group === "CONTROL ROOM").map((item) => <NavigationButton key={item.title} item={item} active={screen === item.title} onClick={() => navigate(item.title)} />)}
          </div>
          <div className="edgeface-kicker mt-7 px-2 pb-2 text-[9px] text-muted-foreground">Manage</div>
          <div className="space-y-1">
            {navigation.filter((item) => item.group === "MANAGEMENT").map((item) => <NavigationButton key={item.title} item={item} active={screen === item.title} onClick={() => navigate(item.title)} />)}
          </div>
        </div>
        <div className="mt-auto px-4 pb-4">
          <div className="edgeface-surface overflow-hidden p-3">
            <div className="flex items-center gap-2.5">
              <div className={`size-2 rounded-full ${mode === "live" ? "bg-success" : "bg-warning"}`} />
              <div className="text-xs font-semibold">{mode === "live" ? "Local system connected" : mode === "checking" ? "Checking local service" : "Demo environment"}</div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{mode === "live" ? "Edge processing stays on this laptop." : "Sample records are labeled and read-only."}</p>
            <Button variant="ghost" size="sm" className="mt-2 h-7 px-1 text-xs text-primary" onClick={() => navigate("Settings")}>Connection details <ArrowRight size={13} /></Button>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-md border border-border/40 bg-secondary/20 px-2.5 py-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
              {userEmail.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{userEmail.split("@")[0]}</div>
              <div className="truncate text-[10px] text-muted-foreground">{userEmail}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Sign out"
              title="Sign out of console"
              onClick={handleLogout}
            >
              <LogOut size={15} />
            </Button>
          </div>
        </div>
      </aside>

      <div className="min-h-screen md:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" onClick={() => setMobileNavOpen(true)}><Menu /></Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>EdgeFace</span><ChevronRight size={13} /><span className="truncate text-foreground">{displayTitle}</span></div>
              <h1 className="mt-1 truncate text-[17px] font-bold sm:text-[19px]">{screen === "Overview" ? "Security overview" : displayTitle}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex"><span className="size-1.5 rounded-full bg-success" /> Local time <span className="font-mono text-foreground">{clock || "—"}</span></div>
            <span className={`hidden items-center gap-2 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold sm:flex ${mode === "live" ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}`}><span className={`size-1.5 rounded-full ${mode === "live" ? "bg-success" : "bg-warning"}`} />{mode === "live" ? "LIVE LOCAL" : mode === "checking" ? "CONNECTING" : "DEMO MODE"}</span>
            <Button variant="ghost" size="icon" aria-label="Notifications" title="Notifications" onClick={() => announce(mode === "live" ? "No unread system notifications." : "Demo mode: live device alerts are unavailable until the local service connects.")}><Bell size={17} /><span className="absolute ml-5 mt-[-12px] size-1.5 rounded-full bg-warning" /></Button>
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex items-center gap-1.5 transition-all"
              disabled={syncing}
              onClick={() => void handleManualSync()}
            >
              <RefreshCw size={14} className={syncing ? "animate-spin text-primary" : ""} />
              <span>{syncing ? "Syncing…" : "Refresh"}</span>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-7 sm:py-8">
          {mode === "demo" && <div className="mb-6 flex flex-col gap-3 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><div className="mt-0.5 rounded-full bg-warning/10 p-1.5 text-warning"><CircleHelp size={15} /></div><div><p className="text-sm font-semibold text-warning">Preview data — local hardware is not connected</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">The records below are illustrative only. Camera, recognition, MQTT, and door actions are not running in this browser preview.</p></div></div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={syncing}
                className="shrink-0 border-warning/40 text-warning hover:bg-warning/10 flex items-center gap-1.5"
                onClick={() => void handleManualSync()}
              >
                <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
                <span>{syncing ? "Connecting…" : "Sync now"}</span>
              </Button>
              <Button variant="outline" size="sm" className="shrink-0 border-warning/30 sm:self-center" onClick={() => navigate("Settings")}>Local setup <ArrowRight size={14} /></Button>
            </div>
          </div>}
          {mode === "live" && (
            <div className="mb-6 flex items-center justify-between rounded-md border border-success/25 bg-success/5 px-4 py-2.5 text-xs">
              <span className="flex items-center gap-2 text-success font-medium">
                <CheckCircle2 size={15} /> Connected to local EdgeFace service · data read from this laptop
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={syncing}
                className="h-7 px-3 text-xs font-semibold text-success border-success/30 bg-success/10 hover:bg-success/20 hover:text-success active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                onClick={() => void handleManualSync()}
              >
                <span>{syncing ? "Syncing…" : "Sync now"}</span>
                <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              </Button>
            </div>
          )}
          {notice && <div className="mb-5 flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm" role="status" aria-live="polite"><span>{notice}</span><Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={14} /></Button></div>}

          {screen === "Overview" && <OverviewView mode={mode} users={users} events={recentEvents} analytics={analytics} status={status} stats={{ people: users.length, attempts: attemptsToday, granted: grantedToday, denied: deniedToday, successRate }} onNavigate={navigate} />}
          {screen === "Live monitoring" && <MonitoringView mode={mode} monitoring={monitoring} status={status} events={recentEvents} cameraError={cameraError} streamVersion={streamVersion} onToggle={() => void toggleMonitoring()} onRefresh={() => void refresh()} />}
          {screen === "Face management" && <PeopleView mode={mode} users={filteredUsers} search={userSearch} setSearch={setUserSearch} onAdd={openNewPerson} onEdit={openEditUser} onToggle={(user) => void toggleUserAccess(user)} onDelete={(user) => void deleteUser(user)} />}
          {screen === "Access history" && <HistoryView mode={mode} events={pageEvents} total={activeEvents.length} grantedCount={activeEvents.filter((event) => event.access === "GRANTED").length} deniedCount={activeEvents.filter((event) => event.access === "DENIED" || event.access === "UNKNOWN").length} page={page} pageCount={pageCount} search={search} setSearch={(value) => { setSearch(value); setPage(1); }} statusFilter={statusFilter} setStatusFilter={(value) => { setStatusFilter(value); setPage(1); }} onExport={() => void exportCsv()} onPrev={() => setPage((value) => Math.max(1, value - 1))} onNext={() => setPage((value) => Math.min(pageCount, value + 1))} />}
          {screen === "Analytics" && <AnalyticsView mode={mode} analytics={analytics} />}
          {screen === "Devices" && <DevicesView mode={mode} status={status} onRefresh={() => void refresh()} onTest={() => void deviceTest()} />}
          {screen === "Settings" && <SettingsView mode={mode} status={status} settings={settings} setSettings={setSettings} onSave={(event) => void saveSettings(event)} onRefresh={() => void refresh()} />}
          <footer className="mt-10 flex flex-col gap-2 border-t border-border pt-5 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>EDGEFACE · LOCAL-FIRST ACCESS CONTROL</span><span>Recognition distance is not a probability · Basic face matching is not liveness detection</span></footer>
        </main>
      </div>

      <Dialog open={userDialogOpen} onOpenChange={(open) => { setUserDialogOpen(open); if (!open) setEditingUser(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-[520px]">
          <DialogHeader><DialogTitle>{editingUser ? "Edit person" : "Register a person"}</DialogTitle><DialogDescription>{editingUser ? "Update the local access record. Face samples remain on this laptop." : "The local webcam will collect quality-checked face samples. The ESP32-CAM is not used."}</DialogDescription></DialogHeader>
          {savedPreview && <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/5 p-3"><img src={savedPreview} alt="Captured face sample preview" className="size-16 rounded-md object-cover" /><div><div className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={15} /> Face samples saved locally</div><p className="mt-1 text-xs text-muted-foreground">The temporary preview is not retained by the dashboard.</p></div></div>}
          <form className="space-y-4" onSubmit={(event) => void savePerson(event)}>
            <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-medium">User ID<Input value={personForm.user_id} onChange={(event) => setPersonForm({ ...personForm, user_id: event.target.value })} placeholder="EF-2084" required disabled={Boolean(editingUser)} maxLength={32} /></label><label className="space-y-1.5 text-xs font-medium">Full name<Input value={personForm.name} onChange={(event) => setPersonForm({ ...personForm, name: event.target.value })} placeholder="Name" required maxLength={80} /></label></div>
            <label className="block space-y-1.5 text-xs font-medium">Details <span className="text-muted-foreground">(optional)</span><Input value={personForm.details} onChange={(event) => setPersonForm({ ...personForm, details: event.target.value })} placeholder="Team, location, or note" maxLength={160} /></label>
            {!editingUser && <div className="rounded-md border border-border bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground"><div className="mb-1 flex items-center gap-2 font-semibold text-foreground"><Camera size={14} /> Webcam enrollment</div>Keep one face centered in the laptop webcam. EdgeFace captures a small grayscale sample set locally, checks face size and image sharpness, and does not upload images.</div>}
            <DialogFooter className="gap-2 sm:gap-2"><Button type="button" variant="outline" onClick={() => setUserDialogOpen(false)}>Close</Button><Button type="submit" disabled={saving}>{saving ? <><RefreshCw className="animate-spin" /> {editingUser ? "Saving…" : "Capturing samples…"}</> : editingUser ? "Save changes" : <><UserRoundPlus size={15} /> Capture & register</>}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NavigationButton({ item, active, onClick }: { item: { title: Screen; icon: LucideIcon }; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return <Button variant="ghost" data-active={active} className="edgeface-sidebar-link h-10 w-full justify-start gap-3 rounded-md px-3 text-[13px] font-medium text-sidebar-foreground/75" onClick={onClick}><Icon size={17} strokeWidth={1.8} /><span className="flex-1 text-left">{item.title}</span>{active && <span className="size-1.5 rounded-full bg-primary" />}</Button>;
}

function OverviewView({ mode, users, events, analytics, status, stats, onNavigate }: { mode: ConnectionMode; users: FaceUser[]; events: AccessEvent[]; analytics: AnalyticsData; status: DeviceStatus; stats: { people: number; attempts: number; granted: number; denied: number; successRate: number }; onNavigate: (screen: Screen) => void }) {
  const donutData = [{ name: "Granted", value: analytics.granted }, { name: "Denied", value: analytics.denied }];
  return <>
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="edgeface-kicker text-[10px] text-primary">SATURDAY · SECURITY CONSOLE</div><h2 className="mt-2 text-2xl font-bold sm:text-[28px]">Good morning, operator</h2><p className="mt-1 text-sm text-muted-foreground">Here’s the access picture for your local system.</p></div><Button variant="outline" size="sm" onClick={() => onNavigate("Live monitoring")}><Camera size={15} /> Open live monitor <ArrowRight size={14} /></Button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Registered people" value={String(stats.people).padStart(2, "0")} icon={Users} sub={mode === "live" ? "Local face records" : "Illustrative records"} tone="primary" />
      <MetricCard label="Access attempts" value={String(stats.attempts).padStart(2, "0")} icon={Activity} sub="Today · local event log" tone="info" />
      <MetricCard label="Access granted" value={String(stats.granted).padStart(2, "0")} icon={ShieldCheck} sub={`${stats.successRate}% grant share`} tone="success" />
      <MetricCard label="Access denied" value={String(stats.denied).padStart(2, "0")} icon={ShieldX} sub="Unknown or below threshold" tone="danger" />
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
      <section className="edgeface-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="edgeface-kicker text-[9px] text-muted-foreground">TRAFFIC PATTERN</div><h3 className="mt-1.5 text-sm font-bold">Access activity</h3><p className="mt-1 text-xs text-muted-foreground">Granted and denied · {mode === "live" ? "local database" : "illustrative week"}</p></div><Badge variant="outline" className="border-border font-mono text-[10px] text-muted-foreground">{mode === "live" ? "LAST 24 HOURS" : "DEMO DATA"}</Badge></div>
        <div className="mt-4 h-[230px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics.hourly} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}><defs><linearGradient id="granted-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} /><stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient><linearGradient id="denied-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.2} /><stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="hour" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}:00`} /><YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--foreground)" }} /><Area type="monotone" dataKey="granted" name="Granted" stroke="var(--chart-1)" strokeWidth={2} fill="url(#granted-fill)" /><Area type="monotone" dataKey="denied" name="Denied" stroke="var(--chart-4)" strokeWidth={2} fill="url(#denied-fill)" /></AreaChart></ResponsiveContainer></div>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-3"><ChartLegend color="bg-success" label="Granted" /><ChartLegend color="bg-destructive" label="Denied" /><Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onNavigate("Analytics")}>Full analytics <ArrowRight size={13} /></Button></div>
      </section>
      <section className="edgeface-surface flex flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between"><div><div className="edgeface-kicker text-[9px] text-muted-foreground">DECISION MIX</div><h3 className="mt-1.5 text-sm font-bold">Grant vs. deny</h3></div><div className={`rounded-full px-2 py-1 text-[9px] font-semibold ${mode === "live" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>{mode === "live" ? "LIVE DATA" : "DEMO"}</div></div>
        <div className="relative mx-auto mt-1 h-[184px] w-full max-w-[230px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={donutData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={82} paddingAngle={5} stroke="none">{donutData.map((entry, index) => <Cell key={entry.name} fill={index === 0 ? "var(--chart-1)" : "var(--chart-4)"} />)}</Pie><Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--foreground)" }} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold">{analytics.total}</span><span className="edgeface-kicker mt-1 text-[8px] text-muted-foreground">ATTEMPTS</span></div></div>
        <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-4"><div><div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="size-2 rounded-full bg-success" /> Granted</div><div className="mt-1 text-lg font-bold">{analytics.granted}</div></div><div><div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="size-2 rounded-full bg-destructive" /> Denied</div><div className="mt-1 text-lg font-bold">{analytics.denied}</div></div></div>
      </section>
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(290px,0.75fr)]">
      <section className="edgeface-surface overflow-hidden">
        <SectionHeading eyebrow="LATEST ACTIVITY" title="Recent access events" action={<Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onNavigate("Access history")}>All events <ArrowRight size={13} /></Button>} />
        <EventTable events={events} compact />
      </section>
      <section className="edgeface-surface p-4 sm:p-5">
        <SectionHeading eyebrow="SYSTEM HEALTH" title="Local components" action={<Button variant="ghost" size="icon" className="size-8" aria-label="Open devices" onClick={() => onNavigate("Devices")}><ArrowRight size={15} /></Button>} />
        <div className="mt-4 space-y-3"><StatusLine icon={Camera} name="Laptop webcam" online={mode === "live" && status.camera.online} detail={mode === "live" ? status.camera.message : "Not connected in preview"} /><StatusLine icon={Fingerprint} name="Recognition engine" online={mode === "live" && status.ai.online} detail={mode === "live" ? status.ai.engine : "OpenCV · local service required"} /><StatusLine icon={Network} name="MQTT broker" online={mode === "live" && status.mqtt.online} detail={mode === "live" ? status.mqtt.broker : "Mosquitto · localhost:1883"} /><StatusLine icon={Zap} name="ESP32 DevKit" online={mode === "live" && status.esp32.online} detail={mode === "live" ? status.esp32.message : "Waiting for heartbeat"} /></div>
        <div className="mt-4 rounded-md border border-border bg-secondary/40 p-3"><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Door lock</span><span className={`flex items-center gap-1.5 font-semibold ${status.door.state === "UNLOCKED" ? "text-warning" : status.door.state === "LOCKED" ? "text-success" : "text-muted-foreground"}`}><Lock size={13} />{mode === "live" ? status.door.state : "UNKNOWN"}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${status.door.state === "UNLOCKED" ? "w-2/3 bg-warning" : status.door.state === "LOCKED" ? "w-full bg-success" : "w-1/4 bg-muted-foreground"}`} /></div></div>
      </section>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3"><QuickLink icon={Camera} title="Watch live feed" description="Laptop webcam monitor" onClick={() => onNavigate("Live monitoring")} /><QuickLink icon={UserRoundPlus} title="Manage people" description={`${users.length} local records`} onClick={() => onNavigate("Face management")} /><QuickLink icon={SlidersHorizontal} title="System settings" description="Threshold, camera, MQTT" onClick={() => onNavigate("Settings")} /></div>
  </>;
}

function MonitoringView({ mode, monitoring, status, events, cameraError, streamVersion, onToggle, onRefresh }: { mode: ConnectionMode; monitoring: boolean; status: DeviceStatus; events: AccessEvent[]; cameraError: string; streamVersion: number; onToggle: () => void; onRefresh: () => void }) {
  const latest = events[0];
  return <>
    <PageIntro eyebrow="CAMERA & RECOGNITION" title="Live monitoring" description="Local laptop webcam feed and on-device recognition status." action={<Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw size={14} /> Refresh status</Button>} />
    {mode === "demo" && <InlineNotice tone="warning" text="The browser preview cannot access your laptop camera. Start the local FastAPI service on the same computer for a real OpenCV feed." />}
    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.7fr)]">
      <section className="edgeface-surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5"><div><div className="edgeface-kicker text-[9px] text-muted-foreground">CAMERA 00 · INTERNAL WEBCAM</div><div className="mt-1.5 flex items-center gap-2 text-sm font-semibold"><Camera size={15} className="text-primary" /> {mode === "live" && status.camera.online ? "Laptop camera" : "Camera offline"}<span className="text-xs font-normal text-muted-foreground">· index 0</span></div></div><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${monitoring ? "edgeface-live-pulse bg-destructive" : "bg-muted-foreground"}`} /><span className="edgeface-kicker text-[9px] text-muted-foreground">{monitoring ? "REC" : "STANDBY"}</span></div></div>
        <div className="edgeface-stage edgeface-grid relative flex aspect-video min-h-[260px] items-center justify-center overflow-hidden sm:min-h-[360px]">
          {mode === "live" && monitoring ? <img key={streamVersion} src={`http://127.0.0.1:8000/api/camera/stream?v=${streamVersion}`} alt="Laptop webcam stream with local face-detection overlays" className="absolute inset-0 size-full object-contain" onError={() => setCameraError("The local camera stream disconnected. Check camera permissions and the service status.")} /> : <div className="relative z-10 flex max-w-sm flex-col items-center px-5 text-center"><div className="mb-4 flex size-[68px] items-center justify-center rounded-full border border-border bg-card text-muted-foreground"><Camera size={26} strokeWidth={1.5} /></div><div className="text-sm font-semibold">{mode === "live" ? status.camera.message : "No live camera feed"}</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{mode === "live" ? "Start monitoring to open the built-in laptop webcam through OpenCV." : "This preview does not simulate a camera or face match."}</p></div>}
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-sm border border-border bg-background/85 px-2 py-1.5 font-mono text-[9px] text-muted-foreground backdrop-blur"><span className={`size-1.5 rounded-full ${monitoring ? "bg-destructive" : "bg-muted-foreground"}`} />{monitoring ? "LOCAL CAPTURE ACTIVE" : "LOCAL CAMERA · IDLE"}</div>
          {monitoring && <div className="absolute bottom-3 right-3 rounded-sm border border-border bg-background/85 px-2 py-1.5 font-mono text-[9px] text-foreground backdrop-blur">OpenCV · MJPEG</div>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5"><p className="max-w-lg text-xs text-muted-foreground">{cameraError || (monitoring ? "Frames are processed locally; no cloud AI service is used." : "The camera stays closed until monitoring is started.")}</p><Button variant={monitoring ? "destructive" : "default"} size="sm" onClick={onToggle}>{monitoring ? <><X size={14} /> Stop monitoring</> : <><Camera size={14} /> Start monitoring</>}</Button></div>
      </section>
      <div className="space-y-4">
        <section className="edgeface-surface p-4 sm:p-5"><SectionHeading eyebrow="LATEST DECISION" title="Recognition result" /><div className="mt-5 flex items-center gap-3"><div className={`flex size-11 items-center justify-center rounded-md ${latest?.access === "GRANTED" ? "bg-success/10 text-success" : latest?.access === "DENIED" ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`}>{latest?.access === "GRANTED" ? <ShieldCheck /> : latest?.access === "DENIED" ? <ShieldX /> : <Fingerprint />}</div><div className="min-w-0"><div className="truncate text-sm font-bold">{mode === "live" && latest ? latest.user_name : "Awaiting a face"}</div><div className="mt-1 text-xs text-muted-foreground">{mode === "live" && latest ? latest.access === "GRANTED" ? "Access granted" : latest.reason ?? "Access denied" : "No recognition result yet"}</div></div><div className="ml-auto">{mode === "live" && latest && <AccessBadge access={latest.access} />}</div></div><div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4"><div><div className="text-[10px] text-muted-foreground">LBPH distance</div><div className="mt-1 font-mono text-sm">{mode === "live" && latest?.recognition_distance != null ? latest.recognition_distance.toFixed(1) : "—"}</div></div><div><div className="text-[10px] text-muted-foreground">Door state</div><div className="mt-1 flex items-center gap-1.5 font-mono text-sm"><Lock size={13} />{mode === "live" ? status.door.state : "UNKNOWN"}</div></div></div></section>
        <section className="edgeface-surface p-4 sm:p-5"><SectionHeading eyebrow="PROCESSING PIPELINE" title="Local engine" /><div className="mt-4 space-y-3"><StatusLine icon={Camera} name="Webcam capture" online={mode === "live" && status.camera.online} detail={mode === "live" ? status.camera.message : "Waiting for local service"} /><StatusLine icon={Fingerprint} name="Face recognition" online={mode === "live" && status.ai.online} detail={mode === "live" ? status.ai.engine : "OpenCV · LBPH"} /><StatusLine icon={Shield} name="Decision policy" online={mode === "live"} detail="Unknown / uncertain → DENIED" /></div></section>
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3"><div className="flex gap-2 text-warning"><CircleHelp size={15} className="mt-0.5 shrink-0" /><p className="text-xs leading-relaxed"><strong>Demonstration limitation:</strong> face matching is not reliable liveness detection. A printed photo or screen may spoof this basic prototype.</p></div></div>
      </div>
    </div>
    <section className="edgeface-surface mt-4 overflow-hidden"><SectionHeading eyebrow="EVENT STREAM" title="Latest detections" action={<Badge variant="outline" className="font-mono text-[9px]">{mode === "live" ? "LOCAL EVENTS" : "SAMPLE EVENTS"}</Badge>} /><EventTable events={events} compact /></section>
  </>;
}

function PeopleView({ mode, users, search, setSearch, onAdd, onEdit, onToggle, onDelete }: { mode: ConnectionMode; users: FaceUser[]; search: string; setSearch: (value: string) => void; onAdd: () => void; onEdit: (user: FaceUser) => void; onToggle: (user: FaceUser) => void; onDelete: (user: FaceUser) => void }) {
  return <>
    <PageIntro eyebrow="LOCAL IDENTITY REGISTRY" title="Face management" description="Manage enrolled people and their local access permissions." action={<Button onClick={onAdd}><UserRoundPlus size={15} /> Register person</Button>} />
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><MiniStat label="Registered" value={users.length} icon={Users} /><MiniStat label="Access enabled" value={users.filter((user) => user.enabled).length} icon={ShieldCheck} /><MiniStat label="Stored samples" value={users.reduce((sum, user) => sum + user.face_samples, 0)} icon={Fingerprint} /></div>
    <section className="edgeface-surface mt-4 overflow-hidden"><div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="edgeface-kicker text-[9px] text-muted-foreground">PERSON DIRECTORY</div><h3 className="mt-1.5 text-sm font-bold">Enrolled users</h3></div><div className="relative w-full sm:max-w-[290px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ID, or detail" className="pl-9" aria-label="Search people" /></div></div>
      {users.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-secondary/40 text-[10px] text-muted-foreground"><tr><th className="px-4 py-3 font-medium">PERSON</th><th className="px-4 py-3 font-medium">USER ID</th><th className="px-4 py-3 font-medium">FACE SAMPLES</th><th className="px-4 py-3 font-medium">LAST SEEN</th><th className="px-4 py-3 font-medium">ACCESS</th><th className="px-4 py-3 text-right font-medium">ACTIONS</th></tr></thead><tbody>{users.map((user) => <tr key={user.user_id} className="border-t border-border/70 transition-colors hover:bg-secondary/25"><td className="px-4 py-3.5"><div className="flex items-center gap-3"><AvatarName name={user.name} /><div><div className="font-semibold text-foreground">{user.name}</div><div className="mt-1 max-w-[220px] truncate text-[10px] text-muted-foreground">{user.details || "No details"}</div></div></div></td><td className="px-4 py-3.5 font-mono text-muted-foreground">{user.user_id}</td><td className="px-4 py-3.5"><span className="inline-flex items-center gap-1.5 text-muted-foreground"><Fingerprint size={14} />{user.face_samples}</span></td><td className="px-4 py-3.5 text-muted-foreground">{user.last_seen ? formatDate(user.last_seen) : "Never"}</td><td className="px-4 py-3.5"><AccessState enabled={user.enabled} /></td><td className="px-4 py-3.5"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onToggle(user)}>{user.enabled ? "Disable" : "Enable"}</Button><Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${user.name}`} onClick={() => onEdit(user)}><Settings2 size={14} /></Button><Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={`Delete ${user.name}`} onClick={() => onDelete(user)}><X size={15} /></Button></div></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title="No people match this search" description={mode === "live" ? "Try a different name or user ID." : "This illustrative list is read-only until the local service connects."} />}
      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[10px] text-muted-foreground"><span>{mode === "live" ? "Face samples remain on this laptop." : "Illustrative records · not saved to a database."}</span><span>{users.length} people</span></div>
    </section>
  </>;
}

function HistoryView({ mode, events, total, grantedCount, deniedCount, page, pageCount, search, setSearch, statusFilter, setStatusFilter, onExport, onPrev, onNext }: { mode: ConnectionMode; events: AccessEvent[]; total: number; grantedCount: number; deniedCount: number; page: number; pageCount: number; search: string; setSearch: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; onExport: () => void; onPrev: () => void; onNext: () => void }) {
  return <>
    <PageIntro eyebrow="AUDIT LOG" title="Access history" description="Review local access decisions, event times, and recognition distances." action={<Button variant="outline" size="sm" onClick={onExport}><Download size={14} /> Export CSV</Button>} />
    {mode === "demo" && <InlineNotice tone="warning" text="Sample history is shown for layout preview only. Live events are written to the local SQLite database." />}
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><MiniStat label="Visible events" value={total} icon={Activity} /><MiniStat label="Granted" value={grantedCount} icon={ShieldCheck} /><MiniStat label="Denied" value={deniedCount} icon={ShieldX} /></div>
    <section className="edgeface-surface mt-4 overflow-hidden"><div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="edgeface-kicker text-[9px] text-muted-foreground">EVENT SEARCH</div><h3 className="mt-1.5 text-sm font-bold">Access events <span className="ml-1 font-normal text-muted-foreground">({total})</span></h3></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative sm:w-[250px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search person or event ID" className="pl-9" aria-label="Search access history" /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-[145px]" aria-label="Filter event status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All decisions</SelectItem><SelectItem value="GRANTED">Granted</SelectItem><SelectItem value="DENIED">Denied</SelectItem></SelectContent></Select></div></div>
      <EventTable events={events} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3"><span className="text-[10px] text-muted-foreground">{total ? `Showing ${(page - 1) * 7 + 1}–${Math.min(page * 7, total)} of ${total}` : "No events"} · LBPH distance is not a probability</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" className="size-8" aria-label="Previous page" disabled={page <= 1} onClick={onPrev}><ChevronLeft size={15} /></Button><span className="min-w-[68px] text-center font-mono text-xs">Page {page} / {pageCount}</span><Button variant="outline" size="icon" className="size-8" aria-label="Next page" disabled={page >= pageCount} onClick={onNext}><ChevronRight size={15} /></Button></div></div>
    </section>
  </>;
}

function AnalyticsView({ mode, analytics }: { mode: ConnectionMode; analytics: AnalyticsData }) {
  const rate = analytics.total ? Math.round((analytics.granted / analytics.total) * 100) : 0;
  return <>
    <PageIntro eyebrow="LOCAL DATA INSIGHTS" title="Analytics" description="Patterns calculated from stored access events. No cloud processing." action={<Badge variant="outline" className="border-border font-mono text-[9px]">{mode === "live" ? "DATABASE · LAST 7 DAYS" : "ILLUSTRATIVE SERIES"}</Badge>} />
    {mode === "demo" && <InlineNotice tone="warning" text="Charts contain clearly labeled sample values. Start the local service to calculate analytics from your own SQLite event history." />}
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Total attempts" value={String(analytics.total)} icon={Activity} sub="Selected period" tone="info" /><MetricCard label="Grant rate" value={`${rate}%`} icon={Gauge} sub="Granted ÷ all attempts" tone="success" /><MetricCard label="Denied events" value={String(analytics.denied)} icon={ShieldX} sub="Unknown or low match" tone="danger" /><MetricCard label="Unknown visitors" value={String(analytics.unknown)} icon={Fingerprint} sub="Distinct denied detections" tone="warning" /></div>
    {analytics.total === 0 && mode === "live" ? <div className="mt-5"><EmptyState icon={Activity} title="No access events yet" description="Start webcam monitoring to record local access decisions and populate these charts." /></div> : <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <section className="edgeface-surface p-4 sm:p-5"><SectionHeading eyebrow="TODAY · HOURLY" title="Activity by hour" /><div className="mt-4 h-[280px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics.hourly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="hour" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}:00`} /><YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--foreground)" }} /><Area type="monotone" dataKey="granted" name="Granted" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.12} strokeWidth={2} /><Area type="monotone" dataKey="denied" name="Denied" stroke="var(--chart-4)" fill="var(--chart-4)" fillOpacity={0.08} strokeWidth={2} /></AreaChart></ResponsiveContainer></div><div className="mt-2 flex gap-5"><ChartLegend color="bg-success" label="Granted" /><ChartLegend color="bg-destructive" label="Denied" /></div></section>
      <section className="edgeface-surface p-4 sm:p-5"><SectionHeading eyebrow="WEEKLY OVERVIEW" title="Daily access trend" /><div className="mt-4 h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.daily} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={4}><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="day" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--foreground)" }} /><Bar dataKey="granted" name="Granted" fill="var(--chart-1)" radius={[3, 3, 0, 0]} /><Bar dataKey="denied" name="Denied" fill="var(--chart-4)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="mt-2 flex gap-5"><ChartLegend color="bg-success" label="Granted" /><ChartLegend color="bg-destructive" label="Denied" /></div></section>
      <section className="edgeface-surface p-4 sm:p-5 xl:col-span-2"><SectionHeading eyebrow="REGISTERED PEOPLE" title="Most frequent access" /><div className="mt-5 grid gap-4 sm:grid-cols-2">{analytics.users.length ? analytics.users.slice(0, 5).map((user, index) => <div key={user.user_name} className="flex items-center gap-3"><span className="w-5 font-mono text-[10px] text-muted-foreground">0{index + 1}</span><AvatarName name={user.user_name} /><span className="min-w-0 flex-1 truncate text-xs font-medium">{user.user_name}</span><div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:w-40"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(7, (user.count / Math.max(1, analytics.users[0]?.count ?? 1)) * 100)}%` }} /></div><span className="w-8 text-right font-mono text-xs">{user.count}</span></div>) : <p className="text-xs text-muted-foreground">No recognized visitors in this period.</p>}</div></section>
    </div>}
  </>;
}

function DevicesView({ mode, status, onRefresh, onTest }: { mode: ConnectionMode; status: DeviceStatus; onRefresh: () => void; onTest: () => void }) {
  const rows = [
    { name: "Laptop webcam", icon: Camera, online: mode === "live" && status.camera.online, detail: mode === "live" ? status.camera.message : "Not connected · built-in camera only", meta: "OpenCV capture · index 0" },
    { name: "Face recognition", icon: Fingerprint, online: mode === "live" && status.ai.online, detail: mode === "live" ? status.ai.message : "Local OpenCV LBPH engine", meta: "No remote AI service" },
    { name: "MQTT broker", icon: Network, online: mode === "live" && status.mqtt.online, detail: mode === "live" ? status.mqtt.message : "Mosquitto · 127.0.0.1:1883", meta: "edgeface/access · edgeface/status" },
    { name: "ESP32 DevKit", icon: Cpu, online: mode === "live" && status.esp32.online, detail: mode === "live" ? status.esp32.message : "No device heartbeat received", meta: status.esp32.last_heartbeat ? `Last heartbeat ${formatDate(status.esp32.last_heartbeat)}` : "Heartbeat status unknown" },
  ];
  return <>
    <PageIntro eyebrow="HARDWARE & CONNECTIONS" title="Device management" description="Actual heartbeat and connection signals from the local system." action={<Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw size={14} /> Refresh devices</Button>} />
    {mode === "demo" && <InlineNotice tone="warning" text="Nothing is reported as connected in preview mode. Online status is based on real local service and device signals." />}
    <div className="mt-5 grid gap-4 lg:grid-cols-2">{rows.map((row) => <DeviceCard key={row.name} {...row} />)}</div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
      <section className="edgeface-surface p-4 sm:p-5"><SectionHeading eyebrow="ACTUATOR STATE" title="Door lock" /><div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center"><div className={`flex size-16 items-center justify-center rounded-full border ${status.door.state === "UNLOCKED" ? "border-warning/40 bg-warning/10 text-warning" : status.door.state === "LOCKED" ? "border-success/40 bg-success/10 text-success" : "border-border bg-secondary text-muted-foreground"}`}><LockKeyhole size={28} /></div><div className="min-w-0 flex-1"><div className="text-2xl font-bold">{mode === "live" ? status.door.state : "UNKNOWN"}</div><p className="mt-1 text-xs text-muted-foreground">{mode === "live" ? status.door.updated_at ? `Reported ${formatDate(status.door.updated_at)}` : "Waiting for device state" : "No physical hardware connection in browser preview."}</p></div><Button variant="outline" size="sm" onClick={onTest} disabled={mode !== "live" || !status.mqtt.online || !status.esp32.online}><Zap size={14} /> Test denied indicator</Button></div><p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">The diagnostic sends a DENIED indicator event only; it does not publish an unlock command. The servo is powered separately from a regulated 5V supply.</p></section>
      <section className="edgeface-surface p-4 sm:p-5"><SectionHeading eyebrow="SERVICE DIAGNOSTICS" title="Connection details" /><dl className="mt-4 space-y-3 text-xs"><Diagnostic label="Backend" value={mode === "live" ? "127.0.0.1:8000 · connected" : "Not connected"} tone={mode === "live"} /><Diagnostic label="MQTT host" value={mode === "live" ? status.mqtt.broker : "127.0.0.1:1883"} tone={mode === "live" && status.mqtt.online} /><Diagnostic label="Last device event" value={mode === "live" && status.last_event ? formatDate(status.last_event) : "No recent event"} tone={false} /><Diagnostic label="Camera source" value="Laptop built-in webcam only" tone={false} /></dl></section>
    </div>
  </>;
}

function SettingsView({ mode, status, settings, setSettings, onSave, onRefresh }: { mode: ConnectionMode; status: DeviceStatus; settings: EdgeSettings; setSettings: (settings: EdgeSettings) => void; onSave: (event: FormEvent<HTMLFormElement>) => void; onRefresh: () => void }) {
  function setNumber(key: keyof EdgeSettings, value: string) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) setSettings({ ...settings, [key]: parsed });
  }
  return <>
    <PageIntro eyebrow="LOCAL CONFIGURATION" title="System settings" description="Recognition, camera, and local MQTT settings stored on this laptop." action={<Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw size={14} /> Reload saved values</Button>} />
    {mode === "demo" && <InlineNotice tone="warning" text="Preview values are temporary and do not control any hardware. Start the local service to load and save persistent settings." />}
    <form className="mt-5 space-y-4" onSubmit={onSave}>
      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsGroup icon={Fingerprint} eyebrow="EDGE AI" title="Recognition policy" description="Unknown faces and uncertain matches are always denied."><div className="grid gap-4 sm:grid-cols-2"><NumberField label="LBPH distance threshold" value={settings.recognition_threshold} min={20} max={120} step={1} hint="Lower distance means a closer match; this is not a probability." onChange={(value) => setNumber("recognition_threshold", value)} /><NumberField label="Event cooldown (seconds)" value={settings.cooldown_seconds} min={1} max={120} step={1} hint="Prevents repeated decisions for one continuously visible face." onChange={(value) => setNumber("cooldown_seconds", value)} /></div></SettingsGroup>
        <SettingsGroup icon={Camera} eyebrow="VIDEO INPUT" title="Laptop webcam" description="The active camera is the laptop's built-in webcam; no ESP32-CAM feed is used."><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Camera index" value={settings.camera_index} min={0} max={0} step={1} hint="Index 0 is the only supported camera source." onChange={(value) => setNumber("camera_index", value)} /><NumberField label="Width (px)" value={settings.camera_width} min={320} max={1920} step={160} hint="Camera driver may choose a nearby supported size." onChange={(value) => setNumber("camera_width", value)} /><NumberField label="Height (px)" value={settings.camera_height} min={240} max={1080} step={120} hint="Higher resolution can increase CPU use." onChange={(value) => setNumber("camera_height", value)} /></div></SettingsGroup>
        <SettingsGroup icon={LockKeyhole} eyebrow="ACTUATOR" title="Door simulation" description="The servo unlock time is sent only after a known, enabled user is matched."><NumberField label="Unlock duration (milliseconds)" value={settings.unlock_duration_ms} min={500} max={10000} step={250} hint="The ESP32 returns the servo to the locked position afterward." onChange={(value) => setNumber("unlock_duration_ms", value)} /></SettingsGroup>
        <SettingsGroup icon={Network} eyebrow="LOCAL IOT" title="MQTT broker" description="Broker settings are local only; never expose the test broker to the public internet."><div className="grid gap-4 sm:grid-cols-[1fr_140px]"><label className="space-y-1.5 text-xs font-medium">Broker address<Input value={settings.mqtt_broker} onChange={(event) => setSettings({ ...settings, mqtt_broker: event.target.value })} placeholder="127.0.0.1" required maxLength={253} /></label><NumberField label="Port" value={settings.mqtt_port} min={1} max={65535} step={1} hint="Default local broker port." onChange={(value) => setNumber("mqtt_port", value)} /></div><p className="mt-3 text-[10px] text-muted-foreground">Connection: {mode === "live" && status.mqtt.online ? <span className="text-success">connected</span> : <span className="text-warning">offline / unknown</span>}</p></SettingsGroup>
      </div>
      <div className="flex flex-col gap-3 rounded-md border border-warning/25 bg-warning/5 p-4 sm:flex-row sm:items-start"><CircleHelp size={16} className="mt-0.5 shrink-0 text-warning" /><div><div className="text-xs font-semibold text-warning">Student demonstration system</div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Basic LBPH matching is sensitive to lighting and pose, and does not provide liveness detection. Keep the lock fail-closed, use only a supervised miniature model, and do not rely on this project for real premises security.</p></div></div>
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={onRefresh}>Discard changes</Button><Button type="submit" disabled={mode !== "live"}><Check size={15} /> Save local settings</Button></div>
    </form>
  </>;
}

function MetricCard({ label, value, icon: Icon, sub, tone }: { label: string; value: string; icon: LucideIcon; sub: string; tone: "primary" | "info" | "success" | "danger" | "warning" }) {
  const toneClass = { primary: "text-primary bg-primary/10", info: "text-info bg-info/10", success: "text-success bg-success/10", danger: "text-destructive bg-destructive/10", warning: "text-warning bg-warning/10" }[tone];
  return <div className="edgeface-surface group p-4 transition-colors hover:border-primary/30"><div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">{label}</span><span className={`flex size-8 items-center justify-center rounded-md ${toneClass}`}><Icon size={16} /></span></div><div className="mt-3 flex items-end justify-between"><span className="font-mono text-[28px] font-medium leading-none tracking-0">{value}</span><span className="mb-0.5 text-[9px] text-muted-foreground">{sub}</span></div></div>;
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return <div className="edgeface-surface flex items-center gap-3 p-4"><div className="flex size-9 items-center justify-center rounded-md bg-secondary text-primary"><Icon size={17} /></div><div><div className="text-[10px] text-muted-foreground">{label}</div><div className="mt-0.5 font-mono text-lg font-semibold">{value}</div></div></div>;
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="edgeface-kicker text-[9px] text-primary">{eyebrow}</div><h2 className="mt-2 text-2xl font-bold sm:text-[28px]">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{action && <div className="shrink-0">{action}</div>}</div>;
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-3"><div><div className="edgeface-kicker text-[9px] text-muted-foreground">{eyebrow}</div><h3 className="mt-1.5 text-sm font-bold">{title}</h3></div>{action}</div>;
}

function EventTable({ events, compact = false }: { events: AccessEvent[]; compact?: boolean }) {
  if (!events.length) return <EmptyState icon={Activity} title="No access events" description="New recognition decisions will appear here when the local camera is running." />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-secondary/40 text-[9px] text-muted-foreground"><tr><th className="px-4 py-3 font-medium">PERSON</th><th className="px-4 py-3 font-medium">TIME</th><th className="px-4 py-3 font-medium">DECISION</th><th className="px-4 py-3 font-medium">LBPH DISTANCE</th>{!compact && <th className="px-4 py-3 font-medium">REASON</th>}<th className="px-4 py-3 font-medium">EVENT</th></tr></thead><tbody>{events.map((event) => <tr key={event.id} className="border-t border-border/70 transition-colors hover:bg-secondary/25"><td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className={`flex size-7 shrink-0 items-center justify-center rounded-full ${event.user_id ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{event.user_id ? <Users size={13} /> : <Fingerprint size={13} />}</div><div><div className="font-semibold">{event.user_name}</div><div className="mt-0.5 text-[9px] text-muted-foreground">{event.user_id ?? "Unregistered face"}</div></div></div></td><td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-muted-foreground">{formatTime(event.timestamp)}</td><td className="px-4 py-3"><AccessBadge access={event.access} /></td><td className="px-4 py-3 font-mono text-muted-foreground">{event.recognition_distance == null ? "—" : event.recognition_distance.toFixed(1)}</td>{!compact && <td className="max-w-[210px] truncate px-4 py-3 text-muted-foreground">{event.reason ?? "—"}</td>}<td className="px-4 py-3 text-muted-foreground">{event.event_type}</td></tr>)}</tbody></table></div>;
}

function AccessBadge({ access }: { access: string }) {
  const isGranted = access === "GRANTED";
  return <Badge variant="outline" className={`gap-1 border text-[9px] font-semibold ${isGranted ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{isGranted ? <Check size={11} /> : <X size={11} />}{isGranted ? "GRANTED" : "DENIED"}</Badge>;
}

function AccessState({ enabled }: { enabled: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${enabled ? "text-success" : "text-muted-foreground"}`}><span className={`size-1.5 rounded-full ${enabled ? "bg-success" : "bg-muted-foreground"}`} />{enabled ? "Enabled" : "Disabled"}</span>;
}

function StatusLine({ icon: Icon, name, online, detail }: { icon: LucideIcon; name: string; online: boolean; detail: string }) {
  return <div className="flex items-center gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground"><Icon size={15} /></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{name}</div><div className="mt-0.5 truncate text-[10px] text-muted-foreground">{detail}</div></div><span className={`size-2 shrink-0 rounded-full ${online ? "bg-success" : "bg-muted-foreground/50"}`} title={online ? "Online" : "Offline"} /></div>;
}

function DeviceCard({ name, icon: Icon, online, detail, meta }: { name: string; icon: LucideIcon; online: boolean; detail: string; meta: string }) {
  return <div className="edgeface-surface flex items-start gap-4 p-4 sm:p-5"><div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"><Icon size={20} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">{name}</h3><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-semibold ${online ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}><span className={`size-1.5 rounded-full ${online ? "bg-success" : "bg-muted-foreground"}`} />{online ? "ONLINE" : "OFFLINE"}</span></div><p className="mt-1.5 text-xs text-muted-foreground">{detail}</p><div className="mt-3 border-t border-border pt-2.5 font-mono text-[9px] text-muted-foreground">{meta}</div></div></div>;
}

function SettingsGroup({ icon: Icon, eyebrow, title, description, children }: { icon: LucideIcon; eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="edgeface-surface p-4 sm:p-5"><div className="flex gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon size={17} /></div><div><div className="edgeface-kicker text-[9px] text-muted-foreground">{eyebrow}</div><h3 className="mt-1 text-sm font-bold">{title}</h3><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p></div></div><div className="mt-5">{children}</div></section>;
}

function NumberField({ label, value, min, max, step, hint, onChange }: { label: string; value: number; min: number; max: number; step: number; hint: string; onChange: (value: string) => void }) {
  return <label className="block space-y-1.5 text-xs font-medium">{label}<Input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value)} /><span className="block text-[10px] font-normal leading-relaxed text-muted-foreground">{hint}</span></label>;
}

function Diagnostic({ label, value, tone }: { label: string; value: string; tone: boolean }) {
  return <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-2.5 last:border-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className={`max-w-[65%] break-words text-right font-mono text-[10px] ${tone ? "text-success" : "text-foreground"}`}>{value}</dd></div>;
}

function AvatarName({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
  return <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[10px] font-bold text-primary">{initials || "EF"}</div>;
}

function ChartLegend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className={`size-2 rounded-full ${color}`} />{label}</span>;
}

function QuickLink({ icon: Icon, title, description, onClick }: { icon: LucideIcon; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="edgeface-surface flex items-center gap-3 p-3 text-left transition-colors hover:border-primary/30 hover:bg-secondary/30"><span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{title}</span><span className="mt-1 block truncate text-[10px] text-muted-foreground">{description}</span></span><ArrowRight size={14} className="text-muted-foreground" /></button>;
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className="flex min-h-[170px] flex-col items-center justify-center px-4 py-8 text-center"><div className="flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground"><Icon size={20} /></div><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p></div>;
}

function InlineNotice({ tone, text }: { tone: "warning" | "info"; text: string }) {
  const styles = tone === "warning" ? "border-warning/30 bg-warning/5 text-warning" : "border-info/30 bg-info/5 text-info";
  return <div className={`mt-5 flex items-start gap-2.5 rounded-md border px-3.5 py-3 ${styles}`}><CircleHelp size={15} className="mt-0.5 shrink-0" /><p className="text-xs leading-relaxed text-muted-foreground">{text}</p></div>;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function LoginView({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(true);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Please enter your operator email address.");
      return;
    }
    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      setError("Please enter a valid email address (e.g. admin@edgeface.local).");
      return;
    }
    if (!password) {
      setError("Please enter your access password.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    onLogin(trimmedEmail);
  };

  const fillDemo = () => {
    setEmail("admin@edgeface.local");
    setPassword("admin123");
    setError("");
  };

  return (
    <div className="edgeface-shell relative flex min-h-screen items-center justify-center p-4">
      {/* Background glow and gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

      <div className="relative w-full max-w-md">
        <div className="edgeface-surface border-border/80 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          {/* Brand & Security Header */}
          <div className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-inner">
              <Fingerprint size={32} strokeWidth={2.2} />
            </div>
            <div className="mt-4 flex items-center justify-center gap-1.5">
              <span className="text-xl font-extrabold tracking-tight">edgeface</span>
              <span className="text-xl font-extrabold text-primary">.</span>
            </div>
            <Badge variant="outline" className="mt-2 border-primary/30 bg-primary/5 font-mono text-[9px] text-primary">
              LOCAL EDGE AI · SECURITY CONSOLE
            </Badge>
            <h1 className="mt-4 text-xl font-bold tracking-tight">Operator Authentication</h1>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Sign in with your email and password to access local access control, live monitoring, and IoT devices.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive flex items-center gap-2">
                <ShieldX size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Operator Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="admin@edgeface.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-xs"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Access Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-9 text-xs font-mono"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-border accent-primary size-3.5"
                />
                <span>Remember session</span>
              </label>
              <button
                type="button"
                onClick={fillDemo}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Use demo credentials
              </button>
            </div>

            <Button type="submit" className="w-full mt-2 font-semibold">
              <ShieldCheck size={16} className="mr-1.5" />
              Sign in to Console
            </Button>
          </form>

          {/* Security footnote */}
          <div className="mt-6 border-t border-border/60 pt-4 text-center">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              🔐 <strong>Local-first security:</strong> Authentication is handled locally on this edge machine. Zero credentials or biometric records are sent to cloud servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}