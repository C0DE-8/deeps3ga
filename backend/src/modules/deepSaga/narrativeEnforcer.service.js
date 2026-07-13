const PROTECTED_KEYS = new Set(['account', 'accountid', 'authentication', 'auth', 'user', 'userid', 'owner', 'ownerid', 'ownership', 'admin', 'role'])
const SCENE_TYPES = new Set(['combat', 'exploration', 'dialogue', 'shop', 'guild', 'quest_hub', 'floor_transition', 'major_discovery', 'npc_introduction', 'preparation', 'boss', 'death', 'reincarnation', 'small_action'])
const OUTCOMES = new Set(['SUCCESS', 'PARTIAL_SUCCESS', 'FAILURE'])
const QUEST_STATUSES = new Set(['available', 'active', 'completed', 'failed', 'abandoned'])

class AiTurnValidationError extends Error {
  constructor(errors) {
    super(`AI Game Master response rejected: ${errors.join(' | ')}`)
    this.name = 'AiTurnValidationError'
    this.validationErrors = errors
  }
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength)
}

function finiteInteger(value, field, errors, fallback = 0) {
  if (value === undefined || value === null) return fallback
  const number = Number(value)
  if (!Number.isFinite(number) || !Number.isInteger(number)) {
    errors.push(`${field} must be a finite integer.`)
    return fallback
  }
  return number
}

function hasProtectedKey(value) {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(hasProtectedKey)
  return Object.entries(value).some(([key, child]) => PROTECTED_KEYS.has(key.toLowerCase()) || hasProtectedKey(child))
}

function entityKey(type, id) {
  return `${String(type || '').toLowerCase()}:${Number(id)}`
}

function buildEntityIndex(state) {
  const entities = new Map()
  for (const target of state.reachableTargets || []) entities.set(entityKey(target.type, target.id), target)
  for (const npc of state.activeNpcs || []) entities.set(entityKey('npc', npc.id), { type: 'npc', id: Number(npc.id), name: npc.name, status: npc.run_life_status, reachable: true })
  for (const companion of state.companions || []) entities.set(entityKey('companion', companion.id), { type: 'companion', id: Number(companion.id), name: companion.name, hp: Number(companion.hp), maxHp: Number(companion.max_hp), status: companion.companion_status, reachable: Boolean(companion.active) })
  return entities
}

function exactEntity(index, type, id, name, field, errors) {
  const entity = index.get(entityKey(type, id))
  if (!entity) {
    errors.push(`${field} references an entity that is not active and reachable: ${type} ${id}.`)
    return null
  }
  if (entity.name !== name) errors.push(`${field} name "${name}" does not belong to ${type} ID ${id}; expected "${entity.name}".`)
  return entity
}

function normalizeStatusReference(value, state, field, errors, requireActive) {
  const raw = typeof value === 'string' ? { name: value } : value
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push(`${field} contains a malformed status.`)
    return null
  }
  const requested = cleanText(raw.key || raw.statusKey || raw.name, 100).toLowerCase()
  const source = requireActive ? state.statusEffects || [] : state.statusCatalog || []
  const status = source.find((entry) => String(entry.status_key).toLowerCase() === requested || String(entry.name).toLowerCase() === requested)
  if (!status) {
    errors.push(`${field} references an unknown${requireActive ? ' active' : ''} status: ${requested || '(missing)'}.`)
    return null
  }
  return {
    key: status.status_key,
    name: status.name,
    duration: raw.duration === undefined ? undefined : finiteInteger(raw.duration, `${field}.duration`, errors),
    intensity: raw.intensity === undefined ? 1 : finiteInteger(raw.intensity, `${field}.intensity`, errors, 1),
  }
}

function normalizeItemChange(value, state, field, errors, removal) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${field} contains a malformed item change.`)
    return null
  }
  const id = finiteInteger(value.id, `${field}.id`, errors)
  const name = cleanText(value.name, 160)
  const quantity = finiteInteger(value.quantity, `${field}.quantity`, errors)
  const item = (state.itemCatalog || []).find((entry) => Number(entry.id) === id)
  if (!item || item.name !== name) errors.push(`${field} item ID ${id} and name "${name}" do not match the supplied item catalog.`)
  if (quantity <= 0) errors.push(`${field}.quantity must be greater than zero.`)
  if (removal) {
    const owned = (state.inventory || []).find((entry) => Number(entry.item_id) === id)
    if (!owned || Number(owned.quantity) < quantity) errors.push(`${field} tries to remove more ${name} than the player owns.`)
  }
  return { id, name, quantity }
}

function normalizeChoice(value, index, entityIndex, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`choices[${index}] must be an object.`)
    return null
  }
  const choice = {
    id: cleanText(value.id, 80),
    title: cleanText(value.title, 160),
    text: cleanText(value.text, 700),
    action: cleanText(value.action, 700),
    direction: cleanText(value.direction, 80),
    targetType: value.targetType ? cleanText(value.targetType, 40).toLowerCase() : null,
    targetId: value.targetId === undefined || value.targetId === null ? null : finiteInteger(value.targetId, `choices[${index}].targetId`, errors),
  }
  if (!choice.id || !choice.title || !choice.text || !choice.action || !choice.direction) errors.push(`choices[${index}] is missing id, title, text, action, or direction.`)
  if (choice.text.split(/\s+/).filter(Boolean).length < 8) errors.push(`choices[${index}] must explain a precise target, method, and story reason.`)
  const genericChoice = /^(attack again|attack|defend|look around|wait|continue|analyze|use a skill|attempt a completely original action)[.!]?$/i
  const genericPhrase = /\b(defend and brace for incoming attacks|look for environmental advantages|use (?:a|your) skill to analyze weaknesses|attack (?:it|them) again)\b/i
  if (genericChoice.test(choice.title) || genericChoice.test(choice.text) || genericPhrase.test(choice.title) || genericPhrase.test(choice.text)) errors.push(`choices[${index}] is a generic combat-menu choice.`)
  if ((choice.targetType && choice.targetId === null) || (!choice.targetType && choice.targetId !== null)) errors.push(`choices[${index}] must provide both targetType and targetId.`)
  if (choice.targetType && choice.targetId !== null) {
    const entity = entityIndex.get(entityKey(choice.targetType, choice.targetId))
    if (!entity) errors.push(`choices[${index}] references an unavailable target.`)
    else if (!`${choice.title} ${choice.text} ${choice.action}`.toLowerCase().includes(entity.name.toLowerCase())) errors.push(`choices[${index}] must name its target ${entity.name}.`)
  }
  return choice
}

function normalizeRecord(value, index, entityIndex, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`recordChanges[${index}] must be an object.`)
    return null
  }
  const type = cleanText(value.type, 60).toLowerCase()
  const text = cleanText(value.text, 300)
  if (!type || !text) errors.push(`recordChanges[${index}] requires type and text.`)
  const record = {
    type,
    text,
    statusKey: value.statusKey ? cleanText(value.statusKey, 100) : null,
    targetType: value.targetType ? cleanText(value.targetType, 40).toLowerCase() : null,
    targetId: value.targetId === undefined || value.targetId === null ? null : finiteInteger(value.targetId, `recordChanges[${index}].targetId`, errors),
  }
  if ((record.targetType && record.targetId === null) || (!record.targetType && record.targetId !== null)) errors.push(`recordChanges[${index}] must provide both targetType and targetId.`)
  if (record.targetType && record.targetId !== null) {
    const entity = entityIndex.get(entityKey(record.targetType, record.targetId))
    if (!entity) errors.push(`recordChanges[${index}] references an unavailable target.`)
    else if (!record.text.includes(entity.name)) errors.push(`recordChanges[${index}] target ID does not match its text.`)
  }
  return record
}

function validateStatusOrder(turn, errors) {
  const records = turn.recordChanges
  for (const removed of turn.stateChanges.playerStatusesRemoved) {
    const statusName = removed.name.toLowerCase()
    const expirationIndexes = records.map((record, index) => ({ record, index })).filter(({ record }) => record.type === 'status_expired' && (record.statusKey === removed.key || record.text.toLowerCase().includes(statusName))).map(({ index }) => index)
    if (!expirationIndexes.length) errors.push(`Removed status ${removed.name} requires a chronological status_expired record.`)
    const expirationIndex = expirationIndexes.at(-1)
    const laterDamage = records.slice(Number(expirationIndex) + 1).some((record) => record.type === 'status_damage' && (record.statusKey === removed.key || record.text.toLowerCase().includes(statusName)))
    if (laterDamage) errors.push(`${removed.name} damage appears after its expiration record.`)
  }
}

function validateRecordedStateChanges(turn, errors) {
  const records = turn.recordChanges
  const requireAmountRecord = (delta, types, label) => {
    if (!delta) return
    const amount = String(Math.abs(delta))
    if (!records.some((record) => types.includes(record.type) && record.text.includes(amount))) errors.push(`${label} change requires a matching chronological record with amount ${amount}.`)
  }
  requireAmountRecord(turn.stateChanges.playerHpDelta, turn.stateChanges.playerHpDelta > 0 ? ['healing'] : ['damage', 'status_damage'], 'Player HP')
  requireAmountRecord(turn.stateChanges.playerManaDelta, ['mana'], 'Player Mana')
  requireAmountRecord(turn.stateChanges.playerStaminaDelta, ['stamina'], 'Player Stamina')
  requireAmountRecord(turn.stateChanges.goldDelta, ['gold'], 'Gold')
  requireAmountRecord(turn.stateChanges.playerXpDelta, ['xp'], 'XP')
  requireAmountRecord(turn.stateChanges.soulEnergyDelta, ['soul_energy'], 'Soul Energy')
  for (const status of turn.stateChanges.playerStatusesAdded) if (!records.some((record) => record.type === 'status_added' && record.text.toLowerCase().includes(status.name.toLowerCase()))) errors.push(`Added status ${status.name} requires a status_added record.`)
  for (const target of turn.stateChanges.targets) {
    for (const status of target.newStatuses) if (!records.some((record) => record.type === 'status_added' && record.text.includes(target.name) && record.text.toLowerCase().includes(status.name.toLowerCase()))) errors.push(`Added ${status.name} on ${target.name} requires a status_added record.`)
    for (const status of target.removedStatuses) if (!records.some((record) => record.type === 'status_expired' && record.text.includes(target.name) && record.text.toLowerCase().includes(status.name.toLowerCase()))) errors.push(`Removed ${status.name} from ${target.name} requires a status_expired record.`)
  }
  for (const item of [...turn.stateChanges.itemsAdded, ...turn.stateChanges.itemsRemoved]) if (!records.some((record) => record.type === 'item' && record.text.includes(item.name))) errors.push(`Item change for ${item.name} requires an item record.`)
  for (const skill of turn.stateChanges.skillsAdded) if (!records.some((record) => record.type === 'skill' && record.text.includes(skill.name))) errors.push(`Skill reward ${skill.name} requires a skill record.`)
  for (const quest of turn.stateChanges.questUpdates) if (!records.some((record) => record.type === 'quest' && record.text.includes(quest.name))) errors.push(`Quest update ${quest.name} requires a quest record.`)
  for (const relationship of turn.stateChanges.relationshipChanges) if (!records.some((record) => record.type === 'relationship' && record.text.includes(relationship.name))) errors.push(`Relationship change for ${relationship.name} requires a relationship record.`)
  if (turn.stateChanges.floorChange && !records.some((record) => record.type === 'floor' && record.text.includes(turn.stateChanges.floorChange.floorName))) errors.push(`Floor change requires a floor record naming ${turn.stateChanges.floorChange.floorName}.`)
  if (turn.stateChanges.bossDefeated && !records.some((record) => record.type === 'boss')) errors.push('Boss defeat requires a boss record.')
}

function validateGameMasterTurn(raw, state, { selectedTarget = null } = {}) {
  const errors = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new AiTurnValidationError(['Response must be one JSON object.'])
  if (hasProtectedKey(raw)) errors.push('Response contains protected account, authentication, ownership, user, role, or admin fields.')
  const entityIndex = buildEntityIndex(state)
  const sceneType = cleanText(raw.sceneType, 50).toLowerCase()
  if (!SCENE_TYPES.has(sceneType)) errors.push('sceneType is missing or unsupported.')

  const action = raw.actionResolution
  if (!action || typeof action !== 'object' || Array.isArray(action)) errors.push('actionResolution must be an object.')
  const actionResolution = {
    intent: cleanText(action?.intent, 50).toUpperCase(),
    outcome: cleanText(action?.outcome, 50).toUpperCase(),
    targetType: action?.targetType ? cleanText(action.targetType, 40).toLowerCase() : null,
    targetId: action?.targetId === undefined || action?.targetId === null ? null : finiteInteger(action.targetId, 'actionResolution.targetId', errors),
    targetName: action?.targetName ? cleanText(action.targetName, 160) : null,
    targetChangedReason: action?.targetChangedReason ? cleanText(action.targetChangedReason, 300) : null,
    summary: cleanText(action?.summary, 500),
  }
  if (!actionResolution.intent || !OUTCOMES.has(actionResolution.outcome) || !actionResolution.summary) errors.push('actionResolution requires intent, SUCCESS/PARTIAL_SUCCESS/FAILURE outcome, and summary.')
  let resolvedTarget = null
  if (actionResolution.targetType || actionResolution.targetId !== null || actionResolution.targetName) {
    if (!actionResolution.targetType || actionResolution.targetId === null || !actionResolution.targetName) errors.push('actionResolution target requires targetType, targetId, and targetName together.')
    else resolvedTarget = exactEntity(entityIndex, actionResolution.targetType, actionResolution.targetId, actionResolution.targetName, 'actionResolution', errors)
  }
  let selectedEntity = null
  if (selectedTarget) {
    selectedEntity = exactEntity(entityIndex, selectedTarget.type, selectedTarget.id, selectedTarget.name, 'selectedTarget', errors)
    if (selectedEntity && (actionResolution.targetType !== selectedEntity.type || Number(actionResolution.targetId) !== Number(selectedEntity.id))) {
      if (!actionResolution.targetChangedReason) errors.push('The selected target changed without targetChangedReason.')
    }
  }

  const story = cleanText(raw.story, 12000)
  if (!story) errors.push('story is required.')
  if (resolvedTarget && !story.toLowerCase().includes(resolvedTarget.name.toLowerCase())) errors.push(`story must name the resolved target ${resolvedTarget.name}.`)
  if (selectedEntity && resolvedTarget && selectedEntity.id !== resolvedTarget.id && !story.toLowerCase().includes(selectedEntity.name.toLowerCase())) errors.push(`A changed target story must also name the originally selected target ${selectedEntity.name}.`)

  const changes = raw.stateChanges
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) errors.push('stateChanges must be an object.')
  const stateChanges = {
    playerHpDelta: finiteInteger(changes?.playerHpDelta, 'stateChanges.playerHpDelta', errors),
    playerManaDelta: finiteInteger(changes?.playerManaDelta, 'stateChanges.playerManaDelta', errors),
    playerStaminaDelta: finiteInteger(changes?.playerStaminaDelta, 'stateChanges.playerStaminaDelta', errors),
    goldDelta: finiteInteger(changes?.goldDelta, 'stateChanges.goldDelta', errors),
    playerXpDelta: finiteInteger(changes?.playerXpDelta, 'stateChanges.playerXpDelta', errors),
    soulEnergyDelta: finiteInteger(changes?.soulEnergyDelta, 'stateChanges.soulEnergyDelta', errors),
    targets: [],
    playerStatusesAdded: [],
    playerStatusesRemoved: [],
    playerStatusUpdates: [],
    itemsAdded: [],
    itemsRemoved: [],
    skillsAdded: [],
    questUpdates: [],
    relationshipChanges: [],
    floorComplete: Boolean(changes?.floorComplete ?? raw.floorComplete),
    exitUnlocked: Boolean(changes?.exitUnlocked ?? raw.exitUnlocked),
    floorChange: changes?.floorChange || null,
    bossDefeated: Boolean(changes?.bossDefeated),
    characterDied: Boolean(changes?.characterDied),
    runCompleted: Boolean(changes?.runCompleted),
  }

  const sheet = state.characterSheet
  const finalHp = Number(sheet.hp) + stateChanges.playerHpDelta
  const finalMana = Number(sheet.mana) + stateChanges.playerManaDelta
  const finalStamina = Number(sheet.stamina) + stateChanges.playerStaminaDelta
  const finalGold = Number(sheet.gold) + stateChanges.goldDelta
  const finalXp = Number(sheet.xp) + stateChanges.playerXpDelta
  const finalSoulEnergy = Number(state.run.soul_energy) + stateChanges.soulEnergyDelta
  if (finalHp < 0 || finalHp > Number(sheet.max_hp)) errors.push('Player HP would be outside 0..max_hp.')
  if (finalMana < 0 || finalMana > Number(sheet.max_mana)) errors.push('Player Mana would be outside 0..max_mana.')
  if (finalStamina < 0 || finalStamina > Number(sheet.max_stamina)) errors.push('Player Stamina would be outside 0..max_stamina.')
  if (finalGold < 0) errors.push('Player Gold would become negative.')
  if (finalXp < 0) errors.push('Player XP would become negative.')
  if (finalSoulEnergy < 0) errors.push('Soul Energy would become negative.')
  if (stateChanges.characterDied && finalHp > 0) errors.push('characterDied requires resulting HP to be zero.')

  if (!Array.isArray(changes?.targets)) errors.push('stateChanges.targets must be an array.')
  else changes.targets.forEach((target, index) => {
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      errors.push(`stateChanges.targets[${index}] must be an object.`)
      return
    }
    const normalized = {
      type: cleanText(target.type, 40).toLowerCase(),
      id: finiteInteger(target.id, `stateChanges.targets[${index}].id`, errors),
      name: cleanText(target.name, 160),
      hpDelta: finiteInteger(target.hpDelta, `stateChanges.targets[${index}].hpDelta`, errors),
      newStatuses: [],
      removedStatuses: [],
    }
    const entity = exactEntity(entityIndex, normalized.type, normalized.id, normalized.name, `stateChanges.targets[${index}]`, errors)
    if (entity && entity.hp !== undefined) {
      const resultingHp = Number(entity.hp) + normalized.hpDelta
      if (resultingHp < 0 || resultingHp > Number(entity.maxHp)) errors.push(`stateChanges.targets[${index}] HP would be outside 0..maxHp.`)
    } else if (normalized.hpDelta) errors.push(`stateChanges.targets[${index}] cannot change HP for this entity type.`)
    if (!Array.isArray(target.newStatuses) || !Array.isArray(target.removedStatuses)) errors.push(`stateChanges.targets[${index}] status fields must be arrays.`)
    else {
      normalized.newStatuses = target.newStatuses.map((status) => normalizeStatusReference(status, state, `stateChanges.targets[${index}].newStatuses`, errors, false)).filter(Boolean)
      normalized.removedStatuses = target.removedStatuses.map((status) => normalizeStatusReference(status, state, `stateChanges.targets[${index}].removedStatuses`, errors, false)).filter(Boolean)
    }
    stateChanges.targets.push(normalized)
  })

  if (resolvedTarget && actionResolution.intent === 'ATTACK' && !stateChanges.targets.some((target) => target.type === actionResolution.targetType && target.id === actionResolution.targetId)) errors.push('The resolved attack target is missing from stateChanges.targets.')
  for (const target of stateChanges.targets.filter((entry) => entry.hpDelta < 0)) {
    if (!story.toLowerCase().includes(target.name.toLowerCase())) errors.push(`story must name every damaged target: ${target.name}.`)
    const damage = Math.abs(target.hpDelta)
    const hasRecord = Array.isArray(raw.recordChanges) && raw.recordChanges.some((record) => String(record?.type).toLowerCase() === 'damage' && String(record?.text).includes(String(damage)) && String(record?.text).includes(target.name))
    if (!hasRecord) errors.push(`recordChanges must record ${damage} damage to ${target.name}.`)
    if (selectedTarget && (target.type !== selectedTarget.type || Number(target.id) !== Number(selectedTarget.id)) && !actionResolution.targetChangedReason && !action?.areaAttack) errors.push(`Damage to ${target.name} was not selected or explicitly explained as an area/interception effect.`)
  }

  const addedStatuses = Array.isArray(changes?.playerStatusesAdded) ? changes.playerStatusesAdded : (errors.push('stateChanges.playerStatusesAdded must be an array.'), [])
  const removedStatuses = Array.isArray(changes?.playerStatusesRemoved) ? changes.playerStatusesRemoved : (errors.push('stateChanges.playerStatusesRemoved must be an array.'), [])
  stateChanges.playerStatusesAdded = addedStatuses.map((status) => normalizeStatusReference(status, state, 'stateChanges.playerStatusesAdded', errors, false)).filter(Boolean)
  stateChanges.playerStatusesRemoved = removedStatuses.map((status) => normalizeStatusReference(status, state, 'stateChanges.playerStatusesRemoved', errors, true)).filter(Boolean)
  const statusUpdates = Array.isArray(changes?.playerStatusUpdates) ? changes.playerStatusUpdates : (errors.push('stateChanges.playerStatusUpdates must be an array.'), [])
  stateChanges.playerStatusUpdates = statusUpdates.map((update) => {
    const status = normalizeStatusReference(update, state, 'stateChanges.playerStatusUpdates', errors, true)
    if (!status) return null
    const remainingTurns = finiteInteger(update.remainingTurns, 'stateChanges.playerStatusUpdates.remainingTurns', errors)
    if (remainingTurns < 0) errors.push('Status remainingTurns cannot be negative.')
    return { ...status, remainingTurns }
  }).filter(Boolean)

  const itemsAdded = Array.isArray(changes?.itemsAdded) ? changes.itemsAdded : (errors.push('stateChanges.itemsAdded must be an array.'), [])
  const itemsRemoved = Array.isArray(changes?.itemsRemoved) ? changes.itemsRemoved : (errors.push('stateChanges.itemsRemoved must be an array.'), [])
  stateChanges.itemsAdded = itemsAdded.map((item) => normalizeItemChange(item, state, 'stateChanges.itemsAdded', errors, false)).filter(Boolean)
  stateChanges.itemsRemoved = itemsRemoved.map((item) => normalizeItemChange(item, state, 'stateChanges.itemsRemoved', errors, true)).filter(Boolean)
  const skillsAdded = Array.isArray(changes?.skillsAdded) ? changes.skillsAdded : (errors.push('stateChanges.skillsAdded must be an array.'), [])
  stateChanges.skillsAdded = skillsAdded.map((skill, index) => {
    const id = finiteInteger(skill?.id, `stateChanges.skillsAdded[${index}].id`, errors)
    const name = cleanText(skill?.name, 160)
    const catalogSkill = (state.skillCatalog || []).find((entry) => Number(entry.id) === id)
    if (!catalogSkill || catalogSkill.name !== name) errors.push(`stateChanges.skillsAdded[${index}] does not match the supplied skill catalog.`)
    if ((state.skills || []).some((entry) => Number(entry.id) === id)) errors.push(`stateChanges.skillsAdded[${index}] is already owned.`)
    return { id, name }
  })

  const questUpdates = Array.isArray(changes?.questUpdates) ? changes.questUpdates : (errors.push('stateChanges.questUpdates must be an array.'), [])
  stateChanges.questUpdates = questUpdates.map((update, index) => {
    const id = finiteInteger(update?.id, `stateChanges.questUpdates[${index}].id`, errors)
    const name = cleanText(update?.name, 200)
    const status = cleanText(update?.status, 30).toLowerCase()
    const quest = (state.activeQuests || []).find((entry) => Number(entry.id) === id)
    if (!quest || quest.name !== name) errors.push(`stateChanges.questUpdates[${index}] does not match an active supplied quest.`)
    if (!QUEST_STATUSES.has(status)) errors.push(`stateChanges.questUpdates[${index}] has an invalid status.`)
    return { id, name, status, progress: update?.progress && typeof update.progress === 'object' && !Array.isArray(update.progress) ? update.progress : {} }
  })

  const relationshipChanges = Array.isArray(changes?.relationshipChanges) ? changes.relationshipChanges : (errors.push('stateChanges.relationshipChanges must be an array.'), [])
  stateChanges.relationshipChanges = relationshipChanges.map((change, index) => {
    const type = cleanText(change?.type, 40).toLowerCase()
    const id = finiteInteger(change?.id, `stateChanges.relationshipChanges[${index}].id`, errors)
    const name = cleanText(change?.name, 160)
    exactEntity(entityIndex, type, id, name, `stateChanges.relationshipChanges[${index}]`, errors)
    return {
      type, id, name,
      trustDelta: finiteInteger(change?.trustDelta, `stateChanges.relationshipChanges[${index}].trustDelta`, errors),
      loyaltyDelta: finiteInteger(change?.loyaltyDelta, `stateChanges.relationshipChanges[${index}].loyaltyDelta`, errors),
      fearDelta: finiteInteger(change?.fearDelta, `stateChanges.relationshipChanges[${index}].fearDelta`, errors),
      betrayalDelta: finiteInteger(change?.betrayalDelta, `stateChanges.relationshipChanges[${index}].betrayalDelta`, errors),
    }
  })

  if (stateChanges.floorChange) {
    if (!state.floorRuntime?.floorComplete || !state.floorRuntime?.exitUnlocked) errors.push('floorChange requires floorComplete and exitUnlocked to already be saved for the current floor.')
    const destinationId = finiteInteger(stateChanges.floorChange.floorId, 'stateChanges.floorChange.floorId', errors)
    const exit = (state.availableFloorExits || []).find((entry) => Number(entry.id) === destinationId)
    if (!exit) errors.push('floorChange references a location that is not a supplied available exit.')
    else stateChanges.floorChange = { floorId: Number(exit.id), floorNumber: Number(exit.floor_number), floorName: exit.floor_name, dungeonId: Number(exit.dungeon_id), dungeonName: exit.dungeon_name }
  }

  const boss = state.activeBoss
  const bossTargetChange = boss ? stateChanges.targets.find((target) => target.type === 'boss' && Number(target.id) === Number(boss.id)) : null
  const resultingBossHp = boss ? Number(boss.current_hp) + Number(bossTargetChange?.hpDelta || 0) : null
  const storedNonCombatVictory = Boolean(boss?.encounter_state_json?.nonCombatVictory) || boss?.status === 'spared'
  if (stateChanges.bossDefeated && (!boss || (resultingBossHp > 0 && !storedNonCombatVictory))) errors.push('bossDefeated requires zero resulting HP or an existing saved non-combat victory.')
  if (stateChanges.exitUnlocked && !(stateChanges.floorComplete || state.floorRuntime?.floorComplete)) errors.push('exitUnlocked requires floorComplete.')
  if (state.currentFloor?.floor_type === 'boss' && (stateChanges.floorComplete || stateChanges.exitUnlocked)) {
    const victoryThisTurn = stateChanges.bossDefeated && (resultingBossHp <= 0 || storedNonCombatVictory)
    if (!victoryThisTurn && !state.floorRuntime?.bossVictorySaved) errors.push('A Boss Floor cannot be completed or unlocked without a validated boss victory.')
  }
  if (stateChanges.floorChange && state.currentFloor?.floor_type === 'boss' && !stateChanges.bossDefeated && !state.floorRuntime?.bossVictorySaved) errors.push('A Boss Floor cannot change without a validated boss victory.')
  if (stateChanges.runCompleted && !(Number(state.currentDungeon?.dungeon_number) === 5 && Number(state.currentFloor?.floor_number) === 3 && (stateChanges.bossDefeated || state.floorRuntime?.bossVictorySaved))) errors.push('runCompleted requires a validated victory on Dungeon 5, Floor 3.')

  if (!Array.isArray(raw.recordChanges)) errors.push('recordChanges must be an array.')
  const recordChanges = Array.isArray(raw.recordChanges) ? raw.recordChanges.map((record, index) => normalizeRecord(record, index, entityIndex, errors)).filter(Boolean) : []
  if (!Array.isArray(raw.choices)) errors.push('choices must be an array.')
  const choices = Array.isArray(raw.choices) ? raw.choices.map((choice, index) => normalizeChoice(choice, index, entityIndex, errors)).filter(Boolean) : []
  if (!stateChanges.characterDied && !stateChanges.runCompleted && (choices.length < 3 || choices.length > 5)) errors.push('choices must contain 3 to 5 story-specific choices.')
  const memoryUpdates = Array.isArray(raw.memoryUpdates) ? raw.memoryUpdates.map((memory, index) => {
    const type = cleanText(memory?.type, 60).toLowerCase()
    const text = cleanText(memory?.text, 1000)
    if (!type || !text) errors.push(`memoryUpdates[${index}] requires type and text.`)
    return { type, text }
  }) : (errors.push('memoryUpdates must be an array.'), [])

  if (raw.floorComplete !== undefined && Boolean(raw.floorComplete) !== stateChanges.floorComplete) errors.push('Top-level floorComplete must match stateChanges.floorComplete.')
  if (raw.exitUnlocked !== undefined && Boolean(raw.exitUnlocked) !== stateChanges.exitUnlocked) errors.push('Top-level exitUnlocked must match stateChanges.exitUnlocked.')
  let bossState = null
  if (raw.bossState !== null && raw.bossState !== undefined) {
    if (!raw.bossState || typeof raw.bossState !== 'object' || Array.isArray(raw.bossState) || !state.activeBoss) {
      errors.push('bossState requires the supplied active boss.')
    } else {
      const bossId = finiteInteger(raw.bossState.id, 'bossState.id', errors)
      const bossName = cleanText(raw.bossState.name, 160)
      const bossHp = finiteInteger(raw.bossState.hp, 'bossState.hp', errors)
      if (bossId !== Number(state.activeBoss.id) || bossName !== state.activeBoss.boss_name) errors.push('bossState must match the supplied active boss ID and name.')
      if (bossHp < 0 || bossHp > Number(state.activeBoss.max_hp)) errors.push('bossState.hp must be within the supplied boss limits.')
      if (bossHp !== resultingBossHp) errors.push('bossState.hp must equal the HP produced by stateChanges.')
      if (Boolean(raw.bossState.defeated) !== stateChanges.bossDefeated) errors.push('bossState.defeated must match stateChanges.bossDefeated.')
      bossState = { id: bossId, name: bossName, hp: bossHp, defeated: Boolean(raw.bossState.defeated) }
    }
  }

  const accepted = {
    sceneType,
    actionResolution,
    story,
    stateChanges,
    recordChanges,
    choices,
    memoryUpdates,
    floorComplete: Boolean(state.floorRuntime?.floorComplete || stateChanges.floorComplete),
    exitUnlocked: Boolean(state.floorRuntime?.exitUnlocked || stateChanges.exitUnlocked),
    bossState,
  }
  validateStatusOrder(accepted, errors)
  validateRecordedStateChanges(accepted, errors)
  if (errors.length) throw new AiTurnValidationError(errors)
  return accepted
}

function buildTurnContext(state) {
  return {
    position: { dungeon: state.currentDungeon, floor: state.currentFloor, location: state.currentFloor?.floor_name },
    player: state.characterSheet,
    possessions: { inventory: state.inventory, equipment: state.equipment, skills: state.skills },
    story: {
      floorObjective: state.currentFloor?.story_purpose,
      floorRuntime: state.floorRuntime,
      activeBeat: state.activeStoryBeat,
      activeQuests: state.activeQuests,
      unresolvedThreads: state.activeStoryThreads,
      recentMessages: (state.narrativeHistory || []).slice(-12),
      importantMemories: (state.storyMemory || []).slice(0, 20),
      completedDecisions: (state.previousChoices || []).slice(0, 12),
    },
    characters: { npcs: state.activeNpcs, companions: state.companions },
    progress: {
      availableFloorExits: state.availableFloorExits || [],
      activeBoss: state.activeBoss,
      previousLegacyHero: state.previousLegacyHero,
    },
    encounter: {
      reachableTargets: state.reachableTargets || [],
      activeEncounter: state.activeEncounter,
      participants: state.combatParticipants,
      statusEffects: state.statusEffects,
    },
    allowedReferences: { items: state.itemCatalog, skills: state.skillCatalog, statuses: state.statusCatalog },
  }
}

module.exports = { AiTurnValidationError, buildEntityIndex, buildTurnContext, validateGameMasterTurn, validateStatusOrder }
