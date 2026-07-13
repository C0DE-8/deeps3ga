-- Companion injury records and equipment-state backfill for existing saves.

CREATE TABLE companion_injuries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  companion_id BIGINT UNSIGNED NOT NULL,
  combat_encounter_id BIGINT UNSIGNED NULL,
  name VARCHAR(160) NOT NULL,
  severity ENUM('minor', 'major', 'critical', 'permanent') NOT NULL,
  effects_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  healed_at TIMESTAMP NULL,
  INDEX idx_companion_injury_active (companion_id, healed_at),
  CONSTRAINT fk_companion_injury_companion FOREIGN KEY (companion_id) REFERENCES companions(id) ON DELETE CASCADE,
  CONSTRAINT fk_companion_injury_encounter FOREIGN KEY (combat_encounter_id) REFERENCES combat_encounters(id) ON DELETE SET NULL
);

INSERT IGNORE INTO equipment_states (character_inventory_id, bonuses_json)
SELECT id, '{}' FROM character_inventory WHERE equipped_slot IS NOT NULL;
