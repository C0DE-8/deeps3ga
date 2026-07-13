# Deep Saga 0.2

Deep Saga 0.2 is the active lightweight version of the game.

It is a dark fantasy reincarnation text RPG where the player reads and shapes the story through a book-like interface. The AI acts as the Game Master and narrator. The backend stores the player account, current monster body, narrator persona, memories, and auth state, then sends that saved state to the AI for each story turn.

## What This Version Does

- Registers players with username, email, and password.
- Logs in players with username or email plus password.
- Creates a random first monster body for each new player.
- Lets players choose one of three narrator personas.
- Starts the story with real-world death, reincarnation, and awakening in Deep Saga.
- Sends the player's current state and recent story history to the AI narrator.
- Lets players pick suggested choices or type custom actions.
- Presents the game as an interactive fantasy novel, not a chat app.
- Uses a simplified 5-dungeon structure:
  - 5 dungeons total
  - 3 floors per dungeon
  - Floor 3 is the boss floor
  - Dungeon 5 Floor 3 is the final boss
- Stores dungeon/floor progression numerically. AI-created names are story labels, not progression IDs.

## Current Game Flow

```txt
Player logs in
  -> frontend restores session with /api/auth/status
  -> player opens Library
  -> player selects narrator persona
  -> player opens current story
  -> if no story exists, frontend asks backend for the opening scene
  -> backend loads saved player state
  -> backend builds AI context
  -> prompts.js builds the Game Master prompt
  -> OpenAI returns narration, choices, and optional state records
  -> frontend stores the story page locally and displays it
```

For later turns:

```txt
Player chooses a button or types an action
  -> frontend sends playerAction and recentMessages
  -> backend sends saved state + recent story to AI
  -> AI continues the scene
  -> frontend appends the new page
```

## AI Role

The AI is the Game Master.

It decides:

- narration
- immediate outcome
- NPC and enemy reactions
- discoveries
- danger
- consequences
- next choices

The player may attempt anything, but statements are attempts, not facts.

Examples:

- "I become a god" does not grant godhood.
- "I instantly kill the boss" becomes an attack attempt.
- "I go to the final floor" does not skip floors.
- "I have infinite gold" does not add gold.

These rules live in:

```txt
backend/config/prompts.js
```

## Narrator Personas

Users can choose one of three personas from the Library page.

| Persona | Role | Style |
| --- | --- | --- |
| `ADMIN` | The Divine Administrator | Cold, analytical, survival-focused |
| `TRICKSTER` | The Chaotic Observer | Playful, mocking, dangerous |
| `SENSEI` | The Iron Mentor | Stern, tactical, martial |

The selected persona is saved in SQL as:

```txt
deep_saga_players.narrator_persona
```

The backend sends it into `buildGameMasterPrompt()`.

## Backend

Location:

```txt
0.2/backend
```

Main files:

| File | Purpose |
| --- | --- |
| `server.js` | Express app and route mounting |
| `router/auth.router.js` | Register, login, session status, personas |
| `router/story.router.js` | Story narration endpoint |
| `services/player.service.js` | Player creation, login, persona saving, schema setup |
| `services/narrator.service.js` | Builds AI context and calls OpenAI |
| `config/prompts.js` | Deep Saga Game Master prompt and personas |
| `middleware/auth.js` | Token auth and player loading |
| `utils/token.js` | Token creation and verification |
| `scripts/migrate.js` | Runs schema setup |

Backend routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/` | API info |
| `GET` | `/health` | DB gateway health |
| `POST` | `/api/auth/register` | Create player with username, email, and password |
| `POST` | `/api/auth/login` | Login with username or email plus password |
| `GET` | `/api/auth/status` | Safe session check |
| `GET` | `/api/auth/me` | Protected current player |
| `GET` | `/api/auth/personas` | List narrator personas |
| `PATCH` | `/api/auth/persona` | Save selected persona |
| `POST` | `/api/story/opening` | Create/continue AI narration |

## Frontend

Location:

```txt
0.2/frontend
```

Main files:

| File | Purpose |
| --- | --- |
| `src/App.jsx` | Routes |
| `src/api/httpClient.js` | API base URL, token handling |
| `src/api/authApi.js` | Auth/persona requests |
| `src/api/deepSagaApi.js` | Game state adapter and story calls |
| `src/features/auth` | Login/register/session provider |
| `src/features/library/pages/LibraryPage.jsx` | Story library and persona selector |
| `src/features/story/pages/StoryPage.jsx` | Book-like reader |

Frontend pages:

| Route | Purpose |
| --- | --- |
| `/login` | Login |
| `/register` | Register |
| `/library` | Story archive and persona selector |
| `/read/:cycleId` | Interactive story reader |

## Environment

Backend env:

```txt
SITE_ID=your_project_site_id
API_KEY=full_dbms_api_key_not_the_short_prefix
DBMS_URL=https://api.dbms.copupbid.com
DBMS_TIMEOUT_MS=15000
AUTH_TOKEN_SECRET=change_this_long_random_secret
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
DEEP_SAGA_PERSONA=ADMIN
ALLOW_STATIC_NARRATOR_FALLBACK=false
```

Frontend env:

```txt
VITE_API_BASE_URL=https://deeps3ga-b.vercel.app/api
```

Important:

- `OPENAI_API_KEY` is required for real narration.
- If `ALLOW_STATIC_NARRATOR_FALLBACK=false`, missing OpenAI config causes narration to fail clearly.
- `.env` files are ignored and should not be committed.
- Use `.env.example` files as templates.

## Setup

Backend:

```bash
cd 0.2/backend
npm install
npm run migrate
npm run dev
```

Frontend:

```bash
cd 0.2/frontend
npm install
npm run dev
```

Default local ports:

- Backend: depends on `PORT`, default `3000`
- Frontend: Vite default `5173`

## Verification

Backend:

```bash
cd 0.2/backend
npm test
```

Frontend:

```bash
cd 0.2/frontend
npm run lint
npm run build
```

Note: current local Node is `20.17.0`; Vite recommends `20.19+` or `22.12+`. The build still completes, but upgrading Node is cleaner.

## Data Storage

Saved in SQL:

- player ID
- username
- email
- password hash
- selected narrator persona key
- current run
- cycle clears
- current monster body
- memory log
- timestamps

Normalized SQL tables:

| Table | Purpose |
| --- | --- |
| `deep_saga_players` | Account, auth-facing player ID, selected persona, current run, memory JSON |
| `narrator_persona` | Persona catalog for `ADMIN`, `TRICKSTER`, and `SENSEI` |
| `dungeons` | Canonical numeric dungeon records, `Dungeon 1` through `Dungeon 5` |
| `dungeon_floors` | Canonical numeric floor records, 3 floors per dungeon, with boss/final flags |
| `ai_location_names` | Names the AI gives to dungeons, floors, areas, or bosses during narration |
| `player_characters` | Active/current character stats such as HP, Mana, Stamina, level, RPG attributes, location, Gold, and Soul Energy |
| `skills` | Skill catalog |
| `player_character_skills` | Skills unlocked by each character |

Currently stored in browser `localStorage`:

- recent story pages
- narrator messages
- player messages
- generated choices

This means the current 0.2 story history is browser-local. The backend receives recent story messages from the frontend each turn so the AI can continue the scene, but long-term story persistence should eventually move into SQL.

## Current Limitations

0.2 is intentionally lighter than 0.1.

Implemented:

- auth
- session restore
- random starting monster body
- narrator personas
- AI Game Master prompt
- AI opening scene
- recent-message continuity
- book-style frontend reader

Not fully implemented yet:

- SQL-backed story message history
- full combat math
- floor completion persistence
- dungeon progression persistence
- boss HP and phases
- inventory changes from AI state changes
- applying skill awards from AI state changes
- reincarnation after death
- legacy boss record creation
- admin dashboard

The design direction is to keep 0.2 playable and free first, then add stronger systems from 0.1 one at a time.

## Why 0.2

0.1 has a larger engine, but it is heavier and stricter.

0.2 is the better current base because:

- it is easier to deploy
- it is easier to debug
- it lets the AI act more freely as Game Master
- it keeps the user experience closer to an interactive fantasy novel

The plan is not to abandon 0.1's ideas. The plan is to borrow the useful systems into 0.2 only when they are needed.
