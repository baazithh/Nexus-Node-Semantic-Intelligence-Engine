"""
Neo4j client — handles all graph operations for Nexus-Node.
Falls back to an in-memory store when Neo4j is unavailable.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

log = logging.getLogger("nexus.neo4j")

# ── In-memory fallback store ──────────────────────────────────────────────────
_mem_nodes: dict[str, dict] = {}
_mem_edges: list[dict] = []


def _mem_upsert_entity(name: str, etype: str):
    if name not in _mem_nodes:
        _mem_nodes[name] = {
            "id": name, "name": name, "type": "Company" if etype == "ORG" else "Person",
            "weight": 1.0, "event_count": 0, "avg_sentiment": 0.0,
            "_sentiment_sum": 0.0,
        }
    node = _mem_nodes[name]
    node["event_count"] += 1
    return node


def _mem_add_edge(source: str, event_id: str, event_headline: str, sentiment: float, timestamp: str):
    edge = {
        "id": str(uuid.uuid4()),
        "source": source,
        "target": event_id,
        "event_id": event_id,
        "event_headline": event_headline,
        "sentiment": sentiment,
        "timestamp": timestamp,
        "flagged": False,
        "weight": 1.0,
    }
    _mem_edges.append(edge)
    node = _mem_nodes.get(source)
    if node:
        node["_sentiment_sum"] += sentiment
        node["avg_sentiment"] = round(node["_sentiment_sum"] / node["event_count"], 3)
    return edge


# ── Driver wrapper ────────────────────────────────────────────────────────────
_driver = None
_neo4j_available = False


def init_driver(uri: str, user: str, password: str):
    global _driver, _neo4j_available
    try:
        from neo4j import GraphDatabase
        _driver = GraphDatabase.driver(uri, auth=(user, password))
        _driver.verify_connectivity()
        _neo4j_available = True
        log.info("Neo4j connected at %s", uri)
        _bootstrap_schema()
    except Exception as exc:
        log.warning("Neo4j unavailable (%s) — using in-memory graph", exc)
        _neo4j_available = False


def _bootstrap_schema():
    if not _neo4j_available or not _driver:
        return
    with _driver.session() as s:
        s.run("CREATE CONSTRAINT entity_name IF NOT EXISTS FOR (e:Entity) REQUIRE e.name IS UNIQUE")
        s.run("CREATE CONSTRAINT event_id IF NOT EXISTS FOR (ev:Event) REQUIRE ev.id IS UNIQUE")


def close_driver():
    if _driver:
        _driver.close()


# ── Graph operations ──────────────────────────────────────────────────────────
def ingest_event(event: dict) -> list[dict]:
    """Write entities + event + edges. Returns list of new edges."""
    new_edges = []
    if _neo4j_available and _driver:
        new_edges = _neo4j_ingest(event)
    else:
        new_edges = _mem_ingest(event)
    return new_edges


def _mem_ingest(event: dict) -> list[dict]:
    new_edges = []
    for ent in event.get("entities", []):
        _mem_upsert_entity(ent["name"], ent["type"])
        edge = _mem_add_edge(
            source=ent["name"],
            event_id=event["id"],
            event_headline=event["headline"],
            sentiment=event["sentiment"],
            timestamp=event["timestamp"],
        )
        new_edges.append(edge)
    return new_edges


def _neo4j_ingest(event: dict) -> list[dict]:
    new_edges = []
    cypher = """
    MERGE (ev:Event {id: $event_id})
      ON CREATE SET ev.headline = $headline, ev.source = $source, ev.timestamp = $timestamp
    WITH ev
    UNWIND $entities AS ent
    MERGE (e:Entity {name: ent.name})
      ON CREATE SET e.type = ent.type, e.weight = 1.0, e.event_count = 0, e.avg_sentiment = 0.0
    SET e.event_count = e.event_count + 1,
        e.avg_sentiment = (e.avg_sentiment * (e.event_count - 1) + $sentiment) / e.event_count
    CREATE (e)-[r:MENTIONED_IN {
        id: randomUUID(),
        sentiment: $sentiment,
        timestamp: $timestamp,
        flagged: false,
        weight: 1.0
    }]->(ev)
    RETURN e.name AS source, ev.id AS target, r.id AS edge_id
    """
    with _driver.session() as s:
        result = s.run(cypher,
            event_id=event["id"],
            headline=event["headline"],
            source=event["source"],
            timestamp=event["timestamp"],
            entities=event.get("entities", []),
            sentiment=event["sentiment"],
        )
        for rec in result:
            new_edges.append({
                "id": rec["edge_id"],
                "source": rec["source"],
                "target": rec["target"],
                "event_id": event["id"],
                "sentiment": event["sentiment"],
                "timestamp": event["timestamp"],
                "flagged": False,
                "weight": 1.0,
            })
    return new_edges


def get_full_graph() -> dict:
    if _neo4j_available and _driver:
        return _neo4j_get_graph()
    return _mem_get_graph()


def _mem_get_graph() -> dict:
    nodes = [
        {k: v for k, v in n.items() if not k.startswith("_")}
        for n in _mem_nodes.values()
    ]
    return {"nodes": nodes, "edges": _mem_edges[-500:]}


def _neo4j_get_graph() -> dict:
    cypher = """
    MATCH (e:Entity)-[r:MENTIONED_IN]->(ev:Event)
    RETURN
      e.name AS name, e.type AS type, e.weight AS weight,
      e.event_count AS event_count, e.avg_sentiment AS avg_sentiment,
      r.id AS edge_id, r.sentiment AS sentiment, r.timestamp AS timestamp,
      r.flagged AS flagged, r.weight AS edge_weight,
      ev.id AS event_id
    ORDER BY r.timestamp DESC LIMIT 500
    """
    nodes_map = {}
    edges = []
    with _driver.session() as s:
        for rec in s.run(cypher):
            if rec["name"] not in nodes_map:
                nodes_map[rec["name"]] = {
                    "id": rec["name"], "name": rec["name"],
                    "type": "Company" if rec["type"] == "ORG" else "Person",
                    "weight": rec["weight"] or 1.0,
                    "event_count": rec["event_count"] or 0,
                    "avg_sentiment": rec["avg_sentiment"] or 0.0,
                }
            edges.append({
                "id": rec["edge_id"],
                "source": rec["name"],
                "target": rec["event_id"],
                "event_id": rec["event_id"],
                "sentiment": rec["sentiment"],
                "timestamp": rec["timestamp"],
                "flagged": rec["flagged"] or False,
                "weight": rec["edge_weight"] or 1.0,
            })
    return {"nodes": list(nodes_map.values()), "edges": edges}


def apply_intervention(action: str, source: str, target: Optional[str], event_id: Optional[str], sentiment: Optional[float]) -> bool:
    if _neo4j_available and _driver:
        return _neo4j_intervention(action, source, target, event_id, sentiment)
    return _mem_intervention(action, source, target, event_id, sentiment)


def _mem_intervention(action, source, target, event_id, sentiment) -> bool:
    if action == "prune":
        global _mem_edges
        _mem_edges = [e for e in _mem_edges if not (e["source"] == source and e["target"] == target)]
        return True
    elif action == "create" and target:
        _mem_upsert_entity(source, "ORG")
        _mem_upsert_entity(target, "ORG")
        _mem_add_edge(source, str(uuid.uuid4()), f"Manual link: {source} ↔ {target}", sentiment or 0.0, datetime.now(timezone.utc).isoformat())
        return True
    elif action == "flag" and event_id:
        for e in _mem_edges:
            if e["event_id"] == event_id and e["source"] == source:
                e["flagged"] = True
                e["weight"] = max(0.1, e["weight"] * 0.5)
        return True
    return False


def _neo4j_intervention(action, source, target, event_id, sentiment) -> bool:
    with _driver.session() as s:
        if action == "prune":
            s.run("MATCH (e:Entity {name:$s})-[r:MENTIONED_IN]->(ev:Event {id:$t}) DELETE r", s=source, t=target)
        elif action == "create" and target:
            s.run("""
            MERGE (a:Entity {name:$s}) MERGE (b:Entity {name:$t})
            CREATE (a)-[:MENTIONED_IN {id:randomUUID(),sentiment:$sent,timestamp:$ts,flagged:false,weight:1.0}]->(b)
            """, s=source, t=target, sent=sentiment or 0.0, ts=datetime.now(timezone.utc).isoformat())
        elif action == "flag" and event_id:
            s.run("MATCH (:Entity {name:$s})-[r:MENTIONED_IN]->(:Event {id:$e}) SET r.flagged=true, r.weight=r.weight*0.5", s=source, e=event_id)
    return True
