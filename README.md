# Deep Saga

Deep Saga is a story-first dark fantasy RPG simulation. The player experiences the game like an interactive novel: each scene is written as narration, characters speak in dialogue, and the player shapes the story by choosing an option or typing a custom action.

The chat format is only the presentation layer. The goal is not to feel like a messaging app. The goal is to feel like reading and shaping a living fantasy novel.

## What We Have

### Backend

The backend is an Express API with mounted routers:

```txt
GET  /
GET  /api/health

GET  /api/auth
POST /api/auth/register
POST /api/auth/login

GET  /api/souls
POST /api/souls

GET  /api/story
POST /api/story/continue

GET  /api/deep-saga
GET  /api/deep-saga/flow
```

Current backend pieces:

- Express server in `backend/src/server.js`
- Router index in `backend/src/routes/index.js`
- Auth router for register/login placeholders
- Soul router for reincarnation/soul records
- Story router for continuing the narrative
- Deep Saga router for the game flow
- MySQL database connection through `mysql2`
- MySQL schema migration in `backend/migrations/001_deep_saga_mysql_schema.sql`
- Helmet security headers
- Nodemon development server
- Environment loading from `backend/.env`
- Safe example env file in `backend/.env.example`

### Frontend

The frontend is a React/Vite app with a novel-style story interface.

Current frontend pieces:

- Story simulation page
- Large readable story panel
- Chapter and area titles
- Character dialogue formatting
- Top status bar showing HP, MP, Level, Dungeon, and Floor
- Choice buttons for quick decisions
- Custom action input for free-form player actions
- Collapsible character sheet
- Soul memory panel
- Dungeon structure panel
- Axios API client
- Feature folders with module CSS per component

Main frontend folders:

```txt
frontend/src/api
frontend/src/features/deepSaga/components
frontend/src/features/deepSaga/data
frontend/src/features/deepSaga/pages
```

## What The System Does

### Story Flow

Deep Saga begins with the player's death in the real world. The player does not choose how it happens. They simply experience the opening scene.

After death, the player awakens in Deep Saga inside a random avatar. The character does not understand the world yet, and the story reveals the world naturally through scenes, choices, danger, dialogue, and discovery.

The current flow is:

1. Death
2. Awakening
3. The Story Begins
4. Choices
5. Exploration
6. Growth
7. Death and Reincarnation
8. The End of the Cycle
9. A New Legend

### Dungeon Structure

The game is designed around 10 Dungeons.

Each Dungeon has 5 Floors:

- Floor 1 introduces the Dungeon and its dangers.
- Floor 2 reveals puzzles, lore, or stronger enemies.
- Floor 3 raises the stakes with tougher encounters and important decisions.
- Floor 4 builds tension before the climax.
- Floor 5 is always the Boss Floor.

Defeating the Boss Floor unlocks the next Dungeon.

### Player Decisions

At important moments, the story pauses and presents 3-5 choices. The player can either pick one of those choices or type a completely original action.

The system is intended to judge the action based on:

- The current scene
- The character's body and stats
- Inventory
- Skills
- Previous choices
- Dungeon memory
- Soul memory

### Death And Reincarnation

If the player dies, that character's story ends. A new story begins with a new random avatar.

The world treats the new avatar as a stranger, but the soul remembers previous lives. This makes knowledge and memory part of progression.

### Legacy Guardians

When a player completes the full cycle, that completed character becomes part of Deep Saga's history.

In the next completed journey, the final enemy is the previous completed hero. The goal is for that boss to fight like the player once did, based on remembered behavior, favorite weapons, preferred skills, strengths, weaknesses, and decision style.

## Environment

Create a real backend env file from the example:

```txt
backend/.env.example
```

Required backend values include:

```txt
PORT=4000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=deep_saga
DB_MIGRATIONS_DIR=./migrations

OPENAI_API_KEY=replace-with-your-key
OPENAI_MODEL=gpt-4o-mini
AI_TEMPERATURE=0.8
```

Do not commit `backend/.env`.

## Running Locally

Backend:

```sh
cd backend
npm install
npm run dev
```

Frontend:

```sh
cd frontend
npm install
npm run dev
```

Default local URLs:

```txt
Backend:  http://localhost:4000
Frontend: http://localhost:5173
```

## Notes

- `node_modules` and build output are ignored.
- Real secrets belong only in local `.env` files.
- The current story UI has local sample scenes.
- The backend story route is prepared for AI-driven continuation, but full persistence and production auth are still future work.
