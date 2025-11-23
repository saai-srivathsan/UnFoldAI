import { User } from "../types";
import { storageService } from "./storageService";

// Mock delay helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    await delay(800); // Simulate network request
    
    // Mock validation (accept any email/password for demo)
    if (!email || !password) {
      throw new Error("Invalid credentials");
    }

    const user: User = {
      id: "user-123",
      name: email.split("@")[0],
      email: email,
      avatarUrl: `https://ui-avatars.com/api/?name=${email.split("@")[0]}&background=0D8ABC&color=fff`,
    };

    storageService.setCurrentUser(user);
    return user;
  },

  register: async (name: string, email: string, password: string): Promise<User> => {
    await delay(1000);
    
    const user: User = {
      id: "user-" + Date.now(),
      name,
      email,
      avatarUrl: `https://ui-avatars.com/api/?name=${name}&background=0D8ABC&color=fff`,
    };

    storageService.setCurrentUser(user);
    return user;
  },

  logout: async () => {
    await delay(500);
    storageService.clearCurrentUser();
  },
};
