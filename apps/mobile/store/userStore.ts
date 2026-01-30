import { create } from 'zustand';

interface User {
    id: number;
    username: string;
    firstName: string;
    lastName?: string;
    avatarUrl?: string;
}

interface UserState {
    // User data - using fixed test user ID for now
    user: User;
    balance: number;
    isLoading: boolean;

    // Actions
    setBalance: (balance: number) => void;
    setUser: (user: User) => void;
    setLoading: (loading: boolean) => void;
}

// Fixed test user ID for development
// TODO: Replace with real auth via Supabase auth schema
const TEST_USER_ID = 817308975;

export const useUserStore = create<UserState>((set) => ({
    user: {
        id: TEST_USER_ID,
        username: 'test',
        firstName: 'Test',
    },
    balance: 0,
    isLoading: false,

    setBalance: (balance) => set({ balance }),
    setUser: (user) => set({ user }),
    setLoading: (isLoading) => set({ isLoading }),
}));

// Helper to get current user ID
export const getUserId = () => useUserStore.getState().user.id;
