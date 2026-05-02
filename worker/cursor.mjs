// DB-backed transcript cursor. Replaces cctm-agent state.ts.

export function getCursor(db, sessionId) {
  const row = db.prepare('SELECT sessionId, transcriptPath, byteOffset FROM SessionCursor WHERE sessionId = ?').get(sessionId);
  return row || null;
}

export function setCursor(db, sessionId, transcriptPath, byteOffset) {
  db.prepare(`
    INSERT INTO SessionCursor (sessionId, transcriptPath, byteOffset, updatedAt)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(sessionId) DO UPDATE SET
      transcriptPath = excluded.transcriptPath,
      byteOffset     = excluded.byteOffset,
      updatedAt      = datetime('now')
  `).run(sessionId, transcriptPath, byteOffset);
}

export function advanceCursor(db, sessionId, byteOffset) {
  db.prepare("UPDATE SessionCursor SET byteOffset = ?, updatedAt = datetime('now') WHERE sessionId = ?")
    .run(byteOffset, sessionId);
}
