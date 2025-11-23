import { User } from "../types/user";

const USERS_KEY = "ais_users";
const CURRENT_USER_ID_KEY = "ais_current_user_id";

function loadUsers(): User[] {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as User[];
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getCurrentUser(): User | null {
  const id = localStorage.getItem(CURRENT_USER_ID_KEY);
  if (!id) return null;
  const users = loadUsers();
  return users.find((u) => u.id === id) ?? null;
}

export function setCurrentUser(user: User | null) {
  if (!user) {
    localStorage.removeItem(CURRENT_USER_ID_KEY);
    return;
  }
  localStorage.setItem(CURRENT_USER_ID_KEY, user.id);
}

export function registerUser(name: string, email: string, password: string): User {
  const users = loadUsers();

  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    throw new Error("A user with this email already exists.");
  }

  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const passwordHash = btoa(password); // ⚠️ mock only, not real security

  const newUser: User = {
    id,
    name,
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
    avatarUrl: `https://ui-avatars.com/api/?name=${name}&background=0D8ABC&color=fff`,
  };

  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);
  return newUser;
}

export function loginUser(email: string, password: string): User {
  const users = loadUsers();
  const candidate = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!candidate) {
    throw new Error("No account found with this email.");
  }

  const passwordHash = btoa(password);
  if (candidate.passwordHash !== passwordHash) {
    throw new Error("Incorrect password.");
  }

  setCurrentUser(candidate);
  return candidate;
}

export function logoutUser() {
  setCurrentUser(null);
}
