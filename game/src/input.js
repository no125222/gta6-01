// Keyboard and mouse input. Held keys steer; one-shot presses (enter car,
// punch, pause, confirm, horn) are queued as flags and taken once by the loop.
export const ACTION_ENTER = 1;
export const ACTION_PUNCH = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_HORN = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const BRAKE = new Set(['Space']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function press(code) {
    if (code === 'KeyE') actions |= ACTION_ENTER;
    else if (code === 'KeyF') actions |= ACTION_PUNCH;
    else if (code === 'KeyP' || code === 'Escape') actions |= ACTION_PAUSE;
    else if (code === 'Enter') actions |= ACTION_CONFIRM;
    else if (code === 'KeyH') actions |= ACTION_HORN;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) ||
        RIGHT.has(event.code) || SPRINT.has(event.code) || BRAKE.has(event.code) ||
        event.code === 'Space') {
      event.preventDefault();
    }
    if (!event.repeat) press(event.code);
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    mouseClicked = true;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  function held(set) {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  }

  return {
    up: () => held(UP),
    down: () => held(DOWN),
    left: () => held(LEFT),
    right: () => held(RIGHT),
    sprint: () => held(SPRINT),
    brake: () => held(BRAKE),
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
