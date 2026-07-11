-- Deep Saga story design support.
-- Adds persistence for floor purpose, companions, boss identity, quiet chapters, and completed-run legends.

ALTER TABLE dungeon_floors
  ADD COLUMN purpose_type ENUM('introduction', 'puzzle', 'mystery', 'npc_decision', 'moral_decision', 'mini_boss', 'intense_challenge', 'boss', 'quiet') NOT NULL DEFAULT 'introduction' AFTER floor_type,
  ADD COLUMN quiet_chapter_allowed TINYINT(1) NOT NULL DEFAULT 0 AFTER story_purpose,
  ADD COLUMN floor_memory_json TEXT NOT NULL DEFAULT '{}' AFTER quiet_chapter_allowed;

CREATE TABLE companions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  character_life_id BIGINT UNSIGNED,
  name VARCHAR(120) NOT NULL,
  role_name VARCHAR(120) NOT NULL DEFAULT '',
  personality_json TEXT NOT NULL DEFAULT '{}',
  secrets_json TEXT NOT NULL DEFAULT '[]',
  relationship_state_json TEXT NOT NULL DEFAULT '{}',
  advice_style VARCHAR(255) NOT NULL DEFAULT '',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_companions_cycle_active (story_cycle_id, active),
  CONSTRAINT fk_companions_cycle
    FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_companions_life
    FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE SET NULL
);

CREATE TABLE companion_memories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  companion_id BIGINT UNSIGNED NOT NULL,
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  memory_type VARCHAR(80) NOT NULL,
  memory_text TEXT NOT NULL,
  sentiment INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_companion_memories_companion_created (companion_id, created_at),
  CONSTRAINT fk_companion_memories_companion
    FOREIGN KEY (companion_id) REFERENCES companions(id) ON DELETE CASCADE,
  CONSTRAINT fk_companion_memories_cycle
    FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE
);

CREATE TABLE boss_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dungeon_floor_id BIGINT UNSIGNED NOT NULL UNIQUE,
  boss_name VARCHAR(120) NOT NULL,
  reason_for_existing TEXT NOT NULL,
  personality_json TEXT NOT NULL DEFAULT '{}',
  entrance_text TEXT,
  defeat_text TEXT,
  dialogue_json TEXT NOT NULL DEFAULT '[]',
  mechanics_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_boss_profiles_floor
    FOREIGN KEY (dungeon_floor_id) REFERENCES dungeon_floors(id) ON DELETE CASCADE
);

CREATE TABLE quiet_chapters (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  dungeon_floor_id BIGINT UNSIGNED,
  chapter_type ENUM('campfire', 'traveler', 'library', 'diary', 'reflection', 'rest') NOT NULL,
  chapter_title VARCHAR(160) NOT NULL,
  chapter_text TEXT NOT NULL,
  discovered_lore_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_quiet_chapters_cycle
    FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_quiet_chapters_floor
    FOREIGN KEY (dungeon_floor_id) REFERENCES dungeon_floors(id) ON DELETE SET NULL
);

CREATE TABLE run_legends (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  story_cycle_id BIGINT UNSIGNED NOT NULL UNIQUE,
  character_life_id BIGINT UNSIGNED NOT NULL,
  legend_name VARCHAR(160) NOT NULL,
  completed_dungeons INT NOT NULL DEFAULT 0,
  bosses_defeated INT NOT NULL DEFAULT 0,
  companions_lost INT NOT NULL DEFAULT 0,
  villages_saved INT NOT NULL DEFAULT 0,
  times_reincarnated INT NOT NULL DEFAULT 0,
  signature_skill VARCHAR(120) NOT NULL DEFAULT '',
  final_title VARCHAR(120) NOT NULL DEFAULT '',
  legend_summary TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_run_legends_cycle
    FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_run_legends_life
    FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE
);

CREATE TABLE response_sections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  narrative_message_id BIGINT UNSIGNED NOT NULL,
  story_text TEXT NOT NULL,
  character_changes_json TEXT NOT NULL DEFAULT '[]',
  new_items_or_skills_json TEXT NOT NULL DEFAULT '[]',
  choices_json TEXT NOT NULL DEFAULT '[]',
  hidden_stats_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_response_sections_message
    FOREIGN KEY (narrative_message_id) REFERENCES narrative_messages(id) ON DELETE CASCADE
);
