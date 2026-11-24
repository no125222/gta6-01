// Solmar — tuning, palette and story data for "Solmar: Streets of the Sun",
// an original open-world crime game. Every name, place and character here is
// invented for this game; nothing is taken from any commercial game. The city
// is Solmar, a sun-soaked coastal city; the player is Danny Cole, a driver
// fresh out of a bad deal, working his way up through fixer Mara Solis and
// her crew.
export const STEP = 1 / 60;
export const WORLD = { width: 4800, height: 3600 };
export const ROAD = { spacing: 400, width: 110, lane: 55 };
export const SAVE_KEY = 'solmar.save.v1';
export const BEST_KEY = 'solmar.best.v1';

export const PLAYER = {
  walkSpeed: 210,
  sprintSpeed: 330,
  radius: 13,
  maxHealth: 100,
  maxArmor: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.45,
};

export const CAR = {
  accel: 420,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  brake: 700,
  drag: 0.55,
  steer: 2.6,
  grip: 6.5,
  length: 46,
  width: 22,
};

export const POLICE = {
  accel: 460,
  maxSpeed: 600,
  ramDamage: 8,
  bustRadius: 30,
  bustTime: 1.6,
  maxCars: 6,
  maxFoot: 8,
};

export const WANTED = {
  decaySeconds: 26,
  starsForShoot: 1,
  starsForSteal: 1,
  starsForKill: 2,
  starsForCopKill: 2,
};

export const TRAFFIC_COUNT = 26;
export const PED_COUNT = 46;

export const PALETTE = {
  backdrop: '#0e1a24',
  water: '#1f7fa8',
  waterDeep: '#14607f',
  sand: '#e8d29a',
  grass: '#5da24a',
  grassDark: '#4c8a3d',
  sidewalk: '#c9c2b2',
  road: '#3a3f47',
  roadLine: '#e8d44d',
  curb: '#9a937f',
  buildingRoof: '#b5543f',
  buildingRoof2: '#4f7fa8',
  buildingRoof3: '#c98a3d',
  buildingWall: '#8a7a68',
  park: '#69a84f',
  player: '#f2c94c',
  police: '#2f6fd0',
  text: '#f5f1e6',
  muted: '#c9c2b2',
  hudPanel: 'rgba(12, 20, 28, 0.78)',
  hudAccent: '#f2c94c',
  star: '#ffd94d',
  danger: '#e5534b',
  money: '#7ed07e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// The story: six missions, each a chain of steps the world engine runs.
// Step types: goto, steal (be in any car, then goto), pickup (collect N bags),
// deliver (goto against a timer), taxi (pick up a fare, drop them off, repeat),
// survive (stay alive / keep moving while wanted), finale (collect drops, escape).
export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Wheels',
    giver: 'Mara Solis',
    brief: 'Mara needs wheels. Borrow a car — any car — and bring it to her garage on Coral Row.',
    reward: 250,
    steps: [
      { type: 'steal', text: 'Get in a car (walk up to one and press E)', place: 'anyCar' },
      { type: 'goto', text: 'Drive to Mara\u2019s Garage', place: 'garage', radius: 90 },
    ],
  },
  {
    id: 'm2',
    title: 'Courier Run',
    giver: 'Mara Solis',
    brief: 'A package for the Harbor. The clock is ticking and the docks don\u2019t wait for anyone.',
    reward: 400,
    steps: [
      { type: 'goto', text: 'Pick up the package at Palm Park', place: 'park', radius: 80 },
      { type: 'deliver', text: 'Deliver the package to the Harbor Docks', place: 'harbor', radius: 90, time: 75 },
    ],
  },
  {
    id: 'm3',
    title: 'Taxi Hustle',
    giver: 'Tito',
    brief: 'Tito\u2019s cab is in the shop. Run his fares for a night — three riders, three drop-offs, keep the meter running.',
    reward: 550,
    steps: [
      { type: 'taxi', text: 'Pick up fares around Solmar (3 riders)', place: 'downtown', radius: 90, fares: 3 },
    ],
  },
  {
    id: 'm4',
    title: 'Heat Wave',
    giver: 'Mara Solis',
    brief: 'You were seen. The Solmar PD is all over downtown. Lose the heat and slip back to the safehouse.',
    reward: 700,
    startWanted: 3,
    steps: [
      { type: 'survive', text: 'Lose the cops — stay out of sight until the heat drops', time: 40 },
      { type: 'goto', text: 'Lay low at the Safehouse', place: 'safehouse', radius: 90 },
    ],
  },
  {
    id: 'm5',
    title: 'Harbor Heist',
    giver: 'The Broker',
    brief: 'A crate truck full of imported goods is sitting at the docks. Take it. The whole harbor will know.',
    reward: 1200,
    startWanted: 2,
    steps: [
      { type: 'goto', text: 'Reach the crate truck at the Harbor', place: 'harbor', radius: 90 },
      { type: 'steal', text: 'Get in the crate truck (E)', place: 'truck' },
      { type: 'deliver', text: 'Deliver the truck to the Broker\u2019s warehouse', place: 'warehouse', radius: 100, time: 90 },
    ],
  },
  {
    id: 'm6',
    title: 'King of Solmar',
    giver: 'Mara Solis',
    brief: 'The finale. Three drops across the city, then out to the yacht at the Marina. Do this and Solmar is yours.',
    reward: 2500,
    startWanted: 1,
    steps: [
      { type: 'pickup', text: 'Collect the three drops (follow the markers)', place: 'drops', count: 3 },
      { type: 'goto', text: 'Escape to the yacht at the Marina Pier', place: 'pier', radius: 100 },
    ],
  },
];

export const CAR_COLORS = [
  '#c0392b', '#2980b9', '#f39c12', '#27ae60', '#8e44ad', '#e67e22',
  '#ecf0f1', '#2c3e50', '#16a085', '#d35400', '#7f8c8d', '#b03a5b',
];
export const PED_SHIRTS = [
  '#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22',
  '#1abc9c', '#fd79a8', '#74b9ff', '#ffeaa7', '#a29bfe', '#ff7675',
];
