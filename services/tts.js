// services/tts.js
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import util from 'util';

const execPromise = util.promisify(exec);

// အသံဖိုင်အရှည်ကို အတိအကျ တိုင်းတာမည့် Function
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

export async function generateAudioForScenes(scenes) {
    console.log("🎙️ Starting TTS Audio Generation...");
    const rendersDir = path.join(process.cwd(), 'renders');
    if (!fs.existsSync(rendersDir)) fs.mkdirSync(rendersDir, { recursive: true });

    const updatedScenes = [];

    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const text = scene.voiceover;
        
        if (!text) {
            updatedScenes.push({ ...scene, audioPath: null, duration: 0 });
            continue;
        }

        const audioFileName = `scene_${Date.now()}_${i}.mp3`;
        const audioPath = path.join(rendersDir, audioFileName);
        
        // 🇲🇲 မြန်မာ အမျိုးသမီးအသံ (Nilar) ကို သုံးထားပါတယ်။ အမျိုးသားသံဆိုရင် 'my-MM-ThihaNeural' လို့ ပြောင်းနိုင်ပါတယ်။
        const voice = 'my-MM-NilarNeural'; 
        
        // Command Error မတက်အောင် စာသားထဲက single quotes တွေကို ရှင်းလင်းခြင်း
        const safeText = text.replace(/'/g, "");

        // Edge-TTS ကို Terminal ကနေတစ်ဆင့် လှမ်းခိုင်းမည့် Command
        const command = `edge-tts --text '${safeText}' --voice ${voice} --write-media ${audioPath}`;
        
        try {
            process.stdout.write(`Generating audio for Scene ${i+1}... `);
            await execPromise(command);
            
            // ထွက်လာတဲ့ အသံဖိုင်ရဲ့ အရှည်ကို အတိအကျ တိုင်းမယ်
            const duration = await getAudioDuration(audioPath);
            
            updatedScenes.push({
                ...scene,
                audioPath: audioPath,
                duration: duration // 🌟 အသံအရှည်ကိုပါ တစ်ခါတည်း scene ထဲ မှတ်သားလိုက်ပြီ
            });
            console.log(`✅ Done! (${duration} seconds)`);
            
        } catch (error) {
            console.error(`\n❌ Edge-TTS Error in Scene ${i+1}:`, error);
            throw error;
        }
    }

    return updatedScenes; // အသံဖိုင် လမ်းကြောင်းတွေနဲ့ အချိန်တွေပါတဲ့ scenes ကို ပြန်ပို့ပေးမယ်
}

