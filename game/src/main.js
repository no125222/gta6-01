// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. Screens: title,
// play, paused, game over (WASTED) and win. Progress (cash, mission, day)
// saves to localStorage automatically; Continue resumes it.
//
// ?seed=N fixes the city and traffic. ?shot=chase|street|harbor|title (with
// &seed=N) stages that scene instead of running the loop, paints it and sets
// window.__shotReady for a screenshot.
import { STEP, SAVE_KEY, BEST_KEY, MISSIONS } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_OVER, EVENT_BUSTED, EVENT_MISSION, EVENT_CRASH } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const SAVE_EVERY_SECONDS = 10;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed), seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function writeSave() {
  try {
    const s = world.state;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: s.cash, missionIndex: s.missionIndex, day: s.day,
      carsStolen: s.carsStolen, kills: s.kills,
    }));
    if (s.cash > readBest()) window.localStorage.setItem(BEST_KEY, String(s.cash));
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}

function applySave(save) {
  if (!save) return;
  world.state.cash = save.cash || 0;
  world.state.day = save.day || 1;
  world.state.carsStolen = save.carsStolen || 0;
  world.state.kills = save.kills || 0;
  const index = Math.max(0, Math.min(MISSIONS.length - 1, save.missionIndex || 0));
  world.startMission(index);
  world.state.missionIndex = index;
}

function mouseToWorld(clientX, clientY) {
  const ratio = window.devicePixelRatio || 1;
  const w = window.innerWidth * ratio;
  const h = window.innerHeight * ratio;
  const scale = Math.max(w / 1280, h / 720);
  const ox = (w - 1280 * scale) / 2;
  const oy = (h - 720 * scale) / 2;
  const s = world.state;
  return {
    x: s.camera.x + (clientX * ratio - ox) / scale,
    y: s.camera.y + (clientY * ratio - oy) / scale,
  };
}

function runShot(name) {
  const scene = stageShot(name, world);
  const ui = { best: 0, hasSave: false, showHelp: false };
  renderer.draw(world, scene.screen, ui);
  renderer.draw(world, scene.screen, ui);
  window.__shotReady = true;
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let save = readSave();
  let showHelp = false;
  let saveTimer = 0;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    world.reset();
    save = null;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Follow the yellow marker.');
  }

  function continueGame() {
    world.reset();
    applySave(save);
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Continuing your save.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.busted();
    audio.setEngine(false, 0);
    writeSave();
    announce(`Wasted. Cash kept $${world.state.cash}. Press Enter to try again.`);
  }

  function winGame() {
    screen = SCREEN_WIN;
    audio.missionDone();
    writeSave();
  }

  function handleTitleKeys(event) {
    if (event.code === 'Digit1') startNewGame();
    else if (event.code === 'Digit2' && save) continueGame();
    else if (event.code === 'Digit3' || event.code === 'KeyH') showHelp = !showHelp;
  }

  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_TITLE) handleTitleKeys(event);
    if (event.code === 'KeyM' && !event.repeat) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (event.code === 'KeyR' && screen === SCREEN_PAUSED) {
      world.startMission(world.state.missionIndex);
      screen = SCREEN_PLAY;
    }
  });

  function readInput() {
    const mouse = input.mouse();
    const mw = mouseToWorld(mouse.x, mouse.y);
    return {
      up: input.up(), down: input.down(), left: input.left(), right: input.right(),
      sprint: input.sprint(), brake: input.brake(),
      enter: false, punch: false, click: input.takeClick(),
      mouse: mw, horn: false,
    };
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) {
        if (save) continueGame();
        else startNewGame();
      } else if (screen === SCREEN_OVER) {
        startNewGame();
      } else if (screen === SCREEN_WIN) {
        screen = SCREEN_PLAY;
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        audio.setEngine(false, 0);
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      // Ambient city life behind the title.
      world.step(STEP, { up: false, down: false, left: false, right: false, sprint: false, brake: false, enter: false, punch: false, click: false, mouse: null });
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const frameInput = readInput();
    frameInput.enter = Boolean(actions & ACTION_ENTER);
    frameInput.punch = Boolean(actions & ACTION_PUNCH);
    frameInput.horn = false;
    const events = world.step(STEP, frameInput);
    const p = world.state.player;
    audio.setEngine(!p.onFoot && p.car !== null, p.car ? Math.abs(p.car.speed) / 560 : 0);
    if (events & EVENT_MISSION) {
      audio.missionDone();
      writeSave();
      if (world.state.gameWon) winGame();
    }
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_BUSTED) {
      audio.busted();
      screen = SCREEN_PLAY;
      announce('Busted! The cops dropped you at the safehouse.');
    }
    if (events & EVENT_OVER) endGame();
    saveTimer += STEP;
    if (saveTimer > SAVE_EVERY_SECONDS) {
      saveTimer = 0;
      writeSave();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    let firstStep = true;
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step(firstStep ? actions : 0);
      firstStep = false;
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    const p = world.state.player;
    const hint = screen === SCREEN_PLAY
      ? (p.onFoot ? 'E — enter car   •   Click — shoot   •   F — punch' : 'WASD — drive   •   E — get out   •   Space — brake')
      : '';
    renderer.draw(world, screen, { best, hasSave: Boolean(save), showHelp, hint });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  canvas.addEventListener('pointerdown', () => audio.unlock());

  announce('Solmar: Streets of the Sun. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
