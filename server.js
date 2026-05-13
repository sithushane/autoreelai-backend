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

const RENDERS_DIR = path.join(process.cwd(), 'renders');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(RENDERS_DIR)) fs.mkdirSync(RENDERS_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true }); // ✅ UPLOADS_PATH → UPLOADS_DIR

const upload = multer({ dest: 'uploads/' });

app.get('/renders/:filename', (req, res) => {
    const filePath = path.join(RENDERS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('ဗီဒီယိုဖိုင်ကို စက်ထဲမှာ ရှာမတွေ့ပါဘူး။ Render က စက်ကို Restart ချလိုက်လို့ ဖိုင်ပျောက်သွားတာ ဖြစ်နိုင်ပါတယ်။');
    }
});

app.post('/api/generate', upload.single('audio'), async (req, res) => {
    let currentAudio = null;
    try {
        if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
        const userScript = req.body.script;
        if (!userScript) return res.status(400).json({ error: 'No script provided' });

        currentAudio = req.file.path;
        const outputFilename = `reel_${Date.now()}.mp4`;
        const outputPath = path.join(RENDERS_DIR, outputFilename);

        console.log('--- Processing Started ---');
        const aiPlan = await analyzeTranscript(userScript);
        const scenesWithVideo = await Promise.all(aiPlan.scenes.map(async scene => {
            const videoPath = await fetchStockVideo(scene.search_keyword);
            return { ...scene, videoPath };
        }));
        const musicPath = await fetchMusic(aiPlan.global_mood);

        await renderReel(currentAudio, scenesWithVideo, musicPath, outputPath); // ✅ return value မယူတော့ဘူး

        if (fs.existsSync(currentAudio)) fs.unlinkSync(currentAudio);

        console.log(`✅ Successfully generated: ${outputFilename}`);

        res.json({ 
            success: true, 
            videoUrl: outputFilename,                                                          // ✅ filename ပဲပေးတယ်
            fullPath: `${req.protocol}://${req.get('host')}/renders/${outputFilename}`         // ✅ outputFilename သုံးတယ်
        });

    } catch (error) {
        console.error('Pipeline Error:', error);
        if (currentAudio && fs.existsSync(currentAudio)) fs.unlinkSync(currentAudio);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 AutoReel AI Engine running on port ${PORT}`);
    console.log(`📁 Renders folder: ${RENDERS_DIR}`);
});
