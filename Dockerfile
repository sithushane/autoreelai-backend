# Node.js ကို Base အနေနဲ့ယူမယ်
FROM node:18-bullseye

# FFmpeg နဲ့ Python ကို Install လုပ်မယ်
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Working Directory သတ်မှတ်မယ်
WORKDIR /app

# Node Dependencies တွေသွင်းမယ်
COPY package*.json ./
RUN npm install

# Python Dependencies တွေသွင်းမယ်
RUN pip3 install faster-whisper

# ကျန်တဲ့ Code တွေအကုန် Copy ကူးမယ်
COPY . .

# Folder Permissions ပေးမယ်
RUN mkdir -p uploads renders
RUN chmod 777 uploads renders

# Port 5000 ကို ဖွင့်မယ်
EXPOSE 5000

# Server စ run မယ်
CMD ["node", "server.js"]
