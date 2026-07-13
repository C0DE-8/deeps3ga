function buildScenePrompt({ playerAction, actionKind, selectedTarget, turnContext, validationErrors = [] }) {
  return {
    role: 'user',
    content: JSON.stringify({
      task: validationErrors.length ? 'repair_turn' : 'resolve_turn',
      playerAction,
      actionKind,
      selectedTarget: selectedTarget || null,
      validationErrors,
      turnContext,
    }),
  }
}

module.exports = { buildScenePrompt }
