import { fetchAuthStatus } from './authApi'
import { expireStoredSession, SESSION_EXPIRED_MESSAGE } from './httpClient'
import { request } from './httpClient'

const DUNGEON_NAMES = [
  'Crimson Wakewood',
  'Glassweb Dominion',
  'Drowned Crown',
  'Ashbell Academy',
  'Throne of Echoes',
]

function storyKey(player) {
  return `deepSagaStory:${player.playerId}:${player.currentRun}`
}

function readStory(player) {
  try {
    return JSON.parse(localStorage.getItem(storyKey(player)) || '[]')
  } catch {
    return []
  }
}

function writeStory(player, messages) {
  localStorage.setItem(storyKey(player), JSON.stringify(messages.slice(-80)))
}

function choicesFromScene(scene, stamp) {
  return (scene.choices || []).map((choice, index) => ({
    id: `path-${stamp}-${index}`,
    title: String(choice),
    text: String(choice),
    action: String(choice),
    direction: `Path ${index + 1}`,
  }))
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
  const dungeon = Number(body.dungeon || 1)
  const floor = Number(body.floor || 1)
  return {
    story_cycle_id: Number(player.currentRun || 1),
    cycle_number: Number(player.currentRun || 1),
    status: body.status === 'dead' ? 'dead' : 'in_progress',
    character_name: body.name || `${body.race || 'Unknown'} Soul`,
    race_name: body.race || 'Unknown',
    class_name: body.class || 'Reincarnated Monster',
    level: Number(body.level || 1),
    dungeon_name: DUNGEON_NAMES[dungeon - 1] || `Dungeon ${dungeon}`,
    floor_name: floor === 3 ? 'Boss Floor' : floor === 2 ? 'The Deepening Path' : 'The First Threshold',
  }
}

function stateFromPlayer(player) {
  const body = player.currentBody || {}
  const dungeonNumber = Number(body.dungeon || 1)
  const floorNumber = Number(body.floor || 1)
  const maxHp = Number(body.maxHp || 100)
  const maxMana = Number(body.maxMana || 30)
  const maxStamina = Number(body.maxStamina || 50)

  return {
    run: {
      id: Number(player.currentRun || 1),
      status: body.status === 'dead' ? 'dead' : 'in_progress',
      character_status: body.status === 'dead' ? 'dead' : 'alive',
    },
    characterSheet: {
      character_name: body.name || `${body.race || 'Unknown'} Soul`,
      race_name: body.race || 'Unknown',
      class_name: body.class || 'Reincarnated Monster',
      level: Number(body.level || 1),
      hp: Number(body.hp ?? maxHp),
      max_hp: maxHp,
      mana: Number(body.mana ?? maxMana),
      max_mana: maxMana,
      stamina: Number(body.stamina ?? maxStamina),
      max_stamina: maxStamina,
      gold: Number(body.gold || 0),
      xp: Number(body.xp || 0),
      xp_needed: Number(body.xpNeeded || 100),
    },
    currentDungeon: {
      id: dungeonNumber,
      dungeon_number: dungeonNumber,
      name: DUNGEON_NAMES[dungeonNumber - 1] || `Dungeon ${dungeonNumber}`,
    },
    currentFloor: {
      id: dungeonNumber * 100 + floorNumber,
      floor_number: floorNumber,
      floor_name: floorNumber === 3 ? 'Boss Floor' : floorNumber === 2 ? 'The Deepening Path' : 'The First Threshold',
      description: `You inhabit a ${body.race || 'new'} body in a Dungeon that remembers every decision.`,
      story_purpose: floorNumber === 3 ? 'Confront the Dungeon boss.' : floorNumber === 2 ? 'Discover the danger and prepare for the boss.' : 'Explore, survive, and understand this reincarnation.',
    },
    skills: (body.skills || []).map((name, index) => ({ id: index + 1, name, skill_level: 1 })),
    inventory: body.inventory || [],
    narrativeHistory: readStory(player),
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
  return stateFromPlayer(await currentPlayer())
}

export async function createOpeningNarrative() {
  const player = await currentPlayer()
  const history = readStory(player)

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
  const history = readStory(player)
  const response = await request('/story/opening', {
    method: 'POST',
    body: JSON.stringify({
      playerAction: payload.playerAction,
      recentMessages: history.slice(-12),
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
