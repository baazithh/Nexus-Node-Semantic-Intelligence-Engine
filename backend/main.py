"""
FastAPI main — Nexus-Node backend
Exposes REST + WebSocket endpoints for the frontend.
"""
import asyncio
import json
import logging
import os
import random
from contextlib import asynccontextmanager
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import mock_stream
import neo4j_client as neo4j
import postgres_client as pg
from models import InterventionRequest, SensitivityUpdate

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
log = logging.getLogger("nexus.main")

# ── Global state ──────────────────────────────────────────────────────────────
_ws_clients: Set[WebSocket] = set()
_sensitivity: float = 0.5          # 0.1 – 1.0; filters events below threshold
_stream_running = False

NEO4J_URI  = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER",     "neo4j")
NEO4J_PASS = os.getenv("NEO4J_PASSWORD", "nexusnode")
PG_DSN     = os.getenv("PG_DSN",         "postgresql://postgres:nexusnode@localhost:5432/nexusnode")


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    neo4j.init_driver(NEO4J_URI, NEO4J_USER, NEO4J_PASS)
    await pg.init_pg(PG_DSN)
    asyncio.create_task(_stream_loop())
    log.info("Nexus-Node backend started")
    yield
    neo4j.close_driver()
    log.info("Nexus-Node backend stopped")


app = FastAPI(title="Nexus-Node API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Stream loop ───────────────────────────────────────────────────────────────
async def _stream_loop():
    global _stream_running
    _stream_running = True
    log.info("Stream loop started")
    while True:
        try:
            event = mock_stream.generate_event()
            abs_sentiment = abs(event["sentiment"])

            # Sensitivity gate: skip low-signal events based on slider
            if abs_sentiment < _sensitivity * 0.3:
                await asyncio.sleep(0.5)
                continue

            # Ingest into graph
            new_edges = neo4j.ingest_event(event)
            await pg.log_event(event)

            # Build broadcast payload
            graph_delta = {
                "type": "event",
                "event": event,
                "new_edges": new_edges,
            }

            await _broadcast(json.dumps(graph_delta))
            interval = random.uniform(1.2, 3.0) / max(0.1, _sensitivity)
            await asyncio.sleep(interval)

        except Exception as exc:
            log.error("Stream loop error: %s", exc)
            await asyncio.sleep(2)


async def _broadcast(message: str):
    dead = set()
    for ws in _ws_clients.copy():
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)
    _ws_clients -= dead


# ── WebSocket ─────────────────────────────────────────────────────────────────
@app.websocket("/ws/stream")
async def websocket_stream(ws: WebSocket):
    await ws.accept()
    _ws_clients.add(ws)
    log.info("WS client connected — total: %d", len(_ws_clients))
    # Send current graph snapshot on connect
    graph = neo4j.get_full_graph()
    await ws.send_text(json.dumps({"type": "snapshot", "graph": graph}))
    try:
        while True:
            await ws.receive_text()   # Keep alive / absorb pings
    except WebSocketDisconnect:
        _ws_clients.discard(ws)
        log.info("WS client disconnected — total: %d", len(_ws_clients))


# ── REST endpoints ────────────────────────────────────────────────────────────
@app.get("/graph")
async def get_graph():
    return neo4j.get_full_graph()


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "ws_clients": len(_ws_clients),
        "sensitivity": _sensitivity,
        "stream_running": _stream_running,
        "neo4j": neo4j._neo4j_available,
        "postgres": pg._pg_available,
    }


@app.post("/intervention")
async def intervention(req: InterventionRequest):
    success = neo4j.apply_intervention(
        req.action, req.source_entity, req.target_entity,
        req.event_id, req.sentiment,
    )
    await pg.log_intervention(req.action, req.source_entity, req.target_entity, req.event_id, req.sentiment)

    if success:
        # Broadcast graph update to all clients
        graph = neo4j.get_full_graph()
        await _broadcast(json.dumps({"type": "snapshot", "graph": graph}))

    return {"success": success, "action": req.action}


@app.put("/sensitivity")
async def update_sensitivity(upd: SensitivityUpdate):
    global _sensitivity
    _sensitivity = max(0.1, min(1.0, upd.value))
    await pg.set_config("sensitivity", str(_sensitivity))
    await _broadcast(json.dumps({"type": "sensitivity", "value": _sensitivity}))
    return {"sensitivity": _sensitivity}


@app.get("/logs")
async def get_logs():
    return {"logs": pg._mem_log[-100:]}
