import type { RowDataPacket } from "mysql2";
import { db } from "./db";

export type AuditEvent = { actorId: string; action: string; entityType: string; entityId: string; details: unknown; createdAt: string };
const globalForAudit = globalThis as unknown as { auditEvents?: AuditEvent[] };
const auditEvents = globalForAudit.auditEvents ?? [];
if (process.env.NODE_ENV !== "production") globalForAudit.auditEvents = auditEvents;

export async function recordAuditEvent(event: Omit<AuditEvent, "createdAt">) {
  const createdAt = new Date().toISOString();
  try {
    await db.execute("INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)", [event.actorId, event.action, event.entityType, event.entityId, JSON.stringify(event.details)]);
  } catch {
    auditEvents.push({ ...event, createdAt });
  }
}

export async function getRecentAuditEvents() {
  try {
    const [rows] = await db.query<(RowDataPacket & { actor_email: string | null; action: string; entity_type: string; entity_id: string; details: string | object | null; created_at: Date | string })[]>("SELECT u.email AS actor_email, a.action, a.entity_type, a.entity_id, a.details, a.created_at FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id ORDER BY a.created_at DESC LIMIT 30");
    return rows.map((row) => ({ actor: row.actor_email ?? "Unknown operator", action: row.action, entityType: row.entity_type, entityId: row.entity_id, details: typeof row.details === "string" ? JSON.parse(row.details) : row.details, createdAt: new Date(row.created_at).toISOString() }));
  } catch {
    return auditEvents.slice(-100).reverse().map((event) => ({ actor: event.actorId, action: event.action, entityType: event.entityType, entityId: event.entityId, details: event.details, createdAt: event.createdAt }));
  }
}
