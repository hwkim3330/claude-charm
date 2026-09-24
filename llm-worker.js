// llm-worker.js — runs the free local model off the main thread, so Clawd keeps painting while it thinks.
// transformers.js on WebGPU; the weights download once from the Hugging Face Hub and stay in the browser cache.
//
// Model: Gemma 3 1B instruct (onnx-community build). Of the small models tried on WebGPU it was the one with
// natural Korean, sensible mood tags and real speed (~17 tok/s on a desktop GPU). Qwen3.5-0.8B loaded but
// produced broken Korean at 0.4 tok/s (its linear-attention layers don't run fast on WebGPU yet).

import { pipeline, TextStreamer, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0';

env.allowLocalModels = false;
let gen = null;

async function load(id) {
  const files = new Map();
  const progress_callback = (p) => {
    if (p.status === 'progress' && p.total) {
      files.set(p.file, [p.loaded, p.total]);
      let a = 0, b = 0; for (const [l, t] of files.values()) { a += l; b += t; }
      postMessage({ type: 'progress', loaded: a, total: b });
    }
  };
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) throw new Error('no-webgpu');
  const dtype = adapter.features.has('shader-f16') ? 'q4f16' : 'q4';
  gen = await pipeline('text-generation', id, { dtype, device: 'webgpu', progress_callback });
  // warm up the shaders so the first real reply isn't slow
  await gen([{ role: 'user', content: 'hi' }], { max_new_tokens: 2 });
  postMessage({ type: 'ready' });
}

async function generate(id, messages) {
  let out = '';
  const streamer = new TextStreamer(gen.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (t) => { out += t; postMessage({ type: 'text', id, text: out }); },
  });
  await gen(messages, { max_new_tokens: 72, do_sample: true, temperature: 0.5, top_p: 0.85, repetition_penalty: 1.1, streamer });
  postMessage({ type: 'done', id, text: out });
}

onmessage = async (e) => {
  const d = e.data;
  try {
    if (d.type === 'load') await load(d.model);
    else if (d.type === 'generate') await generate(d.id, d.messages);
  } catch (err) {
    postMessage({ type: 'error', id: d.id ?? null, message: String(err?.message || err) });
  }
};
