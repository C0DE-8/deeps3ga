function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}

async function grantAchievement(connection, state, key, name, description, evidence, result) {
  const [inserted] = await connection.execute(
    `INSERT IGNORE INTO character_achievements (character_life_id, story_cycle_id, achievement_key, name, description, evidence_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [state.run.character_life_id, state.run.id, key, name, description, JSON.stringify(evidence)],
  )
  if (inserted.affectedRows) result.achievements.push({ key, name })
}

async function updateFamilyMastery(connection, state, skillKey, amount, result) {
  const [skills] = await connection.execute('SELECT id, family_id FROM skills WHERE skill_key = ?', [skillKey])
  if (!skills[0]?.family_id) return
  const familyId = skills[0].family_id
  await connection.execute(
    `INSERT INTO character_family_mastery (character_life_id, skill_family_id, mastery_xp, mastery_level, skills_unlocked)
     VALUES (?, ?, ?, 0, 0)
     ON DUPLICATE KEY UPDATE mastery_xp = mastery_xp + VALUES(mastery_xp)`,
    [state.run.character_life_id, familyId, amount],
  )
  await connection.execute(
    `UPDATE character_family_mastery cfm SET mastery_level = FLOOR(mastery_xp / 100),
       skills_unlocked = (SELECT COUNT(*) FROM character_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.character_life_id = cfm.character_life_id AND s.family_id = cfm.skill_family_id)
     WHERE character_life_id = ? AND skill_family_id = ?`,
    [state.run.character_life_id, familyId],
  )
  const [mastery] = await connection.execute('SELECT * FROM character_family_mastery WHERE character_life_id = ? AND skill_family_id = ?', [state.run.character_life_id, familyId])
  result.familyMastery.push({ familyId, xp: mastery[0].mastery_xp, level: mastery[0].mastery_level, skillsUnlocked: mastery[0].skills_unlocked })
}

async function unlockAchievementSkills(connection, state, result) {
  const [achievements] = await connection.execute('SELECT achievement_key FROM character_achievements WHERE character_life_id = ?', [state.run.character_life_id])
  const achieved = new Set(achievements.map((row) => row.achievement_key))
  const [hiddenSkills] = await connection.execute("SELECT * FROM skills WHERE visibility = 'hidden'")
  for (const skill of hiddenSkills) {
    const rules = parseJson(skill.discovery_rules_json, {})
    const achievement = rules.achievement || rules.impossibleAchievement
    if (!achievement || !achieved.has(achievement)) continue
    const [owned] = await connection.execute('SELECT 1 FROM character_skills WHERE character_life_id = ? AND skill_id = ?', [state.run.character_life_id, skill.id])
    if (owned[0]) continue
    await connection.execute(
      `INSERT INTO character_skills (character_life_id, skill_id, skill_level, skill_xp, xp_needed, unlocked, discovered_at, discovery_context_json, equipped)
       VALUES (?, ?, 1, 0, 100, 1, CURRENT_TIMESTAMP, ?, 0)`,
      [state.run.character_life_id, skill.id, JSON.stringify({ achievement })],
    )
    result.skillsUnlocked.push({ skillKey: skill.skill_key, name: skill.name, identityText: skill.identity_text, hidden: true })
    await updateFamilyMastery(connection, state, skill.skill_key, 50, result)
  }
}

async function offerEvolutionChoices(connection, state, result) {
  const [owned] = await connection.execute(
    `SELECT s.id, s.skill_key, s.name, s.evolution_rules_json, cs.skill_level
       FROM character_skills cs JOIN skills s ON s.id = cs.skill_id
      WHERE cs.character_life_id = ? AND cs.skill_level >= 3`,
    [state.run.character_life_id],
  )
  for (const source of owned) {
    const nextSkills = parseJson(source.evolution_rules_json, {}).nextSkills || []
    for (const nextKey of nextSkills) {
      const [options] = await connection.execute('SELECT id, name FROM skills WHERE skill_key = ?', [nextKey])
      if (!options[0]) continue
      await connection.execute(
        `INSERT IGNORE INTO skill_evolution_choices (character_life_id, source_skill_id, option_skill_id, offered_reason_json)
         VALUES (?, ?, ?, ?)`,
        [state.run.character_life_id, source.id, options[0].id, JSON.stringify({ sourceLevel: source.skill_level })],
      )
    }
  }
  const [available] = await connection.execute(
    `SELECT sec.id, source.name AS source_name, option.name AS option_name, option.skill_key AS option_key
       FROM skill_evolution_choices sec JOIN skills source ON source.id = sec.source_skill_id JOIN skills option ON option.id = sec.option_skill_id
      WHERE sec.character_life_id = ? AND sec.status = 'available'`,
    [state.run.character_life_id],
  )
  result.evolutionChoices = available
}

async function chooseEvolution(connection, state, action, result) {
  const text = action.toLowerCase()
  if (!text.includes('evolve') && !text.includes('choose evolution')) return
  const [choices] = await connection.execute(
    `SELECT sec.id, sec.option_skill_id, s.skill_key, s.name, s.identity_text
       FROM skill_evolution_choices sec JOIN skills s ON s.id = sec.option_skill_id
      WHERE sec.character_life_id = ? AND sec.status = 'available'`,
    [state.run.character_life_id],
  )
  const choice = choices.find((row) => text.includes(row.name.toLowerCase()) || text.includes(row.skill_key.replaceAll('-', ' ')))
  if (!choice) return
  await connection.execute("UPDATE skill_evolution_choices SET status = 'chosen', chosen_at = CURRENT_TIMESTAMP WHERE id = ?", [choice.id])
  await connection.execute("UPDATE skill_evolution_choices SET status = 'declined' WHERE character_life_id = ? AND id <> ? AND status = 'available'", [state.run.character_life_id, choice.id])
  await connection.execute(
    `INSERT IGNORE INTO character_skills (character_life_id, skill_id, skill_level, skill_xp, xp_needed, unlocked, discovered_at, discovery_context_json, equipped)
     VALUES (?, ?, 1, 0, 100, 1, CURRENT_TIMESTAMP, ?, 0)`,
    [state.run.character_life_id, choice.option_skill_id, JSON.stringify({ evolutionChoiceId: choice.id })],
  )
  result.skillsUnlocked.push({ skillKey: choice.skill_key, name: choice.name, identityText: choice.identity_text, evolved: true })
  result.evolutionChosen = { skillKey: choice.skill_key, name: choice.name }
}

async function processUltimateTrials(connection, state, signatures, result) {
  const [masteries] = await connection.execute('SELECT * FROM character_family_mastery WHERE character_life_id = ? AND mastery_level >= 5', [state.run.character_life_id])
  for (const mastery of masteries) {
    const [ultimates] = await connection.execute("SELECT id, skill_key, name FROM skills WHERE family_id = ? AND skill_type = 'ultimate'", [mastery.skill_family_id])
    for (const ultimate of ultimates) {
      await connection.execute(
        `INSERT IGNORE INTO ultimate_skill_trials (character_life_id, skill_id, trial_key, status, required_progress, conditions_json, evidence_json, started_at)
         VALUES (?, ?, ?, 'active', 3, ?, '[]', CURRENT_TIMESTAMP)`,
        [state.run.character_life_id, ultimate.id, `mastery-${ultimate.skill_key}`, JSON.stringify({ familyMastery: 5, exceptionalActions: 3 })],
      )
    }
    await connection.execute('UPDATE character_family_mastery SET ultimate_trial_unlocked = 1 WHERE character_life_id = ? AND skill_family_id = ?', [state.run.character_life_id, mastery.skill_family_id])
  }
  if (!signatures.includes('creative_action') && signatures.length < 2) return
  const [trials] = await connection.execute("SELECT * FROM ultimate_skill_trials WHERE character_life_id = ? AND status = 'active'", [state.run.character_life_id])
  for (const trial of trials) {
    const progress = Number(trial.progress) + 1
    const completed = progress >= Number(trial.required_progress)
    await connection.execute('UPDATE ultimate_skill_trials SET progress = ?, status = ?, completed_at = ? WHERE id = ?', [progress, completed ? 'completed' : 'active', completed ? new Date() : null, trial.id])
    result.ultimateTrials.push({ trialKey: trial.trial_key, progress, required: trial.required_progress, status: completed ? 'completed' : 'active' })
    if (completed) {
      await connection.execute(
        `INSERT IGNORE INTO character_skills (character_life_id, skill_id, skill_level, skill_xp, xp_needed, unlocked, discovered_at, discovery_context_json, equipped)
         VALUES (?, ?, 1, 0, 100, 1, CURRENT_TIMESTAMP, ?, 0)`,
        [state.run.character_life_id, trial.skill_id, JSON.stringify({ ultimateTrialId: trial.id })],
      )
    }
  }
}

async function processAdvancedSkills(connection, state, action, signatures, result) {
  result.achievements ||= []
  result.familyMastery ||= []
  result.ultimateTrials ||= []
  if (signatures.includes('protect') && signatures.includes('refuse') && action.toLowerCase().includes('authority')) {
    await grantAchievement(connection, state, 'surrender_authority_to_save_enemy', 'The Empty Throne', 'Surrendered authority to protect an enemy.', { action, floorId: state.run.current_floor_id }, result)
  }
  if (signatures.includes('consume') && action.toLowerCase().includes('reflect')) {
    await grantAchievement(connection, state, 'survive_devour_and_reflect', 'Hunger Looking Back', 'Reflected an act of consumption at its source.', { action }, result)
  }
  if (result.skillUsed?.skillKey) await updateFamilyMastery(connection, state, result.skillUsed.skillKey, 10, result)
  for (const skill of result.skillsUnlocked) await updateFamilyMastery(connection, state, skill.skillKey, 25, result)
  await unlockAchievementSkills(connection, state, result)
  await offerEvolutionChoices(connection, state, result)
  await chooseEvolution(connection, state, action, result)
  await processUltimateTrials(connection, state, signatures, result)
}

module.exports = { processAdvancedSkills, updateFamilyMastery }
