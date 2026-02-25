import { Injectable } from '@nestjs/common';

export interface ConnectedUser {
  userId: string;
  socketId: string;
  userFullName: string;
  userAvatar?: string;
  role: string;
  sessionId: string;
  connectedAt: Date;
}

@Injectable()
export class ConnectedUsersManager {
  // Map: sessionId -> Map: userId -> ConnectedUser
  private sessionUsers = new Map<string, Map<string, ConnectedUser>>();
  // Map: socketId -> ConnectedUser (for quick lookup on disconnect)
  private socketToUser = new Map<string, ConnectedUser>();

  /**
   * Add a user to a session
   */
  addUser(user: ConnectedUser): void {
    // Add to session map
    if (!this.sessionUsers.has(user.sessionId)) {
      this.sessionUsers.set(user.sessionId, new Map());
    }
    this.sessionUsers.get(user.sessionId)!.set(user.userId, user);

    // Add to socket lookup map
    this.socketToUser.set(user.socketId, user);
  }

  /**
   * Remove a user by socket ID
   */
  removeUserBySocket(socketId: string): ConnectedUser | null {
    const user = this.socketToUser.get(socketId);
    if (!user) return null;

    // Remove from session map
    const sessionMap = this.sessionUsers.get(user.sessionId);
    if (sessionMap) {
      sessionMap.delete(user.userId);
      // Clean up empty session maps
      if (sessionMap.size === 0) {
        this.sessionUsers.delete(user.sessionId);
      }
    }

    // Remove from socket map
    this.socketToUser.delete(socketId);

    return user;
  }

  /**
   * Remove a user by user ID and session ID
   */
  removeUser(userId: string, sessionId: string): ConnectedUser | null {
    const sessionMap = this.sessionUsers.get(sessionId);
    if (!sessionMap) return null;

    const user = sessionMap.get(userId);
    if (!user) return null;

    // Remove from both maps
    sessionMap.delete(userId);
    this.socketToUser.delete(user.socketId);

    // Clean up empty session map
    if (sessionMap.size === 0) {
      this.sessionUsers.delete(sessionId);
    }

    return user;
  }

  /**
   * Get user by socket ID
   */
  getUserBySocket(socketId: string): ConnectedUser | null {
    return this.socketToUser.get(socketId) || null;
  }

  /**
   * Get user by user ID and session ID
   */
  getUser(userId: string, sessionId: string): ConnectedUser | null {
    const sessionMap = this.sessionUsers.get(sessionId);
    return sessionMap?.get(userId) || null;
  }

  /**
   * Get all users in a session
   */
  getSessionUsers(sessionId: string): ConnectedUser[] {
    const sessionMap = this.sessionUsers.get(sessionId);
    return sessionMap ? Array.from(sessionMap.values()) : [];
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessionUsers.keys());
  }

  /**
   * Check if a user is connected to a session
   */
  isUserConnected(userId: string, sessionId: string): boolean {
    const sessionMap = this.sessionUsers.get(sessionId);
    return sessionMap?.has(userId) || false;
  }

  /**
   * Get user count in a session
   */
  getSessionUserCount(sessionId: string): number {
    const sessionMap = this.sessionUsers.get(sessionId);
    return sessionMap?.size || 0;
  }

  /**
   * Get socket IDs for all users in a session (useful for broadcasting)
   */
  getSessionSocketIds(sessionId: string): string[] {
    const users = this.getSessionUsers(sessionId);
    return users.map((user) => user.socketId);
  }

  /**
   * Get socket ID for a specific user in a session
   */
  getUserSocketId(userId: string, sessionId: string): string | null {
    const user = this.getUser(userId, sessionId);
    return user?.socketId || null;
  }
}
