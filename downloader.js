// ─── src/modules/downloader.js ───────────────────────────────────────────────
import ytdl from 'ytdl-core';
import yts  from 'yt-search';
import axios from 'axios';
import fs    from 'fs';
import path  from 'path';
import { createWriteStream } from 'fs';

const TMP = './data/tmp';
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

// ─── YouTube search + download audio ─────────────────────────────────────────
export async function playMusic(query) {
  const search = await yts(query);
  const video  = search.videos[0];
  if (!video) throw new Error('No results found for: ' + query);

  const info = {
    title:     video.title,
    duration:  video.timestamp,
    views:     video.views,
    author:    video.author?.name,
    thumbnail: video.thumbnail,
    url:       video.url,
  };

  const filePath = path.join(TMP, `audio_${Date.now()}.mp3`);

  await new Promise((resolve, reject) => {
    ytdl(video.url, {
      filter:  'audioonly',
      quality: 'highestaudio',
    })
    .pipe(createWriteStream(filePath))
    .on('finish', resolve)
    .on('error', reject);
  });

  return { filePath, info };
}

// ─── YouTube search + download video ─────────────────────────────────────────
export async function downloadVideo(query) {
  const search = await yts(query);
  const video  = search.videos[0];
  if (!video) throw new Error('No results found');

  // Check duration — skip very long videos on free tier
  const [m] = (video.timestamp || '0:00').split(':').map(Number);
  if (m > 10) throw new Error('Video too long (max 10 min on free tier). Try a shorter clip.');

  const info = {
    title:    video.title,
    duration: video.timestamp,
    url:      video.url,
  };

  const filePath = path.join(TMP, `video_${Date.now()}.mp4`);

  await new Promise((resolve, reject) => {
    ytdl(video.url, {
      filter:  'videoandaudio',
      quality: 'lowest', // save bandwidth on free tier
    })
    .pipe(createWriteStream(filePath))
    .on('finish', resolve)
    .on('error', reject);
  });

  return { filePath, info };
}

// ─── YouTube URL to MP3 ───────────────────────────────────────────────────────
export async function ytToMp3(url) {
  if (!ytdl.validateURL(url)) throw new Error('Invalid YouTube URL');
  const info     = await ytdl.getInfo(url);
  const title    = info.videoDetails.title;
  const filePath = path.join(TMP, `ytmp3_${Date.now()}.mp3`);

  await new Promise((resolve, reject) => {
    ytdl(url, { filter: 'audioonly', quality: 'highestaudio' })
      .pipe(createWriteStream(filePath))
      .on('finish', resolve)
      .on('error',  reject);
  });

  return { filePath, title };
}

// ─── YouTube URL to MP4 ───────────────────────────────────────────────────────
export async function ytToMp4(url) {
  if (!ytdl.validateURL(url)) throw new Error('Invalid YouTube URL');
  const info     = await ytdl.getInfo(url);
  const title    = info.videoDetails.title;
  const dur      = parseInt(info.videoDetails.lengthSeconds);
  if (dur > 600) throw new Error('Video too long (max 10 min)');
  const filePath = path.join(TMP, `ytmp4_${Date.now()}.mp4`);

  await new Promise((resolve, reject) => {
    ytdl(url, { filter: 'videoandaudio', quality: 'lowest' })
      .pipe(createWriteStream(filePath))
      .on('finish', resolve)
      .on('error',  reject);
  });

  return { filePath, title };
}

// ─── TikTok downloader (via free API) ────────────────────────────────────────
export async function downloadTikTok(url) {
  try {
    const res = await axios.get(`https://api.tikmate.app/api/lookup?url=${encodeURIComponent(url)}`, { timeout: 15000 });
    const data = res.data;
    if (!data?.token) throw new Error('Could not fetch TikTok info');

    const downloadUrl = `https://api.tikmate.app/download?token=${data.token}&id=${data.id}`;
    const filePath    = path.join(TMP, `tiktok_${Date.now()}.mp4`);

    const videoRes = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream', timeout: 30000 });
    await new Promise((resolve, reject) => {
      videoRes.data.pipe(createWriteStream(filePath)).on('finish', resolve).on('error', reject);
    });

    return { filePath, title: data.author?.nickname || 'TikTok Video' };
  } catch {
    throw new Error('TikTok download failed. Make sure the video is public.');
  }
}

// ─── Instagram downloader ─────────────────────────────────────────────────────
export async function downloadInstagram(url) {
  try {
    const res = await axios.get(
      `https://instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com/get-info-rapidapi?url=${encodeURIComponent(url)}`,
      { headers: { 'X-RapidAPI-Host': 'instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com' }, timeout: 15000 }
    );
    const videoUrl = res.data?.video_url || res.data?.url;
    if (!videoUrl) throw new Error('No video found');

    const filePath = path.join(TMP, `ig_${Date.now()}.mp4`);
    const videoRes = await axios({ url: videoUrl, method: 'GET', responseType: 'stream', timeout: 30000 });
    await new Promise((resolve, reject) => {
      videoRes.data.pipe(createWriteStream(filePath)).on('finish', resolve).on('error', reject);
    });

    return { filePath, title: 'Instagram Video' };
  } catch {
    throw new Error('Instagram download failed. Try a public post URL.');
  }
}

// ─── Twitter/X downloader ─────────────────────────────────────────────────────
export async function downloadTwitter(url) {
  try {
    const res = await axios.get(
      `https://twitsave.com/info?url=${encodeURIComponent(url)}`,
      { timeout: 15000 }
    );
    // Parse download link from response
    const match = res.data?.match(/https:\/\/video\.twimg\.com[^"']*/);
    if (!match) throw new Error('No video found in tweet');

    const filePath = path.join(TMP, `twitter_${Date.now()}.mp4`);
    const videoRes = await axios({ url: match[0], method: 'GET', responseType: 'stream', timeout: 30000 });
    await new Promise((resolve, reject) => {
      videoRes.data.pipe(createWriteStream(filePath)).on('finish', resolve).on('error', reject);
    });

    return { filePath, title: 'Twitter Video' };
  } catch {
    throw new Error('Twitter download failed. Try a direct tweet URL with video.');
  }
}

// ─── Cleanup old temp files (call periodically) ───────────────────────────────
export function cleanupTmp() {
  const files = fs.readdirSync(TMP);
  const now   = Date.now();
  for (const f of files) {
    const fPath = path.join(TMP, f);
    const stat  = fs.statSync(fPath);
    if (now - stat.mtimeMs > 5 * 60 * 1000) { // delete files older than 5 mins
      try { fs.unlinkSync(fPath); } catch {}
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupTmp, 10 * 60 * 1000);
