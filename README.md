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

- **Tap or hold the sensor to talk.** A short tap listens until you pause. Holding it is push-to-talk. This uses the browser's
  speech recognition (Chrome, Edge and Safari). Other browsers can use the text box instead.
- **Replies are spoken aloud** sentence by sentence as they stream in, and the avatar's mouth moves with them.
- **The face follows the reply.** Each answer starts with a mood tag (`[happy]`, `[curious]`,
  `[thinking]`, …) that sets the expression and is not read out.
- **It's a pet as well.** Stroke the screen for hearts. Leave it alone for a minute and it dozes off.
- **Customisation:** name, three avatars (critter, spark, mochi), eight colours, personality,
  language (ko/en/ja), voice, speed and pitch.

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

## Not affiliated

This is a fan project. It is not affiliated with or endorsed by Anthropic or Meta. "Muse Charm" is Meta's product;
this page only borrows the idea of a tap-to-talk keychain companion.
