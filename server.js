import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { analyzeTranscript } from './services/gemini.js';
import { fetchStockVideo } from './services/pexels.js';
import { fetchMusic } from './services/jamendo.js';
import { renderReel } from './services/ffmpeg.js';

const app = express();

// CORS ကို အသေချာဆုံးဖြစ်အောင် configuration ထည့်ပေးထားပါတယ်
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Render မှာ လမ်းကြောင်းတွေ မလွဲအောင် process.cwd() ကို သုံးတာ အကောင်းဆုံးပါ
const RENDERS_DIR = path.join(process.cwd(), 'renders');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Folder များ မရှိလျှင် အလိုအလျောက် ဆောက်ပေးခြင်း
[RENDERS_DIR, UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

// ✅ static folder ကို route တွေရဲ့ အပေါ်မှာ တိတိကျကျ ကြေညာပေးရပါတယ်
app.use('/renders', express.static(RENDERS_DIR));

const upload = multer({ dest: 'uploads/' });

app.post('/api/generate', upload.single('audio'), async (req, res) => {
    let currentAudioPath = null;
    try {
        if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
        
        const userScript = req.body.script;
        if (!userScript) return res.status(400).json({ error: 'No script provided' });

        currentAudioPath = req.file.path;
        const outputFilename = `reel_${Date.now()}.mp4`;
        const outputPath = path.join(RENDERS_DIR, outputFilename);

        console.log('--- Step 1: Script Received ---');
        console.log('--- Step 2: Planning with Gemini ---');
        const aiPlan = await analyzeTranscript(userScript);

        console.log('--- Step 3: Fetching Video & Music Assets ---');
        const scenesWithVideo = await Promise.all(aiPlan.scenes.map(async scene => {
            const videoPath = await fetchStockVideo(scene.search_keyword);
            return { ...scene, videoPath };
        }));
        const musicPath = await fetchMusic(aiPlan.global_mood);

        console.log('--- Step 4: Starting FFmpeg Rendering ---');
        // ffmpeg.js ထဲမှာ resolves(path.basename(outputPath)) လုပ်ထားတာ သေချာပါစေ
        const finalFile = await renderReel(currentAudioPath, scenesWithVideo, musicPath, outputPath);

        // Rendering ပြီးလျှင် မူရင်း Audio ကို ဖျက်ထုတ်ပြီး RAM/Space ချွေတာပါမယ်
        if (fs.existsSync(currentAudioPath)) fs.unlinkSync(currentAudioPath);

        console.log(`Successfully generated: ${finalFile}`);

        // အောင်မြင်ကြောင်း ပြန်ပို့မည့် Data
        res.json({ 
            success: true, 
            videoUrl: finalFile,
            fullPath: `${req.protocol}://${req.get('host')}/renders/${finalFile}`
        });

    } catch (error) {
        console.error('CRITICAL PIPELINE ERROR:', error);
        if (currentAudioPath && fs.existsSync(currentAudioPath)) fs.unlinkSync(currentAudioPath);
        
        res.status(500).json({ 
            success: false, 
            error: 'Server process crashed or memory limit exceeded', 
            details: error.message 
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`🚀 AutoReel AI Engine running on port ${PORT}`);
    console.log(`📁 Renders folder: ${RENDERS_DIR}`);
    console.log(`========================================`);
});

