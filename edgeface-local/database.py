"""SQLite database setup and helpers for EdgeFace."""

import json
import logging
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent / "edgeface.db"

# ---------------------------------------------------------------------------
# Default settings written on first run
# ---------------------------------------------------------------------------
_DEFAULT_SETTINGS: Dict[str, Any] = {
    "camera_index": 0,
    "camera_width": 640,
    "camera_height": 480,
    "recognition_threshold": 60.0,
    "recognition_cooldown": 8,
    "mqtt_broker": "127.0.0.1",
    "mqtt_port": 1883,
    "mqtt_enabled": True,
    "face_samples": 20,
}


# ---------------------------------------------------------------------------
# Connection context manager
# ---------------------------------------------------------------------------
@contextmanager
def get_conn() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Schema creation
# ---------------------------------------------------------------------------
def init_db() -> None:
    """Create all tables and seed default settings."""
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                user_id     TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                details     TEXT DEFAULT '',
                enabled     INTEGER DEFAULT 1,
                face_samples INTEGER DEFAULT 0,
                created_at  TEXT NOT NULL,
                last_seen   TEXT
            );

            CREATE TABLE IF NOT EXISTS face_data (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT NOT NULL,
                sample_path TEXT NOT NULL,
                created_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS access_events (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id              TEXT,
                user_name            TEXT,
                timestamp            TEXT NOT NULL,
                access               TEXT NOT NULL,
                recognition_distance REAL,
                reason               TEXT,
                event_type           TEXT DEFAULT 'Face recognition'
            );

            CREATE TABLE IF NOT EXISTS device_status (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS system_settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )

        # Seed default settings only when the table is empty
        existing = conn.execute(
            "SELECT COUNT(*) FROM system_settings"
        ).fetchone()[0]
        if existing == 0:
            conn.executemany(
                "INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)",
                [(k, json.dumps(v)) for k, v in _DEFAULT_SETTINGS.items()],
            )
            logger.info("Default settings written to database.")


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
def get_users() -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM users ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def get_user(user_id: str) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()
        return dict(row) if row else None


def create_user(
    user_id: str,
    name: str,
    details: str,
    created_at: str,
) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO users (user_id, name, details, enabled, face_samples, created_at)"
            " VALUES (?, ?, ?, 1, 0, ?)",
            (user_id, name, details, created_at),
        )


def update_user(user_id: str, fields: Dict[str, Any]) -> bool:
    allowed = {"name", "details", "enabled", "face_samples", "last_seen"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return False
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [user_id]
    with get_conn() as conn:
        cur = conn.execute(
            f"UPDATE users SET {set_clause} WHERE user_id = ?", values
        )
        return cur.rowcount > 0


def delete_user(user_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM face_data WHERE user_id = ?", (user_id,))
        return cur.rowcount > 0


# ---------------------------------------------------------------------------
# Face data
# ---------------------------------------------------------------------------
def add_face_sample(user_id: str, sample_path: str, created_at: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO face_data (user_id, sample_path, created_at) VALUES (?, ?, ?)",
            (user_id, sample_path, created_at),
        )
        conn.execute(
            "UPDATE users SET face_samples = face_samples + 1 WHERE user_id = ?",
            (user_id,),
        )


def get_face_samples(user_id: str) -> List[str]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT sample_path FROM face_data WHERE user_id = ?", (user_id,)
        ).fetchall()
        return [r["sample_path"] for r in rows]


def get_all_face_samples() -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT fd.user_id, fd.sample_path FROM face_data fd"
            " JOIN users u ON fd.user_id = u.user_id"
            " WHERE u.enabled = 1"
        ).fetchall()
        return [dict(r) for r in rows]


def delete_face_samples(user_id: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM face_data WHERE user_id = ?", (user_id,))
        conn.execute(
            "UPDATE users SET face_samples = 0 WHERE user_id = ?", (user_id,)
        )


# ---------------------------------------------------------------------------
# Access events
# ---------------------------------------------------------------------------
def insert_event(
    user_id: Optional[str],
    user_name: Optional[str],
    timestamp: str,
    access: str,
    recognition_distance: Optional[float],
    reason: str,
    event_type: str = "Face recognition",
) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO access_events"
            " (user_id, user_name, timestamp, access, recognition_distance, reason, event_type)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, user_name, timestamp, access, recognition_distance, reason, event_type),
        )
        return cur.lastrowid  # type: ignore[return-value]


def get_events(
    limit: int = 200,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Dict[str, Any]]:
    query = "SELECT * FROM access_events WHERE 1=1"
    params: List[Any] = []
    if status:
        query += " AND access = ?"
        params.append(status)
    if search:
        query += " AND (user_name LIKE ? OR reason LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


def get_last_event() -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM access_events ORDER BY id DESC LIMIT 1"
        ).fetchone()
        return dict(row) if row else None


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
def get_analytics() -> Dict[str, Any]:
    with get_conn() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM access_events"
        ).fetchone()[0]
        granted = conn.execute(
            "SELECT COUNT(*) FROM access_events WHERE access = 'GRANTED'"
        ).fetchone()[0]
        denied = conn.execute(
            "SELECT COUNT(*) FROM access_events WHERE access = 'DENIED'"
        ).fetchone()[0]
        unknown = conn.execute(
            "SELECT COUNT(*) FROM access_events WHERE access = 'DENIED' AND (user_id IS NULL OR user_name = 'Unknown')"
        ).fetchone()[0]

        # Top users - keyed by user_name to match AnalyticsData interface
        user_rows = conn.execute(
            "SELECT user_name, COUNT(*) as cnt"
            " FROM access_events WHERE access = 'GRANTED' AND user_name IS NOT NULL"
            " GROUP BY user_name ORDER BY cnt DESC LIMIT 5"
        ).fetchall()
        users = [{"user_name": r["user_name"], "count": r["cnt"]} for r in user_rows]

        # Hourly breakdown (granted + denied per hour) for today
        hourly_rows = conn.execute(
            "SELECT strftime('%H', timestamp) as hour,"
            "  SUM(CASE WHEN access = 'GRANTED' THEN 1 ELSE 0 END) as granted,"
            "  SUM(CASE WHEN access = 'DENIED'  THEN 1 ELSE 0 END) as denied"
            " FROM access_events"
            " WHERE timestamp >= date('now')"
            " GROUP BY hour ORDER BY hour"
        ).fetchall()
        # Fill all 24 hours so the chart always has data points
        hourly_map = {r["hour"]: r for r in hourly_rows}
        hourly = [
            {
                "hour": str(h).zfill(2),
                "granted": hourly_map[str(h).zfill(2)]["granted"] if str(h).zfill(2) in hourly_map else 0,
                "denied":  hourly_map[str(h).zfill(2)]["denied"]  if str(h).zfill(2) in hourly_map else 0,
            }
            for h in range(24)
        ]

        # Daily breakdown (granted + denied per day) for the last 7 days
        daily_rows = conn.execute(
            "SELECT strftime('%w', timestamp) as dow,"
            "  date(timestamp) as day_date,"
            "  SUM(CASE WHEN access = 'GRANTED' THEN 1 ELSE 0 END) as granted,"
            "  SUM(CASE WHEN access = 'DENIED'  THEN 1 ELSE 0 END) as denied"
            " FROM access_events"
            " WHERE timestamp >= date('now', '-6 days')"
            " GROUP BY day_date ORDER BY day_date"
        ).fetchall()
        day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        daily = [
            {
                "day": day_names[int(r["dow"])],
                "granted": r["granted"],
                "denied": r["denied"],
            }
            for r in daily_rows
        ]

    return {
        "total": total,
        "granted": granted,
        "denied": denied,
        "unknown": unknown,
        "hourly": hourly,
        "daily": daily,
        "users": users,
    }


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
def get_settings() -> Dict[str, Any]:
    with get_conn() as conn:
        rows = conn.execute("SELECT key, value FROM system_settings").fetchall()
        return {r["key"]: json.loads(r["value"]) for r in rows}


def save_settings(settings: Dict[str, Any]) -> None:
    with get_conn() as conn:
        conn.executemany(
            "INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)",
            [(k, json.dumps(v)) for k, v in settings.items()],
        )
