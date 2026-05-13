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
app.use(cors());
app.use(express.json());

// အမြဲတမ်း Absolute Path ကို သုံးဖို့ သတ်မှတ်ပါတယ်
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const RENDERS_DIR = path.join(__dirname, 'renders');

const dirs = [UPLOADS_DIR, RENDERS_DIR];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const upload = multer({ dest: 'uploads/' });

// Render က static ဖိုင်တွေကို အပြင်က လှမ်းကြည့်လို့ရအောင် ဖွင့်ပေးခြင်း
app.use('/renders', express.static(RENDERS_DIR));

app.post('/api/generate', upload.single('audio'), async (req, res) => {
    let audioPath = null;
    try {
        if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
        
        const userScript = req.body.script;
        if (!userScript) return res.status(400).json({ error: 'No script provided' });

        audioPath = req.file.path;
        const outputFilename = `reel_${Date.now()}.mp4`;
        const outputPath = path.join(RENDERS_DIR, outputFilename);

        console.log('Step 1: Using provided script...');

        console.log('Step 2: AI Planning...');
        const aiPlan = await analyzeTranscript(userScript);

        console.log('Step 3: Fetching Assets...');
        const scenesWithVideo = await Promise.all(aiPlan.scenes.map(async scene => {
            const videoPath = await fetchStockVideo(scene.search_keyword);
            return { ...scene, videoPath };
        }));
        const musicPath = await fetchMusic(aiPlan.global_mood);

        console.log('Step 4: Rendering Video...');
        // ffmpeg.js က ပြန်ပေးတဲ့ ဖိုင်နာမည်ကို ယူပါမယ်
        const finalFile = await renderReel(audioPath, scenesWithVideo, musicPath, outputPath);

        // Rendering ပြီးသွားရင် မူရင်း Upload တင်ထားတဲ့ Audio ကို ဖျက်ပစ်ပါမယ် (RAM/Disk ချွေတာရေး)
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

        // အောင်မြင်ကြောင်း ပြန်ပို့ပေးပါမယ်
        res.json({ 
            success: true, 
            videoUrl: finalFile, // ဖိုင်နာမည်ပဲ ပို့လိုက်ပါမယ်
            fullPath: `${req.protocol}://${req.get('host')}/renders/${finalFile}`
        });

    } catch (error) {
        console.error('Pipeline Error:', error);
        // Error တက်ရင်လည်း audio ဖိုင်ရှိရင် ဖျက်ပေးပါမယ်
        if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        res.status(500).json({ success: false, error: 'Pipeline failed', details: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`AutoReel AI Engine running on port ${PORT}`));

