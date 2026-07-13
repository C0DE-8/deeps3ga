CREATE TABLE IF NOT EXISTS floor_story_beats (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  floor_id BIGINT UNSIGNED NOT NULL,
  beat_number TINYINT UNSIGNED NOT NULL,
  beat_type ENUM('arrival', 'discovery', 'choice', 'quiet', 'danger', 'climax', 'aftermath') NOT NULL,
  title VARCHAR(160) NOT NULL,
  narrative_seed TEXT NOT NULL,
  required_signatures_json JSON NOT NULL,
  available_choices_json JSON NOT NULL,
  consequence_keys_json JSON NOT NULL,
  UNIQUE KEY uq_floor_story_beat (floor_id, beat_number),
  CONSTRAINT fk_floor_story_beats_floor FOREIGN KEY (floor_id) REFERENCES dungeon_floors(id) ON DELETE CASCADE
);

INSERT IGNORE INTO floor_story_beats
  (floor_id, beat_number, beat_type, title, narrative_seed, required_signatures_json, available_choices_json, consequence_keys_json)
SELECT id, 1, 'arrival', CONCAT(floor_name, ': Arrival'),
       CONCAT('Establish ', atmosphere, '. Reveal the immediate purpose without resolving it: ', story_purpose),
       '[]', JSON_ARRAY('Study the surroundings.', 'Approach carefully.', 'Speak to whoever is present.'), '[]'
FROM dungeon_floors
UNION ALL
SELECT id, 2,
       CASE WHEN floor_number = 5 THEN 'climax' WHEN purpose_type = 'quiet' THEN 'quiet' WHEN purpose_type IN ('puzzle','mystery') THEN 'discovery' ELSE 'danger' END,
       CONCAT(floor_name, ': The Turning Point'),
       CONCAT('Develop the floor conflict through its stored NPCs, monsters, hidden events, and objective: ', story_purpose),
       '[]', JSON_ARRAY('Commit to the direct path.', 'Search for another solution.', 'Ask a companion for judgment.'), '[]'
FROM dungeon_floors
UNION ALL
SELECT id, 3, CASE WHEN floor_number = 5 THEN 'aftermath' ELSE 'choice' END,
       CONCAT(floor_name, ': Consequence'),
       CASE WHEN floor_number = 5
            THEN 'Show the boss outcome and its cost. Do not unlock the next realm until the engine confirms victory.'
            ELSE 'Present a decision whose consequence remains in story memory and changes a later scene.' END,
       '[]', JSON_ARRAY('Accept the consequence.', 'Protect someone at personal cost.', 'Refuse the expected answer.'), '[]'
FROM dungeon_floors;
