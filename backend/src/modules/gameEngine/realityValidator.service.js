function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function reject(status, intent, reason, interpretation, code = 'invalid_action', anchors = {}) {
  return { ...interpretation, status, intent, reason, rejectionCode: code, sceneAnchors: anchors, confidence: 1, validatedByEngine: true }
}

function mentionedCatalogEntry(action, entries) {
  const text = normalize(action)
  return entries.find((entry) => text.includes(normalize(entry.name))) || null
}

function validateReality(action, interpretation, state) {
  const text = normalize(action)
  const knownSkill = mentionedCatalogEntry(action, state.skills || [])
  const ownedItem = mentionedCatalogEntry(action, state.inventory || [])

  const declaredFloor = text.match(/\b(?:go|move|travel|teleport|advance|jump)\s+(?:to\s+)?floor\s+(\d+)/i)?.[1]
  const declaredRealm = text.match(/\b(?:go|move|travel|teleport|advance|jump)\s+(?:to\s+)?(?:realm|dungeon)\s+(\d+)/i)?.[1]
  const declaresCompletion = /\b(?:complete|finish|clear|skip)\s+(?:this\s+|the\s+)?(?:floor|realm|dungeon)\b/i.test(text)
  const requestsFloorChange = (declaredFloor && Number(declaredFloor) !== Number(state.currentFloor?.floor_number))
    || (declaredRealm && Number(declaredRealm) !== Number(state.currentDungeon?.dungeon_number))
    || declaresCompletion
  if (requestsFloorChange && !state.floorRuntime?.floorExitUnlocked) {
    return reject('INVALID', interpretation.intent, 'The requested destination is still behind unresolved progression gates.', interpretation, 'progression_gate', {
      currentRealm: state.currentDungeon?.name,
      currentFloor: state.currentFloor?.floor_name,
      floorNumber: state.currentFloor?.floor_number,
      objective: state.currentFloor?.story_purpose,
      encounterRequired: state.floorRuntime?.encounterRequired,
      encounterCompleted: state.floorRuntime?.encounterCompleted,
      decisionRequired: state.floorRuntime?.decisionRequired,
      decisionCompleted: state.floorRuntime?.decisionCompleted,
    })
  }

  for (const capability of interpretation.requiredCapabilities || []) {
    const capabilityName = normalize(capability.name)
    if (capability.type === 'skill' && capabilityName && !(state.skills || []).some((entry) => normalize(entry.name) === capabilityName)) {
      return reject('IMPOSSIBLE', interpretation.intent, `The character does not possess ${capability.name}.`, interpretation, 'ability_not_owned', { knownSkills: (state.skills || []).map((entry) => entry.name) })
    }
    if (capability.type === 'item' && capabilityName && !(state.inventory || []).some((entry) => normalize(entry.name) === capabilityName)) {
      return reject('IMPOSSIBLE', interpretation.intent, `${capability.name} is not in the inventory.`, interpretation, 'item_not_available', { inventory: (state.inventory || []).map((entry) => entry.name) })
    }
    if (capability.type === 'item' && capabilityName) {
      const item = (state.inventory || []).find((entry) => normalize(entry.name) === capabilityName)
      if (Number(capability.amount || 1) > Number(item?.quantity || 0)) return reject('IMPOSSIBLE', interpretation.intent, `There is not enough ${capability.name} in the inventory.`, interpretation, 'item_not_available')
    }
    if (capability.type === 'gold' && Number(capability.amount || 0) > Number(state.characterSheet?.gold || 0)) {
      return reject('IMPOSSIBLE', interpretation.intent, 'The character does not have enough Gold.', interpretation, 'gold_not_available', { gold: Number(state.characterSheet?.gold || 0) })
    }
    if (capability.type === 'quest' && capabilityName && !(state.activeQuests || []).some((entry) => normalize(entry.name) === capabilityName || normalize(entry.quest_key) === capabilityName)) {
      return reject('IMPOSSIBLE', interpretation.intent, `${capability.name} is not an active saved quest.`, interpretation, 'quest_not_available', { quests: (state.activeQuests || []).map((entry) => entry.name) })
    }
    if (['auth', 'authentication', 'ownership', 'account', 'admin'].includes(normalize(capability.type))) {
      return reject('INVALID', interpretation.intent, 'Protected account state cannot be changed by a game action.', interpretation, 'protected_state')
    }
  }

  const namedPower = action.match(/\bcast\s+(?:my\s+)?([a-z][a-z '-]{2,60})/i)?.[1]?.replace(/[.!?].*$/, '').trim()
  if (namedPower && !(state.skills || []).some((entry) => normalize(entry.name) === normalize(namedPower))) {
    return reject('IMPOSSIBLE', interpretation.intent, `${namedPower} is not a saved skill.`, interpretation, 'ability_not_owned', { knownSkills: (state.skills || []).map((entry) => entry.name) })
  }

  return { ...interpretation, status: 'VALID', reason: null, validatedByEngine: true, knownSkillId: knownSkill?.id || null, ownedItemId: ownedItem?.inventory_id || null }
}

module.exports = { validateReality }
