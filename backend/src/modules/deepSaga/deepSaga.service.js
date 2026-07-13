const { getAiConfig } = require('../../config/ai')
const { deepSagaFlow } = require('./deepSaga.flow')
const { buildNarrativeSystemPrompt, buildScenePrompt } = require('./deepSaga.prompts')
const { worldBible } = require('./deepSaga.world')

function getFlow() {
  return {
    name: 'Deep Saga',
    premise: 'A dark fantasy story told through chat, where each message is the next page and choices shape the novel.',
    backendOrder: [
      'auth router for accounts',
      'database config from .env',
      'soul router for reincarnation memory',
      'story router for narrator messages',
      '10 dungeons with 5 floors each',
      'boss floor progression',
      'legacy guardian from the previous completed story',
    ],
    frontendOrder: [
      'axios API client',
      'feature folders',
      'module CSS per component',
      'novel-like story page',
      'choice buttons at story pauses',
      'free action input',
      'soul and dungeon progress panels',
    ],
    phases: deepSagaFlow,
  }
}

function getWorldBible() {
  return {
    rule: 'The database is the brain. The AI reads world state, narrates one scene, and returns updates for the game to persist.',
    places: worldBible,
  }
}

async function continueScene(payload) {
  const ai = getAiConfig()

  if (!ai.apiKey) {
    throw new Error('Narrative AI is unavailable.')
  }

  const response = await fetch(ai.chatCompletionsUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ai.model,
      temperature: ai.temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildNarrativeSystemPrompt() },
        buildScenePrompt(payload),
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Narrative AI request failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || '{}'
  return JSON.parse(content)
}

module.exports = { continueScene, getFlow, getWorldBible }
