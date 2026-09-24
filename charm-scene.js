// charm-scene.js — what the charm's round screen shows, painted with the vendored Claude Animation Base
// (vendor/claude-animation-base: p5.js + p5.brush, watercolour and ink).
//
// The base renders videos offline, one pure function of t per frame. Here the same drawWorld(t) runs live: the
// screen is repainted 12 times a second ("on twos", the same rate the base boils its linework at), and the app
// changes what it shows by appending acted emotion keys that emotions() turns into squint-swap-take transitions.
//
// Loaded as a classic script after core.js and clawd.js; app.js talks to it through window.CHARM.

const CHARM = (() => {
  const now = () => performance.now() / 1000;
  const S = {
    keys: [[-10, 'neutral']],   // acted emotion timeline, see emotions() in clawd.js
    hat: null, col: null,
    talk: 0,                    // 0..1 mouth envelope while the voice runs
    listening: false,
    asleep: false,
    danceUntil: 0,
    x: 0, tx: 0, walkD: 0, lastT: now(), idleAt: now() + 4,
    lookUntil: 0, lookX: 0,
    petUntil: 0,
    thumb: null,                // when set, drawWorld paints a hat thumbnail instead of the scene
    ms: [],
    lite: false,                // cheap flat backdrop instead of a watercolour fill (slow GPUs)
  };

  function emotion(name, over) {
    if (!EMO[name]) name = 'neutral';
    const last = S.keys[S.keys.length - 1];
    if (last[1] === name && !over) return;
    S.keys.push([now(), name, over]);
    if (S.keys.length > 3) S.keys.shift();
  }
  const current = () => S.keys[S.keys.length - 1][1];

  // Night after 21:00 and while asleep. ?night=1 / ?night=0 forces it (for checking both looks).
  const forceNight = new URLSearchParams(location.search).get('night');
  function isNight() {
    if (S.asleep) return true;
    if (forceNight) return forceNight === '1';
    const h = new Date().getHours();
    return h >= 21 || h < 6;
  }

  // Backdrop colours per mood: a soft watercolour pool behind Clawd.
  const MOOD_BG = {
    neutral: PAL.sky, happy: PAL.ochre, excited: PAL.ochre, laugh: PAL.ochre, love: PAL.rose, shy: PAL.rose,
    proud: PAL.ochre, smug: PAL.violet, relieved: PAL.sap, sad: PAL.indigo, cry: PAL.indigo, angry: '#D8394E',
    furious: '#D8394E', scared: PAL.violet, surprised: PAL.ochre, confused: PAL.violet, thinking: PAL.teal,
    idea: PAL.ochre, determined: PAL.clay, sleepy: PAL.indigo, bored: PAL.sky, nervous: PAL.violet,
    suspicious: PAL.violet, disgusted: PAL.sap, dizzy: PAL.violet, cool: PAL.teal, starstruck: PAL.ochre,
    ko: PAL.sky, playful: PAL.rose, mischief: PAL.violet, hopeful: PAL.sky,
  };

  function backdrop(t, name) {
    const night = isNight();
    if (night) {
      paint(rectPts(-20, -20, W + 40, H + 40), { wash: PAL.night, washOp: 235, ink: null });
      boilSeed('stars');
      for (let i = 0; i < 9; i++) {
        const sx = W * (.12 + .76 * hash(i * 3.1)), sy = H * (.08 + .38 * hash(i * 7.7)), r = W * (.008 + .006 * hash(i));
        paint(starPts(sx, sy, r * (1 + .25 * Math.sin(t * 2 + i)), .4, 4), { wash: PAL.cream, ink: null });
      }
      boilSeed('moon');
      paint(ellPts(W * .74, H * .2, W * .06, W * .06, 20, 1), { wash: '#F6E7B8', ink: PAL.ink, sw: .8 });
      paint(ellPts(W * .765, H * .185, W * .05, W * .05, 20, 1), { wash: PAL.night, ink: null });
    }
    // mood pool (one watercolour fill: the expensive kind, so only one)
    boilSeed('pool');
    const col = MOOD_BG[name] || PAL.sky;
    const poolCol = night ? mixCol(col, PAL.night, .5) : col;
    if (S.lite) paint(ellPts(W / 2, H * .6, W * .34, H * .27, 26, W * .012), { wash: mixCol(poolCol, night ? PAL.night : PAL.paper, .55), washOp: 150, ink: null });
    else paint(ellPts(W / 2, H * .6, W * .34, H * .27, 26, W * .012), { fill: poolCol, fillOp: night ? 70 : 85, bleed: .25, tex: .5, border: .5, ink: null });
    // floor
    boilSeed('floor');
    const gy = H * .8;
    paint([[-20, gy + 4], [W * .3, gy + 2], [W * .7, gy + 5], [W + 20, gy + 3], [W + 20, H + 20], [-20, H + 20]],
      { wash: night ? mixCol(PAL.night, PAL.indigo, .6) : mixCol(PAL.paper, PAL.clay, .18), washOp: 200, ink: null });
    inkLine([[W * .06, gy + 3], [W * .5, gy + 1], [W * .94, gy + 4]], .9, night ? PAL.cream : mixCol(PAL.paper, PAL.ink, .4), 'inkfine', .5);
  }

  // Sound marks either side while it listens.
  function listenMarks(t, cx, cy, u) {
    boilSeed('ears');
    const lvl = .5 + .5 * Math.sin(t * 9);
    for (const s of [-1, 1]) for (let r = 0; r < 2; r++) {
      const R = (7.2 + r * 1.6 + lvl * .5) * u, pts = [];
      for (let k = -3; k <= 3; k++) { const a = (s < 0 ? Math.PI : 0) + k * .16; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
      inkLine(pts, 1.2 - r * .4, S.col || PAL.clay, 'ink', .6);
    }
  }

  function drawScene(t) {
    const dt = Math.min(.5, t - S.lastT); S.lastT = t;
    const u = W * .04, cx = W / 2, gy = H * .8;
    let name = current();

    // idle life: wander and look around when nothing else is going on
    const idle = !S.listening && !S.talk && !S.asleep && t > S.danceUntil && (name === 'neutral' || name === 'happy' || name === 'hopeful');
    if (idle && t > S.idleAt) {
      S.idleAt = t + 4 + Math.random() * 6;
      if (Math.random() < .55) S.tx = (Math.random() - .5) * W * .32;
      else { S.lookUntil = t + 1.6; S.lookX = Math.random() < .5 ? -.8 : .8; }
    }
    if (!idle) S.tx = S.listening || S.talk ? 0 : S.tx;
    const dx = S.tx - S.x, step = Math.sign(dx) * Math.min(Math.abs(dx), dt * u * 3.2);
    S.x += step; S.walkD += Math.abs(step) / (4 * u);
    const walking = Math.abs(dx) > u * .3;

    backdrop(t, name);

    let o = { ...emotions(t, S.keys), boilKey: 'clawd' };
    if (S.hat) o.hat = S.hat;
    if (S.col) { o.col = mixCol(S.col, o.col || S.col, o.tint ? .35 : 0); o.dk = mixCol(S.col, '#3a1a10', .3); o.lt = mixCol(S.col, '#FFF1E6', .42); o.tint = null; }

    if (t < S.danceUntil) Object.assign(o, move('mix', t), { emote: 'music', emoteK: 1, eyes: 'happy', mouth: 'open' });
    else if (walking) Object.assign(o, { walk: S.walkD, view: 'q', flip: dx < 0, dy: (o.dy || 0) - Math.abs(Math.sin(S.walkD * Math.PI)) * .5 });
    else if (idle && t < S.lookUntil) Object.assign(o, { eyes: 'look', lookX: S.lookX, lookY: -.2 });
    if (t < S.petUntil) Object.assign(o, { blush: 1, eyes: 'happy', mouth: 'cat', emote: 'hearts', emoteK: 1, emoteAge: 3 - (S.petUntil - t) });

    // talking: the reply's emotion keeps the eyes and body, the mouth follows the voice
    if (S.talk > .06) { o.mouth = S.talk > .55 ? 'open' : S.talk > .25 ? 'O' : 'o'; o.dy = (o.dy || 0) - S.talk * .35; o.lid = 0; }
    if (S.listening) listenMarks(t, cx + S.x, gy - 5 * u, u);

    clawd(cx + S.x, gy, u, o);
  }

  function drawThumb(t) {
    const { hat, col } = S.thumb;
    paint(rectPts(-20, -20, W + 40, H + 40), { wash: PAL.paper, ink: null });
    const u = W * .058;
    clawd(W / 2, H * .86, u, { ...feel('happy', 0), hat: hat === 'none' ? null : hat, col, dk: col && mixCol(col, '#3a1a10', .3), lt: col && mixCol(col, '#FFF1E6', .42), noShadow: false, dy: 0, sq: 0, boilKey: 'thumb' });
  }

  // ---- quality ----
  // p5.brush's watercolour fills are the whole cost of a frame (about 45 of 50 ms on a desktop; outlines and washes
  // are cheap), so quality is a question of how much fill to paint:
  //   full: the base's fills as written.  mid: bleed capped and no pigment texture (looks nearly the same).
  //   lite: no watercolour fills at all, only flat washes and ink (for phones).
  // The tier adapts to this device from measured frame times and is remembered.
  const Q = ['lite', 'mid', 'full'];
  let quality = 'mid', fps = BOIL;
  try { const q = localStorage.getItem('charm.quality'); if (Q.includes(q)) quality = q; } catch {}
  const orig = {};
  function applyQuality() {
    if (!orig.fill) for (const k of ['fill', 'noFill', 'fillBleed', 'fillTexture']) orig[k] = brush[k].bind(brush);
    brush.fill = quality === 'lite' ? () => orig.noFill() : orig.fill;
    brush.fillBleed = quality === 'mid' ? (v) => orig.fillBleed(Math.min(v, .02)) : orig.fillBleed;
    brush.fillTexture = quality === 'mid' ? () => orig.fillTexture(0, 0) : orig.fillTexture;
    S.lite = quality === 'lite';
  }
  function setQuality(q, remember = true) {
    quality = q; S.ms = []; applyQuality();
    if (remember) try { localStorage.setItem('charm.quality', q); } catch {}
  }
  function adapt() {
    if (S.ms.length < 24) return;
    const avg = S.ms.reduce((a, b) => a + b, 0) / S.ms.length, i = Q.indexOf(quality);
    if (avg > 62 && i > 0) setQuality(Q[i - 1]);
    else if (avg > 95 && fps > 8) { fps = 8; restart(); S.ms = []; }
    else if (avg < 22 && i < 2) setQuality(Q[i + 1]);
    else S.ms = S.ms.slice(-8);
  }

  // ---- render loop: 12 drawings a second (8 on slow devices) ----
  let running = false, busy = false, timer = 0;
  async function paintAt(t) {
    T = t;
    await redraw();
    composite(t);
  }
  async function tick() {
    if (!window.ready || busy || document.hidden) return;
    busy = true;
    const t0 = performance.now();
    try { await paintAt(now()); } finally { busy = false; }
    S.ms.push(performance.now() - t0); if (S.ms.length > 30) S.ms.shift();
    adapt();
  }
  function restart() { clearInterval(timer); timer = setInterval(tick, 1000 / fps); }
  async function start() {
    if (running) return; running = true;
    await wait();
    const out = document.getElementById('out');
    if (out.width !== W) { out.width = W; out.height = H; }
    applyQuality();
    restart();
  }
  const wait = () => new Promise((r) => { const f = () => (window.ready ? r() : setTimeout(f, 50)); f(); });

  // A hat thumbnail for the settings sheet: paint one frame of Clawd wearing it, copy the screen.
  async function thumb(hat, col, size = 96) {
    await wait();
    while (busy) await new Promise((r) => setTimeout(r, 10));
    busy = true;
    try {
      S.thumb = { hat, col };
      await paintAt(now());
      const c = document.createElement('canvas'); c.width = c.height = size;
      c.getContext('2d').drawImage(document.getElementById('out'), W * .1, H * .06, W * .8, H * .86, 0, 0, size, size);
      return c.toDataURL('image/png');
    } finally { S.thumb = null; busy = false; }
  }

  return {
    S, emotion, current, start, thumb, wait,
    talk(v) { S.talk = v; },
    listen(on) { S.listening = on; if (on) S.danceUntil = 0; emotion(on ? 'hopeful' : 'neutral'); },
    sleep(on) { S.asleep = on; S.danceUntil = 0; S.tx = S.x; emotion(on ? 'sleepy' : 'surprised'); },
    isNight,
    pet() { S.petUntil = now() + 1.6; S.idleAt = now() + 3; },
    dance(secs = 8) { S.danceUntil = now() + secs; },
    setHat(h) { S.hat = h && h !== 'none' ? h : null; },
    setColor(c) { S.col = c && c.toLowerCase() !== PAL.clay.toLowerCase() ? c : null; },
    _scene: drawScene, _thumb: drawThumb,
    quality: () => quality, setQuality,
    msPerFrame() { return S.ms.length ? S.ms.reduce((a, b) => a + b, 0) / S.ms.length : 0; },
    EMOTIONS: Object.keys(EMO),
  };
})();
window.CHARM = CHARM;

// core.js calls this once per frame, inside its paper-and-grain compositing.
function drawWorld(t) {
  if (CHARM.S.thumb) CHARM._thumb(t); else CHARM._scene(t);
  flushLetters();
}
