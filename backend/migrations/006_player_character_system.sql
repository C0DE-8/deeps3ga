-- Set 1: player, immortal soul, reincarnated body, progression, and condition state.

ALTER TABLE soul_profiles
  ADD COLUMN soul_energy BIGINT NOT NULL DEFAULT 0 AFTER soul_level;

ALTER TABLE character_sheets
  ADD COLUMN species_name VARCHAR(80) NOT NULL DEFAULT '' AFTER character_name,
  ADD COLUMN xp_needed BIGINT NOT NULL DEFAULT 100 AFTER xp,
  ADD COLUMN health_condition VARCHAR(80) NOT NULL DEFAULT 'Healthy' AFTER max_stamina,
  ADD COLUMN strength INT NOT NULL DEFAULT 5 AFTER health_condition,
  ADD COLUMN agility INT NOT NULL DEFAULT 5 AFTER strength,
  ADD COLUMN defense INT NOT NULL DEFAULT 5 AFTER agility,
  ADD COLUMN thaumaturgy INT NOT NULL DEFAULT 5 AFTER defense,
  ADD COLUMN resolve_stat INT NOT NULL DEFAULT 5 AFTER thaumaturgy,
  ADD COLUMN intelligence INT NOT NULL DEFAULT 5 AFTER resolve_stat,
  ADD COLUMN luck INT NOT NULL DEFAULT 5 AFTER intelligence,
  ADD COLUMN charisma INT NOT NULL DEFAULT 5 AFTER luck,
  ADD COLUMN gold BIGINT NOT NULL DEFAULT 0 AFTER charisma,
  ADD COLUMN traits_json TEXT NOT NULL DEFAULT '[]' AFTER stats_json;

ALTER TABLE character_skills
  ADD COLUMN skill_xp BIGINT NOT NULL DEFAULT 0 AFTER skill_level,
  ADD COLUMN xp_needed BIGINT NOT NULL DEFAULT 100 AFTER skill_xp,
  ADD COLUMN unlocked TINYINT(1) NOT NULL DEFAULT 1 AFTER xp_needed,
  ADD COLUMN last_used_at TIMESTAMP NULL AFTER times_used;

ALTER TABLE story_progress
  ADD COLUMN current_chapter INT NOT NULL DEFAULT 1 AFTER current_floor_id,
  ADD COLUMN current_scene VARCHAR(120) NOT NULL DEFAULT 'last-breath' AFTER current_chapter;

CREATE TABLE status_effects (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  status_key VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  category ENUM('harmful', 'beneficial', 'neutral') NOT NULL,
  description TEXT NOT NULL,
  default_duration_turns INT NULL,
  effects_json JSON NOT NULL
);

CREATE TABLE character_status_effects (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  character_life_id BIGINT UNSIGNED NOT NULL,
  status_effect_id BIGINT UNSIGNED NOT NULL,
  source_type VARCHAR(80) NOT NULL DEFAULT '',
  source_id BIGINT UNSIGNED NULL,
  intensity INT NOT NULL DEFAULT 1,
  remaining_turns INT NULL,
  state_json JSON NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMP NULL,
  INDEX idx_character_status_active (character_life_id, removed_at),
  CONSTRAINT fk_character_status_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE,
  CONSTRAINT fk_character_status_effect FOREIGN KEY (status_effect_id) REFERENCES status_effects(id) ON DELETE RESTRICT
);

CREATE TABLE character_traits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  character_life_id BIGINT UNSIGNED NOT NULL,
  trait_key VARCHAR(100) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  source_type VARCHAR(80) NOT NULL DEFAULT 'avatar',
  effects_json JSON NOT NULL,
  gained_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_character_trait (character_life_id, trait_key),
  CONSTRAINT fk_character_traits_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE
);

CREATE TABLE character_injuries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  character_life_id BIGINT UNSIGNED NOT NULL,
  injury_key VARCHAR(100) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  body_location VARCHAR(100) NOT NULL DEFAULT '',
  severity ENUM('minor', 'major', 'critical', 'permanent') NOT NULL,
  effects_json JSON NOT NULL,
  healed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_character_injuries_active (character_life_id, healed_at),
  CONSTRAINT fk_character_injuries_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE
);

INSERT INTO status_effects (status_key, name, category, description, default_duration_turns, effects_json) VALUES
('poisoned', 'Poisoned', 'harmful', 'Poison moves through the body and causes damage over time.', 5, '{"damageOverTime":true}'),
('bleeding', 'Bleeding', 'harmful', 'An open wound continues to drain health until treated.', 4, '{"damageOverTime":true,"healingReduced":true}'),
('frozen', 'Frozen', 'harmful', 'Ice restricts movement and makes the body brittle.', 2, '{"agilityPenalty":true}'),
('sleeping', 'Sleeping', 'neutral', 'The character cannot act until awakened or disturbed.', NULL, '{"cannotAct":true}'),
('blessed', 'Blessed', 'beneficial', 'A supernatural blessing strengthens the character temporarily.', 6, '{"resolveBonus":true}'),
('burning', 'Burning', 'harmful', 'Fire causes immediate and continuing damage.', 3, '{"damageOverTime":true,"revealsInvisible":true}'),
('invisible', 'Invisible', 'beneficial', 'The character is hidden from ordinary sight.', 4, '{"hidden":true}'),
('confused', 'Confused', 'harmful', 'The character struggles to understand targets and direction.', 3, '{"actionUncertainty":true}');

CREATE OR REPLACE VIEW soul_life_history AS
SELECT
  sp.id AS soul_id,
  sp.account_id,
  sp.soul_name,
  sp.soul_level,
  sp.soul_energy,
  cl.life_number,
  cl.id AS character_id,
  cs.character_name,
  cs.species_name,
  cs.race_name,
  cs.class_name,
  cs.level,
  cl.status,
  cl.death_scene,
  cl.completion_summary,
  cl.created_at AS life_started_at,
  cl.ended_at AS life_ended_at
FROM soul_profiles sp
JOIN character_lives cl ON cl.soul_profile_id = sp.id
LEFT JOIN character_sheets cs ON cs.character_life_id = cl.id;
