import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

export async function renderReel(scenes, musicPath, outputPath) {
    console.log("Step 4.1: Downloading video assets...");
    
    try {
        const localMusicPath = path.join(process.cwd(), 'renders', `bgm_${Date.now()}.mp3`);
        await downloadFileSafe(musicPath, localMusicPath);

        for (let i = 0; i < scenes.length; i++) {
            if (!scenes[i] || !scenes[i].videoPath) {
                console.log(`⚠️ Warning: Missing video URL for Scene ${i + 1}`);
                if (i > 0 && scenes[i - 1].localVideoPath) {
                    scenes[i].videoPath = scenes[i - 1].videoPath;
                } else {
                    scenes[i].videoPath = "https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-23246-large.mp4";
                }
            }

            console.log(`Downloading video ${i + 1} of ${scenes.length}...`);
            const localVidPath = path.join(process.cwd(), 'renders', `vid_${Date.now()}_${i}.mp4`);
            await downloadFileSafe(scenes[i].videoPath, localVidPath);
            scenes[i].localVideoPath = localVidPath;
        }

        // ✅ ASS Subtitle File ဆောက်မယ်
        const assPath = path.join(process.cwd(), 'renders', `sub_${Date.now()}.ass`);
        
        // ✅ ASS Header
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

        // ✅ Scene တစ်ခုချင်းစီအတွက် subtitle line ထည့်မယ်
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

        // ✅ ASS file သိမ်းမယ်
        fs.writeFileSync(assPath, assContent, 'utf8');
        console.log("✅ ASS Subtitle file created:", assPath);

        console.log("Step 4.2: Starting FFmpeg Cinematic Render (1080P + Myanmar Subtitles)...");

        return new Promise((resolve, reject) => {
            let command = ffmpeg();
            let filterChain = '';
            const vCount = scenes.length;

            // 1. Input တွေ ထည့်မယ်
            scenes.forEach(scene => command.input(scene.localVideoPath));
            scenes.forEach(scene => command.input(scene.audioPath));
            command.input(localMusicPath);
            const musicIdx = vCount * 2;

            // 2. Video Filters
            scenes.forEach((scene, index) => {
                const duration = scene.duration;
                filterChain += `[${index}:v]trim=duration=${duration},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p[v${index}];`;
            });

            // 3. Concat Videos + Audios
            const concatInputs = scenes.map((_, i) => `[v${i}][${vCount + i}:a]`).join('');
            filterChain += `${concatInputs}concat=n=${vCount}:v=1:a=1[baseV][baseA];`;

            // 4. Audio Mixing
            filterChain += `[${musicIdx}:a]volume=0.15[bgm];[baseA][bgm]amix=inputs=2:duration=first:dropout_transition=2[audioOut]`;

            // ✅ 5. ASS subtitle path escape လုပ်မယ်
            const safeAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');

            command
                .complexFilter(filterChain)
                .outputOptions([
                    '-map [baseV]',
                    '-map [audioOut]',
                    `-vf`, `ass=${safeAssPath}`,  // ✅ Myanmar subtitle burn-in
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

// ✅ ASS Time Format: H:MM:SS.CC
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
