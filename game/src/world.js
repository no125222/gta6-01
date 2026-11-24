// Solmar's simulation: the player on foot and in cars, traffic, pedestrians,
// police, combat, the wanted system and the six-mission story. One fixed step
// (1/60 s) advances everything; the renderer only draws state, it never
// changes it. Input arrives as a plain object so the screenshot stager can
// drive the same world with a scripted autopilot.
import {
  STEP, WORLD, ROAD, PLAYER, CAR, POLICE, WANTED, TRAFFIC_COUNT, PED_COUNT,
  MISSIONS, CAR_COLORS, PED_SHIRTS,
} from './config.js';
import { createCity, collideBuildings, clampWorld, roadXs, roadYs, districtAt, nextRoadWaypoint } from './city.js';

export const EVENT_NONE = 0;
export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_BUSTED = 4;
export const EVENT_MISSION = 8;
export const EVENT_CRASH = 16;
export const EVENT_CRIME = 32;

let nextCarId = 1;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function nearestRoadPoint(x, y) {
  // Snap to the closest road centre line.
  let bestX = roadXs()[0];
  let bestD = Infinity;
  for (const rx of roadXs()) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; bestX = rx; }
  }
  let bestY = roadYs()[0];
  bestD = Infinity;
  for (const ry of roadYs()) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; bestY = ry; }
  }
  return Math.abs(x - bestX) < Math.abs(y - bestY) ? { x: bestX, y } : { x, y: bestY };
}

export function createWorld(random, seed) {
  const city = createCity(random);
  const state = {};
  let resetCount = 0;

  function makeCar(x, y, angle, kind, color, driver) {
    return {
      id: nextCarId, x, y, angle, speed: 0, color,
      kind: kind || 'sedan', driver: driver || null,
      parked: driver === null,
      roadAxis: 'x', roadLine: x, dir: 1, targetSpeed: 150,
      damage: 0, horn: 0,
    };
  }

  function spawnTrafficCar() {
    const vertical = random.chance(0.5);
    const xs = roadXs();
    const ys = roadYs();
    let car;
    if (vertical) {
      const x = xs[random.int(0, xs.length - 1)];
      const y = random.range(300, WORLD.height - 300);
      car = makeCar(x + 18, y, random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2, 'sedan', random.pick(CAR_COLORS), 'traffic');
      car.roadAxis = 'y'; car.roadLine = x + 18; car.dir = car.angle > 0 ? 1 : -1;
    } else {
      const y = ys[random.int(0, ys.length - 1)];
      const x = random.range(300, WORLD.width - 300);
      car = makeCar(x, y + 18, random.chance(0.5) ? 0 : Math.PI, 'sedan', random.pick(CAR_COLORS), 'traffic');
      car.roadAxis = 'x'; car.roadLine = y + 18; car.dir = car.angle === 0 ? 1 : -1;
    }
    car.targetSpeed = random.range(120, 190);
    return car;
  }

  function spawnPed(x, y) {
    const p = nearestRoadPoint(x !== undefined ? x : random.range(400, WORLD.width - 400),
      y !== undefined ? y : random.range(400, WORLD.height - 400));
    return {
      x: p.x + random.range(-70, 70), y: p.y + random.range(-70, 70),
      angle: random.range(0, Math.PI * 2), speed: random.range(45, 75),
      shirt: random.pick(PED_SHIRTS), state: 'walk', health: 30,
      fleeX: 0, fleeY: 0, targetX: 0, targetY: 0, wait: 0,
    };
  }

  function placeOnRoad(x, y) {
    const p = nearestRoadPoint(x, y);
    return { x: p.x, y: p.y };
  }

  function reset() {
    resetCount += 1;
    nextCarId = 1;
    state.time = 0;
    state.clockMinutes = 16 * 60 + 20;
    state.day = 1;
    state.cash = 120;
    state.missionIndex = 0;
    state.missionStep = 0;
    state.missionTimer = 0;
    state.missionDone = false;
    state.gameWon = false;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.shake = 0;
    state.bustTimer = 0;
    state.kills = 0;
    state.carsStolen = 0;
    state.faresDone = 0;
    state.taxiStage = 'pickup';
    state.taxiRider = null;
    state.taxiTarget = null;
    state.dropsCollected = 0;
    state.banner = null;
    state.bannerTime = 0;
    state.toast = '';
    state.toastTime = 0;
    state.hint = '';
    state.camera = { x: 0, y: 0 };
    state.bullets = [];
    state.particles = [];
    state.cops = [];
    state.policeCars = [];
    state.pickups = [];
    state.cars = [];
    state.peds = [];

    const home = city.places.safehouse;
    state.player = {
      x: home.x, y: home.y, angle: -Math.PI / 2, health: PLAYER.maxHealth,
      armor: PLAYER.maxArmor, ammo: 24, onFoot: true, car: null,
      speed: 0, moving: false, punchTimer: 0, invuln: 0,
    };

    // Parked cars on the roads (offset into the driving lane, never inside a
    // building): one by the safehouse and a few scattered across Solmar.
    const parkedSpots = [
      { x: 1218, y: 640, angle: Math.PI / 2, color: '#c0392b' },
      { x: 1618, y: 418, angle: 0, color: '#2980b9' },
      { x: 2418, y: 840, angle: Math.PI / 2, color: '#f39c12' },
      { x: 3218, y: 1218, angle: 0, color: '#27ae60' },
      { x: 1218, y: 2018, angle: -Math.PI / 2, color: '#8e44ad' },
      { x: 4018, y: 1618, angle: 0, color: '#e67e22' },
      { x: 818, y: 2818, angle: Math.PI / 2, color: '#16a085' },
      { x: 3618, y: 2818, angle: 0, color: '#2c3e50' },
    ];
    for (const s of parkedSpots) {
      state.cars.push(makeCar(s.x, s.y, s.angle, 'sedan', s.color, null));
    }
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) state.cars.push(spawnTrafficCar());
    for (let i = 0; i < PED_COUNT; i += 1) state.peds.push(spawnPed());

    // Ambient pickups: cash bags, health kits, armor vests.
    const pickupSpots = [
      { x: 1400, y: 1000, kind: 'cash', amount: 60 },
      { x: 2800, y: 2000, kind: 'cash', amount: 80 },
      { x: 4000, y: 600, kind: 'cash', amount: 70 },
      { x: 600, y: 2400, kind: 'cash', amount: 50 },
      { x: 3600, y: 2000, kind: 'cash', amount: 90 },
      { x: 2000, y: 2800, kind: 'health', amount: 50 },
      { x: 3200, y: 400, kind: 'health', amount: 50 },
      { x: 1200, y: 800, kind: 'armor', amount: 50 },
      { x: 4400, y: 1200, kind: 'armor', amount: 50 },
      { x: 2400, y: 2400, kind: 'ammo', amount: 24 },
    ];
    for (const p of pickupSpots) state.pickups.push({ ...p, bob: random.range(0, 6) });
    state.district = 'Safehouse';
    state.mission = MISSIONS[0];
    startMission(0);
    updateDistrict();
  }

  function updateDistrict() {
    state.district = districtAt(state.player.x, state.player.y);
  }

  function showBanner(title, sub) {
    state.banner = { title, sub: sub || '' };
    state.bannerTime = 3.2;
  }

  function showToast(text) {
    state.toast = text;
    state.toastTime = 3;
  }

  function addWanted(n) {
    const before = state.wanted;
    state.wanted = Math.min(5, state.wanted + n);
    state.wantedTimer = WANTED.decaySeconds;
    if (state.wanted > before) state.events = (state.events || 0) | EVENT_CRIME;
  }

  function startMission(index) {
    const mission = MISSIONS[index];
    if (!mission) {
      state.mission = null;
      return;
    }
    state.missionIndex = index;
    state.mission = mission;
    state.missionStep = 0;
    state.missionTimer = 0;
    state.taxiStage = 'pickup';
    state.faresDone = 0;
    state.dropsCollected = 0;
    if (mission.startWanted) {
      state.wanted = Math.max(state.wanted, mission.startWanted);
      state.wantedTimer = WANTED.decaySeconds;
    }
    showBanner(mission.title, `${mission.giver}: ${mission.brief}`);
    setupStep();
  }

  function setupStep() {
    const step = currentStep();
    if (!step) return;
    if (step.type === 'deliver' || step.type === 'survive') state.missionTimer = step.time || 60;
    if (step.type === 'taxi') {
      state.taxiStage = 'pickup';
      state.taxiTarget = randomRoadPointNear(state.player.x, state.player.y, 500, 1100);
      state.taxiRider = null;
    }
    if (step.type === 'pickup' && step.place === 'drops') {
      for (const d of city.places.drops) {
        state.pickups.push({ x: d.x, y: d.y, kind: 'drop', amount: 0, bob: 0 });
      }
    }
    if (state.mission && state.mission.id === 'm5' && step.type === 'goto') {
      // The crate truck waits at the Harbor.
      const h = city.places.harbor;
      const truck = makeCar(h.x + 40, h.y - 30, Math.PI / 2, 'truck', '#d35400', null);
      state.cars.push(truck);
      state.truckId = truck.id;
    }
  }

  function currentStep() {
    if (!state.mission) return null;
    return state.mission.steps[state.missionStep] || null;
  }

  function randomRoadPointNear(x, y, minD, maxD) {
    for (let tries = 0; tries < 20; tries += 1) {
      const p = placeOnRoad(
        x + random.range(-maxD, maxD),
        y + random.range(-maxD, maxD),
      );
      const d = dist(x, y, p.x, p.y);
      if (d > minD && d < maxD && p.x > 300 && p.x < WORLD.width - 100 && p.y > 300 && p.y < WORLD.height - 100) {
        return p;
      }
    }
    return placeOnRoad(x + 600, y);
  }

  function missionTarget() {
    const step = currentStep();
    if (!step) return null;
    if (step.type === 'taxi') {
      if (!state.taxiTarget) return null;
      return { x: state.taxiTarget.x, y: state.taxiTarget.y, label: state.taxiStage === 'pickup' ? 'Pick up fare' : 'Drop off fare' };
    }
    if (step.type === 'pickup' && step.place === 'drops') {
      const drop = state.pickups.find((p) => p.kind === 'drop');
      return drop ? { x: drop.x, y: drop.y, label: 'Drop' } : null;
    }
    if (step.place === 'anyCar' || step.place === 'truck') return null;
    const place = city.places[step.place];
    if (!place) return null;
    // Markers sit on the road outside the place, so a driver can reach them.
    const road = nearestRoadPoint(place.x, place.y);
    return { x: road.x, y: road.y, label: place.label || step.text };
  }

  function advanceStep() {
    state.missionStep += 1;
    if (state.missionStep >= state.mission.steps.length) {
      completeMission();
    } else {
      const step = currentStep();
      showToast(step.text);
      setupStep();
    }
  }

  function completeMission() {
    const mission = state.mission;
    state.cash += mission.reward;
    state.missionDone = true;
    state.events = (state.events || 0) | EVENT_MISSION;
    showBanner('MISSION COMPLETE', `${mission.title}  •  +$${mission.reward}`);
    state.missionIndex += 1;
    if (state.missionIndex >= MISSIONS.length) {
      state.gameWon = true;
      state.mission = null;
      showBanner('KING OF SOLMAR', 'Every crew in the city answers to you now. Free roam — Solmar is yours.');
    } else {
      startMission(state.missionIndex);
    }
  }

  function failMission(reason) {
    showBanner('MISSION FAILED', reason);
    state.missionStep = 0;
    state.wanted = Math.max(0, state.wanted - 1);
    setupStep();
  }

  function spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, Math.PI * 2);
      const s = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: random.range(0.3, 0.8), maxLife: 0.8, color, size: random.range(2, 5),
      });
    }
  }

  function damagePlayer(amount) {
    const p = state.player;
    if (p.invuln > 0) return;
    let left = amount;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, left * 0.6);
      p.armor -= absorbed;
      left -= absorbed;
    }
    p.health -= left;
    p.invuln = 0.35;
    state.shake = Math.min(10, state.shake + 5);
  }

  function nearestCar(x, y, maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of state.cars) {
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar(car) {
    const p = state.player;
    if (!car) return;
    if (car.driver === 'traffic') {
      // Jack the car: its driver flees on foot, and witnesses call the cops.
      state.carsStolen += 1;
      const driver = spawnPed(car.x + 30, car.y + 30);
      driver.state = 'flee';
      driver.fleeX = p.x; driver.fleeY = p.y;
      state.peds.push(driver);
      let witnessed = false;
      for (const ped of state.peds) {
        if (dist(ped.x, ped.y, car.x, car.y) < 320) witnessed = true;
      }
      for (const cop of state.cops) {
        if (dist(cop.x, cop.y, car.x, car.y) < 420) witnessed = true;
      }
      if (witnessed) addWanted(WANTED.starsForSteal);
      showToast(witnessed ? 'Car jacked! Someone called the cops!' : 'Car jacked. Keep it quiet.');
    }
    car.driver = 'player';
    car.parked = false;
    p.car = car;
    p.onFoot = false;
    p.x = car.x; p.y = car.y;
    showToast(car.kind === 'truck' ? 'You took the crate truck. Go!' : 'In the car. Drive!');
  }

  function exitCar() {
    const p = state.player;
    const car = p.car;
    if (!car) return;
    car.driver = null;
    car.parked = true;
    car.speed = 0;
    p.car = null;
    p.onFoot = true;
    const side = { x: p.x + Math.cos(car.angle + Math.PI / 2) * 34, y: p.y + Math.sin(car.angle + Math.PI / 2) * 34 };
    const fixed = collideBuildings(city, side.x, side.y, PLAYER.radius + 2);
    p.x = fixed.x; p.y = fixed.y;
    p.angle = car.angle;
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    p.punchTimer = Math.max(0, p.punchTimer - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    if (p.onFoot) {
      let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      const len = Math.hypot(mx, my);
      if (len > 0) {
        mx /= len; my /= len;
        const speed = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
        p.x += mx * speed * dt;
        p.y += my * speed * dt;
        p.angle = Math.atan2(my, mx);
        p.moving = true;
        p.speed = speed;
      } else {
        p.moving = false;
        p.speed = 0;
      }
      // Aim at the mouse when shooting.
      if (input.mouse) p.angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
      const fixed = collideBuildings(city, p.x, p.y, PLAYER.radius);
      p.x = fixed.x; p.y = fixed.y;
      const clamped = clampWorld(p.x, p.y, PLAYER.radius);
      p.x = clamped.x; p.y = clamped.y;
      if (input.punch && p.punchTimer <= 0) {
        p.punchTimer = PLAYER.punchCooldown;
        punch();
      }
      if (input.click) shoot();
    } else if (p.car) {
      driveCar(p.car, dt, input, true);
      p.x = p.car.x; p.y = p.car.y; p.angle = p.car.angle;
      p.speed = Math.abs(p.car.speed);
      p.moving = p.speed > 20;
      if (input.horn && p.car.horn <= 0) {
        p.car.horn = 0.4;
        state.events = (state.events || 0);
      }
    }
    if (input.enter) {
      if (p.onFoot) {
        const car = nearestCar(p.x, p.y, 64);
        if (car && car.kind !== 'police') enterCar(car);
      } else {
        exitCar();
      }
    }
  }

  function punch() {
    const p = state.player;
    const px = p.x + Math.cos(p.angle) * PLAYER.punchRange;
    const py = p.y + Math.sin(p.angle) * PLAYER.punchRange;
    let hitAny = false;
    for (const ped of state.peds) {
      if (ped.health > 0 && dist(px, py, ped.x, ped.y) < 26) {
        ped.health -= PLAYER.punchDamage;
        ped.state = 'flee'; ped.fleeX = p.x; ped.fleeY = p.y;
        spawnParticles(ped.x, ped.y, '#ff7675', 6, 120);
        hitAny = true;
        if (ped.health <= 0) killPed(ped, false);
      }
    }
    for (const cop of state.cops) {
      if (dist(px, py, cop.x, cop.y) < 26) {
        cop.health -= PLAYER.punchDamage;
        if (cop.health <= 0) killCop(cop);
        hitAny = true;
      }
    }
    if (!hitAny) spawnParticles(px, py, '#ffffff', 3, 60);
  }

  function shoot() {
    const p = state.player;
    if (p.ammo <= 0) {
      showToast('Out of ammo — find an ammo pickup (green crate).');
      return;
    }
    p.ammo -= 1;
    const a = p.angle;
    const bx = p.x + Math.cos(a) * 20;
    const by = p.y + Math.sin(a) * 20;
    state.bullets.push({
      x: bx, y: by, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900,
      life: 0.6, fromPlayer: true,
    });
    state.shake = Math.min(8, state.shake + 1.5);
    addWanted(0);
    state.wantedTimer = WANTED.decaySeconds;
    // A gunshot in earshot raises the heat.
    let heard = false;
    for (const ped of state.peds) if (dist(ped.x, ped.y, p.x, p.y) < 420) heard = true;
    for (const cop of state.cops) if (dist(cop.x, cop.y, p.x, p.y) < 500) heard = true;
    if (heard && state.wanted === 0) addWanted(WANTED.starsForShoot);
  }

  function killPed(ped, byCar) {
    ped.health = 0;
    state.kills += 1;
    spawnParticles(ped.x, ped.y, '#e5534b', 14, 160);
    if (!byCar) addWanted(WANTED.starsForKill);
  }

  function killCop(cop) {
    cop.health = 0;
    state.kills += 1;
    spawnParticles(cop.x, cop.y, '#2f6fd0', 14, 160);
    addWanted(WANTED.starsForCopKill);
  }

  function driveCar(car, dt, input, isPlayer) {
    let throttle = 0;
    if (input.up) throttle = 1;
    else if (input.down) throttle = -1;
    const steering = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    // Note: steering sign flips when reversing, like a real car.
    const dir = car.speed >= 0 ? 1 : -1;
    if (throttle > 0) car.speed += CAR.accel * dt;
    else if (throttle < 0) {
      if (car.speed > 5) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    } else {
      car.speed -= car.speed * CAR.drag * dt;
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    if (input.brake) {
      car.speed -= Math.sign(car.speed) * CAR.brake * dt * 0.8;
      if (Math.abs(car.speed) < 10) car.speed = 0;
    }
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    const steerAmount = steering * CAR.steer * dt * Math.min(1, Math.abs(car.speed) / 140) * dir;
    car.angle += steerAmount;
    // Slight drift: velocity lags the heading at speed.
    const vx = Math.cos(car.angle) * car.speed;
    const vy = Math.sin(car.angle) * car.speed;
    car.x += vx * dt;
    car.y += vy * dt;
    const fixed = collideBuildings(city, car.x, car.y, 22);
    if (fixed.hit) {
      if (Math.abs(car.speed) > 240) {
        state.events = (state.events || 0) | EVENT_CRASH;
        spawnParticles(car.x, car.y, '#f2c94c', 10, 200);
        if (isPlayer) damagePlayer(6);
        state.shake = Math.min(10, state.shake + 4);
      }
      car.x = fixed.x; car.y = fixed.y;
      car.speed *= 0.45;
    }
    const clamped = clampWorld(car.x, car.y, 24);
    car.x = clamped.x; car.y = clamped.y;
    car.horn = Math.max(0, (car.horn || 0) - dt);
  }

  function stepTraffic(dt) {
    const xs = roadXs();
    const ys = roadYs();
    for (const car of state.cars) {
      if (car.driver !== 'traffic') continue;
      // Car ahead? Slow down. (The player on foot counts too — traffic
      // brakes for them instead of running them down.)
      let blocked = false;
      for (const other of state.cars) {
        if (other === car) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (ahead > 0 && ahead < 64 && side < 26) blocked = true;
      }
      const p0 = state.player;
      if (p0.onFoot) {
        const dx = p0.x - car.x;
        const dy = p0.y - car.y;
        const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (ahead > 0 && ahead < 110 && side < 28) blocked = true;
      }
      const target = blocked ? 0 : car.targetSpeed;
      car.speed += Math.max(-260 * dt, Math.min(260 * dt, target - car.speed));
      const stepLen = car.speed * dt;
      let nx = car.x + Math.cos(car.angle) * stepLen;
      let ny = car.y + Math.sin(car.angle) * stepLen;
      // At an intersection, sometimes turn onto the cross road.
      const nearX = xs.some((rx) => Math.abs(nx - rx) < 26 && Math.abs(ny - car.roadLine) < 200);
      const nearY = ys.some((ry) => Math.abs(ny - ry) < 26);
      if ((nearX || nearY) && random.chance(dt * 0.5)) {
        if (car.roadAxis === 'y') {
          const ry = ys.reduce((a, b) => (Math.abs(b - ny) < Math.abs(a - ny) ? b : a));
          car.roadAxis = 'x'; car.roadLine = ry + 18;
          car.angle = random.chance(0.5) ? 0 : Math.PI;
          car.dir = car.angle === 0 ? 1 : -1;
          ny = ry + 18;
        } else {
          const rx = xs.reduce((a, b) => (Math.abs(b - nx) < Math.abs(a - nx) ? b : a));
          car.roadAxis = 'y'; car.roadLine = rx + 18;
          car.angle = random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
          car.dir = car.angle > 0 ? 1 : -1;
          nx = rx + 18;
        }
      }
      car.x = nx; car.y = ny;
      // Keep inside the world; turn around at the edge roads.
      if (car.x < 320 || car.x > WORLD.width - 320 || car.y < 320 || car.y > WORLD.height - 320) {
        car.angle += Math.PI;
        car.dir *= -1;
      }
      // Hit a pedestrian? The driver brakes hard and the ped flees.
      for (const ped of state.peds) {
        if (ped.health > 0 && ped.state !== 'rider' && dist(car.x, car.y, ped.x, ped.y) < 26) {
          ped.state = 'flee'; ped.fleeX = car.x; ped.fleeY = car.y;
          car.speed *= 0.3;
        }
      }
      // Hit the player's car?
      const pc = state.player.car;
      if (pc && pc !== car && dist(car.x, car.y, pc.x, pc.y) < 40) {
        car.speed *= 0.4;
        pc.speed *= 0.7;
        state.events = (state.events || 0) | EVENT_CRASH;
        spawnParticles((car.x + pc.x) / 2, (car.y + pc.y) / 2, '#f2c94c', 6, 140);
      }
      // Run over the player on foot: shove them aside and hurt them once per
      // contact (the invulnerability window stops a death spiral).
      const p = state.player;
      if (p.onFoot && dist(car.x, car.y, p.x, p.y) < 26) {
        damagePlayer(6);
        const a = Math.atan2(p.y - car.y, p.x - car.x);
        p.x += Math.cos(a) * 40;
        p.y += Math.sin(a) * 40;
        car.speed *= 0.2;
      }
    }
  }

  function stepPeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.health <= 0) continue;
      if (ped.state === 'rider') {
        // Riding in the player's car.
        if (p.car) { ped.x = p.car.x; ped.y = p.car.y; }
        continue;
      }
      if (ped.state === 'flee') {
        const a = angleTo(ped.fleeX, ped.fleeY, ped.x, ped.y);
        ped.angle = a;
        ped.x += Math.cos(a) * 170 * dt;
        ped.y += Math.sin(a) * 170 * dt;
        if (dist(ped.x, ped.y, ped.fleeX, ped.fleeY) > 500) ped.state = 'walk';
      } else {
        // Stroll along the sidewalk; turn at random.
        ped.wait -= dt;
        if (ped.wait <= 0) {
          ped.wait = random.range(2, 6);
          if (random.chance(0.4)) ped.angle += random.pick([-Math.PI / 2, Math.PI / 2, Math.PI]);
        }
        const speed = ped.speed;
        let nx = ped.x + Math.cos(ped.angle) * speed * dt;
        let ny = ped.y + Math.sin(ped.angle) * speed * dt;
        const fixed = collideBuildings(city, nx, ny, 10);
        if (fixed.hit) {
          ped.angle += Math.PI / 2;
          nx = ped.x; ny = ped.y;
        }
        ped.x = nx; ped.y = ny;
        const clamped = clampWorld(ped.x, ped.y, 12);
        ped.x = clamped.x; ped.y = clamped.y;
        // Flee from gunfire, fast cars and the wanted player.
        const threat = state.wanted > 0 && dist(ped.x, ped.y, p.x, p.y) < 200;
        if (threat) { ped.state = 'flee'; ped.fleeX = p.x; ped.fleeY = p.y; }
      }
    }
    // Dead peds fade out; keep the crowd topped up.
    state.peds = state.peds.filter((ped) => ped.health > 0 || random.chance(0.02));
    while (state.peds.length < PED_COUNT) {
      state.peds.push(spawnPed(
        p.x + random.range(-700, 700),
        p.y + random.range(-700, 700),
      ));
    }
  }

  function stepPolice(dt) {
    const p = state.player;
    const wantCars = state.wanted === 0 ? 0 : Math.min(POLICE.maxCars, state.wanted + (state.wanted >= 4 ? 1 : 0));
    // Spawn police cars on a road near (but not on top of) the player.
    while (state.policeCars.length < wantCars) {
      const spot = randomRoadPointNear(p.x, p.y, 500, 900);
      const car = makeCar(spot.x, spot.y, angleTo(spot.x, spot.y, p.x, p.y), 'police', '#2f6fd0', 'police');
      car.targetSpeed = POLICE.maxSpeed;
      state.policeCars.push(car);
      state.cars.push(car);
    }
    // Chase: steer at the player up close, follow the roads from farther out
    // so the cruiser does not grind along building walls.
    for (const car of state.policeCars) {
      const d0 = dist(car.x, car.y, p.x, p.y);
      const chase = d0 < 260 ? { x: p.x, y: p.y } : nextRoadWaypoint(car.x, car.y, p.x, p.y);
      const targetAngle = angleTo(car.x, car.y, chase.x, chase.y);
      const diff = angleDiff(car.angle, targetAngle);
      car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
      if (Math.abs(diff) > 1.1 && car.speed > 200) car.speed -= 500 * dt;
      else car.speed = Math.min(POLICE.maxSpeed, car.speed + POLICE.accel * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const fixed = collideBuildings(city, car.x, car.y, 22);
      if (fixed.hit) { car.x = fixed.x; car.y = fixed.y; car.speed *= 0.5; }
      const d = dist(car.x, car.y, p.x, p.y);
      if (d < 44) {
        if (!p.onFoot && p.car) {
          p.car.speed *= 0.86;
          damagePlayer(POLICE.ramDamage * dt * 3);
          spawnParticles(p.x, p.y, '#ff7675', 3, 120);
          state.shake = Math.min(10, state.shake + 2);
        } else if (p.onFoot) {
          state.bustTimer += dt;
          if (state.bustTimer > POLICE.bustTime) {
            state.events = (state.events || 0) | EVENT_BUSTED;
            return;
          }
        }
      }
    }
    // Foot cops when the player is on foot and wanted.
    const wantFoot = p.onFoot && state.wanted >= 2 ? Math.min(POLICE.maxFoot, state.wanted * 2) : 0;
    while (state.cops.length < wantFoot) {
      const spot = randomRoadPointNear(p.x, p.y, 300, 600);
      state.cops.push({ x: spot.x, y: spot.y, angle: 0, speed: 150, health: 40 });
    }
    for (const cop of state.cops) {
      const a = angleTo(cop.x, cop.y, p.x, p.y);
      cop.angle = a;
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
      const fixed = collideBuildings(city, cop.x, cop.y, 12);
      cop.x = fixed.x; cop.y = fixed.y;
      if (dist(cop.x, cop.y, p.x, p.y) < POLICE.bustRadius) {
        state.bustTimer += dt;
        if (state.bustTimer > POLICE.bustTime) {
          state.events = (state.events || 0) | EVENT_BUSTED;
          return;
        }
      }
      // Cops shoot at a fleeing armed player.
      if (state.wanted >= 3 && dist(cop.x, cop.y, p.x, p.y) < 320 && random.chance(dt * 0.7)) {
        const ba = angleTo(cop.x, cop.y, p.x, p.y) + random.range(-0.12, 0.12);
        state.bullets.push({
          x: cop.x, y: cop.y, vx: Math.cos(ba) * 700, vy: Math.sin(ba) * 700,
          life: 0.7, fromPlayer: false,
        });
      }
    }
    if (state.wanted === 0) {
      state.bustTimer = 0;
      // Police drift away and despawn.
      for (const car of state.policeCars) {
        car.speed = Math.max(0, car.speed - 200 * dt);
      }
      state.policeCars = state.policeCars.filter((c) => c.speed > 5);
      state.cars = state.cars.filter((c) => c.kind !== 'police' || state.policeCars.includes(c));
      state.cops = [];
    }
  }

  function stepBullets(dt) {
    const p = state.player;
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      const hitWall = collideBuildings(city, b.x, b.y, 2).hit;
      if (hitWall) { b.life = 0; spawnParticles(b.x, b.y, '#c9c2b2', 4, 90); continue; }
      if (b.fromPlayer) {
        for (const ped of state.peds) {
          if (ped.health > 0 && ped.state !== 'rider' && dist(b.x, b.y, ped.x, ped.y) < 16) {
            ped.health -= 20;
            spawnParticles(b.x, b.y, '#e5534b', 8, 140);
            if (ped.health <= 0) killPed(ped, false);
            else { ped.state = 'flee'; ped.fleeX = p.x; ped.fleeY = p.y; }
            b.life = 0;
            break;
          }
        }
        if (b.life <= 0) continue;
        for (const cop of state.cops) {
          if (cop.health > 0 && dist(b.x, b.y, cop.x, cop.y) < 16) {
            cop.health -= 20;
            spawnParticles(b.x, b.y, '#2f6fd0', 8, 140);
            if (cop.health <= 0) killCop(cop);
            b.life = 0;
            break;
          }
        }
        if (b.life <= 0) continue;
        for (const car of state.cars) {
          if (car.driver === 'player') continue;
          if (dist(b.x, b.y, car.x, car.y) < 26) {
            car.damage += 20;
            spawnParticles(b.x, b.y, '#f2c94c', 5, 120);
            if (car.driver === 'traffic') {
              const driver = spawnPed(car.x + 26, car.y + 26);
              driver.state = 'flee'; driver.fleeX = p.x; driver.fleeY = p.y;
              state.peds.push(driver);
              car.driver = null; car.parked = true; car.speed = 0;
            }
            b.life = 0;
            break;
          }
        }
      } else if (p.onFoot && dist(b.x, b.y, p.x, p.y) < 15) {
        damagePlayer(7);
        b.life = 0;
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
    state.cops = state.cops.filter((c) => c.health > 0);
  }

  function stepPickups(dt) {
    const p = state.player;
    for (const pk of state.pickups) pk.bob += dt;
    state.pickups = state.pickups.filter((pk) => {
      if (dist(pk.x, pk.y, p.x, p.y) > 34) return true;
      if (pk.kind === 'cash') { state.cash += pk.amount; showToast(`+$${pk.amount}`); }
      else if (pk.kind === 'health') { p.health = Math.min(PLAYER.maxHealth, p.health + pk.amount); showToast('Health +50'); }
      else if (pk.kind === 'armor') { p.armor = Math.min(PLAYER.maxArmor, p.armor + pk.amount); showToast('Armor +50'); }
      else if (pk.kind === 'ammo') { p.ammo += pk.amount; showToast(`Ammo +${pk.amount}`); }
      else if (pk.kind === 'drop') {
        state.dropsCollected += 1;
        showToast(`Drop ${state.dropsCollected}/3 secured`);
        if (state.dropsCollected >= 3) advanceStep();
      }
      spawnParticles(pk.x, pk.y, '#7ed07e', 10, 120);
      return false;
    });
  }

  function stepMissions(dt) {
    const step = currentStep();
    if (!step || state.gameWon) return;
    const p = state.player;
    if (step.type === 'deliver' || step.type === 'survive') {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        if (step.type === 'deliver') failMission('Out of time — the package went cold.');
        else advanceStep();
        return;
      }
    }
    if (step.type === 'goto' || step.type === 'deliver') {
      const target = missionTarget();
      if (target && dist(p.x, p.y, target.x, target.y) < (step.radius || 90)) {
        if (step.type === 'deliver' && state.missionTimer <= 0) return;
        advanceStep();
      }
    } else if (step.type === 'steal') {
      if (step.place === 'truck') {
        if (!p.onFoot && p.car && p.car.kind === 'truck') advanceStep();
      } else if (!p.onFoot) {
        advanceStep();
      }
    } else if (step.type === 'survive') {
      if (state.wanted === 0) advanceStep();
    } else if (step.type === 'taxi') {
      stepTaxi(dt);
    }
  }

  function stepTaxi(dt) {
    const p = state.player;
    const target = state.taxiTarget;
    if (!target) return;
    if (state.taxiStage === 'pickup') {
      // The rider waits at the marker; walk/drive close and they hop in.
      if (!state.taxiRider) {
        const rider = spawnPed(target.x, target.y);
        rider.state = 'walk';
        state.taxiRider = rider;
        state.peds.push(rider);
      }
      const rider = state.taxiRider;
      if (!p.onFoot && p.car && dist(p.x, p.y, target.x, target.y) < 90) {
        rider.state = 'rider';
        state.taxiStage = 'dropoff';
        state.taxiTarget = randomRoadPointNear(p.x, p.y, 600, 1400);
        showToast('Fare picked up — take them to the marker.');
      }
    } else if (state.taxiStage === 'dropoff') {
      if (!p.onFoot && p.car && dist(p.x, p.y, target.x, target.y) < 90) {
        const fare = 90 + Math.floor(random.range(0, 60));
        state.cash += fare;
        state.faresDone += 1;
        showToast(`Fare paid +$${fare} (${state.faresDone}/3)`);
        if (state.taxiRider) {
          state.taxiRider.state = 'walk';
          state.taxiRider.x = target.x + 30;
          state.taxiRider.y = target.y + 30;
          state.taxiRider = null;
        }
        if (state.faresDone >= 3) {
          advanceStep();
        } else {
          state.taxiStage = 'pickup';
          state.taxiTarget = randomRoadPointNear(p.x, p.y, 500, 1100);
        }
      }
    }
  }

  function step(dt, input) {
    state.events = EVENT_NONE;
    state.time += dt;
    state.clockMinutes += dt * 0.5;
    if (state.clockMinutes >= 24 * 60) {
      state.clockMinutes -= 24 * 60;
      state.day += 1;
    }
    state.bannerTime = Math.max(0, state.bannerTime - dt);
    state.toastTime = Math.max(0, state.toastTime - dt);
    state.shake = Math.max(0, state.shake - dt * 22);
    state.bustTimer = Math.max(0, state.bustTimer - dt * 0.4);

    stepPlayer(dt, input || {});
    stepTraffic(dt);
    stepPeds(dt);
    stepPolice(dt);
    stepBullets(dt);
    stepPickups(dt);
    stepMissions(dt);

    // Wanted decays after a quiet spell.
    if (state.wanted > 0) {
      state.wantedTimer -= dt;
      if (state.wantedTimer <= 0) {
        state.wanted -= 1;
        state.wantedTimer = WANTED.decaySeconds;
        if (state.wanted === 0) showToast('You lost them. Heat is off.');
      }
    }

    // Particles.
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92; pt.vy *= 0.92;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);

    // Camera follows the player, clamped to the world.
    const p = state.player;
    state.camera.x = Math.max(0, Math.min(WORLD.width - 1280, p.x - 640));
    state.camera.y = Math.max(0, Math.min(WORLD.height - 720, p.y - 360));
    updateDistrict();

    if (state.events & EVENT_BUSTED) {
      handleBusted();
      return state.events;
    }
    if (p.health <= 0) {
      state.events |= EVENT_OVER;
      return state.events;
    }
    return state.events;
  }

  function handleBusted() {
    const p = state.player;
    const fine = Math.min(state.cash, 150);
    state.cash -= fine;
    state.wanted = 0;
    state.cops = [];
    state.policeCars = [];
    state.cars = state.cars.filter((c) => c.kind !== 'police');
    if (p.car) { p.car.driver = null; p.car.parked = true; p.car = null; }
    p.onFoot = true;
    p.health = Math.max(40, p.health);
    const home = city.places.safehouse;
    p.x = home.x; p.y = home.y;
    showBanner('BUSTED', `The Solmar PD took $${fine} and dropped you at the safehouse.`);
  }

  function handleWasted() {
    const p = state.player;
    const lost = Math.min(state.cash, 200);
    state.cash -= lost;
    state.wanted = 0;
    state.cops = [];
    state.policeCars = [];
    state.cars = state.cars.filter((c) => c.kind !== 'police');
    if (p.car) { p.car.driver = null; p.car.parked = true; p.car = null; }
    p.onFoot = true;
    p.health = PLAYER.maxHealth;
    p.armor = Math.max(0, p.armor - 50);
    const home = city.places.safehouse;
    p.x = home.x; p.y = home.y;
    showBanner('WASTED', `You woke up at the safehouse, $${lost} lighter.`);
  }

  reset();

  return {
    state,
    city,
    reset,
    step,
    missionTarget,
    currentStep,
    nearestCar,
    addWanted,
    handleWasted,
    showBanner,
    showToast,
    startMission,
    resetCount: () => resetCount,
  };
}
