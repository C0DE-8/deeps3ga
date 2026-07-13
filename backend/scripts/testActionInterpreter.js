const assert = require('node:assert/strict')
const { validateGameMasterTurn } = require('../src/modules/deepSaga/narrativeEnforcer.service')

const targets = [
  { type: 'monster', id: 14, name: 'Thornback Brute', hp: 40, maxHp: 40, status: 'alive', reachable: true },
  { type: 'monster', id: 15, name: 'Ashhide Wolf Pack', hp: 32, maxHp: 32, status: 'alive', reachable: true },
  { type: 'monster', id: 16, name: 'Thornmouth Cub', hp: 18, maxHp: 18, status: 'alive', reachable: true },
]

const state = {
  run: { id: 1, character_life_id: 9, soul_profile_id: 2, soul_energy: 0 },
  characterSheet: { character_name: 'Veya', hp: 27, max_hp: 50, mana: 20, max_mana: 30, stamina: 18, max_stamina: 24, gold: 10, xp: 0 },
  currentDungeon: { id: 1, dungeon_number: 1, name: 'Cradlewood Threshold' },
  currentFloor: { id: 102, floor_number: 2, floor_name: 'Hunter\'s Lantern Road', floor_type: 'story' },
  floorRuntime: { floorComplete: false, exitUnlocked: false, bossVictorySaved: false },
  availableFloorExits: [{ id: 103, dungeon_id: 1, dungeon_name: 'Crimson Wakewood', floor_number: 3, floor_name: 'Heartroot Den' }],
  reachableTargets: targets,
  activeMonsters: targets.map((target) => ({ instance_id: target.id, name: target.name, current_hp: target.hp, max_hp: target.maxHp, status: target.status })),
  activeNpcs: [{ id: 4, name: 'Liora', run_life_status: 'alive' }],
  companions: [{ id: 7, name: 'Liora', hp: 35, max_hp: 40, companion_status: 'active', active: 1 }],
  statusEffects: [],
  statusCatalog: [{ id: 1, status_key: 'bleeding', name: 'Bleeding', default_duration_turns: 4 }],
  inventory: [],
  itemCatalog: [],
  skillCatalog: [],
  activeQuests: [],
}

const thornbackTurn = {
  sceneType: 'combat',
  actionResolution: {
    intent: 'ATTACK',
    outcome: 'PARTIAL_SUCCESS',
    targetType: 'monster',
    targetId: 14,
    targetName: 'Thornback Brute',
    targetChangedReason: null,
    summary: 'Veya wounds the Thornback Brute but remains exposed.',
  },
  story: 'Veya drives the rusty blade beneath the Thornback Brute\'s split left armor plate. Bark-hard hide gives way for a heartbeat, and dark sap spatters the rain-carved stones. The Thornback Brute recoils with nine points of the wound carved into its flank, but its backward sweep forces Veya to spend precious stamina staying inside the killing arc. The Ashhide Wolf Pack circles beyond the narrow stones while the Thornmouth Cub remains crouched beside Liora, watching rather than joining the attack.',
  stateChanges: {
    playerHpDelta: 0,
    playerManaDelta: 0,
    playerStaminaDelta: -4,
    goldDelta: 0,
    playerXpDelta: 0,
    soulEnergyDelta: 0,
    targets: [{ type: 'monster', id: 14, name: 'Thornback Brute', hpDelta: -9, newStatuses: [], removedStatuses: [] }],
    playerStatusesAdded: [],
    playerStatusesRemoved: [],
    playerStatusUpdates: [],
    itemsAdded: [],
    itemsRemoved: [],
    skillsAdded: [],
    questUpdates: [],
    relationshipChanges: [],
    floorComplete: false,
    exitUnlocked: false,
    floorChange: null,
    bossDefeated: false,
    characterDied: false,
    runCompleted: false,
  },
  recordChanges: [
    { type: 'damage', text: '9 damage to Thornback Brute', targetType: 'monster', targetId: 14 },
    { type: 'stamina', text: '4 Stamina spent' },
  ],
  choices: [
    { id: 'press-brute-wound', title: 'Press the wounded flank', text: 'Stay inside the Thornback Brute\'s reach and strike its newly opened left armor plate before it seals.', action: 'I stay close and strike the opening beneath the Thornback Brute\'s damaged armor.', direction: 'aggressive', targetType: 'monster', targetId: 14 },
    { id: 'funnel-wolf-pack', title: 'Funnel the circling pack', text: 'Fall back across the rain-carved stones and force the Ashhide Wolf Pack through the narrow approach.', action: 'I retreat across the rain-carved stones and draw the Ashhide Wolf Pack into the narrow approach.', direction: 'tactical', targetType: 'monster', targetId: 15 },
    { id: 'analyze-thornmouth-cub', title: 'Read the silent cub', text: 'Use Analyze on the Thornmouth Cub to discover why it refuses to join the Brute\'s attack.', action: 'I use Analyze on the Thornmouth Cub and study why it has not attacked.', direction: 'investigative', targetType: 'monster', targetId: 16 },
    { id: 'coordinate-liora-retreat', title: 'Coordinate with Liora', text: 'Call Liora toward the narrow stones and prepare a controlled retreat before Veya\'s remaining health becomes fatal.', action: 'I call Liora to the narrow stones and coordinate a controlled retreat.', direction: 'protective', targetType: 'companion', targetId: 7 },
  ],
  memoryUpdates: [{ type: 'combat', text: 'Veya wounded the Thornback Brute beneath its left armor plate.' }],
}

const accepted = validateGameMasterTurn(thornbackTurn, state, { selectedTarget: { type: 'monster', id: 14, name: 'Thornback Brute' } })
assert.match(accepted.story, /Thornback Brute/)
assert.equal(accepted.actionResolution.targetId, 14)
assert.equal(accepted.actionResolution.targetName, 'Thornback Brute')
assert.deepEqual(accepted.stateChanges.targets.map((target) => target.id), [14])
assert.equal(accepted.stateChanges.targets[0].hpDelta, -9)
assert.match(accepted.recordChanges[0].text, /Thornback Brute/)
assert.equal(accepted.choices.some((choice) => choice.targetId === 15), true)
assert.equal(accepted.choices.some((choice) => choice.targetId === 16), true)
assert.deepEqual(state.reachableTargets.map((target) => target.id), [14, 15, 16])

const wrongTarget = structuredClone(thornbackTurn)
wrongTarget.stateChanges.targets = [{ type: 'monster', id: 15, name: 'Ashhide Wolf Pack', hpDelta: -9, newStatuses: [], removedStatuses: [] }]
wrongTarget.recordChanges = [{ type: 'damage', text: '9 damage to Ashhide Wolf Pack' }]
assert.throws(() => validateGameMasterTurn(wrongTarget, state, { selectedTarget: { type: 'monster', id: 14, name: 'Thornback Brute' } }), /resolved attack target is missing|not selected/)

const mismatchedName = structuredClone(thornbackTurn)
mismatchedName.stateChanges.targets[0].name = 'Ashhide Wolf Pack'
assert.throws(() => validateGameMasterTurn(mismatchedName, state, { selectedTarget: { type: 'monster', id: 14, name: 'Thornback Brute' } }), /does not belong/)

const attemptedSkip = structuredClone(thornbackTurn)
attemptedSkip.stateChanges.floorComplete = true
attemptedSkip.stateChanges.exitUnlocked = true
attemptedSkip.stateChanges.floorChange = { floorId: 103 }
assert.throws(() => validateGameMasterTurn(attemptedSkip, state, { selectedTarget: { type: 'monster', id: 14, name: 'Thornback Brute' } }), /already be saved/)

const unlockWithoutCompletion = structuredClone(thornbackTurn)
unlockWithoutCompletion.stateChanges.exitUnlocked = true
assert.throws(() => validateGameMasterTurn(unlockWithoutCompletion, state, { selectedTarget: { type: 'monster', id: 14, name: 'Thornback Brute' } }), /requires floorComplete/)

const bleedingState = {
  ...state,
  characterSheet: { ...state.characterSheet, hp: 10 },
  statusEffects: [{ status_key: 'bleeding', name: 'Bleeding', remaining_turns: 1 }],
}
const bleedingTurn = structuredClone(thornbackTurn)
bleedingTurn.actionResolution = { intent: 'DEFEND', outcome: 'SUCCESS', targetType: null, targetId: null, targetName: null, targetChangedReason: null, summary: 'Veya survives the final pulse of bleeding.' }
bleedingTurn.story = 'Veya braces against the rain-carved stone while the last bleeding pulse takes two health. The wound finally closes after the damage, leaving the Thornback Brute watching for weakness.'
bleedingTurn.stateChanges.playerHpDelta = -2
bleedingTurn.stateChanges.playerStaminaDelta = 0
bleedingTurn.stateChanges.targets = []
bleedingTurn.stateChanges.playerStatusesRemoved = ['Bleeding']
bleedingTurn.recordChanges = [
  { type: 'status_damage', statusKey: 'bleeding', text: 'Bleeding deals its final 2 damage' },
  { type: 'status_expired', statusKey: 'bleeding', text: 'Bleeding ended' },
]
const acceptedBleeding = validateGameMasterTurn(bleedingTurn, bleedingState)
assert.deepEqual(acceptedBleeding.recordChanges.map((record) => record.type), ['status_damage', 'status_expired'])

const reversedBleeding = structuredClone(bleedingTurn)
reversedBleeding.recordChanges.reverse()
assert.throws(() => validateGameMasterTurn(reversedBleeding, bleedingState), /damage appears after its expiration/)

console.log('AI Game Master regression checks passed.')
console.log(JSON.stringify(accepted, null, 2))
