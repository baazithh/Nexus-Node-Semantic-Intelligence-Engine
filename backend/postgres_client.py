"""
PostgreSQL client — logs events and interventions.
Falls back silently to no-op when PG is unavailable.
"""
import logging
import json
from datetime import datetime, timezone

log = logging.getLogger("nexus.postgres")

_pg_conn = None
_pg_available = False

_mem_log: list[dict] = []


async def init_pg(dsn: str):
    global _pg_conn, _pg_available
    try:
        import asyncpg
        _pg_conn = await asyncpg.connect(dsn)
        await _pg_conn.execute("""
            CREATE TABLE IF NOT EXISTS event_log (
                id SERIAL PRIMARY KEY,
                event_id TEXT,
                headline TEXT,
                sentiment FLOAT,
                entities JSONB,
                source TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS intervention_log (
                id SERIAL PRIMARY KEY,
                action TEXT,
                source_entity TEXT,
                target_entity TEXT,
                event_id TEXT,
                sentiment FLOAT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS system_config (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        _pg_available = True
        log.info("PostgreSQL connected")
    except Exception as exc:
        log.warning("PostgreSQL unavailable (%s) — using in-memory log", exc)
        _pg_available = False


async def log_event(event: dict):
    entry = {
        "type": "event",
        "event_id": event.get("id"),
        "headline": event.get("headline"),
        "sentiment": event.get("sentiment"),
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    _mem_log.append(entry)
    if _pg_available and _pg_conn:
        try:
            await _pg_conn.execute(
                "INSERT INTO event_log(event_id,headline,sentiment,entities,source) VALUES($1,$2,$3,$4,$5)",
                event["id"], event["headline"], event["sentiment"],
                json.dumps(event.get("entities", [])), event.get("source", ""),
            )
        except Exception as exc:
            log.error("PG log_event error: %s", exc)


async def log_intervention(action: str, source: str, target: str = None, event_id: str = None, sentiment: float = None):
    entry = {"type": "intervention", "action": action, "source": source, "ts": datetime.now(timezone.utc).isoformat()}
    _mem_log.append(entry)
    if _pg_available and _pg_conn:
        try:
            await _pg_conn.execute(
                "INSERT INTO intervention_log(action,source_entity,target_entity,event_id,sentiment) VALUES($1,$2,$3,$4,$5)",
                action, source, target, event_id, sentiment,
            )
        except Exception as exc:
            log.error("PG log_intervention error: %s", exc)


async def get_config(key: str, default: str = "") -> str:
    if _pg_available and _pg_conn:
        row = await _pg_conn.fetchrow("SELECT value FROM system_config WHERE key=$1", key)
        return row["value"] if row else default
    return default


async def set_config(key: str, value: str):
    if _pg_available and _pg_conn:
        await _pg_conn.execute(
            "INSERT INTO system_config(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2, updated_at=NOW()",
            key, value,
        )
