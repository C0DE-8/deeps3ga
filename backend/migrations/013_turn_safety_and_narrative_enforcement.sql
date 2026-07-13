CREATE TABLE IF NOT EXISTS engine_turn_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  character_life_id BIGINT UNSIGNED NOT NULL,
  request_key CHAR(36) NOT NULL,
  action_hash CHAR(64) NOT NULL,
  status ENUM('processing', 'completed', 'failed') NOT NULL DEFAULT 'processing',
  resolution_json JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  UNIQUE KEY uq_engine_turn_cycle_request (story_cycle_id, request_key),
  CONSTRAINT fk_engine_turn_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_engine_turn_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE
);

ALTER TABLE narrative_messages ADD COLUMN IF NOT EXISTS request_key CHAR(36) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_narrative_cycle_request_speaker ON narrative_messages (story_cycle_id, request_key, speaker);

CREATE TABLE IF NOT EXISTS narrative_validation_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  request_key CHAR(36) NOT NULL,
  violations_json JSON NOT NULL,
  original_sections_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_narrative_validation_cycle (story_cycle_id, created_at),
  CONSTRAINT fk_narrative_validation_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE
);
