export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // mock only
  createdAt: string;
  avatarUrl?: string;
}
