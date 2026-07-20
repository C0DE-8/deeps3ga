import { fetchAuthStatus } from './authApi'
import { API_BASE_URL, expireStoredSession, getStoredToken, SESSION_EXPIRED_MESSAGE } from './httpClient'
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

  messages.push({
    id: `narrator-${stamp}`,
    speaker: 'narrator',
    message_text: scene.narration,
    choices_json: choices,
    record_changes_json: scene.recordChanges || [],
    state_changes_json: scene.stateChanges || {},
  })
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
  const characterStatus = String(character.status || body.status || 'alive').toLowerCase()
  const ended = characterStatus === 'dead' || characterStatus === 'completed'
  return {
    story_cycle_id: Number(player.currentRun || 1),
    cycle_number: Number(player.currentRun || 1),
    status: ended ? characterStatus : 'in_progress',
    character_name: character.characterName || body.name || `${character.race || body.race || 'Unknown'} Soul`,
    race_name: character.race || body.race || 'Unknown',
    class_name: character.className || body.class || 'Reincarnated Monster',
    level: Number(character.level || body.level || 1),
    dungeon_name: runtime.dungeonAiName || runtime.dungeonLabel || `Boss Stage ${dungeon}`,
    floor_name: runtime.floorAiName || runtime.floorLabel || `Boss Stage ${dungeon}`,
    canonical_dungeon_name: runtime.dungeonLabel || `Boss Stage ${dungeon}`,
    canonical_floor_name: runtime.floorLabel || `Boss Stage ${dungeon}`,
    ai_floor_name: runtime.floorAiName || '',
    boss_stage: dungeon,
    book_ended: ended,
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

function extractStatsRequest(action) {
  const original = String(action || '').trim()
  const statsPattern = /\b(show\s+me\s+my\s+stats?|show\s+my\s+stats?|show\s+me\s+the\s+stats?|stats?|status|character\s*sheet|player\s*sheet|sheet)\b/ig
  const wantsStats = statsPattern.test(original)
  statsPattern.lastIndex = 0
  const storyAction = original
    .replace(statsPattern, ' ')
    .replace(/\b(and|then|also|plus)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { wantsStats, storyAction }
}

function latestChoices(history) {
  const narrator = [...history].reverse().find((message) => message.speaker === 'narrator' && Array.isArray(message.choices_json) && message.choices_json.length)
  return narrator?.choices_json || []
}

function postBossGrowthChoices(state) {
  const bossName = state?.currentBoss?.bossName || 'the fallen boss'
  const race = state?.characterSheet?.race_name || 'new body'

  return [
    {
      id: 'post-boss-absorb-lesson',
      title: 'Listen to what survival changed',
      text: `Let the silence after ${bossName} settle and feel which instinct in your ${race} body answers first.`,
      action: `I stand in the quiet after ${bossName} falls and listen to what survival has changed inside me.`,
      direction: 'growth',
    },
    {
      id: 'post-boss-choose-skill',
      title: 'Claim the skill the battle carved into you',
      text: 'Reach for the power that matches how you survived: venom, motion, traps, defense, magic, or instinct.',
      action: 'I focus on the way I survived this battle and choose the skill that feels earned by my actions.',
      direction: 'skill',
    },
    {
      id: 'post-boss-evolve',
      title: 'Step into the next shape of your soul',
      text: 'Accept the evolution pressing beneath your skin and let this body become something the next chapter must respect.',
      action: 'I accept the evolution born from this victory and let my body transform before the next chapter begins.',
      direction: 'evolution',
    },
  ]
}

function choicesForState(state) {
  const defeated = state?.currentBoss?.status === 'defeated' || Number(state?.currentBoss?.currentHp ?? 1) <= 0
  const phase = state?.characterSheet?.story_phase || state?.characterSheet?.storyPhase

  if (phase === 'post_boss_growth' || defeated) {
    return postBossGrowthChoices(state)
  }

  return latestChoices(state?.narrativeHistory || [])
}

function stateFromPlayer(player, narrativeHistory = []) {
  const body = player.currentBody || {}
  const character = player.activeCharacter || {}
  const runtime = player.floorRuntime || {}
  const dungeonNumber = Number(runtime.dungeonNumber || character.dungeon || body.dungeon || 1)
  const floorNumber = Number(runtime.floorNumber || character.floor || body.floor || 1)
  const characterStatus = String(character.status || body.status || 'alive').toLowerCase()
  const completed = characterStatus === 'completed'
  const dead = characterStatus === 'dead'
  const maxHp = Number(character.maxHp || body.maxHp || 100)
  const maxMana = Number(character.maxMana || body.maxMana || 30)
  const maxStamina = Number(character.maxStamina || body.maxStamina || 50)
  const skills = Array.isArray(player.skills) && player.skills.length ? player.skills : body.skills || []

  return {
    run: {
      id: Number(player.currentRun || 1),
      status: dead ? 'dead' : completed ? 'completed' : 'in_progress',
      character_status: dead ? 'dead' : completed ? 'completed' : 'alive',
      book_ended: dead || completed,
      ending_type: dead ? 'death' : completed ? 'victory' : null,
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
      strength: Number(character.strength || body.strength || 5),
      agility: Number(character.agility || body.agility || 5),
      defense: Number(character.defense || body.defense || 5),
      thaumaturgy: Number(character.thaumaturgy || body.thaumaturgy || 5),
      resolve: Number(character.resolve || body.resolve || 5),
      intelligence: Number(character.intelligence || body.intelligence || 5),
      luck: Number(character.luck || body.luck || 5),
      charisma: Number(character.charisma || body.charisma || 5),
      soul_energy: Number(character.soulEnergy || body.soulEnergy || 0),
      story_phase: character.storyPhase || body.storyPhase || 'combat',
      pending_next_dungeon: character.pendingNextDungeon || null,
      last_defeated_boss: character.lastDefeatedBoss || null,
    },
    currentDungeon: {
      id: dungeonNumber,
      dungeon_number: dungeonNumber,
      name: runtime.dungeonAiName || runtime.dungeonLabel || `Boss Stage ${dungeonNumber}`,
      canonical_name: runtime.dungeonLabel || `Boss Stage ${dungeonNumber}`,
      ai_name: runtime.dungeonAiName || '',
      boss_stage: dungeonNumber,
    },
    currentBoss: player.bossProgress || null,
    currentBossProfile: player.currentBossProfile || null,
    currentFloor: {
      id: dungeonNumber * 100 + floorNumber,
      floor_number: floorNumber,
      floor_name: runtime.floorAiName || runtime.floorLabel || `Boss Stage ${dungeonNumber}`,
      canonical_name: runtime.floorLabel || `Boss Stage ${dungeonNumber}`,
      ai_name: runtime.floorAiName || '',
      description: `You inhabit a ${body.race || 'new'} body in a boss gauntlet that remembers every decision.`,
      story_purpose: completed ? 'The book is complete.' : dead ? 'The book ended in death.' : runtime.isFinalBossFloor ? 'Final boss stage.' : runtime.floorRole === 'opening_boss' ? 'Opening reincarnation battle.' : 'Boss battle, survival, and growth choices.',
      is_boss_floor: true,
      is_final_boss_floor: Boolean(runtime.isFinalBossFloor || dungeonNumber === 10),
      boss_stage: dungeonNumber,
    },
    skills: skills.map((skill, index) => (
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
  const sheet = await fetchPlayerSheet().catch(() => null)
  const mergedPlayer = sheet ? {
    ...player,
    activeCharacter: sheet.character || player.activeCharacter,
    currentBody: sheet.currentBody || player.currentBody,
    floorRuntime: sheet.floorRuntime || player.floorRuntime,
    bossProgress: sheet.bossProgress || player.bossProgress,
    currentBossProfile: sheet.currentBossProfile || player.currentBossProfile,
    skills: sheet.skills || player.skills,
    memoryLog: sheet.memoryLog || player.memoryLog,
  } : player
  if (history.length) writeStory(mergedPlayer, history)
  const state = stateFromPlayer(mergedPlayer, history)
  state.activeChoices = choicesForState(state)
  return state
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
  const statsRequest = extractStatsRequest(payload.playerAction)

  if (statsRequest.wantsStats && !statsRequest.storyAction) {
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

  if (statsRequest.wantsStats && statsRequest.storyAction) {
    const sheet = await fetchPlayerSheet()
    const response = await request('/story/opening', {
      method: 'POST',
      body: JSON.stringify({
        playerAction: statsRequest.storyAction,
      }),
    })
    const scene = response.data
    const stamp = Date.now()
    const choices = choicesFromScene(scene, stamp)
    const messages = [
      { id: `player-${stamp}`, speaker: 'player', message_text: payload.playerAction },
      {
        id: `stats-${stamp}`,
        speaker: 'narrator',
        message_text: 'Character Sheet',
        message_kind: 'stats',
        sheet_json: sheet,
        choices_json: [],
      },
      {
        id: `narrator-${stamp}`,
        speaker: 'narrator',
        message_text: scene.narration,
        choices_json: choices,
        record_changes_json: scene.recordChanges || [],
        state_changes_json: scene.stateChanges || {},
      },
    ]

    writeStory(player, [...history, ...messages])
    return {
      localOnly: true,
      messages,
      story: scene.narration,
      choices,
      stateChanges: scene.stateChanges || {},
      recordChanges: scene.recordChanges || [],
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

export async function fetchNarrationAudio({ text, voiceMode }) {
  const token = getStoredToken()
  const response = await fetch(`${API_BASE_URL}/story/voice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text, voiceMode }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    if (response.status === 401) {
      expireStoredSession(payload.message || SESSION_EXPIRED_MESSAGE)
    }
    throw new Error(payload.message || payload.error || 'Voice narration failed.')
  }

  return response.blob()
}
