ALTER TABLE quests ADD COLUMN IF NOT EXISTS overlap_json JSON NULL;

UPDATE quests q
LEFT JOIN dungeon_floors df ON df.id = q.floor_id
LEFT JOIN dungeons d ON d.id = q.dungeon_id
LEFT JOIN world_npcs n ON n.id = q.giver_npc_id
SET q.overlap_json = JSON_OBJECT(
  'destinationKey', CONCAT('FLOOR_', COALESCE(q.floor_id, 0)),
  'destinationName', COALESCE(df.floor_name, d.name, 'Unknown'),
  'dungeonKey', CONCAT('REALM_', COALESCE(q.dungeon_id, 0)),
  'npcNames', IF(n.name IS NULL, JSON_ARRAY(), JSON_ARRAY(n.name)),
  'enemyNames', COALESCE(df.enemies_available_json, JSON_ARRAY()),
  'hazards', IF(df.atmosphere IS NULL, JSON_ARRAY(), JSON_ARRAY(df.atmosphere))
)
WHERE q.overlap_json IS NULL;

CREATE TABLE IF NOT EXISTS story_threads (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  thread_key VARCHAR(140) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  requirements_json JSON NOT NULL,
  related_npc_ids_json JSON NOT NULL,
  related_location_ids_json JSON NOT NULL,
  related_quest_ids_json JSON NOT NULL,
  connection_keys_json JSON NOT NULL,
  priority ENUM('minor', 'standard', 'major', 'critical') NOT NULL DEFAULT 'standard',
  completion_rules_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cycle_story_threads (
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  story_thread_id BIGINT UNSIGNED NOT NULL,
  status ENUM('DISCOVERED', 'ACTIVE', 'WAITING_FOR_REQUIREMENT', 'READY', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'DISCOVERED',
  introduced_at_turn INT NOT NULL DEFAULT 0,
  progress_json JSON NOT NULL,
  resolved_at TIMESTAMP NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (story_cycle_id, story_thread_id),
  CONSTRAINT fk_cycle_threads_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_cycle_threads_thread FOREIGN KEY (story_thread_id) REFERENCES story_threads(id) ON DELETE CASCADE
);

INSERT IGNORE INTO story_threads
  (thread_key, title, description, requirements_json, related_npc_ids_json, related_location_ids_json, related_quest_ids_json, connection_keys_json, priority, completion_rules_json)
SELECT CONCAT('QUEST_', UPPER(REPLACE(q.quest_key, '-', '_'))),
       q.name,
       q.description,
       JSON_OBJECT('questStatus', 'completed'),
       IF(q.giver_npc_id IS NULL, JSON_ARRAY(), JSON_ARRAY(q.giver_npc_id)),
       IF(q.floor_id IS NULL, JSON_ARRAY(), JSON_ARRAY(q.floor_id)),
       JSON_ARRAY(q.id),
       COALESCE(q.overlap_json, JSON_OBJECT()),
       IF(q.dungeon_id IN (1, 10), 'major', 'standard'),
       JSON_OBJECT('relatedQuestIds', JSON_ARRAY(q.id), 'requiredCompleted', 1)
FROM quests q;

-- Realm 1's wounded-creature quests intentionally overlap into one connected thread.
INSERT IGNORE INTO story_threads
  (thread_key, title, description, requirements_json, related_npc_ids_json, related_location_ids_json, related_quest_ids_json, connection_keys_json, priority, completion_rules_json)
SELECT 'CRADLEWOOD_WOUNDED_TRUTH',
       'What Hunts the Wounded',
       'The wounded creatures, Fenroot medicine, and Cradlewood attacks are parts of the same mystery.',
       JSON_OBJECT('minimumRelatedQuestProgress', 2),
       JSON_ARRAY((SELECT id FROM world_npcs WHERE name = 'Liora Thorn' LIMIT 1), (SELECT id FROM world_npcs WHERE name = 'Mara Fenroot' LIMIT 1)),
       JSON_ARRAY(103),
       JSON_ARRAY((SELECT id FROM quests WHERE quest_key = 'cradlewood-mercy' LIMIT 1), (SELECT id FROM quests WHERE quest_key = 'fenroot-remedy' LIMIT 1)),
       JSON_OBJECT('destinationKey', 'FLOOR_103', 'themes', JSON_ARRAY('wounded creatures', 'medicine', 'forest hunger')),
       'major',
       JSON_OBJECT('questKeys', JSON_ARRAY('cradlewood-mercy', 'fenroot-remedy'), 'requiredCompleted', 2);

CREATE TABLE IF NOT EXISTS factions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  faction_key VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  dungeon_id BIGINT UNSIGNED,
  CONSTRAINT fk_factions_dungeon FOREIGN KEY (dungeon_id) REFERENCES dungeons(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cycle_faction_reputation (
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  faction_id BIGINT UNSIGNED NOT NULL,
  reputation INT NOT NULL DEFAULT 0,
  standing ENUM('hated', 'hostile', 'wary', 'neutral', 'trusted', 'honored') NOT NULL DEFAULT 'neutral',
  reasons_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (story_cycle_id, faction_id),
  CONSTRAINT fk_reputation_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_reputation_faction FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE CASCADE
);

INSERT IGNORE INTO factions (faction_key, name, description, dungeon_id)
SELECT CONCAT('REALM_', dungeon_number), CONCAT(name, ' Denizens'), CONCAT('People and powers tied to ', name, '.'), id FROM dungeons;

ALTER TABLE response_sections ADD COLUMN IF NOT EXISTS scene_type VARCHAR(40) NULL;
ALTER TABLE response_sections ADD COLUMN IF NOT EXISTS narrative_sections_json JSON NULL;
ALTER TABLE response_sections ADD COLUMN IF NOT EXISTS status_summary_json JSON NULL;
ALTER TABLE response_sections ADD COLUMN IF NOT EXISTS story_opportunities_json JSON NULL;
ALTER TABLE response_sections ADD COLUMN IF NOT EXISTS npc_introductions_json JSON NULL;
