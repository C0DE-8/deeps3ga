# Deep Saga 0.3

Deep Saga 0.3 is an interactive fantasy book/RPG engine. The player writes free-form attempted actions, the Game Master narrates moment-to-moment story, the Story Guide protects canon and reveal timing, and the backend engine validates what becomes persistent reality.

## Book I

`ant-world` is the active book:

- Title: `The Ant World: The King's Soul`
- World: `Eldara`
- Genre: fantasy, reincarnation, evolution, war, mystery, adventure
- Starting state: human memories retained, species `Ant`, life stage `Larva`, level `1`, location `Ant Nursery`

The protagonist does not know why they reincarnated, what Royal Soul Resonance is, the truth of the Grand Insect Tournament, the Great War, the sanctuary, the final enemy, or their final evolution path at the start.

## Architecture

- Users are account identities only.
- Books define playable Deep Saga works.
- Runs belong to a user and book and can be `active`, `dead`, `completed`, or `abandoned`.
- Character state is per run, not per account.
- Story messages, discoveries, canonical facts, relationships, world state, open threads, memories, traits, abilities, resources, and story events are persisted in SQL.
- Action requests use `clientActionId` plus run versions for idempotency and stale action rejection.

## Story Guide

Book-specific canon lives in `backend/books/ant-world/story-guide.js` and the seeded SQL chapter guide. The 15 chapters are represented as structured definitions with purpose, required canon, major revelations, possible developments, end conditions, blocked future revelations, and scene guidance. They are not fixed scripts.

The core law is:

- AI = Game Master
- Story Guide = Canon
- Player = Protagonist
- Engine = Reality

## Game Master

`backend/services/game-master.service.js` validates a strict internal proposal shape:

- narration
- suggested choices
- scene assessment
- proposed state, experience, mana, and health changes
- proposed traits and abilities
- relationship changes
- discoveries, canonical facts, memories, open threads, world state changes
- chapter and scene progress
- death and ending candidates

If `OPENAI_API_KEY` is configured, the backend can call the Responses API. Without it, the local deterministic Game Master keeps development playable without fabricating future canon.

## Engine

`backend/services/turn-engine.service.js` treats player text as intent, not reality. It bounds experience, mana, health, abilities, relationship deltas, chapter movement, death, and completion. It rejects arbitrary chapter skipping and overpowered early abilities.

## Progression

There is no class picker. Hidden development signals accumulate from behavior:

- combat
- scouting
- magic
- analysis
- leadership
- support
- survival
- predator
- soul

Levels and evolution are controlled by backend rules. Important powers require a reason and cannot be randomly granted.

## Database

Migrations are deterministic:

- `001_deep_saga_core.sql`
- `002_ant_world_book.sql`
- `003_ant_world_story_guide.sql`
- `004_ant_world_state.sql`

Run:

```bash
cd backend
npm run migrate
```

For development reset:

```bash
cd backend
npm run db:reset
```

The reset drops old 0.3 gameplay tables and new 0.3 story tables, then reapplies the clean baseline. It refuses to run in production unless the explicit destructive override is set.

## Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm run migrate
npm run dev
```

Required backend environment:

- `SITE_ID`
- `API_KEY`
- `DBMS_URL`
- `AUTH_TOKEN_SECRET`
- optional `OPENAI_API_KEY`
- optional `OPENAI_MODEL`

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend environment may contain only public Vite configuration such as `VITE_API_BASE_URL`.

## Frontend Flow

Routes:

- `/`
- `/login`
- `/register`
- `/library`
- `/books/ant-world`
- `/play/:runId`
- `/journey/:runId`

Flow:

Create account -> Library -> Ant World detail -> Start run -> cinematic opening -> story reader -> death/completion/journey.

The reader keeps narration central, renders optional suggested choices, and always provides a free-form action composer while the run is active. Character, discoveries, relationships, and objectives are available through the journal panel without exposing hidden engine stats or future spoilers.

## Tests

Backend:

```bash
cd backend
npm test
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Adding Future Books

Add book-specific metadata, starting state, canon, reveal rules, and chapter guide under `backend/books/<book-slug>/`, seed it through migrations, and reuse the generic run/turn/message/state engine.

## Current Status

Implemented in 0.3:

- account auth separated from story bodies
- Ant World Book I metadata and 15-chapter Story Guide
- canonical run creation
- persistent messages and state domains
- idempotent action requests
- structured Game Master proposal validation
- bounded engine consequences
- death/completion blocking
- library, book detail, reader, journal, and journey UI
- development reset with production protection
