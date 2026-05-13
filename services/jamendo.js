export async function fetchMusic(mood) {
    console.log(`Requested mood: ${mood}, but using reliable fallback music to avoid 403 Forbidden.`);
    
    // Bensound က Server တွေကို ပိတ်ထားလို့၊ အမြဲတမ်း 100% အလုပ်လုပ်တဲ့ 
    // SoundHelix ရဲ့ Royalty-Free Music လင့်ခ်ကို ပြောင်းသုံးထားပါတယ်
    return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
}

