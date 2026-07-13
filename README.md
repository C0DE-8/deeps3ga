# Deep Saga

Deep Saga is a persistent, AI-controlled dark fantasy text RPG. The interface presents the story like an interactive novel rather than a chat utility. A player chooses a suggested action or writes any action in natural language; the AI Game Master resolves the attempt from saved world and character state.

## Playable World

Active gameplay contains **5 Dungeons, 3 Floors per Dungeon, and 15 Floors total**.

| Dungeon | Floor 1 | Floor 2 | Floor 3 |
| --- | --- | --- | --- |
| Crimson Wakewood | Rain-Birth Clearing | Hunter's Lantern Road | Mawroot, the First Hunger |
| Glassweb Dominion | Silkfall Descent | Molting Court | Queen Velratha |
| Drowned Crown | Mudgate Hamlet | Rot-Crown Court | Prince Gorrik |
| Ashbell Academy | Rollcall Hall | Detention Furnace | Headmaster Cinder |
| Throne of Echoes | Gallery of Forgotten Lives | Road of Unmade Choices | The Echo Sovereign |

Every Dungeon follows the same broad dramatic structure:

- Floor 1 introduces the place, exploration, important characters, and a first conflict.
- Floor 2 contains the main quest, stronger danger, discoveries, and boss preparation.
- Floor 3 is a multi-turn boss confrontation and Dungeon resolution.
- Dungeon 5 Floor 3 is the final confrontation.

The simplified seed includes 15 floor stories, 15 placed NPC records, 20 placed monsters, 5 boss profiles, 5 main quests, and 5 factions. Existing item and skill catalogs remain available for inventory, rewards, progression, and AI validation.

## Turn Architecture

The AI is the Game Master. The backend does not decide a second outcome before or after the AI response.

```text
player action
  -> load compact saved state
  -> AI Game Master resolves one complete turn
  -> validate JSON, IDs, names, and numeric limits
  -> save the accepted turn atomically
  -> return that exact saved result
```

Before every AI turn, the backend sends a compact packet containing:

- current Dungeon, Floor, location, Floor objective, completion, and exit state
- player identity, level, HP, Mana, Stamina, Gold, XP, and other character statistics
- inventory, equipped items, learned skills, and active status effects
- active quests, boss state, present reachable enemies, and encounter participants
- NPC relationships, companions, important decisions, and unresolved story threads
- recent story messages and high-priority older memories
- valid item, skill, and status references needed to validate changes

The accepted AI object is the single source of truth for narration, target IDs and names, damage, resources, statuses, records, memories, choices, Floor state, and boss state.

## Hard Rules

The backend protects three gameplay rules:

1. **Player statements are attempts.** Claims of godhood, infinite power, free items, admin powers, or automatic victory do not modify saved state.
2. **Bosses require a real victory.** A boss is defeated only when its resulting HP is zero or a previously established database-backed alternative victory is complete.
3. **Floors cannot be skipped.** A Floor change is accepted only when `floor_complete` and `exit_unlocked` were already saved before that turn. Completing an objective and moving therefore happen as separate turns.

Impossible or failed actions are narrated naturally. The game does not answer with immersion-breaking messages such as `invalid action`, `not in combat`, or `target unavailable`.

## Persistent State

The database stores the account separately from the immortal soul and its current body.

```text
Account
  -> Soul Profile
      -> Story Cycle
          -> Character Life
              -> Character Sheet
```

Playable state includes:

- character name, race, class, level, HP, Mana, Stamina, Gold, and XP
- current Dungeon, Floor, and location
- inventory, equipment, skills, statuses, traits, and injuries
- recent narration, important memories, choices, objectives, and quests
- NPC relationships, companions, promises, and alive/dead state
- completed Floors, active boss HP, defeated bosses, and Floor exit flags

The migration `017_simplified_five_dungeon_world.sql` preserves authentication accounts, resets their game progress, and reseeds the active 5-Dungeon world. A new game creates a fresh soul, body, and story cycle for the existing login.

## Legacy Heroes

Death before completing all five Dungeons ends that body without creating a Legacy Hero. Reincarnation creates a new body while persistent soul memory survives.

Completing Dungeon 5 creates an immutable Legacy Hero snapshot containing identity, statistics, skills, equipment, and learned combat behavior. A later completed journey can face that saved legend as its final guardian. The snapshot does not change when later characters progress.

## API Layout

The Express server mounts feature routers under `/api`:

```text
/api/auth/register
/api/auth/login
/api/auth/me
/api/game/start
/api/game/saves
/api/game/:storyCycleId
/api/game/continue
/api/admin/*
```

Routes are defined in their own router files. Services contain application flow, repositories own database access, and the frontend uses Axios through its API module.

## Local Setup

Backend environment values are documented in `backend/.env.example`. Keep the real `backend/.env` out of Git.

```bash
cd backend
npm install
npm run migrate
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Default local URLs are `http://localhost:4000` for the API and `http://localhost:5173` for the frontend.

## Verification

```bash
cd backend
npm run test:game-master
npm run test:idempotency
npm run simulate-journey

cd ../frontend
npm run lint
npm run build
```

The Game Master regression test covers exact target coherence and chronological status expiration. The idempotency test confirms that one accepted AI turn is applied once and returned consistently when a request is replayed.
