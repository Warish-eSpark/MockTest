import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "./db";

export type AuthRole = "student" | "editor" | "reviewer" | "admin";
export type AuthUser = { id: string; email: string; displayName: string; role: AuthRole };
type StoredUser = AuthUser & { passwordHash: string; salt: string };

const globalForAuth = globalThis as unknown as { users?: Map<string, StoredUser>; sessions?: Map<string, string> };
const users = globalForAuth.users ?? new Map<string, StoredUser>();
const sessions = globalForAuth.sessions ?? new Map<string, string>();
if (process.env.NODE_ENV !== "production") { globalForAuth.users = users; globalForAuth.sessions = sessions; }

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 64).toString("hex");
const publicUser = ({ id, email, displayName, role }: StoredUser): AuthUser => ({ id, email, displayName, role });
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function registerUser(email: string, password: string, displayName: string) {
  return createUser(email, password, displayName, "student");
}

export async function bootstrapAdmin(email: string, password: string, displayName: string) {
  if ([...users.values()].some((user) => user.role === "admin")) return { error: "An administrator is already configured." } as const;
  try {
    const [rows] = await db.query<(RowDataPacket & { count: number })[]>("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
    if (Number(rows[0]?.count ?? 0) > 0) return { error: "An administrator is already configured." } as const;
  } catch {
    if (process.env.NODE_ENV === "production") return { error: "Admin bootstrap requires an available database." } as const;
  }
  return createUser(email, password, displayName, "admin");
}

async function createUser(email: string, password: string, displayName: string, role: AuthRole) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || password.length < 8 || !displayName.trim()) return { error: "Enter a name, valid email, and password of at least 8 characters." } as const;
  const salt = randomBytes(16).toString("hex");
  let user: StoredUser = { id: randomBytes(16).toString("hex"), email: normalizedEmail, displayName: displayName.trim(), role, salt, passwordHash: hashPassword(password, salt) };
  try {
    const [insert] = await db.execute<ResultSetHeader>("INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)", [user.email, `${salt}:${user.passwordHash}`, user.displayName, user.role]);
    user = { ...user, id: String(insert.insertId) };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") return { error: "An account with this email already exists." } as const;
    if (users.has(normalizedEmail)) return { error: "An account with this email already exists." } as const;
    users.set(normalizedEmail, user);
    return { user: publicUser(user), token: createSession(user.id) } as const;
  }
  users.set(normalizedEmail, user);
  const token = createSession(user.id);
  try { await db.execute("INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))", [tokenHash(token), user.id]); } catch { /* Local fallback session remains available. */ }
  return { user: publicUser(user), token } as const;
}

export async function loginUser(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  let user = users.get(normalizedEmail);
  try {
    const [rows] = await db.query<(RowDataPacket & { id: string; email: string; password_hash: string; display_name: string; role: AuthRole })[]>("SELECT id, email, password_hash, display_name, role FROM users WHERE email = ? AND status = 'active' LIMIT 1", [normalizedEmail]);
    if (rows[0]) {
      const [salt, passwordHash] = rows[0].password_hash.split(":");
      user = { id: rows[0].id, email: rows[0].email, displayName: rows[0].display_name, role: rows[0].role, salt, passwordHash };
      users.set(normalizedEmail, user);
    }
  } catch {
    // Use local memory storage until the XAMPP schema is initialized.
  }
  if (!user) return { error: "Email or password is incorrect." } as const;
  const expected = Buffer.from(user.passwordHash, "hex");
  const actual = Buffer.from(hashPassword(password, user.salt), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { error: "Email or password is incorrect." } as const;
  const token = createSession(user.id);
  try { await db.execute("INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))", [tokenHash(token), user.id]); } catch { /* Local fallback session remains available. */ }
  return { user: publicUser(user), token } as const;
}

function createSession(userId: string) {
  const token = createHash("sha256").update(`${userId}:${randomBytes(32).toString("hex")}`).digest("hex");
  sessions.set(token, userId);
  return token;
}

export async function getUserForToken(token: string | undefined) {
  if (!token) return null;
  try {
    const [rows] = await db.query<(RowDataPacket & { id: string; email: string; display_name: string; role: AuthRole })[]>("SELECT u.id, u.email, u.display_name, u.role FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP() AND u.status = 'active' LIMIT 1", [tokenHash(token)]);
    if (rows[0]) return { id: rows[0].id, email: rows[0].email, displayName: rows[0].display_name, role: rows[0].role };
  } catch {
    // Resolve against local memory when MySQL is unavailable.
  }
  const userId = sessions.get(token);
  if (!userId) return null;
  return [...users.values()].find((user) => user.id === userId) ? publicUser([...users.values()].find((user) => user.id === userId)!) : null;
}

export async function deleteSession(token: string | undefined) {
  if (!token) return;
  sessions.delete(token);
  try { await db.execute("DELETE FROM user_sessions WHERE token_hash = ?", [tokenHash(token)]); } catch { /* Session is already removed from local fallback storage. */ }
}
