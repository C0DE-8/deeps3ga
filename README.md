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
GET  /api/auth/me
POST /api/auth/logout

GET  /api/souls
POST /api/souls

GET  /api/story
POST /api/story/continue

GET  /api/game
GET  /api/game/state/:storyCycleId
POST /api/game/continue
POST /api/game/cycles/:storyCycleId/death
POST /api/game/cycles/:storyCycleId/complete

GET  /api/admin/overview
GET  /api/admin/data/:dataset

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
- Database-backed game engine and state loader
- Immutable Legacy Hero snapshots for completed runs
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

The client sends only the story cycle, the player's action, and whether the action was typed or selected:

```json
{
  "storyCycleId": 12,
  "playerAction": "I break the lantern and use the flame to drive the wolves back.",
  "actionKind": "typed"
}
```

The engine loads the character sheet, location, floor, present NPCs and monsters, boss state, active quests, companions, skills, inventory, previous choices, Dungeon adaptations, soul memories, and previous Legacy Hero before calling the narrator.

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

### World Content Arrangement

Deep Saga content is arranged from the largest story area down to the abilities a character can learn:

```txt
10 Realms / Dungeons
  -> 5 Floors per Realm
  -> 50 Floors total
  -> 1 Floor Story per Floor
  -> NPCs present on that Floor
  -> Monsters available on that Floor
  -> Items found, carried, sold, or dropped there
  -> Skills that can be used, trained, discovered, or unlocked there
  -> Quests and hidden events tied to that Floor

Every Realm Floor 5
  -> 1 Main Boss
  -> Boss phases, skills, dialogue, weaknesses, and rewards

Realm 10 Floor 5
  -> The previous completed Legacy Hero
```

The IDs in the content workbook connect these records:

```txt
REALM-03
  FLOOR-03-04
    STORY-03-04
    NPC-03-04-002
    MON-03-04-006
    QUEST-03-005
    EVENT-03-04-002

BOSS-03
ITEM-03-041
SKILL-087
```

The editable content format is in [`backend/data/DEEP_SAGA_CONTENT_WORKBOOK.txt`](backend/data/DEEP_SAGA_CONTENT_WORKBOOK.txt). It contains blank templates and examples for realms, floors, floor stories, NPCs, monsters, bosses, items, skills, quests, and hidden events.

### Current Content Inventory

The project separates the world structure that already exists from the larger authored-content target:

| Content | Currently Seeded | Target | Current State |
| --- | ---: | ---: | --- |
| Realms / Dungeons | 10 | 10 | Complete structure |
| Floors | 50 | 50 | Complete structure, five per realm |
| Floor descriptions and purposes | 50 | 50 | Seeded inside the floor records |
| Separate story chapter records | 0 | 50+ | Awaiting full authored scenes |
| NPCs | 9 | 100+ | One principal NPC for Realms 1-9 |
| Monsters | 9 | 300+ | One introductory monster for Realms 1-9 |
| Main Boss profiles | 10 | 10 | Complete initial boss set |
| Items | 3 | 500 | Starter weapon, armor, and first boss relic |
| Skills | 4 | 200 | Two starter skills and two catalog skills |
| Quests | 0 | To be authored | Schema and run-state support exist |
| Active companions | 0 | Story-dependent | Created during player runs |
| Legacy Heroes | 0 | Player-created | Created only after a completed run |

The 50 seeded floors already contain names, descriptions, atmosphere, purpose, available NPC and monster names, hidden-event ideas, story purpose, and boss-floor rules. A full `world_story_chapters` entry is still needed when each floor receives its complete authored scene flow, decisions, consequences, and ending.

### Realm And Floor Records

Each Realm record stores:

- Realm number and name
- Place type, such as kingdom, forest, academy, market, or island chain
- Description and theme
- Difficulty
- Unlock requirements
- Main story arc

Each Floor record stores:

- Realm and floor number
- Floor name and type
- Story purpose
- Description and atmosphere
- Available monsters and NPCs
- Hidden events
- Quiet-chapter support
- Floor memory
- Boss rules when the floor is Floor 5

### Floor Stories

Every Floor Story should define:

- Opening situation
- Important story beats
- Main discovery
- Conversations and quiet moments
- Meaningful choices with different consequences
- Creative typed actions that can work
- Actions that should fail and why
- Combat and non-combat solutions
- Memories that must be saved
- Ending and movement to the next floor

The AI reads the authored Floor Story and current run state. It narrates one scene at a time and must not replace the authored story with unrelated permanent lore.

### NPC And Companion Content

NPC records can contain identity, race, appearance, personality, speech style, backstory, goals, fears, secrets, location, dialogue, quests, carried items, known skills, relationship state, and life status.

Some NPCs can become companions. Companion run records additionally store:

- Trust, loyalty, fear, and relationship changes
- Personal secrets
- Advice style
- Memories of how the player treated them
- Whether they are active, dead, missing, or departed

### Monster Content

Monster records define more than combat statistics. They can include:

- Name, species, description, and habitat
- HP, attack, defense, speed, magic, and other stats
- Skills and attack rhythm
- Intelligence and temperament
- Reactions to fire, magic, fear, kindness, and player creativity
- Weaknesses and resistances
- Retreat, taming, and friendship conditions
- Normal and rare item drops
- Adaptation rules for repeated player tactics

Run-specific monster records track current HP, current floor, status, and encounter state without changing the original monster definition.

### Boss Content

There are 10 seeded Main Boss profiles, one for every Realm Floor 5. Boss data supports:

- Name, species, motive, personality, and secret
- Memorable entrance and defeat text
- Introduction, battle, victory, and defeat dialogue
- Arena and music direction
- Stats, active skills, and passive skills
- Multiple phases and transition conditions
- Weaknesses, resistances, and rewards
- Memory of player choices
- Counters for repeated tactics
- Combat and optional non-combat victory rules

The tenth boss is replaced with the latest eligible Legacy Hero when one exists. The AI reads the locked Legacy Hero snapshot instead of inventing that boss.

### Item Content

Item records support weapons, armor, accessories, consumables, quest items, relics, and materials. Each item can define rarity, story origin, effects, equipment slot, uses, discovery requirements, monster drops, NPC sellers, quest rewards, taught skills, and whether a Legacy Boss can use it.

Character inventory is separate from the item catalog. It records which character owns an item, quantity, equipment slot, and the current condition or state of that specific item.

### Skill Content And Action Unlocks

Skill definitions support active, passive, reaction, and ultimate abilities. Each skill can define its category, effects, costs, requirements, maximum level, mastery conditions, compatible monsters and bosses, and Legacy Boss compatibility.

The intended skill flow is action-based:

```txt
Player attempts an action
  -> Engine checks the scene, body, stats, items, and existing skills
  -> Action succeeds, partially succeeds, or fails
  -> Result is stored in choice history and story memory
  -> Engine compares successful behavior with database skill requirements
  -> Matching skill is added to character_skills
  -> AI narrates the discovery using the saved skill definition
```

Skills can unlock from:

- A creative action that succeeds in the current situation
- Repeating a meaningful action enough times
- Protecting, negotiating, studying, crafting, climbing, healing, or surviving
- Training with an NPC who knows the skill
- Using or studying a particular item
- Completing a quest
- Defeating a boss under a special condition
- Race or class development
- Reincarnation and soul memory

Failed, impossible, or meaningless repeated actions must not unlock skills. The AI cannot create or award a permanent skill by itself.

Currently, new characters automatically receive `Brace` and `Soul Echo`. The database also contains `Ember Thread` and `Predator Step`. Choice history, parsed intent, skill requirements, skill levels, and use counts are stored, but the automatic action-to-skill evaluator is not implemented yet. Until that module is added, the narrator's `newItemsOrSkills` response is recorded but does not automatically grant a skill.

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

A death never creates a Legacy Hero. It closes the current body and updates the soul's reincarnation history only.

After all 10 realm bosses are recorded as defeated, completion creates a separate, locked Legacy Hero. It freezes identity, appearance, personality, titles, final stats, every skill and skill level, equipment, inventory, combat behavior, arena, music, dialogue, passives, and phase rules. Later reincarnations cannot modify that snapshot.

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
npm run migrate
npm run dev
```

Public registration always creates a player. To grant God's Eye access, register the account normally and promote it from the backend:

```sh
cd backend
npm run make-admin -- username-or-email
```

God's Eye exposes read-only, paginated views of players, souls, characters, cycles, dungeons, floors, bosses, NPCs, monsters, skills, items, quests, memories, choices, companions, and Legacy Heroes. Its API requires an active administrator session.

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
- Story continuation is database-backed. Production authentication and authorization middleware are still future work.
