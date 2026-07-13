function asText(value) {
  if (typeof value === 'string') return value.trim()
  if (value?.text) return String(value.text).trim()
  return ''
}

function normalizeChoice(value, index) {
  if (typeof value === 'string') return { id: `choice-${index + 1}`, text: value.trim(), action: value.trim(), direction: 'unspecified', consequence: '' }
  const text = asText(value)
  if (!text) return null
  return {
    id: String(value.id || `choice-${index + 1}`).slice(0, 80),
    text,
    action: String(value.action || text).trim().slice(0, 500),
    direction: String(value.direction || 'unspecified').trim().slice(0, 120),
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

function enforceNarrativeScene(scene, resolution, fallbackStory) {
  const violations = []
  const rejected = Boolean(resolution.rejection)
  if ((scene.characterChanges || []).length) violations.push('model_character_changes_replaced')
  if ((scene.newItemsOrSkills || []).length) violations.push('model_rewards_replaced')
  if ((scene.memorySignals || []).length) violations.push('model_memory_writes_blocked')
  if (rejected) violations.push('rejected_action_forced_to_engine_narrative')

  const choices = (scene.choices || []).map(normalizeChoice).filter(Boolean).slice(0, 5)
  if (!resolution.died && !resolution.runCompleted && choices.length < 3) violations.push('fewer_than_three_choices')
  if (choices.some((choice) => choice.text.split(/\s+/).filter(Boolean).length < 5)) violations.push('choice_text_too_short')
  if (choices.some((choice) => !choice.direction || choice.direction === 'unspecified' || !choice.consequence || !choice.anchor)) violations.push('choice_structure_incomplete')
  const directions = choices.map((choice) => choice.direction.toLowerCase()).filter((direction) => direction !== 'unspecified')
  if (new Set(directions).size !== directions.length) violations.push('duplicate_choice_directions')
  const hardRejection = ['rule_manipulation', 'reality_breaking_action'].includes(resolution.interpretation?.intent)
  return {
    ...scene,
    story: rejected && hardRejection ? fallbackStory : (asText(scene.story) || fallbackStory),
    characterChanges: authoritativeChanges(resolution),
    newItemsOrSkills: authoritativeRewards(resolution),
    choices: resolution.died || resolution.runCompleted ? [] : choices,
    consequences: [{ engineResolution: resolution }],
    memorySignals: [],
    parsedIntent: resolution.interpretation || {},
    safetyNotes: [...(scene.safetyNotes || []), ...violations],
    validationViolations: violations,
  }
}

module.exports = { enforceNarrativeScene }
