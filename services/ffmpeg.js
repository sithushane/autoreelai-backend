import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

export async function renderReel(audioPath, scenes, musicPath, outputPath) {
    console.log("Step 4.1: Downloading assets using Memory-Safe Streams...");
    
    try {
        const localMusicPath = path.join(process.cwd(), 'renders', `bgm_${Date.now()}.mp3`);
        await downloadFileSafe(musicPath, localMusicPath);

        for (let i = 0; i < scenes.length; i++) {
            console.log(`Downloading video ${i + 1} of ${scenes.length}...`);
            const localVidPath = path.join(process.cwd(), 'renders', `vid_${Date.now()}_${i}.mp4`);
            await downloadFileSafe(scenes[i].videoPath, localVidPath);
            scenes[i].localVideoPath = localVidPath;
        }
        
        console.log("Step 4.2: All assets downloaded safely. Starting FFmpeg...");

        return new Promise((resolve, reject) => {
            let command = ffmpeg();
            let filterChain = '';
            let inputCount = 0;

            // 1. Video Filters
            scenes.forEach((scene, index) => {
                command.input(scene.localVideoPath);
                const duration = scene.end - scene.start;
                filterChain += `[${inputCount}:v]scale=480:854:force_original_aspect_ratio=increase,crop=480:854,setsar=1,fps=24,format=yuv420p,trim=duration=${duration},setpts=PTS-STARTPTS[v${index}];`;
                inputCount++;
            });

            // 2. Concat Videos
            const concatInputs = scenes.map((_, i) => `[v${i}]`).join('');
            filterChain += `${concatInputs}concat=n=${scenes.length}:v=1:a=0[baseV]`;

            // 3. Audio Inputs
            command.input(audioPath); 
            const voiceIdx = inputCount;
            inputCount++;
            
            command.input(localMusicPath); 
            const musicIdx = inputCount;
            
            // 4. Audio Filters
            filterChain += `;[${musicIdx}:a]volume=0.2[bgm];[${voiceIdx}:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[audioOut]`;

            command
                .complexFilter(filterChain)
                .outputOptions([
                    '-map [baseV]',
                    '-map [audioOut]',
                    '-c:v libx264',
                    '-preset veryfast', 
                    '-crf 32',          
                    '-c:a aac',
                    '-b:a 128k',
                    '-threads 1',        
                    '-shortest'
                ])
                .output(outputPath)
                .on('start', (cmd) => {
                    console.log("FFmpeg CMD:", cmd);
                    console.log('FFmpeg Process Started successfully.');
                })
                .on('stderr', (line) => {
                    if(line.includes('Error') || line.includes('Failed') || line.includes('Invalid')) {
                        console.log("FFmpeg Output:", line);
                    }
                })
                .on('progress', (progress) => console.log(`Processing: ${progress.timemark} done...`))
                .on('end', () => {
                    console.log("=================================================");
                    console.log("✅ FFmpeg Render Complete!");
                    // ဒီစာကြောင်းက အရေးကြီးပါတယ် - Render Log မှာ Video နာမည်ကို မြင်ရအောင်ပါ
                    console.log("📁 Video saved at:", path.basename(outputPath)); 
                    console.log("=================================================");
                    
                    safeCleanup([localMusicPath, ...scenes.map(s => s.localVideoPath)]);
                    // ဖိုင်နာမည်ကိုပဲ resolve လုပ်ပြီး ပြန်ပို့ပေးပါမယ်
                    resolve(path.basename(outputPath)); 
                })
                .on('error', (err) => {
                    console.error("FFmpeg Fatal Error:", err.message);
                    safeCleanup([localMusicPath, ...scenes.map(s => s.localVideoPath)]);
                    reject(err);
                })
                .run();
        });
    } catch (error) {
        console.error("Error during download or FFmpeg processing:", error);
        throw error;
    }
}

async function downloadFileSafe(url, destPath) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); 

    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch ${url}`);
        
        const fileStream = fs.createWriteStream(destPath);
        await finished(Readable.fromWeb(res.body).pipe(fileStream));
    } finally {
        clearTimeout(timeout);
    }
}

function safeCleanup(filePaths) {
    filePaths.forEach(filePath => {
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                console.error(`Failed to delete file ${filePath}:`, err.message);
            }
        }
    });
}

