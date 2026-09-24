// Claude Charm — a pocket companion you tap to talk to.
// Pure static page: pixel avatar on a canvas, Web Speech for ears and voice,
// and the Anthropic SDK called straight from the browser with the user's own key.

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
  skin: 'crab',
  color: '#d97757',
  persona: '',
  lang: uiLang === 'ko' ? 'ko-KR' : 'en-US',
  voice: '',
  rate: 1.08,
  pitch: 1.35,
  speak: true,
  key: '',
  model: 'claude-opus-5',
}, store.get('cfg', {}));
const saveCfg = () => store.set('cfg', cfg);

let history = store.get('history', []);   // [{role, content}]
const saveHistory = () => store.set('history', history.slice(-30));

/* ------------------------------------------------------------------- i18n */

const T = {
  ko: {
    settings: '설정', log: '대화 기록', forget: '기억 지우기', companion: '친구', name: '이름', avatar: '모습', color: '색',
    persona: '성격', voice: '목소리', lang: '언어', voiceName: '음성', rate: '빠르기', pitch: '높낮이', speakAloud: '소리 내어 대답',
    key: 'API 키', keyNote: '키는 이 브라우저(localStorage)에만 저장되고 api.anthropic.com 으로 직접 보내집니다.', model: '모델', done: '완료',
    placeholder: (n) => `${n}에게 말하기…`,
    hintMic: '지문 센서를 누르고 말하세요 · 화면을 쓰다듬어 주세요',
    hintNoMic: '이 브라우저는 음성 인식을 지원하지 않아요 — 아래에 입력하세요',
    hello: (n) => `안녕! 나는 ${n}. 센서를 눌러서 말 걸어줘.`,
    needKey: '대화하려면 설정에서 Claude API 키를 넣어줘. 그동안엔 쓰다듬기만 받을게!',
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
    persona0: '호기심 많고 다정하며 조금 장난스럽다. 주인을 잘 챙기고, 작은 일에도 기뻐한다.',
    foot: '비공식 팬 프로젝트 · Anthropic, Meta 와 무관합니다 · Meta <b>Muse Charm</b> 에서 영감을 받았습니다<br>대화는 브라우저에서 직접 Claude API 로 갑니다 · <a href="https://github.com/hwkim3330/claude-charm">GitHub</a>',
  },
  en: {
    settings: 'Settings', log: 'Conversation', forget: 'Forget everything', companion: 'Companion', name: 'Name', avatar: 'Look', color: 'Colour',
    persona: 'Personality', voice: 'Voice', lang: 'Language', voiceName: 'Voice', rate: 'Speed', pitch: 'Pitch', speakAloud: 'Speak replies aloud',
    key: 'API key', keyNote: 'Stored only in this browser (localStorage) and sent directly to api.anthropic.com.', model: 'Model', done: 'Done',
    placeholder: (n) => `Say something to ${n}…`,
    hintMic: 'Hold the fingerprint sensor and talk · stroke the screen',
    hintNoMic: 'This browser has no speech recognition — type below instead',
    hello: (n) => `Hi! I'm ${n}. Tap the sensor to talk to me.`,
    needKey: 'Add a Claude API key in settings so we can talk. Head pats work without one!',
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
    persona0: 'Curious, warm and a little playful. Looks out for their owner and delights in small things.',
    foot: 'Unofficial fan project · not affiliated with Anthropic or Meta · inspired by Meta\'s <b>Muse Charm</b><br>Chats go straight from your browser to the Claude API · <a href="https://github.com/hwkim3330/claude-charm">GitHub</a>',
  },
};
const t = T[uiLang];

document.documentElement.lang = uiLang;
document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t[el.dataset.i18n]; });
document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t[el.dataset.i18nHtml]; });
document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t[el.dataset.i18nAria]); });

/* ------------------------------------------------------------ pixel avatar */

const G = 40;                 // logical pixel grid
const canvas = $('face');
const ctx = canvas.getContext('2d');
const PX = canvas.width / G;
const EYE = '#1d1916';
const CHEEK = '#f29a9a';

// shared animation state
const A = {
  t: 0,
  mood: 'calm',          // calm happy curious thinking sad surprised sleepy listening
  moodUntil: 0,
  asleep: false,
  talk: 0,               // mouth openness 0..1
  speaking: false,
  lookX: 0, lookY: 0, lookTX: 0, lookTY: 0,
  x: 0, tx: 0,           // wander
  blinkAt: 2,
  blush: 0,
  wave: 0,
  particles: [],
};

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function makePainter(c2d, scale) {
  return {
    rect(x, y, w, h, col) { c2d.fillStyle = col; c2d.fillRect(Math.round(x) * scale, Math.round(y) * scale, w * scale, h * scale); },
    dot(x, y, col) { this.rect(x, y, 1, 1, col); },
  };
}

// Eyes shared by every skin. (x, y) is the top-left of the left eye; gap is the distance to the right eye.
function drawEyes(p, x, y, gap, s) {
  const mood = s.asleep ? 'asleep' : s.mood;
  const lx = Math.round(s.lookX), ly = Math.round(s.lookY);
  const blink = s.blinking && mood !== 'asleep' && mood !== 'happy';
  for (const ex of [x + lx, x + gap + lx]) {
    const ey = y + ly;
    if (blink) { p.rect(ex, ey + 2, 2, 1, EYE); continue; }
    switch (mood) {
      case 'asleep': p.rect(ex - 1, ey + 2, 3, 1, EYE); break;
      case 'sleepy': p.rect(ex, ey + 1, 2, 2, EYE); p.rect(ex - 1, ey + 1, 3, 1, s.body); break;
      case 'happy': p.dot(ex - 1, ey + 2, EYE); p.rect(ex, ey + 1, 2, 1, EYE); p.dot(ex + 2, ey + 2, EYE); break;
      case 'surprised': p.rect(ex - 1, ey - 1, 3, 4, EYE); p.dot(ex, ey, '#fff'); break;
      case 'sad': p.rect(ex, ey + 1, 2, 2, EYE); break;
      case 'thinking': p.rect(ex + 1, ey - 1, 2, 2, EYE); break;
      case 'listening': case 'curious': p.rect(ex, ey - 1, 2, 4, EYE); p.dot(ex, ey - 1, '#fff'); break;
      default: p.rect(ex, ey, 2, 3, EYE);
    }
  }
  if (mood === 'sad') { p.dot(x - 1, y - 1, EYE); p.dot(x + gap + 2, y - 1, EYE); }
  if (s.blush > 0.05 || mood === 'happy') {
    p.rect(x - 2, y + 4, 2, 1, CHEEK); p.rect(x + gap + 2, y + 4, 2, 1, CHEEK);
  }
}

function drawMouth(p, cx, y, s) {
  if (s.asleep) return;
  if (s.talk > 0.12) {
    const h = s.talk > 0.6 ? 2 : 1;
    const w = s.talk > 0.35 ? 3 : 2;
    p.rect(cx - Math.floor(w / 2), y, w, h, EYE);
  } else if (s.mood === 'happy' || s.blush > 0.05) {
    p.dot(cx - 2, y, EYE); p.rect(cx - 1, y + 1, 2, 1, EYE); p.dot(cx + 1, y, EYE);
  } else if (s.mood === 'surprised') {
    p.rect(cx - 1, y, 2, 2, EYE);
  } else if (s.mood === 'sad') {
    p.rect(cx - 1, y, 2, 1, EYE); p.dot(cx - 2, y + 1, EYE); p.dot(cx + 1, y + 1, EYE);
  }
}

const SKINS = {
  // the little coral critter: block body, stubby arms, four legs
  crab(p, s) {
    const cx = 20 + Math.round(s.x);
    const bob = s.asleep ? 0 : Math.round(Math.sin(s.t * 3) * 0.6 + 0.4);
    const top = 17 + bob;
    const body = s.body, dark = shade(body, -0.28), lite = shade(body, 0.18);
    // legs (walk cycle while wandering)
    const walking = Math.abs(s.tx - s.x) > 0.3;
    const step = walking ? (Math.floor(s.t * 8) % 2) : 0;
    [-6, -3, 2, 5].forEach((lx, i) => {
      const lift = walking && (i % 2 === step) ? 1 : 0;
      p.rect(cx + lx, top + 11 - lift + (s.asleep ? -1 : 0), 1, 3 - (s.asleep ? 1 : 0), dark);
    });
    // body
    p.rect(cx - 7, top, 14, 11, body);
    p.rect(cx - 7, top, 14, 1, lite);
    p.rect(cx - 7, top + 10, 14, 1, dark);
    // arms — waving raises one
    const wave = s.wave > 0 ? Math.round(Math.sin(s.t * 18)) : 0;
    p.rect(cx - 10, top + 4, 3, 3, body);
    p.rect(cx + 7, top + 4 - (s.wave > 0 ? 3 + wave : 0), 3, 3, body);
    drawEyes(p, cx - 4, top + 3, 6, s);
    drawMouth(p, cx, top + 8, s);
  },

  // a starburst with a face — rays spin while thinking
  spark(p, s) {
    const cx = 20 + Math.round(s.x) + 0.5, cy = 23.5 + (s.asleep ? 1 : Math.round(Math.sin(s.t * 2.4) * 0.6));
    const body = s.body, dark = shade(body, -0.22);
    const spin = s.mood === 'thinking' ? s.t * 2.2 : s.t * 0.15;
    const N = 11;
    for (let k = 0; k < N; k++) {
      const a = spin + (k / N) * Math.PI * 2;
      const len = 11 + ((k * 7) % 4) - (s.asleep ? 3 : 0) + (s.talk > 0.3 ? 1 : 0);
      for (let r = 6; r < len; r += 0.5) {
        const w = r < 9 ? 1 : 0;
        p.dot(cx + Math.cos(a) * r - 0.5, cy + Math.sin(a) * r - 0.5, body);
        if (w) p.dot(cx + Math.cos(a + 0.12) * r - 0.5, cy + Math.sin(a + 0.12) * r - 0.5, body);
      }
    }
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
      const d = x * x + y * y;
      if (d <= 49) p.dot(cx + x - 0.5, cy + y - 0.5, d > 36 ? dark : body);
    }
    const ex = Math.round(cx - 0.5) - 4, ey = Math.round(cy - 0.5) - 3;
    drawEyes(p, ex, ey, 6, s);
    drawMouth(p, Math.round(cx - 0.5) + 1, ey + 5, s);
  },

  // a soft round blob with ears
  mochi(p, s) {
    const cx = 20 + Math.round(s.x);
    const squish = s.asleep ? 1 : Math.round((Math.sin(s.t * 3) + 1) * 0.5);
    const body = s.body, dark = shade(body, -0.22), lite = shade(body, 0.3);
    const w = 9 + squish, h = 8 - squish, cy = 25 + squish;
    for (let y = -h; y <= h; y++) for (let x = -w; x <= w; x++) {
      const d = (x * x) / (w * w) + (y * y) / (h * h);
      if (d <= 1) p.dot(cx + x, cy + y, d > 0.8 && y > 0 ? dark : body);
    }
    p.rect(cx - 5, cy - h + 1, 3, 1, lite);
    // ears
    const perk = s.mood === 'listening' || s.mood === 'curious' ? 1 : 0;
    p.rect(cx - 7, cy - h - 2 - perk, 3, 3 + perk, body);
    p.rect(cx + 5, cy - h - 2 - perk, 3, 3 + perk, body);
    drawEyes(p, cx - 4, cy - 3, 7, s);
    drawMouth(p, cx + 1, cy + 2, s);
  },
};

const HEART = ['.#.#.', '#####', '#####', '.###.', '..#..'];
function spawn(kind, n = 1) {
  for (let i = 0; i < n; i++) {
    A.particles.push({ kind, x: 20 + A.x + (Math.random() - 0.5) * 16, y: 9 + Math.random() * 4, vy: -3 - Math.random() * 3, life: 1.4 + Math.random() * 0.6, age: 0 });
  }
}

function drawParticles(p, dt) {
  A.particles = A.particles.filter((q) => (q.age += dt) < q.life);
  for (const q of A.particles) {
    q.y += q.vy * dt;
    const alpha = 1 - q.age / q.life;
    if (q.kind === 'heart') {
      ctx.globalAlpha = alpha;
      HEART.forEach((row, yy) => [...row].forEach((c, xx) => { if (c === '#') p.dot(q.x + xx, q.y + yy, CHEEK); }));
      ctx.globalAlpha = 1;
    }
  }
  // sleeping Zs
  if (A.asleep) {
    const k = (A.t * 0.7) % 1;
    ctx.globalAlpha = 1 - k;
    const zx = 27 + Math.round(A.x) + Math.round(k * 4), zy = 13 - Math.round(k * 6);
    p.rect(zx, zy, 3, 1, '#bdb3a5'); p.dot(zx + 1, zy + 1, '#bdb3a5'); p.rect(zx, zy + 2, 3, 1, '#bdb3a5');
    ctx.globalAlpha = 1;
  }
  // thinking dots
  if (A.mood === 'thinking' && !A.speaking) {
    for (let i = 0; i < 3; i++) {
      const on = Math.floor(A.t * 3) % 3 >= i;
      p.rect(16 + i * 3 + Math.round(A.x), 11, 2, 2, on ? '#e9dfd2' : '#4a433c');
    }
  }
  // listening rings
  if (A.mood === 'listening') {
    const lvl = 0.5 + 0.5 * Math.sin(A.t * 9);
    for (const side of [-1, 1]) for (let r = 0; r < 2; r++) {
      const x0 = 20 + Math.round(A.x) + side * (13 + r * 2);
      const hgt = 2 + r * 2 + Math.round(lvl * 2);
      ctx.globalAlpha = 0.9 - r * 0.35;
      p.rect(x0, 23 - Math.floor(hgt / 2), 1, hgt, cfg.color);
      ctx.globalAlpha = 1;
    }
  }
}

const painter = makePainter(ctx, PX);
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  A.t += dt;
  // mood expiry
  if (A.moodUntil && A.t > A.moodUntil) { A.mood = 'calm'; A.moodUntil = 0; }
  // blink
  A.blinking = A.t > A.blinkAt && A.t < A.blinkAt + 0.12;
  if (A.t > A.blinkAt + 0.12) A.blinkAt = A.t + 2 + Math.random() * 3.5;
  // gaze + wander while idle
  if (!A.asleep && A.mood === 'calm' && !A.speaking && Math.random() < dt * 0.35) {
    A.lookTX = Math.round((Math.random() - 0.5) * 2); A.lookTY = Math.random() < 0.2 ? -1 : 0;
    if (Math.random() < 0.5) A.tx = (Math.random() - 0.5) * 8;
  }
  if (A.mood !== 'calm' || A.speaking) { A.lookTX = 0; A.lookTY = 0; A.tx = 0; }
  A.lookX += (A.lookTX - A.lookX) * Math.min(1, dt * 8);
  A.lookY += (A.lookTY - A.lookY) * Math.min(1, dt * 8);
  A.x += Math.sign(A.tx - A.x) * Math.min(Math.abs(A.tx - A.x), dt * 4);
  // mouth: a jittery envelope while the voice is running
  const target = A.speaking ? 0.25 + 0.75 * Math.abs(Math.sin(A.t * 13) * Math.sin(A.t * 7.3 + 1)) : 0;
  A.talk += (target - A.talk) * Math.min(1, dt * 18);
  A.blush = Math.max(0, A.blush - dt * 0.6);
  A.wave = Math.max(0, A.wave - dt);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  (SKINS[cfg.skin] || SKINS.crab)(painter, { ...A, body: cfg.color });
  drawParticles(painter, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function setMood(m, secs = 0) {
  A.mood = m;
  A.moodUntil = secs ? A.t + secs : 0;
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
  if (A.asleep) { A.asleep = false; setMood('surprised', 0.8); say(t.woke, { hold: 2.5 }); setStatus(''); }
  idleTimer = setTimeout(() => {
    if (busy || listening) return poke();
    setMood('sleepy', 6);
    idleTimer = setTimeout(() => { if (!busy && !listening) { A.asleep = true; setStatus(t.sleeping); } }, 6000);
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
    if (A.mood === 'listening') setMood('calm');
    setStatus('');
    const text = heard.trim();
    if (text) send(text); else bubble.hidden = true;
  };
  try { rec.start(); } catch { return; }
  listening = true;
  $('sensor').classList.add('on');
  setMood('listening');
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
  A.blush = 1;
  spawn('heart', strokes > 2 ? 2 : 1);
  setMood('happy', 1.6);
  if (strokes === 1 || strokes % 4 === 0) {
    const line = t.petted[Math.floor(Math.random() * t.petted.length)];
    say(line, { hold: 1.8 });
  }
});

/* ------------------------------------------------------------------ Claude */

const MOODS = ['happy', 'curious', 'thinking', 'sad', 'surprised', 'sleepy', 'calm'];
const LANG_NAME = { 'ko-KR': 'Korean', 'en-US': 'English', 'ja-JP': 'Japanese' };

function systemPrompt() {
  return `You are ${cfg.name}, a tiny companion who lives inside a palm-sized keychain charm with a small round screen. Your owner taps a fingerprint sensor to talk to you; your words are read aloud by a speech synthesizer and shown a few lines at a time on that little screen.

Personality: ${cfg.persona || T[uiLang].persona0}

Keep replies short — usually one or two sentences, never more than four — in plain spoken language: no markdown, lists, emoji or URLs. Reply in ${LANG_NAME[cfg.lang] || 'the user\'s language'} unless the user writes in another language.

Begin every reply with exactly one mood tag chosen from [happy] [curious] [thinking] [sad] [surprised] [sleepy] [calm], then your words. The tag drives your face on the screen and is not read aloud.

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

let busy = false;
async function send(text) {
  text = text.trim();
  if (!text || busy) return;
  poke();
  hush();
  addLog('user', text);

  if (!cfg.key) {
    setMood('sad', 2.5);
    say(t.needKey, { hold: 7 });
    speak(t.needKey);
    mimeTalk(2500);
    return;
  }

  busy = true;
  $('talk').querySelector('button').disabled = true;
  history.push({ role: 'user', content: text });
  setMood('thinking');
  setStatus(t.thinking);
  say('', { hold: 0 });

  let raw = '', shown = '', spokenUpTo = 0, moodSet = false;
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

  try {
    const c = await getClient();
    const stream = streamFor(c, history.slice(-20));
    for await (const ev of stream) {
      if (ev.type !== 'content_block_delta' || ev.delta.type !== 'text_delta') continue;
      raw += ev.delta.text;
      if (!moodSet) {
        const m = raw.match(/^\s*\[(\w+)\]\s*/);
        if (m) { moodSet = true; setMood(MOODS.includes(m[1]) ? (m[1] === 'calm' ? 'calm' : m[1]) : 'calm', 8); raw = raw.slice(m[0].length); }
        else if (raw.length > 14 || !/^\s*\[/.test(raw)) { moodSet = true; setMood('calm'); }
        else continue;
      }
      shown = raw.replace(/\[(\w+)\]\s*/g, '');
      say(shown, { hold: 0 });
      setStatus(t.speaking);
      mimeTalk(1200);
      flushSpeech(false);
    }
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal' && !shown) {
      shown = t.errRefusal;
      setMood('sad', 3);
      say(shown, { hold: 6 });
    }
    flushSpeech(true);
    history.push({ role: 'assistant', content: shown || '…' });
    saveHistory();
    addLog('assistant', shown);
    say(shown, { hold: Math.min(14, 4 + shown.length / 18) });
  } catch (err) {
    history.pop(); // drop the unanswered user turn so history stays alternating
    const E = Anthropic || {};
    let line;
    if (E.AuthenticationError && err instanceof E.AuthenticationError) line = t.errKey;
    else if (E.PermissionDeniedError && err instanceof E.PermissionDeniedError) line = t.errKey;
    else if (E.RateLimitError && err instanceof E.RateLimitError) line = t.errRate;
    else if (E.APIConnectionError && err instanceof E.APIConnectionError) line = t.errNet;
    else if (!Anthropic) line = t.errNet; // the SDK itself failed to load
    else line = t.errOther(err?.error?.error?.message || err?.message || String(err));
    console.error(err);
    setMood('sad', 4);
    say(line, { hold: 8 });
    speak(line);
  } finally {
    busy = false;
    $('talk').querySelector('button').disabled = false;
    if (!A.speaking) setStatus('');
  }
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
  setMood('surprised', 1.5); say(t.forgot, { hold: 4 });
});

/* --------------------------------------------------------------- settings */

const COLORS = ['#d97757', '#e0a458', '#e8d5b5', '#8fae8b', '#7fa7d9', '#b39ddb', '#e58fa8', '#d9d4cc'];
const dlg = $('settings');

function drawSkinThumb(name) {
  const c = document.createElement('canvas');
  c.width = c.height = G * 2;
  const p = makePainter(c.getContext('2d'), 2);
  SKINS[name](p, { t: 0, mood: 'happy', talk: 0, lookX: 0, lookY: 0, x: 0, tx: 0, blush: 0, wave: 0, body: cfg.color });
  return c;
}

function renderPickers() {
  const skins = $('s-skins'); skins.innerHTML = '';
  for (const name of Object.keys(SKINS)) {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-pressed', cfg.skin === name); b.setAttribute('aria-label', name);
    b.append(drawSkinThumb(name));
    b.onclick = () => { cfg.skin = name; saveCfg(); renderPickers(); setMood('happy', 1.2); A.wave = 1; };
    skins.append(b);
  }
  const sw = $('s-colors'); sw.innerHTML = '';
  for (const col of COLORS) {
    const b = document.createElement('button');
    b.type = 'button'; b.style.background = col; b.setAttribute('aria-pressed', cfg.color === col); b.setAttribute('aria-label', col);
    b.onclick = () => { cfg.color = col; saveCfg(); document.documentElement.style.setProperty('--accent', col); renderPickers(); };
    sw.append(b);
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
setTimeout(() => { setMood('happy', 2.5); A.wave = 1.6; say(t.hello(cfg.name), { hold: 6 }); }, 400);
poke();
