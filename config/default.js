import dotenv from 'dotenv';
dotenv.config();

export const config = {
    geminiKey: process.env.GEMINI_API_KEY,
    pexelsKey: process.env.PEXELS_API_KEY,
    jamendoKey: process.env.JAMENDO_CLIENT_ID,
    port: process.env.PORT || 5000
};
