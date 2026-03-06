// Типы для AiVerse
// TODO: Перенести типы из apps/telegram/src/types

export interface User {
    user_id: number;
    auth_id?: string;
    email?: string;
    username?: string;
    balance: number;
}

export interface Generation {
    id: number;
    user_id: number;
    prompt: string;
    image_url: string;
    model: string;
    created_at: string;
}

export * from './workflow'
