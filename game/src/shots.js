// Screenshot scenes: each one plays the real rules forward from a fresh
// world for a fixed number of steps, steered by a simple autopilot, so the
// frame is what real play looks like and the same seed always gives the same
// frame. The cover is a police chase; the others show the city on foot, a
// mission at the harbor, and the title screen.
import { STEP } from './config.js';
import { nextRoadWaypoint } from './city.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { EVENT_OVER, EVENT_BUSTED } from './world.js';

const SAMPLE = STEP;

/** Drive toward a point along the roads: follow the road router, and slow
 * down for sharp turns so the car can make them inside the street. */
function driveToward(world, tx, ty) {
  const p = world.state.player;
  const car = p.car;
  const input = { up: true, down: false, left: false, right: false, sprint: false, brake: false, enter: false, punch: false, click: false, mouse: null };
  if (!car) return input;
  const wp = nextRoadWaypoint(car.x, car.y, tx, ty);
  const target = Math.atan2(wp.y - car.y, wp.x - car.x);
  let diff = target - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > 0.15) input.left = true;
  else if (diff < -0.15) input.right = true;
  const d = Math.hypot(tx - car.x, ty - car.y);
  if (Math.abs(diff) > 0.9) {
    // Sharp turn ahead: creep forward so the steering bites, and keep it
    // slow so the turn fits inside the street.
    input.up = true;
    input.brake = Math.abs(car.speed) > 180;
  } else if (d < 140) {
    input.up = false;
  }
  return input;
}

/** Walk toward a point. */
function walkToward(world, tx, ty) {
  const p = world.state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  return {
    up: dy < -20, down: dy > 20, left: dx < -20, right: dx > 20,
    sprint: true, brake: false, enter: false, punch: false, click: false,
    mouse: { x: tx, y: ty },
  };
}

function stepN(world, seconds, inputFn) {
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    const events = world.step(SAMPLE, inputFn(world));
    if (events & (EVENT_OVER | EVENT_BUSTED)) break;
  }
}

function enterNearestCar(world) {
  const p = world.state.player;
  const car = world.nearestCar(p.x, p.y, 300);
  if (car) {
    p.x = car.x; p.y = car.y;
    world.step(SAMPLE, { up: false, down: false, left: false, right: false, sprint: false, brake: false, enter: true, punch: false, click: false, mouse: null });
  }
  return world.state.player.car;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Scenes: chase (cover), street, harbor, title.
 */
export function stageShot(name, world) {
  world.reset();
  const s = world.state;
  if (name === 'title') {
    for (let i = 0; i < 6 / SAMPLE; i += 1) {
      world.step(SAMPLE, { up: false, down: false, left: false, right: false, sprint: false, brake: false, enter: false, punch: false, click: false, mouse: null });
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'street') {
    // On foot downtown, mission 1 active, traffic and pedestrians around.
    s.player.x = 2400; s.player.y = 1600;
    s.camera.x = Math.max(0, s.player.x - 640);
    s.camera.y = Math.max(0, s.player.y - 360);
    stepN(world, 9, (w) => walkToward(w, 2330, 1530));
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'harbor') {
    // Mission 5 staged: the crate truck at the docks, wanted 2, police closing in.
    world.startMission(4);
    // Drive the first two steps instantly: reach the harbor, take the truck.
    const truck = world.state.cars.find((c) => c.kind === 'truck');
    if (truck) {
      s.player.x = truck.x; s.player.y = truck.y;
      enterNearestCar(world);
    }
    stepN(world, 4, (w) => {
      const target = w.missionTarget();
      return target ? driveToward(w, target.x, target.y) : driveToward(w, 4000, 3200);
    });
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // Default: chase — the cover. Mission 4's heat: wanted 3, police on the tail,
  // player driving downtown toward the safehouse with the HUD and minimap live.
  world.startMission(3);
  s.wanted = 3;
  s.wantedTimer = 26;
  enterNearestCar(world);
  if (!s.player.car) {
    // Fallback: put the player in the nearest car by hand.
    const car = world.nearestCar(s.player.x, s.player.y, 2000);
    if (car) { s.player.x = car.x; s.player.y = car.y; enterNearestCar(world); }
  }
  // Cross-city getaway: drive the long way across Solmar with the heat on,
  // so the frame catches the car at speed with the cruisers on its tail.
  stepN(world, 16, (w) => driveToward(w, 3600, 2400));
  return { screen: SCREEN_PLAY, best: 0 };
}
