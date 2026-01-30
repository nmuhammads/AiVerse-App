import 'dotenv/config';

export default {
    ...require('./app.json'),
    expo: {
        ...require('./app.json').expo,
        extra: {
            // Use EXPO_PUBLIC_API_URL from environment or fallback to production
            apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://aiverse-telegram-app-production.up.railway.app',
        },
    },
};
