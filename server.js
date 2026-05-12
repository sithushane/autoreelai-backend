import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs'; // ဖိုင်တွေရှိမရှိ စစ်ဖို့ လိုအပ်ပါတယ်
import { fileURLToPath } from 'url';

// ES Modules သုံးထားလို့ __dirname ကို ဒီလို သတ်မှတ်ပေးရပါတယ်
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Services တွေကို လောလောဆယ် မရှိသေးရင် Error မတက်အောင် Comment ပိတ်ထားနိုင်ပါတယ်
import { analyzeTranscript } from './services/gemini.js';
import { fetchStockVideo } from './services/pexels.js';
import { fetchMusic } from './services/jamendo.js';
import { renderReel } from './services/ffmpeg.js';

const app = express();
app.use(cors());
app.use(express.json());

// Render မှာ Error မတက်အောင် Folder တွေ ရှိမရှိ စစ်ပြီး ဆောက်ခိုင်းခြင်း
const dirs = ['uploads', 'renders'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

const upload = multer({ dest: 'uploads/' });

app.post('/api/generate', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

        const audioPath = req.file.path;
        const outputFilename = `reel_${Date.now()}.mp4`;
        const outputPath = path.join('renders', outputFilename);

        console.log('Step 1: Transcribing...');
        const transcriptRaw = await new Promise((resolve, reject) => {
            // Python command ကို Render အတွက် python3 လို့ ပြောင်းသုံးတာ ပိုစိတ်ချရပါတယ်
            exec(`python3 python/transcribe.py ${audioPath}`, (err, stdout) => {
                if (err) {
                    console.error('Transcription Error:', err);
                    reject(err);
                } else resolve(JSON.parse(stdout));
            });
        });

        console.log('Step 2: AI Planning...');
        const aiPlan = await analyzeTranscript(transcriptRaw);

        console.log('Step 3: Fetching Assets...');
        const scenesWithVideo = await Promise.all(aiPlan.scenes.map(async scene => {
            const videoPath = await fetchStockVideo(scene.search_keyword);
            return { ...scene, videoPath };
        }));
        const musicPath = await fetchMusic(aiPlan.global_mood);

        console.log('Step 4: Rendering Video...');
        await renderReel(audioPath, scenesWithVideo, musicPath, outputPath);

        // Client ဘက်ကို URL ပြန်ပေးတဲ့အခါ Domain နာမည်ပါအောင် ပေးရပါမယ်
        res.json({ 
            success: true, 
            videoUrl: `${req.protocol}://${req.get('host')}/renders/${outputFilename}` 
        });

    } catch (error) {
        console.error('Pipeline Error:', error);
        res.status(500).json({ error: 'Pipeline failed', details: error.message });
    }
});

app.use('/renders', express.static('renders'));

// Render ပေါ်မှာ Port ကို အရှင်ထားပေးရပါတယ်
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`AutoReel AI Engine running on port ${PORT}`));
