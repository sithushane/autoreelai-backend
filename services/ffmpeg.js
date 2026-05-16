import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

export async function renderReel(scenes, musicPath, outputPath) {
    console.log("Step 4.1: Checking and preparing hybrid media assets...");
    
    try {
        const localMusicPath = path.join(process.cwd(), 'renders', `bgm_${Date.now()}.mp3`);
        await downloadFileSafe(musicPath, localMusicPath);

        for (let i = 0; i < scenes.length; i++) {
            if (!scenes[i] || !scenes[i].videoPath) {
                console.log(`⚠️ Warning: Missing media URL for Scene ${i + 1}`);
                if (i > 0 && scenes[i - 1].videoPath) {
                    scenes[i].videoPath = scenes[i - 1].videoPath;
                } else {
                    scenes[i].videoPath = "https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-23246-large.mp4";
                }
            }

            // 🌟 လင့်ခ်မှာ ဖိုင်အမျိုးအစား ဘာလဲဆိုတာ စစ်ဆေးခြင်း (.jpg, .png စသဖြင့်)
            const isPhoto = /\.(jpg|jpeg|png|webp)/i.test(scenes[i].videoPath);
            const ext = isPhoto ? '.jpg' : '.mp4';

            console.log(`Downloading asset ${i + 1} of ${scenes.length} (${isPhoto ? 'Photo' : 'Video'})...`);
            const localAssetPath = path.join(process.cwd(), 'renders', `asset_${Date.now()}_${i}${ext}`);
            await downloadFileSafe(scenes[i].videoPath, localAssetPath);
            
            scenes[i].localVideoPath = localAssetPath;
            scenes[i].isPhoto = isPhoto; // FFmpeg Filter အတွက် သိမ်းထားခြင်း
        }

        // ✅ ASS Subtitle File ဆောက်မယ်
        const assPath = path.join(process.cwd(), 'renders', `sub_${Date.now()}.ass`);
        
        let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans Myanmar,65,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,3,0,2,10,10,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

        let currentTime = 0;
        scenes.forEach((scene) => {
            const duration = scene.duration;
            const start = currentTime;
            const end = currentTime + duration;
            const text = scene.text_on_screen || '';

            if (text) {
                assContent += `Dialogue: 0,${toASSTime(start)},${toASSTime(end)},Default,,0,0,0,,${text}\n`;
            }
            currentTime = end;
        });

        fs.writeFileSync(assPath, assContent, 'utf8');
        console.log("✅ ASS Subtitle file created:", assPath);

        console.log("Step 4.2: Starting FFmpeg Cinematic Render (1080P Hybrid + Myanmar Subtitles)...");

        return new Promise((resolve, reject) => {
            let command = ffmpeg();
            let filterChain = '';
            const vCount = scenes.length;

            // 1. Input တွေ ထည့်မယ် (ဓာတ်ပုံ သို့မဟုတ် ဗီဒီယို)
            scenes.forEach(scene => command.input(scene.localVideoPath));
            scenes.forEach(scene => command.input(scene.audioPath));
            command.input(localMusicPath);
            const musicIdx = vCount * 2;

            // 2. Video & Photo Hybrid Filters
            scenes.forEach((scene, index) => {
                const duration = scene.duration;
                
                let baseInputFilter = `[${index}:v]`;
                
                // 🌟 CRITICAL: တကယ်လို့ ဖိုင်က ဓာတ်ပုံဖြစ်နေရင် ပုံသေမဖြစ်စေဘဲ အသံကြာချိန်အတိုင်း Loop လုပ်ပြီး ဗီဒီယိုအဖြစ် ပြောင်းလဲခြင်း
                if (scene.isPhoto) {
                    baseInputFilter = `[${index}:v]loop=loop=-1:size=1:start=0,tpad=stop_mode=clone:stop_duration=${duration},trim=duration=${duration},setpts=PTS-STARTPTS`;
                } else {
                    baseInputFilter = `[${index}:v]trim=duration=${duration},setpts=PTS-STARTPTS`;
                }

                // Pillarbox/Letterbox အချိုးကျစနစ်ကို ပုံရော၊ ဗီဒီယိုပါ တန်းစီကျွေးခြင်း
                filterChain += `${baseInputFilter},scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p[v${index}];`;
            });

            // 3. Concat Videos + Audios
            const concatInputs = scenes.map((_, i) => `[v${i}][${vCount + i}:a]`).join('');
            filterChain += `${concatInputs}concat=n=${vCount}:v=1:a=1[baseV][baseA];`;

            // ၃.၅ - Subtitle Burn-in ကို Relative Path ဖြင့် ဆွဲခြင်း
            const relativeSubPath = path.relative(process.cwd(), assPath).replace(/\\/g, '/');
            filterChain += `[baseV]subtitles=filename='${relativeSubPath}'[finalV];`;

            // 4. Audio Mixing
            filterChain += `[${musicIdx}:a]volume=0.15[bgm];[baseA][bgm]amix=inputs=2:duration=first:dropout_transition=2[audioOut]`;

            command
                .complexFilter(filterChain)
                .outputOptions([
                    '-map [finalV]',
                    '-map [audioOut]',
                    '-c:v libx264',
                    '-preset fast',
                    '-crf 23',
                    '-c:a aac',
                    '-b:a 192k',
                    '-movflags +faststart',
                    '-pix_fmt yuv420p',
                ])
                .output(outputPath)
                .on('start', () => console.log("FFmpeg Started... ✨"))
                .on('stderr', (line) => {
                    if (line.includes('Error') || line.includes('Failed') || line.includes('Invalid')) {
                        console.log("FFmpeg Warning:", line);
                    }
                })
                .on('progress', (progress) => console.log(`Rendering: ${progress.timemark}`))
                .on('end', () => {
                    console.log("✅ FFmpeg Render Complete!");
                    console.log("📁 Output:", path.basename(outputPath));
                    safeCleanup([
                        localMusicPath,
                        assPath,
                        ...scenes.map(s => s.localVideoPath),
                        ...scenes.map(s => s.audioPath)
                    ]);
                    resolve(path.basename(outputPath));
                })
                .on('error', (err) => {
                    console.error("FFmpeg Error:", err.message);
                    safeCleanup([
                        localMusicPath,
                        assPath,
                        ...scenes.map(s => s.localVideoPath),
                        ...scenes.map(s => s.audioPath)
                    ]);
                    reject(err);
                })
                .run();
        });
    } catch (error) {
        console.error("Error in renderReel:", error);
        throw error;
    }
}

function toASSTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds % 1) * 100);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

async function downloadFileSafe(url, destPath) {
    if (!url) throw new Error("Empty URL received.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
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
                console.error(`Failed to delete: ${filePath}`, err.message);
            }
        }
    });
}

