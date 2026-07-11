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
GET  /api/deep-saga/world
```

Current backend pieces:

- Express server in `backend/src/server.js`
- Router index in `backend/src/routes/index.js`
- Auth router for register/login placeholders
- Soul router for reincarnation/soul records
- Story router for continuing the narrative
- Deep Saga router for the game flow
- World brain endpoint for the realm/floor/boss bible
- MySQL database connection through `mysql2`
- MySQL schema migrations in `backend/migrations`
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

### Database Brain, AI Storyteller

Deep Saga should not ask the AI to invent the world from scratch every turn.

The database is the brain of the game. It stores durable facts:

- Player state
- Character sheet
- Inventory
- Skills
- Titles
- Story progress
- Reincarnations
- Legacy records
- Current realm or Dungeon
- Current floor
- Floor story and purpose
- NPCs
- Monsters
- Bosses
- Items
- Quests
- Hidden events
- Dungeon memory
- Player behavior memory

The AI is the storyteller. It reads the current database state, writes the next scene, and returns structured updates for the game to persist.

Example flow:

```txt
Player: "I open the door."

Game loads:
- Player
- Current realm
- Current floor
- Floor story
- NPCs
- Boss status
- Monsters
- Active quest
- Dungeon memory

AI reads that context.
AI writes one natural scene.
Game updates the database.
```

This keeps the story consistent, lets the world be edited through data, and prevents the AI from forgetting or contradicting important facts.

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

The game is designed around 10 major realms. They can be Dungeons, kingdoms, ruins, markets, islands, libraries, or living places. The word Dungeon means a structured story zone, not always an underground cave.

Each Dungeon has 5 Floors:

- Floor 1 introduces the Dungeon and its dangers.
- Floor 2 reveals puzzles, lore, or stronger enemies.
- Floor 3 raises the stakes with tougher encounters and important decisions.
- Floor 4 builds tension before the climax.
- Floor 5 is always the Boss Floor.

Defeating the Boss Floor unlocks the next Dungeon.

Current realm set:

1. Cradlewood Threshold
2. Glassweb Hollows
3. Mire-Crown Principality
4. Ashbell Academy Ruins
5. Moon-Eaten Bazaar
6. Iron Orchard Dominion
7. Saintless Cathedral
8. Demon-Seal Archipelago
9. Chronicle Labyrinth
10. Throne of the Previous Self

Each floor should have a clear story purpose:

- Floor 1: introduction to the Dungeon and its danger
- Floor 2: puzzle, mystery, lore, or stronger enemy pressure
- Floor 3: NPC encounter, companion moment, or moral decision
- Floor 4: mini-boss, intense challenge, or emotional pressure
- Floor 5: named Boss with motive, dialogue, entrance, and defeat scene

Not every floor should be `walk -> monster -> fight`. Quiet chapters, discoveries, puzzles, and social choices make the dangerous moments stronger.

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

Choices should be genuinely different. Saving a merchant, chasing a monster, or searching ruins should lead to different scenes, consequences, memories, and future reactions.

Typed actions are a major part of the game. The system should reward creative ideas when they make sense, such as using a broken lantern to scare wolves or turning the environment against an enemy.

### Response Structure

Every narrative response should keep the story first and game information second.

Expected structure:

```txt
Story
Character changes, if any
New items or skills, if any
Choices
```

The player should feel the event before seeing numbers.

Instead of only:

```txt
HP -20
```

Use:

```txt
The claw tears across your chest, forcing you back. Your breathing becomes heavier.

HP: 60/80
```

Mechanical information supports the story; it should not replace it.

### Death And Reincarnation

If the player dies, that character's story ends. A new story begins with a new random avatar.

The world treats the new avatar as a stranger, but the soul remembers previous lives. This makes knowledge and memory part of progression.

### Legacy Guardians

When a player completes the full cycle, that completed character becomes part of Deep Saga's history.

In the next completed journey, the final enemy is the previous completed hero. The goal is for that boss to fight like the player once did, based on remembered behavior, favorite weapons, preferred skills, strengths, weaknesses, and decision style.

### Companions

Companions are characters, not just stat bonuses.

They should:

- Talk
- Disagree
- Give advice
- Hide secrets
- Remember how the player treats them
- Change how they behave based on trust, fear, loyalty, or betrayal

### Living Dungeon

The Dungeon should react like a living place.

Examples:

- Lights go out after the player relies too much on sight.
- A floor changes because of an earlier decision.
- An NPC recognizes the soul without recognizing the body.
- A boss remembers the player's previous life.
- Repeated tactics cause later enemies to adapt.

### Quiet Chapters

Not every chapter needs combat. Quiet chapters can include:

- Sitting around a campfire
- Talking with an old traveler
- Exploring an abandoned library
- Reading a mysterious diary
- Resting before a Boss Floor

These scenes give the story rhythm and make dangerous moments hit harder.

### Boss Design

Bosses should not be just stronger monsters.

Every boss should have:

- A name
- A reason for existing
- A personality
- Dialogue
- A memorable entrance
- A memorable defeat

Players should remember who they fought, not just what they fought.

### AI Rules

The AI narrator must:

- Never skip ahead
- Move the story forward one scene at a time
- Keep narration first and game information second
- Separate story, character changes, items or skills, and choices
- Avoid fake choices
- Encourage typed actions
- Keep stats hidden unless they matter
- Use companions as people with memory and personality
- Let the Dungeon react to player behavior
- Generate quiet chapters when pacing needs them
- Make bosses memorable characters

If the player opens a door, the AI should not jump straight to defeating the boss. It should describe what is beyond the door and let the next decision emerge naturally.

### Run Legends

At the end of a completed journey, the system should generate a legend summary.

Example:

```txt
The Legend of the Ashen Wolf

Completed: 10 Dungeons
Bosses Defeated: 10
Companions Lost: 2
Villages Saved: 4
Times Reincarnated: 7
Signature Skill: Shadow Claw
Final Title: The Ashen King
```

That legend becomes part of the world's history and can later return as a Legacy Guardian.

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
