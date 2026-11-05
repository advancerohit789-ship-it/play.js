
const { bot } = require('../lib/');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const PLAY2_APIS = {
  search: [
    "https://api-faa.my.id/faa/youtube?q=",
    "https://izumiiiiiiii.dpdns.org/downloader/youtube-play?query="
  ],

  audio: [
    "https://api.sayan-nexuswork.workers.dev/music?query=",
    "https://izumiiiiiiii.dpdns.org/downloader/youtube-play?query=",
    "https://api-faa.my.id/faa/ytplay?query=",
    "https://api.siputzx.my.id/api/d/ytmp3?url=",
    "https://api.yupra.my.id/api/downloader/ytmp3?url=",
    "https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=",
    "https://eliteprotech-apis.zone.id/ytdown?url=",
    "https://api.nexray.web.id/downloader/ytmp3?url="
  ]
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept': 'application/json'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: HEADERS,
    timeout: 25000
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  return await res.json();
}

function findValue(data, keys) {
  if (!data || typeof data !== 'object') return null;

  for (const key of keys) {
    if (typeof data[key] === 'string' && data[key].trim()) {
      return data[key];
    }
  }

  for (const value of Object.values(data)) {
    if (value && typeof value === 'object') {
      const result = findValue(value, keys);
      if (result) return result;
    }
  }

  return null;
}

function findResult(data) {
  if (!data) return null;

  if (Array.isArray(data)) {
    return data.find(item => item && typeof item === 'object') || null;
  }

  if (typeof data !== 'object') return null;

  const direct = data.result || data.data;

  if (Array.isArray(direct)) return direct[0] || null;
  if (direct && typeof direct === 'object') return direct;

  return data;
}

function getYouTubeUrl(data) {
  const result = findResult(data);

  if (!result) return null;

  const url = findValue(result, [
    'url',
    'videoUrl',
    'video_url',
    'link',
    'youtubeUrl'
  ]);

  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (
      !['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']
        .includes(parsed.hostname)
    ) return null;

    return url;
  } catch {
    return null;
  }
}

function getAudioUrl(data) {
  return findValue(data, [
    'downloadUrl',
    'download_url',
    'audioUrl',
    'audio_url',
    'download',
    'url',
    'link'
  ]);
}

function getTitle(data, fallback) {
  return findValue(data, [
    'title',
    'name',
    'videoTitle'
  ]) || fallback;
}

async function trySearch(query) {
  for (const api of PLAY2_APIS.search) {
    try {
      console.log('[PLAY2 SEARCH]', api);

      const data = await fetchJSON(
        api + encodeURIComponent(query)
      );

      const videoUrl = getYouTubeUrl(data);

      if (videoUrl) {
        return {
          url: videoUrl,
          title: getTitle(data, query)
        };
      }
    } catch (err) {
      console.log('[SEARCH FAILED]', err.message);
    }

    await sleep(300);
  }

  return null;
}

async function tryAudio(query, videoUrl) {
  for (const api of PLAY2_APIS.audio) {
    try {
      console.log('[PLAY2 AUDIO]', api);

      const isUrlAPI = api.includes('?url=');

      const requestUrl = api + encodeURIComponent(
        isUrlAPI ? videoUrl : query
      );

      const data = await fetchJSON(requestUrl);

      const audioUrl = getAudioUrl(data);

      if (!audioUrl || !/^https?:\/\//i.test(audioUrl)) {
        throw new Error('Audio URL not found');
      }

      return {
        url: audioUrl,
        title: getTitle(data, query),
        api
      };

    } catch (err) {
      console.log('[AUDIO API FAILED]', api, err.message);
    }

    await sleep(300);
  }

  return null;
}

async function downloadAudio(url) {
  const response = await fetch(url, {
    headers: HEADERS,
    timeout: 60000
  });

  if (!response.ok) {
    throw new Error(`Audio HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';

  if (
    contentType.includes('application/json') ||
    contentType.includes('text/html')
  ) {
    throw new Error('API returned a webpage instead of audio');
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (!buffer.length) {
    throw new Error('Empty audio file');
  }

  return buffer;
}

async function editStatus(message, statusMsg, text) {
  try {
    await message.send(
      { key: statusMsg.key, text },
      {},
      'edit'
    );
  } catch (err) {
    console.log('[STATUS EDIT]', err.message);
  }
}

bot(
  {
    pattern: 'play2 ?(.*)',
    desc: 'Play Music With Multiple API Fallback',
    type: 'misc'
  },

  async (message, match) => {
    const query = (match ||
      (message.reply_message && message.reply_message.text) || ''
    ).trim();

    if (!query) {
      return message.send(
        '🎵 Enter Song Name!\n\nExample: .play2 Saiyaara'
      );
    }

    const statusMsg = await message.send(
      `🔍 SEARCHING YOUR MUSIC...\n\n` +
      `╰┈➤ 🎀 Query : ${query}\n` +
      `╰┈➤ ⏳ Please Wait...\n\n` +
      `👑 X NOBITA`
    );

    try {
      // STEP 1: SEARCH
      await editStatus(message, statusMsg,
        `🔍 SEARCHING YOUR MUSIC...\n\n` +
        `╰┈➤ 🎀 Query : ${query}\n` +
        `╰┈➤ ⚡ Trying Search APIs...\n\n` +
        `👑 X NOBITA`
      );

      const search = await trySearch(query);

      const videoUrl = search?.url || (
        /^https?:\/\//i.test(query) ? query : null
      );

      if (!videoUrl) {
        throw new Error('All search APIs failed');
      }

      // STEP 2: AUDIO FALLBACK
      await editStatus(message, statusMsg,
        `⬇️ DOWNLOADING MUSIC...\n\n` +
        `╰┈➤ 🎧 Title : ${search?.title || query}\n` +
        `╰┈➤ ⚡ Trying Audio APIs...\n\n` +
        `👑 X NOBITA`
      );

      const audio = await tryAudio(query, videoUrl);

      if (!audio) {
        throw new Error('All audio APIs failed');
      }

      // STEP 3: DOWNLOAD
      await editStatus(message, statusMsg,
        `🎧 PROCESSING YOUR MUSIC...\n\n` +
        `╰┈➤ 🎵 Title : ${audio.title}\n` +
        `╰┈➤ ⏳ Sending Audio...\n\n` +
        `👑 X NOBITA`
      );

      const buffer = await downloadAudio(audio.url);

      // STEP 4: SEND AUDIO
      await message.send(
        buffer,
        {
          mimetype: 'audio/mpeg',
          fileName: `${audio.title}-X-NOBITA.mp3`,
          ptt: false
        },
        'audio'
      );

      await editStatus(message, statusMsg,
        `╭━━〔 🎧 MUSIC READY 〕━━╮\n\n` +
        `💗 Title : ${audio.title}\n` +
        `🎀 Status : Successfully Downloaded\n` +
        `⚡ Source : PLAY2 Multi API\n` +
        `👑 Developer : X NOBITA\n\n` +
        `╰━━〔 🌷 ENJOY YOUR MUSIC 〕━━╯`
      );

    } catch (error) {
      console.error('[PLAY2 ERROR]', error);

      await editStatus(message, statusMsg,
        `🥀 MUSIC DOWNLOAD FAILED\n\n` +
        `╰┈➤ ⚠️ All APIs Failed\n` +
        `╰┈➤ 🌷 Please Try Again Later\n\n` +
        `© X NOBITA`
      );
    }
  }
);
