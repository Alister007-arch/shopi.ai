"""
Agent Execution Traces Recorder and Query Service for MOSS E-Commerce.
Captures message, reply, latency, token usage, tool invocations, and execution status.
"""
import json
import sqlite3
import time
from typing import Dict, Any, List, Optional
import backend.tools as tools


def init_traces_table(conn: sqlite3.Connection):
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS agent_traces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_id TEXT NOT NULL,
            user_message TEXT,
            agent_reply TEXT,
            tool_calls TEXT,
            latency_ms INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            model_name TEXT DEFAULT 'qwen3.8-27b',
            status TEXT DEFAULT 'success',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Auto-migrate any columns if table was created in earlier prototype
    cursor.execute("PRAGMA table_info(agent_traces)")
    existing_cols = {col[1] for col in cursor.fetchall()}
    if "total_tokens" not in existing_cols:
        cursor.execute("ALTER TABLE agent_traces ADD COLUMN total_tokens INTEGER DEFAULT 0")
    if "latency_ms" not in existing_cols:
        cursor.execute("ALTER TABLE agent_traces ADD COLUMN latency_ms INTEGER DEFAULT 0")
    if "model_name" not in existing_cols:
        cursor.execute("ALTER TABLE agent_traces ADD COLUMN model_name TEXT DEFAULT 'qwen3.8-27b'")
    if "status" not in existing_cols:
        cursor.execute("ALTER TABLE agent_traces ADD COLUMN status TEXT DEFAULT 'success'")
    if "provider_name" not in existing_cols:
        cursor.execute("ALTER TABLE agent_traces ADD COLUMN provider_name TEXT DEFAULT ''")
    if "error_type" not in existing_cols:
        cursor.execute("ALTER TABLE agent_traces ADD COLUMN error_type TEXT DEFAULT ''")
    conn.commit()


def record_agent_trace(
    thread_id: str,
    user_message: str,
    agent_reply: str,
    tool_calls: Optional[List[Dict[str, Any]]] = None,
    latency_ms: int = 0,
    total_tokens: int = 0,
    model_name: str = "qwen3.8-27b",
    status: str = "success",
    provider_name: str = "",
    error_type: str = "",
) -> int:
    """
    Saves an execution trace of an agent interaction into SQLite database.
    Returns the inserted trace row ID.
    """
    conn = tools.get_db_connection()
    try:
        init_traces_table(conn)
        cursor = conn.cursor()
        tools_str = json.dumps(tool_calls or [])
        cursor.execute("""
            INSERT INTO agent_traces (
                thread_id, user_message, agent_reply, tool_calls,
                latency_ms, total_tokens, model_name, status,
                provider_name, error_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            thread_id or "default_session",
            user_message,
            agent_reply,
            tools_str,
            latency_ms,
            total_tokens,
            model_name,
            status,
            provider_name,
            error_type,
        ))
        conn.commit()
        return cursor.lastrowid
    except Exception as e:
        print(f"[Trace Error] Failed to record trace: {e}")
        return 0
    finally:
        conn.close()


def list_agent_traces(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    """
    Fetches recent agent interaction traces for admin inspection.
    """
    conn = tools.get_db_connection()
    try:
        init_traces_table(conn)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, thread_id, user_message, agent_reply, tool_calls,
                   latency_ms, total_tokens, model_name, status,
                   provider_name, error_type, created_at
            FROM agent_traces
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        """, (limit, offset))
        rows = cursor.fetchall()
        result = []
        for r in rows:
            result.append({
                "id": r["id"],
                "thread_id": r["thread_id"],
                "user_message": r["user_message"],
                "agent_reply": r["agent_reply"],
                "tool_calls": json.loads(r["tool_calls"]) if r["tool_calls"] else [],
                "latency_ms": r["latency_ms"],
                "total_tokens": r["total_tokens"],
                "model_name": r["model_name"],
                "status": r["status"],
                "provider_name": r["provider_name"] if "provider_name" in r.keys() else "",
                "error_type": r["error_type"] if "error_type" in r.keys() else "",
                "created_at": r["created_at"],
            })
        return result
    finally:
        conn.close()

