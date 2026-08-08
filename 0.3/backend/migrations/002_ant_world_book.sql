INSERT INTO deep_saga_books
  (slug, title, book_number, world, status, genre_json, description, version, cover_config_json)
VALUES
  (
    'ant-world',
    'The Ant World: The King''s Soul',
    1,
    'Eldara',
    'active',
    JSON_ARRAY('Fantasy', 'Reincarnation', 'Evolution', 'War', 'Mystery', 'Adventure'),
    'A dead human awakens as a helpless ant larva in Eldara, where a strange colony disturbance leads toward an ancient chamber, a dying Soul Seed, and the mystery of a vanished Ant King.',
    '0.3.0',
    JSON_OBJECT('tone', 'dark fantasy', 'palette', 'amber, bone, obsidian, moss', 'symbol', 'ant larva under a fractured crown', 'image', 'ant-world-cover.jpg')
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

SET @ant_world_book_id = (SELECT book_id FROM deep_saga_books WHERE slug = 'ant-world' LIMIT 1);

INSERT INTO deep_saga_story_guides (book_id, guide_version, canon_json)
VALUES (
  @ant_world_book_id,
  '0.3.0',
  JSON_OBJECT(
    'world', 'Eldara',
    'engineLaw', JSON_ARRAY('AI = GAME MASTER', 'STORY GUIDE = CANON', 'PLAYER = PROTAGONIST', 'ENGINE = REALITY'),
    'startingState', JSON_OBJECT('species', 'Ant', 'lifeStage', 'Larva', 'level', 1, 'location', 'Ant Nursery', 'humanMemoriesRetained', true),
    'majorCivilizations', JSON_ARRAY('Ants', 'Spiders', 'Bees', 'Beetles', 'Scorpions', 'Grasshoppers', 'Butterflies', 'Flies', 'Mosquitoes'),
    'coreStory', JSON_OBJECT(
      'model', 'One fixed canon spine, infinite possible player journeys',
      'fixedCanon', JSON_ARRAY('human dies and reincarnates as an ant larva', 'old threat approaches the colony', 'ancient underground chamber exists beneath the colony', 'dying Soul Seed is tied to forgotten colony history', 'Soul Seed awakens in Chapter 3', 'brief crowned wounded ancient ant vision ends Chapter 3'),
      'flexibleJourneys', JSON_ARRAY('investigation through scent and symbols', 'relationship through worker protection and rescue', 'conflict through guards, injury, and survival', 'accident through colony movement, displacement, and confusion')
    ),
    'privateTruths', JSON_ARRAY('Royal Soul Resonance connects the player to the vanished Ant King', 'The Grand Insect Tournament gathers soul energy', 'The Great War is tied to ancient manipulation', 'The sanctuary truth belongs to later Book 1', 'Final evolution is resolved from the whole run'),
    'blockedEarlySpoilers', JSON_ARRAY('full Ant King revelation', 'tournament soul-energy revelation', 'sanctuary truth', 'final enemy', 'final evolution logic')
  )
)
ON DUPLICATE KEY UPDATE canon_json = VALUES(canon_json);
