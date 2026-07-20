# Deep Saga 0.3

Deep Saga 0.3 is the combat-focused reincarnation choice RPG version.

Players start as themselves, die in the real world, and wake inside Deep Saga as one random weak base body:

- Reincarnated as a Slime: weak at first, built around absorption, adaptation, and extreme late growth.
- Reincarnated as a Spider: extremely weak at first, built around venom, webs, movement, analysis, and survival.

The AI acts as Game Master. Player input is always an attempted action, not automatic truth. Bad choices can kill the current body, even in the first fight.

## Current Game Flow

```txt
Player registers or logs in
  -> backend restores saved player, active body, skills, memories, and boss stage
  -> player chooses a narrator persona
  -> player opens the story reader
  -> backend builds the AI context from SQL
  -> prompts.js instructs the AI to run the current boss stage
  -> AI returns narration, choices, state changes, records, and memories
  -> backend applies confirmed resource/skill changes and saves the turn
```

Later turns:

```txt
Player clicks a choice or types an action
  -> backend loads recent story_messages and story_memory
  -> backend includes current boss data from the 10-boss gauntlet
  -> AI resolves the action as combat, survival, analysis, recovery, or boss preparation
  -> backend saves the player action and narrator response
```

## Boss Gauntlet

The game now uses 10 boss stages. Each stage is one boss encounter. The first boss is easier because she is cocky and overlooks the newborn player, but she can still kill them.

Played order:

1. Gloria Taratect
2. Clayman
3. Araba
4. Mother (Queen Taratect)
5. Hinata Sakaguchi
6. Demon Lord Ariel
7. Milim Nava
8. Veldora Tempest
9. Guy Crimson
10. Administrator D

Power scale strongest to weaker:

```txt
Administrator D
Guy Crimson
Veldora Tempest
Milim Nava
Demon Lord Ariel
Hinata Sakaguchi
Mother (Queen Taratect)
Araba
Clayman
Gloria Taratect
```

## Backend

Location:

```txt
0.3/backend
```

Main files:

| File | Purpose |
| --- | --- |
| `server.js` | Express app and route mounting |
| `router/auth.router.js` | Register, login, session status, personas |
| `router/story.router.js` | Story narration endpoint |
| `services/player.service.js` | Player creation, schema setup, body/boss/skill seeds |
| `services/narrator.service.js` | Builds AI context and calls OpenAI |
| `config/prompts.js` | Deep Saga 0.3 Game Master prompt |
| `migrations/001_deep_saga_0_3_boss_gauntlet.sql` | Baseline SQL for the 0.3 schema and boss table |
| `scripts/migrate.js` | Runs schema setup and seeds through the JS runtime path |

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
VITE_API_BASE_URL=https://your-backend-domain/api
```

## Setup

Backend:

```bash
cd 0.3/backend
npm install
npm run migrate
npm run dev
```

Frontend:

```bash
cd 0.3/frontend
npm install
npm run dev
```
