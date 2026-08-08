CREATE TABLE IF NOT EXISTS deep_saga_users (
  user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(24) NOT NULL UNIQUE,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS deep_saga_books (
  book_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  slug VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  book_number INT NOT NULL,
  world VARCHAR(120) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  genre_json JSON NOT NULL,
  description TEXT NOT NULL,
  version VARCHAR(32) NOT NULL,
  cover_config_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deep_saga_story_guides (
  guide_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  book_id BIGINT NOT NULL,
  guide_version VARCHAR(32) NOT NULL,
  canon_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_story_guide_book_version (book_id, guide_version),
  CONSTRAINT fk_story_guides_book FOREIGN KEY (book_id) REFERENCES deep_saga_books(book_id)
);

CREATE TABLE IF NOT EXISTS deep_saga_chapters (
  chapter_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  book_id BIGINT NOT NULL,
  chapter_number INT NOT NULL,
  slug VARCHAR(120) NOT NULL,
  title VARCHAR(180) NOT NULL,
  purpose TEXT NOT NULL,
  required_canon_json JSON NOT NULL,
  major_revelations_json JSON NOT NULL,
  possible_developments_json JSON NOT NULL,
  end_conditions_json JSON NOT NULL,
  blocked_revelations_json JSON NOT NULL,
  scene_guidance_json JSON NOT NULL,
  UNIQUE KEY uniq_chapter_book_number (book_id, chapter_number),
  CONSTRAINT fk_chapters_book FOREIGN KEY (book_id) REFERENCES deep_saga_books(book_id)
);

CREATE TABLE IF NOT EXISTS deep_saga_runs (
  run_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  book_id BIGINT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  current_chapter INT NOT NULL DEFAULT 1,
  current_scene VARCHAR(120) NOT NULL DEFAULT 'awakening',
  story_beat VARCHAR(120) NOT NULL DEFAULT 'death_memory',
  chapter_flags_json JSON NOT NULL,
  turn_version INT NOT NULL DEFAULT 0,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_played_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  death_at TIMESTAMP NULL,
  death_reason TEXT NULL,
  death_location VARCHAR(180) NULL,
  ending_key VARCHAR(80) NULL,
  ending_title VARCHAR(180) NULL,
  ending_summary TEXT NULL,
  CONSTRAINT fk_runs_user FOREIGN KEY (user_id) REFERENCES deep_saga_users(user_id),
  CONSTRAINT fk_runs_book FOREIGN KEY (book_id) REFERENCES deep_saga_books(book_id),
  INDEX idx_runs_user_book_status (user_id, book_id, status)
);

CREATE TABLE IF NOT EXISTS deep_saga_character_states (
  run_id BIGINT PRIMARY KEY,
  species VARCHAR(80) NOT NULL,
  life_stage VARCHAR(80) NOT NULL,
  level INT NOT NULL,
  experience INT NOT NULL DEFAULT 0,
  experience_to_next INT NOT NULL DEFAULT 100,
  health_current INT NOT NULL,
  health_max INT NOT NULL,
  mana_current INT NOT NULL,
  mana_max INT NOT NULL,
  mana_known TINYINT NOT NULL DEFAULT 0,
  condition_text VARCHAR(255) NOT NULL,
  evolution_state_json JSON NOT NULL,
  location VARCHAR(180) NOT NULL,
  territory VARCHAR(180) NOT NULL,
  human_memories_retained TINYINT NOT NULL DEFAULT 1,
  physical_development INT NOT NULL DEFAULT 0,
  combat_development INT NOT NULL DEFAULT 0,
  magic_development INT NOT NULL DEFAULT 0,
  analysis_development INT NOT NULL DEFAULT 0,
  leadership_development INT NOT NULL DEFAULT 0,
  support_development INT NOT NULL DEFAULT 0,
  survival_development INT NOT NULL DEFAULT 0,
  scouting_development INT NOT NULL DEFAULT 0,
  predator_development INT NOT NULL DEFAULT 0,
  soul_development INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_character_run FOREIGN KEY (run_id) REFERENCES deep_saga_runs(run_id)
);

CREATE TABLE IF NOT EXISTS deep_saga_action_requests (
  request_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  client_action_id VARCHAR(120) NOT NULL,
  action_text TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'processing',
  run_version_before INT NOT NULL,
  response_json JSON NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  UNIQUE KEY uniq_action_request (run_id, client_action_id),
  CONSTRAINT fk_action_requests_run FOREIGN KEY (run_id) REFERENCES deep_saga_runs(run_id)
);
