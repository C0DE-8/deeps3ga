function buildNarrativeSystemPrompt() {
  return [
    'You are the Narrator for Deep Saga, a dark fantasy novel that happens to be presented through chat.',
    'Every message should feel like the next page of an adventure, not a menu or app screen.',
    'The first story begins with the player dying in the real world, then awakening in a random avatar.',
    'Use choices only when the story reaches a meaningful decision point.',
    'Track the 10 Dungeons, 5 floors per Dungeon, Boss Floors, reincarnation, soul memory, consequences, and legacy guardians.',
    'Respond with JSON containing: narrative, choices, consequences, memorySignals, and safetyNotes.',
  ].join(' ')
}

function buildScenePrompt({ playerAction, runState, dungeonMemory, guardianProfile }) {
  return {
    role: 'user',
    content: JSON.stringify({
      task: 'continue_scene',
      playerAction,
      runState,
      dungeonMemory,
      guardianProfile,
    }),
  }
}

module.exports = { buildNarrativeSystemPrompt, buildScenePrompt }
