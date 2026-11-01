const canvas = document.querySelector("#stormCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const video = document.querySelector("#cameraVideo");
const landmarkCanvas = document.querySelector("#landmarkCanvas");
const landmarkCtx = landmarkCanvas.getContext("2d");

const ui = {
  introOverlay: document.querySelector("#introOverlay"),
  startButton: document.querySelector("#startButton"),
  pointerOnlyButton: document.querySelector("#pointerOnlyButton"),
  cameraToggle: document.querySelector("#cameraToggle"),
  cameraToggleText: document.querySelector("#cameraToggleText"),
  soundToggle: document.querySelector("#soundToggle"),
  soundIcon: document.querySelector("#soundIcon"),
  cameraPanel: document.querySelector("#cameraPanel"),
  liveSizeToggle: document.querySelector("#liveSizeToggle"),
  trackingLabel: document.querySelector("#trackingLabel"),
  cameraPlaceholder: document.querySelector("#cameraPlaceholder"),
  controlMode: document.querySelector("#controlMode"),
  modeHint: document.querySelector("#modeHint"),
  speedValue: document.querySelector("#speedValue"),
  speedMeter: document.querySelector("#speedMeter"),
  opennessValue: document.querySelector("#opennessValue"),
  weatherStatus: document.querySelector("#weatherStatus"),
  coordinates: document.querySelector("#coordinates"),
  interactionHint: document.querySelector("#interactionHint"),
  statusToast: document.querySelector("#statusToast"),
  helpButton: document.querySelector("#helpButton"),
  helpDrawer: document.querySelector("#helpDrawer"),
  closeHelpButton: document.querySelector("#closeHelpButton"),
};

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const AUDIO_ASSETS = {
  rain: "音效文件/下大雨.mp3",
  thunder: "音效文件/打雷声.mp3",
  lightning: "音效文件/电闪雷鸣.mp3",
};

const COLOR_THEMES = {
  jade: {
    primary: "#67f5ca",
    primaryRgb: [103, 245, 202],
    secondary: "#0bbd97",
    secondaryRgb: [11, 189, 151],
    bright: "#d9fff2",
    brightRgb: [217, 255, 242],
    gold: "#edc873",
    goldRgb: [237, 200, 115],
    deep: "#03110e",
    deepRgb: [3, 17, 14],
  },
  blue: {
    primary: "#66c7ff",
    primaryRgb: [102, 199, 255],
    secondary: "#2a80ff",
    secondaryRgb: [42, 128, 255],
    bright: "#dff4ff",
    brightRgb: [223, 244, 255],
    gold: "#9fdcff",
    goldRgb: [159, 220, 255],
    deep: "#031022",
    deepRgb: [3, 16, 34],
  },
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  dpr: Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 1.5),
  running: true,
  cameraActive: false,
  cameraStarting: false,
  controlSource: "pointer",
  handVisible: false,
  lastHandSeen: 0,
  lastDetection: 0,
  lastVideoTime: -1,
  pointerActive: false,
  pointerX: window.innerWidth * 0.64,
  pointerY: window.innerHeight * 0.55,
  previousInputX: window.innerWidth * 0.64,
  previousInputY: window.innerHeight * 0.55,
  previousInputTime: performance.now(),
  rawSpeed: 0,
  speed: 0,
  handOpenness: 0.5,
  targetHandOpenness: 0.5,
  activeHandSize: 0,
  activeHandCount: 0,
  visualStormCount: 1,
  fistStorm: false,
  superstormIntensity: 0,
  superstormSpin: 0,
  mergeCharge: 0,
  mergeIntensity: 0,
  mergeActive: false,
  mergeCenterX: window.innerWidth * 0.5,
  mergeCenterY: window.innerHeight * 0.55,
  themeMode: "jade",
  lGestureCharge: 0,
  lGestureLatched: false,
  lastGestureFrameAt: performance.now(),
  lastThemeToggleAt: 0,
  weatherMode: "calm",
  rainIntensity: 0,
  targetRainIntensity: 0,
  weatherHoldUntil: 0,
  lastLightningAt: 0,
  nextLightningDelay: 1400,
  targetScale: 0.82,
  scale: 0.82,
  lastFrame: performance.now(),
  frameEma: 16.7,
  quality: 1,
  lastTelemetry: 0,
  lastAudioUpdate: 0,
  elapsed: 0,
};

const storm = {
  id: 0,
  x: state.pointerX,
  y: state.pointerY,
  targetX: state.pointerX,
  targetY: state.pointerY,
  previousInputX: state.pointerX,
  previousInputY: state.pointerY,
  previousInputTime: performance.now(),
  rawSpeed: 0,
  speed: 0,
  handOpenness: 0.5,
  targetHandOpenness: 0.5,
  targetScale: 0.82,
  scale: 0.82,
  targetOpacity: 1,
  opacity: 1,
  controlSource: "pointer",
  handVisible: false,
  lastHandSeen: 0,
  fistStorm: false,
  tilt: 0,
  previousX: state.pointerX,
  glow: 0,
};

let handLandmarker = null;
let mediaStream = null;
let toastTimer = 0;
let animationId = 0;
let audioEnabled = true;

const audio = {
  context: null,
  master: null,
  windGain: null,
  gustGain: null,
  windFilter: null,
  gustFilter: null,
  rainGain: null,
  rainFilter: null,
  noiseBuffer: null,
  tone: null,
  toneGain: null,
  panner: null,
  rainElement: null,
  thunderPreload: null,
  lightningPreload: null,
  rainAssetVolume: 0,
  rainAssetFailed: false,
  thunderAssetFailed: false,
  assetBuffers: {},
  assetBufferPromises: {},
  assetBufferFailed: {},
  assetVoices: new Set(),
};

const particles = [];
const wisps = [];
const sparks = [];
const trailPoints = [];
const superstormParticles = [];
storm.trailPoints = trailPoints;
const secondaryStorm = {
  id: 1,
  x: state.width * 0.36,
  y: state.height * 0.55,
  targetX: state.width * 0.36,
  targetY: state.height * 0.55,
  previousInputX: state.width * 0.36,
  previousInputY: state.height * 0.55,
  previousInputTime: performance.now(),
  rawSpeed: 0,
  speed: 0,
  handOpenness: 0.5,
  targetHandOpenness: 0.5,
  targetScale: 0.82,
  scale: 0.82,
  targetOpacity: 0,
  opacity: 0,
  controlSource: "hand",
  handVisible: false,
  lastHandSeen: 0,
  fistStorm: false,
  tilt: 0,
  previousX: state.width * 0.36,
  glow: 0,
  trailPoints: [],
};
const fusionStorm = {
  id: 2,
  x: state.mergeCenterX,
  y: state.mergeCenterY,
  targetX: state.mergeCenterX,
  targetY: state.mergeCenterY,
  previousInputX: state.mergeCenterX,
  previousInputY: state.mergeCenterY,
  previousInputTime: performance.now(),
  rawSpeed: 0,
  speed: 0,
  handOpenness: 0.5,
  targetHandOpenness: 0.5,
  targetScale: 1.45,
  scale: 1.45,
  targetOpacity: 0,
  opacity: 0,
  controlSource: "fusion",
  handVisible: false,
  lastHandSeen: 0,
  fistStorm: false,
  tilt: 0,
  previousX: state.mergeCenterX,
  glow: 0,
  trailPoints: [],
};
const stormSlots = [storm, secondaryStorm];
const MAX_RAIN_DROPS = reducedMotion ? 180 : 520;
const SUPERSTORM_ARM_COUNT = reducedMotion ? 4 : 5;
const SUPERSTORM_MAX_PARTICLES = reducedMotion ? 240 : 680;
const L_GESTURE_TRIGGER_THRESHOLD = 0.24;
const superstormCache = {
  canvas: document.createElement("canvas"),
  ctx: null,
  key: "",
};
superstormCache.ctx = superstormCache.canvas.getContext("2d");
const rain = {
  x: new Float32Array(MAX_RAIN_DROPS),
  y: new Float32Array(MAX_RAIN_DROPS),
  speed: new Float32Array(MAX_RAIN_DROPS),
  length: new Float32Array(MAX_RAIN_DROPS),
  drift: new Float32Array(MAX_RAIN_DROPS),
};
const lightning = {
  active: false,
  age: 0,
  duration: 0.34,
  strikeX: 0,
  points: [],
  branches: [],
};
const stars = Array.from({ length: reducedMotion ? 42 : 88 }, (_, index) => ({
  x: hash(index * 3.1) * state.width,
  y: hash(index * 7.7) * state.height,
  size: 0.35 + hash(index * 9.3) * 1.25,
  alpha: 0.06 + hash(index * 5.5) * 0.2,
  drift: 2 + hash(index * 1.9) * 7,
}));

function hash(seed) {
  const value = Math.sin(seed * 713.73) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  const progress = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return lerp(outMin, outMax, progress);
}

function smoothstep(edge0, edge1, value) {
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - progress * 2);
}

function getThemePalette() {
  return COLOR_THEMES[state.themeMode] || COLOR_THEMES.jade;
}

function themeRgba(key, alpha, palette = getThemePalette()) {
  const rgb = palette[`${key}Rgb`] || COLOR_THEMES.jade[`${key}Rgb`] || COLOR_THEMES.jade.primaryRgb;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function setThemeMode(mode, announce = true) {
  const nextMode = mode === "blue" ? "blue" : "jade";
  if (state.themeMode === nextMode) return;
  state.themeMode = nextMode;
  document.body.dataset.theme = nextMode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    nextMode === "blue" ? "#020714" : "#020908",
  );
  if (announce) {
    showToast(nextMode === "blue" ? "已切换为蓝色风暴色调。" : "已切回青绿色风暴色调。", 1800);
  }
}

function distance3D(a, b) {
  return Math.hypot(
    (a?.x || 0) - (b?.x || 0),
    (a?.y || 0) - (b?.y || 0),
    (a?.z || 0) - (b?.z || 0),
  );
}

function initializeRain() {
  for (let index = 0; index < MAX_RAIN_DROPS; index += 1) {
    rain.x[index] = Math.random();
    rain.y[index] = Math.random();
    rain.speed[index] = 0.65 + Math.random() * 0.9;
    rain.length[index] = 8 + Math.random() * 20;
    rain.drift[index] = Math.random() * 2 - 1;
  }
}

function resize() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.dpr = Math.min(window.devicePixelRatio || 1, state.width < 700 ? 1.25 : 1.5);
  canvas.width = Math.round(state.width * state.dpr);
  canvas.height = Math.round(state.height * state.dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  const previewBounds = landmarkCanvas.getBoundingClientRect();
  landmarkCanvas.width = Math.max(1, Math.round(previewBounds.width * state.dpr));
  landmarkCanvas.height = Math.max(1, Math.round(previewBounds.height * state.dpr));
  landmarkCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  for (const slot of stormSlots) {
    slot.x = clamp(slot.x, 0, state.width);
    slot.y = clamp(slot.y, 0, state.height);
    slot.targetX = clamp(slot.targetX, 0, state.width);
    slot.targetY = clamp(slot.targetY, 0, state.height);
  }
  fusionStorm.x = clamp(fusionStorm.x, 0, state.width);
  fusionStorm.y = clamp(fusionStorm.y, 0, state.height);
  fusionStorm.targetX = clamp(fusionStorm.targetX, 0, state.width);
  fusionStorm.targetY = clamp(fusionStorm.targetY, 0, state.height);
}

function showToast(message, duration = 3600) {
  window.clearTimeout(toastTimer);
  ui.statusToast.textContent = message;
  ui.statusToast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    ui.statusToast.classList.remove("is-visible");
  }, duration);
}

function createNoiseBuffer(context, seconds = 2) {
  const frameCount = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let smoothNoise = 0;
  for (let index = 0; index < frameCount; index += 1) {
    smoothNoise = smoothNoise * 0.72 + (Math.random() * 2 - 1) * 0.28;
    channel[index] = smoothNoise;
  }
  return buffer;
}

function createAudioElement(src, loop = false) {
  const element = new Audio(src);
  element.preload = "auto";
  element.loop = loop;
  element.volume = 0;
  return element;
}

function initializeAudioAssets() {
  if (audio.rainElement) return;
  audio.rainElement = createAudioElement(AUDIO_ASSETS.rain, true);
  audio.thunderPreload = createAudioElement(AUDIO_ASSETS.thunder);
  audio.lightningPreload = createAudioElement(AUDIO_ASSETS.lightning);

  audio.rainElement.addEventListener("error", () => {
    audio.rainAssetFailed = true;
    console.warn("Rain audio asset failed to load; using synthesized fallback.");
  });
  audio.thunderPreload.addEventListener("error", () => {
    audio.thunderAssetFailed = true;
    console.warn("Thunder audio asset failed to load; using synthesized fallback.");
  });
}

function loadAudioBuffer(name, src) {
  if (!audio.context || audio.assetBuffers[name] || audio.assetBufferPromises[name]) {
    return audio.assetBufferPromises[name] || Promise.resolve(audio.assetBuffers[name] || null);
  }
  audio.assetBufferPromises[name] = fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error(`Audio asset ${name} returned ${response.status}`);
      return response.arrayBuffer();
    })
    .then((arrayBuffer) => audio.context.decodeAudioData(arrayBuffer))
    .then((buffer) => {
      audio.assetBuffers[name] = buffer;
      audio.assetBufferFailed[name] = false;
      return buffer;
    })
    .catch((error) => {
      audio.assetBufferFailed[name] = true;
      console.warn(`Audio buffer ${name} failed to decode; using fallback.`, error);
      return null;
    });
  return audio.assetBufferPromises[name];
}

function preloadThunderBuffers() {
  loadAudioBuffer("lightning", AUDIO_ASSETS.lightning);
  loadAudioBuffer("thunder", AUDIO_ASSETS.thunder);
}

function playBufferedAsset(name, baseVolume, options = {}) {
  if (!audioEnabled || !audio.context || !audio.master || !audio.assetBuffers[name]) return false;
  const context = audio.context;
  const source = context.createBufferSource();
  const gain = context.createGain();
  const panner = context.createStereoPanner?.() || context.createGain();
  const now = context.currentTime;
  const delay = Math.max(0, (options.delayMs || 0) / 1000);
  const panValue =
    typeof options.pan === "number" ? clamp(options.pan, -0.95, 0.95) : 0;

  source.buffer = audio.assetBuffers[name];
  source.playbackRate.value = clamp(options.playbackRate || 1, 0.78, 1.18);
  gain.gain.setValueAtTime(clamp(baseVolume, 0, 1), now + delay);
  if (options.fadeOutAt && options.fadeOutDuration) {
    gain.gain.setValueAtTime(clamp(baseVolume, 0, 1), now + delay + options.fadeOutAt);
    gain.gain.linearRampToValueAtTime(
      0.0001,
      now + delay + options.fadeOutAt + options.fadeOutDuration,
    );
  }
  if (panner.pan) panner.pan.value = panValue;

  source.connect(gain);
  gain.connect(panner);
  panner.connect(audio.master);
  source.start(now + delay);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
    panner.disconnect();
  };
  return true;
}

function pruneAssetVoices() {
  const now = performance.now();
  for (const voice of Array.from(audio.assetVoices)) {
    if (voice.element.ended || now - voice.createdAt > 9500) {
      voice.element.pause();
      voice.element.src = "";
      audio.assetVoices.delete(voice);
    }
  }
}

function updateAssetVoiceVolumes() {
  for (const voice of audio.assetVoices) {
    voice.element.volume = audioEnabled ? voice.baseVolume : 0;
  }
}

function playAudioAsset(src, baseVolume, options = {}) {
  if (!audioEnabled) return true;
  if (!src) return false;
  pruneAssetVoices();
  if (audio.assetVoices.size > 5) return true;

  const element = createAudioElement(src);
  const voice = {
    element,
    baseVolume: clamp(baseVolume, 0, 1),
    createdAt: performance.now(),
  };
  element.volume = voice.baseVolume;
  if (options.playbackRate) {
    element.playbackRate = clamp(options.playbackRate, 0.78, 1.18);
  }
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    element.pause();
    element.removeAttribute("src");
    audio.assetVoices.delete(voice);
  };
  const handleError = () => {
    if (cleanedUp) return;
    cleanup();
    options.onError?.();
  };
  element.addEventListener("ended", cleanup, { once: true });
  element.addEventListener("error", handleError, { once: true });
  audio.assetVoices.add(voice);

  const start = () => {
    const playPromise = element.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {
        cleanup();
        options.onError?.();
      });
    }
  };
  if (options.delayMs) window.setTimeout(start, options.delayMs);
  else start();
  return true;
}

function updateRainAsset() {
  if (!audio.rainElement || audio.rainAssetFailed) return false;
  const targetVolume = audioEnabled
    ? clamp(state.rainIntensity * (state.weatherMode === "superstorm" ? 0.72 : 0.56), 0, 0.78)
    : 0;
  audio.rainAssetVolume = lerp(audio.rainAssetVolume, targetVolume, 0.16);
  audio.rainElement.volume = audio.rainAssetVolume;

  if (targetVolume > 0.018 && audio.rainElement.paused) {
    const playPromise = audio.rainElement.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {
        audio.rainAssetFailed = true;
      });
    }
  } else if (targetVolume <= 0.001 && audio.rainAssetVolume < 0.006 && !audio.rainElement.paused) {
    audio.rainElement.pause();
  }
  return true;
}

async function ensureAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    audioEnabled = false;
    updateSoundButton();
    return false;
  }

  initializeAudioAssets();

  if (!audio.context) {
    const context = new AudioContextClass();
    const master = context.createGain();
    const windGain = context.createGain();
    const gustGain = context.createGain();
    const rainGain = context.createGain();
    const windFilter = context.createBiquadFilter();
    const gustFilter = context.createBiquadFilter();
    const rainFilter = context.createBiquadFilter();
    const panner = context.createStereoPanner?.() || context.createGain();
    const tone = context.createOscillator();
    const toneGain = context.createGain();
    const noiseBuffer = createNoiseBuffer(context);
    const windSource = context.createBufferSource();
    const gustSource = context.createBufferSource();
    const rainSource = context.createBufferSource();

    master.gain.value = audioEnabled ? 0.72 : 0;
    windGain.gain.value = 0.008;
    gustGain.gain.value = 0;
    rainGain.gain.value = 0;
    toneGain.gain.value = 0.004;
    windFilter.type = "bandpass";
    windFilter.frequency.value = 520;
    windFilter.Q.value = 0.55;
    gustFilter.type = "highpass";
    gustFilter.frequency.value = 900;
    rainFilter.type = "bandpass";
    rainFilter.frequency.value = 3200;
    rainFilter.Q.value = 0.38;
    tone.type = "sine";
    tone.frequency.value = 42;

    windSource.buffer = noiseBuffer;
    windSource.loop = true;
    gustSource.buffer = noiseBuffer;
    gustSource.loop = true;
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;

    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(panner);
    gustSource.connect(gustFilter);
    gustFilter.connect(gustGain);
    gustGain.connect(panner);
    rainSource.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(master);
    panner.connect(master);
    tone.connect(toneGain);
    toneGain.connect(master);
    master.connect(context.destination);

    windSource.start();
    gustSource.start(0, 0.73);
    rainSource.start(0, 1.21);
    tone.start();

    Object.assign(audio, {
      context,
      master,
      windGain,
      gustGain,
      rainGain,
      windFilter,
      gustFilter,
      rainFilter,
      noiseBuffer,
      tone,
      toneGain,
      panner,
    });
    preloadThunderBuffers();
  }

  if (audio.context.state === "suspended") {
    await audio.context.resume();
  }
  return true;
}

function updateSoundButton() {
  ui.soundToggle.classList.toggle("is-muted", !audioEnabled);
  ui.soundToggle.setAttribute("aria-pressed", String(audioEnabled));
  ui.soundToggle.setAttribute("aria-label", audioEnabled ? "关闭全部音效" : "开启全部音效");
  ui.soundIcon.textContent = audioEnabled ? "♪" : "×";
}

function setAudioEnabled(enabled, announce = true) {
  audioEnabled = enabled;
  updateSoundButton();
  if (audio.context && audio.master) {
    const now = audio.context.currentTime;
    audio.master.gain.cancelScheduledValues(now);
    audio.master.gain.setTargetAtTime(enabled ? 0.72 : 0, now, 0.055);
  }
  if (!enabled && audio.rainElement && !audio.rainElement.paused) {
    audio.rainElement.pause();
  }
  updateAssetVoiceVolumes();
  if (announce) {
    showToast(enabled ? "音效已开启，雨声和雷声将使用本地素材。" : "全部音效已关闭。", 2200);
  }
}

function updateAudio(now) {
  if (!audio.context || !audio.master || now - state.lastAudioUpdate < 48) return;
  state.lastAudioUpdate = now;
  const audioNow = audio.context.currentTime;
  const energy = clamp(state.speed, 0, 1);
  const mergeEnergy = clamp(state.mergeIntensity || 0, 0, 1);
  const panSourceX = mergeEnergy > 0.35 ? fusionStorm.x : storm.x;
  const panValue = clamp((panSourceX / state.width) * 2 - 1, -0.82, 0.82);
  const rainAssetActive = updateRainAsset();
  pruneAssetVoices();
  audio.windGain.gain.setTargetAtTime(0.012 + energy * 0.095 + mergeEnergy * 0.075, audioNow, 0.06);
  audio.gustGain.gain.setTargetAtTime(
    0.001 + energy * energy * 0.082 + mergeEnergy * 0.12,
    audioNow,
    0.045,
  );
  audio.windFilter.frequency.setTargetAtTime(420 + energy * 1550 + mergeEnergy * 520, audioNow, 0.07);
  audio.gustFilter.frequency.setTargetAtTime(780 + energy * 1250 + mergeEnergy * 820, audioNow, 0.06);
  audio.tone.frequency.setTargetAtTime(40 + energy * 30 - mergeEnergy * 8, audioNow, 0.08);
  audio.toneGain.gain.setTargetAtTime(0.003 + energy * 0.018 + mergeEnergy * 0.018, audioNow, 0.08);
  audio.rainGain?.gain.setTargetAtTime(
    rainAssetActive ? 0 : state.rainIntensity * 0.09,
    audioNow,
    0.12,
  );
  audio.rainFilter?.frequency.setTargetAtTime(
    2400 + state.rainIntensity * 1700,
    audioNow,
    0.1,
  );
  if (audio.panner.pan) {
    audio.panner.pan.setTargetAtTime(panValue, audioNow, 0.07);
  }
}

function triggerSyntheticThunder(strikeX) {
  if (!audio.context || !audio.master || !audio.noiseBuffer) return;
  const context = audio.context;
  const now = context.currentTime;
  const panValue = clamp((strikeX / state.width) * 2 - 1, -0.85, 0.85);
  const eventPanner = context.createStereoPanner?.() || context.createGain();
  if (eventPanner.pan) eventPanner.pan.value = panValue;
  eventPanner.connect(audio.master);

  const crackSource = context.createBufferSource();
  const crackFilter = context.createBiquadFilter();
  const crackGain = context.createGain();
  crackSource.buffer = audio.noiseBuffer;
  crackFilter.type = "highpass";
  crackFilter.frequency.value = 1350;
  crackGain.gain.setValueAtTime(0.0001, now);
  crackGain.gain.exponentialRampToValueAtTime(0.13, now + 0.012);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  crackSource.connect(crackFilter);
  crackFilter.connect(crackGain);
  crackGain.connect(eventPanner);

  const rumbleSource = context.createBufferSource();
  const rumbleFilter = context.createBiquadFilter();
  const rumbleGain = context.createGain();
  rumbleSource.buffer = audio.noiseBuffer;
  rumbleSource.playbackRate.value = 0.48;
  rumbleFilter.type = "lowpass";
  rumbleFilter.frequency.value = 620;
  rumbleFilter.Q.value = 0.85;
  rumbleGain.gain.setValueAtTime(0.0001, now + 0.06);
  rumbleGain.gain.exponentialRampToValueAtTime(0.28, now + 0.18);
  rumbleGain.gain.exponentialRampToValueAtTime(0.11, now + 0.82);
  rumbleGain.gain.exponentialRampToValueAtTime(0.18, now + 1.05);
  rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.75);
  rumbleSource.connect(rumbleFilter);
  rumbleFilter.connect(rumbleGain);
  rumbleGain.connect(eventPanner);

  const boom = context.createOscillator();
  const boomGain = context.createGain();
  boom.type = "sine";
  boom.frequency.setValueAtTime(105, now + 0.05);
  boom.frequency.exponentialRampToValueAtTime(48, now + 1.65);
  boomGain.gain.setValueAtTime(0.0001, now + 0.05);
  boomGain.gain.exponentialRampToValueAtTime(0.2, now + 0.16);
  boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.05);
  boom.connect(boomGain);
  boomGain.connect(eventPanner);

  const roll = context.createOscillator();
  const rollGain = context.createGain();
  roll.type = "triangle";
  roll.frequency.setValueAtTime(148, now + 0.08);
  roll.frequency.exponentialRampToValueAtTime(72, now + 1.8);
  rollGain.gain.setValueAtTime(0.0001, now + 0.08);
  rollGain.gain.exponentialRampToValueAtTime(0.065, now + 0.24);
  rollGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.3);
  roll.connect(rollGain);
  rollGain.connect(eventPanner);

  crackSource.start(now);
  crackSource.stop(now + 0.28);
  rumbleSource.start(now + 0.06);
  rumbleSource.stop(now + 2.85);
  boom.start(now + 0.05);
  boom.stop(now + 2.12);
  roll.start(now + 0.08);
  roll.stop(now + 2.36);

  window.setTimeout(() => {
    crackSource.disconnect();
    rumbleSource.disconnect();
    boom.disconnect();
    roll.disconnect();
    eventPanner.disconnect();
  }, 3100);
}

function triggerThunder(strikeX) {
  if (!audioEnabled) return;
  initializeAudioAssets();
  preloadThunderBuffers();

  const panValue = clamp((strikeX / state.width) * 2 - 1, -0.85, 0.85);
  const superstormBoost = state.weatherMode === "superstorm" ? 0.16 : 0;
  const mergeBoost = state.mergeIntensity ? state.mergeIntensity * 0.18 : 0;
  const speedBoost = clamp(state.speed * 0.12, 0, 0.12);
  const jitter = (Math.random() - 0.5) * 0.08;

  const bufferedLightning = playBufferedAsset(
    "lightning",
    0.34 + superstormBoost * 0.6 + mergeBoost * 0.45,
    {
      playbackRate: 1 + jitter,
      pan: panValue,
    },
  );
  const bufferedThunder = playBufferedAsset(
    "thunder",
    0.74 + superstormBoost + mergeBoost + speedBoost,
    {
      delayMs: 70,
      playbackRate: 0.96 + jitter * 0.4,
      pan: panValue,
    },
  );
  if (bufferedThunder) return;

  if (!audio.thunderAssetFailed) {
    let fallbackTriggered = false;
    const fallback = () => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      triggerSyntheticThunder(strikeX);
    };

    if (!bufferedLightning) {
      playAudioAsset(AUDIO_ASSETS.lightning, 0.38 + superstormBoost * 0.7 + mergeBoost * 0.4, {
        playbackRate: 1 + jitter,
      });
    }
    const handled = playAudioAsset(AUDIO_ASSETS.thunder, 0.74 + superstormBoost + mergeBoost + speedBoost, {
      delayMs: 70,
      playbackRate: 0.96 + jitter * 0.4,
      onError: fallback,
    });
    if (handled) return;
  }

  triggerSyntheticThunder(strikeX);
}

function setControlSource(source) {
  state.controlSource = source;
  const isHand = source === "hand";
  ui.controlMode.textContent = isHand ? "手势模式" : "指针模式";
  ui.modeHint.textContent = isHand ? "五指控制大小" : "速度控制大小";
}

function updateStormInput(targetStorm, x, y, source, timestamp = performance.now()) {
  const safeX = clamp(x, state.width * 0.03, state.width * 0.97);
  const safeY = clamp(y, state.height * 0.11, state.height * 0.9);
  const dt = clamp((timestamp - targetStorm.previousInputTime) / 1000, 1 / 120, 0.18);
  const distance = Math.hypot(safeX - targetStorm.previousInputX, safeY - targetStorm.previousInputY);
  const diagonal = Math.hypot(state.width, state.height);
  const normalizedSpeed = (distance / diagonal) / dt;
  const noiseFloor = source === "hand" ? 0.045 : 0.012;
  targetStorm.rawSpeed = normalizedSpeed < noiseFloor ? 0 : normalizedSpeed;
  targetStorm.previousInputX = safeX;
  targetStorm.previousInputY = safeY;
  targetStorm.previousInputTime = timestamp;
  targetStorm.targetX = safeX;
  targetStorm.targetY = safeY;
  targetStorm.controlSource = source;
  targetStorm.targetOpacity = 1;
  if (source === "hand") {
    targetStorm.handVisible = true;
    targetStorm.lastHandSeen = timestamp;
  }
  return { x: safeX, y: safeY, rawSpeed: targetStorm.rawSpeed };
}

function updateInput(x, y, source, timestamp = performance.now()) {
  const input = updateStormInput(storm, x, y, source, timestamp);
  state.rawSpeed = input.rawSpeed;
  state.previousInputX = input.x;
  state.previousInputY = input.y;
  state.previousInputTime = timestamp;
  if (source === "pointer") {
    secondaryStorm.handVisible = false;
    secondaryStorm.targetOpacity = 0;
  }
  setControlSource(source);
  ui.interactionHint.classList.add("is-hidden");
}

function pointerMove(event) {
  if (state.controlSource === "hand" && state.handVisible && !state.pointerActive) return;
  state.pointerActive = event.pointerType === "touch" || (event.buttons & 1) === 1;
  state.pointerX = event.clientX;
  state.pointerY = event.clientY;
  updateInput(event.clientX, event.clientY, "pointer", event.timeStamp || performance.now());
}

function pointerDown(event) {
  ensureAudio().catch(() => {});
  state.pointerActive = true;
  canvas.setPointerCapture?.(event.pointerId);
  updateInput(event.clientX, event.clientY, "pointer", event.timeStamp || performance.now());
}

function pointerUp(event) {
  state.pointerActive = false;
  canvas.releasePointerCapture?.(event.pointerId);
}

function usePointerMode(message) {
  setControlSource("pointer");
  state.handVisible = false;
  state.activeHandCount = 0;
  storm.targetOpacity = 1;
  secondaryStorm.handVisible = false;
  secondaryStorm.targetOpacity = 0;
  state.mergeCharge = 0;
  state.mergeActive = false;
  state.mergeIntensity = 0;
  fusionStorm.opacity = 0;
  ui.trackingLabel.textContent = "指针回退";
  ui.introOverlay.classList.remove("is-visible");
  if (message) showToast(message);
}

async function createHandTracker() {
  if (handLandmarker) return handLandmarker;
  ui.trackingLabel.textContent = "加载模型…";
  const { FilesetResolver, HandLandmarker } = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm"
  );
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.52,
    minTrackingConfidence: 0.5,
  });
  return handLandmarker;
}

async function startCamera() {
  if (state.cameraStarting || state.cameraActive) return;
  state.cameraStarting = true;
  ui.cameraToggleText.textContent = "正在启动…";
  ui.trackingLabel.textContent = "准备视觉模型";

  if (!navigator.mediaDevices?.getUserMedia) {
    state.cameraStarting = false;
    usePointerMode("当前环境无法访问摄像头，已切换为鼠标 / 触控模式。");
    ui.cameraToggleText.textContent = "摄像头不可用";
    return;
  }

  try {
    await createHandTracker();
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 960 },
        height: { ideal: 720 },
      },
    });
    video.srcObject = mediaStream;
    await video.play();
    state.cameraActive = true;
    state.cameraStarting = false;
    state.lastVideoTime = -1;
    ui.cameraPanel.classList.add("is-active");
    ui.cameraToggle.classList.add("is-active");
    ui.cameraToggleText.textContent = "关闭摄像头";
    ui.trackingLabel.textContent = "寻找手掌";
    ui.introOverlay.classList.remove("is-visible");
    showToast("摄像头已开启，请将一只手放入画面。");
    resize();
  } catch (error) {
    console.warn("Camera or hand tracking could not start:", error);
    state.cameraStarting = false;
    stopCamera(false);
    ui.cameraToggleText.textContent = "重试摄像头";
    const isPermissionError = error?.name === "NotAllowedError";
    usePointerMode(
      isPermissionError
        ? "摄像头权限未开启，已切换为鼠标 / 触控模式。"
        : "手势模型或摄像头启动失败，已切换为鼠标 / 触控模式。",
    );
  }
}

function stopCamera(showMessage = true) {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  video.srcObject = null;
  state.cameraActive = false;
  state.cameraStarting = false;
  state.handVisible = false;
  state.activeHandCount = 0;
  for (const slot of stormSlots) {
    slot.handVisible = false;
    slot.fistStorm = false;
  }
  storm.targetOpacity = 1;
  secondaryStorm.targetOpacity = 0;
  state.mergeCharge = 0;
  state.mergeActive = false;
  state.mergeIntensity = 0;
  fusionStorm.opacity = 0;
  landmarkCtx.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
  ui.cameraPanel.classList.remove("is-active");
  ui.cameraToggle.classList.remove("is-active");
  ui.cameraToggleText.textContent = "开启摄像头";
  ui.trackingLabel.textContent = "摄像头关闭";
  setControlSource("pointer");
  if (showMessage) showToast("摄像头已关闭，继续使用鼠标或触控驾驭风暴。");
}

function palmCenter(landmarks) {
  const palmIndices = [0, 5, 9, 13, 17];
  return palmIndices.reduce(
    (center, index) => ({
      x: center.x + landmarks[index].x / palmIndices.length,
      y: center.y + landmarks[index].y / palmIndices.length,
      z: center.z + (landmarks[index].z || 0) / palmIndices.length,
    }),
    { x: 0, y: 0, z: 0 },
  );
}

function computeHandOpenness(landmarks, fallback = state.targetHandOpenness) {
  if (!landmarks?.length || landmarks.length < 21) return fallback;
  const center = palmCenter(landmarks);
  const palmWidth = Math.max(distance3D(landmarks[5], landmarks[17]), 0.0001);
  const tipIndices = [4, 8, 12, 16, 20];
  const baseIndices = [2, 5, 9, 13, 17];
  const averageTipDistance =
    tipIndices.reduce(
      (total, index) => total + distance3D(landmarks[index], center),
      0,
    ) / tipIndices.length;
  const averageExtension =
    tipIndices.reduce(
      (total, tipIndex, index) =>
        total + distance3D(landmarks[tipIndex], landmarks[baseIndices[index]]),
      0,
    ) / tipIndices.length;
  const spreadScore = mapRange(averageTipDistance / palmWidth, 0.66, 1.34, 0, 1);
  const extensionScore = mapRange(averageExtension / palmWidth, 0.34, 1.02, 0, 1);
  return clamp(spreadScore * 0.66 + extensionScore * 0.34, 0, 1);
}

function vectorBetween(a, b) {
  return {
    x: (a?.x || 0) - (b?.x || 0),
    y: (a?.y || 0) - (b?.y || 0),
    z: (a?.z || 0) - (b?.z || 0),
  };
}

function normalizedDot(a, b) {
  const lengthA = Math.hypot(a.x, a.y, a.z || 0) || 1;
  const lengthB = Math.hypot(b.x, b.y, b.z || 0) || 1;
  return (a.x * b.x + a.y * b.y + (a.z || 0) * (b.z || 0)) / (lengthA * lengthB);
}

function distance2D(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
}

function computeLGestureScore(landmarks) {
  if (!landmarks?.length || landmarks.length < 21) return 0;
  const center = palmCenter(landmarks);
  const palmWidth = Math.max(
    distance2D(landmarks[5], landmarks[17]),
    distance2D(landmarks[0], landmarks[9]) * 0.72,
    0.0001,
  );
  const distanceFromPalm = (index) => distance2D(landmarks[index], center) / palmWidth;
  const fingerSpan = (tip, base) => distance2D(landmarks[tip], landmarks[base]) / palmWidth;
  const indexSpan = fingerSpan(8, 5);
  const indexPalmDistance = distanceFromPalm(8);
  const thumbPalmDistance = distanceFromPalm(4);
  const thumbVector = vectorBetween(landmarks[4], landmarks[2]);
  const indexVector = vectorBetween(landmarks[8], landmarks[5]);
  const indexLength = Math.hypot(indexVector.x, indexVector.y) || 1;
  const indexDirection = {
    x: indexVector.x / indexLength,
    y: indexVector.y / indexLength,
  };
  const projectionAlongIndex = (point) =>
    ((point.x - center.x) * indexDirection.x + (point.y - center.y) * indexDirection.y) /
    palmWidth;

  const indexScore =
    mapRange(indexSpan, 0.88, 1.36, 0, 1) *
    mapRange(indexPalmDistance, 0.96, 1.48, 0, 1);
  const thumbScore =
    mapRange(fingerSpan(4, 2), 0.34, 0.72, 0, 1) *
    mapRange(thumbPalmDistance, 0.68, 1.18, 0, 1) *
    mapRange(distance2D(landmarks[4], landmarks[8]) / palmWidth, 0.72, 1.42, 0, 1);
  const angleScore = smoothstep(0.18, 0.64, 1 - Math.abs(normalizedDot(thumbVector, indexVector)));
  const indexProjection = projectionAlongIndex(landmarks[8]);
  const nonTargetFingerStates = [
    [12, 10, 9],
    [16, 14, 13],
    [20, 18, 17],
  ].map(([tip, pip, base]) => {
    const spanRatio = fingerSpan(tip, base) / Math.max(indexSpan, 0.0001);
    const behindIndex = indexProjection - projectionAlongIndex(landmarks[tip]);
    const tipDistance = distanceFromPalm(tip);
    const pipDistance = distanceFromPalm(pip);
    const straightness = mapRange(
      -normalizedDot(
        vectorBetween(landmarks[tip], landmarks[pip]),
        vectorBetween(landmarks[base], landmarks[pip]),
      ),
      0.56,
      0.94,
      0,
      1,
    );
    const extended = clamp(
      straightness * 0.42 +
        mapRange(tipDistance, 0.86, 1.18, 0, 1) * 0.36 +
        mapRange(spanRatio, 0.72, 1.02, 0, 1) * 0.22,
      0,
      1,
    );
    const shortFold = 1 - mapRange(spanRatio, 0.44, 0.8, 0, 1);
    const nearPalmFold = 1 - mapRange(tipDistance, 0.74, 1.02, 0, 1);
    const curledTowardPalm = clamp(
      (1 - straightness) * 0.62 + mapRange(pipDistance - tipDistance, -0.08, 0.18, 0, 1) * 0.38,
      0,
      1,
    );
    const behindFold = mapRange(behindIndex, 0.44, 1.08, 0, 1);
    const folded = clamp(
      shortFold * 0.28 +
        nearPalmFold * 0.3 +
        curledTowardPalm * 0.28 +
        behindFold * 0.14 -
        extended * 0.32,
      0,
      1,
    );
    return { folded, extended, tipDistance };
  });
  const foldedScore =
    nonTargetFingerStates.reduce((total, value) => total + value.folded, 0) /
    nonTargetFingerStates.length;
  const extendedCount = nonTargetFingerStates.filter((value) => value.extended > 0.66).length;
  const stronglyExtendedCount = nonTargetFingerStates.filter((value) => value.extended > 0.78).length;
  const nonTargetExtension =
    nonTargetFingerStates.reduce((total, value) => total + value.extended, 0) /
    nonTargetFingerStates.length;
  const averageNonTargetDistance =
    nonTargetFingerStates.reduce((total, value) => total + value.tipDistance, 0) /
    nonTargetFingerStates.length;
  const nonTargetTipSpread = distance2D(landmarks[12], landmarks[20]) / palmWidth;
  const compactNonTarget = 1 - mapRange(nonTargetTipSpread, 0.52, 1.02, 0, 1);
  const indexDominance = indexPalmDistance - averageNonTargetDistance;
  const thumbIndexSeparation = distance2D(landmarks[4], landmarks[8]) / palmWidth;
  const lShapeScore =
    indexScore * 0.4 +
    thumbScore * 0.32 +
    angleScore * 0.18 +
    mapRange(thumbIndexSeparation, 0.62, 1.28, 0, 1) * 0.1;
  const nonTargetTolerance = clamp(
    foldedScore * 0.42 +
      compactNonTarget * 0.28 +
      mapRange(indexDominance, -0.12, 0.34, 0, 1) * 0.18 +
      (1 - nonTargetExtension) * 0.12,
    0,
    1,
  );

  const openPalmLike =
    stronglyExtendedCount >= 3 &&
    nonTargetExtension > 0.66 &&
    (nonTargetTipSpread > 0.68 || averageNonTargetDistance > 1.08) &&
    foldedScore < 0.3;
  if (openPalmLike) {
    return 0;
  }

  if (indexScore < 0.3 || thumbScore < 0.2 || angleScore < 0.1 || lShapeScore < 0.34) {
    return 0;
  }

  const openPalmPenalty =
    extendedCount >= 2 && nonTargetTipSpread > 0.64
      ? mapRange(nonTargetExtension, 0.55, 0.88, 0, 0.42)
      : mapRange(nonTargetExtension, 0.72, 0.96, 0, 0.2);
  return clamp(lShapeScore * (0.78 + nonTargetTolerance * 0.34) * (1 - openPalmPenalty), 0, 1);
}

function apparentPalmSize(landmarks) {
  if (!landmarks?.length || landmarks.length < 18) return 0;
  const palmWidth = Math.hypot(
    landmarks[5].x - landmarks[17].x,
    landmarks[5].y - landmarks[17].y,
  );
  const palmLength = Math.hypot(
    landmarks[0].x - landmarks[9].x,
    landmarks[0].y - landmarks[9].y,
  );
  return palmWidth * 0.58 + palmLength * 0.42;
}

function selectClosestHandIndex(results) {
  const hands = results?.landmarks || [];
  let selectedIndex = -1;
  let largestPalm = -1;
  for (let index = 0; index < hands.length; index += 1) {
    const size = apparentPalmSize(hands[index]);
    if (size > largestPalm) {
      largestPalm = size;
      selectedIndex = index;
    }
  }
  state.activeHandSize = Math.max(0, largestPalm);
  return selectedIndex;
}

function buildHandDetections(results) {
  const hands = results?.landmarks || [];
  return hands
    .map((landmarks, index) => {
      const center = palmCenter(landmarks);
      const worldLandmarks = results?.worldLandmarks?.[index];
      const palmSize = apparentPalmSize(landmarks);
      return {
        index,
        landmarks,
        worldLandmarks,
        palmSize,
        x: (1 - center.x) * state.width,
        y: center.y * state.height,
        openness: computeHandOpenness(worldLandmarks || landmarks),
        lGestureScore: computeLGestureScore(landmarks),
      };
    })
    .sort((a, b) => b.palmSize - a.palmSize)
    .slice(0, 2);
}

function distanceToStorm(detection, targetStorm) {
  return Math.hypot(detection.x - targetStorm.targetX, detection.y - targetStorm.targetY);
}

function assignHandDetections(detections, now) {
  const assignments = new Map();
  const selected = detections.slice(0, 2);

  if (selected.length >= 2) {
    const [first, second] = selected;
    const recentSlots = stormSlots.filter(
      (slot) => slot.opacity > 0.08 || now - slot.lastHandSeen < 900,
    );
    const bothSlotsRecent = stormSlots.every(
      (slot) => slot.opacity > 0.04 || now - slot.lastHandSeen < 900,
    );
    if (recentSlots.length === 1) {
      const anchoredSlot = recentSlots[0];
      const otherSlot = anchoredSlot === storm ? secondaryStorm : storm;
      const firstCost = distanceToStorm(first, anchoredSlot);
      const secondCost = distanceToStorm(second, anchoredSlot);
      if (firstCost <= secondCost) {
        assignments.set(anchoredSlot, first);
        assignments.set(otherSlot, second);
      } else {
        assignments.set(anchoredSlot, second);
        assignments.set(otherSlot, first);
      }
    } else if (bothSlotsRecent) {
      const directCost = distanceToStorm(first, storm) + distanceToStorm(second, secondaryStorm);
      const swappedCost = distanceToStorm(first, secondaryStorm) + distanceToStorm(second, storm);
      if (swappedCost < directCost) {
        assignments.set(secondaryStorm, first);
        assignments.set(storm, second);
      } else {
        assignments.set(storm, first);
        assignments.set(secondaryStorm, second);
      }
    } else {
      const sortedByX = selected.slice().sort((a, b) => a.x - b.x);
      assignments.set(storm, sortedByX[0]);
      assignments.set(secondaryStorm, sortedByX[1]);
    }
  } else if (selected.length === 1) {
    const detection = selected[0];
    const recentSlots = stormSlots.filter(
      (slot) => slot.opacity > 0.08 || now - slot.lastHandSeen < 900,
    );
    const targetSlot =
      recentSlots.length > 0
        ? recentSlots.reduce((best, slot) =>
            distanceToStorm(detection, slot) < distanceToStorm(detection, best) ? slot : best,
          )
        : storm;
    assignments.set(targetSlot, detection);
  }

  for (const slot of stormSlots) {
    const detection = assignments.get(slot);
    if (detection) {
      if (Math.abs(detection.openness - slot.targetHandOpenness) > 0.025) {
        slot.targetHandOpenness = detection.openness;
      }
      updateStormInput(slot, detection.x, detection.y, "hand", now);
      continue;
    }
    if (now - slot.lastHandSeen > 320) {
      slot.handVisible = false;
      slot.targetOpacity = 0;
    }
  }

  return assignments;
}

function updateThemeGesture(detections, now) {
  const bestScore = detections.reduce(
    (best, detection) => Math.max(best, detection.lGestureScore || 0),
    0,
  );
  if (bestScore > 0.32) {
    const delta = clamp((now - (state.lastGestureFrameAt || now)) / 1000, 0, 0.12);
    state.lGestureCharge = clamp(state.lGestureCharge + delta * (1.7 + bestScore * 1.35), 0, 0.65);
  } else if (bestScore < 0.18) {
    state.lGestureCharge = clamp(state.lGestureCharge - 0.045, 0, 0.65);
    if (state.lGestureCharge <= 0.02) state.lGestureLatched = false;
  }
  state.lastGestureFrameAt = now;
  document.body.dataset.lGestureReady = String(state.lGestureCharge > 0.08);

  if (
    state.lGestureCharge >= L_GESTURE_TRIGGER_THRESHOLD &&
    !state.lGestureLatched &&
    now - state.lastThemeToggleAt > 1200
  ) {
    state.lGestureLatched = true;
    state.lastThemeToggleAt = now;
    setThemeMode(state.themeMode === "blue" ? "jade" : "blue");
  }
}

function processHandResults(results, now) {
  const detections = buildHandDetections(results);
  drawLandmarks(detections.map((detection) => detection.landmarks));

  if (detections.length === 0) {
    state.activeHandCount = 0;
    state.lGestureCharge = 0;
    state.lGestureLatched = false;
    document.body.dataset.lGestureReady = "false";
    if (state.handVisible && now - state.lastHandSeen > 360) {
      state.handVisible = false;
      ui.trackingLabel.textContent = "寻找手掌";
      for (const slot of stormSlots) {
        slot.handVisible = false;
        slot.targetOpacity = 0;
      }
    }
    if (!state.handVisible && now - state.lastHandSeen > 1800) {
      setControlSource("pointer");
      storm.targetOpacity = 1;
    }
    return;
  }

  const assignments = assignHandDetections(detections, now);
  updateThemeGesture(detections, now);
  state.handVisible = true;
  state.lastHandSeen = now;
  state.activeHandCount = assignments.size;
  state.activeHandSize = Math.max(...detections.map((detection) => detection.palmSize));
  setControlSource("hand");
  ui.trackingLabel.textContent = assignments.size >= 2 ? "双手已锁定" : "单手已锁定";
  ui.interactionHint.classList.add("is-hidden");
}

function drawLandmarks(landmarks) {
  const bounds = landmarkCanvas.getBoundingClientRect();
  landmarkCtx.clearRect(0, 0, bounds.width, bounds.height);
  if (!landmarks) return;
  const hands =
    Array.isArray(landmarks) && landmarks.length > 0 && Array.isArray(landmarks[0])
      ? landmarks
      : landmarks.length
        ? [landmarks]
        : [];
  if (hands.length === 0) return;

  landmarkCtx.save();
  landmarkCtx.lineWidth = 1.2;
  hands.forEach((hand, handIndex) => {
    const gestureReady = state.lGestureCharge > 0.08;
    const strokeColor = gestureReady
      ? "rgba(102, 199, 255, 0.82)"
      : handIndex === 0
        ? "rgba(111, 255, 210, 0.72)"
        : "rgba(239, 209, 125, 0.72)";
    const pointColor = gestureReady ? "#9fdcff" : handIndex === 0 ? "#8dffe0" : "#f2cf7d";
    const tipColor = gestureReady ? "#dff4ff" : handIndex === 0 ? "#efd17d" : "#9fffe6";
    landmarkCtx.strokeStyle = strokeColor;
    landmarkCtx.shadowColor = gestureReady ? "#66c7ff" : handIndex === 0 ? "#67f5ca" : "#efd17d";
    landmarkCtx.shadowBlur = 5;
    landmarkCtx.beginPath();
    for (const [start, end] of HAND_CONNECTIONS) {
      landmarkCtx.moveTo(hand[start].x * bounds.width, hand[start].y * bounds.height);
      landmarkCtx.lineTo(hand[end].x * bounds.width, hand[end].y * bounds.height);
    }
    landmarkCtx.stroke();

    for (let index = 0; index < hand.length; index += 1) {
      const point = hand[index];
      landmarkCtx.beginPath();
      landmarkCtx.fillStyle = [0, 4, 8, 12, 16, 20].includes(index) ? tipColor : pointColor;
      landmarkCtx.arc(
        point.x * bounds.width,
        point.y * bounds.height,
        index === 0 ? 3 : 1.7,
        0,
        Math.PI * 2,
      );
      landmarkCtx.fill();
    }
  });
  landmarkCtx.restore();
}

function runHandDetection(now) {
  if (
    !state.cameraActive ||
    !handLandmarker ||
    video.readyState < 2 ||
    now - state.lastDetection < 58 ||
    video.currentTime === state.lastVideoTime
  ) {
    return;
  }

  state.lastDetection = now;
  state.lastVideoTime = video.currentTime;
  try {
    const results = handLandmarker.detectForVideo(video, now);
    processHandResults(results, now);
  } catch (error) {
    console.warn("Hand detection frame failed:", error);
  }
}

function createParticle(index = particles.length) {
  const layer = hash(index * 4.7 + performance.now() * 0.0001);
  return {
    angle: hash(index * 2.31 + Math.random()) * Math.PI * 2,
    phase: hash(index * 9.17 + Math.random()) * Math.PI * 2,
    height: Math.pow(hash(index * 4.63 + Math.random()), 0.78),
    radiusFactor: 0.36 + hash(index * 5.81 + Math.random()) * 0.76,
    size: 0.45 + hash(index * 8.2 + Math.random()) * 1.65,
    alpha: 0.14 + hash(index * 6.4 + Math.random()) * 0.55,
    speed: 0.45 + hash(index * 2.8 + Math.random()) * 1.5,
    layer,
    life: Math.random(),
    gold: hash(index * 12.3 + Math.random()) > 0.82,
  };
}

function createSuperstormParticle(index = superstormParticles.length) {
  return {
    arm: Math.floor(hash(index * 1.31 + 0.27) * SUPERSTORM_ARM_COUNT),
    progress: hash(index * 2.17 + Math.random() * 0.13),
    phaseOffset: (hash(index * 3.41 + 0.39) - 0.5) * 0.54,
    spread: (hash(index * 5.73 + 0.81) - 0.5) * 2.4,
    speed: 0.035 + hash(index * 7.19 + 0.17) * 0.12,
    size: 0.65 + hash(index * 8.83 + 0.51) * 2.65,
    alpha: 0.18 + hash(index * 11.37 + 0.33) * 0.58,
    phase: hash(index * 13.91 + 0.45) * Math.PI * 2,
    gold: hash(index * 17.17 + 0.62) > 0.84,
  };
}

function ensureSuperstormParticles() {
  const mobileFactor = state.width < 700 ? 0.52 : 1;
  const loadFactor = state.frameEma > 25 ? 0.52 : state.frameEma > 20 ? 0.7 : 1;
  const target = Math.round(
    SUPERSTORM_MAX_PARTICLES * mobileFactor * state.quality * loadFactor,
  );
  while (superstormParticles.length < target) {
    superstormParticles.push(createSuperstormParticle());
  }
  if (superstormParticles.length > target + 50) {
    superstormParticles.length = Math.max(target, superstormParticles.length - 36);
  }
}

function resetWisp(wisp) {
  wisp.angle = Math.random() * Math.PI * 2;
  wisp.height = Math.random();
  wisp.radiusFactor = 0.8 + Math.random() * 0.55;
  wisp.life = 0.5 + Math.random() * 1.3;
  wisp.maxLife = wisp.life;
  wisp.speed = 0.3 + Math.random() * 0.6;
  wisp.gold = Math.random() > 0.7;
}

function resetSpark(spark) {
  spark.x = storm.x + (Math.random() - 0.5) * 80 * state.scale;
  spark.y = storm.y + (Math.random() - 0.5) * 80 * state.scale;
  spark.vx = (Math.random() - 0.5) * (45 + state.speed * 170);
  spark.vy = -20 - Math.random() * (45 + state.speed * 80);
  spark.life = 0.25 + Math.random() * 0.65;
  spark.maxLife = spark.life;
  spark.size = 0.6 + Math.random() * 1.7;
  spark.gold = Math.random() > 0.42;
}

function ensureParticleCounts() {
  const superstormSuppression = smoothstep(0.45, 0.92, state.superstormIntensity);
  const base = reducedMotion ? 300 : state.width < 700 ? 780 : 1250;
  const speedBonus = reducedMotion ? 0 : Math.round(state.speed * (state.width < 700 ? 260 : 450));
  const fullTarget = Math.min(reducedMotion ? 380 : 1750, base + speedBonus);
  const minimum = reducedMotion ? 260 : state.width < 700 ? 580 : 820;
  const idleFloor = reducedMotion ? 120 : state.width < 700 ? 220 : 320;
  const activeTarget = Math.max(minimum, Math.round(fullTarget * state.quality));
  const dualStormFactor = state.visualStormCount > 1 ? 0.72 : 1;
  const target = Math.round(lerp(activeTarget * dualStormFactor, idleFloor, superstormSuppression));
  while (particles.length < target) particles.push(createParticle());
  if (particles.length > target + 40) {
    particles.length = Math.max(target, particles.length - (superstormSuppression > 0 ? 80 : 28));
  }

  const activeWispTarget = reducedMotion
    ? 12
    : Math.max(20, Math.round(48 * state.quality * dualStormFactor));
  const wispTarget = Math.round(lerp(activeWispTarget, reducedMotion ? 4 : 8, superstormSuppression));
  while (wisps.length < wispTarget) {
    const wisp = {};
    resetWisp(wisp);
    wisps.push(wisp);
  }
  if (wisps.length > wispTarget) wisps.length = wispTarget;

  const activeSparkTarget = reducedMotion
    ? 16
    : Math.round((48 + state.speed * 30) * state.quality * dualStormFactor);
  const sparkTarget = Math.round(lerp(activeSparkTarget, 0, superstormSuppression));
  while (sparks.length < sparkTarget) {
    const spark = {};
    resetSpark(spark);
    sparks.push(spark);
  }
  if (sparks.length > sparkTarget) sparks.length = sparkTarget;
}

function weatherFocusStorm() {
  if (state.mergeIntensity > 0.5) return fusionStorm;
  const fistFocus = stormSlots.find((slot) => slot.fistStorm && slot.opacity > 0.18);
  if (fistFocus) return fistFocus;
  return stormSlots
    .filter((slot) => slot.opacity > 0.05)
    .reduce((leader, slot) => (slot.speed > leader.speed ? slot : leader), storm);
}

function createLightningStrike(now) {
  const focusStorm = weatherFocusStorm();
  const dimensions = stormDimensions(focusStorm);
  const targetX = clamp(
    focusStorm.x + (Math.random() - 0.5) * dimensions.width * 0.9,
    state.width * 0.08,
    state.width * 0.92,
  );
  const targetY = clamp(
    focusStorm.y - dimensions.height * 0.1,
    state.height * 0.22,
    state.height * 0.78,
  );
  const startX = clamp(
    targetX + (Math.random() - 0.5) * state.width * 0.38,
    state.width * 0.08,
    state.width * 0.92,
  );
  const segmentCount = 11 + Math.floor(Math.random() * 4);
  const points = [];
  for (let index = 0; index <= segmentCount; index += 1) {
    const progress = index / segmentCount;
    const envelope = Math.sin(progress * Math.PI);
    points.push({
      x:
        lerp(startX, targetX, progress) +
        (Math.random() - 0.5) * state.width * 0.055 * envelope,
      y: lerp(-18, targetY, progress),
    });
  }

  const branches = [];
  for (let branchIndex = 0; branchIndex < 3; branchIndex += 1) {
    const anchorIndex = 3 + Math.floor(Math.random() * Math.max(2, segmentCount - 5));
    const anchor = points[anchorIndex];
    const direction = Math.random() > 0.5 ? 1 : -1;
    const branch = [anchor];
    const branchSegments = 3 + Math.floor(Math.random() * 3);
    for (let index = 1; index <= branchSegments; index += 1) {
      branch.push({
        x:
          anchor.x +
          direction * index * (13 + Math.random() * 22) +
          (Math.random() - 0.5) * 16,
        y: anchor.y + index * (16 + Math.random() * 24),
      });
    }
    branches.push(branch);
  }

  lightning.active = true;
  lightning.age = 0;
  lightning.duration = 0.3 + Math.random() * 0.13;
  lightning.strikeX = targetX;
  lightning.points = points;
  lightning.branches = branches;
  state.lastLightningAt = now;
  state.nextLightningDelay = state.fistStorm
    ? 750 + Math.random() * 1100
    : 1200 + Math.random() * 1800;
  triggerThunder(targetX);
}

function updateWeather(dt, now) {
  const speedPercent = state.speed * 100;
  let nextMode = state.weatherMode;
  const weatherLevel = { calm: 0, rain: 1, lightning: 2, superstorm: 3 };

  if (state.fistStorm) {
    nextMode = "superstorm";
  } else if (state.weatherMode === "lightning") {
    if (speedPercent < 78) nextMode = speedPercent >= 55 ? "rain" : "calm";
  } else if (state.weatherMode === "rain") {
    if (speedPercent >= 85) nextMode = "lightning";
    else if (speedPercent < 55) nextMode = "calm";
  } else if (state.weatherMode === "superstorm") {
    nextMode = speedPercent >= 85 ? "lightning" : speedPercent >= 60 ? "rain" : "calm";
  } else if (speedPercent >= 85) {
    nextMode = "lightning";
  } else if (speedPercent >= 60) {
    nextMode = "rain";
  }

  if (
    weatherLevel[nextMode] < weatherLevel[state.weatherMode] &&
    now < state.weatherHoldUntil &&
    state.weatherMode !== "superstorm"
  ) {
    nextMode = state.weatherMode;
  }

  if (nextMode !== state.weatherMode) {
    state.weatherMode = nextMode;
    state.weatherHoldUntil =
      now +
      (nextMode === "lightning"
        ? 1600
        : nextMode === "rain"
          ? 1100
          : nextMode === "superstorm"
            ? 600
            : 0);
    if (nextMode === "lightning" || nextMode === "superstorm") {
      createLightningStrike(now);
    }
  }

  state.targetRainIntensity =
    state.weatherMode === "calm"
      ? 0
      : state.weatherMode === "superstorm"
        ? 1
        : mapRange(speedPercent, 55, 100, 0.34, 1);
  state.rainIntensity = lerp(
    state.rainIntensity,
    state.targetRainIntensity,
    1 -
      Math.exp(
        -dt *
          (state.targetRainIntensity > state.rainIntensity
            ? state.weatherMode === "superstorm"
              ? 6.5
              : 3.4
            : 0.78),
      ),
  );

  if (
    ((state.weatherMode === "lightning" && speedPercent >= 85) ||
      (state.weatherMode === "superstorm" && state.fistStorm)) &&
    now - state.lastLightningAt >= state.nextLightningDelay
  ) {
    createLightningStrike(now);
  }
}

function updateStormSlot(targetStorm, dt) {
  const sourceResponsive = targetStorm.controlSource === "hand" ? 10 : 13;
  const follow = 1 - Math.exp(-dt * sourceResponsive);
  targetStorm.previousX = targetStorm.x;
  targetStorm.x = lerp(targetStorm.x, targetStorm.targetX, follow);
  targetStorm.y = lerp(targetStorm.y, targetStorm.targetY, follow);
  targetStorm.tilt = lerp(
    targetStorm.tilt,
    clamp((targetStorm.x - targetStorm.previousX) * 0.015, -0.28, 0.28),
    1 - Math.exp(-dt * 7),
  );

  const speedResponse = 1 - Math.exp(-dt * (targetStorm.rawSpeed > targetStorm.speed ? 8.5 : 3.1));
  targetStorm.speed = lerp(targetStorm.speed, clamp(targetStorm.rawSpeed / 1.05, 0, 1), speedResponse);
  targetStorm.rawSpeed *= Math.pow(
    targetStorm.controlSource === "hand" && targetStorm.handVisible ? 0.16 : 0.055,
    dt,
  );
  targetStorm.handOpenness = lerp(
    targetStorm.handOpenness,
    targetStorm.targetHandOpenness,
    1 - Math.exp(-dt * 7.5),
  );

  if (targetStorm.controlSource !== "hand" || !targetStorm.handVisible) {
    targetStorm.fistStorm = false;
  } else if (!targetStorm.fistStorm && targetStorm.handOpenness <= 0.15) {
    targetStorm.fistStorm = true;
  } else if (targetStorm.fistStorm && targetStorm.handOpenness >= 0.23) {
    targetStorm.fistStorm = false;
  }

  const scaleControl =
    targetStorm.controlSource === "hand" && targetStorm.handVisible
      ? targetStorm.handOpenness
      : targetStorm.speed;
  targetStorm.targetScale = targetStorm.fistStorm
    ? 1.34
    : mapRange(scaleControl, 0, 1, 0.65, 1.9);
  targetStorm.scale = lerp(targetStorm.scale, targetStorm.targetScale, 1 - Math.exp(-dt * 4.2));
  targetStorm.glow = lerp(targetStorm.glow, targetStorm.speed, 1 - Math.exp(-dt * 5));
  targetStorm.opacity = lerp(
    targetStorm.opacity,
    targetStorm.targetOpacity,
    1 - Math.exp(-dt * (targetStorm.targetOpacity > targetStorm.opacity ? 6.5 : 3.2)),
  );

  if (targetStorm.opacity > 0.04) {
    targetStorm.trailPoints.unshift({
      x: targetStorm.x,
      y: targetStorm.y,
      life: targetStorm.opacity,
      speed: targetStorm.speed,
    });
  }
  const trailLimit = reducedMotion ? 8 : Math.round(12 + targetStorm.speed * 20);
  if (targetStorm.trailPoints.length > trailLimit) targetStorm.trailPoints.length = trailLimit;
  targetStorm.trailPoints.forEach((point) => {
    point.life -= dt * (1.6 - targetStorm.speed * 0.55);
  });
}

function updateMergeState(dt) {
  const bothHands =
    storm.handVisible &&
    secondaryStorm.handVisible &&
    storm.opacity > 0.18 &&
    secondaryStorm.opacity > 0.18;
  const handDistance = Math.hypot(storm.x - secondaryStorm.x, storm.y - secondaryStorm.y);
  const closeThreshold = clamp(Math.min(state.width, state.height) * 0.18, 92, 190);
  const releaseThreshold = closeThreshold * 1.52;
  const handSpeed = Math.max(storm.speed, secondaryStorm.speed);
  const closeAndSettled =
    bothHands &&
    handDistance <= closeThreshold &&
    handSpeed < 0.48 &&
    !storm.fistStorm &&
    !secondaryStorm.fistStorm &&
    state.superstormIntensity < 0.18;

  if (closeAndSettled) {
    state.mergeCharge = clamp(state.mergeCharge + dt, 0, 0.78);
  } else {
    const decay = bothHands && handDistance <= releaseThreshold ? 0.52 : 1.75;
    state.mergeCharge = clamp(state.mergeCharge - dt * decay, 0, 0.78);
  }

  if (!state.mergeActive && state.mergeCharge >= 0.58) {
    state.mergeActive = true;
  } else if (
    state.mergeActive &&
    (!bothHands || handDistance > releaseThreshold || storm.fistStorm || secondaryStorm.fistStorm)
  ) {
    state.mergeActive = false;
  }

  const targetIntensity = state.mergeActive ? 1 : 0;
  state.mergeIntensity = lerp(
    state.mergeIntensity,
    targetIntensity,
    1 - Math.exp(-dt * (targetIntensity > state.mergeIntensity ? 4.8 : 3.1)),
  );

  if (bothHands || state.mergeIntensity > 0.02) {
    const midpointX = (storm.x + secondaryStorm.x) * 0.5;
    const midpointY = (storm.y + secondaryStorm.y) * 0.5;
    state.mergeCenterX = lerp(state.mergeCenterX, midpointX, 1 - Math.exp(-dt * 8));
    state.mergeCenterY = lerp(state.mergeCenterY, midpointY, 1 - Math.exp(-dt * 8));
  }

  fusionStorm.previousX = fusionStorm.x;
  fusionStorm.targetX = state.mergeCenterX;
  fusionStorm.targetY = state.mergeCenterY;
  fusionStorm.x = lerp(fusionStorm.x, fusionStorm.targetX, 1 - Math.exp(-dt * 9));
  fusionStorm.y = lerp(fusionStorm.y, fusionStorm.targetY, 1 - Math.exp(-dt * 9));
  fusionStorm.tilt = lerp(
    fusionStorm.tilt,
    clamp((fusionStorm.x - fusionStorm.previousX) * 0.012, -0.24, 0.24),
    1 - Math.exp(-dt * 6),
  );
  fusionStorm.speed = lerp(
    fusionStorm.speed,
    clamp(Math.max(storm.speed, secondaryStorm.speed) + state.mergeIntensity * 0.18, 0, 1),
    1 - Math.exp(-dt * 5),
  );
  fusionStorm.rawSpeed = Math.max(storm.rawSpeed, secondaryStorm.rawSpeed);
  fusionStorm.targetScale = 1.56 + state.mergeIntensity * 0.52 + fusionStorm.speed * 0.18;
  fusionStorm.scale = lerp(fusionStorm.scale, fusionStorm.targetScale, 1 - Math.exp(-dt * 4.5));
  fusionStorm.glow = lerp(
    fusionStorm.glow,
    clamp(0.55 + fusionStorm.speed * 0.45 + state.mergeIntensity * 0.35, 0, 1.35),
    1 - Math.exp(-dt * 5),
  );
  fusionStorm.opacity = state.mergeIntensity;
  fusionStorm.handVisible = state.mergeIntensity > 0.04;

  if (fusionStorm.opacity > 0.04) {
    fusionStorm.trailPoints.unshift({
      x: fusionStorm.x,
      y: fusionStorm.y,
      life: fusionStorm.opacity,
      speed: fusionStorm.speed,
    });
  }
  const trailLimit = reducedMotion ? 10 : Math.round(18 + fusionStorm.speed * 28);
  if (fusionStorm.trailPoints.length > trailLimit) fusionStorm.trailPoints.length = trailLimit;
  fusionStorm.trailPoints.forEach((point) => {
    point.life -= dt * (1.25 - fusionStorm.speed * 0.35);
  });
}

function updateStorm(dt, now) {
  for (const slot of stormSlots) updateStormSlot(slot, dt);

  const visibleSlots = stormSlots.filter((slot) => slot.opacity > 0.05);
  const handSlots = stormSlots.filter((slot) => slot.controlSource === "hand" && slot.handVisible);
  const speedLeader = visibleSlots.reduce(
    (leader, slot) => (slot.speed > leader.speed ? slot : leader),
    storm,
  );
  const opennessLeader =
    handSlots.length > 0
      ? handSlots.reduce((leader, slot) =>
          slot.handOpenness < leader.handOpenness ? slot : leader,
        )
      : storm;

  state.visualStormCount = Math.max(1, visibleSlots.length);
  state.activeHandCount = handSlots.length;
  state.speed = speedLeader.speed;
  state.rawSpeed = speedLeader.rawSpeed;
  state.handOpenness = opennessLeader.handOpenness;
  state.targetHandOpenness = opennessLeader.targetHandOpenness;
  state.scale = storm.scale;
  state.targetScale = storm.targetScale;
  state.fistStorm = handSlots.some((slot) => slot.fistStorm && slot.opacity > 0.18);
  updateMergeState(dt);
  if (state.mergeIntensity > 0.55) {
    state.visualStormCount = 1;
    state.speed = Math.max(state.speed, fusionStorm.speed);
    state.scale = fusionStorm.scale;
    state.targetScale = fusionStorm.targetScale;
  }

  state.superstormIntensity = lerp(
    state.superstormIntensity,
    state.fistStorm ? 1 : 0,
    1 - Math.exp(-dt * (state.fistStorm ? 6.2 : 2.35)),
  );
  state.superstormSpin +=
    dt *
    (reducedMotion
      ? 0.12
      : 0.22 + state.speed * 0.34 + state.superstormIntensity * 0.28);

  ensureParticleCounts();
  updateWeather(dt, now);
  updateAudio(now);
  if (now - state.lastTelemetry > 90) {
    state.lastTelemetry = now;
    updateTelemetry();
  }
}

function updateTelemetry() {
  const speedPercent = Math.round(state.speed * 100);
  const weatherLabels = {
    calm: "平静",
    rain: "降雨",
    lightning: "雷暴",
    superstorm: "暴风雨",
  };
  ui.speedValue.textContent = speedPercent;
  ui.speedMeter.style.width = `${speedPercent}%`;
  ui.opennessValue.textContent =
    state.controlSource === "hand" && state.activeHandCount > 0
      ? Math.round(state.handOpenness * 100)
      : "—";
  ui.weatherStatus.textContent = weatherLabels[state.weatherMode];
  ui.weatherStatus.dataset.weather = state.weatherMode;
  ui.modeHint.textContent =
    state.lGestureCharge > 0.1
      ? `L 手势切色 ${Math.round((state.lGestureCharge / L_GESTURE_TRIGGER_THRESHOLD) * 100)}%`
      : state.mergeIntensity > 0.55
      ? "合体风眼 · 外围粒子环绕"
      : state.mergeCharge > 0.12
        ? `合拢蓄力 ${Math.round((state.mergeCharge / 0.58) * 100)}%`
        : state.controlSource === "hand"
      ? state.activeHandCount >= 2
        ? "双手×2 · 各控一个风眼"
        : "五指控制大小"
      : "速度控制大小";
  ui.coordinates.textContent = `X ${Math.round((storm.x / state.width) * 100)} · Y ${Math.round((storm.y / state.height) * 100)}`;
  document.body.dataset.fps = String(Math.round(1000 / state.frameEma));
  document.body.dataset.particles = String(particles.length);
  document.body.dataset.quality = state.quality.toFixed(2);
  document.body.dataset.openness = state.handOpenness.toFixed(2);
  document.body.dataset.handCount = String(state.activeHandCount);
  document.body.dataset.stormCount = String(state.visualStormCount);
  document.body.dataset.weather = state.weatherMode;
  document.body.dataset.rain = state.rainIntensity.toFixed(2);
  document.body.dataset.fistStorm = String(state.fistStorm);
  document.body.dataset.superstorm = state.superstormIntensity.toFixed(2);
  document.body.dataset.merge = state.mergeIntensity.toFixed(2);
  document.body.dataset.mergeCharge = state.mergeCharge.toFixed(2);
  document.body.dataset.lGesture = state.lGestureCharge.toFixed(2);
  document.body.dataset.theme = state.themeMode;
  document.body.dataset.handSize = state.activeHandSize.toFixed(3);
}

function drawBackground(time) {
  const palette = getThemePalette();
  const deep = palette.deepRgb;
  const primary = palette.primaryRgb;
  const gradient = ctx.createRadialGradient(
    storm.x,
    storm.y,
    0,
    storm.x,
    storm.y,
    Math.max(state.width, state.height) * 0.7,
  );
  gradient.addColorStop(
    0,
    `rgba(${deep[0] + 6}, ${deep[1] + 15 + Math.round(storm.glow * 18)}, ${deep[2] + 15}, 1)`,
  );
  gradient.addColorStop(0.36, palette.deep);
  gradient.addColorStop(1, "#010504");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.save();
  for (const star of stars) {
    star.y -= star.drift * 0.002;
    if (star.y < -2) star.y = state.height + 2;
    const flicker = 0.65 + Math.sin(time * 0.0007 + star.x) * 0.35;
    ctx.globalAlpha = star.alpha * flicker;
    ctx.fillStyle = palette.bright;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.restore();

  const fogY = state.height * 0.79;
  const fog = ctx.createLinearGradient(0, fogY - 100, 0, state.height);
  fog.addColorStop(0, themeRgba("deep", 0, palette));
  fog.addColorStop(1, `rgba(${primary[0]}, ${primary[1]}, ${primary[2]}, 0.11)`);
  ctx.fillStyle = fog;
  ctx.fillRect(0, fogY - 100, state.width, state.height - fogY + 100);
}

function drawRain(dt) {
  if (state.rainIntensity < 0.012) return;
  const dropCount = Math.min(
    MAX_RAIN_DROPS,
    Math.round((130 + state.rainIntensity * 390) * state.quality),
  );
  const horizontalMotion = clamp((storm.x - storm.previousX) * 2.5, -18, 18);
  const windX = 8 + horizontalMotion + storm.tilt * 30;
  const fallSpeed = 430 + state.rainIntensity * 410;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.beginPath();
  for (let index = 0; index < dropCount; index += 1) {
    rain.y[index] += (fallSpeed * rain.speed[index] * dt) / state.height;
    rain.x[index] +=
      ((windX + rain.drift[index] * 5) * rain.speed[index] * dt) / state.width;
    if (rain.y[index] > 1.08 || rain.x[index] > 1.08 || rain.x[index] < -0.08) {
      rain.y[index] = -0.08 - Math.random() * 0.18;
      rain.x[index] = Math.random();
    }

    const x = rain.x[index] * state.width;
    const y = rain.y[index] * state.height;
    const length = rain.length[index] * (0.72 + state.rainIntensity * 0.55);
    const slant = windX * 0.045 * length;
    ctx.moveTo(x, y);
    ctx.lineTo(x + slant, y + length);
  }
  ctx.globalAlpha = 0.13 + state.rainIntensity * 0.24;
  ctx.strokeStyle = "#9ccfe3";
  ctx.lineWidth = 0.55 + state.rainIntensity * 0.42;
  ctx.stroke();
  ctx.restore();
}

function superstormCenter() {
  const focusStorm = stormSlots.find((slot) => slot.fistStorm && slot.opacity > 0.18) || storm;
  return {
    x: lerp(state.width * 0.5, focusStorm.x, 0.34),
    y: lerp(state.height * 0.5, focusStorm.y, 0.26),
  };
}

function superstormPoint(centerX, centerY, maxRadius, arm, progress, spin, phaseOffset = 0, spread = 0) {
  const turnCount = 2.58;
  const ellipseY = 0.76;
  const wobble = Math.sin(progress * 9.4 + spin * 1.15 + arm * 1.7) * 0.045;
  const angle =
    (arm / SUPERSTORM_ARM_COUNT) * Math.PI * 2 +
    progress * Math.PI * 2 * turnCount +
    spin +
    phaseOffset +
    wobble;
  const radius = maxRadius * (0.035 + Math.pow(progress, 0.88) * 0.955);
  const thickness = maxRadius * (0.014 + Math.pow(progress, 1.1) * 0.04);
  const lateral = spread * thickness;
  const normalAngle = angle + Math.PI / 2;

  return {
    x: centerX + Math.cos(angle) * radius + Math.cos(normalAngle) * lateral,
    y: centerY + Math.sin(angle) * radius * ellipseY + Math.sin(normalAngle) * lateral * ellipseY,
    angle,
    radius,
  };
}

function ensureSuperstormCache() {
  const palette = getThemePalette();
  const compact = state.width < 700;
  const size = reducedMotion ? (compact ? 300 : 360) : compact ? 400 : 640;
  const key = `${size}:${SUPERSTORM_ARM_COUNT}:${compact ? 1 : 0}:${reducedMotion ? 1 : 0}:${state.themeMode}`;
  if (superstormCache.key === key) return superstormCache.canvas;

  const buffer = superstormCache.canvas;
  const bufferCtx = superstormCache.ctx;
  const center = size / 2;
  const radius = size * 0.445;
  buffer.width = size;
  buffer.height = size;
  bufferCtx.setTransform(1, 0, 0, 1, 0, 0);
  bufferCtx.clearRect(0, 0, size, size);
  bufferCtx.globalAlpha = 1;
  bufferCtx.globalCompositeOperation = "lighter";
  bufferCtx.lineCap = "round";
  bufferCtx.lineJoin = "round";

  const layers = reducedMotion
    ? [{ blur: 6, width: 0.052, alpha: 0.15, lanes: 1, steps: 32 }]
    : [
        { blur: 14, width: 0.088, alpha: 0.07, lanes: 2, steps: 40 },
        { blur: 5, width: 0.046, alpha: 0.13, lanes: 2, steps: 46 },
        { blur: 0, width: 0.014, alpha: 0.28, lanes: 1, steps: 54 },
      ];

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    const layer = layers[layerIndex];
    if ("filter" in bufferCtx) {
      bufferCtx.filter = layer.blur > 0 ? `blur(${layer.blur}px)` : "none";
    }

    for (let arm = 0; arm < SUPERSTORM_ARM_COUNT; arm += 1) {
      for (let lane = 0; lane < layer.lanes; lane += 1) {
        const laneOffset =
          layer.lanes === 1
            ? 0
            : (lane - 0.5) * 0.22 + (hash(arm * 4.7 + lane * 2.3) - 0.5) * 0.08;
        const laneSpread = layer.lanes === 1 ? 0 : lane === 0 ? -0.54 : 0.54;
        const warmArm = (arm + lane + layerIndex) % 5 === 1;

        for (let segment = 0; segment < layer.steps; segment += 1) {
          const start = segment / layer.steps;
          const end = (segment + 1) / layer.steps;
          const mid = (start + end) / 2;
          const envelope = Math.pow(Math.sin(mid * Math.PI), 0.42);
          const brokenLight =
            0.62 + hash(arm * 31.7 + segment * 1.37 + layerIndex * 8.1) * 0.52;
          const segmentAlpha = layer.alpha * envelope * brokenLight;
          if (segmentAlpha < 0.006) continue;

          const pointA = superstormPoint(
            center,
            center,
            radius,
            arm,
            start,
            0,
            laneOffset,
            laneSpread,
          );
          const pointB = superstormPoint(
            center,
            center,
            radius,
            arm,
            end,
            0,
            laneOffset,
            laneSpread,
          );
          const taper = 1 - mid * 0.48;
          bufferCtx.beginPath();
          bufferCtx.moveTo(pointA.x, pointA.y);
          bufferCtx.lineTo(pointB.x, pointB.y);
          bufferCtx.lineWidth = radius * layer.width * taper * (0.78 + brokenLight * 0.22);
          bufferCtx.strokeStyle = warmArm
            ? themeRgba("gold", segmentAlpha, palette)
            : themeRgba("primary", segmentAlpha, palette);
          bufferCtx.stroke();
        }
      }
    }
  }

  if ("filter" in bufferCtx) bufferCtx.filter = "none";

  const speckleCount = reducedMotion ? 120 : compact ? 320 : 520;
  for (let index = 0; index < speckleCount; index += 1) {
    const progress = Math.pow(hash(index * 2.81 + 0.12), 0.72);
    const arm = Math.floor(hash(index * 3.19 + 0.4) * SUPERSTORM_ARM_COUNT);
    const spread = (hash(index * 5.41 + 0.77) - 0.5) * 2.1;
    const phase = (hash(index * 7.73 + 0.21) - 0.5) * 0.36;
    const point = superstormPoint(center, center, radius, arm, progress, 0, phase, spread);
    const envelope = Math.pow(Math.sin(progress * Math.PI), 0.36);
    const warm = hash(index * 9.29 + 0.51) > 0.84;
    const sizePx = 0.7 + hash(index * 11.11 + 0.19) * 1.8;
    bufferCtx.globalAlpha = envelope * (warm ? 0.34 : 0.3);
    bufferCtx.fillStyle = warm ? palette.gold : palette.bright;
    bufferCtx.fillRect(point.x - sizePx / 2, point.y - sizePx / 2, sizePx, sizePx);
  }
  bufferCtx.globalAlpha = 1;

  superstormCache.key = key;
  return buffer;
}

function drawSuperstormRibbons(centerX, centerY, maxRadius, spin, intensity) {
  const texture = ensureSuperstormCache();
  const drawSize = maxRadius * 2.32;
  const pulse = 0.92 + Math.sin(state.elapsed * 3.4) * 0.08;
  const passes =
    state.quality < 0.72
      ? [{ scale: 1, rotate: spin * 0.34, alpha: 0.95 }]
      : [
          { scale: 1, rotate: spin * 0.34, alpha: 0.82 },
          { scale: 1.08, rotate: spin * 0.22 + 0.16, alpha: 0.32 },
        ];

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(centerX, centerY);
  for (const pass of passes) {
    ctx.save();
    ctx.globalAlpha = intensity * pass.alpha * pulse;
    ctx.rotate(pass.rotate);
    ctx.scale(pass.scale, pass.scale);
    ctx.drawImage(texture, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    ctx.restore();
  }
  ctx.restore();
}

function drawSuperstormParticles(dt, time, centerX, centerY, maxRadius, spin, intensity) {
  ensureSuperstormParticles();
  const palette = getThemePalette();
  const activeCount = Math.round(
    superstormParticles.length * smoothstep(0.06, 0.92, intensity),
  );
  if (activeCount <= 0) return;

  const tailLength = 0.014 + intensity * 0.02 + state.speed * 0.026;
  const particleSpeed = reducedMotion ? 0.45 : 1;

  for (let index = 0; index < activeCount; index += 1) {
    const particle = superstormParticles[index];
    particle.progress +=
      dt * particleSpeed * (particle.speed + state.speed * 0.085 + intensity * 0.038);
    if (particle.progress > 1) particle.progress -= Math.floor(particle.progress);

    const shimmer = 0.72 + Math.sin(time * 0.006 + particle.phase) * 0.28;
    const spread =
      particle.spread *
      (0.82 + Math.sin(time * 0.0019 + particle.phase + particle.progress * 5) * 0.18);
    const current = superstormPoint(
      centerX,
      centerY,
      maxRadius,
      particle.arm,
      particle.progress,
      spin,
      particle.phaseOffset,
      spread,
    );
    const previousProgress = particle.progress - tailLength * (0.82 + particle.speed * 3.8);
    const previous =
      previousProgress > 0
        ? superstormPoint(
            centerX,
            centerY,
            maxRadius,
            particle.arm,
            previousProgress,
            spin,
            particle.phaseOffset,
            spread * 0.82,
          )
        : current;
    const envelope = Math.pow(Math.sin(particle.progress * Math.PI), 0.28);
    particle.x = current.x;
    particle.y = current.y;
    particle.previousX = previous.x;
    particle.previousY = previous.y;
    particle.visibility = particle.alpha * intensity * shimmer * envelope;
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  const dotStride = state.frameEma > 23 || state.quality < 0.74 ? 2 : 1;
  const useParticleGlow = state.frameEma < 20 && state.quality > 0.86;

  for (const gold of [false, true]) {
    ctx.beginPath();
    for (let index = 0; index < activeCount; index += 1) {
      const particle = superstormParticles[index];
      if (particle.gold !== gold || particle.visibility < 0.035) continue;
      ctx.moveTo(particle.previousX, particle.previousY);
      ctx.lineTo(particle.x, particle.y);
    }
    ctx.globalAlpha = gold ? 0.38 : 0.46;
    ctx.lineWidth = gold ? 1.25 : 0.92;
    ctx.strokeStyle = gold ? palette.gold : palette.primary;
    ctx.stroke();
  }

  for (const gold of [false, true]) {
    ctx.beginPath();
    for (let index = 0; index < activeCount; index += dotStride) {
      const particle = superstormParticles[index];
      if (particle.gold !== gold || particle.visibility < 0.05) continue;
      const size = particle.size * (gold ? 1.08 : 0.92) * (0.75 + particle.visibility * 0.45);
      ctx.rect(particle.x - size / 2, particle.y - size / 2, size, size);
    }
    ctx.globalAlpha = gold ? 0.35 : 0.42;
    ctx.fillStyle = gold ? palette.gold : palette.bright;
    ctx.shadowBlur = useParticleGlow ? (gold ? 8 : 6) : 0;
    ctx.shadowColor = gold ? palette.gold : palette.primary;
    ctx.fill();
  }

  ctx.restore();
}

function drawSuperstormEye(centerX, centerY, maxRadius, spin, intensity) {
  const palette = getThemePalette();
  const eyeRadius = maxRadius * 0.105;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const eye = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, eyeRadius * 2.3);
  eye.addColorStop(0, `rgba(0, 0, 0, ${0.92 * intensity})`);
  eye.addColorStop(0.48, `rgba(0, 6, 7, ${0.86 * intensity})`);
  eye.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = eye;
  ctx.fillRect(centerX - eyeRadius * 2.4, centerY - eyeRadius * 2.4, eyeRadius * 4.8, eyeRadius * 4.8);

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.2 * intensity;
  ctx.strokeStyle = palette.bright;
  ctx.lineWidth = 1.2 + intensity * 1.6;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, eyeRadius * 0.95, eyeRadius * 0.58, spin * 0.8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.13 * intensity;
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, eyeRadius * 1.34, eyeRadius * 0.78, spin * 0.8 + 0.75, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSuperstorm(dt, time) {
  const intensity = state.superstormIntensity;
  if (intensity <= 0.01) return;
  const palette = getThemePalette();

  const { x: centerX, y: centerY } = superstormCenter();
  const maxRadius =
    Math.hypot(state.width, state.height) * (state.width < 700 ? 0.7 : 0.62);
  const spin = state.superstormSpin;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(0, 6, 7, ${0.5 * intensity})`;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.globalCompositeOperation = "screen";
  const halo = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius * 1.06);
  halo.addColorStop(0, themeRgba("primary", 0.1 * intensity, palette));
  halo.addColorStop(0.38, themeRgba("secondary", 0.07 * intensity, palette));
  halo.addColorStop(0.74, themeRgba("gold", 0.035 * intensity, palette));
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();

  drawSuperstormRibbons(centerX, centerY, maxRadius, spin, intensity);
  drawSuperstormParticles(dt, time, centerX, centerY, maxRadius, spin, intensity);
  drawSuperstormEye(centerX, centerY, maxRadius, spin, intensity);
}

function drawLightning(dt) {
  if (!lightning.active) return;
  lightning.age += dt;
  const progress = lightning.age / lightning.duration;
  const pulse =
    progress < 0.17
      ? 1
      : Math.max(0, 1 - (progress - 0.17) / 0.83) *
        (0.72 + Math.sin(progress * 46) * 0.28);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = pulse * 0.13;
  ctx.fillStyle = "#c7e8ff";
  ctx.fillRect(0, 0, state.width, state.height);

  function strokeBolt(points, width, color, alpha) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index].x, points[index].y);
    }
    ctx.globalAlpha = pulse * alpha;
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  strokeBolt(lightning.points, 7, "#75bfff", 0.16);
  strokeBolt(lightning.points, 2.1, "#e8f8ff", 0.94);
  for (const branch of lightning.branches) {
    strokeBolt(branch, 3.5, "#76bcf4", 0.12);
    strokeBolt(branch, 1, "#d9f3ff", 0.68);
  }
  ctx.restore();

  if (progress >= 1) {
    lightning.active = false;
    lightning.points = [];
    lightning.branches = [];
  }
}

function drawTrail(targetStorm = storm) {
  const points = targetStorm.trailPoints || trailPoints;
  if (points.length < 3 || targetStorm.opacity <= 0.02) return;
  const palette = getThemePalette();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = targetStorm.opacity;
  for (let pass = 0; pass < 3; pass += 1) {
    ctx.beginPath();
    points.forEach((point, index) => {
      const taper = 1 - index / points.length;
      const side = Math.sin(index * 0.7 + state.elapsed * 3) * (8 + pass * 7) * taper;
      const x = point.x + side;
      const y = point.y + index * 1.5;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineWidth = (pass === 0 ? 2.2 : 0.8) + targetStorm.speed * (pass === 0 ? 5 : 2);
    ctx.strokeStyle =
      pass === 0
        ? themeRgba("primary", 0.08 + targetStorm.speed * 0.14, palette)
        : themeRgba("gold", 0.025 + targetStorm.speed * 0.06, palette);
    ctx.shadowBlur = 16;
    ctx.shadowColor = pass === 0 ? palette.primary : palette.gold;
    ctx.stroke();
  }
  ctx.restore();
}

function stormDimensions(targetStorm = storm) {
  const compact = Math.min(state.width, state.height);
  const height = clamp(compact * 0.47, 260, 520) * targetStorm.scale;
  const width = height * 0.31;
  return { width, height };
}

function drawVortexBody(time, dimensions, targetStorm = storm) {
  const palette = getThemePalette();
  const { width, height } = dimensions;
  const baseY = targetStorm.y + height * 0.28;
  const topY = targetStorm.y - height * 0.53;
  const bodyGradient = ctx.createLinearGradient(targetStorm.x, topY, targetStorm.x, baseY);
  bodyGradient.addColorStop(0, themeRgba("bright", 0.015, palette));
  bodyGradient.addColorStop(0.45, themeRgba("secondary", 0.035 + targetStorm.glow * 0.025, palette));
  bodyGradient.addColorStop(0.85, themeRgba("primary", 0.018, palette));
  bodyGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.save();
  ctx.globalAlpha = targetStorm.opacity;
  ctx.translate(targetStorm.x, targetStorm.y);
  ctx.rotate(targetStorm.tilt);
  ctx.beginPath();
  ctx.moveTo(-width * 0.95, -height * 0.5);
  ctx.bezierCurveTo(-width * 0.65, -height * 0.15, -width * 0.28, height * 0.12, -width * 0.05, height * 0.29);
  ctx.bezierCurveTo(width * 0.08, height * 0.32, width * 0.42, -height * 0.08, width * 1.05, -height * 0.47);
  ctx.closePath();
  ctx.fillStyle = bodyGradient;
  ctx.shadowBlur = 30 + targetStorm.glow * 25;
  ctx.shadowColor = themeRgba("primary", 0.34, palette);
  ctx.fill();
  ctx.restore();

  const floorGlow = ctx.createRadialGradient(targetStorm.x, baseY, 0, targetStorm.x, baseY, width * 1.15);
  floorGlow.addColorStop(0, themeRgba("primary", (0.14 + targetStorm.glow * 0.1) * targetStorm.opacity, palette));
  floorGlow.addColorStop(0.35, themeRgba("secondary", 0.06, palette));
  floorGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = floorGlow;
  ctx.fillRect(targetStorm.x - width * 1.3, baseY - width, width * 2.6, width * 2);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = targetStorm.opacity;
  ctx.strokeStyle = themeRgba("bright", 0.1 + targetStorm.glow * 0.08, palette);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(targetStorm.x, baseY, width * 0.68, width * 0.17, time * 0.0004, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSpiralBands(time, dimensions, targetStorm = storm) {
  const palette = getThemePalette();
  const { width, height } = dimensions;
  const localSpeed = targetStorm.speed;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = targetStorm.opacity;
  ctx.translate(targetStorm.x, targetStorm.y);
  ctx.rotate(targetStorm.tilt);

  const bandCount = reducedMotion ? 4 : 9;
  const segmentCount = reducedMotion ? 24 : 38;
  for (let band = 0; band < bandCount; band += 1) {
    ctx.beginPath();
    for (let segment = 0; segment <= segmentCount; segment += 1) {
      const h = segment / segmentCount;
      const profile = 0.15 + Math.pow(h, 1.55) * 0.95;
      const radius = width * profile * (0.72 + (band % 3) * 0.13);
      const theta =
        time * (0.00105 + localSpeed * 0.00125) +
        h * 10.8 +
        (band / bandCount) * Math.PI * 2;
      const x = Math.cos(theta) * radius;
      const y = lerp(height * 0.29, -height * 0.52, h);
      if (segment === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = band % 3 === 0 ? 1.15 : 0.55;
    ctx.strokeStyle =
      band % 4 === 0
        ? themeRgba("gold", 0.07 + localSpeed * 0.1, palette)
        : themeRgba("primary", 0.055 + localSpeed * 0.085, palette);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(dt, time, dimensions, targetStorm = storm) {
  const palette = getThemePalette();
  const { width, height } = dimensions;
  const localSpeed = targetStorm.speed;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = targetStorm.opacity;
  ctx.translate(targetStorm.x, targetStorm.y);
  ctx.rotate(targetStorm.tilt);

  for (const particle of particles) {
    const angularVelocity = (1.05 + localSpeed * 2.75) * particle.speed;
    particle.angle += angularVelocity * dt;
    particle.life += dt * (0.03 + particle.speed * 0.035);
    if (particle.life > 1) particle.life -= 1;

    const h = (particle.height + particle.life * 0.11) % 1;
    const y = lerp(height * 0.29, -height * 0.52, h);
    const profile = 0.13 + Math.pow(h, 1.55) * 0.96;
    const radius = width * profile * particle.radiusFactor;
    const turbulence = Math.sin(particle.phase + time * 0.0013 * particle.speed + h * 12) * width * 0.08;
    const theta = particle.angle + h * 9.4;
    const trailAngle = theta - (0.055 + localSpeed * 0.15) * particle.speed;
    particle.x = Math.cos(theta) * radius + turbulence;
    particle.y = y;
    particle.previousX = Math.cos(trailAngle) * radius + turbulence;
    particle.previousY = y + 0.8 + localSpeed * 1.8;
    particle.visibility = clamp(0.58 + Math.sin(theta) * 0.28, 0.2, 0.9) * particle.alpha;
  }

  function strokeParticleGroup(filter, color, lineWidth, opacity) {
    ctx.beginPath();
    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      if (!filter(particle)) continue;
      ctx.moveTo(particle.previousX, particle.previousY);
      ctx.lineTo(particle.x, particle.y);
    }
    ctx.globalAlpha = opacity * targetStorm.opacity;
    ctx.lineWidth = lineWidth + localSpeed * 0.35;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  strokeParticleGroup(
    (particle) => !particle.gold && particle.layer <= 0.42,
    palette.secondary,
    0.55,
    0.24 + localSpeed * 0.08,
  );
  strokeParticleGroup(
    (particle) => !particle.gold && particle.layer > 0.42,
    palette.primary,
    0.72,
    0.34 + localSpeed * 0.1,
  );
  strokeParticleGroup(
    (particle) => particle.gold,
    palette.gold,
    0.82,
    0.38 + localSpeed * 0.12,
  );

  ctx.globalAlpha = (0.46 + localSpeed * 0.18) * targetStorm.opacity;
  ctx.fillStyle = palette.bright;
  for (let index = 0; index < particles.length; index += 19) {
    const particle = particles[index];
    const size = 0.65 + particle.size * 0.4;
    ctx.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
  }
  ctx.restore();
}

function drawWisps(dt, time, dimensions, targetStorm = storm) {
  const palette = getThemePalette();
  const { width, height } = dimensions;
  const localSpeed = targetStorm.speed;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = targetStorm.opacity;
  ctx.translate(targetStorm.x, targetStorm.y);
  ctx.rotate(targetStorm.tilt);

  for (const wisp of wisps) {
    wisp.life -= dt;
    wisp.angle += dt * (1.1 + localSpeed * 2.4) * wisp.speed;
    if (wisp.life <= 0) resetWisp(wisp);
    const life = wisp.life / wisp.maxLife;
    const h = (wisp.height + (1 - life) * 0.28) % 1;
    const y = lerp(height * 0.28, -height * 0.5, h);
    const radius = width * (0.2 + h * h * 0.95) * wisp.radiusFactor;
    const arcLength = 0.72 + localSpeed * 0.85;
    ctx.beginPath();
    ctx.arc(0, y, radius, wisp.angle, wisp.angle + arcLength);
    ctx.lineWidth = 0.45 + life * 1.1;
    ctx.strokeStyle = wisp.gold
      ? themeRgba("gold", life * 0.27 * targetStorm.opacity, palette)
      : themeRgba("primary", life * 0.3 * targetStorm.opacity, palette);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDragonRibbon(time, dimensions, targetStorm = storm) {
  const palette = getThemePalette();
  const { width, height } = dimensions;
  const localSpeed = targetStorm.speed;
  const segments = 54;
  const points = [];
  const headProgress = (state.elapsed * (0.08 + localSpeed * 0.035)) % 1;

  for (let index = 0; index < segments; index += 1) {
    const tailOffset = index / segments;
    const progress = (headProgress - tailOffset * 0.28 + 1) % 1;
    const y = targetStorm.y + lerp(height * 0.22, -height * 0.45, progress);
    const profile = 0.2 + Math.pow(progress, 1.5) * 0.92;
    const phase = time * (0.0012 + localSpeed * 0.00055) - tailOffset * 5.4 + progress * 7;
    const x = targetStorm.x + Math.sin(phase) * width * profile * (0.86 + localSpeed * 0.12);
    points.push({ x, y, tailOffset });
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = targetStorm.opacity;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  const ribbonGradient = ctx.createLinearGradient(
    targetStorm.x,
    targetStorm.y + height * 0.2,
    targetStorm.x,
    targetStorm.y - height * 0.5,
  );
  ribbonGradient.addColorStop(0, themeRgba("gold", 0, palette));
  ribbonGradient.addColorStop(0.4, themeRgba("gold", 0.12 + targetStorm.glow * 0.13, palette));
  ribbonGradient.addColorStop(1, themeRgba("bright", 0.02, palette));
  ctx.lineWidth = 1.2 + localSpeed * 1.6;
  ctx.strokeStyle = ribbonGradient;
  ctx.shadowBlur = 14 + localSpeed * 12;
  ctx.shadowColor = palette.gold;
  ctx.stroke();

  const head = points[0];
  const next = points[3];
  const angle = Math.atan2(head.y - next.y, head.x - next.x);
  ctx.translate(head.x, head.y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.globalAlpha = (0.28 + targetStorm.glow * 0.2) * targetStorm.opacity;
  ctx.fillStyle = palette.gold;
  ctx.beginPath();
  ctx.moveTo(0, -8 - localSpeed * 4);
  ctx.quadraticCurveTo(8, -1, 4, 6);
  ctx.quadraticCurveTo(0, 3, -4, 6);
  ctx.quadraticCurveTo(-8, -1, 0, -8 - localSpeed * 4);
  ctx.fill();
  ctx.restore();
}

function drawFusionRings(time, dimensions, targetStorm = fusionStorm) {
  if (targetStorm.opacity <= 0.02) return;
  const palette = getThemePalette();
  const { width, height } = dimensions;
  const intensity = targetStorm.opacity;
  const ringCount = reducedMotion ? 4 : 7;
  const dotCount = reducedMotion ? 14 : Math.round(22 * state.quality);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(targetStorm.x, targetStorm.y);
  ctx.rotate(targetStorm.tilt * 0.45);
  ctx.lineCap = "round";

  for (let ring = 0; ring < ringCount; ring += 1) {
    const progress = ring / Math.max(1, ringCount - 1);
    const y = lerp(height * 0.28, -height * 0.52, progress);
    const radiusX = width * (1.15 + progress * 2.75) * (1.05 + intensity * 0.36);
    const radiusY = width * (0.18 + progress * 0.16);
    const spin = time * (0.00125 + targetStorm.speed * 0.0011) * (ring % 2 === 0 ? 1 : -1);
    const alpha = intensity * (0.055 + progress * 0.045);

    ctx.save();
    ctx.translate(0, y);
    ctx.rotate(spin + ring * 0.34);
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 0.8 + progress * 1.7 + intensity * 1.2;
    ctx.strokeStyle = ring % 3 === 1 ? palette.gold : palette.primary;
    ctx.shadowBlur = 12 + intensity * 18;
    ctx.shadowColor = ring % 3 === 1 ? palette.gold : palette.primary;
    ctx.stroke();

    const laneDots = Math.max(8, Math.round(dotCount * (0.78 + progress * 0.36)));
    ctx.beginPath();
    for (let dot = 0; dot < laneDots; dot += 1) {
      const angle =
        (dot / laneDots) * Math.PI * 2 +
        spin * (1.6 + progress) +
        hash(dot * 9.7 + ring * 3.1) * 0.22;
      const wobble = 0.82 + hash(dot * 4.3 + ring * 7.2) * 0.34;
      const x = Math.cos(angle) * radiusX * wobble;
      const dotY = Math.sin(angle) * radiusY * wobble;
      const size = 0.8 + progress * 1.5 + hash(dot * 12.5 + ring) * 1.6;
      ctx.rect(x - size / 2, dotY - size / 2, size, size);
    }
    ctx.globalAlpha = intensity * (0.14 + progress * 0.11);
    ctx.fillStyle = ring % 3 === 1 ? palette.gold : palette.bright;
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawFusionCore(time, dimensions, targetStorm = fusionStorm) {
  if (targetStorm.opacity <= 0.02) return;
  const palette = getThemePalette();
  const intensity = targetStorm.opacity;
  const { height } = dimensions;
  const width = dimensions.width * (1.24 + intensity * 0.38);
  const baseY = height * 0.3;
  const topY = -height * 0.56;
  const coreWidth = width * (0.82 + intensity * 0.42);

  ctx.save();
  ctx.translate(targetStorm.x, targetStorm.y);
  ctx.rotate(targetStorm.tilt);
  ctx.globalCompositeOperation = "lighter";

  const bodyGradient = ctx.createLinearGradient(0, topY, 0, baseY);
  bodyGradient.addColorStop(0, themeRgba("bright", 0.02 * intensity, palette));
  bodyGradient.addColorStop(0.38, themeRgba("primary", 0.12 * intensity, palette));
  bodyGradient.addColorStop(0.62, themeRgba("primary", 0.18 * intensity, palette));
  bodyGradient.addColorStop(0.86, themeRgba("gold", 0.08 * intensity, palette));
  bodyGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.save();
  ctx.globalAlpha = intensity;
  ctx.shadowBlur = 44 + intensity * 38;
  ctx.shadowColor = palette.primary;
  ctx.beginPath();
  ctx.moveTo(-coreWidth * 1.3, topY);
  ctx.bezierCurveTo(-coreWidth * 0.72, topY + height * 0.22, -coreWidth * 0.32, -height * 0.05, -coreWidth * 0.12, baseY);
  ctx.bezierCurveTo(coreWidth * 0.18, baseY + height * 0.04, coreWidth * 0.52, topY + height * 0.28, coreWidth * 1.34, topY);
  ctx.closePath();
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.restore();

  const bandCount = reducedMotion ? 8 : 16;
  const segmentCount = reducedMotion ? 30 : 54;
  for (let band = 0; band < bandCount; band += 1) {
    ctx.beginPath();
    for (let segment = 0; segment <= segmentCount; segment += 1) {
      const h = segment / segmentCount;
      const profile = 0.18 + Math.pow(h, 1.42) * (1.28 + intensity * 0.28);
      const radius = width * profile * (0.52 + (band % 4) * 0.12);
      const theta =
        time * (0.0016 + targetStorm.speed * 0.00145 + intensity * 0.00075) +
        h * (13.5 + intensity * 3.6) +
        (band / bandCount) * Math.PI * 2;
      const x = Math.cos(theta) * radius;
      const y = lerp(baseY, topY, h);
      if (segment === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const warm = band % 5 === 1;
    ctx.globalAlpha = intensity * (warm ? 0.22 : 0.34);
    ctx.lineWidth = warm ? 1.1 + intensity * 1.1 : 1.4 + intensity * 1.8;
    ctx.strokeStyle = warm ? palette.gold : palette.bright;
    ctx.shadowBlur = warm ? 18 : 24;
    ctx.shadowColor = warm ? palette.gold : palette.primary;
    ctx.stroke();
  }

  const eyeY = baseY - height * 0.03;
  const eyeGlow = ctx.createRadialGradient(0, eyeY, 0, 0, eyeY, width * 1.8);
  eyeGlow.addColorStop(0, themeRgba("bright", 0.22 * intensity, palette));
  eyeGlow.addColorStop(0.32, themeRgba("primary", 0.1 * intensity, palette));
  eyeGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = eyeGlow;
  ctx.fillRect(-width * 1.9, eyeY - width, width * 3.8, width * 2);

  ctx.restore();
}

function drawSparks(dt) {
  const palette = getThemePalette();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const spark of sparks) {
    spark.life -= dt;
    if (spark.life <= 0) resetSpark(spark);
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.vx *= Math.pow(0.45, dt);
    spark.vy -= 3 * dt;
  }

  for (const gold of [false, true]) {
    ctx.beginPath();
    for (const spark of sparks) {
      if (spark.gold !== gold) continue;
      const life = clamp(spark.life / spark.maxLife, 0, 1);
      const size = spark.size * (0.65 + life * 0.35);
      ctx.rect(spark.x, spark.y, size, size);
    }
    ctx.globalAlpha = 0.14 + state.speed * 0.24;
    ctx.fillStyle = gold ? palette.gold : palette.primary;
    ctx.fill();
  }
  ctx.restore();
}

function drawFrame(now) {
  if (!state.running) return;
  const frameMs = clamp(now - state.lastFrame, 1, 50);
  const dt = frameMs / 1000;
  state.lastFrame = now;
  state.elapsed += dt;
  state.frameEma = lerp(state.frameEma, frameMs, 0.045);
  const superstormLoad = state.superstormIntensity > 0.35;
  const qualityTarget = superstormLoad
    ? state.frameEma > 23
      ? 0.5
      : state.frameEma > 19.5
        ? 0.68
        : state.frameEma > 17.5
          ? 0.84
          : 1
    : state.frameEma > 23
      ? 0.64
      : state.frameEma > 19.5
        ? 0.8
        : 1;
  state.quality = lerp(state.quality, qualityTarget, 1 - Math.exp(-dt * 1.8));

  runHandDetection(now);
  updateStorm(dt, now);
  drawBackground(now);
  if (state.superstormIntensity < 0.72) {
    const visibleStorms = stormSlots.filter((slot) => slot.opacity > 0.025);
    const mergeFade = smoothstep(0.12, 0.95, state.mergeIntensity);
    const normalOpacityScale = 1 - mergeFade * 0.88;
    for (const visibleStorm of visibleStorms) {
      if (normalOpacityScale <= 0.04) continue;
      const originalOpacity = visibleStorm.opacity;
      visibleStorm.opacity *= normalOpacityScale;
      drawTrail(visibleStorm);
      const dimensions = stormDimensions(visibleStorm);
      drawVortexBody(now, dimensions, visibleStorm);
      drawSpiralBands(now, dimensions, visibleStorm);
      drawParticles(dt, now, dimensions, visibleStorm);
      drawWisps(dt, now, dimensions, visibleStorm);
      drawDragonRibbon(now, dimensions, visibleStorm);
      visibleStorm.opacity = originalOpacity;
    }
    if (fusionStorm.opacity > 0.025) {
      drawTrail(fusionStorm);
      const fusionDimensions = stormDimensions(fusionStorm);
      drawFusionRings(now, fusionDimensions, fusionStorm);
      drawVortexBody(now, fusionDimensions, fusionStorm);
      drawFusionCore(now, fusionDimensions, fusionStorm);
      drawSpiralBands(now, fusionDimensions, fusionStorm);
      drawParticles(dt, now, fusionDimensions, fusionStorm);
      drawWisps(dt, now, fusionDimensions, fusionStorm);
      drawDragonRibbon(now, fusionDimensions, fusionStorm);
      drawFusionCore(now + 420, fusionDimensions, fusionStorm);
      drawFusionRings(now + 800, fusionDimensions, fusionStorm);
    }
  }
  drawSuperstorm(dt, now);
  drawRain(dt);
  drawLightning(dt);
  if (state.superstormIntensity < 0.5) {
    drawSparks(dt);
  }

  animationId = requestAnimationFrame(drawFrame);
}

function openHelp() {
  ui.helpDrawer.classList.add("is-open");
  ui.helpDrawer.setAttribute("aria-hidden", "false");
}

function closeHelp() {
  ui.helpDrawer.classList.remove("is-open");
  ui.helpDrawer.setAttribute("aria-hidden", "true");
}

function toggleLiveSize() {
  const expanded = ui.cameraPanel.classList.toggle("is-expanded");
  ui.liveSizeToggle.textContent = expanded ? "↙" : "↗";
  ui.liveSizeToggle.setAttribute("aria-pressed", String(expanded));
  ui.liveSizeToggle.setAttribute("aria-label", expanded ? "缩小 LIVE 预览" : "放大 LIVE 预览");
  ui.liveSizeToggle.setAttribute("title", expanded ? "缩小 LIVE 预览" : "放大 LIVE 预览");
  resize();
}

function handleVisibility() {
  if (document.hidden) {
    state.running = false;
    cancelAnimationFrame(animationId);
    audio.rainElement?.pause();
    audio.context?.suspend().catch(() => {});
  } else if (!state.running) {
    state.running = true;
    state.lastFrame = performance.now();
    animationId = requestAnimationFrame(drawFrame);
    if (audioEnabled) audio.context?.resume().catch(() => {});
  }
}

ui.startButton.addEventListener("click", () => {
  ensureAudio().catch(() => {});
  startCamera();
});
ui.pointerOnlyButton.addEventListener("click", () => {
  ensureAudio().catch(() => {});
  usePointerMode();
});
ui.cameraToggle.addEventListener("click", () => {
  ensureAudio().catch(() => {});
  if (state.cameraActive) stopCamera();
  else startCamera();
});
ui.liveSizeToggle.addEventListener("click", toggleLiveSize);
ui.soundToggle.addEventListener("click", () => {
  const nextEnabled = !audioEnabled;
  if (!nextEnabled) {
    setAudioEnabled(false);
    return;
  }
  setAudioEnabled(true);
  ensureAudio()
    .then((available) => {
      if (!available) showToast("当前浏览器不支持风声音效。");
    })
    .catch(() => {
      setAudioEnabled(false, false);
      showToast("风声音效启动失败，请再次点击声音按钮。");
    });
});
ui.helpButton.addEventListener("click", openHelp);
ui.closeHelpButton.addEventListener("click", closeHelp);
ui.helpDrawer.addEventListener("click", (event) => {
  if (event.target === ui.helpDrawer) closeHelp();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeHelp();
    ui.introOverlay.classList.remove("is-visible");
  }
});
canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointermove", pointerMove);
canvas.addEventListener("pointerup", pointerUp);
canvas.addEventListener("pointercancel", pointerUp);
window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", handleVisibility);
window.addEventListener("beforeunload", () => {
  stopCamera(false);
  audio.context?.close().catch(() => {});
});

resize();
initializeRain();
ensureParticleCounts();
setControlSource("pointer");
document.body.dataset.theme = state.themeMode;
updateSoundButton();
animationId = requestAnimationFrame(drawFrame);
