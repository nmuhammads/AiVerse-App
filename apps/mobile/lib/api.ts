import Constants from 'expo-constants';

// Get API URL from Expo config (set in app.config.ts)
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://aiverse-telegram-app-production.up.railway.app';

interface ApiResponse<T = unknown> {
    success?: boolean;
    error?: string;
    items?: T[];
    data?: T;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private async request<T>(
        method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
        path: string,
        body?: object
    ): Promise<T> {
        const url = `${this.baseUrl}/api${path}`;

        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        console.log(`[API] ${method} ${path}`);

        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            console.error(`[API Error] ${method} ${path}:`, data);
            throw new Error(data.error || 'API request failed');
        }

        return data;
    }

    // GET request
    async get<T>(path: string): Promise<T> {
        return this.request<T>('GET', path);
    }

    // POST request
    async post<T>(path: string, body: object): Promise<T> {
        return this.request<T>('POST', path, body);
    }

    // PATCH request
    async patch<T>(path: string, body: object): Promise<T> {
        return this.request<T>('PATCH', path, body);
    }

    // DELETE request
    async delete<T>(path: string): Promise<T> {
        return this.request<T>('DELETE', path);
    }
}

export const api = new ApiClient(API_URL);

// Export the base URL for debugging
export const getApiUrl = () => API_URL;
