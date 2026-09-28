import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type AuthUser = { id: string; email: string; displayName: string; role: "student" | "admin" };
type StoredUser = AuthUser & { passwordHash: string; salt: string };

const globalForAuth = globalThis as unknown as { users?: Map<string, StoredUser>; sessions?: Map<string, string> };
const users = globalForAuth.users ?? new Map<string, StoredUser>();
const sessions = globalForAuth.sessions ?? new Map<string, string>();
if (process.env.NODE_ENV !== "production") { globalForAuth.users = users; globalForAuth.sessions = sessions; }

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 64).toString("hex");
const publicUser = ({ id, email, displayName, role }: StoredUser): AuthUser => ({ id, email, displayName, role });

export function registerUser(email: string, password: string, displayName: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || password.length < 8 || !displayName.trim()) return { error: "Enter a name, valid email, and password of at least 8 characters." } as const;
  if (users.has(normalizedEmail)) return { error: "An account with this email already exists." } as const;
  const salt = randomBytes(16).toString("hex");
  const user: StoredUser = { id: randomBytes(16).toString("hex"), email: normalizedEmail, displayName: displayName.trim(), role: "student", salt, passwordHash: hashPassword(password, salt) };
  users.set(normalizedEmail, user);
  return { user: publicUser(user), token: createSession(user.id) } as const;
}

export function loginUser(email: string, password: string) {
  const user = users.get(normalizeEmail(email));
  if (!user) return { error: "Email or password is incorrect." } as const;
  const expected = Buffer.from(user.passwordHash, "hex");
  const actual = Buffer.from(hashPassword(password, user.salt), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { error: "Email or password is incorrect." } as const;
  return { user: publicUser(user), token: createSession(user.id) } as const;
}

function createSession(userId: string) {
  const token = createHash("sha256").update(`${userId}:${randomBytes(32).toString("hex")}`).digest("hex");
  sessions.set(token, userId);
  return token;
}

export function getUserForToken(token: string | undefined) {
  const userId = token ? sessions.get(token) : undefined;
  if (!userId) return null;
  return [...users.values()].find((user) => user.id === userId) ? publicUser([...users.values()].find((user) => user.id === userId)!) : null;
}

export function deleteSession(token: string | undefined) {
  if (token) sessions.delete(token);
}
