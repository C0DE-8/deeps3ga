const assert = require('node:assert/strict')
const { localInterpret, validateInterpretation } = require('../src/modules/gameEngine/actionInterpreter.service')
const { validateReality } = require('../src/modules/gameEngine/realityValidator.service')
const { enforceNarrativeScene } = require('../src/modules/deepSaga/narrativeEnforcer.service')
const { buildStatusSummary } = require('../src/modules/deepSaga/narrativeEnforcer.service')
const { calculateEscapeChance, damageMultiplier, evaluateActionCheck, evaluateFloorGate } = require('../src/modules/gameEngine/turnEngine.service')
const { normalizeScene } = require('../src/modules/gameEngine/gameEngine.service')
const { selectActiveStoryBeat } = require('../src/db/repositories/gameState.repository')

assert.equal(localInterpret('I run away from the wolf.').intent, 'flee')
assert.equal(localInterpret('I attack the wolf.').intent, 'attack')
assert.equal(localInterpret('I become a god.').status, 'VALID')
assert.equal(localInterpret('I use my admin powers.').status, 'VALID')
assert.equal(localInterpret('Spawn 1 billion gold.').status, 'VALID')
assert.equal(localInterpret('Perhaps.').status, 'VALID')
assert.deepEqual(
  validateInterpretation({ status: 'VALID', intent: 'flee', confidence: 0.9 }, {}),
  { status: 'VALID', intent: 'flee', secondaryIntents: [], target: null, method: null, goal: null, approach: null, signatures: [], referencedEntities: [], requiredCapabilities: [], reason: null, confidence: 0.9 },
)
assert.deepEqual(validateInterpretation({ status: 'SUCCESS', intent: 'god' }, { status: 'INVALID' }), { status: 'INVALID' })

const state = {
  activeEncounter: { id: 1 },
  activeMonsters: [{ name: 'Ash Wolf' }],
  combatParticipants: [{ team: 'enemy', status: 'active', display_name: 'Ash Wolf' }],
  characterSheet: { hp: 50, max_hp: 100 },
  currentDungeon: { name: 'Cradlewood Threshold', dungeon_number: 1, difficulty_level: 1 },
  currentFloor: { floor_name: 'Broken Hunter Camp', floor_number: 4, story_purpose: 'Survive the hunter camp.' },
  floorRuntime: { encounterRequired: true, encounterCompleted: false, decisionRequired: false, decisionCompleted: true, floorExitUnlocked: false },
  skills: [{ id: 4, name: 'Black Flame' }],
  inventory: [{ inventory_id: 8, name: 'Red Tonic' }],
}
assert.equal(validateReality('I flee.', localInterpret('I flee.'), state).status, 'VALID')
assert.equal(validateReality('I attack the absent king.', { status: 'VALID', intent: 'attack', target: 'Absent King' }, state).status, 'VALID')
assert.equal(validateReality('I attack the absent king.', localInterpret('I attack the absent king.'), state).status, 'VALID')
assert.equal(validateReality('I cast Black Flame.', localInterpret('I cast Black Flame.'), state).status, 'VALID')
assert.equal(validateReality('I cast World Eraser.', localInterpret('I cast World Eraser.'), state).status, 'IMPOSSIBLE')
assert.equal(validateReality('I shape the darkness around it.', { status: 'VALID', intent: 'attack', signatures: ['magic', 'create'], requiredCapabilities: [{ type: 'skill', name: 'Black Flame' }] }, state).status, 'VALID')
assert.equal(validateReality('I fold the road beneath me.', { status: 'VALID', intent: 'explore', signatures: ['magic'], requiredCapabilities: [{ type: 'skill', name: 'World Fold' }] }, state).status, 'IMPOSSIBLE')
assert.equal(validateReality('I spend 50 Gold.', { status: 'VALID', intent: 'social', requiredCapabilities: [{ type: 'gold', amount: 50 }] }, state).status, 'IMPOSSIBLE')
assert.equal(validateReality('I finish the lost crown quest.', { status: 'VALID', intent: 'social', requiredCapabilities: [{ type: 'quest', name: 'Lost Crown' }] }, state).status, 'IMPOSSIBLE')
assert.equal(validateReality('I edit the account.', { status: 'VALID', intent: 'unknown', requiredCapabilities: [{ type: 'account', name: 'current' }] }, state).rejectionCode, 'protected_state')
assert.equal(validateReality('I flee.', localInterpret('I flee.'), { ...state, activeEncounter: null }).status, 'VALID')
assert.equal(validateReality('I attack Mara.', { status: 'VALID', intent: 'attack', target: 'Mara' }, { ...state, activeNpcs: [{ name: 'Mara', status: 'friendly' }] }).status, 'VALID')
assert.equal(validateReality('I activate the lantern mechanism.', { status: 'VALID', intent: 'explore', requiredCapabilities: [{ type: 'environment', name: 'lantern mechanism' }] }, state).status, 'VALID')
const skippedFloor = validateReality('I go to Floor 5.', { status: 'VALID', intent: 'explore', signatures: ['explore'], requiredCapabilities: [] }, state)
assert.equal(skippedFloor.status, 'INVALID')
assert.equal(skippedFloor.rejectionCode, 'progression_gate')
assert.equal(skippedFloor.sceneAnchors.currentFloor, 'Broken Hunter Camp')
assert.equal(validateReality('I complete this floor.', { status: 'VALID', intent: 'explore', signatures: ['explore'], requiredCapabilities: [] }, state).rejectionCode, 'progression_gate')
assert.equal(validateReality('I go to Floor 5.', { status: 'VALID', intent: 'explore', signatures: ['explore'], requiredCapabilities: [] }, { ...state, floorRuntime: { ...state.floorRuntime, floorExitUnlocked: true } }).status, 'VALID')

const aiChoices = [
  { id: 'press', text: 'Press toward the circling wolf now.', action: 'I press toward the circling wolf.', direction: 'confrontation', consequence: 'The wolf may retaliate.', anchor: 'circling wolf' },
  { id: 'speak', text: 'Offer the circling wolf fresh meat.', action: 'I offer the wolf fresh meat.', direction: 'negotiation', consequence: 'The food may draw it closer.', anchor: 'fresh meat' },
  { id: 'cover', text: 'Back toward the rain-dark trees carefully.', action: 'I back toward the trees.', direction: 'retreat', consequence: 'You surrender open ground.', anchor: 'rain-dark trees' },
]

const enforced = enforceNarrativeScene(
  { story: 'You reach for authority that does not belong to this body. The wolf circles closer while the imagined crown dissolves into cold rain.', characterChanges: ['Level 99'], newItemsOrSkills: ['Divine Crown'], memorySignals: ['Became king'], choices: aiChoices },
  { rewards: { xp: 0, gold: 0 }, itemsAwarded: [], skillsUnlocked: [], rejection: { status: 'IMPOSSIBLE', reason: 'No crown exists.' }, interpretation: { status: 'IMPOSSIBLE', intent: 'rule_manipulation' } },
)
assert.match(enforced.story, /wolf circles closer/)
assert.deepEqual(enforced.characterChanges, [])
assert.deepEqual(enforced.newItemsOrSkills, [])
assert.deepEqual(enforced.memorySignals, [])

const contextualScene = enforceNarrativeScene(
  { story: 'The stag recoils as a heavier shape moves beyond the lantern moss.', choices: [{ id: 'track', text: 'Examine the broken reeds behind it.', action: 'I examine the broken reeds.', direction: 'investigation', consequence: 'The hidden hunter may notice you.', anchor: 'broken reeds' }] },
  { rewards: {}, itemsAwarded: [], skillsUnlocked: [], rejection: { status: 'INVALID', code: 'target_non_hostile' }, interpretation: { status: 'INVALID', intent: 'attack' } },
)
assert.match(contextualScene.story, /stag recoils/)
assert.equal(contextualScene.choices[0].direction, 'investigation')
assert.equal(contextualScene.choices[0].action, 'I examine the broken reeds.')

assert.throws(() => enforceNarrativeScene({ story: '', choices: [] }, { rewards: {}, itemsAwarded: [], skillsUnlocked: [] }), /no story text/)
assert.throws(() => enforceNarrativeScene({ story: 'The road waits.', choices: ['Continue.'] }, { rewards: {}, itemsAwarded: [], skillsUnlocked: [] }), /malformed choice/)
assert.throws(() => normalizeScene({ story: 'The road waits.', choices: [], stateChanges: {} }), /stateChanges must be an array/)
assert.throws(() => normalizeScene({ story: 'The road waits.', choices: [], accountId: 99 }), /protected account state/)

const normalEscape = calculateEscapeChance({ agility: 10, stamina: 50, pursuit: 10 })
assert.equal(normalEscape, 60)
assert.ok(calculateEscapeChance({ agility: 20, stamina: 80, pursuit: 5 }) > normalEscape)
assert.ok(calculateEscapeChance({ agility: 10, stamina: 50, pursuit: 10, statuses: ['frozen'] }) < normalEscape)
assert.ok(calculateEscapeChance({ agility: 10, stamina: 50, pursuit: 10, boss: true }) < normalEscape)
assert.equal(calculateEscapeChance({ agility: 100, stamina: 100, pursuit: 0 }), 90)
assert.equal(calculateEscapeChance({ agility: 0, stamina: 0, pursuit: 100 }), 5)
assert.equal(damageMultiplier({ resistances_json: { fire: 0.5 }, weaknesses_json: {} }, 'fire'), 0.5)
assert.equal(damageMultiplier({ resistances_json: {}, weaknesses_json: { fire: 0.5 } }, 'fire'), 1.5)

const capableAction = evaluateActionCheck({
  characterSheet: { charisma: 12, level: 4 }, currentDungeon: { difficulty_level: 1 }, injuries: [], statusEffects: [], previousChoices: [],
}, 'social', {}, 20)
assert.equal(capableAction.outcome, 'exceptional')
const strainedAction = evaluateActionCheck({
  characterSheet: { agility: 2, level: 1 }, currentDungeon: { difficulty_level: 4 }, injuries: [{ severity: 'major' }], statusEffects: [{ name: 'Frozen' }], previousChoices: [],
}, 'explore', {}, 1)
assert.equal(strainedAction.outcome, 'failure')
assert.equal(strainedAction.modifiers.injuryPenalty, 5)
assert.equal(strainedAction.modifiers.statusPenalty, 2)

const beats = [
  { beat_number: 1, beat_type: 'arrival', title: 'Arrival' },
  { beat_number: 2, beat_type: 'discovery', title: 'Discovery' },
  { beat_number: 3, beat_type: 'choice', title: 'Consequence' },
]
assert.equal(selectActiveStoryBeat(beats, { scene_count: 0 }).activeStoryBeat.beat_number, 1)
assert.equal(selectActiveStoryBeat(beats, { scene_count: 1 }).activeStoryBeat.beat_number, 2)
assert.deepEqual(selectActiveStoryBeat(beats, { scene_count: 1 }).lockedStoryBeats.map((beat) => beat.beat_number), [3])
assert.equal(selectActiveStoryBeat(beats, { scene_count: 20 }).activeStoryBeat.beat_number, 3)

const gatedRuntime = { objective_required: 3, combat_required: 1, combat_completed: 0, story_decision_completed: 0 }
assert.equal(evaluateFloorGate({ runtime: gatedRuntime, runtimeState: { decisionRequired: false }, bossFloor: false, result: { combat: null, signatures: ['explore'] }, progress: 3 }).ready, false)
assert.equal(evaluateFloorGate({ runtime: gatedRuntime, runtimeState: { decisionRequired: false }, bossFloor: false, result: { combat: { status: 'resolved_peacefully' }, signatures: ['negotiate'] }, progress: 3 }).ready, true)
assert.equal(evaluateFloorGate({ runtime: gatedRuntime, runtimeState: { decisionRequired: false }, bossFloor: true, result: { combat: { status: 'escaped' }, signatures: ['flee'] }, progress: 3 }).ready, false)
assert.equal(evaluateFloorGate({ runtime: gatedRuntime, runtimeState: { decisionRequired: false }, bossFloor: true, result: { combat: { status: 'victory' }, signatures: ['attack'] }, progress: 3 }).ready, true)
assert.equal(evaluateFloorGate({ runtime: gatedRuntime, runtimeState: { decisionRequired: false }, bossFloor: true, activeBoss: { status: 'spared', current_hp: 40 }, result: { combat: null, signatures: ['negotiate'] }, progress: 3 }).ready, true)
assert.equal(evaluateFloorGate({ runtime: { ...gatedRuntime, combat_required: 0 }, runtimeState: { decisionRequired: true }, bossFloor: false, result: { combat: null, signatures: ['explore'] }, progress: 3 }).ready, false)
assert.equal(evaluateFloorGate({ runtime: { ...gatedRuntime, combat_required: 0 }, runtimeState: { decisionRequired: true }, bossFloor: false, result: { combat: null, signatures: ['analyze'] }, progress: 3 }).ready, true)

assert.deepEqual(buildStatusSummary({
  characterSheet: { level: 3, hp: 42, max_hp: 60, stamina: 20, max_stamina: 30, mana: 15, max_mana: 25, gold: 188 },
  inventory: [{ name: 'Rust Dagger', item_type: 'weapon', equipped_slot: 'weapon', quantity: 1 }, { name: 'Field Bandage', item_type: 'consumable', quantity: 2 }],
  activeQuests: [{ name: 'Find the Missing Scout' }], companions: [{ name: 'Lyra' }], statusEffects: [{ name: 'Bleeding' }],
}), {
  level: 3, hp: '42/60', stamina: '20/30', mana: '15/25', gold: 188, equippedWeapon: 'Rust Dagger', relevantInventory: ['Field Bandage x2'], activeQuests: ['Find the Missing Scout'], companions: ['Lyra'], statusEffects: ['Bleeding'],
})

console.log('Action interpreter checks passed.')
