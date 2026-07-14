import { fetchAuthStatus } from './authApi'
import { expireStoredSession, SESSION_EXPIRED_MESSAGE } from './httpClient'
import { request } from './httpClient'

function storyKey(player) {
  return `deepSagaStory:${player.playerId}:${player.currentRun}`
}

function writeStory(player, messages) {
  localStorage.setItem(storyKey(player), JSON.stringify(messages.slice(-80)))
}

function cleanText(value) {
  const text = String(value || '').trim()
  return text === '[object Object]' ? '' : text
}

function normalizeChoice(choice, index, stamp = 'saved') {
  const fallbackDirection = `Path ${index + 1}`

  if (typeof choice === 'string') {
    const title = cleanText(choice)
    if (!title) return null
    return {
      id: `path-${stamp}-${index}`,
      title,
      text: '',
      action: title,
      direction: fallbackDirection,
    }
  }

  if (choice && typeof choice === 'object') {
    const title = cleanText(choice.title || choice.label || choice.text || choice.action)
    const text = cleanText(choice.text || choice.description || choice.detail)
    const action = cleanText(choice.action || choice.text || title)
    const direction = cleanText(choice.direction || choice.type || fallbackDirection)
    const id = cleanText(choice.id) || `path-${stamp}-${index}`

    if (!title && !text && !action) return null

    return {
      id,
      title: title || action || text,
      text: text && text !== title ? text : '',
      action: action || title || text,
      direction: direction || fallbackDirection,
    }
  }

  return null
}

function choicesFromScene(scene, stamp) {
  return (scene.choices || [])
    .map((choice, index) => normalizeChoice(choice, index, stamp))
    .filter(Boolean)
}

function sceneMessages({ scene, choices, stamp, playerAction = '' }) {
  const messages = []

  if (playerAction) {
    messages.push({ id: `player-${stamp}`, speaker: 'player', message_text: playerAction })
  }

  messages.push({ id: `narrator-${stamp}`, speaker: 'narrator', message_text: scene.narration, choices_json: choices })
  return messages
}

async function currentPlayer() {
  const response = await fetchAuthStatus()

  if (!response.authenticated) {
    expireStoredSession(response.message || SESSION_EXPIRED_MESSAGE)
    const error = new Error(response.message || SESSION_EXPIRED_MESSAGE)
    error.status = 401
    throw error
  }

  return response.data.player
}

function saveFromPlayer(player) {
  const body = player.currentBody || {}
  const character = player.activeCharacter || {}
  const runtime = player.floorRuntime || {}
  const dungeon = Number(runtime.dungeonNumber || character.dungeon || body.dungeon || 1)
  const floor = Number(runtime.floorNumber || character.floor || body.floor || 1)
  return {
    story_cycle_id: Number(player.currentRun || 1),
    cycle_number: Number(player.currentRun || 1),
    status: character.status === 'dead' || body.status === 'dead' ? 'dead' : 'in_progress',
    character_name: character.characterName || body.name || `${character.race || body.race || 'Unknown'} Soul`,
    race_name: character.race || body.race || 'Unknown',
    class_name: character.className || body.class || 'Reincarnated Monster',
    level: Number(character.level || body.level || 1),
    dungeon_name: runtime.dungeonAiName || runtime.dungeonLabel || `Dungeon ${dungeon}`,
    floor_name: runtime.floorAiName || runtime.floorLabel || `Dungeon ${dungeon} Floor ${floor}`,
    canonical_dungeon_name: runtime.dungeonLabel || `Dungeon ${dungeon}`,
    canonical_floor_name: runtime.floorLabel || `Dungeon ${dungeon} Floor ${floor}`,
    ai_floor_name: runtime.floorAiName || '',
  }
}

async function fetchStoryHistory() {
  const response = await request('/story/history?limit=80')
  return (response.data.messages || []).map((message) => ({
    ...message,
    choices_json: Array.isArray(message.choices_json)
      ? message.choices_json.map((choice, index) => normalizeChoice(choice, index, `sql-${message.id || index}`)).filter(Boolean)
      : [],
  }))
}

async function fetchPlayerSheet() {
  const response = await request('/story/stats')
  return response.data
}

function isStatsAction(action) {
  return /^(stats?|status|sheet|character\s*sheet|player\s*sheet)$/i.test(String(action || '').trim())
}

function latestChoices(history) {
  const narrator = [...history].reverse().find((message) => message.speaker === 'narrator' && Array.isArray(message.choices_json) && message.choices_json.length)
  return narrator?.choices_json || []
}

function stateFromPlayer(player, narrativeHistory = []) {
  const body = player.currentBody || {}
  const character = player.activeCharacter || {}
  const runtime = player.floorRuntime || {}
  const dungeonNumber = Number(runtime.dungeonNumber || character.dungeon || body.dungeon || 1)
  const floorNumber = Number(runtime.floorNumber || character.floor || body.floor || 1)
  const maxHp = Number(character.maxHp || body.maxHp || 100)
  const maxMana = Number(character.maxMana || body.maxMana || 30)
  const maxStamina = Number(character.maxStamina || body.maxStamina || 50)

  return {
    run: {
      id: Number(player.currentRun || 1),
      status: character.status === 'dead' || body.status === 'dead' ? 'dead' : 'in_progress',
      character_status: character.status === 'dead' || body.status === 'dead' ? 'dead' : 'alive',
    },
    characterSheet: {
      character_name: character.characterName || body.name || `${character.race || body.race || 'Unknown'} Soul`,
      race_name: character.race || body.race || 'Unknown',
      class_name: character.className || body.class || 'Reincarnated Monster',
      level: Number(character.level || body.level || 1),
      hp: Number(character.hp ?? body.hp ?? maxHp),
      max_hp: maxHp,
      mana: Number(character.mana ?? body.mana ?? maxMana),
      max_mana: maxMana,
      stamina: Number(character.stamina ?? body.stamina ?? maxStamina),
      max_stamina: maxStamina,
      gold: Number(character.gold || body.gold || 0),
      xp: Number(body.xp || 0),
      xp_needed: Number(body.xpNeeded || 100),
      strength: Number(character.strength || body.strength || 5),
      agility: Number(character.agility || body.agility || 5),
      defense: Number(character.defense || body.defense || 5),
      thaumaturgy: Number(character.thaumaturgy || body.thaumaturgy || 5),
      resolve: Number(character.resolve || body.resolve || 5),
      intelligence: Number(character.intelligence || body.intelligence || 5),
      luck: Number(character.luck || body.luck || 5),
      charisma: Number(character.charisma || body.charisma || 5),
      soul_energy: Number(character.soulEnergy || body.soulEnergy || 0),
    },
    currentDungeon: {
      id: dungeonNumber,
      dungeon_number: dungeonNumber,
      name: runtime.dungeonAiName || runtime.dungeonLabel || `Dungeon ${dungeonNumber}`,
      canonical_name: runtime.dungeonLabel || `Dungeon ${dungeonNumber}`,
      ai_name: runtime.dungeonAiName || '',
    },
    currentFloor: {
      id: dungeonNumber * 100 + floorNumber,
      floor_number: floorNumber,
      floor_name: runtime.floorAiName || runtime.floorLabel || `Dungeon ${dungeonNumber} Floor ${floorNumber}`,
      canonical_name: runtime.floorLabel || `Dungeon ${dungeonNumber} Floor ${floorNumber}`,
      ai_name: runtime.floorAiName || '',
      description: `You inhabit a ${body.race || 'new'} body in a Dungeon that remembers every decision.`,
      story_purpose: runtime.isFinalBossFloor ? 'Final boss floor.' : runtime.isBossFloor ? 'Boss floor.' : runtime.floorRole === 'main_danger' ? 'Main danger, discoveries, and preparation.' : 'Introduction, exploration, and first conflict.',
      is_boss_floor: Boolean(runtime.isBossFloor || floorNumber === 3),
      is_final_boss_floor: Boolean(runtime.isFinalBossFloor || (dungeonNumber === 5 && floorNumber === 3)),
    },
    skills: (player.skills || body.skills || []).map((skill, index) => (
      typeof skill === 'string'
        ? { id: index + 1, name: skill, skill_level: 1 }
        : { id: skill.id || index + 1, name: skill.name, skill_level: skill.level || skill.skill_level || 1, family: skill.family, type: skill.type }
    )),
    inventory: body.inventory || [],
    narrativeHistory,
  }
}

export async function fetchGameSaves() {
  const player = await currentPlayer()
  return [saveFromPlayer(player)]
}

export async function startGame() {
  const player = await currentPlayer()
  return { storyCycleId: Number(player.currentRun || 1), resumed: true }
}

export async function fetchGameState() {
  const player = await currentPlayer()
  const history = await fetchStoryHistory()
  if (history.length) writeStory(player, history)
  return stateFromPlayer(player, history)
}

export async function createOpeningNarrative() {
  const player = await currentPlayer()
  const history = await fetchStoryHistory()

  if (history.length) {
    const narrator = [...history].reverse().find((message) => message.speaker === 'narrator')
    return { story: narrator?.message_text || '', choices: narrator?.choices_json || [], stateChanges: {}, recordChanges: [] }
  }

  const response = await request('/story/opening', {
    method: 'POST',
    body: JSON.stringify({ recentMessages: [] }),
  })
  const scene = response.data
  const stamp = Date.now()
  const choices = choicesFromScene(scene, stamp)
  writeStory(player, sceneMessages({ scene, choices, stamp }))
  return { story: scene.narration, choices, stateChanges: scene.stateChanges || {}, recordChanges: scene.recordChanges || [] }
}

export async function continueNarrative(payload) {
  const player = await currentPlayer()
  const history = await fetchStoryHistory()

  if (isStatsAction(payload.playerAction)) {
    const sheet = await fetchPlayerSheet()
    const stamp = Date.now()
    const messages = [
      { id: `player-${stamp}`, speaker: 'player', message_text: payload.playerAction },
      {
        id: `stats-${stamp}`,
        speaker: 'narrator',
        message_text: 'Character Sheet',
        message_kind: 'stats',
        sheet_json: sheet,
        choices_json: latestChoices(history),
      },
    ]

    writeStory(player, [...history, ...messages])
    return {
      localOnly: true,
      messages,
      story: 'Character Sheet',
      choices: latestChoices(history),
      stateChanges: {},
      recordChanges: [],
    }
  }

  const response = await request('/story/opening', {
    method: 'POST',
    body: JSON.stringify({
      playerAction: payload.playerAction,
    }),
  })
  const scene = response.data
  const stamp = Date.now()
  const choices = choicesFromScene(scene, stamp)
  writeStory(player, [
    ...history,
    ...sceneMessages({ scene, choices, stamp, playerAction: payload.playerAction }),
  ])
  return { story: scene.narration, choices, stateChanges: scene.stateChanges || {}, recordChanges: scene.recordChanges || [] }
}
