"""WebSocket connection manager for live event broadcasting."""

import asyncio
import json
import logging
from typing import Any, Dict, List

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages active WebSocket connections and broadcasts messages to all."""

    def __init__(self) -> None:
        self._connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.append(ws)
        logger.info("WebSocket client connected. Total: %d", len(self._connections))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            if ws in self._connections:
                self._connections.remove(ws)
        logger.info("WebSocket client disconnected. Total: %d", len(self._connections))

    async def broadcast(self, data: Dict[str, Any]) -> None:
        """Send a JSON message to all connected clients, dropping dead connections."""
        message = json.dumps(data)
        dead: List[WebSocket] = []

        async with self._lock:
            targets = list(self._connections)

        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)

        if dead:
            async with self._lock:
                for ws in dead:
                    if ws in self._connections:
                        self._connections.remove(ws)
            logger.debug("Dropped %d dead WebSocket connection(s).", len(dead))

    @property
    def connection_count(self) -> int:
        return len(self._connections)


# Singleton used application-wide
ws_manager = WebSocketManager()
