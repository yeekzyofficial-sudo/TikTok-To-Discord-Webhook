const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const TIKTOK_USERNAME = "yeekzyofficial";
const DATA_FILE = path.join(__dirname, "lastVideo.json");

if (!DISCORD_WEBHOOK) {
  console.error("DISCORD_WEBHOOK environment variable not set.");
  process.exit(1);
}

// Get last posted video ID
function getLastVideoId() {
  if (!fs.existsSync(DATA_FILE)) return null;
  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  return data.lastVideoId || null;
}

// Save last posted video ID
function setLastVideoId(id) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ lastVideoId: id }));
}

// Send embed to Discord
async function postToDiscord(video) {
  const embed = {
    author: {
      name: TIKTOK_USERNAME,
      url: `https://www.tiktok.com/@${TIKTOK_USERNAME}`,
      icon_url: video.author.avatarThumb
    },
    title: video.desc || "New TikTok Video",
    url: `https://www.tiktok.com/@${TIKTOK_USERNAME}/video/${video.id}`,
    color: 16711680,
    image: {
      url: video.video.cover
    },
    footer: {
      text: "TikTok • New Video Upload"
    },
    timestamp: new Date().toISOString()
  };

  await axios.post(DISCORD_WEBHOOK, {
    username: TIKTOK_USERNAME,
    embeds: [embed]
  });
}

// Fetch latest TikTok video
async function fetchLatestVideo() {
  const url = `https://www.tiktok.com/@${TIKTOK_USERNAME}?lang=en`;

  const response = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const html = response.data;
  const match = html.match(
    /<script id="SIGI_STATE" type="application\/json">(.+?)<\/script>/
  );

  if (!match) return null;

  const json = JSON.parse(match[1]);
  const videos = Object.values(json.ItemModule || {});
  if (!videos.length) return null;

  return videos[0];
}

// Check for new uploads
async function checkTikTok() {
  try {
    const latest = await fetchLatestVideo();
    if (!latest) return;

    const lastVideoId = getLastVideoId();

    if (latest.id !== lastVideoId) {
      console.log("New video detected:", latest.id);
      await postToDiscord(latest);
      setLastVideoId(latest.id);
    }
  } catch (err) {
    console.error("Error checking TikTok:", err.message);
  }
}

// Run every 2 minutes
setInterval(checkTikTok, 2 * 60 * 1000);
checkTikTok();

// Health check endpoint (for UptimeRobot)
app.get("/", (req, res) => {
  res.status(200).send("Yeekzy TikTok bot running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
