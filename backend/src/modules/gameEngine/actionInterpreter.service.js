const { getAiConfig } = require('../../config/ai')

const FORBIDDEN_PATTERNS = [
  /\b(admin|developer|console|system)\s+(power|command|access|mode)/i,
  /\b(spawn|generate|give myself|add)\b.*\b(gold|xp|item|skill|level|money)\b/i,
  /\b(set|change)\b.*\b(hp|mana|level|stat|gold|xp)\b/i,
  /\b(delete|edit|update|hack)\b.*\b(database|save|account|character)\b/i,
]

const IMPOSSIBLE_PATTERNS = [
  /\b(become|turn into|transform into)\b.*\b(god|omnipotent|invincible|immortal)\b/i,
  /\b(create|summon|conjure)\b.*\b(infinite|billion|million)\b/i,
  /\bteleport\b/i,
  /\b(stop|reverse|rewrite)\s+time\b/i,
]

const ALLOWED_SIGNATURES = new Set([
  'attack', 'bite', 'magic', 'defend', 'dodge', 'heal', 'protect', 'spare', 'flee', 'analyze', 'solve',
  'negotiate', 'befriend', 'hide', 'create', 'consume', 'remember', 'refuse', 'explore', 'protect_dragon',
  'reject_prophecy', 'refuse_cruel_order', 'refuse_bargain', 'show_mercy', 'challenge_law', 'confess_truth',
  'restore_name', 'reject_false_history', 'break_habit', 'accept_imperfect_self', 'protect_future', 'creative_action',
])

function localInterpret(action) {
  const text = action.trim()
  if (!text) return { status: 'INVALID', intent: 'none', reason: 'No action was provided.', confidence: 1 }
  if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(text))) {
    return { status: 'INVALID', intent: 'rule_manipulation', reason: 'The request attempts to bypass game mechanics.', confidence: 1 }
  }
  if (IMPOSSIBLE_PATTERNS.some((pattern) => pattern.test(text))) {
    return { status: 'IMPOSSIBLE', intent: 'reality_breaking_action', reason: 'The character has no known ability that makes this possible.', confidence: 1 }
  }

  const intents = [
    ['flee', /\b(flee|escape|retreat|run(?:ning)? away|leave the fight)\b/i],
    ['attack', /\b(attack|strike|slash|stab|shoot|hit|fight|bite|cast|fireball)\b/i],
    ['defend', /\b(defend|block|brace|guard|shield)\b/i],
    ['dodge', /\b(dodge|evade|roll|sidestep)\b/i],
    ['heal', /\b(heal|bandage|medicine|potion|restore|treat)\b/i],
    ['social', /\b(talk|ask|negotiate|persuade|bargain|befriend|comfort|spare)\b/i],
    ['analyze', /\b(analyze|inspect|study|observe|weakness)\b/i],
    ['explore', /\b(explore|search|open|enter|follow|climb|continue|advance|walk|move|hide|sneak)\b/i],
  ].filter(([, pattern]) => pattern.test(text)).map(([intent]) => intent)

  if (!intents.length) return { status: 'UNKNOWN', intent: 'unknown', reason: 'The intended action could not be identified.', confidence: 0.2 }
  const primary = intents.includes('flee') ? 'flee' : intents[0]
  return { status: 'VALID', intent: primary, secondaryIntents: intents.filter((value) => value !== primary), reason: null, confidence: 0.75 }
}

function validateInterpretation(value, fallback) {
  const statuses = ['VALID', 'UNKNOWN', 'AMBIGUOUS', 'INVALID', 'IMPOSSIBLE']
  const intents = ['attack', 'defend', 'dodge', 'heal', 'flee', 'social', 'analyze', 'explore', 'unknown', 'rule_manipulation', 'reality_breaking_action']
  if (!value || !statuses.includes(value.status) || !intents.includes(value.intent)) return fallback
  return {
    status: value.status,
    intent: value.intent,
    secondaryIntents: Array.isArray(value.secondaryIntents) ? value.secondaryIntents.filter((item) => intents.includes(item)) : [],
    target: typeof value.target === 'string' ? value.target.slice(0, 120) : null,
    method: typeof value.method === 'string' ? value.method.slice(0, 240) : null,
    goal: typeof value.goal === 'string' ? value.goal.slice(0, 240) : null,
    approach: typeof value.approach === 'string' ? value.approach.slice(0, 80) : null,
    signatures: Array.isArray(value.signatures) ? [...new Set(value.signatures.filter((item) => ALLOWED_SIGNATURES.has(item)))].slice(0, 12) : [],
    referencedEntities: Array.isArray(value.referencedEntities) ? value.referencedEntities.filter((item) => typeof item === 'string').map((item) => item.slice(0, 120)).slice(0, 8) : [],
    requiredCapabilities: Array.isArray(value.requiredCapabilities)
      ? value.requiredCapabilities.filter((item) => item && typeof item === 'object').map((item) => ({ type: String(item.type || '').slice(0, 30), name: String(item.name || '').slice(0, 120) })).slice(0, 6)
      : [],
    reason: typeof value.reason === 'string' ? value.reason.slice(0, 240) : null,
    confidence: Math.max(0, Math.min(1, Number(value.confidence) || 0)),
  }
}

async function interpretAction(action, state) {
  const fallback = localInterpret(action)
  if (fallback.status === 'INVALID' || fallback.status === 'IMPOSSIBLE') return fallback
  const ai = getAiConfig()
  if (!ai.apiKey) return fallback

  try {
    const response = await fetch(ai.chatCompletionsUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ai.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ai.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `You are Deep Saga's intention interpreter, never its narrator or outcome engine. Understand unrestricted natural language without requiring command words. Return JSON with status, intent, secondaryIntents, target, method, goal, approach, signatures, referencedEntities, requiredCapabilities, reason, and confidence. Do not decide whether an attempt succeeds. status is normally VALID unless language is unknown, ambiguous, explicitly manipulates system rules, or describes no coherent intention. intent must be attack, defend, dodge, heal, flee, social, analyze, explore, unknown, rule_manipulation, or reality_breaking_action. approach describes how the player acts. requiredCapabilities lists every skill, item, physical trait, or environmental object the attempt depends on. signatures may only use: ${[...ALLOWED_SIGNATURES].join(', ')}. Infer semantic signatures from meaning, not keyword matching.` },
          { role: 'user', content: JSON.stringify({
            action,
            currentFloor: state.currentFloor,
            activeStoryBeat: state.activeStoryBeat,
            knownSkills: state.skills.map((skill) => skill.name),
            inventory: state.inventory.map((item) => item.name),
            presentNpcs: state.activeNpcs.map((npc) => npc.name),
            presentCreatures: state.activeMonsters.map((monster) => ({ name: monster.name, status: monster.status })),
            combatParticipants: state.combatParticipants.map((entry) => ({ name: entry.display_name, team: entry.team, status: entry.status })),
            inCombat: Boolean(state.activeEncounter),
          }) },
        ],
      }),
    })
    if (!response.ok) return fallback
    const data = await response.json()
    return validateInterpretation(JSON.parse(data.choices?.[0]?.message?.content || '{}'), fallback)
  } catch {
    return fallback
  }
}

module.exports = { ALLOWED_SIGNATURES, interpretAction, localInterpret, validateInterpretation }
