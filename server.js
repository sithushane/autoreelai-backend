import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🌟 Services အသစ်များကို လှမ်းခေါ်ခြင်း
import { generateVideoScript } from './services/gemini.js';
import { generateAudioForScenes } from './services/tts.js';
import { fetchStockVideo } from './services/pexels.js';
import { fetchMusic } from './services/jamendo.js';
import { renderReel } from './services/ffmpeg.js';

const app = express();
app.use(cors());
app.use(express.json()); // JSON data ကို တိုက်ရိုက်လက်ခံမည်

const RENDERS_DIR = path.join(process.cwd(), 'renders');
if (!fs.existsSync(RENDERS_DIR)) fs.mkdirSync(RENDERS_DIR, { recursive: true });

const jobs = new Map();

app.get('/renders/:filename', (req, res) => {
    const filePath = path.join(RENDERS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('ဗီဒီယိုဖိုင်ကို ရှာမတွေ့ပါဘူး။');
    }
});

// 🌟 API Endpoint အသစ် (Audio upload မလိုတော့ပါ၊ Text (topic) သီးသန့် လက်ခံမည်)
app.post('/api/generate', async (req, res) => {
    const topic = req.body.topic || req.body.script; 
    if (!topic) return res.status(400).json({ error: 'No topic provided! Please send a topic.' });

    const jobId = `job_${Date.now()}`;
    jobs.set(jobId, { status: 'processing' });
    
    // Frontend ကို Job ID ချက်ချင်း ပြန်ပို့ပေးမယ် (Timeout မဖြစ်အောင်)
    res.json({ jobId });

    try {
        const outputFilename = `reel_${Date.now()}.mp4`;
        const outputPath = path.join(RENDERS_DIR, outputFilename);

        console.log(`\n[${jobId}] 🚀 AutoReel Production Started!`);
        console.log(`[${jobId}] 📝 Topic: "${topic}"`);

        // 🌟 အဆင့် (၁) - AI ဆီကနေ Script နဲ့ Scene Plan ကို တောင်းမယ်
        console.log(`[${jobId}] Step 1: Generating Script from Gemini...`);
        const aiPlan = await generateVideoScript(topic);
        
        // 🌟 အဆင့် (၂) - Scene တစ်ခုချင်းစီအတွက် အသံဖိုင်လေးတွေ ထုတ်မယ် (TTS)
        console.log(`[${jobId}] Step 2: Generating TTS Audio...`);
        const scenesWithAudio = await generateAudioForScenes(aiPlan.scenes);
        
        // 🌟 အဆင့် (၃) - Pexels ကနေ ဗီဒီယိုတွေ လှမ်းရှာမယ်
        console.log(`[${jobId}] Step 3: Fetching Stock Videos...`);
        const scenesWithVideo = await Promise.all(scenesWithAudio.map(async scene => {
            // Text သက်သက် Scene တွေအတွက် Video မလိုရင် ကျော်သွားဖို့ logic လေးပါ
            if (!scene.keyword) return scene; 
            const videoPath = await fetchStockVideo(scene.keyword);
            return { ...scene, videoPath };
        }));
        
        // 🌟 အဆင့် (၄) - နောက်ခံတေးဂီတ ရှာမယ်
        console.log(`[${jobId}] Step 4: Fetching BGM...`);
        const musicPath = await fetchMusic(aiPlan.global_mood);
        
        // 🌟 အဆင့် (၅) - အားလုံးပေါင်းပြီး Video ထုတ်မယ် (FFmpeg)
        console.log(`[${jobId}] Step 5: Rendering Final Video with Text Overlays...`);
        // audioPath သီးသန့် မပို့တော့ဘဲ scenes ကိုပဲ ပို့လိုက်ပါပြီ
        await renderReel(scenesWithVideo, musicPath, outputPath);

        const videoUrl = `${process.env.BASE_URL}/renders/${outputFilename}`;
        jobs.set(jobId, { status: 'done', videoUrl });
        console.log(`[${jobId}] ✅ Masterpiece Done: ${videoUrl}\n`);

    } catch (err) {
        console.error(`[${jobId}] ❌ Error:`, err.message);
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
    console.log(`🚀 AutoReel AI Production Studio running on port ${PORT}`);
    console.log(`📁 Renders folder: ${RENDERS_DIR}`);
});

