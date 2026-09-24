---
title: Claude Charm
emoji: 🔸
colorFrom: red
colorTo: yellow
sdk: static
pinned: false
license: mit
short_description: A pocket AI companion you tap to talk to
---

# Claude Charm

A palm-sized companion you tap to talk to. It's an unofficial, Claude-flavoured web take on the
**Muse Charm** keychain Meta showed at Connect 2026: a round screen, a little animated avatar,
and a fingerprint sensor in the corner that starts the conversation.

**Live:** [GitHub Pages](https://hwkim3330.github.io/claude-charm/) · [Hugging Face Space](https://huggingface.co/spaces/kimhyunwoo/claude-charm)

## What it does

- **Clawd lives on the screen, painted in watercolour and ink.** The character, its 31 emotions, 18 hats, emotes
  and dances come from [Claude Animation Base](https://github.com/JohnHeibel/ClaudeAnimationBase) (MIT, vendored in
  [`vendor/claude-animation-base/`](vendor/claude-animation-base/)). That is the kit behind the Clawd music video
  [*I'm Upping My P(doom)*](https://github.com/JohnHeibel/PDoomVideo), and it paints with p5.js + p5.brush. That kit renders
  video offline. Here the same `drawWorld(t)` is repainted live, 12 drawings a second ("on twos", the rate its linework
  boils at). Mood changes go through the kit's acted `emotions()` timeline: a squint, a swap and a squash-stretch take.
- **Tap or hold the fingerprint sensor to talk.** A tap listens until you pause, and holding it is push-to-talk.
  Speech recognition works in Chrome, Edge and Safari. Other browsers can use the text box instead.
- **Replies are spoken aloud** sentence by sentence as they stream in, and the mouth follows the voice.
- **The reply picks the face.** Each answer starts with one of the kit's emotion names (`[starstruck]`,
  `[thinking]`, `[shy]`, …) or `[dance]`, which drives Clawd's face, colour and body and is not read out.
- **It's a pet, too.** Stroke the screen for hearts, and keep going and it dances. Leave it alone and it gets bored, then
  dozes off under a night sky. The screen also turns to night after 21:00.
- **Customise:** name, hat, colour, personality, language (ko/en/ja), voice, speed and pitch.
- **It adapts to the device.** p5.brush's watercolour fills are almost the whole cost of a frame, so quality steps between
  *full* → *mid* (bleed capped, no pigment texture) → *lite* (flat washes and ink) and 12 → 8 drawings a second,
  based on measured frame times. The choice is remembered. `?res=` sets the screen resolution, and `?night=1|0` forces night or day.

## How it talks to Claude

There is no server. The page loads the official
[Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) from jsDelivr
and calls `api.anthropic.com` directly from your browser with **your own API key**. The key is kept only
in this browser's `localStorage`.

- The default model is Claude Opus 5. Sonnet 5 and Haiku 4.5 can be picked in settings.
- It uses low effort so voice replies start quickly.
- On Opus 5, server-side refusal fallback (`fallbacks: "default"`) is turned on.

Because the key sits in the page, only use it on a device you trust. For a shared deployment you'd put a small
proxy in front of the API instead.

Without a key the companion still blinks, wanders, sleeps and enjoys head pats. It just can't chat.

## Run locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Speech recognition needs `https://` or `localhost`.

## Credits

- Clawd painting, emotions, hats, emotes and dances: [JohnHeibel/ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase),
  MIT, © 2026 John Heibel. See [`vendor/claude-animation-base/`](vendor/claude-animation-base/) for what was changed (two marked lines).
- Brushes: [p5.brush](https://github.com/acamposuribe/p5.brush) on [p5.js](https://p5js.org), both loaded from jsDelivr.

## Not affiliated

This is a fan project. It is not affiliated with or endorsed by Anthropic or Meta. "Muse Charm" is Meta's product;
this page only borrows the idea of a tap-to-talk keychain companion.
