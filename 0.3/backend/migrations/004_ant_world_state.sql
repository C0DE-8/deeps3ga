CREATE TABLE IF NOT EXISTS deep_saga_traits (
  trait_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  trait_key VARCHAR(100) NOT NULL,
  name VARCHAR(140) NOT NULL,
  description TEXT NOT NULL,
  reason TEXT NOT NULL,
  discovered_at_turn INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_trait_run_key (run_id, trait_key),
  CONSTRAINT fk_traits_run FOREIGN KEY (run_id) REFERENCES deep_saga_runs(run_id)
);

CREATE TABLE IF NOT EXISTS deep_saga_abilities (
  ability_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  ability_key VARCHAR(100) NOT NULL,
  name VARCHAR(140) NOT NULL,
  description TEXT NOT NULL,
  reason TEXT NOT NULL,
  power_tier INT NOT NULL DEFAULT 1,
  visible TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ability_run_key (run_id, ability_key),
  CONSTRAINT fk_abilities_run FOREIGN KEY (run_id) REFERENCES deep_saga_runs(run_id)
);

CREATE TABLE IF NOT EXISTS deep_saga_resources (
  resource_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  resource_key VARCHAR(100) NOT NULL,
  name VARCHAR(140) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  storage_type VARCHAR(80) NOT NULL DEFAULT 'carried',
  notes TEXT NULL,
  UNIQUE KEY uniq_resource_run_key (run_id, resource_key),
  CONSTRAINT fk_resources_run FOREIGN KEY (run_id) REFERENCES deep_saga_runs(run_id)
);

CREATE TABLE IF NOT EXISTS deep_saga_npcs (
  npc_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  book_id BIGINT NOT NULL,
  npc_key VARCHAR(100) NOT NULL,
  name VARCHAR(140) NOT NULL,
  species VARCHAR(80) NOT NULL,
  role VARCHAR(120) NOT NULL,
  faction VARCHAR(140) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'alive',
  traits_json JSON NOT NULL,
  known_facts_json JSON NOT NULL,
  UNIQUE KEY uniq_npc_book_key (book_id, npc_key),
  CONSTRAINT fk_npcs_book FOREIGN KEY (book_id) REFERENCES deep_saga_books(book_id)
);

CREATE TABLE IF NOT EXISTS deep_saga_relationships (
  relationship_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  target_type VARCHAR(40) NOT NULL,
  target_key VARCHAR(100) NOT NULL,
  display_name VARCHAR(140) NOT NULL,
  trust INT NOT NULL DEFAULT 0,
  fear INT NOT NULL DEFAULT 0,
  respect INT NOT NULL DEFAULT 0,
  loyalty INT NOT NULL DEFAULT 0,
  hostility INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_relationship_run_target (run_id, target_type, target_key),
  CONSTRAINT fk_relationships_run FOREIGN KEY (run_id) REFERENCES deep_saga_runs(run_id)
);

CREATE TABLE IF NOT EXISTS deep_saga_discoveries (
  discovery_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  discovery_key VARCHAR(120) NOT NULL,
  title VARCHAR(180) NOT NULL,
  content TEXT NOT NULL,
  chapter_number INT NOT NULL,
  visibility VARCHAR(40) NOT NULL DEFAULT 'player',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_discovery_run_key (run_id, discovery_key),
  CONSTRAINT fk_discoveries_run FOREIGN KEY (run_id) REFERENCES deep_saga_runs(run_id)
);

CREATE TABLE IF NOT EXISTS deep_saga_canonical_facts (
  fact_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  fact_key VARCHAR(120) NOT NULL,
  content TEXT NOT NULL,
  chapter_number INT NOT NULL,
  created_turn INT NOT NULL,
  tags_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_fact_run_key (run_id, fact_key),
  CONSTRAINT fk_facts_run FOREIGN KEY (run_id) REFERENCES deep_saga_runs(run_id)
);

CREATE TABLE IF NOT EXISTS deep_saga_story_memories (
  memory_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  content TEXT NOT NULL,
  importance INT NOT NULL DEFAULT 5,
  tags_json JSON NOT NULL,
  created_turn INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_memories_run_importance (run_id, importance),
  CONSTRAINT fk_memories_run FOREIGN KEY (run_id) REFERENCES deep_saga_runs(run_id)
);

CREATE TABLE IF NOT EXISTS deep_saga_open_threads (
  thread_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  thread_key VARCHAR(120) NOT NULL,
  title VARCHAR(180) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'open',
  content TEXT NOT NULL,
  chapter_number INT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_thread_run_key (run_id, thread_key),
  CONSTRAINT fk_threads_run FOREIGN KEY (run_id) REFERENCES deep_saga_runs(run_id)
);

CREATE TABLE IF NOT EXISTS deep_saga_world_state (
  state_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  state_key VARCHAR(120) NOT NULL,
  value_json JSON NOT NULL,
  visibility VARCHAR(40) NOT NULL DEFAULT 'engine',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_world_state_run_key (run_id, state_key),
  CONSTRAINT fk_world_state_run FOREIGN KEY (run_id) REFERENCES deep_saga_runs(run_id)
);

CREATE TABLE IF NOT EXISTS deep_saga_story_messages (
  message_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  role VARCHAR(24) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  turn_number INT NOT NULL,
  metadata_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_messages_run_turn (run_id, turn_number),
  CONSTRAINT fk_messages_run FOREIGN KEY (run_id) REFERENCES deep_saga_runs(run_id)
);

CREATE TABLE IF NOT EXISTS deep_saga_story_events (
  event_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  event_key VARCHAR(120) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  title VARCHAR(180) NOT NULL,
  content TEXT NOT NULL,
  chapter_number INT NOT NULL,
  turn_number INT NOT NULL,
  metadata_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_event_run_key (run_id, event_key),
  CONSTRAINT fk_events_run FOREIGN KEY (run_id) REFERENCES deep_saga_runs(run_id)
);

INSERT INTO deep_saga_npcs (book_id, npc_key, name, species, role, faction, status, traits_json, known_facts_json)
SELECT book_id, 'queen-elysra', 'Queen Elysra', 'Ant', 'Queen of the central colony', 'Ant Empire', 'alive',
  JSON_ARRAY('ancient', 'politically careful', 'sensitive to soul resonance'),
  JSON_ARRAY('She remembers fragments of the Ant King''s era but hides more than she says.')
FROM deep_saga_books WHERE slug = 'ant-world'
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  species = VALUES(species),
  role = VALUES(role),
  faction = VALUES(faction),
  status = VALUES(status),
  traits_json = VALUES(traits_json),
  known_facts_json = VALUES(known_facts_json);
