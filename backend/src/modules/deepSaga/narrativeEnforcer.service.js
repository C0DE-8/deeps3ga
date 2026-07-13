function asText(value) {
  if (typeof value === 'string') return value.trim()
  if (value?.text) return String(value.text).trim()
  return ''
}

function normalizeChoice(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const text = asText(value)
  if (!text) return null
  return {
    id: String(value.id || '').trim().slice(0, 80),
    text,
    action: String(value.action || '').trim().slice(0, 500),
    direction: String(value.direction || '').trim().slice(0, 120),
    consequence: String(value.consequence || '').trim().slice(0, 240),
    anchor: String(value.anchor || '').trim().slice(0, 120),
  }
}

function authoritativeChanges(resolution) {
  const changes = []
  if (resolution.combat?.playerDamage) changes.push(`${resolution.combat.playerDamage} damage dealt to ${resolution.combat.enemyName}.`)
  for (const action of resolution.enemyActions || []) if (action.target && action.damage) changes.push(`${action.target} lost ${action.damage} HP.`)
  if (resolution.combat?.healing) changes.push(`${resolution.combat.healing} HP restored.`)
  if (resolution.levelUp) changes.push(`Level increased to ${resolution.levelUp.newLevel}.`)
  if (resolution.advanced?.type === 'floor') changes.push(`Advanced to Floor ${resolution.advanced.floor}.`)
  if (resolution.advanced?.type === 'realm') changes.push(`Advanced to Realm ${resolution.advanced.dungeon}.`)
  if (resolution.died) changes.push('This character life ended.')
  return changes
}

function authoritativeRewards(resolution) {
  const rewards = []
  if (resolution.rewards?.xp) rewards.push(`Gained ${resolution.rewards.xp} XP.`)
  if (resolution.rewards?.gold) rewards.push(`Gained ${resolution.rewards.gold} Gold.`)
  if (resolution.rewards?.soulEnergy) rewards.push(`Gained ${resolution.rewards.soulEnergy} Soul Energy.`)
  for (const item of resolution.itemsAwarded || []) rewards.push(`Received ${item.name}.`)
  for (const skill of resolution.skillsUnlocked || []) rewards.push(`Unlocked ${skill.name}.`)
  return rewards
}

function buildStatusSummary(state) {
  if (!state?.characterSheet) return null
  const sheet = state.characterSheet
  const weapon = (state.inventory || []).find((item) => item.equipped_slot === 'weapon')
  return {
    level: Number(sheet.level),
    hp: `${sheet.hp}/${sheet.max_hp}`,
    stamina: `${sheet.stamina}/${sheet.max_stamina}`,
    mana: `${sheet.mana}/${sheet.max_mana}`,
    gold: Number(sheet.gold),
    equippedWeapon: weapon?.name || 'Unarmed',
    relevantInventory: (state.inventory || []).filter((item) => ['consumable', 'quest', 'relic'].includes(item.item_type)).slice(0, 8).map((item) => `${item.name} x${item.quantity}`),
    activeQuests: (state.activeQuests || []).map((quest) => quest.name),
    companions: (state.companions || []).map((companion) => companion.name),
    statusEffects: (state.statusEffects || []).map((effect) => effect.name),
  }
}

function enforceNarrativeScene(scene, resolution, states = {}) {
  const violations = []
  const rejected = Boolean(resolution.rejection)
  const story = asText(scene.story)
  if (!story) throw new Error('Narrative AI returned no story text.')
  if ((scene.characterChanges || []).length) violations.push('model_character_changes_replaced')
  if ((scene.newItemsOrSkills || []).length) violations.push('model_rewards_replaced')
  if ((scene.memorySignals || []).length) violations.push('model_memory_writes_blocked')
  if (rejected) violations.push('rejected_action_state_changes_blocked')

  if (!Array.isArray(scene.choices)) throw new Error('Narrative AI choices must be an array.')
  const choices = scene.choices.map(normalizeChoice)
  if (choices.some((choice) => !choice)) throw new Error('Narrative AI returned a malformed choice.')
  if (choices.length > 5) throw new Error('Narrative AI returned more than five choices.')
  if (choices.some((choice) => !choice.id || !choice.action || !choice.direction || !choice.consequence || !choice.anchor)) throw new Error('Narrative AI returned an incomplete choice.')
  if (!resolution.died && !resolution.runCompleted && choices.length < 3) violations.push('fewer_than_three_choices')
  if (choices.some((choice) => choice.text.split(/\s+/).filter(Boolean).length < 5)) violations.push('choice_text_too_short')
  if (choices.some((choice) => !choice.direction || choice.direction === 'unspecified' || !choice.consequence || !choice.anchor)) violations.push('choice_structure_incomplete')
  const directions = choices.map((choice) => choice.direction.toLowerCase()).filter((direction) => direction !== 'unspecified')
  if (new Set(directions).size !== directions.length) violations.push('duplicate_choice_directions')
  const genericChoice = /^(continue|look around|study the area|check your character sheet|wait|do something else|describe an action)[.!]?$/i
  if (choices.some((choice) => genericChoice.test(choice.text.trim()))) violations.push('generic_choice_forbidden')
  const sceneType = typeof scene.sceneType === 'string' ? scene.sceneType : 'exploration'
  const wordCount = asText(scene.story).split(/\s+/).filter(Boolean).length
  const ranges = { small_action: [90, 180], exploration: [180, 320], dialogue: [180, 320], shop: [250, 500], guild: [250, 500], quest_hub: [250, 500], preparation: [250, 500], floor_transition: [350, 700], major_discovery: [350, 700], boss: [350, 700], death: [350, 700], reincarnation: [350, 700] }
  const range = ranges[sceneType]
  if (range && wordCount && (wordCount < range[0] || wordCount > range[1])) violations.push('scene_length_outside_target')
  const majorSceneTypes = new Set(['shop', 'guild', 'quest_hub', 'floor_transition', 'major_discovery', 'npc_introduction', 'preparation', 'boss', 'death', 'reincarnation'])
  const showStatusSummary = majorSceneTypes.has(sceneType) || Boolean(resolution.advanced) || (resolution.quests || []).length > 0 || (resolution.itemsAwarded || []).length > 0
  return {
    ...scene,
    sceneType,
    story,
    characterChanges: authoritativeChanges(resolution),
    newItemsOrSkills: authoritativeRewards(resolution),
    statusSummary: showStatusSummary ? buildStatusSummary(states.after) : null,
    choices,
    consequences: [{ engineResolution: resolution }],
    memorySignals: [],
    parsedIntent: resolution.interpretation || {},
    safetyNotes: [...(scene.safetyNotes || []), ...violations],
    validationViolations: violations,
  }
}

module.exports = { buildStatusSummary, enforceNarrativeScene }
