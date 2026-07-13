-- Automatic gameplay runtime for combat, progression, quests, floors, and complete runs.

ALTER TABLE story_progress
  ADD COLUMN total_turns INT NOT NULL DEFAULT 0 AFTER current_scene;

ALTER TABLE cycle_monster_states
  ADD COLUMN max_hp INT NOT NULL DEFAULT 1 AFTER current_hp,
  ADD COLUMN xp_reward INT NOT NULL DEFAULT 10 AFTER max_hp,
  ADD COLUMN gold_reward INT NOT NULL DEFAULT 5 AFTER xp_reward;

ALTER TABLE cycle_boss_states
  ADD COLUMN max_hp INT NULL AFTER current_hp;

UPDATE cycle_monster_states ms
JOIN world_monsters wm ON wm.id = ms.monster_id
SET ms.max_hp = GREATEST(ms.current_hp, 1),
    ms.xp_reward = 10 + (COALESCE(wm.habitat_dungeon_id, 1) * 8),
    ms.gold_reward = 5 + (COALESCE(wm.habitat_dungeon_id, 1) * 4);

CREATE TABLE floor_runtime_states (
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  floor_id BIGINT UNSIGNED NOT NULL,
  status ENUM('locked', 'active', 'cleared') NOT NULL DEFAULT 'locked',
  scene_count INT NOT NULL DEFAULT 0,
  objective_progress INT NOT NULL DEFAULT 0,
  objective_required INT NOT NULL DEFAULT 3,
  combat_required TINYINT(1) NOT NULL DEFAULT 0,
  combat_completed TINYINT(1) NOT NULL DEFAULT 0,
  story_decision_completed TINYINT(1) NOT NULL DEFAULT 0,
  entered_at TIMESTAMP NULL,
  cleared_at TIMESTAMP NULL,
  state_json JSON NOT NULL,
  PRIMARY KEY (story_cycle_id, floor_id),
  CONSTRAINT fk_floor_runtime_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_floor_runtime_floor FOREIGN KEY (floor_id) REFERENCES dungeon_floors(id) ON DELETE CASCADE
);

CREATE TABLE combat_encounters (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  character_life_id BIGINT UNSIGNED NOT NULL,
  floor_id BIGINT UNSIGNED NOT NULL,
  encounter_type ENUM('monster', 'boss', 'legacy_boss') NOT NULL,
  monster_state_id BIGINT UNSIGNED NULL,
  boss_profile_id BIGINT UNSIGNED NULL,
  legacy_hero_id BIGINT UNSIGNED NULL,
  status ENUM('active', 'victory', 'defeat', 'escaped', 'resolved_peacefully') NOT NULL DEFAULT 'active',
  round_number INT NOT NULL DEFAULT 1,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  state_json JSON NOT NULL,
  INDEX idx_combat_active (story_cycle_id, status, started_at),
  CONSTRAINT fk_combat_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_combat_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE,
  CONSTRAINT fk_combat_floor FOREIGN KEY (floor_id) REFERENCES dungeon_floors(id) ON DELETE CASCADE,
  CONSTRAINT fk_combat_monster_state FOREIGN KEY (monster_state_id) REFERENCES cycle_monster_states(id) ON DELETE SET NULL,
  CONSTRAINT fk_combat_boss FOREIGN KEY (boss_profile_id) REFERENCES boss_profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_combat_legacy FOREIGN KEY (legacy_hero_id) REFERENCES legacy_heroes(id) ON DELETE SET NULL
);

CREATE TABLE combat_action_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  combat_encounter_id BIGINT UNSIGNED NOT NULL,
  round_number INT NOT NULL,
  actor_type ENUM('player', 'monster', 'boss', 'companion') NOT NULL,
  actor_id BIGINT UNSIGNED NULL,
  action_type VARCHAR(80) NOT NULL,
  action_text TEXT NOT NULL,
  skill_id BIGINT UNSIGNED NULL,
  damage INT NOT NULL DEFAULT 0,
  healing INT NOT NULL DEFAULT 0,
  result_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_combat_action_encounter FOREIGN KEY (combat_encounter_id) REFERENCES combat_encounters(id) ON DELETE CASCADE,
  CONSTRAINT fk_combat_action_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE SET NULL
);

CREATE TABLE character_progression_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  character_life_id BIGINT UNSIGNED NOT NULL,
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  event_type ENUM('xp', 'level_up', 'gold', 'soul_energy', 'item', 'skill_progress', 'skill_unlock', 'floor_clear', 'realm_clear') NOT NULL,
  source_type VARCHAR(80) NOT NULL,
  source_id BIGINT UNSIGNED NULL,
  amount INT NOT NULL DEFAULT 0,
  summary VARCHAR(500) NOT NULL,
  payload_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_progression_life_created (character_life_id, created_at),
  CONSTRAINT fk_progression_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE,
  CONSTRAINT fk_progression_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE
);

CREATE TABLE game_engine_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  character_life_id BIGINT UNSIGNED NOT NULL,
  floor_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(100) NOT NULL,
  event_key VARCHAR(160) NOT NULL,
  event_payload_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_engine_events_cycle (story_cycle_id, created_at),
  CONSTRAINT fk_engine_events_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_engine_events_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE,
  CONSTRAINT fk_engine_events_floor FOREIGN KEY (floor_id) REFERENCES dungeon_floors(id) ON DELETE SET NULL
);

INSERT INTO quests (quest_key, name, description, giver_npc_id, dungeon_id, floor_id, objectives_json, rewards_json, consequence_rules_json)
SELECT 'cradlewood-mercy', 'What the Forest Refuses to Eat', 'Protect a wounded creature and learn why Cradlewood hunts new souls.', n.id, 1, 103, '{"actionSignatures":["protect","heal","spare"],"required":2}', '{"xp":60,"gold":20,"skillProgress":{"predator-instinct":2}}', '{"failureActions":["abandon","execute_wounded"]}' FROM world_npcs n WHERE n.name = 'Liora Thorn' LIMIT 1;

INSERT INTO quests (quest_key, name, description, giver_npc_id, dungeon_id, floor_id, objectives_json, rewards_json, consequence_rules_json)
SELECT 'glassweb-hatchlings', 'Children of the Molting Court', 'Keep marked hatchlings alive through the queen trial.', n.id, 2, 203, '{"actionSignatures":["protect","negotiate","spare"],"required":3}', '{"xp":90,"gold":35,"skillProgress":{"shadow-thread":2}}', '{"failureActions":["harm_hatchling"]}' FROM world_npcs n WHERE n.name = 'Kesh Araknine' LIMIT 1;

INSERT INTO quests (quest_key, name, description, giver_npc_id, dungeon_id, floor_id, objectives_json, rewards_json, consequence_rules_json)
SELECT 'mire-oath', 'The Oath That Chooses Its Knight', 'Resolve the Rot-Crown dispute without surrendering personal honor.', n.id, 3, 303, '{"actionSignatures":["negotiate","refuse_cruel_order","defend"],"required":3}', '{"xp":120,"gold":50,"skillProgress":{"absolute-focus":2}}', '{"failureActions":["betray_ally"]}' FROM world_npcs n WHERE n.name = 'Sir Brindle Crookhorn' LIMIT 1;

INSERT INTO quests (quest_key, name, description, giver_npc_id, dungeon_id, floor_id, objectives_json, rewards_json, consequence_rules_json)
SELECT 'ashbell-lesson', 'The Spell That Was Erased', 'Recover an erased lesson without feeding the Detention Furnace.', n.id, 4, 403, '{"actionSignatures":["analyze","study","solve"],"required":3}', '{"xp":150,"gold":60,"skillProgress":{"mana-core":2}}', '{"failureActions":["burn_knowledge"]}' FROM world_npcs n WHERE n.name = 'Professor Nym Vellum' LIMIT 1;

INSERT INTO quests (quest_key, name, description, giver_npc_id, dungeon_id, floor_id, objectives_json, rewards_json, consequence_rules_json)
SELECT 'seven-memories', 'Seven Memories and No Name', 'Return one memory to its rightful life without purchasing it.', n.id, 5, 503, '{"actionSignatures":["recover_memory","refuse_bargain","investigate"],"required":3}', '{"xp":180,"gold":75,"skillProgress":{"demon-eye":2}}', '{"failureActions":["sell_memory"]}' FROM world_npcs n WHERE n.name = 'Orin Nameless' LIMIT 1;

INSERT INTO quests (quest_key, name, description, giver_npc_id, dungeon_id, floor_id, objectives_json, rewards_json, consequence_rules_json)
SELECT 'first-free-note', 'The First Free Note', 'Help Lark-0 compose a command the orchard did not write.', n.id, 6, 603, '{"actionSignatures":["create","free","protect"],"required":3}', '{"xp":220,"gold":90,"skillProgress":{"arcane-creation":2}}', '{"failureActions":["enslave_machine"]}' FROM world_npcs n WHERE n.name = 'Unit Lark-0' LIMIT 1;

INSERT INTO quests (quest_key, name, description, giver_npc_id, dungeon_id, floor_id, objectives_json, rewards_json, consequence_rules_json)
SELECT 'broken-halo-law', 'A Law Worth Breaking', 'Prove that mercy can survive without divine permission.', n.id, 7, 703, '{"actionSignatures":["show_mercy","challenge_law","confess_truth"],"required":3}', '{"xp":260,"gold":110,"skillProgress":{"soul-chain":2}}', '{"failureActions":["condemn_innocent"]}' FROM world_npcs n WHERE n.name = 'Edda of the Broken Halo' LIMIT 1;

INSERT INTO quests (quest_key, name, description, giver_npc_id, dungeon_id, floor_id, objectives_json, rewards_json, consequence_rules_json)
SELECT 'dragon-against-prophecy', 'The Dragon Who Refused Tomorrow', 'Protect Kael from the prophecy hunters and let him choose his first act.', n.id, 8, 803, '{"actionSignatures":["protect_dragon","reject_prophecy","befriend"],"required":3}', '{"xp":320,"gold":140,"skillProgress":{"dragon-scales":2}}', '{"failureActions":["surrender_dragon"]}' FROM world_npcs n WHERE n.name = 'Kael Tideworn' LIMIT 1;

INSERT INTO quests (quest_key, name, description, giver_npc_id, dungeon_id, floor_id, objectives_json, rewards_json, consequence_rules_json)
SELECT 'uneditable-name', 'A Name Outside the Margins', 'Write Fia into a memory the Chronicle cannot revise.', n.id, 9, 903, '{"actionSignatures":["remember","reject_false_history","restore_name"],"required":3}', '{"xp":380,"gold":170,"skillProgress":{"soul-archive":2}}', '{"failureActions":["accept_false_ending"]}' FROM world_npcs n WHERE n.name = 'Fia Marginwalker' LIMIT 1;

INSERT INTO quests (quest_key, name, description, giver_npc_id, dungeon_id, floor_id, objectives_json, rewards_json, consequence_rules_json)
SELECT 'strongest-self', 'The Strength to Become Different', 'Reach the final throne by acting beyond the habits preserved by the Dungeon.', n.id, 10, 1003, '{"actionSignatures":["break_habit","accept_imperfect_self","protect_future"],"required":3}', '{"xp":500,"gold":250,"soulEnergy":100,"skillProgress":{"endless-will":3}}', '{"failureActions":["worship_past_power"]}' FROM world_npcs n WHERE n.name = 'Aster Vale, the Uncrowned' LIMIT 1;
