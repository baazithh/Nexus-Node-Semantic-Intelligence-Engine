from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class EventPacket(BaseModel):
    id: str
    headline: str
    source: str
    timestamp: str
    entities: list[dict]  # [{name, type}]
    sentiment: float      # -1.0 to 1.0
    raw_text: str


class InterventionRequest(BaseModel):
    action: str           # "prune" | "create" | "flag"
    source_entity: str
    target_entity: Optional[str] = None
    event_id: Optional[str] = None
    sentiment: Optional[float] = None


class SensitivityUpdate(BaseModel):
    value: float          # 0.1 to 1.0


class GraphNode(BaseModel):
    id: str
    name: str
    type: str             # "Company" | "Person"
    weight: float = 1.0
    event_count: int = 0
    avg_sentiment: float = 0.0


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    event_id: str
    sentiment: float
    timestamp: str
    flagged: bool = False
    weight: float = 1.0


class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
