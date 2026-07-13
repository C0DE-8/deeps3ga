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
  if (interpretation.status !== 'VALID') return { ...interpretation, validatedByEngine: true }
  const text = normalize(action)
  const inCombat = Boolean(state.activeEncounter)
  const enemies = (state.combatParticipants || []).filter((entry) => entry.team === 'enemy' && entry.status === 'active')
  const knownSkill = mentionedCatalogEntry(action, state.skills || [])
  const ownedItem = mentionedCatalogEntry(action, state.inventory || [])

  if (interpretation.intent === 'flee' && !inCombat) {
    return reject('INVALID', 'flee', 'No immediate threat is pursuing the character.', interpretation, 'nothing_to_escape', { floor: state.currentFloor?.floor_name })
  }

  if (interpretation.intent === 'attack') {
    const explicitTarget = action.match(/\b(?:attack|strike|stab|shoot|hit)\s+(?:at\s+)?(?:the\s+)?(?!with\b|using\b|my\b)([a-z][a-z '-]{1,80})/i)?.[1]?.replace(/[.!?].*$/, '').trim()
    const targetName = normalize(interpretation.target || explicitTarget)
    const presentEntities = [
      ...(state.activeMonsters || []).map((entry) => ({ ...entry, display_name: entry.name, entityType: 'creature' })),
      ...(state.activeNpcs || []).map((entry) => ({ ...entry, display_name: entry.name, entityType: 'person' })),
    ]
    const presentTarget = targetName ? presentEntities.find((entry) => normalize(entry.display_name).includes(targetName) || targetName.includes(normalize(entry.display_name))) : null
    const hostileTarget = targetName ? enemies.find((entry) => normalize(entry.display_name).includes(targetName) || targetName.includes(normalize(entry.display_name))) : null
    const targetIsHostileMonster = presentTarget?.entityType === 'creature' && presentTarget.status !== 'friendly'
    if (presentTarget && !hostileTarget && !targetIsHostileMonster) {
      return reject('INVALID', 'attack', `${presentTarget.display_name} is present but is not acting as an enemy.`, interpretation, 'target_non_hostile', {
        target: presentTarget.display_name,
        entityType: presentTarget.entityType,
        status: presentTarget.status || presentTarget.run_life_status || 'present',
        floor: state.currentFloor?.floor_name,
        atmosphere: state.currentFloor?.atmosphere,
        hiddenEvents: state.currentFloor?.hidden_events_json || [],
      })
    }
    if (targetName && !hostileTarget && !targetIsHostileMonster) {
      return reject('IMPOSSIBLE', 'attack', `${interpretation.target || explicitTarget} is not present in this scene.`, interpretation, 'target_absent', {
        floor: state.currentFloor?.floor_name,
        atmosphere: state.currentFloor?.atmosphere,
        presentNpcs: (state.activeNpcs || []).map((entry) => entry.name),
        presentCreatures: (state.activeMonsters || []).map((entry) => entry.name),
      })
    }
    const claimsNamedPower = /\b(?:cast|use|activate|invoke|channel)\s+(?:my\s+)?([a-z][a-z '-]{2,60})/i.test(action)
    const genericWeaponOrBody = /\b(sword|dagger|bow|fist|kick|punch|claw|fang|bite|staff|weapon)\b/i.test(text)
    if (claimsNamedPower && !knownSkill && !ownedItem && !genericWeaponOrBody) {
      return reject('IMPOSSIBLE', 'attack', 'The character does not possess that ability or item.', interpretation, 'ability_not_owned', { knownSkills: (state.skills || []).map((entry) => entry.name) })
    }
  }

  if (/\b(?:drink|consume|use|equip|throw)\s+(?:my\s+)?(?:the\s+)?[a-z]/i.test(action)) {
    const refersToSkill = Boolean(knownSkill)
    const genericObject = /\b(dagger|sword|weapon|cloak|rope|rock|stone|door|lantern)\b/i.test(text)
    if (!ownedItem && !refersToSkill && !genericObject) {
      return reject('IMPOSSIBLE', interpretation.intent, 'The requested item is not in the inventory or current scene.', interpretation, 'item_not_available', { inventory: (state.inventory || []).map((entry) => entry.name) })
    }
  }

  if (interpretation.intent === 'heal' && Number(state.characterSheet.hp) >= Number(state.characterSheet.max_hp) && !/\b(companion|ally|them|him|her)\b/i.test(text)) {
    return reject('INVALID', 'heal', 'The character is already at full health.', interpretation)
  }

  return { ...interpretation, status: 'VALID', validatedByEngine: true, knownSkillId: knownSkill?.id || null, ownedItemId: ownedItem?.inventory_id || null }
}

module.exports = { validateReality }
