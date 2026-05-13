import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

export async function renderReel(audioPath, scenes, musicPath, outputPath) {
    console.log("Step 4.1: Downloading assets using Memory-Safe Streams...");
    
    try {
        // သီချင်းကို Stream နည်းနဲ့ ဒေါင်းပါမယ်
        const localMusicPath = path.join(process.cwd(), 'renders', `bgm_${Date.now()}.mp3`);
        await downloadFileSafe(musicPath, localMusicPath);

        // ဗီဒီယိုတွေကို Stream နည်းနဲ့ ဒေါင်းပါမယ် (RAM လုံးဝ မစားတော့ပါ)
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

            scenes.forEach((scene, index) => {
                command.input(scene.localVideoPath);
                const duration = scene.end - scene.start;
                // အစ်ကိုပြောတဲ့ Safe Crop + Scale ပြင်ထားပါတယ်
                filterChain += `[${inputCount}:v]scale=480:854:force_original_aspect_ratio=increase,crop=480:854,setsar=1,fps=24,format=yuv420p,trim=duration=${duration},setpts=PTS-STARTPTS[v${index}];\n`;
                inputCount++;
            });

            const concatInputs = scenes.map((_, i) => `[v${i}]`).join('');
            filterChain += `${concatInputs}concat=n=${scenes.length}:v=1:a=0[baseV];\n`;

            command.input(audioPath); 
            const voiceIdx = inputCount;
            inputCount++;
            
            command.input(localMusicPath); 
            const musicIdx = inputCount;
            
            filterChain += `[${musicIdx}:a]volume=0.2[bgm];[${voiceIdx}:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[audioOut];\n`;

            // Subtitle Path Escape လုပ်ထားပါတယ်
            const srtPath = path.join(process.cwd(), 'renders', `temp_${Date.now()}.srt`);
            generateSRT(scenes, srtPath);
            const safeSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
            
            filterChain += `[baseV]subtitles='${safeSrtPath}':force_style='Fontname=Arial,Fontsize=16,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Alignment=2,MarginV=15'[finalV]`;

            command
                .complexFilter(filterChain)
                .outputOptions([
                    '-map [finalV]',
                    '-map [audioOut]',
                    '-c:v libx264',
                    '-preset veryfast', // ultrafast အစား veryfast ကို ပြောင်းထားပါတယ်
                    '-crf 32',          // File size လျှော့ချထားပါတယ်
                    '-c:a aac',
                    '-b:a 128k',
                    '-threads 1',        
                    '-shortest'
                ])
                .output(outputPath)
                .on('start', () => console.log('FFmpeg Process Started successfully.'))
                .on('stderr', (line) => {
                    // FFmpeg ရဲ့ အတွင်းပိုင်း Error တွေကို Log မှာ ပြပေးပါမယ်
                    console.log("FFmpeg STDERR:", line);
                })
                .on('progress', (progress) => console.log(`Processing: ${progress.timemark} done...`))
                .on('end', () => {
                    console.log("FFmpeg Render Complete!");
                    // Safe Cleanup ပြုလုပ်ထားပါတယ်
                    safeCleanup([srtPath, localMusicPath, ...scenes.map(s => s.localVideoPath)]);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    console.error("FFmpeg Fatal Error:", err.message);
                    safeCleanup([srtPath, localMusicPath, ...scenes.map(s => s.localVideoPath)]);
                    reject(err);
                })
                .run();
        });
    } catch (error) {
        console.error("Error during download or FFmpeg processing:", error);
        throw error;
    }
}

// Timeout ပါဝင်တဲ့ Memory-Safe File Downloader function ပါ
async function downloadFileSafe(url, destPath) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // စက္ကန့် ၆၀ စောင့်ပါမယ်

    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch ${url}`);
        
        const fileStream = fs.createWriteStream(destPath);
        // Node 18+ Web Stream ကို ဖိုင်ထဲ တိုက်ရိုက် Pipe လုပ်ပါမယ် (RAM မစားပါ)
        await finished(Readable.fromWeb(res.body).pipe(fileStream));
    } finally {
        clearTimeout(timeout);
    }
}

// Error မတက်အောင် Safe Cleanup လုပ်ပေးမယ့် function ပါ
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

function generateSRT(scenes, outputPath) {
    let srtContent = '';
    scenes.forEach((scene, i) => {
        const start = formatTime(scene.start);
        const end = formatTime(scene.end);
        srtContent += `${i + 1}\n${start} --> ${end}\n${scene.text}\n\n`;
    });
    fs.writeFileSync(outputPath, srtContent);
}

function formatTime(seconds) {
    const date = new Date(0);
    date.setSeconds(seconds);
    const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
    return date.toISOString().substr(11, 8) + ',' + ms;
}

