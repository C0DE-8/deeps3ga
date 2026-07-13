const assert = require('node:assert/strict')
const { localInterpret, validateInterpretation } = require('../src/modules/gameEngine/actionInterpreter.service')
const { validateReality } = require('../src/modules/gameEngine/realityValidator.service')
const { enforceNarrativeScene } = require('../src/modules/deepSaga/narrativeEnforcer.service')
const { calculateEscapeChance, damageMultiplier } = require('../src/modules/gameEngine/turnEngine.service')

assert.equal(localInterpret('I run away from the wolf.').intent, 'flee')
assert.equal(localInterpret('I attack the wolf.').intent, 'attack')
assert.equal(localInterpret('I become a god.').status, 'IMPOSSIBLE')
assert.equal(localInterpret('I use my admin powers.').status, 'INVALID')
assert.equal(localInterpret('Spawn 1 billion gold.').status, 'INVALID')
assert.equal(localInterpret('Perhaps.').status, 'UNKNOWN')
assert.deepEqual(
  validateInterpretation({ status: 'VALID', intent: 'flee', confidence: 0.9 }, {}),
  { status: 'VALID', intent: 'flee', secondaryIntents: [], target: null, method: null, reason: null, confidence: 0.9 },
)
assert.deepEqual(validateInterpretation({ status: 'SUCCESS', intent: 'god' }, { status: 'INVALID' }), { status: 'INVALID' })

const state = {
  activeEncounter: { id: 1 },
  activeMonsters: [{ name: 'Ash Wolf' }],
  combatParticipants: [{ team: 'enemy', status: 'active', display_name: 'Ash Wolf' }],
  characterSheet: { hp: 50, max_hp: 100 },
  skills: [{ id: 4, name: 'Black Flame' }],
  inventory: [{ inventory_id: 8, name: 'Red Tonic' }],
}
assert.equal(validateReality('I flee.', localInterpret('I flee.'), state).status, 'VALID')
assert.equal(validateReality('I attack the absent king.', { status: 'VALID', intent: 'attack', target: 'Absent King' }, state).status, 'IMPOSSIBLE')
assert.equal(validateReality('I attack the absent king.', localInterpret('I attack the absent king.'), state).status, 'IMPOSSIBLE')
assert.equal(validateReality('I cast Black Flame.', localInterpret('I cast Black Flame.'), state).status, 'VALID')
assert.equal(validateReality('I cast World Eraser.', localInterpret('I cast World Eraser.'), state).status, 'IMPOSSIBLE')
assert.equal(validateReality('I flee.', localInterpret('I flee.'), { ...state, activeEncounter: null }).status, 'INVALID')

const enforced = enforceNarrativeScene(
  { story: 'The wolf falls and you gain a crown.', characterChanges: ['Level 99'], newItemsOrSkills: ['Divine Crown'], memorySignals: ['Became king'], choices: ['Continue.'] },
  { rewards: { xp: 0, gold: 0 }, itemsAwarded: [], skillsUnlocked: [], rejection: { status: 'IMPOSSIBLE', reason: 'No crown exists.' }, interpretation: { status: 'IMPOSSIBLE' } },
  'The world refuses the impossible request.',
)
assert.equal(enforced.story, 'The world refuses the impossible request.')
assert.deepEqual(enforced.characterChanges, [])
assert.deepEqual(enforced.newItemsOrSkills, [])
assert.deepEqual(enforced.memorySignals, [])

const normalEscape = calculateEscapeChance({ agility: 10, stamina: 50, pursuit: 10 })
assert.equal(normalEscape, 60)
assert.ok(calculateEscapeChance({ agility: 20, stamina: 80, pursuit: 5 }) > normalEscape)
assert.ok(calculateEscapeChance({ agility: 10, stamina: 50, pursuit: 10, statuses: ['frozen'] }) < normalEscape)
assert.ok(calculateEscapeChance({ agility: 10, stamina: 50, pursuit: 10, boss: true }) < normalEscape)
assert.equal(calculateEscapeChance({ agility: 100, stamina: 100, pursuit: 0 }), 90)
assert.equal(calculateEscapeChance({ agility: 0, stamina: 0, pursuit: 100 }), 5)
assert.equal(damageMultiplier({ resistances_json: { fire: 0.5 }, weaknesses_json: {} }, 'fire'), 0.5)
assert.equal(damageMultiplier({ resistances_json: {}, weaknesses_json: { fire: 0.5 } }, 'fire'), 1.5)

console.log('Action interpreter checks passed.')
