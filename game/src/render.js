// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 logical view is scaled to the window; the camera follows the
// player. Canvas 2D, flat sun-soaked colours, long soft shadows — Solmar at
// golden hour. No images, no fonts loaded from anywhere: everything is drawn.
import { WORLD, ROAD, PALETTE, FONT, PLAYER, MISSIONS } from './config.js';
import { roadXs, roadYs, districtAt } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const VIEW = { width: 1280, height: 720 };

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, w: 0, h: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    canvas.width = w;
    canvas.height = h;
    view.w = w; view.h = h;
    view.scale = Math.max(w / VIEW.width, h / VIEW.height);
    view.x = (w - VIEW.width * view.scale) / 2;
    view.y = (h - VIEW.height * view.scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function drawGround(world, cam) {
    const { x: cx, y: cy } = cam;
    // Grass base for the visible window.
    ctx.fillStyle = '#79a85e';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Water + sand along the west edge (the Marina).
    const waterX = 300 - cx;
    if (waterX > -40) {
      ctx.fillStyle = PALETTE.waterDeep;
      ctx.fillRect(0, 0, Math.max(0, waterX - 60), VIEW.height);
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(Math.max(0, waterX - 60), 0, 60, VIEW.height);
      // Wave lines.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let y = ((world.state.time * 30) % 90) - 90; y < VIEW.height; y += 90) {
        ctx.beginPath();
        ctx.moveTo(Math.max(0, waterX - 58), y);
        ctx.quadraticCurveTo(waterX - 30, y + 12, Math.max(0, waterX - 58), y + 24);
        ctx.stroke();
      }
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(waterX, 0, 120, VIEW.height);
    }
    // Roads: asphalt with sidewalk ring, drawn only where visible.
    const half = ROAD.width / 2;
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of roadXs()) {
      const sx = rx - cx;
      if (sx > -half - 20 && sx < VIEW.width + half + 20) {
        ctx.fillRect(sx - half - 14, 0, ROAD.width + 28, VIEW.height);
      }
    }
    for (const ry of roadYs()) {
      const sy = ry - cy;
      if (sy > -half - 20 && sy < VIEW.height + half + 20) {
        ctx.fillRect(0, sy - half - 14, VIEW.width, ROAD.width + 28);
      }
    }
    ctx.fillStyle = PALETTE.road;
    for (const rx of roadXs()) {
      const sx = rx - cx;
      if (sx > -half - 20 && sx < VIEW.width + half + 20) ctx.fillRect(sx - half, 0, ROAD.width, VIEW.height);
    }
    for (const ry of roadYs()) {
      const sy = ry - cy;
      if (sy > -half - 20 && sy < VIEW.height + half + 20) ctx.fillRect(0, sy - half, VIEW.width, ROAD.width);
    }
    // Lane dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of roadXs()) {
      const sx = rx - cx;
      if (sx < -20 || sx > VIEW.width + 20) continue;
      for (let y = -((cy % 64) + 64) % 64; y < VIEW.height; y += 64) ctx.fillRect(sx - 2, y, 4, 30);
    }
    for (const ry of roadYs()) {
      const sy = ry - cy;
      if (sy < -20 || sy > VIEW.height + 20) continue;
      for (let x = -((cx % 64) + 64) % 64; x < VIEW.width; x += 64) ctx.fillRect(x, sy - 2, 30, 4);
    }
    // Intersections: zebra crossings.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const rx of roadXs()) {
      for (const ry of roadYs()) {
        const sx = rx - cx;
        const sy = ry - cy;
        if (sx < -80 || sx > VIEW.width + 80 || sy < -80 || sy > VIEW.height + 80) continue;
        for (let i = -2; i <= 2; i += 1) ctx.fillRect(sx - half + 8 + i * 22, sy - half - 12, 10, 10);
      }
    }
  }

  function drawBuildings(world, cam) {
    const { x: cx, y: cy } = cam;
    for (const b of world.city.buildings) {
      const sx = b.x - cx;
      const sy = b.y - cy;
      if (sx > VIEW.width || sy > VIEW.height || sx + b.w < 0 || sy + b.h < 0) continue;
      // Long afternoon shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(sx + 10, sy + 12, b.w, b.h);
      ctx.fillStyle = '#6b5d4f';
      ctx.fillRect(sx, sy, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(sx + 4, sy + 4, b.w - 8, b.h - 8);
      // Roof detail: AC units / skylights, taller blocks get a helipad ring.
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(sx + 10, sy + 10, 16, 12);
      ctx.fillRect(sx + b.w - 26, sy + b.h - 22, 16, 12);
      if (b.tall) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx + b.w / 2, sy + b.h / 2, 16, 0, Math.PI * 2);
        ctx.stroke();
        text('H', sx + b.w / 2, sy + b.h / 2 + 6, 16, 'rgba(255,255,255,0.8)', 'center', 'bold');
      }
      if (b.floors > 4) {
        text(`${b.floors}F`, sx + b.w / 2, sy + 18, 11, 'rgba(255,255,255,0.55)', 'center');
      }
    }
    // Park pond and harbor crates.
    for (const pr of world.city.props) {
      const sx = pr.x - cx;
      const sy = pr.y - cy;
      if (pr.kind === 'pond') {
        ctx.fillStyle = '#4db2d8';
        ctx.beginPath(); ctx.arc(sx, sy, pr.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(sx - 12, sy - 8, 12, 0, Math.PI * 2); ctx.fill();
      } else if (pr.kind === 'crates') {
        ctx.fillStyle = '#c98a3d';
        ctx.fillRect(sx - pr.w / 2, sy - pr.h / 2, pr.w, pr.h);
        ctx.strokeStyle = '#8a5a1d';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx - pr.w / 2, sy - pr.h / 2, pr.w, pr.h);
        ctx.beginPath();
        ctx.moveTo(sx - pr.w / 2, sy - pr.h / 2); ctx.lineTo(sx + pr.w / 2, sy + pr.h / 2);
        ctx.moveTo(sx + pr.w / 2, sy - pr.h / 2); ctx.lineTo(sx - pr.w / 2, sy + pr.h / 2);
        ctx.stroke();
      }
    }
    // Palm trees.
    for (const t of world.city.trees) {
      const sx = t.x - cx;
      const sy = t.y - cy;
      if (sx < -30 || sx > VIEW.width + 30 || sy < -30 || sy > VIEW.height + 30) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.ellipse(sx + 6, sy + 8, t.r, t.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx, sy + 4); ctx.lineTo(sx, sy - 6); ctx.stroke();
      ctx.fillStyle = '#3f8f3a';
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(sx + Math.cos(a) * 9, sy - 6 + Math.sin(a) * 6, 9, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCar(car, cam, isPlayer) {
    const sx = car.x - cam.x;
    const sy = car.y - cam.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(ctx, -20, -8, 48, 26, 6);
    ctx.fill();
    ctx.fillStyle = car.color;
    const len = car.kind === 'truck' ? 62 : 46;
    const wid = car.kind === 'truck' ? 26 : 22;
    rr(ctx, -len / 2, -wid / 2, len, wid, 7);
    ctx.fill();
    if (car.kind === 'truck') {
      ctx.fillStyle = '#e8e0cc';
      ctx.fillRect(-len / 2 + 4, -wid / 2 + 3, 26, wid - 6);
      ctx.fillStyle = '#d35400';
      ctx.fillRect(len / 2 - 12, -wid / 2 + 2, 10, wid - 4);
    }
    ctx.fillStyle = '#1d2733';
    rr(ctx, -8, -wid / 2 + 3, 16, wid - 6, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(-14, -wid / 2 + 3, 4, wid - 6);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(len / 2 - 3, -wid / 2 + 2, 3, 5);
    ctx.fillRect(len / 2 - 3, wid / 2 - 7, 3, 5);
    if (car.kind === 'police') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-len / 2 + 6, -wid / 2 + 2, 12, 5);
      const flash = Math.floor(car.x / 30 + car.y / 30) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#2f7bff';
      ctx.beginPath(); ctx.arc(-2, -wid / 2 - 1, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = flash ? '#2f7bff' : '#ff3b30';
      ctx.beginPath(); ctx.arc(6, -wid / 2 - 1, 4, 0, Math.PI * 2); ctx.fill();
      text('PD', 0, 5, 11, '#ffffff', 'center', 'bold');
    }
    if (isPlayer) {
      ctx.strokeStyle = PALETTE.hudAccent;
      ctx.lineWidth = 2;
      rr(ctx, -len / 2 - 3, -wid / 2 - 3, len + 6, wid + 6, 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPed(ped, cam) {
    const sx = ped.x - cam.x;
    const sy = ped.y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(sx, sy - 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.arc(sx, sy - 5, 5, Math.PI, 0); ctx.fill();
  }

  function drawCop(cop, cam) {
    const sx = cop.x - cam.x;
    const sy = cop.y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(sx, sy - 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#12233a';
    ctx.fillRect(sx - 6, sy - 8, 12, 4);
    text('PD', sx, sy + 4, 8, '#ffffff', 'center', 'bold');
  }

  function drawPlayer(world, cam) {
    const p = world.state.player;
    if (!p.onFoot) return;
    const sx = p.x - cam.x;
    const sy = p.y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 9, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Danny Cole: yellow jacket, dark jeans.
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(sx, sy - 2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d2733';
    ctx.beginPath(); ctx.arc(sx, sy - 5, 6, Math.PI, 0); ctx.fill();
    // Gun in hand when aiming.
    if (world.state.player.ammo > 0) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(p.angle) * 10, sy + Math.sin(p.angle) * 10);
      ctx.lineTo(sx + Math.cos(p.angle) * 20, sy + Math.sin(p.angle) * 20);
      ctx.stroke();
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.stroke();
  }

  function drawMarker(world, cam) {
    const target = world.missionTarget();
    if (!target) return;
    const sx = target.x - cam.x;
    const sy = target.y - cam.y;
    const pulse = 1 + Math.sin(world.state.time * 4) * 0.15;
    if (sx > -60 && sx < VIEW.width + 60 && sy > -60 && sy < VIEW.height + 60) {
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, sy, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(242,201,76,0.25)';
      ctx.beginPath(); ctx.arc(sx, sy, 34 * pulse, 0, Math.PI * 2); ctx.fill();
      // Beacon beam.
      ctx.fillStyle = 'rgba(242,201,76,0.35)';
      ctx.beginPath();
      ctx.moveTo(sx - 10, sy - 20);
      ctx.lineTo(sx + 10, sy - 20);
      ctx.lineTo(sx + 4, sy - 150);
      ctx.lineTo(sx - 4, sy - 150);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 34);
      ctx.lineTo(sx + 9, sy - 16);
      ctx.lineTo(sx - 9, sy - 16);
      ctx.closePath();
      ctx.fill();
    } else {
      // Off-screen edge arrow pointing at the objective.
      const ex = Math.max(40, Math.min(VIEW.width - 40, sx));
      const ey = Math.max(40, Math.min(VIEW.height - 40, sy));
      const a = Math.atan2(sy - ey, sx - ex);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      text(target.label, ex, ey - 22, 13, '#f2c94c', 'center', 'bold');
    }
  }

  function drawMinimap(world) {
    const mw = 220;
    const mh = 160;
    const mx = VIEW.width - mw - 16;
    const my = 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = PALETTE.hudPanel;
    rr(ctx, mx - 6, my - 6, mw + 12, mh + 12, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    rr(ctx, mx, my, mw, mh, 6);
    ctx.clip();
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2f7fa8';
    ctx.fillRect(mx, my, 300 * sx, mh);
    ctx.fillStyle = '#3a3f47';
    for (const rx of roadXs()) ctx.fillRect(mx + rx * sx - 2, my, 4, mh);
    for (const ry of roadYs()) ctx.fillRect(mx, my + ry * sy - 2, mw, 4);
    const target = world.missionTarget();
    if (target) {
      const pulse = 3 + Math.sin(world.state.time * 5) * 1.5;
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath(); ctx.arc(mx + target.x * sx, my + target.y * sy, pulse + 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const car of world.state.cars) {
      if (car.kind === 'police') {
        ctx.fillStyle = '#ff3b30';
        ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
      }
    }
    for (const cop of world.state.cops) {
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(mx + cop.x * sx - 2, my + cop.y * sy - 2, 4, 4);
    }
    const p = world.state.player;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(12,20,28,0.78)';
    const label = world.state.district;
    const lw = 16 + label.length * 7.5;
    rr(ctx, mx + mw / 2 - lw / 2, my + mh + 8, lw, 24, 8);
    ctx.fill();
    text(label, mx + mw / 2, my + mh + 25, 13, '#f5f1e6', 'center', 'bold');
  }

  function drawHud(world, ui) {
    const s = world.state;
    const p = s.player;
    // Top-left: cash, health, armor, ammo.
    ctx.fillStyle = PALETTE.hudPanel;
    rr(ctx, 14, 14, 250, 108, 10);
    ctx.fill();
    text(`$${s.cash.toLocaleString('en-US')}`, 28, 44, 26, PALETTE.money, 'left', 'bold');
    text('CASH', 28, 62, 11, PALETTE.muted);
    // Health bar.
    ctx.fillStyle = '#222';
    rr(ctx, 28, 72, 180, 12, 6); ctx.fill();
    ctx.fillStyle = p.health > 30 ? '#7ed07e' : '#e5534b';
    rr(ctx, 28, 72, 180 * (p.health / 100), 12, 6); ctx.fill();
    text('HP', 214, 83, 11, '#f5f1e6', 'left', 'bold');
    ctx.fillStyle = '#222';
    rr(ctx, 28, 90, 180, 12, 6); ctx.fill();
    ctx.fillStyle = '#7fb2e8';
    rr(ctx, 28, 90, 180 * (p.armor / 100), 12, 6); ctx.fill();
    text('ARMOR', 214, 101, 11, '#f5f1e6', 'left', 'bold');
    text(`AMMO ${p.ammo}`, 28, 116, 12, '#f5f1e6', 'left', 'bold');
    // Wanted stars, top centre.
    const starY = 40;
    for (let i = 0; i < 5; i += 1) {
      const x = VIEW.width / 2 - 70 + i * 30;
      ctx.font = '28px ' + FONT;
      ctx.fillStyle = i < s.wanted ? PALETTE.star : 'rgba(255,255,255,0.25)';
      ctx.textAlign = 'center';
      ctx.fillText('★', x, starY);
    }
    if (s.wanted > 0) text('WANTED', VIEW.width / 2, 64, 11, '#ff9a8a', 'center', 'bold');
    // Mission objective, under the stars.
    const step = world.currentStep();
    if (s.mission && step) {
      ctx.fillStyle = PALETTE.hudPanel;
      const label = `${s.mission.title} — ${step.text}`;
      const w = Math.min(560, 24 + label.length * 7.4);
      rr(ctx, VIEW.width / 2 - w / 2, 74, w, 34, 8);
      ctx.fill();
      text(label, VIEW.width / 2, 97, 15, '#f5f1e6', 'center', 'bold');
      if (s.missionTimer > 0 && (step.type === 'deliver' || step.type === 'survive')) {
        text(`${Math.ceil(s.missionTimer)}s`, VIEW.width / 2, 126, 20,
          s.missionTimer < 15 ? '#ff6b5e' : '#f2c94c', 'center', 'bold');
      }
    }
    // Clock + day, top-right above the minimap is busy; put it bottom-left.
    const hh = Math.floor(s.clockMinutes / 60);
    const mm = Math.floor(s.clockMinutes % 60);
    const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    text(`DAY ${s.day}  •  ${clock}  •  SOLMAR`, 16, VIEW.height - 16, 14, '#f5f1e6', 'left', 'bold');
    if (!p.onFoot && p.car) {
      const kmh = Math.round(Math.abs(p.car.speed) * 0.45);
      text(`${kmh}`, VIEW.width - 260, VIEW.height - 24, 40, '#f5f1e6', 'right', 'bold');
      text('KM/H', VIEW.width - 200, VIEW.height - 24, 14, PALETTE.muted, 'left', 'bold');
    }
    drawMinimap(world);
    // Banner (mission complete / busted / wasted).
    if (s.banner && s.bannerTime > 0) {
      const alpha = Math.min(1, s.bannerTime);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(12,20,28,0.85)';
      rr(ctx, VIEW.width / 2 - 320, 200, 640, 96, 12);
      ctx.fill();
      ctx.strokeStyle = PALETTE.hudAccent;
      ctx.lineWidth = 2;
      ctx.stroke();
      text(s.banner.title, VIEW.width / 2, 240, 34, PALETTE.hudAccent, 'center', 'bold');
      text(s.banner.sub, VIEW.width / 2, 272, 15, '#f5f1e6', 'center');
      ctx.globalAlpha = 1;
    }
    if (s.toast && s.toastTime > 0) {
      ctx.fillStyle = PALETTE.hudPanel;
      rr(ctx, VIEW.width / 2 - 200, VIEW.height - 90, 400, 34, 8);
      ctx.fill();
      text(s.toast, VIEW.width / 2, VIEW.height - 67, 15, '#f5f1e6', 'center');
    }
    if (ui && ui.hint) {
      text(ui.hint, VIEW.width / 2, VIEW.height - 120, 14, 'rgba(245,241,230,0.85)', 'center');
    }
  }

  function drawTitle(world, ui) {
    // City behind, slowly panning.
    const cam = {
      x: (Math.sin(world.state.time * 0.05) * 0.5 + 0.5) * (WORLD.width - VIEW.width),
      y: 1200,
    };
    ctx.fillStyle = 'rgba(10,16,22,0.45)';
    drawGround(world, cam);
    drawBuildings(world, cam);
    ctx.fillStyle = 'rgba(10,16,22,0.45)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = 'rgba(10,16,22,0.35)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text('SOLMAR', VIEW.width / 2, 190, 96, '#f2c94c', 'center', 'bold');
    text('STREETS OF THE SUN', VIEW.width / 2, 232, 28, '#f5f1e6', 'center', 'bold');
    text('An original open-world crime game — drive, steal, run missions, lose the cops.', VIEW.width / 2, 268, 16, '#c9c2b2', 'center');
    const options = ui && ui.hasSave
      ? ['1 — NEW GAME', '2 — CONTINUE', '3 — HOW TO PLAY']
      : ['1 — NEW GAME', '2 — HOW TO PLAY'];
    ctx.fillStyle = 'rgba(12,20,28,0.8)';
    rr(ctx, VIEW.width / 2 - 260, 310, 520, 40 + options.length * 44, 12);
    ctx.fill();
    options.forEach((opt, i) => {
      text(opt, VIEW.width / 2, 352 + i * 44, 20, '#f5f1e6', 'center', 'bold');
    });
    text('WASD move / drive  •  E enter & steal cars  •  Mouse aim, Click shoot  •  F punch  •  Shift sprint  •  Space brake  •  P pause  •  M mute',
      VIEW.width / 2, 640, 14, '#c9c2b2', 'center');
    text('Six missions. One city. No cops invited.  •  Progress saves automatically.',
      VIEW.width / 2, 668, 14, '#c9c2b2', 'center');
    if (ui && ui.best > 0) text(`Best haul: $${ui.best.toLocaleString('en-US')}`, VIEW.width / 2, 596, 15, PALETTE.money, 'center', 'bold');
    if (ui && ui.showHelp) {
      ctx.fillStyle = 'rgba(12,20,28,0.92)';
      rr(ctx, VIEW.width / 2 - 340, 150, 680, 420, 12);
      ctx.fill();
      text('HOW TO PLAY', VIEW.width / 2, 196, 28, '#f2c94c', 'center', 'bold');
      const lines = [
        'You are Danny Cole, a driver in Solmar. Follow the yellow marker.',
        'Walk up to any car and press E to steal it. Drive with WASD.',
        'Mouse aims, click shoots, F punches. Watch your wanted stars.',
        'Cops chase you when the heat is on. Lose them, or get BUSTED.',
        'Six missions from Mara, Tito and the Broker — finish them all',
        'to become King of Solmar. Cash, health and armor pickups are',
        'scattered around the city. Progress saves automatically.',
      ];
      lines.forEach((line, i) => text(line, VIEW.width / 2, 236 + i * 32, 16, '#f5f1e6', 'center'));
      text('Press H to close this panel.', VIEW.width / 2, 540, 15, '#c9c2b2', 'center');
    }
  }

  function drawPaused(world) {
    ctx.fillStyle = 'rgba(10,16,22,0.7)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text('PAUSED', VIEW.width / 2, 300, 64, '#f5f1e6', 'center', 'bold');
    text('P or Esc — resume    •    M — mute    •    R — restart mission', VIEW.width / 2, 350, 17, '#c9c2b2', 'center');
    text(`Cash $${world.state.cash}  •  Mission ${world.state.missionIndex + 1} of ${MISSIONS.length}  •  Cars stolen ${world.state.carsStolen}`,
      VIEW.width / 2, 390, 15, '#f5f1e6', 'center');
  }

  function drawOver(world, title, lines) {
    ctx.fillStyle = 'rgba(10,16,22,0.82)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text(title, VIEW.width / 2, 290, 72, '#e5534b', 'center', 'bold');
    lines.forEach((line, i) => text(line, VIEW.width / 2, 340 + i * 34, 18, '#f5f1e6', 'center'));
    text('Press Enter or click to try again', VIEW.width / 2, 480, 17, '#c9c2b2', 'center');
  }

  function drawWin(world) {
    ctx.fillStyle = 'rgba(10,16,22,0.7)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text('KING OF SOLMAR', VIEW.width / 2, 280, 64, '#f2c94c', 'center', 'bold');
    text('Every crew in the city answers to you now.', VIEW.width / 2, 330, 20, '#f5f1e6', 'center');
    text(`Final haul: $${world.state.cash.toLocaleString('en-US')}  •  Cars stolen: ${world.state.carsStolen}  •  Days: ${world.state.day}`,
      VIEW.width / 2, 370, 17, '#c9c2b2', 'center');
    text('Keep playing — Solmar is yours. Press Enter to keep roaming.', VIEW.width / 2, 420, 17, '#f5f1e6', 'center');
  }

  function draw(world, screen, ui) {
    const s = world.state;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const shakeX = s.shake ? (Math.random() - 0.5) * s.shake : 0;
    const shakeY = s.shake ? (Math.random() - 0.5) * s.shake : 0;
    const cam = { x: s.camera.x + shakeX, y: s.camera.y + shakeY };
    if (screen === SCREEN_TITLE) {
      drawTitle(world, ui);
      return;
    }
    drawGround(world, cam);
    drawBuildings(world, cam);
    drawMarker(world, cam);
    // Pickups.
    for (const pk of s.pickups) {
      const sx = pk.x - cam.x;
      const sy = pk.y - cam.y + Math.sin(pk.bob * 3) * 3;
      if (sx < -30 || sx > VIEW.width + 30 || sy < -30 || sy > VIEW.height + 30) continue;
      const colors = { cash: '#7ed07e', health: '#ff7675', armor: '#7fb2e8', ammo: '#f2c94c', drop: '#f2c94c' };
      ctx.fillStyle = colors[pk.kind] || '#ffffff';
      ctx.beginPath(); ctx.arc(sx, sy, pk.kind === 'drop' ? 13 : 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#12233a';
      const glyph = pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : pk.kind === 'armor' ? 'A' : pk.kind === 'ammo' ? '»' : '◆';
      text(glyph, sx, sy + 5, 13, '#12233a', 'center', 'bold');
    }
    for (const car of s.cars) {
      const sx = car.x - cam.x;
      const sy = car.y - cam.y;
      if (sx < -90 || sx > VIEW.width + 90 || sy < -90 || sy > VIEW.height + 90) continue;
      drawCar(car, cam, car.driver === 'player');
    }
    for (const ped of s.peds) {
      if (ped.health <= 0) continue;
      const sx = ped.x - cam.x;
      const sy = ped.y - cam.y;
      if (sx < -30 || sx > VIEW.width + 30 || sy < -30 || sy > VIEW.height + 30) continue;
      drawPed(ped, cam);
    }
    for (const cop of s.cops) {
      const sx = cop.x - cam.x;
      const sy = cop.y - cam.y;
      if (sx < -30 || sx > VIEW.width + 30 || sy < -30 || sy > VIEW.height + 30) continue;
      drawCop(cop, cam);
    }
    drawPlayer(world, cam);
    // Bullets and particles.
    ctx.fillStyle = '#ffe9a8';
    for (const b of s.bullets) {
      ctx.beginPath(); ctx.arc(b.x - cam.x, b.y - cam.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const pt of s.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - cam.x - pt.size / 2, pt.y - cam.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    // Warm golden-hour tint.
    ctx.fillStyle = 'rgba(255,176,90,0.05)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_PLAY) drawHud(world, ui);
    else if (screen === SCREEN_PAUSED) { drawHud(world, ui); drawPaused(world); }
    else if (screen === SCREEN_OVER) {
      drawHud(world, ui);
      drawOver(world, 'WASTED', [`The city got the better of you this time.`, `Cash kept: $${s.cash.toLocaleString('en-US')}`]);
    } else if (screen === SCREEN_WIN) {
      drawHud(world, ui);
      drawWin(world);
    }
  }

  return { draw, resize, VIEW };
}
