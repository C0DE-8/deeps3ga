-- Companion lifecycle, multi-target combat, equipment state, and advanced skill discovery.

ALTER TABLE cycle_npc_states
  ADD COLUMN recruitment_status ENUM('unavailable', 'candidate', 'invited', 'recruited', 'rejected', 'departed') NOT NULL DEFAULT 'unavailable' AFTER present;

ALTER TABLE companions
  ADD COLUMN world_npc_id BIGINT UNSIGNED NULL AFTER id,
  ADD COLUMN companion_status ENUM('active', 'injured', 'dead', 'departed', 'betrayed') NOT NULL DEFAULT 'active' AFTER active,
  ADD COLUMN trust INT NOT NULL DEFAULT 0 AFTER companion_status,
  ADD COLUMN loyalty INT NOT NULL DEFAULT 0 AFTER trust,
  ADD COLUMN fear INT NOT NULL DEFAULT 0 AFTER loyalty,
  ADD COLUMN betrayal INT NOT NULL DEFAULT 0 AFTER fear,
  ADD COLUMN hp INT NOT NULL DEFAULT 60 AFTER betrayal,
  ADD COLUMN max_hp INT NOT NULL DEFAULT 60 AFTER hp,
  ADD COLUMN attack_stat INT NOT NULL DEFAULT 8 AFTER max_hp,
  ADD COLUMN defense_stat INT NOT NULL DEFAULT 6 AFTER attack_stat,
  ADD COLUMN speed_stat INT NOT NULL DEFAULT 6 AFTER defense_stat,
  ADD COLUMN combat_style_json JSON NULL AFTER speed_stat,
  ADD COLUMN recruited_at TIMESTAMP NULL AFTER combat_style_json,
  ADD COLUMN departed_at TIMESTAMP NULL AFTER recruited_at,
  ADD UNIQUE KEY uq_companion_cycle_npc (story_cycle_id, world_npc_id),
  ADD CONSTRAINT fk_companion_world_npc FOREIGN KEY (world_npc_id) REFERENCES world_npcs(id) ON DELETE SET NULL;

CREATE TABLE companion_relationship_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  companion_id BIGINT UNSIGNED NOT NULL,
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  event_type ENUM('recruited', 'rejected', 'trusted', 'feared', 'loyal', 'betrayed', 'injured', 'healed', 'departed', 'died') NOT NULL,
  trust_change INT NOT NULL DEFAULT 0,
  loyalty_change INT NOT NULL DEFAULT 0,
  fear_change INT NOT NULL DEFAULT 0,
  betrayal_change INT NOT NULL DEFAULT 0,
  summary VARCHAR(500) NOT NULL,
  context_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_companion_relationship_companion FOREIGN KEY (companion_id) REFERENCES companions(id) ON DELETE CASCADE,
  CONSTRAINT fk_companion_relationship_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE
);

CREATE TABLE companion_reincarnation_memories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  soul_profile_id BIGINT UNSIGNED NOT NULL,
  world_npc_id BIGINT UNSIGNED NOT NULL,
  source_story_cycle_id BIGINT UNSIGNED NOT NULL,
  memory_type VARCHAR(80) NOT NULL,
  summary TEXT NOT NULL,
  emotional_weight INT NOT NULL DEFAULT 1,
  facts_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_companion_soul_memory (soul_profile_id, world_npc_id, created_at),
  CONSTRAINT fk_companion_reincarnation_soul FOREIGN KEY (soul_profile_id) REFERENCES soul_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_companion_reincarnation_npc FOREIGN KEY (world_npc_id) REFERENCES world_npcs(id) ON DELETE CASCADE,
  CONSTRAINT fk_companion_reincarnation_cycle FOREIGN KEY (source_story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE
);

CREATE TABLE combat_participants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  combat_encounter_id BIGINT UNSIGNED NOT NULL,
  participant_type ENUM('player', 'monster', 'boss', 'legacy_boss', 'companion') NOT NULL,
  reference_id BIGINT UNSIGNED NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  team ENUM('player', 'enemy', 'neutral') NOT NULL,
  current_hp INT NOT NULL,
  max_hp INT NOT NULL,
  attack_stat INT NOT NULL DEFAULT 1,
  defense_stat INT NOT NULL DEFAULT 0,
  speed_stat INT NOT NULL DEFAULT 1,
  status ENUM('active', 'defeated', 'fled', 'spared', 'dead') NOT NULL DEFAULT 'active',
  resistances_json JSON NOT NULL,
  weaknesses_json JSON NOT NULL,
  state_json JSON NOT NULL,
  UNIQUE KEY uq_combat_participant (combat_encounter_id, participant_type, reference_id),
  CONSTRAINT fk_combat_participant_encounter FOREIGN KEY (combat_encounter_id) REFERENCES combat_encounters(id) ON DELETE CASCADE
);

CREATE TABLE equipment_states (
  character_inventory_id BIGINT UNSIGNED PRIMARY KEY,
  durability INT NOT NULL DEFAULT 100,
  max_durability INT NOT NULL DEFAULT 100,
  upgrade_level INT NOT NULL DEFAULT 0,
  bound_to_soul TINYINT(1) NOT NULL DEFAULT 0,
  bonuses_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_equipment_state_inventory FOREIGN KEY (character_inventory_id) REFERENCES character_inventory(id) ON DELETE CASCADE
);

CREATE TABLE character_achievements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  character_life_id BIGINT UNSIGNED NOT NULL,
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  achievement_key VARCHAR(160) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  evidence_json JSON NOT NULL,
  achieved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_character_achievement (character_life_id, achievement_key),
  CONSTRAINT fk_character_achievement_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE,
  CONSTRAINT fk_character_achievement_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE
);

CREATE TABLE skill_evolution_choices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  character_life_id BIGINT UNSIGNED NOT NULL,
  source_skill_id BIGINT UNSIGNED NOT NULL,
  option_skill_id BIGINT UNSIGNED NOT NULL,
  status ENUM('available', 'chosen', 'declined', 'expired') NOT NULL DEFAULT 'available',
  offered_reason_json JSON NOT NULL,
  offered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  chosen_at TIMESTAMP NULL,
  UNIQUE KEY uq_skill_evolution_option (character_life_id, source_skill_id, option_skill_id),
  CONSTRAINT fk_skill_evolution_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE,
  CONSTRAINT fk_skill_evolution_source FOREIGN KEY (source_skill_id) REFERENCES skills(id) ON DELETE CASCADE,
  CONSTRAINT fk_skill_evolution_option FOREIGN KEY (option_skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

CREATE TABLE character_family_mastery (
  character_life_id BIGINT UNSIGNED NOT NULL,
  skill_family_id BIGINT UNSIGNED NOT NULL,
  mastery_xp INT NOT NULL DEFAULT 0,
  mastery_level INT NOT NULL DEFAULT 0,
  skills_unlocked INT NOT NULL DEFAULT 0,
  ultimate_trial_unlocked TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (character_life_id, skill_family_id),
  CONSTRAINT fk_family_mastery_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE,
  CONSTRAINT fk_family_mastery_family FOREIGN KEY (skill_family_id) REFERENCES skill_families(id) ON DELETE CASCADE
);

CREATE TABLE ultimate_skill_trials (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  character_life_id BIGINT UNSIGNED NOT NULL,
  skill_id BIGINT UNSIGNED NOT NULL,
  trial_key VARCHAR(160) NOT NULL,
  status ENUM('locked', 'available', 'active', 'completed', 'failed') NOT NULL DEFAULT 'locked',
  progress INT NOT NULL DEFAULT 0,
  required_progress INT NOT NULL DEFAULT 1,
  conditions_json JSON NOT NULL,
  evidence_json JSON NOT NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  UNIQUE KEY uq_ultimate_trial (character_life_id, skill_id, trial_key),
  CONSTRAINT fk_ultimate_trial_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE,
  CONSTRAINT fk_ultimate_trial_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

ALTER TABLE skill_progress_events
  ADD COLUMN context_hash CHAR(64) NULL AFTER action_signature,
  ADD COLUMN eligible TINYINT(1) NOT NULL DEFAULT 1 AFTER progress_amount,
  ADD UNIQUE KEY uq_skill_progress_context (character_life_id, skill_id, context_hash);
