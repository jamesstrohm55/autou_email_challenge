import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "classification.db")

def init_db():
    """Create the classifications tavle if it doesnt exist already"""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
                 CREATE TABLE IF NOT EXISTS classifications (
                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                     timestamp TEXT NOT NULL,
                     input_text TEXT NOT NULL,
                     classification TEXT NOT NULL,
                     confidence TEXT NOT NULL,
                     reasoning TEXT,
                     suggested_reply TEXT,
                     original_length INTEGER,
                     preprocessed_length INTEGER,
                     was_retried INTEGER DEFAULT 0
                 )
    """)
    conn.commit()
    conn.close()
    
def save_classification(input_text: str, result: dict, was_retried: bool = False):
    """Save a classification result to DB"""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
                 INSERT INTO classifications (
                     timestamp,
                     input_text,
                     classification,
                     confidence,
                     reasoning,
                     suggested_reply,
                     original_length,
                     preprocessed_length,
                     was_retried)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
            datetime.now().isoformat(),
            input_text[:500],
            result.get("classification", "Unknown"),
            result.get("confidence", "Unknown"),
            result.get("reasoning", ""),
            result.get("suggested_reply", ""),
            result.get("original_length", 0),
            result.get("preprocessed_length", 0),
            1 if was_retried else 0,
        ),
    )
    conn.commit()
    conn.close()
    
def get_stats() -> dict:
    """Return classification stats for dashboard"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    total = cur.execute("SELECT COUNT(*) as c FROM classifications").fetchone()["c"]
    
    if total == 0:
        conn.close()
        return {"total": 0, "message": "No classifications yet."}
    
    by_class = cur.execute("SELECT classification, COUNT(*) as c FROM classifications GROUP BY classification").fetchall()
    
    by_confidence = cur.execute("SELECT confidence, COUNT(*) as c FROM classifications GROUP BY confidence").fetchall()
    
    retried = cur.execute("SELECT COUNT(*) as c FROM classifications WHERE was_retried=1").fetchone()["c"]
    
    conn.close()
    
    return {
        "total": total,
        "by_classification": {row["classification"]: row["c"] for row in by_class},
        "by_confidence": {row["confidence"]: row["c"] for row in by_confidence},
        "retried": retried,
        "productive_pct": round(
            sum(r["c"] for r in by_class if r["classification"] == "Productive") / total * 100, 1
        ),
    }
    
def get_history(limit: int = 20, offset: int = 0) -> list:
    """Return recent classification history for dashboard"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM classifications ORDER BY id DESC LIMIT ? OFFSET ?", (limit, offset),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]