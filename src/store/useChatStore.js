// store/useChatStore.js
import { create } from 'zustand';

const useChatStore = create((set) => ({
  currentUser: localStorage.getItem('currentUser'),
  selectedUser: null,
  messages: [],
  
  setCurrentUser: (user) => set({ currentUser: user || localStorage.getItem('currentUser') }),
  setSelectedUser: (user) => set({ selectedUser: user }),
  
  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  // Reset store - useful for logout
  resetStore: () => set({
    currentUser: null,
    selectedUser: null,
    messages: []
  })
}));

export default useChatStore;