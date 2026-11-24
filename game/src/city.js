// Solmar's map: a road grid over a coastal city, generated once from the seed.
// Roads run every 400 px; the blocks between them hold buildings, a park, the
// harbor and the marina. Named places anchor missions, the safehouse and the
// minimap. Nothing here copies any real or commercial map.
import { WORLD, ROAD } from './config.js';

export const DISTRICTS = [
  { name: 'Marina', x0: 0, y0: 0, x1: 420, y1: 3600, color: '#e8d29a' },
  { name: 'Downtown', x0: 1600, y0: 800, x1: 3200, y1: 2400, color: '#4f7fa8' },
  { name: 'Old Town', x0: 3600, y0: 0, x1: 4800, y1: 1600, color: '#c98a3d' },
  { name: 'Harbor', x0: 1200, y0: 2800, x1: 4800, y1: 3600, color: '#5d6d7e' },
  { name: 'Palm Park', x0: 800, y0: 1200, x1: 1600, y1: 2000, color: '#69a84f' },
];

export function roadXs() {
  const list = [];
  for (let x = ROAD.spacing; x < WORLD.width; x += ROAD.spacing) list.push(x);
  return list;
}

export function roadYs() {
  const list = [];
  for (let y = ROAD.spacing; y < WORLD.height; y += ROAD.spacing) list.push(y);
  return list;
}

/** True when the point is on a road (asphalt), false when it is inside a block. */
export function onRoad(x, y) {
  const half = ROAD.width / 2;
  for (const rx of roadXs()) if (Math.abs(x - rx) < half) return true;
  for (const ry of roadYs()) if (Math.abs(y - ry) < half) return true;
  return false;
}

/** The road line (x of a vertical road, y of a horizontal one) nearest a value. */
export function nearestRoadX(x) {
  return roadXs().reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
}

export function nearestRoadY(y) {
  return roadYs().reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
}

/**
 * Road-following waypoint: the next point a car at (x, y) should drive toward
 * to reach (tx, ty) while staying on roads — drive to the nearest road, then
 * along it to the cross street nearest the target, then along that street.
 * Returns a point on a road, never inside a block.
 */
export function nextRoadWaypoint(x, y, tx, ty) {
  const half = ROAD.width / 2;
  const rx = nearestRoadX(x);
  const ry = nearestRoadY(y);
  const onV = Math.abs(x - rx) < half;
  const onH = Math.abs(y - ry) < half;
  if (!onV && !onH) {
    return Math.abs(x - rx) < Math.abs(y - ry) ? { x: rx, y } : { x, y: ry };
  }
  if (onV && !onH) {
    if (Math.abs(tx - rx) < half + 10) return { x: rx, y: ty };
    return { x: rx, y: nearestRoadY(ty) };
  }
  if (onH && !onV) {
    if (Math.abs(ty - ry) < half + 10) return { x: tx, y: ry };
    return { x: nearestRoadX(tx), y: ry };
  }
  // At an intersection: pick the leg that leads toward the target.
  if (Math.abs(tx - rx) < half + 10) return { x: rx, y: ty };
  if (Math.abs(ty - ry) < half + 10) return { x: tx, y: ry };
  return { x: rx, y: nearestRoadY(ty) };
}

/** True when the point is on the sidewalk ring around a road. */
export function onSidewalk(x, y) {
  const half = ROAD.width / 2 + 16;
  if (onRoad(x, y)) return false;
  for (const rx of roadXs()) if (Math.abs(x - rx) < half) return true;
  for (const ry of roadYs()) if (Math.abs(y - ry) < half) return true;
  return false;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Solmar';
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const props = [];
  const xs = roadXs();
  const ys = roadYs();
  const roofColors = ['#b5543f', '#4f7fa8', '#c98a3d', '#7a5a8a', '#5d8a6a', '#a85a5a'];

  // One building (or a small cluster) per block, with a gap for the sidewalk.
  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx] + ROAD.width / 2 + 24;
      const y0 = ys[by] + ROAD.width / 2 + 24;
      const x1 = xs[bx + 1] - ROAD.width / 2 - 24;
      const y1 = ys[by + 1] - ROAD.width / 2 - 24;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // The park block stays green; the harbor blocks stay open docks.
      if (cx > 800 && cx < 1600 && cy > 1200 && cy < 2000) {
        for (let i = 0; i < 7; i += 1) {
          trees.push({ x: random.range(x0, x1), y: random.range(y0, y1), r: random.range(10, 16) });
        }
        props.push({ kind: 'pond', x: cx + 40, y: cy - 30, r: 52 });
        continue;
      }
      if (cy > 2800) {
        props.push({ kind: 'crates', x: cx, y: cy, w: 90, h: 50 });
        continue;
      }
      const downtown = cx > 1600 && cx < 3200 && cy > 800 && cy < 2400;
      const tall = downtown && random.chance(0.55);
      const w = random.range(90, Math.min(170, x1 - x0 - 20));
      const h = random.range(80, Math.min(150, y1 - y0 - 20));
      buildings.push({
        x: cx - w / 2, y: cy - h / 2, w, h,
        roof: random.pick(roofColors),
        tall,
        floors: tall ? random.int(6, 14) : random.int(1, 3),
      });
      // Palms along the block edge.
      const palms = random.int(1, 3);
      for (let i = 0; i < palms; i += 1) {
        trees.push({
          x: random.range(x0, x1),
          y: random.chance(0.5) ? y0 + 8 : y1 - 8,
          r: random.range(8, 12),
        });
      }
    }
  }

  // Beach palms along the marina strip.
  for (let y = 200; y < WORLD.height; y += 180) {
    trees.push({ x: random.range(300, 360), y: y + random.range(-30, 30), r: 11 });
  }

  const places = {
    safehouse: { x: 1000, y: 600, label: 'Safehouse' },
    garage: { x: 2000, y: 400, label: "Mara's Garage" },
    park: { x: 1200, y: 1600, label: 'Palm Park' },
    harbor: { x: 2400, y: 3200, label: 'Harbor Docks' },
    warehouse: { x: 4000, y: 3200, label: "Broker's Warehouse" },
    pier: { x: 300, y: 1800, label: 'Marina Pier' },
    downtown: { x: 2400, y: 1600, label: 'Downtown' },
    bank: { x: 2800, y: 1200, label: 'Solmar Bank' },
    drops: [
      { x: 800, y: 2800, label: 'Drop 1' },
      { x: 3600, y: 800, label: 'Drop 2' },
      { x: 4400, y: 2400, label: 'Drop 3' },
    ],
  };

  return { buildings, trees, props, places, xs, ys };
}

/** Push a circle out of every building it overlaps; returns true if it hit one. */
export function collideBuildings(city, x, y, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        x += (dx / d) * (radius - d);
        y += (dy / d) * (radius - d);
      } else {
        y -= radius;
      }
    }
  }
  return { x, y, hit };
}

/** Clamp a point inside the world, keeping the beach and harbor in bounds. */
export function clampWorld(x, y, margin) {
  return {
    x: Math.max(40 + margin, Math.min(WORLD.width - margin, x)),
    y: Math.max(40 + margin, Math.min(WORLD.height - margin, y)),
  };
}
