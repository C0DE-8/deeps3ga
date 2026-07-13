const assert = require('node:assert/strict')
const { localInterpret, validateInterpretation } = require('../src/modules/gameEngine/actionInterpreter.service')

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

console.log('Action interpreter checks passed.')
