# Solmar: Streets of the Sun

[![make.fun](https://make.fun/badge.svg?owner=no125222&bounty=gta6-01)](https://make.fun/bounty/gta6-01)
[![Play on make.fun](https://make.fun/badge-play.svg?owner=no125222)](https://make.fun/u/no125222)
[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/no125222/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/no125222/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game built for the
[Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun — a complete,
playable rendition of the genre that runs offline in a desktop browser from
static files. Play it with the link above, or clone this repo and open
`game/index.html` (or run `node serve.ts` and visit http://localhost:8080).

> Built by [@no125222](https://make.fun/u/no125222) for the
> [gta6-01 bounty](https://make.fun/bounty/gta6-01).
> Play more of my entries with referral code `0j1dar9m`:
> https://make.fun/?ref=0j1dar9m

## The game

You are **Danny Cole**, a driver in **Solmar**, a sun-soaked coastal city of
your own — Marina, Downtown, Old Town, the Harbor and Palm Park, all drawn
from scratch. No names, characters, map or assets are taken from any
commercial game.

- **A city to explore on foot and by car** — a 4800×3600 road grid with
  traffic that follows the streets, pedestrians on the sidewalks, palms,
  parks, a beach and a harbor.
- **Steal and drive** — walk up to any parked or traffic car, press **E**,
  and drive it. Arcade handling with drift, braking and collisions.
- **Wanted system and police** — jack a car or fire a gun where someone can
  see and the stars climb. Solmar PD cruisers chase and ram you; foot cops
  chase you down on foot. Get caught and you're **BUSTED**; get dropped and
  you're **WASTED**. Lose the heat and the stars decay.
- **Six story missions** — from fixer Mara Solis, Tito and the Broker:
  *First Wheels*, *Courier Run*, *Taxi Hustle*, *Heat Wave*, *Harbor Heist*
  and the finale *King of Solmar*, with timed deliveries, fares, a truck
  heist and a three-drop escape to the Marina yacht.
- **Combat** — mouse aim, click to shoot, **F** to punch, health and armor,
  ammo pickups.
- **HUD with a live minimap** — cash, health, armor, ammo, wanted stars,
  mission objective and timer, clock and day, speedometer, district name.
- **Save and continue** — progress (cash, mission, day) saves automatically
  to localStorage; continue from the title screen.
- **Sound** — engine hum, sirens, gunshots, pickup chimes and a synthwave
  pad, all synthesized live with WebAudio. No audio files, no network.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive |
| E | Enter / steal a car, get out |
| Mouse + click | Aim and shoot |
| F | Punch |
| Shift | Sprint |
| Space | Brake |
| P / Esc | Pause |
| M | Mute |
| R (while paused) | Restart the current mission |

## Play it

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

No build step, no dependencies, no network requests: `game/index.html` plus
its ES modules under `game/src/` is the whole game.

## Screenshots

All four are real renders of the game's own code, staged by `game/src/shots.js`
(the same simulation, driven by a road-following autopilot, seed 7):

1. `1-chase.jpg` — a 3-star police chase downtown (the cover)
2. `2-street.jpg` — on foot in Downtown
3. `3-harbor.jpg` — the Harbor Heist truck run
4. `4-title.jpg` — the title screen over Solmar

## Layout

```
main.ts                  hands game/ + screenshots/ to /output with a dossier
serve.ts                 tiny static server for local play
vendor/makefun-game.ts   the kit's dossier library, unchanged
game/
  index.html             the page: one canvas, one module script
  src/
    config.js            tuning, palette and the six-mission story data
    random.js            seeded RNG (mulberry32)
    city.js              Solmar's map: roads, buildings, places, road router
    audio.js             WebAudio synth: engine, siren, shots, music pad
    input.js             keyboard + mouse
    world.js             the simulation: player, traffic, peds, police,
                         combat, wanted, missions, pickups, save data
    render.js            canvas drawing: city, entities, HUD, minimap, menus
    shots.js             staged screenshot scenes (autopilot over the sim)
    main.js              boot, game loop, screens, save/load, shot mode
screenshots/             4 JPEG renders of the game itself
```

## License

MIT — see [LICENSE](LICENSE).
