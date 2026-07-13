-- Materialize every monster named by a floor so narration and engine state share the same canon.
INSERT INTO world_monsters
  (name, species, stats_json, skills_json, loot_json, behavior_json, habitat_dungeon_id, habitat_floor_id)
SELECT declared.name,
       'Dungeon-Born Threat',
       JSON_OBJECT('hp', 20 + d.dungeon_number * 10, 'attack', 5 + d.dungeon_number * 2, 'defense', 2 + d.dungeon_number, 'speed', 5 + d.dungeon_number),
       JSON_ARRAY(),
       JSON_ARRAY(),
       JSON_OBJECT('intelligence', 'instinctive', 'peace', 'A context-specific nonviolent solution may exist.', 'canFlee', true),
       d.id,
       df.id
FROM dungeon_floors df
JOIN dungeons d ON d.id = df.dungeon_id
JOIN (
  SELECT source.id AS floor_id, JSON_UNQUOTE(JSON_EXTRACT(source.enemies_available_json, CONCAT('$[', indexes.idx, ']'))) AS name
  FROM dungeon_floors source
  JOIN (SELECT 0 AS idx UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) indexes
) declared ON declared.floor_id = df.id
WHERE declared.name IS NOT NULL
  AND declared.name <> ''
  AND NOT EXISTS (
    SELECT 1 FROM world_monsters existing
    WHERE existing.name = declared.name AND existing.habitat_floor_id = df.id
  );

-- Existing active saves receive missing floor instances without being reset.
INSERT INTO cycle_monster_states
  (story_cycle_id, monster_id, current_floor_id, current_hp, max_hp, xp_reward, gold_reward, state_json)
SELECT sc.id, wm.id, wm.habitat_floor_id,
       COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(wm.stats_json, '$.hp')) AS UNSIGNED), 20),
       COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(wm.stats_json, '$.hp')) AS UNSIGNED), 20),
       10 + COALESCE(wm.habitat_dungeon_id, 1) * 8,
       5 + COALESCE(wm.habitat_dungeon_id, 1) * 4,
       '{}'
FROM story_cycles sc
JOIN story_progress sp ON sp.story_cycle_id = sc.id
JOIN world_monsters wm ON wm.habitat_floor_id = sp.current_floor_id
WHERE sc.status = 'in_progress'
  AND NOT EXISTS (
    SELECT 1 FROM cycle_monster_states cms
    WHERE cms.story_cycle_id = sc.id AND cms.monster_id = wm.id AND cms.current_floor_id = wm.habitat_floor_id
  );
