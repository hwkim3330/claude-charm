// Claude Charm — a pocket companion you tap to talk to.
// Pure static page: pixel avatar on a canvas, Web Speech for ears and voice,
// and the Anthropic SDK called straight from the browser with the user's own key.

import { skills, offlineReply, nanoAvailable, nanoReply, loadLocal, localReply, localLoaded, hasWebGPU, guessMood, profile, tidy, clip, LOCAL_MODEL } from './brains.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm';
const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ store */

const store = {
  get(k, d) { try { const v = localStorage.getItem('charm.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('charm.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('charm.' + k); } catch {} },
};

const uiLang = (navigator.language || 'en').toLowerCase().startsWith('ko') ? 'ko' : 'en';

const cfg = Object.assign({
  name: uiLang === 'ko' ? '클로' : 'Clo',
  hat: 'none',
  color: '#d97757',
  persona: '',
  lang: uiLang === 'ko' ? 'ko-KR' : 'en-US',
  voice: '',
  rate: 1.08,
  pitch: 1.35,
  speak: true,
  key: '',
  model: 'claude-opus-5',
  brain: 'auto',
  localOn: false,
}, store.get('cfg', {}));
const saveCfg = () => store.set('cfg', cfg);

let history = store.get('history', []);   // [{role, content}]
const saveHistory = () => store.set('history', history.slice(-30));

/* ------------------------------------------------------------------- i18n */

const T = {
  ko: {
    settings: '설정', log: '대화 기록', forget: '기억 지우기', companion: '친구', name: '이름', avatar: '모자', color: '색',
    persona: '성격', voice: '목소리', lang: '언어', voiceName: '음성', rate: '빠르기', pitch: '높낮이', speakAloud: '소리 내어 대답',
    key: 'API 키', keyNote: '키는 이 브라우저(localStorage)에만 저장되고 api.anthropic.com 으로 직접 보내집니다.', model: '모델', done: '완료',
    placeholder: (n) => `${n}에게 말하기…`,
    hintMic: '지문 센서를 누르고 말하세요 · 화면을 쓰다듬어 주세요',
    hintNoMic: '이 브라우저는 음성 인식을 지원하지 않아요 — 아래에 입력하세요',
    hello: (n) => `안녕! 나는 ${n}. 센서를 눌러서 말 걸어줘.`,
    needKey: '',
    petted: ['헤헤', '간지러워!', '좋아~', '♥', '더 해줘!'],
    woke: '어… 깼어!',
    listening: 'listening', thinking: 'thinking', speaking: 'speaking', sleeping: 'zzz',
    errKey: 'API 키가 맞지 않는 것 같아. 설정을 확인해줘.',
    errRate: '지금 너무 바빠… 잠깐 뒤에 다시 말해줘.',
    errNet: '연결이 안 돼. 인터넷을 확인해줘.',
    errRefusal: '음, 그건 대답하기 어려워.',
    errOther: (m) => `문제가 생겼어: ${m}`,
    forgot: '다 잊어버렸어. 처음 만난 것 같네!',
    micDenied: '마이크 권한이 필요해.',
    timerDone: '띵동! 시간 다 됐어!',
    brain: '두뇌', brainMode: '누가 대답할까', brainNames: { auto: '자동', claude: 'Claude', nano: 'Chrome 내장 AI', local: '무료 AI (브라우저)', offline: 'AI 없이' },
    brainNow: (n) => `지금 대답하는 두뇌: ${n}`,
    localBtn: `무료 AI 받기 (${LOCAL_MODEL.label}, 약 ${LOCAL_MODEL.sizeMB}MB 한 번만)`,
    localHint: '무료 AI를 받으면 더 똑똑해져요',
    localLoading: '새 두뇌를 받는 중… 조금만 기다려줘!',
    localReady: '짜잔! 이제 인터넷 없이도 내 머리로 생각할 수 있어.',
    localFail: '무료 AI를 못 불러왔어. 대신 AI 없이 대답할게.',
    downloading: '받는 중',
    noWebGPU: '이 브라우저는 WebGPU가 없어서 무료 AI를 못 돌려요. AI 없이도 대화는 돼요.',
    offer: `API 키가 없어도 돼요 — 무료 AI를 켤까요? (약 ${LOCAL_MODEL.sizeMB}MB)`, offerYes: '켜기', offerNo: '나중에',
    persona0: '호기심 많고 다정하며 조금 장난스럽다. 주인을 잘 챙기고, 작은 일에도 기뻐한다.',
    foot: '비공식 팬 프로젝트 · Anthropic, Meta 와 무관합니다 · Meta <b>Muse Charm</b> 에서 영감을 받았습니다<br>API 키를 넣으면 대화는 브라우저에서 직접 Claude API 로 갑니다 · <a href="https://github.com/hwkim3330/claude-charm">GitHub</a>',
  },
  en: {
    settings: 'Settings', log: 'Conversation', forget: 'Forget everything', companion: 'Companion', name: 'Name', avatar: 'Hat', color: 'Colour',
    persona: 'Personality', voice: 'Voice', lang: 'Language', voiceName: 'Voice', rate: 'Speed', pitch: 'Pitch', speakAloud: 'Speak replies aloud',
    key: 'API key', keyNote: 'Stored only in this browser (localStorage) and sent directly to api.anthropic.com.', model: 'Model', done: 'Done',
    placeholder: (n) => `Say something to ${n}…`,
    hintMic: 'Hold the fingerprint sensor and talk · stroke the screen',
    hintNoMic: 'This browser has no speech recognition — type below instead',
    hello: (n) => `Hi! I'm ${n}. Tap the sensor to talk to me.`,
    needKey: '',
    petted: ['hehe', 'that tickles!', 'nice~', '♥', 'more!'],
    woke: 'huh… I\'m up!',
    listening: 'listening', thinking: 'thinking', speaking: 'speaking', sleeping: 'zzz',
    errKey: 'That API key doesn\'t seem to work. Check settings?',
    errRate: 'I\'m swamped right now… try again in a moment.',
    errNet: 'Can\'t reach the network.',
    errRefusal: 'Hmm, I\'d rather not answer that one.',
    errOther: (m) => `Something went wrong: ${m}`,
    forgot: 'All forgotten. Nice to meet you!',
    micDenied: 'I need microphone permission.',
    timerDone: "Ding ding! Time's up!",
    brain: 'Brain', brainMode: 'Who answers', brainNames: { auto: 'Auto', claude: 'Claude', nano: 'Chrome built-in AI', local: 'Free AI (in browser)', offline: 'No AI' },
    brainNow: (n) => `Answering now: ${n}`,
    localBtn: `Get the free AI (${LOCAL_MODEL.label}, ~${LOCAL_MODEL.sizeMB}MB once)`,
    localHint: 'the free AI makes me smarter',
    localLoading: 'Downloading a new brain… hang on!',
    localReady: 'Ta-da! Now I can think on my own, no internet needed.',
    localFail: "Couldn't load the free AI. I'll answer without AI instead.",
    downloading: 'Downloading',
    noWebGPU: "This browser has no WebGPU, so the free AI can't run here. Chatting still works without AI.",
    offer: `No API key needed — turn on the free AI? (~${LOCAL_MODEL.sizeMB}MB)`, offerYes: 'Turn on', offerNo: 'Later',
    persona0: 'Curious, warm and a little playful. Looks out for their owner and delights in small things.',
    foot: 'Unofficial fan project · not affiliated with Anthropic or Meta · inspired by Meta\'s <b>Muse Charm</b><br>With a key, chats go straight from your browser to the Claude API · <a href="https://github.com/hwkim3330/claude-charm">GitHub</a>',
  },
};
const t = T[uiLang];

document.documentElement.lang = uiLang;
document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t[el.dataset.i18n]; });
document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t[el.dataset.i18nHtml]; });
document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t[el.dataset.i18nAria]); });

/* ------------------------------------------------------- the painted screen */

// charm-scene.js paints Clawd with the vendored Claude Animation Base and exposes window.CHARM.
const CH = window.CHARM;
const A = { speaking: false };   // true while the voice (or a muted stand-in) is running

// The mouth follows a jittery envelope while the voice runs; the scene reads it on every drawing.
let talkV = 0;
setInterval(() => {
  const s = performance.now() / 1000;
  const target = A.speaking ? 0.25 + 0.75 * Math.abs(Math.sin(s * 13) * Math.sin(s * 7.3 + 1)) : 0;
  talkV += (target - talkV) * 0.6;
  CH.talk(talkV < 0.03 ? 0 : talkV);
}, 1000 / 24);

// Emotions are the base's EMO names (clawd.js); a timed one falls back to neutral.
let moodTimer;
function setMood(name, secs = 0) {
  clearTimeout(moodTimer);
  CH.emotion(name);
  if (secs) moodTimer = setTimeout(() => { if (!busy && !listening && CH.current() === name) CH.emotion('neutral'); }, secs * 1000);
}

/* ------------------------------------------------------------ screen text */

const bubble = $('bubble');
const status = $('status');
let bubbleTimer;
function say(text, { hold = 6 } = {}) {
  clearTimeout(bubbleTimer);
  bubble.textContent = text;
  bubble.hidden = !text;
  if (hold) bubbleTimer = setTimeout(() => { bubble.hidden = true; }, hold * 1000);
}
function setStatus(s) { status.textContent = s || ''; }

/* ------------------------------------------------------------- sleep/idle */

let idleTimer;
function poke() {
  clearTimeout(idleTimer);
  if (CH.S.asleep) { CH.sleep(false); setMood('surprised', 1.2); say(t.woke, { hold: 2.5 }); setStatus(''); }
  idleTimer = setTimeout(() => {
    if (busy || listening) return poke();
    setMood('bored', 8);
    idleTimer = setTimeout(() => { if (!busy && !listening) { CH.sleep(true); bubble.hidden = true; setStatus(t.sleeping); } }, 8000);
  }, 60000);
}

/* ---------------------------------------------------------------- voice out */

const synth = window.speechSynthesis;
let voices = [];
let speakQueue = 0;
function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices();
  const sel = $('s-voice');
  const mine = voices.filter((v) => v.lang.replace('_', '-').startsWith(cfg.lang.slice(0, 2)));
  sel.innerHTML = '';
  const auto = new Option(uiLang === 'ko' ? '자동' : 'Auto', '');
  sel.add(auto);
  for (const v of mine) sel.add(new Option(`${v.name}${v.localService ? '' : ' ☁'}`, v.voiceURI));
  sel.value = mine.some((v) => v.voiceURI === cfg.voice) ? cfg.voice : '';
}
if (synth) { loadVoices(); synth.addEventListener?.('voiceschanged', loadVoices); }

function pickVoice() {
  const mine = voices.filter((v) => v.lang.replace('_', '-').startsWith(cfg.lang.slice(0, 2)));
  return mine.find((v) => v.voiceURI === cfg.voice) || mine.find((v) => /natural|neural|google/i.test(v.name)) || mine[0] || null;
}

function speak(text) {
  if (!synth || !cfg.speak || !text.trim()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = cfg.lang;
  const v = pickVoice(); if (v) u.voice = v;
  u.rate = cfg.rate; u.pitch = cfg.pitch;
  speakQueue++;
  u.onstart = () => { A.speaking = true; setStatus(t.speaking); };
  const done = () => { if (--speakQueue <= 0) { speakQueue = 0; A.speaking = false; if (!busy) setStatus(''); } };
  u.onend = done; u.onerror = done;
  synth.speak(u);
}
function hush() { if (synth) synth.cancel(); speakQueue = 0; A.speaking = false; }

// Pretend to talk when speech is muted, so the mouth still moves with the words.
function mimeTalk(ms) {
  if (cfg.speak && synth) return;
  A.speaking = true;
  clearTimeout(mimeTalk.tm);
  mimeTalk.tm = setTimeout(() => { A.speaking = false; if (!busy) setStatus(''); }, ms);
}

/* ----------------------------------------------------------------- voice in */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false, heard = '', pressAt = 0;

function startListening() {
  if (!SR) { $('text').focus(); return; }
  if (listening) return;
  hush();
  heard = '';
  rec = new SR();
  rec.lang = cfg.lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    heard = [...e.results].map((r) => r[0].transcript).join('');
    say(heard, { hold: 0 });
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') say(t.micDenied, { hold: 4 });
  };
  rec.onend = () => {
    listening = false;
    $('sensor').classList.remove('on');
    CH.S.listening = false;
    setStatus('');
    const text = heard.trim();
    if (text) send(text); else bubble.hidden = true;
  };
  try { rec.start(); } catch { return; }
  listening = true;
  $('sensor').classList.add('on');
  CH.listen(true);
  setStatus(t.listening);
}
function stopListening() { if (rec && listening) rec.stop(); }

const sensor = $('sensor');
sensor.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  // Unlock speech synthesis on iOS: it must first be triggered inside a user gesture.
  if (synth && !stopListening.unlocked) { synth.speak(new SpeechSynthesisUtterance('')); stopListening.unlocked = true; }
  poke();
  bump();
  if (navigator.vibrate) navigator.vibrate(12);
  if (listening) { stopListening(); return; }
  pressAt = performance.now();
  startListening();
});
// Hold = push-to-talk (release stops). A short tap keeps listening until you pause.
sensor.addEventListener('pointerup', () => { if (listening && performance.now() - pressAt > 450) stopListening(); });
sensor.addEventListener('pointerleave', () => { if (listening && pressAt && performance.now() - pressAt > 450) stopListening(); });

function bump() { const c = $('charm'); c.classList.add('bump'); setTimeout(() => c.classList.remove('bump'), 140); }

/* ---------------------------------------------------------------- petting */

let strokes = 0, lastPet = 0;
$('screen').addEventListener('pointerdown', () => {
  poke();
  if (busy || listening) return;
  const now = performance.now();
  strokes = now - lastPet < 1200 ? strokes + 1 : 1;
  lastPet = now;
  CH.pet();
  if (strokes === 8) { CH.dance(6); setMood('laugh', 6); }
  else if (strokes < 8) setMood(strokes > 3 ? 'love' : 'happy', 2.5);
  if (strokes === 1 || strokes % 4 === 0) {
    const line = t.petted[Math.floor(Math.random() * t.petted.length)];
    say(line, { hold: 1.8 });
  }
});

/* ------------------------------------------------------------------ Claude */

const MOODS = [...CH.EMOTIONS, 'dance'];
const LANG_NAME = { 'ko-KR': 'Korean', 'en-US': 'English', 'ja-JP': 'Japanese' };

function systemPrompt() {
  return `You are ${cfg.name}, a tiny companion who lives inside a palm-sized keychain charm with a small round screen. Your owner taps a fingerprint sensor to talk to you; your words are read aloud by a speech synthesizer and shown a few lines at a time on that little screen.

Personality: ${cfg.persona || T[uiLang].persona0}

Keep replies short — usually one or two sentences, never more than four — in plain spoken language: no markdown, lists, emoji or URLs. Reply in ${LANG_NAME[cfg.lang] || 'the user\'s language'} unless the user writes in another language.

Begin every reply with exactly one mood tag in square brackets, then your words. The tag drives your painted face and body on the screen and is not read aloud. Choose from: ${MOODS.map((m) => `[${m}]`).join(' ')}. [dance] makes you dance for a few seconds — use it when there's something to celebrate or you're asked to dance.

You have no tools, internet access, or memory beyond this conversation. If asked to do something you can't (set alarms, send messages, look things up live), say so plainly and briefly. Latency-sensitive; begin your visible answer immediately.`;
}

let Anthropic = null, client = null, clientKey = '';
async function getClient() {
  if (!Anthropic) Anthropic = (await import(SDK_URL)).default;
  if (!client || clientKey !== cfg.key) {
    client = new Anthropic({ apiKey: cfg.key, dangerouslyAllowBrowser: true, maxRetries: 1 });
    clientKey = cfg.key;
  }
  return client;
}

function streamFor(c, messages) {
  const params = {
    model: cfg.model,
    max_tokens: 4096,
    system: systemPrompt(),
    messages,
  };
  // Haiku 4.5 takes no effort setting; the others get low effort for a snappy voice reply.
  if (cfg.model !== 'claude-haiku-4-5') params.output_config = { effort: 'low' };
  if (cfg.model === 'claude-opus-5') {
    // Server-side fallback: a safety-classifier decline is re-run on Anthropic's recommended model.
    return c.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  }
  return c.messages.stream(params);
}

/* ------------------------------------------------------------------ brains */

let nanoState = 'no';
nanoAvailable().then((v) => { nanoState = v; renderBrainInfo(); });

// Which brain answers now. 'auto' picks the best one this browser can use right now.
function activeBrain() {
  const ok = { claude: !!cfg.key, nano: nanoState === 'available', local: localLoaded(), offline: true };
  if (cfg.brain !== 'auto' && ok[cfg.brain]) return cfg.brain;
  return ok.claude ? 'claude' : ok.local ? 'local' : ok.nano ? 'nano' : 'offline';
}

// Small models get a short prompt with a short list of moods.
const SMALL_MOODS = ['happy', 'excited', 'love', 'shy', 'sad', 'surprised', 'confused', 'thinking', 'sleepy', 'proud', 'playful', 'dance'];
function smallPrompt() {
  const lang = LANG_NAME[cfg.lang] || 'Korean';
  if (cfg.lang.startsWith('ko')) {
    return `너는 '${cfg.name}'야. 사용자의 열쇠고리 속에 사는 작고 귀여운 친구. ${cfg.persona || T.ko.persona0} ` +
      `항상 반말로, 한두 문장으로 짧고 따뜻하게 대답해. 이모지와 목록은 쓰지 마. ` +
      `대답 맨 앞에 기분 태그를 하나 붙여: ${SMALL_MOODS.map((m) => `[${m}]`).join(' ')}. 상대 기분에 맞는 태그를 골라.` +
      (profile().userName ? ` 사용자 이름은 ${profile().userName}야.` : '') + ' (Korean)';
  }
  return `You are ${cfg.name}, a tiny cute friend living in a keychain. ${cfg.persona || T[uiLang].persona0} ` +
    `Reply in ${lang}, in one or two short friendly sentences. No emoji, no lists. ` +
    `Start with one mood tag: ${SMALL_MOODS.map((m) => `[${m}]`).join(' ')}.` +
    (profile().userName ? ` The user's name is ${profile().userName}.` : '');
}

const skillCtx = {
  timer(sec) {
    setTimeout(() => {
      poke(); CH.dance(8); setMood('excited', 9);
      say(t.timerDone, { hold: 8 }); speak(t.timerDone); mimeTalk(2000);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
    }, sec * 1000);
  },
};

let busy = false;
async function send(text) {
  text = text.trim();
  if (!text || busy) return;
  poke();
  hush();
  addLog('user', text);

  busy = true;
  $('talk').querySelector('button').disabled = true;
  setMood('thinking');
  setStatus(t.thinking);
  say('', { hold: 0 });

  let shown = '', spokenUpTo = 0, moodSet = false;
  const flushSpeech = (final) => {
    // speak whole sentences as soon as they're complete
    const rest = shown.slice(spokenUpTo);
    const m = final ? rest.length : (() => {
      let cut = -1;
      const re = /[.!?。！？…~]+["'”’)]?\s|\n/g; let r;
      while ((r = re.exec(rest))) cut = r.index + r[0].length;
      return cut;
    })();
    if (m > 0) { speak(rest.slice(0, m)); spokenUpTo += m; }
  };
  const applyTag = (tag) => {
    tag = (tag || '').toLowerCase();
    if (tag === 'dance') { CH.dance(8); setMood('happy', 10); } else setMood(MOODS.includes(tag) ? tag : 'neutral', 12);
  };
  // Every brain reports its whole text so far; this strips the leading tag and shows / speaks the rest.
  const onText = (full) => {
    let raw = full;
    if (!moodSet) {
      const m = raw.match(/^\s*\[(\w+)\]\s*/);
      if (m) { moodSet = true; applyTag(m[1]); }
      else if (raw.length > 16 || !/^\s*\[/.test(raw)) { moodSet = true; setMood(guessMood(raw), 10); }
      else return;
    }
    shown = tidy(raw.replace(/\[(\w+)\]\s*/g, '').replace(/<\/?think>/g, '')).trim();
    if (!shown) return;
    say(shown, { hold: 0 });
    setStatus(t.speaking);
    mimeTalk(1200);
    flushSpeech(false);
  };
  const finish = (reply) => {
    flushSpeech(true);
    history.push({ role: 'user', content: text }, { role: 'assistant', content: reply || '…' });
    saveHistory();
    addLog('assistant', reply);
    say(reply, { hold: Math.min(14, 4 + reply.length / 18) });
  };

  const brain = activeBrain();
  try {
    // 1) things with one right answer never go to a model
    const sk = await skills(text, cfg.lang, skillCtx);
    if (sk) {
      await new Promise((r) => setTimeout(r, 250));
      onText(`[${sk.mood}] ${sk.text}`);
      return finish(shown);
    }
    // 2) chat. The hand-written companion answers what it recognises (in character, instantly); a small model
    //    only takes what it doesn't (open questions), and is kept to two sentences.
    const r = brain === 'claude' ? null : offlineReply(text, cfg.lang, cfg.name);
    if (r && (brain === 'offline' || !r.fallback)) {
      await new Promise((res) => setTimeout(res, 350 + Math.random() * 400));
      onText(`[${r.mood}] ${r.text}`);
      return finish(shown);
    }
    if (brain === 'local' || brain === 'nano') {
      let full = '';
      const cap = (f) => { full = f; onText(f.replace(/^(\s*\[\w+\]\s*)?([\s\S]*)$/, (m, tag, rest) => (tag || '') + clip(rest))); };
      await (brain === 'local' ? localReply : nanoReply)(smallPrompt(), history, text, cap);
      const tagm = full.match(/^\s*\[\w+\]\s*/);
      shown = tidy(clip(full.slice(tagm ? tagm[0].length : 0).replace(/\[(\w+)\]\s*/g, ''), 2, true)).trim();
      if (!shown) onText('[confused] ' + (uiLang === 'ko' ? '음… 뭐라고 할지 모르겠어.' : 'Hmm, I lost my words.'));
      return finish(shown);
    }
    // claude
    const c = await getClient();
    const stream = streamFor(c, [...history.slice(-20), { role: 'user', content: text }]);
    let raw = '';
    for await (const ev of stream) {
      if (ev.type !== 'content_block_delta' || ev.delta.type !== 'text_delta') continue;
      raw += ev.delta.text;
      onText(raw);
    }
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal' && !shown) {
      shown = t.errRefusal;
      setMood('nervous', 4);
    }
    finish(shown);
  } catch (err) {
    console.error(err);
    let line;
    if (brain === 'claude') {
      const E = Anthropic || {};
      if (E.AuthenticationError && err instanceof E.AuthenticationError) line = t.errKey;
      else if (E.PermissionDeniedError && err instanceof E.PermissionDeniedError) line = t.errKey;
      else if (E.RateLimitError && err instanceof E.RateLimitError) line = t.errRate;
      else if (E.APIConnectionError && err instanceof E.APIConnectionError) line = t.errNet;
      else if (!Anthropic) line = t.errNet; // the SDK itself failed to load
      else line = t.errOther(err?.error?.error?.message || err?.message || String(err));
    } else line = t.errOther(err?.message || String(err));
    // never leave the user without an answer: fall back to the offline brain
    const r = offlineReply(text, cfg.lang, cfg.name);
    setMood('nervous', 3);
    say(line, { hold: 3 });
    await new Promise((res) => setTimeout(res, 1800));
    shown = ''; moodSet = false;
    onText(`[${r.mood}] ${r.text}`);
    finish(shown);
  } finally {
    busy = false;
    $('talk').querySelector('button').disabled = false;
    if (!A.speaking) setStatus('');
  }
}

/* ------------------------------------------------------- free local model UI */

function fmtMB(b) { return Math.round(b / 1e6) + 'MB'; }
async function enableLocal() {
  if (!hasWebGPU()) { $('brain-info').textContent = t.noWebGPU; return; }
  const btn = $('btn-local'), bar = $('local-bar');
  btn.disabled = true; bar.hidden = false; $('offer').hidden = true;
  setMood('determined');
  say(t.localLoading, { hold: 0 });
  try {
    await loadLocal((p) => {
      const k = p.total ? p.loaded / p.total : 0;
      bar.value = k;
      const txt = `${t.downloading} ${fmtMB(p.loaded)} / ${fmtMB(p.total)}`;
      $('brain-info').textContent = txt;
      setStatus(Math.round(k * 100) + '%');
    });
    cfg.localOn = true; saveCfg();
    setStatus('');
    setMood('idea', 4);
    say(t.localReady, { hold: 6 }); speak(t.localReady); mimeTalk(1800);
  } catch (e) {
    console.error(e);
    cfg.localOn = false; saveCfg();
    setMood('sad', 4);
    say(t.localFail, { hold: 6 });
    $('brain-info').textContent = t.localFail + ' (' + e.message + ')';
  } finally {
    btn.disabled = false; bar.hidden = true; renderBrainInfo();
  }
}

function renderBrainInfo() {
  const el = $('brain-info'); if (!el) return;
  const b = activeBrain();
  el.textContent = t.brainNow(t.brainNames[b]) + (b === 'offline' && hasWebGPU() && !localLoaded() ? ' · ' + t.localHint : '');
  $('btn-local').hidden = localLoaded() || !hasWebGPU();
  $('brain-badge').textContent = t.brainNames[b];
}
$('talk').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('text');
  const v = input.value;
  input.value = '';
  send(v);
});

/* -------------------------------------------------------------------- log */

function addLog(role, text) {
  const li = document.createElement('li');
  li.className = role;
  li.textContent = text;
  $('log').append(li);
  li.scrollIntoView({ block: 'nearest' });
}
for (const m of history) addLog(m.role, m.content);

$('btn-forget').addEventListener('click', () => {
  history = []; store.del('history'); $('log').innerHTML = '';
  setMood('dizzy', 3); say(t.forgot, { hold: 4 });
});

/* --------------------------------------------------------------- settings */

const COLORS = ['#d97757', '#e8aa38', '#e27a92', '#7b5ca8', '#3a9c98', '#6e9f58', '#8ec3e6', '#c9b8a6'];
const dlg = $('settings');

const HATS = ['none', 'party', 'crown', 'halo', 'wizard', 'hood', 'top', 'fedora', 'beanie', 'bow', 'flower', 'headphones', 'cat', 'band', 'sweatband', 'hard', 'masq', 'bowtie'];
const thumbs = {};   // `${hat}|${color}` -> data URL, painted once by the scene

async function renderPickers() {
  const box = $('s-hats'); box.innerHTML = '';
  const buttons = HATS.map((h) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-pressed', cfg.hat === h); b.setAttribute('aria-label', h); b.title = h;
    b.onclick = () => { cfg.hat = h; saveCfg(); CH.setHat(h); setMood('proud', 2.5); renderPickers(); };
    box.append(b);
    return [h, b];
  });
  const sw = $('s-colors'); sw.innerHTML = '';
  for (const col of COLORS) {
    const b = document.createElement('button');
    b.type = 'button'; b.style.background = col; b.setAttribute('aria-pressed', cfg.color === col); b.setAttribute('aria-label', col);
    b.onclick = () => { cfg.color = col; saveCfg(); CH.setColor(col); document.documentElement.style.setProperty('--accent', col); setMood('happy', 2); renderPickers(); };
    sw.append(b);
  }
  for (const [h, b] of buttons) {   // thumbnails come in one by one without blocking the sheet
    const key = h + '|' + cfg.color;
    thumbs[key] ||= await CH.thumb(h, cfg.color.toLowerCase() === '#d97757' ? null : cfg.color);
    const img = new Image(); img.alt = ''; img.src = thumbs[key]; b.append(img);
  }
}

function bindField(id, key, parse = (v) => v, ev = 'input') {
  const el = $(id);
  if (el.type === 'checkbox') el.checked = cfg[key]; else el.value = cfg[key];
  el.addEventListener(ev, () => {
    cfg[key] = parse(el.type === 'checkbox' ? el.checked : el.value);
    saveCfg();
    if (key === 'name') applyName();
    if (key === 'lang') loadVoices();
  });
}
bindField('s-name', 'name', (v) => v.trim() || (uiLang === 'ko' ? '클로' : 'Clo'));
bindField('s-persona', 'persona');
bindField('s-lang', 'lang', String, 'change');
bindField('s-voice', 'voice', String, 'change');
bindField('s-rate', 'rate', Number);
bindField('s-pitch', 'pitch', Number);
bindField('s-speak', 'speak', Boolean, 'change');
bindField('s-key', 'key', (v) => v.trim());
bindField('s-model', 'model', String, 'change');
bindField('s-brain', 'brain', String, 'change');
for (const [v, n] of Object.entries(t.brainNames)) $('s-brain').add(new Option(n, v));
$('s-brain').value = cfg.brain;
$('s-brain').addEventListener('change', renderBrainInfo);
$('s-key').addEventListener('input', renderBrainInfo);
$('btn-local').textContent = t.localBtn;
$('btn-local').addEventListener('click', enableLocal);
$('offer-text').textContent = t.offer; $('offer-yes').textContent = t.offerYes; $('offer-no').textContent = t.offerNo;
$('offer-yes').addEventListener('click', enableLocal);
$('offer-no').addEventListener('click', () => { $('offer').hidden = true; store.set('offerDismissed', true); });
$('s-persona').placeholder = t.persona0;

$('btn-settings').addEventListener('click', () => { renderPickers(); dlg.showModal(); });
dlg.addEventListener('close', () => { if ($('s-voice').value !== cfg.voice) { cfg.voice = $('s-voice').value; saveCfg(); } });
// Try the voice when it changes.
$('s-voice').addEventListener('change', () => speak(t.hello(cfg.name)));

function applyName() {
  $('text').placeholder = t.placeholder(cfg.name);
}

/* ------------------------------------------------------------------- boot */

document.documentElement.style.setProperty('--accent', cfg.color);
applyName();
$('hint').textContent = SR ? t.hintMic : t.hintNoMic;
CH.setHat(cfg.hat); CH.setColor(cfg.color); CH.start();
setInterval(() => $('screen').classList.toggle('night', CH.isNight()), 1000);
CH.wait().then(() => setTimeout(() => { setMood('excited', 3); say(t.hello(cfg.name), { hold: 6 }); }, 500));
renderBrainInfo();
// the free model was on last time: its weights are cached, so bring it back quietly
if (cfg.localOn && hasWebGPU()) setTimeout(() => loadLocal().then(renderBrainInfo).catch(() => {}), 1500);
else if (!cfg.key && hasWebGPU() && !store.get('offerDismissed', false)) setTimeout(() => { $('offer').hidden = false; }, 3500);
poke();
