INSERT INTO deep_saga_books
  (slug, title, book_number, world, status, genre_json, description, version, cover_config_json)
VALUES
  (
    'trap-guild',
    'Trap Guild: Three Bosses to Freedom',
    2,
    'Veyra',
    'active',
    JSON_ARRAY('Action', 'Dungeon', 'Fantasy', 'Survival', 'Boss Rush'),
    'You wake inside a stolen fighter''s body in an overpowered guild trap. Three bosses hold the seals. Beat them, break the guild''s contract, and win freedom.',
    '0.3.0',
    JSON_OBJECT('tone', 'arena fantasy', 'palette', 'iron, crimson, torchlight, ash', 'symbol', 'three boss seals over a broken guild contract', 'startText', 'Awakened fighter, level 1, trapped inside the OP Guild arena.')
  )
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  book_number = VALUES(book_number),
  world = VALUES(world),
  status = VALUES(status),
  genre_json = VALUES(genre_json),
  description = VALUES(description),
  version = VALUES(version),
  cover_config_json = VALUES(cover_config_json);

SET @trap_guild_book_id = (SELECT book_id FROM deep_saga_books WHERE slug = 'trap-guild' LIMIT 1);

INSERT INTO deep_saga_story_guides (book_id, guide_version, canon_json)
VALUES (
  @trap_guild_book_id,
  '0.3.0',
  JSON_OBJECT(
    'world', 'Veyra',
    'engineLaw', JSON_ARRAY('AI = GAME MASTER', 'STORY GUIDE = CANON', 'PLAYER = PROTAGONIST', 'ENGINE = REALITY'),
    'startingState', JSON_OBJECT('species', 'Human', 'lifeStage', 'Awakened Fighter', 'level', 1, 'location', 'OP Guild Trap Chamber', 'humanMemoriesRetained', true),
    'coreStory', JSON_OBJECT(
      'model', 'Trapped-body fight story with three fixed boss seals and free routes',
      'fixedCanon', JSON_ARRAY('player wakes in a prepared fighter body', 'OP Guild trap is active', 'three boss seals hold the player', 'all three boss seals must be resolved to win freedom'),
      'flexibleJourneys', JSON_ARRAY('combat victory', 'trap exploitation', 'ally building', 'contract loopholes', 'reckless survival')
    ),
    'blockedEarlySpoilers', JSON_ARRAY('final contract clause', 'guild master identity', 'true body origin')
  )
)
ON DUPLICATE KEY UPDATE canon_json = VALUES(canon_json);

INSERT INTO deep_saga_chapters
  (book_id, chapter_number, slug, title, purpose, required_canon_json, major_revelations_json, possible_developments_json, end_conditions_json, blocked_revelations_json, scene_guidance_json)
VALUES
(@trap_guild_book_id, 1, 'the-body-in-the-trap', 'The Body in the Trap', 'Wake in a battle-ready body inside the OP Guild trap and establish the three boss seals.', JSON_ARRAY('player wakes in unfamiliar body', 'OP Guild trap contract is active', 'three boss gates are visible'), JSON_ARRAY('the player is trapped', 'three bosses hold freedom', 'the body can fight but is not invincible'), JSON_ARRAY('test body', 'study contract', 'call for other prisoners', 'approach first gate', 'search for weapon'), JSON_ARRAY('the first boss seal becomes reachable'), JSON_ARRAY('final contract clause', 'third boss identity', 'guild master identity', 'true body origin'), JSON_ARRAY('awakening', 'body-test', 'guild-contract', 'three-gates')),
(@trap_guild_book_id, 2, 'the-first-boss-seal', 'The First Boss Seal', 'Face the first boss and learn that brute strength alone is not enough.', JSON_ARRAY('first boss confronts player', 'first seal can break through earned victory or clever resolution'), JSON_ARRAY('bosses are part of the contract', 'the arena rewards adaptation'), JSON_ARRAY('duel', 'trap use', 'weapon discovery', 'ally intervention', 'injury', 'counterattack'), JSON_ARRAY('first boss seal breaks'), JSON_ARRAY('final contract clause', 'guild master identity', 'true body origin'), JSON_ARRAY('first-boss', 'adaptation', 'seal-break')),
(@trap_guild_book_id, 3, 'the-second-boss-seal', 'The Second Boss Seal', 'Reveal that the trap has rules and the bosses are keys as much as enemies.', JSON_ARRAY('second boss tests more than combat', 'contract rules become clearer', 'player learns the guild feeds on failed challengers'), JSON_ARRAY('the bosses are keys', 'failed challengers empower the guild trap'), JSON_ARRAY('rule exploitation', 'rescue prisoner', 'boss negotiation', 'magic trial', 'hard fight', 'sacrifice'), JSON_ARRAY('second boss seal breaks and the third gate opens'), JSON_ARRAY('final contract clause', 'true body origin'), JSON_ARRAY('second-boss', 'rules', 'failed-challengers', 'third-gate')),
(@trap_guild_book_id, 4, 'the-third-boss-seal', 'The Third Boss Seal', 'Resolve the final boss seal and expose the true contract holding the body.', JSON_ARRAY('third boss guards the final seal', 'guild contract becomes visible', 'player must survive the strongest test'), JSON_ARRAY('the OP Guild built the trap to harvest winners and failures', 'the body was chosen for a reason'), JSON_ARRAY('final duel', 'contract loophole', 'boss alliance', 'self-sacrifice', 'refusal', 'direct guild defiance'), JSON_ARRAY('third boss seal breaks and the freedom clause appears'), JSON_ARRAY('final freedom cost'), JSON_ARRAY('third-boss', 'true-contract', 'final-seal')),
(@trap_guild_book_id, 5, 'win-and-be-free', 'Win and Be Free', 'Break, rewrite, or pay the final freedom clause and decide what freedom means.', JSON_ARRAY('all three boss seals are broken', 'final freedom clause must be resolved', 'guild control is confronted'), JSON_ARRAY('freedom has a cost', 'the player decides what to do with the trapped body and guild contract'), JSON_ARRAY('break contract', 'rewrite contract', 'free prisoners', 'fight guild master', 'escape alone', 'claim arena'), JSON_ARRAY('player wins freedom, dies meaningfully, or transforms the trap according to the run'), JSON_ARRAY(), JSON_ARRAY('freedom-clause', 'final-choice', 'ending'))
ON DUPLICATE KEY UPDATE
  slug = VALUES(slug),
  title = VALUES(title),
  purpose = VALUES(purpose),
  required_canon_json = VALUES(required_canon_json),
  major_revelations_json = VALUES(major_revelations_json),
  possible_developments_json = VALUES(possible_developments_json),
  end_conditions_json = VALUES(end_conditions_json),
  blocked_revelations_json = VALUES(blocked_revelations_json),
  scene_guidance_json = VALUES(scene_guidance_json);
