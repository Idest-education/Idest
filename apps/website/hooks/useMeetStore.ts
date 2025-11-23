"use client";

import { create } from "zustand";
import {
  LiveKitCredentials,
  MeetChatMessage,
  MeetParticipant,
  MeetState,
} from "@/types/meet";

export interface MeetStore extends MeetState {
  setSessionId: (sessionId: string | null) => void;
  setJoining: (joining: boolean) => void;
  setSocketConnected: (connected: boolean) => void;
  setLiveKitConnected: (connected: boolean) => void;
  setLivekitCredentials: (credentials: LiveKitCredentials | null) => void;
  setLocalUserId: (userId: string | null) => void;

  // Participants
  setParticipants: (participants: MeetParticipant[]) => void;
  upsertParticipant: (participant: MeetParticipant) => void;
  removeParticipant: (userId: string) => void;
  setParticipantMediaState: (
    userId: string,
    updates: Partial<Pick<MeetParticipant, "isAudioEnabled" | "isVideoEnabled" | "isScreenSharing">>,
  ) => void;

  // Chat
  addChatMessage: (message: MeetChatMessage) => void;
  prependChatMessages: (messages: MeetChatMessage[], hasMore: boolean) => void;
  setMessagesLoading: (loading: boolean) => void;

  // Media + screen share + recording
  setAudioEnabled: (enabled: boolean) => void;
  setVideoEnabled: (enabled: boolean) => void;
  setScreenSharing: (isSharing: boolean) => void;
  setActiveScreenSharer: (userId: string | null) => void;
  setRecording: (isRecording: boolean) => void; // NEW

  // UI
  toggleChat: (value?: boolean) => void;
  toggleParticipants: (value?: boolean) => void;

  // Errors
  setError: (message: string | null) => void;

  reset: () => void;
}

const initialState: MeetState = {
  sessionId: null,
  isSocketConnected: false,
  isLiveKitConnected: false,
  isJoining: false,
  livekitCredentials: null,
  localUserId: null,
  isAudioEnabled: true,
  isVideoEnabled: true,
  isScreenSharing: false,
  activeScreenSharer: null,
  isRecording: false, // NEW
  participants: {},
  messages: [],
  hasMoreMessages: true,
  isLoadingMessages: false,
  showChat: false,
  showParticipants: false,
  error: null,
  lastUpdatedAt: Date.now(),
};

export const useMeetStore = create<MeetStore>((set, _get) => ({
  ...initialState,

  setSessionId: (sessionId) => set({ sessionId }),
  setJoining: (isJoining) => set({ isJoining }),
  setSocketConnected: (isSocketConnected) => set({ isSocketConnected }),
  setLiveKitConnected: (isLiveKitConnected) => set({ isLiveKitConnected }),
  setLivekitCredentials: (livekitCredentials) => set({ livekitCredentials }),
  setLocalUserId: (localUserId) => set({ localUserId }),

  setParticipants: (participants) =>
    set({
      participants: participants.reduce<Record<string, MeetParticipant>>((acc, participant) => {
        acc[participant.userId] = participant;
        return acc;
      }, {}),
      lastUpdatedAt: Date.now(),
    }),

  upsertParticipant: (participant) =>
    set((state) => ({
      participants: {
        ...state.participants,
        [participant.userId]: {
          ...state.participants[participant.userId],
          ...participant,
        },
      },
      lastUpdatedAt: Date.now(),
    })),

  removeParticipant: (userId) =>
    set((state) => {
      const next = { ...state.participants };
      delete next[userId];
      return { participants: next, lastUpdatedAt: Date.now() };
    }),

  setParticipantMediaState: (userId, updates) =>
    set((state) => {
      const participant = state.participants[userId];
      if (!participant) return {};
      return {
        participants: {
          ...state.participants,
          [userId]: {
            ...participant,
            ...updates,
          },
        },
        lastUpdatedAt: Date.now(),
      };
    }),

  addChatMessage: (message) =>
    set((state) => {
      // Prevent duplicate messages
      const messageExists = state.messages.some((msg) => msg.id === message.id);
      if (messageExists) {
        return state;
      }
      return {
        messages: [...state.messages, message],
        lastUpdatedAt: Date.now(),
      };
    }),

  prependChatMessages: (messages, hasMore) =>
    set((state) => {
      // Filter out duplicates - only add messages that don't already exist
      const existingIds = new Set(state.messages.map((msg) => msg.id));
      const newMessages = messages.filter((msg) => !existingIds.has(msg.id));
      return {
        messages: [...newMessages, ...state.messages],
        hasMoreMessages: hasMore,
        lastUpdatedAt: Date.now(),
      };
    }),

  setMessagesLoading: (isLoadingMessages) => set({ isLoadingMessages }),

  setAudioEnabled: (isAudioEnabled) => set({ isAudioEnabled }),
  setVideoEnabled: (isVideoEnabled) => set({ isVideoEnabled }),
  setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),
  setActiveScreenSharer: (activeScreenSharer) => set({ activeScreenSharer }),
  setRecording: (isRecording) => set({ isRecording }), // NEW

  toggleChat: (value) =>
    set((state) => {
      const newValue = typeof value === "boolean" ? value : !state.showChat;
      return {
        showChat: newValue,
        // Close participants panel when opening chat
        showParticipants: newValue ? false : state.showParticipants,
      };
    }),

  toggleParticipants: (value) =>
    set((state) => {
      const newValue = typeof value === "boolean" ? value : !state.showParticipants;
      return {
        showParticipants: newValue,
        // Close chat panel when opening participants
        showChat: newValue ? false : state.showChat,
      };
    }),

  setError: (error) => set({ error }),

  reset: () => set({ ...initialState, lastUpdatedAt: Date.now() }),
}));

export const meetSelectors = {
  participantsArray: (state: MeetStore) => Object.values(state.participants),
  chatMessages: (state: MeetStore) => state.messages,
};
