function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function reject(status, intent, reason, interpretation) {
  return { ...interpretation, status, intent, reason, confidence: 1, validatedByEngine: true }
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
    return reject('INVALID', 'flee', 'There is no active encounter to escape from.', interpretation)
  }

  if (interpretation.intent === 'attack') {
    const explicitTarget = action.match(/\b(?:attack|strike|stab|shoot|hit)\s+(?:at\s+)?(?:the\s+)?(?!with\b|using\b|my\b)([a-z][a-z '-]{1,80})/i)?.[1]?.replace(/[.!?].*$/, '').trim()
    const targetName = normalize(interpretation.target || explicitTarget)
    const availableTargets = enemies.length ? enemies : (state.activeMonsters || []).map((entry) => ({ display_name: entry.name }))
    if (targetName && !availableTargets.some((entry) => normalize(entry.display_name || entry.name).includes(targetName) || targetName.includes(normalize(entry.display_name || entry.name)))) {
      return reject('IMPOSSIBLE', 'attack', `${interpretation.target || explicitTarget} is not a present target.`, interpretation)
    }
    const claimsNamedPower = /\b(?:cast|use|activate|invoke|channel)\s+(?:my\s+)?([a-z][a-z '-]{2,60})/i.test(action)
    const genericWeaponOrBody = /\b(sword|dagger|bow|fist|kick|punch|claw|fang|bite|staff|weapon)\b/i.test(text)
    if (claimsNamedPower && !knownSkill && !ownedItem && !genericWeaponOrBody) {
      return reject('IMPOSSIBLE', 'attack', 'That ability or item is not present on the character sheet.', interpretation)
    }
  }

  if (/\b(?:drink|consume|use|equip|throw)\s+(?:my\s+)?(?:the\s+)?[a-z]/i.test(action)) {
    const refersToSkill = Boolean(knownSkill)
    const genericObject = /\b(dagger|sword|weapon|cloak|rope|rock|stone|door|lantern)\b/i.test(text)
    if (!ownedItem && !refersToSkill && !genericObject) {
      return reject('IMPOSSIBLE', interpretation.intent, 'The requested item is not in the inventory or current scene.', interpretation)
    }
  }

  if (interpretation.intent === 'heal' && Number(state.characterSheet.hp) >= Number(state.characterSheet.max_hp) && !/\b(companion|ally|them|him|her)\b/i.test(text)) {
    return reject('INVALID', 'heal', 'The character is already at full health.', interpretation)
  }

  return { ...interpretation, status: 'VALID', validatedByEngine: true, knownSkillId: knownSkill?.id || null, ownedItemId: ownedItem?.inventory_id || null }
}

module.exports = { validateReality }
