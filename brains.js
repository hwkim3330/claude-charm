// brains.js — who answers when you talk to the charm.
//
//   claude   your own Anthropic API key (best)
//   nano     Chrome's built-in on-device model (window.LanguageModel), free, when the browser has it
//   local    a small open model running in this page on WebGPU (transformers.js in a worker), free, one download
//   offline  no AI at all: a hand-written companion that still chats, remembers your name and plays games
//
// Some questions have one right answer (the time, a timer, the weather, arithmetic, dice). Those never go to a
// model: skills() answers them in code, whatever brain is active, so a small model can't get them wrong.
//
// Every brain streams text that begins with a mood tag like "[happy]"; app.js turns the tag into Clawd's face.

export const LOCAL_MODEL = {
  id: 'onnx-community/gemma-3-1b-it-ONNX',
  label: 'Gemma 3 1B',
  sizeMB: 800,
};

// A couple of example turns teach a 1B model the format (tag first, short, warm) far better than rules do.
export const SHOTS = {
  ko: [['나 오늘 너무 피곤해', '[sleepy] 오늘 고생 많았어. 따뜻한 물로 씻고 푹 쉬자.'], ['나 면접 붙었어!', '[excited] 우와, 진짜 축하해! 네가 해낼 줄 알았어.']],
  en: [["I'm so tired today", "[sleepy] You worked hard today. Get cozy and rest up."], ['I got the job!', "[excited] No way, congratulations! I knew you'd do it."]],
};

// Small models sprinkle emoji and markdown; the voice would read them out.
export const tidy = (t) => t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/[*_#`>]+/g, '').replace(/\s{2,}/g, ' ');

/* ------------------------------------------------------------------ memory */

const mem = {
  get() { try { return JSON.parse(localStorage.getItem('charm.profile') || '{}'); } catch { return {}; } },
  set(p) { try { localStorage.setItem('charm.profile', JSON.stringify(p)); } catch {} },
};
export const profile = () => mem.get();
export function remember(k, v) { const p = mem.get(); p[k] = v; mem.set(p); }

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const ko = (lang) => lang.startsWith('ko');

/* ------------------------------------------------------------------ skills */

// Answers that must be right. Returns { text, mood, action? } or null. Async for the weather.
export async function skills(text, lang, ctx) {
  const s = text.trim(), K = ko(lang), L = s.toLowerCase();
  const now = new Date();

  // timer: "3분 타이머", "10초 뒤에 알려줘", "timer 5 minutes"
  // "1시간 30분" / "1 hour 30 minutes": every number-unit pair counts, not just the first
  const parts = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(초|분|시간|sec(?:ond)?s?|min(?:ute)?s?|hours?|h\b|m\b|s\b)/gi)];
  if (parts.length && /(타이머|알려|깨워|뒤에|후에|timer|remind|wake|later|in \d)/i.test(s)) {
    let sec = 0;
    for (const [, n, u] of parts) sec += /^(시간|h)/i.test(u) ? n * 3600 : /^(분|m)/i.test(u) ? n * 60 : +n;
    if (sec > 0 && sec <= 24 * 3600) {
      ctx.timer(sec);
      const span = parts.map((p) => K ? p[1] + p[2] : `${p[1]} ${p[2]}`).join(' ');
      const say = K ? `${span} 타이머 시작! 끝나면 춤추면서 알려줄게.` : `Timer set for ${span}. I'll dance when it's done!`;
      return { text: say, mood: 'determined' };
    }
  }
  // time / date
  if (/(몇\s*시(?!간)|지금 시간|what time|the time)/i.test(s)) {
    const h = now.getHours(), mi = now.getMinutes();
    const t = K ? `지금은 ${h < 6 ? '새벽' : h < 12 ? '오전' : h < 18 ? '오후' : '밤'} ${h % 12 || 12}시 ${mi ? mi + '분' : '정각'}이야.` : `It's ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`;
    return { text: t, mood: 'neutral' };
  }
  if (/(며칠|몇\s*월|날짜|무슨\s*요일|what day|today'?s date|what date)/i.test(s)) {
    const t = K ? `오늘은 ${now.getMonth() + 1}월 ${now.getDate()}일 ${'일월화수목금토'[now.getDay()]}요일이야.`
      : `Today is ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`;
    return { text: t, mood: 'neutral' };
  }
  // weather (Open-Meteo, free and keyless)
  if (/(날씨|기온|비 와|비와|눈 와|weather|temperature|raining)/i.test(s)) return weather(s, K);
  // arithmetic: "12 곱하기 3", "3+4는?", "what is 7*8"
  const expr = s.replace(/더하기|플러스|plus/gi, '+').replace(/빼기|마이너스|minus/gi, '-').replace(/곱하기|times|x(?=\s*\d)|×/gi, '*')
    .replace(/나누기|divided by|÷/gi, '/').replace(/[는은이가]?\s*(얼마|몇이야|뭐야|\?|=)\s*$/g, '').replace(/^(what is|what's|calculate)\s*/i, '');
  if (/^[\d\s.+\-*/()]+$/.test(expr) && /\d\s*[+\-*/]\s*[\d(]/.test(expr)) {
    try {
      const v = Function(`"use strict";return (${expr})`)();
      if (Number.isFinite(v)) {
        const r = Math.round(v * 1e6) / 1e6;
        return { text: K ? `${r}! 계산은 자신 있어.` : `That's ${r}!`, mood: 'proud' };
      }
    } catch {}
  }
  // dice / coin / rock-paper-scissors
  if (/(주사위|dice|roll a die)/i.test(s)) { const d = 1 + Math.floor(Math.random() * 6); return { text: K ? `데구르르… ${d}!` : `Rolling… ${d}!`, mood: d === 6 ? 'starstruck' : 'excited' }; }
  if (/(동전|coin|heads or tails)/i.test(s)) { const h = Math.random() < 0.5; return { text: K ? (h ? '앞면!' : '뒷면!') : (h ? 'Heads!' : 'Tails!'), mood: 'excited' }; }
  const RPS = K ? ['가위', '바위', '보'] : ['rock', 'paper', 'scissors'];
  // look for the move outside the game's own name: "rock paper scissors" starts with "rock" but isn't a throw
  const GAME = /(가위바위보|rock.?paper.?scissors)/i, rest = s.replace(new RegExp(GAME.source, 'gi'), ' ');
  const mine = RPS.findIndex((w) => new RegExp(`(^|\\s)${w}(\\s|!|$)`, 'i').test(rest));
  if (GAME.test(s) && mine < 0) return { text: K ? '좋아! 가위, 바위, 보 중에 하나 말해!' : 'Okay! Say rock, paper or scissors!', mood: 'playful' };
  if (mine >= 0 && s.length < 12) {
    const me = Math.floor(Math.random() * 3);
    // ko order: 가위(0) 바위(1) 보(2); en order: rock(0) paper(1) scissors(2). "beats": x beats y
    const beats = K ? (a, b) => (a === 1 && b === 0) || (a === 2 && b === 1) || (a === 0 && b === 2)
      : (a, b) => (a === 0 && b === 2) || (a === 1 && b === 0) || (a === 2 && b === 1);
    const r = me === mine ? 'draw' : beats(me, mine) ? 'win' : 'lose';
    const line = K ? { draw: `나도 ${RPS[me]}! 비겼다.`, win: `나는 ${RPS[me]}! 내가 이겼다!`, lose: `나는 ${RPS[me]}… 졌어!` }[r]
      : { draw: `${RPS[me]}! A draw.`, win: `${RPS[me]}! I win!`, lose: `${RPS[me]}… you win!` }[r];
    return { text: line, mood: { draw: 'surprised', win: 'proud', lose: 'cry' }[r] };
  }
  return null;
}

const KO_CITY = {
  서울: 'Seoul', 부산: 'Busan', 인천: 'Incheon', 대구: 'Daegu', 대전: 'Daejeon', 광주: 'Gwangju', 울산: 'Ulsan', 세종: 'Sejong',
  수원: 'Suwon', 성남: 'Seongnam', 판교: 'Seongnam', 분당: 'Seongnam', 용인: 'Yongin', 고양: 'Goyang', 일산: 'Goyang', 부천: 'Bucheon',
  안양: 'Anyang', 창원: 'Changwon', 청주: 'Cheongju', 전주: 'Jeonju', 천안: 'Cheonan', 포항: 'Pohang', 제주: 'Jeju', 서귀포: 'Seogwipo',
  강릉: 'Gangneung', 춘천: 'Chuncheon', 원주: 'Wonju', 여수: 'Yeosu', 경주: 'Gyeongju', 김해: 'Gimhae', 평택: 'Pyeongtaek', 화성: 'Hwaseong',
  도쿄: 'Tokyo', 오사카: 'Osaka', 뉴욕: 'New York', 런던: 'London', 파리: 'Paris', 베이징: 'Beijing', 상하이: 'Shanghai', 방콕: 'Bangkok',
};
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 ? a : b; };

async function weather(s, K) {
  const p = mem.get();
  let city = (s.match(/([가-힣A-Za-z]{2,12})\s*(?:날씨|기온)/) || s.match(/weather (?:in|at) ([A-Za-z ]{2,24})/i) || [])[1];
  if (city && /^(오늘|내일|지금|현재|the|today)$/i.test(city)) city = null;
  city = city || p.city || (K ? '서울' : 'Seoul');
  // Open-Meteo's geocoder only knows romanised names, so the common Korean ones are mapped first.
  const q = KO_CITY[city.replace(/(시|특별시|광역시)$/, '')] || city;
  try {
    const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=${K ? 'ko' : 'en'}`)).json();
    const loc = g.results && g.results[0];
    if (!loc) return { text: K ? `${city}${josa(city, '이', '가')} 어딘지 모르겠어.` : `I don't know where ${city} is.`, mood: 'confused' };
    const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`)).json();
    const c = w.current.weather_code, T = Math.round(w.current.temperature_2m);
    const hi = Math.round(w.daily.temperature_2m_max[0]), lo = Math.round(w.daily.temperature_2m_min[0]);
    const kind = c === 0 ? 0 : c <= 3 ? 1 : c <= 48 ? 2 : c <= 67 || (c >= 80 && c <= 82) ? 3 : c <= 77 || c === 85 || c === 86 ? 4 : 5;
    const kw = K ? ['맑아', '구름이 좀 있어', '안개가 꼈어', '비가 와', '눈이 와', '천둥번개가 쳐'][kind] : ['clear', 'a bit cloudy', 'foggy', 'raining', 'snowing', 'stormy'][kind];
    remember('city', city);
    const text = K ? `${loc.name}${josa(loc.name, '은', '는')} 지금 ${T}도, ${kw}. 오늘은 ${lo}도에서 ${hi}도 사이야.${kind === 3 ? ' 우산 챙겨!' : ''}`
      : `${loc.name}: ${T}°C and ${kw}. Today ${lo}–${hi}°C.${kind === 3 ? ' Take an umbrella!' : ''}`;
    return { text, mood: [ 'happy', 'neutral', 'suspicious', 'sad', 'excited', 'scared' ][kind] };
  } catch {
    return { text: K ? '날씨를 못 가져왔어. 인터넷이 안 되나 봐.' : "Couldn't fetch the weather.", mood: 'nervous' };
  }
}

/* ----------------------------------------------------------------- offline */

// A small hand-written companion. Not clever, but warm, quick and never broken.
export function offlineReply(text, lang, name) {
  const s = text.trim(), K = ko(lang), p = mem.get(), you = p.userName;
  const R = (mood, ...lines) => ({ text: pick(lines), mood });

  // learning your name
  let m = s.match(/(?:내 이름은|나는|난)\s*([가-힣A-Za-z]{1,10}?)(?:이?야|이?라고 해|이에요|예요|입니다|이?라고 불러)/) || s.match(/(?:my name is|call me)\s+([A-Za-z]{2,12})/i)
    || s.match(/\b[Ii](?:'m| am)\s+([A-Z][a-z]{1,11})\b/);   // "I'm Kim" yes, "I'm tired" no: a name is capitalised
  // "나는 학생이야" / "I'm Fine" describe you, they don't name you
  if (m && !/(배고|졸려|슬퍼|좋아|괜찮|피곤|행복|학생|직장인|회사원|사람|개발자|선생|의사|엄마|아빠|남자|여자|어른|아이|혼자|여기|진짜|정말|완전|^(Fine|Good|Great|Okay|Ok|Sorry|Happy|Sad|Tired|Hungry|Bored|Here|Back|Home|So|Not|Just|Really|Very|Still|Done|Busy|Sick)$)/i.test(m[1])) {
    remember('userName', m[1]);
    return R('happy', K ? `${m[1]}! 좋은 이름이다. 이제 안 까먹을게.` : `${m[1]}! Lovely name. I'll remember it.`);
  }
  if (/(내 이름|my name)/i.test(s) && /(뭐|알아|기억|what|remember|know)/i.test(s)) {
    return you ? R('proud', K ? `당연하지, ${you}!` : `Of course, ${you}!`) : R('shy', K ? '아직 안 알려줬잖아! 이름이 뭐야?' : "You haven't told me yet! What's your name?");
  }

  const rules = K ? [
    [/^(안녕|하이|헬로|반가|ㅎㅇ|여보세요)/, () => R('happy', `안녕${you ? ', ' + you : ''}! 보고 싶었어.`, '안녕! 오늘은 무슨 일 있었어?', `반가워! 나 ${name}야.`)],
    [/(누구|이름이 뭐|너 뭐야|정체)/, () => R('proud', `나는 ${name}! 네 주머니 속에 사는 작은 친구야.`, `${name}라고 해. 열쇠고리 속에 살아!`)],
    [/(기분 어때|잘 지냈|어떻게 지내|괜찮아\?)/, () => R('happy', '너랑 얘기하니까 기분 최고야!', '좋아! 방금 화면 속에서 산책했어.', '조금 심심했는데 네가 와서 좋아.')],
    [/^(?!.*\?).*(사랑해|너(가|를)? ?좋아|좋아해(요)?[!~.]*$|최고야|귀여워|예뻐)/, () => R(pick(['love', 'shy']), '헤헤… 나도 네가 좋아!', '부끄럽잖아… 그래도 고마워!', '나도! 완전 좋아해.')],
    [/(바보|멍청|싫어|못생|짜증나 너)/, () => R(pick(['sad', 'angry']), '흥, 그런 말 하면 서운해!', '나 상처받았어… 쓰다듬어 주면 풀릴지도.', '에이, 진심 아니지?')],
    [/(고마워|감사|땡큐)/, () => R('happy', '천만에! 언제든지.', '헤헤, 도움이 됐다니 좋다.')],
    [/(미안|죄송)/, () => R('relieved', '괜찮아, 다 이해해.', '에이, 미안해할 거 없어!')],
    [/(슬퍼|우울|힘들|망쳤|속상|외로|울고 싶|지쳤)/, () => R('sad', '많이 힘들었구나… 내가 옆에 있을게.', '그런 날도 있어. 오늘은 푹 쉬자.', '토닥토닥. 얘기하고 싶으면 다 들어줄게.')],
    [/(신나|행복|기뻐|합격|붙었|상 받|성공|해냈|좋은 일)/, () => R(pick(['excited', 'starstruck']), '우와, 진짜 대단하다! 축하해!', '대박! 나까지 신나!', '역시 너야! 춤이라도 춰야겠다.')],
    [/(배고|뭐 먹|점심|저녁|아침|메뉴|야식)/, () => R('idea', `${pick(['김치찌개', '떡볶이', '돈까스', '비빔밥', '라면', '초밥', '치킨', '쌀국수', '햄버거', '냉면'])} 어때? 갑자기 나도 배고프다.`)],
    [/(졸려|잘 자|잘자|피곤|잠 와|굿나잇)/, () => R('sleepy', '나도 졸려… 같이 자자.', '잘 자! 좋은 꿈 꿔.', '푹 자고 내일 또 얘기하자.')],
    [/(심심|놀아|재밌는 거|뭐 하지)/, () => R('playful', '가위바위보 할래? 아니면 주사위 굴려줄까?', '춤춰줄까? "춤춰" 라고 말해봐!', '수수께끼 하나 낼까? "수수께끼" 라고 해봐!')],
    [/(농담|웃겨|개그|유머)/, () => R('laugh', '세상에서 가장 가난한 왕은? 최저임금!', '바나나가 웃으면? 바나나킥!', '소가 웃으면? 우하하!', '왕이 넘어지면? 킹콩!', '신발이 화나면? 신발끈!')],
    [/(수수께끼|퀴즈)/, () => R('mischief', '문제! 먹으면 먹을수록 늘어나는 건? …나이!', '문제! 들어갈 땐 까맣고 나올 땐 빨간 건? …숯!', '문제! 세상에서 제일 뜨거운 과일은? …천도복숭아!')],
    [/(춤|댄스)/, () => ({ text: pick(['좋아, 간다!', '음악 스타트!', '내 춤 실력 봐봐!']), mood: 'dance' })],
    [/(노래|불러)/, () => R('cool', '둥가둥가~ 나는 작은 클로~ 네 주머니에 산다네~', '랄랄라~ 오늘도 좋은 하루~')],
    [/(운세|오늘 어때|행운)/, () => R('starstruck', `오늘의 행운 색은 ${pick(['주황', '파랑', '초록', '보라', '노랑'])}! ${pick(['좋은 소식이 올 거야.', '작은 친절이 돌아올 거야.', '맛있는 걸 먹게 될 거야.'])}`)],
    [/(뭐 해|뭐해|뭐하고)/, () => R('neutral', '화면 속에서 너 기다리고 있었지!', '방금 산책하고 왔어.', '멍 때리는 중이었어.')],
    [/(무서|겁나|떨려|긴장)/, () => R('nervous', '괜찮아, 괜찮아. 심호흡 크게!', '떨리는 건 열심히 하고 있다는 뜻이야.')],
    [/(화나|열받|빡쳐|짜증)/, () => R('angry', '누가 그랬어! 내가 혼내줄게!', '진짜 화나겠다… 크게 한 번 소리 질러봐!')],
    [/(ai|인공지능|클로드|claude)/i, () => R('thinking', '지금은 인공지능 없이 내 머리로만 대답하는 중이야. 설정에서 무료 AI를 켜면 더 똑똑해져!')],
  ] : [
    [/^(hi|hello|hey|yo|good (morning|evening))/i, () => R('happy', `Hi${you ? ', ' + you : ''}! I missed you.`, 'Hello! What have you been up to?', `Hey! I'm ${name}.`)],
    [/(who are you|your name)/i, () => R('proud', `I'm ${name}, a tiny friend who lives in your pocket.`)],
    [/(how are you|how's it going|you ok)/i, () => R('happy', "Great now that you're here!", 'Good! I just went for a walk around the screen.')],
    [/(love you|like you|cute|best)/i, () => R(pick(['love', 'shy']), 'Hehe… I like you too!', "You're making me blush!")],
    [/(stupid|dumb|hate you|ugly)/i, () => R('sad', "Hey, that hurts! A head pat might fix it.")],
    [/(thank)/i, () => R('happy', 'Anytime!', 'Happy to help!')],
    [/(sad|tired|lonely|bad day|failed|upset)/i, () => R('sad', "That sounds hard. I'm right here with you.", 'Some days are like that. Rest up.')],
    [/(happy|excited|passed|won|great news|did it)/i, () => R('excited', "Wow, that's amazing! Congrats!", "Yes! I'm so happy for you!")],
    [/(hungry|lunch|dinner|eat)/i, () => R('idea', `How about ${pick(['pizza', 'ramen', 'tacos', 'sushi', 'a burger', 'pasta'])}?`)],
    [/(sleep|tired|good ?night)/i, () => R('sleepy', 'Sweet dreams!', "I'm sleepy too… night night.")],
    [/(bored|play|fun)/i, () => R('playful', 'Rock paper scissors? Or should I roll a dice?', 'Ask me to dance!')],
    [/(joke|funny)/i, () => R('laugh', 'Why did the scarecrow win an award? He was outstanding in his field!', 'What do you call a fake noodle? An impasta!')],
    [/(dance)/i, () => ({ text: "Let's go!", mood: 'dance' })],
    [/(sing|song)/i, () => R('cool', 'La la la~ a tiny friend in your pocket~')],
  ];
  for (const [re, f] of rules) if (re.test(s)) return f();

  // anything else: listen, reflect, ask back (marked, so a model brain can take these instead)
  return { ...fallbackLine(s, K), fallback: true };
}

function fallbackLine(s, K) {
  const R = (mood, ...lines) => ({ text: pick(lines), mood });
  const q = /\?$|(뭐|왜|어떻게|언제|어디|누가|what|why|how|when|where|who)/i.test(s);
  if (K) return q ? R('thinking', '음… 어려운 질문이다. 설정에서 무료 AI를 켜주면 더 잘 대답할 수 있어!', '글쎄, 너는 어떻게 생각해?')
    : R(pick(['curious', 'hopeful', 'neutral']), '그렇구나! 더 얘기해줘.', '오, 그래서 어떻게 됐어?', '흥미롭다… 그거 좋아?', '응응, 듣고 있어!');
  return q ? R('thinking', "Hmm, tough one. Turn on the free AI in settings and I'll do better!") : R('curious', 'I see! Tell me more.', 'Oh? What happened next?', "I'm listening!");
}

// Small models ramble; the charm speaks in one or two sentences. While streaming, keep what's there until the
// second sentence is complete; at the end (final), drop a dangling half-sentence cut off by the token limit.
export function clip(t, n = 2, final = false) {
  t = t.split(/\n\s*\n/)[0];
  const parts = t.match(/[^.!?。！？]+[.!?。！？]+["'”’)]?/g) || [];
  if (parts.length >= n) return parts.slice(0, n).join('').trim();
  if (final && parts.length) return parts.join('').trim();
  return t.trim();
}

/* ------------------------------------------------------------ Chrome built-in */

export async function nanoAvailable() {
  try {
    if (!('LanguageModel' in self)) return 'no';
    return await self.LanguageModel.availability();   // 'unavailable' | 'downloadable' | 'downloading' | 'available'
  } catch { return 'no'; }
}

let nanoSession = null, nanoSys = '';
export async function nanoReply(system, history, text, onText) {
  if (!nanoSession || nanoSys !== system) {
    nanoSession?.destroy?.();
    nanoSession = await self.LanguageModel.create({
      initialPrompts: [{ role: 'system', content: system }, ...history.slice(-8)],
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
    nanoSys = system;
  }
  let full = '';
  const stream = nanoSession.promptStreaming(text);
  for await (const chunk of stream) {
    // older Chrome builds stream the whole text so far; newer ones stream deltas
    full = chunk.startsWith(full) && full ? chunk : full + chunk;
    onText(full);
  }
  return full;
}

/* ------------------------------------------------------------- local WebGPU */

let worker = null, loaded = false, loading = null;
const pending = new Map();
let seq = 0;

export const hasWebGPU = () => !!navigator.gpu;
export const localLoaded = () => loaded;

export function loadLocal(onProgress) {
  if (loaded) return Promise.resolve();
  if (loading) return loading;
  worker = new Worker(new URL('./llm-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const d = e.data;
    if (d.type === 'progress') onProgress?.(d);
    else if (d.type === 'text') pending.get(d.id)?.onText(d.text);
    else if (d.type === 'done') { pending.get(d.id)?.resolve(d.text); pending.delete(d.id); }
    else if (d.type === 'error') { const p = d.id != null ? pending.get(d.id) : null; if (p) { p.reject(new Error(d.message)); pending.delete(d.id); } else loading?.reject?.(new Error(d.message)); }
  };
  loading = new Promise((resolve, reject) => {
    const h = (e) => {
      if (e.data.type === 'ready') { loaded = true; worker.removeEventListener('message', h); resolve(); }
      if (e.data.type === 'error' && e.data.id == null) { worker.removeEventListener('message', h); loading = null; reject(new Error(e.data.message)); }
    };
    worker.addEventListener('message', h);
    worker.postMessage({ type: 'load', model: LOCAL_MODEL.id });
  });
  return loading;
}

export function localReply(system, history, text, onText) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onText });
    const shots = (SHOTS[system.includes('Korean') || /[가-힣]/.test(text) ? 'ko' : 'en']).flatMap(([u, a]) => [{ role: 'user', content: u }, { role: 'assistant', content: a }]);
    worker.postMessage({ type: 'generate', id, messages: [{ role: 'system', content: system }, ...shots, ...history.slice(-6), { role: 'user', content: text }] });
  });
}

/* ------------------------------------------------------------- mood guesser */

// Small models forget the tag sometimes; guess a face from the words instead.
export function guessMood(t) {
  if (/(축하|대박|최고|신나|야호|congrat|amazing|awesome|yay)/i.test(t)) return 'excited';
  if (/(미안|슬퍼|힘들|괜찮아|토닥|sorry|sad|hard)/i.test(t)) return 'sad';
  if (/(사랑|좋아해|♥|love)/i.test(t)) return 'love';
  if (/(음\.\.\.|글쎄|생각|hmm|think)/i.test(t)) return 'thinking';
  if (/(\?|궁금|curious)/.test(t)) return 'curious';
  if (/(!|하하|헤헤|ㅋㅋ|haha)/.test(t)) return 'happy';
  return 'neutral';
}
