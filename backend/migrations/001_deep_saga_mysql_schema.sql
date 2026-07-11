-- Deep Saga MySQL schema.
-- Designed for the mysql2 Node driver.

CREATE TABLE accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE soul_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id BIGINT UNSIGNED NOT NULL,
  soul_name VARCHAR(120) NOT NULL,
  soul_level INT NOT NULL DEFAULT 1,
  total_deaths INT NOT NULL DEFAULT 0,
  total_completed_runs INT NOT NULL DEFAULT 0,
  remembered_knowledge_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  personality_drift_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_soul_profiles_account
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE story_cycles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  soul_profile_id BIGINT UNSIGNED NOT NULL,
  previous_guardian_id BIGINT UNSIGNED,
  cycle_number INT NOT NULL,
  status ENUM('opening_death', 'awake', 'in_progress', 'dead', 'completed') NOT NULL DEFAULT 'opening_death',
  opening_death_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  ending_summary TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  UNIQUE KEY uq_story_cycles_soul_cycle (soul_profile_id, cycle_number),
  CONSTRAINT fk_story_cycles_soul
    FOREIGN KEY (soul_profile_id) REFERENCES soul_profiles(id) ON DELETE CASCADE
);

CREATE TABLE dungeons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dungeon_number INT NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  theme VARCHAR(255) NOT NULL DEFAULT '',
  story_arc_json VARCHAR(4096) NOT NULL DEFAULT '{}'
);

CREATE TABLE dungeon_floors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dungeon_id BIGINT UNSIGNED NOT NULL,
  floor_number INT NOT NULL,
  floor_type ENUM('story', 'boss') NOT NULL,
  story_purpose VARCHAR(1000) NOT NULL DEFAULT '',
  boss_rules_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  UNIQUE KEY uq_dungeon_floors_dungeon_floor (dungeon_id, floor_number),
  CONSTRAINT chk_dungeon_floor_number CHECK (floor_number BETWEEN 1 AND 5),
  CONSTRAINT fk_dungeon_floors_dungeon
    FOREIGN KEY (dungeon_id) REFERENCES dungeons(id) ON DELETE CASCADE
);

CREATE TABLE character_lives (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  soul_profile_id BIGINT UNSIGNED NOT NULL,
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  life_number INT NOT NULL,
  avatar_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  origin_death_scene TEXT,
  status ENUM('alive', 'dead', 'completed', 'claimed_by_dungeon') NOT NULL DEFAULT 'alive',
  death_scene TEXT,
  completion_summary TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  UNIQUE KEY uq_character_lives_soul_life (soul_profile_id, life_number),
  CONSTRAINT fk_character_lives_soul
    FOREIGN KEY (soul_profile_id) REFERENCES soul_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_character_lives_cycle
    FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE
);

CREATE TABLE story_progress (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  story_cycle_id BIGINT UNSIGNED NOT NULL UNIQUE,
  current_dungeon_id BIGINT UNSIGNED,
  current_floor_id BIGINT UNSIGNED,
  story_state_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_story_progress_cycle
    FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_story_progress_dungeon
    FOREIGN KEY (current_dungeon_id) REFERENCES dungeons(id) ON DELETE SET NULL,
  CONSTRAINT fk_story_progress_floor
    FOREIGN KEY (current_floor_id) REFERENCES dungeon_floors(id) ON DELETE SET NULL
);

CREATE TABLE narrative_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  character_life_id BIGINT UNSIGNED,
  speaker ENUM('narrator', 'player', 'system') NOT NULL,
  message_text TEXT NOT NULL,
  choices_json VARCHAR(4096) NOT NULL DEFAULT '[]',
  parsed_intent_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  consequence_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_narrative_messages_cycle_created (story_cycle_id, created_at),
  CONSTRAINT fk_narrative_messages_cycle
    FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_narrative_messages_life
    FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE SET NULL
);

CREATE TABLE story_choices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  narrative_message_id BIGINT UNSIGNED NOT NULL,
  choice_text VARCHAR(1000) NOT NULL,
  choice_kind ENUM('suggested', 'typed') NOT NULL DEFAULT 'suggested',
  resolved TINYINT(1) NOT NULL DEFAULT 0,
  outcome_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_story_choices_message
    FOREIGN KEY (narrative_message_id) REFERENCES narrative_messages(id) ON DELETE CASCADE
);

CREATE TABLE player_behavior_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  character_life_id BIGINT UNSIGNED NOT NULL UNIQUE,
  favorite_weapons_json VARCHAR(4096) NOT NULL DEFAULT '[]',
  preferred_skills_json VARCHAR(4096) NOT NULL DEFAULT '[]',
  combat_rhythm_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  decision_style_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  personality_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  strengths_json VARCHAR(4096) NOT NULL DEFAULT '[]',
  weaknesses_json VARCHAR(4096) NOT NULL DEFAULT '[]',
  recklessness_score DECIMAL(6,2) NOT NULL DEFAULT 0,
  caution_score DECIMAL(6,2) NOT NULL DEFAULT 0,
  mercy_score DECIMAL(6,2) NOT NULL DEFAULT 0,
  cruelty_score DECIMAL(6,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_behavior_profiles_life
    FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE
);

CREATE TABLE eternal_guardians (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_character_life_id BIGINT UNSIGNED NOT NULL UNIQUE,
  guardian_name VARCHAR(120) NOT NULL,
  guardian_title VARCHAR(120) NOT NULL DEFAULT 'Eternal Guardian',
  boss_profile_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  opening_line VARCHAR(1000) NOT NULL DEFAULT '',
  combat_script_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_eternal_guardians_active (active, created_at),
  CONSTRAINT fk_eternal_guardians_life
    FOREIGN KEY (source_character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE
);

ALTER TABLE story_cycles
  ADD CONSTRAINT fk_story_cycles_guardian
    FOREIGN KEY (previous_guardian_id) REFERENCES eternal_guardians(id) ON DELETE SET NULL;

CREATE TABLE dungeon_memory_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  soul_profile_id BIGINT UNSIGNED,
  story_cycle_id BIGINT UNSIGNED,
  character_life_id BIGINT UNSIGNED,
  event_type VARCHAR(80) NOT NULL,
  event_text TEXT NOT NULL,
  importance INT NOT NULL DEFAULT 1,
  memory_payload_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dungeon_memory_soul_created (soul_profile_id, created_at),
  CONSTRAINT fk_dungeon_memory_soul
    FOREIGN KEY (soul_profile_id) REFERENCES soul_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_dungeon_memory_cycle
    FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_dungeon_memory_life
    FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE SET NULL
);

CREATE TABLE dungeon_adaptations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  soul_profile_id BIGINT UNSIGNED NOT NULL,
  strategy_signature VARCHAR(255) NOT NULL,
  countermeasure_text VARCHAR(1000) NOT NULL,
  affected_enemy_rules_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  intensity INT NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dungeon_adaptations_soul_active (soul_profile_id, active),
  CONSTRAINT fk_dungeon_adaptations_soul
    FOREIGN KEY (soul_profile_id) REFERENCES soul_profiles(id) ON DELETE CASCADE
);
