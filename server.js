import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// ✅ အသစ်ထပ်ထည့်ထားသော ffmpeg (Audio အရှည်တိုင်းရန်အတွက်)
import ffmpeg from 'fluent-ffmpeg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { analyzeTranscript } from './services/gemini.js';
import { fetchStockVideo } from './services/pexels.js';
import { fetchMusic } from './services/jamendo.js';
import { renderReel } from './services/ffmpeg.js';

const app = express();
app.use(cors());
app.use(express.json());

const RENDERS_DIR = path.join(process.cwd(), 'renders');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(RENDERS_DIR)) fs.mkdirSync(RENDERS_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({ dest: 'uploads/' });

const jobs = new Map();

// 🌟 Audio ကြာချိန်ကို အတိအကျ တိုင်းတာပေးမည့် Helper Function (အသစ်)
const getAudioDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error("ffprobe Error:", err);
                reject(err);
            } else {
                resolve(metadata.format.duration);
            }
        });
    });
};

app.get('/renders/:filename', (req, res) => {
    const filePath = path.join(RENDERS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('ဗီဒီယိုဖိုင်ကို ရှာမတွေ့ပါဘူး။');
    }
});

app.post('/api/generate', upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
    if (!req.body.script) return res.status(400).json({ error: 'No script provided' });

    const jobId = `job_${Date.now()}`;
    const audioPath = req.file.path;

    jobs.set(jobId, { status: 'processing' });
    res.json({ jobId });

    try {
        const outputFilename = `reel_${Date.now()}.mp4`;
        const outputPath = path.join(RENDERS_DIR, outputFilename);

        console.log(`[${jobId}] Processing started...`);

        // 🌟 အဆင့် (၁) - Audio ဖိုင်ရဲ့ စုစုပေါင်း ကြာချိန်ကို အရင်တိုင်းမယ်
        const totalDuration = await getAudioDuration(audioPath);
        console.log(`[${jobId}] 🎵 Audio Duration detected: ${totalDuration} seconds`);

        // 🌟 အဆင့် (၂) - AI ဆီကို script ရော၊ duration ပါ ပို့ပေးလိုက်မယ်
        const aiPlan = await analyzeTranscript(req.body.script, totalDuration);
        
        // အဆင့် (၃) - Pexels ကနေ ဗီဒီယိုတွေ လှမ်းရှာမယ်
        const scenesWithVideo = await Promise.all(aiPlan.scenes.map(async scene => {
            const videoPath = await fetchStockVideo(scene.search_keyword);
            return { ...scene, videoPath };
        }));
        
        // အဆင့် (၄) - နောက်ခံတေးဂီတ ရှာမယ်
        const musicPath = await fetchMusic(aiPlan.global_mood);
        
        // အဆင့် (၅) - အားလုံးပေါင်းပြီး Video ထုတ်မယ်
        await renderReel(audioPath, scenesWithVideo, musicPath, outputPath);

        // အလုပ်ပြီးရင် ယာယီအသံဖိုင်ကို ဖျက်မယ်
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

        const videoUrl = `${process.env.BASE_URL}/renders/${outputFilename}`;
        jobs.set(jobId, { status: 'done', videoUrl });
        console.log(`[${jobId}] ✅ Done: ${videoUrl}`);

    } catch (err) {
        console.error(`[${jobId}] ❌ Error:`, err.message);
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        jobs.set(jobId, { status: 'error', error: err.message });
    }
});

app.get('/api/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 AutoReel AI Engine running on port ${PORT}`);
    console.log(`📁 Renders folder: ${RENDERS_DIR}`);
});

