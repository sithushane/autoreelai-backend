import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { exec } from 'child_process';
import path from 'path';
import { analyzeTranscript } from './services/gemini.js';
import { fetchStockVideo } from './services/pexels.js';
import { fetchMusic } from './services/jamendo.js';
import { renderReel } from './services/ffmpeg.js';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

app.post('/api/generate', upload.single('audio'), async (req, res) => {
    try {
        const audioPath = req.file.path;
        const outputPath = path.join('renders', `reel_${Date.now()}.mp4`);

        // Step 1: Transcribe (Local python faster-whisper)
        const transcriptRaw = await new Promise((resolve, reject) => {
            exec(`python python/transcribe.py ${audioPath}`, (err, stdout) => {
                if (err) reject(err);
                else resolve(JSON.parse(stdout));
            });
        });

        // Step 2: Gemini Scene Planning
        const aiPlan = await analyzeTranscript(transcriptRaw);

        // Step 3 & 4: Fetch Assets (Mocked API wrapper calls)
        const scenesWithVideo = await Promise.all(aiPlan.scenes.map(async scene => {
            const videoPath = await fetchStockVideo(scene.search_keyword);
            return { ...scene, videoPath };
        }));
        const musicPath = await fetchMusic(aiPlan.global_mood);

        // Step 5: Render Video
        await renderReel(audioPath, scenesWithVideo, musicPath, outputPath);

        res.json({ success: true, videoUrl: `/${outputPath}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Pipeline failed' });
    }
});

app.use('/renders', express.static('renders'));

app.listen(5000, () => console.log('AutoReel AI Engine running on port 5000'));
