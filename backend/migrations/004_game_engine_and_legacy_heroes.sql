-- Playable state, catalogs, quests, memory, and immutable completed-run heroes.

CREATE TABLE character_sheets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  character_life_id BIGINT UNSIGNED NOT NULL UNIQUE,
  character_name VARCHAR(120) NOT NULL,
  race_name VARCHAR(80) NOT NULL,
  class_name VARCHAR(80) NOT NULL,
  gender_name VARCHAR(40) NOT NULL DEFAULT '',
  appearance_json JSON NOT NULL,
  personality_json JSON NOT NULL,
  titles_json JSON NOT NULL,
  level INT NOT NULL DEFAULT 1,
  xp BIGINT NOT NULL DEFAULT 0,
  hp INT NOT NULL DEFAULT 100,
  max_hp INT NOT NULL DEFAULT 100,
  mana INT NOT NULL DEFAULT 30,
  max_mana INT NOT NULL DEFAULT 30,
  stamina INT NOT NULL DEFAULT 50,
  max_stamina INT NOT NULL DEFAULT 50,
  stats_json JSON NOT NULL,
  blessings_json JSON NOT NULL,
  curses_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_character_sheets_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE
);

CREATE TABLE skills (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  skill_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  skill_type ENUM('active', 'passive', 'reaction', 'ultimate') NOT NULL,
  description TEXT NOT NULL,
  effects_json JSON NOT NULL,
  requirements_json JSON NOT NULL
);

CREATE TABLE character_skills (
  character_life_id BIGINT UNSIGNED NOT NULL,
  skill_id BIGINT UNSIGNED NOT NULL,
  skill_level INT NOT NULL DEFAULT 1,
  times_used INT NOT NULL DEFAULT 0,
  equipped TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (character_life_id, skill_id),
  CONSTRAINT fk_character_skills_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE,
  CONSTRAINT fk_character_skills_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

CREATE TABLE items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  item_type ENUM('weapon', 'armor', 'accessory', 'consumable', 'quest', 'relic', 'material') NOT NULL,
  description TEXT NOT NULL,
  rarity ENUM('common', 'uncommon', 'rare', 'epic', 'legendary', 'cursed') NOT NULL DEFAULT 'common',
  effects_json JSON NOT NULL,
  lore_json JSON NOT NULL
);

CREATE TABLE character_inventory (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  character_life_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  equipped_slot VARCHAR(40),
  item_state_json JSON NOT NULL,
  UNIQUE KEY uq_inventory_life_item_slot (character_life_id, item_id, equipped_slot),
  CONSTRAINT fk_inventory_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT
);

CREATE TABLE quests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quest_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  giver_npc_id BIGINT UNSIGNED,
  dungeon_id BIGINT UNSIGNED,
  floor_id BIGINT UNSIGNED,
  objectives_json JSON NOT NULL,
  rewards_json JSON NOT NULL,
  consequence_rules_json JSON NOT NULL,
  CONSTRAINT fk_quests_npc FOREIGN KEY (giver_npc_id) REFERENCES world_npcs(id) ON DELETE SET NULL,
  CONSTRAINT fk_quests_dungeon FOREIGN KEY (dungeon_id) REFERENCES dungeons(id) ON DELETE SET NULL,
  CONSTRAINT fk_quests_floor FOREIGN KEY (floor_id) REFERENCES dungeon_floors(id) ON DELETE SET NULL
);

CREATE TABLE cycle_quests (
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  quest_id BIGINT UNSIGNED NOT NULL,
  status ENUM('available', 'active', 'completed', 'failed', 'abandoned') NOT NULL DEFAULT 'available',
  progress_json JSON NOT NULL,
  choices_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (story_cycle_id, quest_id),
  CONSTRAINT fk_cycle_quests_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_cycle_quests_quest FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE
);

CREATE TABLE cycle_dungeon_progress (
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  dungeon_id BIGINT UNSIGNED NOT NULL,
  highest_floor INT NOT NULL DEFAULT 1,
  boss_defeated TINYINT(1) NOT NULL DEFAULT 0,
  completed_at TIMESTAMP NULL,
  PRIMARY KEY (story_cycle_id, dungeon_id),
  CONSTRAINT chk_cycle_highest_floor CHECK (highest_floor BETWEEN 1 AND 5),
  CONSTRAINT fk_cycle_dungeon_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_cycle_dungeon_dungeon FOREIGN KEY (dungeon_id) REFERENCES dungeons(id) ON DELETE CASCADE
);

CREATE TABLE cycle_npc_states (
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  npc_id BIGINT UNSIGNED NOT NULL,
  current_floor_id BIGINT UNSIGNED,
  life_status ENUM('alive', 'dead', 'missing', 'departed') NOT NULL DEFAULT 'alive',
  present TINYINT(1) NOT NULL DEFAULT 1,
  relationship_json JSON NOT NULL,
  dialogue_state_json JSON NOT NULL,
  PRIMARY KEY (story_cycle_id, npc_id),
  CONSTRAINT fk_cycle_npc_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_cycle_npc_npc FOREIGN KEY (npc_id) REFERENCES world_npcs(id) ON DELETE CASCADE,
  CONSTRAINT fk_cycle_npc_floor FOREIGN KEY (current_floor_id) REFERENCES dungeon_floors(id) ON DELETE SET NULL
);

CREATE TABLE cycle_monster_states (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  monster_id BIGINT UNSIGNED NOT NULL,
  current_floor_id BIGINT UNSIGNED NOT NULL,
  current_hp INT NOT NULL,
  status ENUM('alive', 'defeated', 'fled', 'friendly') NOT NULL DEFAULT 'alive',
  state_json JSON NOT NULL,
  CONSTRAINT fk_cycle_monster_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_cycle_monster_monster FOREIGN KEY (monster_id) REFERENCES world_monsters(id) ON DELETE CASCADE,
  CONSTRAINT fk_cycle_monster_floor FOREIGN KEY (current_floor_id) REFERENCES dungeon_floors(id) ON DELETE CASCADE
);

CREATE TABLE cycle_boss_states (
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  boss_profile_id BIGINT UNSIGNED NOT NULL,
  status ENUM('locked', 'alive', 'defeated', 'spared') NOT NULL DEFAULT 'locked',
  current_phase INT NOT NULL DEFAULT 1,
  current_hp INT,
  memory_of_player_json JSON NOT NULL,
  encounter_state_json JSON NOT NULL,
  defeated_at TIMESTAMP NULL,
  PRIMARY KEY (story_cycle_id, boss_profile_id),
  CONSTRAINT fk_cycle_boss_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_cycle_boss_profile FOREIGN KEY (boss_profile_id) REFERENCES boss_profiles(id) ON DELETE CASCADE
);

CREATE TABLE story_memories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  soul_profile_id BIGINT UNSIGNED NOT NULL,
  story_cycle_id BIGINT UNSIGNED,
  character_life_id BIGINT UNSIGNED,
  scope ENUM('soul', 'run', 'character', 'npc', 'dungeon', 'boss') NOT NULL,
  memory_key VARCHAR(120) NOT NULL,
  summary TEXT NOT NULL,
  facts_json JSON NOT NULL,
  importance INT NOT NULL DEFAULT 1,
  remembered_across_lives TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_story_memories_context (soul_profile_id, story_cycle_id, importance),
  CONSTRAINT fk_story_memories_soul FOREIGN KEY (soul_profile_id) REFERENCES soul_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_story_memories_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_story_memories_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE SET NULL
);

CREATE TABLE choice_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  story_cycle_id BIGINT UNSIGNED NOT NULL,
  character_life_id BIGINT UNSIGNED NOT NULL,
  floor_id BIGINT UNSIGNED,
  action_text TEXT NOT NULL,
  action_kind ENUM('suggested', 'typed') NOT NULL,
  intent_json JSON NOT NULL,
  outcome_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_choice_history_cycle (story_cycle_id, created_at),
  CONSTRAINT fk_choice_history_cycle FOREIGN KEY (story_cycle_id) REFERENCES story_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_choice_history_life FOREIGN KEY (character_life_id) REFERENCES character_lives(id) ON DELETE CASCADE,
  CONSTRAINT fk_choice_history_floor FOREIGN KEY (floor_id) REFERENCES dungeon_floors(id) ON DELETE SET NULL
);

CREATE TABLE legacy_heroes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  soul_profile_id BIGINT UNSIGNED NOT NULL,
  source_story_cycle_id BIGINT UNSIGNED NOT NULL UNIQUE,
  source_character_life_id BIGINT UNSIGNED NOT NULL UNIQUE,
  legacy_number INT NOT NULL,
  hero_name VARCHAR(120) NOT NULL,
  final_title VARCHAR(120) NOT NULL,
  identity_snapshot_json JSON NOT NULL,
  character_snapshot_json JSON NOT NULL,
  skills_snapshot_json JSON NOT NULL,
  equipment_snapshot_json JSON NOT NULL,
  inventory_snapshot_json JSON NOT NULL,
  combat_style_snapshot_json JSON NOT NULL,
  boss_snapshot_json JSON NOT NULL,
  locked TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_legacy_hero_number (soul_profile_id, legacy_number),
  CONSTRAINT fk_legacy_heroes_soul FOREIGN KEY (soul_profile_id) REFERENCES soul_profiles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_legacy_heroes_cycle FOREIGN KEY (source_story_cycle_id) REFERENCES story_cycles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_legacy_heroes_life FOREIGN KEY (source_character_life_id) REFERENCES character_lives(id) ON DELETE RESTRICT
);

INSERT INTO skills (skill_key, name, skill_type, description, effects_json, requirements_json) VALUES
('brace', 'Brace', 'reaction', 'Set the body and absorb the force of an incoming strike.', '{"defense":8,"staminaCost":5}', '{}'),
('ember-thread', 'Ember Thread', 'active', 'Draw a line of soul-fire through one visible target.', '{"damageType":"fire","manaCost":8}', '{"intelligence":6}'),
('predator-step', 'Predator Step', 'active', 'Move through an enemy blind spot before it can turn.', '{"staminaCost":9,"evasion":12}', '{"agility":7}'),
('soul-echo', 'Soul Echo', 'passive', 'Recognize a danger remembered by a previous life.', '{"memorySense":1}', '{}');

INSERT INTO items (item_key, name, item_type, description, rarity, effects_json, lore_json) VALUES
('rust-dagger', 'Rust Dagger', 'weapon', 'A chipped dagger left beside newly awakened souls.', 'common', '{"attack":4}', '{"origin":"Cradlewood Threshold"}'),
('torn-cloak', 'Torn Rebirth Cloak', 'armor', 'A rain-heavy cloak that smells faintly of another world.', 'common', '{"defense":1}', '{"soulBound":true}'),
('heartroot-splinter', 'Heartroot Splinter', 'relic', 'A warm shard cut from Mawroot after its defeat.', 'rare', '{"fearResistance":10}', '{"boss":"Mawroot"}');

INSERT INTO world_npcs (name, race, personality_json, backstory, current_dungeon_id, current_floor_id, dialogue_json) VALUES
('Liora Thorn', 'Human', '{"traits":["guarded","brave","impatient"]}', 'A failed hunter who has watched too many new souls die in Cradlewood.', 1, 101, '["If you want to live, follow me."]'),
('Nessa of the Third Eye', 'Glassweb Kin', '{"traits":["observant","dry","secretive"]}', 'A court exile who refuses to accept the queen\'s law of hunger.', 2, 201, '["Do not touch a thread until you know who is listening."]'),
('Pip of the Reed Knife', 'Marsh Goblin', '{"traits":["clever","loyal","irreverent"]}', 'A court scout who laughs whenever etiquette becomes dangerous.', 3, 301, '["In the Mire-Crown, manners are weapons."]'),
('Mira Bellwisp', 'Ash Spirit', '{"traits":["curious","gentle","guilty"]}', 'The last student still attending Ashbell Academy.', 4, 401, '["The bell keeps ringing because nobody dismissed us."]'),
('Sable Quill', 'Namebroker', '{"traits":["precise","charming","unreadable"]}', 'A broker trying to buy back a name they once sold.', 5, 501, '["Never accept the first price, especially when it is free."]'),
('Toma Rivet', 'Ironborn', '{"traits":["practical","protective","stubborn"]}', 'An orchard mechanic who discovered the soldiers can dream.', 6, 601, '["Machines do not need souls to deserve a choice."]'),
('Iria Vowless', 'Fallen Acolyte', '{"traits":["honest","stern","merciful"]}', 'A former judge who broke her vows when mercy became illegal.', 7, 701, '["A law can be holy and still be wrong."]'),
('Rook Emberfin', 'Tide Demon', '{"traits":["bold","warm","vengeful"]}', 'A sailor born inside a prison chain.', 8, 801, '["Freedom without somewhere to go is another storm."]'),
('Page, the Ink Familiar', 'Living Book', '{"traits":["witty","anxious","devoted"]}', 'A familiar carrying names the Chronicle tried to erase.', 9, 901, '["I remember you. That is why the shelves are afraid."]');

INSERT INTO world_monsters (name, species, stats_json, skills_json, loot_json, behavior_json, habitat_dungeon_id, habitat_floor_id) VALUES
('Ashhide Wolf', 'Cradlewood Predator', '{"hp":28,"attack":7,"defense":3}', '["Scent Fear","Pounce"]', '["Ashhide Pelt"]', '{"rhythm":"circle then lunge","retreatBelowHp":5}', 1, 101),
('Glassling Spider', 'Glassweb Brood', '{"hp":34,"attack":8,"defense":5}', '["Silk Pin","Venom Bite"]', '["Glass Thread"]', '{"rhythm":"trap then flank"}', 2, 201),
('Bog Mutt', 'Mire Beast', '{"hp":45,"attack":10,"defense":6}', '["Mud Rush"]', '["Mire Fang"]', '{"rhythm":"pack pressure"}', 3, 301),
('Chalk Wraith', 'Academy Dead', '{"hp":52,"attack":12,"defense":7}', '["Erase Name","Dust Veil"]', '["Living Chalk"]', '{"rhythm":"punishes repeated spells"}', 4, 401),
('Price Moth', 'Bazaar Parasite', '{"hp":48,"attack":9,"defense":8}', '["Consume Memory"]', '["Silver Wing"]', '{"rhythm":"targets carried relics"}', 5, 501),
('Gear Wasp', 'Orchard Machine', '{"hp":64,"attack":14,"defense":10}', '["Drill Sting","Signal Swarm"]', '["Gear Wing"]', '{"rhythm":"coordinates after two turns"}', 6, 601),
('Choir Husk', 'Faith Remnant', '{"hp":78,"attack":16,"defense":12}', '["Empty Hymn"]', '["Salt Tear"]', '{"rhythm":"silences magic first"}', 7, 701),
('Chain Crab', 'Prison Sea Beast', '{"hp":92,"attack":18,"defense":18}', '["Anchor Claw"]', '["Black Chain Link"]', '{"rhythm":"blocks narrow paths"}', 8, 801),
('Index Wisp', 'Chronicle Spirit', '{"hp":70,"attack":20,"defense":10}', '["Rewrite Weakness"]', '["Blank Index Card"]', '{"rhythm":"copies the last action"}', 9, 901);
