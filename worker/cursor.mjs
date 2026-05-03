// DB-backed transcript cursor. Replaces cctm-agent state.ts.

export function getCursor(db, sessionId) {
  const row = db.prepare('SELECT sessionId, transcriptPath, byteOffset FROM SessionCursor WHERE sessionId = ?').get(sessionId);
  return row || null;
}

export function setCursor(db, sessionId, transcriptPath, byteOffset) {
  db.prepare(`
    INSERT INTO SessionCursor (sessionId, transcriptPath, byteOffset, updatedAt)
    VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(sessionId) DO UPDATE SET
      transcriptPath = excluded.transcriptPath,
      byteOffset     = excluded.byteOffset,
      updatedAt      = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `).run(sessionId, transcriptPath, byteOffset);
}

export function advanceCursor(db, sessionId, byteOffset) {
  db.prepare("UPDATE SessionCursor SET byteOffset = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE sessionId = ?")
    .run(byteOffset, sessionId);
}
