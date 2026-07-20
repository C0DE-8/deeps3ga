CREATE TABLE IF NOT EXISTS deep_saga_players (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  player_id VARCHAR(32) NOT NULL UNIQUE,
  username VARCHAR(40) NULL UNIQUE,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(180) NOT NULL,
  narrator_persona VARCHAR(24) NOT NULL DEFAULT 'ADMIN',
  current_run INT NOT NULL DEFAULT 1,
  cycle_clears INT NOT NULL DEFAULT 0,
  current_body JSON NULL,
  memory_log JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL,
  INDEX idx_deep_saga_players_email (email),
  INDEX idx_deep_saga_players_player_id (player_id)
);

CREATE TABLE IF NOT EXISTS narrator_persona (
  persona_key VARCHAR(24) NOT NULL PRIMARY KEY,
  role_name VARCHAR(120) NOT NULL,
  tone VARCHAR(255) NOT NULL,
  style_text TEXT NOT NULL,
  lore_format VARCHAR(255) NOT NULL,
  choice_bias VARCHAR(255) NOT NULL,
  hint_style VARCHAR(255) NOT NULL,
  failure_style VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dungeons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dungeon_number INT NOT NULL UNIQUE,
  canonical_label VARCHAR(40) NOT NULL,
  ai_name VARCHAR(160) NULL,
  ai_name_note TEXT NULL,
  is_final_dungeon TINYINT NOT NULL DEFAULT 0,
  active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dungeons_number (dungeon_number)
);

CREATE TABLE IF NOT EXISTS dungeon_floors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dungeon_number INT NOT NULL,
  floor_number INT NOT NULL,
  canonical_label VARCHAR(40) NOT NULL,
  ai_name VARCHAR(160) NULL,
  ai_name_note TEXT NULL,
  floor_role VARCHAR(80) NOT NULL,
  is_boss_floor TINYINT NOT NULL DEFAULT 1,
  is_final_boss_floor TINYINT NOT NULL DEFAULT 0,
  active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_dungeon_floor (dungeon_number, floor_number),
  INDEX idx_dungeon_floors_dungeon (dungeon_number),
  INDEX idx_dungeon_floors_boss (is_boss_floor)
);

CREATE TABLE IF NOT EXISTS story_bosses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  boss_sequence INT NOT NULL UNIQUE,
  boss_name VARCHAR(120) NOT NULL,
  boss_title VARCHAR(160) NOT NULL,
  source_world VARCHAR(120) NOT NULL,
  power_rank INT NOT NULL,
  max_hp INT NOT NULL DEFAULT 100,
  dungeon_number INT NOT NULL,
  floor_number INT NOT NULL DEFAULT 1,
  profile TEXT NOT NULL,
  combat_style TEXT NOT NULL,
  opening_attitude VARCHAR(160) NOT NULL,
  active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_story_bosses_stage (dungeon_number, floor_number),
  INDEX idx_story_bosses_power (power_rank)
);

CREATE TABLE IF NOT EXISTS player_boss_progress (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  player_id VARCHAR(32) NOT NULL,
  run_number INT NOT NULL,
  boss_sequence INT NOT NULL,
  boss_name VARCHAR(120) NOT NULL,
  current_hp INT NOT NULL,
  max_hp INT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  defeated_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_player_run_boss (player_id, run_number, boss_sequence),
  INDEX idx_player_boss_progress_player (player_id, run_number),
  INDEX idx_player_boss_progress_status (status)
);

CREATE TABLE IF NOT EXISTS player_characters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  player_id VARCHAR(32) NOT NULL,
  run_number INT NOT NULL DEFAULT 1,
  active_character TINYINT NOT NULL DEFAULT 1,
  character_name VARCHAR(120) NULL,
  species VARCHAR(80) NULL,
  race VARCHAR(80) NULL,
  class_name VARCHAR(100) NULL,
  level INT NOT NULL DEFAULT 1,
  hp INT NOT NULL DEFAULT 100,
  max_hp INT NOT NULL DEFAULT 100,
  mana INT NOT NULL DEFAULT 30,
  max_mana INT NOT NULL DEFAULT 30,
  stamina INT NOT NULL DEFAULT 50,
  max_stamina INT NOT NULL DEFAULT 50,
  strength INT NOT NULL DEFAULT 5,
  agility INT NOT NULL DEFAULT 5,
  defense INT NOT NULL DEFAULT 5,
  thaumaturgy INT NOT NULL DEFAULT 5,
  resolve_stat INT NOT NULL DEFAULT 5,
  intelligence INT NOT NULL DEFAULT 5,
  luck INT NOT NULL DEFAULT 5,
  charisma INT NOT NULL DEFAULT 5,
  gold INT NOT NULL DEFAULT 0,
  soul_energy INT NOT NULL DEFAULT 0,
  dungeon INT NOT NULL DEFAULT 1,
  floor INT NOT NULL DEFAULT 1,
  status VARCHAR(40) NOT NULL DEFAULT 'alive',
  story_phase VARCHAR(40) NOT NULL DEFAULT 'combat',
  pending_next_dungeon INT NULL,
  last_defeated_boss INT NULL,
  appearance_json JSON NULL,
  traits_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_player_characters_player (player_id),
  INDEX idx_player_characters_active (player_id, active_character)
);

CREATE TABLE IF NOT EXISTS skills (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  skill_key VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  family VARCHAR(80) NOT NULL,
  skill_type VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  rarity VARCHAR(40) NOT NULL DEFAULT 'common',
  unlock_rule TEXT NULL,
  active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_character_skills (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  character_id BIGINT UNSIGNED NOT NULL,
  skill_id BIGINT UNSIGNED NOT NULL,
  skill_level INT NOT NULL DEFAULT 1,
  unlocked TINYINT NOT NULL DEFAULT 1,
  equipped TINYINT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_character_skill (character_id, skill_id),
  INDEX idx_player_character_skills_character (character_id),
  INDEX idx_player_character_skills_skill (skill_id)
);

CREATE TABLE IF NOT EXISTS story_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  player_id VARCHAR(32) NOT NULL,
  run_number INT NOT NULL DEFAULT 1,
  character_id BIGINT UNSIGNED NULL,
  dungeon_number INT NOT NULL DEFAULT 1,
  floor_number INT NOT NULL DEFAULT 1,
  speaker VARCHAR(24) NOT NULL,
  message_text TEXT NOT NULL,
  choices_json JSON NULL,
  state_changes_json JSON NULL,
  record_changes_json JSON NULL,
  memory_updates_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_story_messages_player_run (player_id, run_number, id),
  INDEX idx_story_messages_location (player_id, run_number, dungeon_number, floor_number)
);

CREATE TABLE IF NOT EXISTS story_memory (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  player_id VARCHAR(32) NOT NULL,
  run_number INT NOT NULL DEFAULT 1,
  character_id BIGINT UNSIGNED NULL,
  memory_type VARCHAR(60) NOT NULL DEFAULT 'story',
  memory_text TEXT NOT NULL,
  facts_json JSON NULL,
  importance INT NOT NULL DEFAULT 1,
  remembered_across_lives TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_story_memory_player_run (player_id, run_number),
  INDEX idx_story_memory_across_lives (player_id, remembered_across_lives)
);

CREATE TABLE IF NOT EXISTS ai_location_names (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  player_id VARCHAR(32) NULL,
  run_number INT NULL,
  dungeon_number INT NOT NULL,
  floor_number INT NULL,
  name_type VARCHAR(40) NOT NULL,
  ai_name VARCHAR(160) NOT NULL,
  source_text TEXT NULL,
  accepted TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_location_names_position (dungeon_number, floor_number),
  INDEX idx_ai_location_names_player (player_id, run_number)
);

CREATE TABLE IF NOT EXISTS legacy_heroes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  player_id VARCHAR(32) NOT NULL,
  source_run_number INT NOT NULL,
  source_character_id BIGINT UNSIGNED NULL,
  hero_name VARCHAR(120) NULL,
  race VARCHAR(80) NULL,
  class_name VARCHAR(100) NULL,
  level INT NOT NULL DEFAULT 1,
  hp INT NOT NULL DEFAULT 100,
  max_hp INT NOT NULL DEFAULT 100,
  mana INT NOT NULL DEFAULT 30,
  max_mana INT NOT NULL DEFAULT 30,
  stamina INT NOT NULL DEFAULT 50,
  max_stamina INT NOT NULL DEFAULT 50,
  stats_json JSON NULL,
  skills_json JSON NULL,
  inventory_json JSON NULL,
  titles_json JSON NULL,
  personality_json JSON NULL,
  combat_style_json JSON NULL,
  final_dungeon INT NOT NULL DEFAULT 10,
  final_floor INT NOT NULL DEFAULT 1,
  boss_intro_dialogue TEXT NULL,
  boss_defeat_dialogue TEXT NULL,
  locked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_legacy_player_run (player_id, source_run_number),
  INDEX idx_legacy_heroes_player (player_id),
  INDEX idx_legacy_heroes_source (source_run_number)
);

INSERT INTO dungeons (dungeon_number, canonical_label, ai_name, ai_name_note, is_final_dungeon, active) VALUES
(1, 'Boss Stage 1', 'The Rebirth Crucible', '0.3 ten-boss reincarnation gauntlet.', 0, 1),
(2, 'Boss Stage 2', 'Boss 2: Clayman', '0.3 ten-boss reincarnation gauntlet.', 0, 1),
(3, 'Boss Stage 3', 'Boss 3: Araba', '0.3 ten-boss reincarnation gauntlet.', 0, 1),
(4, 'Boss Stage 4', 'Boss 4: Mother (Queen Taratect)', '0.3 ten-boss reincarnation gauntlet.', 0, 1),
(5, 'Boss Stage 5', 'Boss 5: Hinata Sakaguchi', '0.3 ten-boss reincarnation gauntlet.', 0, 1),
(6, 'Boss Stage 6', 'Boss 6: Demon Lord Ariel', '0.3 ten-boss reincarnation gauntlet.', 0, 1),
(7, 'Boss Stage 7', 'Boss 7: Milim Nava', '0.3 ten-boss reincarnation gauntlet.', 0, 1),
(8, 'Boss Stage 8', 'Boss 8: Veldora Tempest', '0.3 ten-boss reincarnation gauntlet.', 0, 1),
(9, 'Boss Stage 9', 'Boss 9: Guy Crimson', '0.3 ten-boss reincarnation gauntlet.', 0, 1),
(10, 'Boss Stage 10', 'Boss 10: Administrator D', '0.3 ten-boss reincarnation gauntlet.', 1, 1)
ON DUPLICATE KEY UPDATE
  canonical_label = VALUES(canonical_label),
  ai_name = VALUES(ai_name),
  ai_name_note = VALUES(ai_name_note),
  is_final_dungeon = VALUES(is_final_dungeon),
  active = 1;

INSERT INTO dungeon_floors (dungeon_number, floor_number, canonical_label, ai_name, ai_name_note, floor_role, is_boss_floor, is_final_boss_floor, active) VALUES
(1, 1, 'Boss Stage 1', 'Boss 1: Gloria Taratect', '0.3 combat boss stage.', 'opening_boss', 1, 0, 1),
(2, 1, 'Boss Stage 2', 'Boss 2: Clayman', '0.3 combat boss stage.', 'boss', 1, 0, 1),
(3, 1, 'Boss Stage 3', 'Boss 3: Araba', '0.3 combat boss stage.', 'boss', 1, 0, 1),
(4, 1, 'Boss Stage 4', 'Boss 4: Mother (Queen Taratect)', '0.3 combat boss stage.', 'boss', 1, 0, 1),
(5, 1, 'Boss Stage 5', 'Boss 5: Hinata Sakaguchi', '0.3 combat boss stage.', 'boss', 1, 0, 1),
(6, 1, 'Boss Stage 6', 'Boss 6: Demon Lord Ariel', '0.3 combat boss stage.', 'boss', 1, 0, 1),
(7, 1, 'Boss Stage 7', 'Boss 7: Milim Nava', '0.3 combat boss stage.', 'boss', 1, 0, 1),
(8, 1, 'Boss Stage 8', 'Boss 8: Veldora Tempest', '0.3 combat boss stage.', 'boss', 1, 0, 1),
(9, 1, 'Boss Stage 9', 'Boss 9: Guy Crimson', '0.3 combat boss stage.', 'boss', 1, 0, 1),
(10, 1, 'Boss Stage 10', 'Boss 10: Administrator D', '0.3 combat boss stage.', 'final_boss', 1, 1, 1)
ON DUPLICATE KEY UPDATE
  canonical_label = VALUES(canonical_label),
  ai_name = VALUES(ai_name),
  ai_name_note = VALUES(ai_name_note),
  floor_role = VALUES(floor_role),
  is_boss_floor = VALUES(is_boss_floor),
  is_final_boss_floor = VALUES(is_final_boss_floor),
  active = 1;

INSERT INTO story_bosses (boss_sequence, boss_name, boss_title, source_world, power_rank, max_hp, dungeon_number, floor_number, profile, combat_style, opening_attitude, active) VALUES
(1, 'Gloria Taratect', 'Evolved Giant Spider', 'Spider Reincarnation', 10, 120, 1, 1, 'A durable evolved spider that serves the Queen Taratect and tests whether a newborn soul understands movement, traps, and timing.', 'web pressure, armored legs, sudden lunges', 'cocky and dismissive', 1),
(2, 'Clayman', 'Manipulative Demon Lord', 'Slime Reincarnation', 9, 180, 2, 1, 'A schemer who relies on puppets, fear, mind pressure, and staged advantages more than raw strength.', 'mind control, summoned soldiers, dirty bargains', 'condescending', 1),
(3, 'Araba', 'Earth Dragon', 'Spider Reincarnation', 8, 260, 3, 1, 'A disciplined dragon whose raw physical control forces the player to earn every opening.', 'stone breath, disciplined counters, crushing endurance', 'silent and honorable', 1),
(4, 'Mother (Queen Taratect)', 'Queen Spider', 'Spider Reincarnation', 7, 340, 4, 1, 'A giant queen spider commanding countless offspring through pressure, instinct, and brood authority.', 'brood control, psychic pressure, layered webs', 'possessive and predatory', 1),
(5, 'Hinata Sakaguchi', 'Holy Knight Commander', 'Slime Reincarnation', 6, 430, 5, 1, 'A master swordswoman whose anti-monster techniques punish reckless monster instincts.', 'holy sword forms, analysis, anti-monster seals', 'coldly focused', 1),
(6, 'Demon Lord Ariel', 'Ancient Demon Ruler', 'Spider Reincarnation', 5, 540, 6, 1, 'A centuries-old demon ruler with overwhelming experience and calm battlefield cruelty.', 'ancient magic, close combat mastery, regeneration', 'amused but alert', 1),
(7, 'Milim Nava', 'Catastrophe Demon Lord', 'Slime Reincarnation', 4, 680, 7, 1, 'A childlike ancient demon lord whose cheerful mood hides nation-breaking force.', 'catastrophic strength, flight, explosive magic', 'playful and careless', 1),
(8, 'Veldora Tempest', 'Storm Dragon', 'Slime Reincarnation', 3, 840, 8, 1, 'A True Dragon of storm and destruction whose presence turns the arena into weather.', 'storm aura, dragon magic, destructive breath', 'loudly overconfident', 1),
(9, 'Guy Crimson', 'Primordial Demon Lord', 'Slime Reincarnation', 2, 1020, 9, 1, 'The strongest demon lord, feared for near-unmatched power, patience, and impossible reads.', 'primordial magic, perfect counters, domination pressure', 'politely terrifying', 1),
(10, 'Administrator D', 'Mirror Administrator', 'Spider Reincarnation', 1, 1400, 10, 1, 'A godlike administrator who appears as the player''s perfected self: what the soul could become through ruthless effort.', 'system rewriting, mirror choices, impossible observation', 'playful, clinical, and personal', 1)
ON DUPLICATE KEY UPDATE
  boss_name = VALUES(boss_name),
  boss_title = VALUES(boss_title),
  source_world = VALUES(source_world),
  power_rank = VALUES(power_rank),
  max_hp = VALUES(max_hp),
  dungeon_number = VALUES(dungeon_number),
  floor_number = VALUES(floor_number),
  profile = VALUES(profile),
  combat_style = VALUES(combat_style),
  opening_attitude = VALUES(opening_attitude),
  active = 1;

INSERT INTO skills (skill_key, name, family, skill_type, description, rarity, active) VALUES
('appraisal', 'Appraisal', 'Support', 'Support', 'Reveals enemy stats, weaknesses, and loot.', 'common', 1),
('predator', 'Predator', 'Unique', 'Unique', 'Consume enemies to gain skills or traits.', 'unique', 1),
('regeneration', 'Regeneration', 'Passive', 'Passive', 'Restores HP over time.', 'uncommon', 1),
('mana_control', 'Mana Control', 'Passive', 'Passive', 'Reduces MP cost of abilities.', 'common', 1),
('shadow_step', 'Shadow Step', 'Active', 'Active', 'Teleport a short distance instantly.', 'rare', 1),
('poison_fang', 'Poison Fang', 'Attack', 'Attack', 'Inflicts poison damage over time.', 'common', 1),
('fireball', 'Fireball', 'Magic', 'Magic', 'Launches a fire projectile.', 'common', 1),
('ice_lance', 'Ice Lance', 'Magic', 'Magic', 'Pierces enemies and may freeze them.', 'uncommon', 1),
('thunder_strike', 'Thunder Strike', 'Magic', 'Magic', 'Calls lightning from above.', 'rare', 1),
('berserk', 'Berserk', 'Buff', 'Buff', 'Greatly increases attack but lowers defense.', 'uncommon', 1),
('stealth', 'Stealth', 'Utility', 'Utility', 'Become nearly invisible.', 'common', 1),
('web_trap', 'Web Trap', 'Utility', 'Utility', 'Immobilizes enemies.', 'common', 1),
('blood_drain', 'Blood Drain', 'Attack', 'Attack', 'Steals HP from enemies.', 'rare', 1),
('earth_wall', 'Earth Wall', 'Defense', 'Defense', 'Creates a protective barrier.', 'uncommon', 1),
('wind_dash', 'Wind Dash', 'Mobility', 'Mobility', 'Greatly increases movement speed.', 'common', 1),
('critical_eye', 'Critical Eye', 'Passive', 'Passive', 'Increases critical hit chance.', 'uncommon', 1),
('dragon_roar', 'Dragon Roar', 'Ultimate', 'Ultimate', 'Stuns nearby enemies.', 'epic', 1),
('time_slow', 'Time Slow', 'Ultimate', 'Ultimate', 'Slows all enemies in an area.', 'epic', 1),
('soul_harvest', 'Soul Harvest', 'Legendary', 'Legendary', 'Gain Soul Essence from defeated foes.', 'legendary', 1),
('void_slash', 'Void Slash', 'Mythic', 'Mythic', 'Ignores armor and cuts through dimensions.', 'mythic', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  family = VALUES(family),
  skill_type = VALUES(skill_type),
  description = VALUES(description),
  rarity = VALUES(rarity),
  active = 1;
