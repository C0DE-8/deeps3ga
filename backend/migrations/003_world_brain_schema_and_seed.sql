-- Deep Saga world brain.
-- The database owns world facts; the AI reads this state and narrates from it.

ALTER TABLE dungeons
  ADD COLUMN place_kind VARCHAR(120) NOT NULL DEFAULT 'Dungeon' AFTER name,
  ADD COLUMN description TEXT AFTER place_kind,
  ADD COLUMN difficulty INT NOT NULL DEFAULT 1 AFTER theme,
  ADD COLUMN unlock_requirements_json VARCHAR(4096) NOT NULL DEFAULT '{}' AFTER difficulty;

ALTER TABLE dungeon_floors
  ADD COLUMN floor_name VARCHAR(160) NOT NULL DEFAULT '' AFTER floor_number,
  ADD COLUMN description TEXT AFTER floor_name,
  ADD COLUMN atmosphere VARCHAR(1000) NOT NULL DEFAULT '' AFTER description,
  ADD COLUMN enemies_available_json VARCHAR(4096) NOT NULL DEFAULT '[]' AFTER atmosphere,
  ADD COLUMN npcs_available_json VARCHAR(4096) NOT NULL DEFAULT '[]' AFTER enemies_available_json,
  ADD COLUMN hidden_events_json VARCHAR(4096) NOT NULL DEFAULT '[]' AFTER npcs_available_json;

CREATE TABLE world_npcs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  race VARCHAR(80) NOT NULL DEFAULT '',
  personality_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  backstory TEXT,
  current_dungeon_id BIGINT UNSIGNED,
  current_floor_id BIGINT UNSIGNED,
  dialogue_json VARCHAR(4096) NOT NULL DEFAULT '[]',
  relationship_with_player_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  quest_status ENUM('none', 'available', 'active', 'complete', 'failed') NOT NULL DEFAULT 'none',
  life_status ENUM('alive', 'dead', 'missing') NOT NULL DEFAULT 'alive',
  CONSTRAINT fk_world_npcs_dungeon
    FOREIGN KEY (current_dungeon_id) REFERENCES dungeons(id) ON DELETE SET NULL,
  CONSTRAINT fk_world_npcs_floor
    FOREIGN KEY (current_floor_id) REFERENCES dungeon_floors(id) ON DELETE SET NULL
);

CREATE TABLE world_monsters (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  species VARCHAR(120) NOT NULL,
  stats_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  skills_json VARCHAR(4096) NOT NULL DEFAULT '[]',
  loot_json VARCHAR(4096) NOT NULL DEFAULT '[]',
  behavior_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  habitat_dungeon_id BIGINT UNSIGNED,
  habitat_floor_id BIGINT UNSIGNED,
  CONSTRAINT fk_world_monsters_dungeon
    FOREIGN KEY (habitat_dungeon_id) REFERENCES dungeons(id) ON DELETE SET NULL,
  CONSTRAINT fk_world_monsters_floor
    FOREIGN KEY (habitat_floor_id) REFERENCES dungeon_floors(id) ON DELETE SET NULL
);

CREATE TABLE world_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  item_type VARCHAR(80) NOT NULL,
  description TEXT,
  effects_json VARCHAR(4096) NOT NULL DEFAULT '{}',
  rarity ENUM('common', 'uncommon', 'rare', 'epic', 'legendary', 'cursed') NOT NULL DEFAULT 'common',
  story_flags_json VARCHAR(4096) NOT NULL DEFAULT '{}'
);

CREATE TABLE world_story_chapters (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  chapter_number INT NOT NULL,
  scene_key VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  required_dungeon_id BIGINT UNSIGNED,
  required_floor_id BIGINT UNSIGNED,
  required_events_json VARCHAR(4096) NOT NULL DEFAULT '[]',
  CONSTRAINT fk_world_story_chapters_dungeon
    FOREIGN KEY (required_dungeon_id) REFERENCES dungeons(id) ON DELETE SET NULL,
  CONSTRAINT fk_world_story_chapters_floor
    FOREIGN KEY (required_floor_id) REFERENCES dungeon_floors(id) ON DELETE SET NULL
);

INSERT INTO dungeons (id, dungeon_number, name, place_kind, description, theme, difficulty, unlock_requirements_json, story_arc_json) VALUES
(1, 1, 'Cradlewood Threshold', 'Living Forest Gate', 'A red-sky forest where new souls wake in bodies that do not yet feel like their own.', 'first survival, monster instinct, and rebirth fear', 1, '{}', '{"arc":"learn that Deep Saga is alive"}'),
(2, 2, 'Glassweb Hollows', 'Underground Silk Kingdom', 'A vertical cavern kingdom spun from glasslike silk and ruled by patient predators.', 'web politics and body horror evolution', 2, '{"clearDungeon":1}', '{"arc":"discover intelligent monsters can build kingdoms"}'),
(3, 3, 'Mire-Crown Principality', 'Sunken Monster Court', 'A swamp principality where goblin nobles hold court in half-drowned halls.', 'civilization among monsters and oath prices', 3, '{"clearDungeon":2}', '{"arc":"choose between survival and belonging"}'),
(4, 4, 'Ashbell Academy Ruins', 'Collapsed Magic School', 'A ruined academy where spells still attend class after all students died.', 'cursed teachers and dangerous spellcraft', 4, '{"clearDungeon":3}', '{"arc":"learn power always has tuition"}'),
(5, 5, 'Moon-Eaten Bazaar', 'Night Market Between Worlds', 'A moonlit market that sells names, memories, monster organs, and impossible exits.', 'contracts and cursed bargains', 5, '{"clearDungeon":4}', '{"arc":"decide what parts of the soul can be traded"}'),
(6, 6, 'Iron Orchard Dominion', 'Mechanical War Garden', 'A garden of metal fruit and root-grown soldiers marching under machine hymns.', 'living machines and war ecology', 6, '{"clearDungeon":5}', '{"arc":"fight a kingdom that grows weapons like trees"}'),
(7, 7, 'Saintless Cathedral', 'Godless Holy Citadel', 'A cathedral without a god, defended by angels who forgot mercy but remember law.', 'faith, holy lies, and judgment', 7, '{"clearDungeon":6}', '{"arc":"face the difference between guilt and sin"}'),
(8, 8, 'Demon-Seal Archipelago', 'Chain of Prison Islands', 'Black islands chained together over a storm sea where sealed demon clans bargain for release.', 'curses, ocean trials, and demon inheritance', 8, '{"clearDungeon":7}', '{"arc":"decide which monsters deserve freedom"}'),
(9, 9, 'Chronicle Labyrinth', 'Library That Rewrites Time', 'A library maze where every book is a life the soul could have lived.', 'memory, erased companions, and false endings', 9, '{"clearDungeon":8}', '{"arc":"protect identity from rewritten history"}'),
(10, 10, 'Throne of the Previous Self', 'Legacy Realm', 'A realm built from every victory and failure, ending before the strongest completed self.', 'legacy, self-judgment, and final reincarnation', 10, '{"clearDungeon":9}', '{"arc":"defeat or understand the self that came before"}');

INSERT INTO dungeon_floors (id, dungeon_id, floor_number, floor_name, floor_type, purpose_type, description, atmosphere, enemies_available_json, npcs_available_json, hidden_events_json, story_purpose, quiet_chapter_allowed, floor_memory_json, boss_rules_json) VALUES
(101, 1, 1, 'Rain-Birth Clearing', 'story', 'introduction', 'The place where new bodies wake beneath a crimson sky.', 'wet soil, distant growls, and the first panic of rebirth', '["Ashhide Wolf","Root Gnawer"]', '["Liora Thorn"]', '["first_soul_echo"]', 'Teach immediate survival.', 0, '{}', '{}'),
(102, 1, 2, 'Lantern-Moss Path', 'story', 'mystery', 'A glowing path where moss reacts to remembered fear.', 'quiet green light under black branches', '["Moss Leech","Hollow Stag"]', '["Old Signkeeper"]', '["moss_records_previous_death"]', 'Reveal that the world notices the soul.', 1, '{}', '{}'),
(103, 1, 3, 'Broken Hunter Camp', 'story', 'npc_decision', 'A ruined camp where survivors argue over abandoning the wounded.', 'smoke, blood, and whispered blame', '["Carrion Imp"]', '["Liora Thorn","Hale the Coward"]', '["wounded_merchant_choice"]', 'Force a moral decision with consequences.', 0, '{}', '{}'),
(104, 1, 4, 'Thorn Trial Rise', 'story', 'intense_challenge', 'A steep rise where the forest tests fear with moving thorns.', 'branches breathing like lungs', '["Thornback Brute","Ashhide Wolf Pack"]', '[]', '["thorn_maze_shortcut"]', 'Build tension before the first boss.', 0, '{}', '{}'),
(105, 1, 5, 'Heartroot Den', 'boss', 'boss', 'The pulsing root chamber beneath Cradlewood.', 'sap, heartbeat, and hunger under bark', '[]', '["Liora Thorn"]', '["root_memory_of_choice"]', 'Defeat the hunger that tracks new souls.', 0, '{}', '{"boss":"Mawroot"}'),
(201, 2, 1, 'Silkfall Descent', 'story', 'introduction', 'A shaft of shining webs descending into a predator kingdom.', 'glittering threads and distant clicking', '["Glassling Spider","Thread-Bitten Bat"]', '["Nessa of the Third Eye"]', '["web_reads_body_heat"]', 'Introduce vertical dungeon movement.', 0, '{}', '{}'),
(202, 2, 2, 'Mirror Egg Gallery', 'story', 'puzzle', 'Eggs reflect possible evolutions instead of faces.', 'silver sacs and reflections that breathe', '["Mirror Larva"]', '[]', '["false_evolution_offer"]', 'Make the player solve identity temptation.', 1, '{}', '{}'),
(203, 2, 3, 'The Molting Court', 'story', 'moral_decision', 'Spider nobles decide whether weak hatchlings should be eaten.', 'formal cruelty beneath silk banners', '["Silk Duelist"]', '["Nessa of the Third Eye","Chancellor Vex"]', '["save_or_exploit_hatchlings"]', 'Test mercy inside monster law.', 0, '{}', '{}'),
(204, 2, 4, 'Thread-Cut Bridge', 'story', 'mini_boss', 'A bridge where every cut strand changes the battlefield.', 'tensioned glass silk over endless dark', '["Bridge Widow"]', '[]', '["bridge_can_be_rewoven"]', 'Introduce tactical environmental combat.', 0, '{}', '{}'),
(205, 2, 5, 'Queen Web Crucible', 'boss', 'boss', 'A throne web spun around bones of failed challengers.', 'royal patience and sweet venom', '[]', '["Nessa of the Third Eye"]', '["queen_remembers_saved_hatchlings"]', 'Face the ruler of the hollows.', 0, '{}', '{"boss":"Velratha"}'),
(301, 3, 1, 'Mudgate Hamlet', 'story', 'introduction', 'A drowned village used as the principality border.', 'flies, bells, and sinking houses', '["Bog Mutt","Mireling"]', '["Pip of the Reed Knife"]', '["hamlet_secret_tunnel"]', 'Introduce monster civilization.', 1, '{}', '{}'),
(302, 3, 2, 'Oath-Reed Maze', 'story', 'mystery', 'Reeds repeat promises the player never made.', 'green fog and whispering oaths', '["Oath Eel"]', '[]', '["broken_oath_memory"]', 'Reveal promises can become magic.', 0, '{}', '{}'),
(303, 3, 3, 'Rot-Crown Court', 'story', 'npc_decision', 'A goblin court demands the player accuse a traitor.', 'perfume over rot and knives under silk', '["Court Sneak"]', '["Pip of the Reed Knife","Lady Murkla"]', '["choose_traitor_or_question_law"]', 'Make politics dangerous.', 0, '{}', '{}'),
(304, 3, 4, 'Swamp Duel Causeway', 'story', 'intense_challenge', 'A narrow road where honor and ambush share the same mud.', 'rain, drums, and watching lanterns', '["Crown Duelist","Bog Mutt Pack"]', '[]', '["duel_can_be_refused"]', 'Build the prince conflict.', 0, '{}', '{}'),
(305, 3, 5, 'Rot-Crown Throne', 'boss', 'boss', 'A throne room sinking one inch every year.', 'royal rot and desperate pride', '[]', '["Pip of the Reed Knife"]', '["prince_respects_honor"]', 'Defeat or shame the swamp prince.', 0, '{}', '{"boss":"Gorrik"}'),
(401, 4, 1, 'Rollcall Hall', 'story', 'introduction', 'A classroom that marks attendance for the dead.', 'chalk dust and invisible students', '["Chalk Wraith"]', '["Mira Bellwisp"]', '["name_written_on_board"]', 'Introduce cursed learning.', 0, '{}', '{}'),
(402, 4, 2, 'Formula Stair', 'story', 'puzzle', 'A stairway that only moves when spells are understood.', 'floating equations and falling ash', '["Equation Imp"]', '[]', '["wrong_answer_summons_detention"]', 'Test puzzle reasoning.', 0, '{}', '{}'),
(403, 4, 3, 'Dormitory of Last Letters', 'story', 'quiet', 'Rooms filled with letters students never sent.', 'quiet beds, sealed envelopes, and grief', '[]', '["Mira Bellwisp"]', '["read_or_respect_letters"]', 'Create a quiet chapter.', 1, '{}', '{}'),
(404, 4, 4, 'Detention Furnace', 'story', 'mini_boss', 'A furnace where failed students became ash servants.', 'heat, bells, and punishment', '["Ash Prefect"]', '[]', '["free_ash_students"]', 'Escalate academy cruelty.', 0, '{}', '{}'),
(405, 4, 5, 'Headmaster Office', 'boss', 'boss', 'An office where every wall is a report card.', 'authority, firelight, and old shame', '[]', '["Mira Bellwisp"]', '["headmaster_knows_learned_spell"]', 'Confront the cursed teacher.', 0, '{}', '{"boss":"Cindervane"}'),
(501, 5, 1, 'Coinless Gate', 'story', 'introduction', 'The market entrance where prices are paid in secrets.', 'lanterns, masks, and hungry shop signs', '["Price Moth"]', '["Sable Quill"]', '["first_free_bargain_is_not_free"]', 'Introduce contract danger.', 0, '{}', '{}'),
(502, 5, 2, 'Name-Eater Alley', 'story', 'mystery', 'A backstreet where stolen names crawl on walls.', 'wet stone and whispering signatures', '["Name Rat"]', '[]', '["recover_lost_name"]', 'Create identity stakes.', 0, '{}', '{}'),
(503, 5, 3, 'Memory Auction', 'story', 'moral_decision', 'Memories are sold to bidders who never lived them.', 'polite applause and silent crying', '[]', '["Sable Quill","Auctioneer Vonn"]', '["buy_or_destroy_memory"]', 'Force a soul-price decision.', 0, '{}', '{}'),
(504, 5, 4, 'Cursed Vault Row', 'story', 'intense_challenge', 'A row of shops where items choose owners violently.', 'gold dust and threats in velvet', '["Vault Mimic","Contract Hound"]', '[]', '["item_tests_player"]', 'Offer risky power.', 0, '{}', '{}'),
(505, 5, 5, 'Lantern Row Basilica', 'boss', 'boss', 'A chapel of debt receipts and moonlit chains.', 'holy accounting and cold silver', '[]', '["Sable Quill"]', '["boss_counts_every_bargain"]', 'Face the saint of debts.', 0, '{}', '{"boss":"Debt Saint"}'),
(601, 6, 1, 'Ironseed Rows', 'story', 'introduction', 'Fields of metal fruit growing from buried helmets.', 'rust blossoms and marching bees', '["Gear Wasp","Iron Sprout"]', '["Toma Rivet"]', '["fruit_contains_war_memory"]', 'Introduce machine ecology.', 0, '{}', '{}'),
(602, 6, 2, 'Gear Irrigation Canal', 'story', 'puzzle', 'Canals move oil like water through rotating locks.', 'black reflections and turning teeth', '["Canal Gearling"]', '[]', '["redirect_oil_flow"]', 'Solve machinery without brute force.', 0, '{}', '{}'),
(603, 6, 3, 'Soldier Nursery', 'story', 'moral_decision', 'Half-grown soldiers ask if being made for war is the same as wanting war.', 'greenhouse warmth and metal lullabies', '[]', '["Toma Rivet","Unit Sapling-44"]', '["free_or_arm_soldiers"]', 'Humanize artificial life.', 1, '{}', '{}'),
(604, 6, 4, 'Harvest Cannon Ridge', 'story', 'mini_boss', 'Cannons bloom from trees and fire seeds of shrapnel.', 'orchard wind and artillery thunder', '["Cannon Treant"]', '[]', '["turn_cannon_on_orchard"]', 'Escalate war garden danger.', 0, '{}', '{}'),
(605, 6, 5, 'Command Greenhouse', 'boss', 'boss', 'A glass command room where strategies grow on vines.', 'warm glass and merciless calculation', '[]', '["Toma Rivet"]', '["general_adapts_to_repeated_tactics"]', 'Defeat the orchard general.', 0, '{}', '{"boss":"Pomegranate-9"}'),
(701, 7, 1, 'Prayerless Nave', 'story', 'introduction', 'A nave where prayers echo but no god answers.', 'white stone and empty hymns', '["Choir Husk"]', '["Iria Vowless"]', '["statue_cries_salt"]', 'Introduce holy absence.', 0, '{}', '{}'),
(702, 7, 2, 'Confession Maze', 'story', 'mystery', 'A maze that opens only for honest guilt.', 'curtains, whispers, and locked shame', '["Sin Mote"]', '[]', '["confess_or_lie"]', 'Test truth without exposition.', 0, '{}', '{}'),
(703, 7, 3, 'Court of Unsaints', 'story', 'moral_decision', 'Judges sentence sinners for laws no god wrote.', 'silver masks and trembling defendants', '[]', '["Iria Vowless","Judge Caldrin"]', '["save_condemned_or_obey_law"]', 'Challenge holy authority.', 0, '{}', '{}'),
(704, 7, 4, 'Bell Tower Trial', 'story', 'intense_challenge', 'Each bell strike removes a remembered comfort.', 'height, wind, and punishing bells', '["Bell Seraph"]', '[]', '["silence_bell_with_memory"]', 'Raise emotional stakes.', 0, '{}', '{}'),
(705, 7, 5, 'Empty Halo Choir', 'boss', 'boss', 'A choir chamber around an angel with no god above it.', 'radiance without warmth', '[]', '["Iria Vowless"]', '["boss_judges_mercy_history"]', 'Face the empty halo.', 0, '{}', '{"boss":"Seraphel"}'),
(801, 8, 1, 'First Chain Island', 'story', 'introduction', 'A black island chained to the sea floor by demon law.', 'salt storm and iron links', '["Chain Crab","Brine Shade"]', '["Rook Emberfin"]', '["chain_whispers_true_names"]', 'Introduce demon prisons.', 0, '{}', '{}'),
(802, 8, 2, 'Tide-Glyph Reef', 'story', 'puzzle', 'Glyphs appear only between waves.', 'moonlit reef and drowning letters', '["Glyph Eel"]', '[]', '["read_glyph_before_tide"]', 'Use timing and observation.', 0, '{}', '{}'),
(803, 8, 3, 'Prison Clan Camp', 'story', 'npc_decision', 'Demon families ask which prisoner deserves release first.', 'campfires, horns, and old grudges', '[]', '["Rook Emberfin","Matron Zai"]', '["choose_prisoner_release"]', 'Complicate demon morality.', 1, '{}', '{}'),
(804, 8, 4, 'Storm Chain Crossing', 'story', 'mini_boss', 'A crossing where chains rise and fall with lightning.', 'storm spray and screaming iron', '["Chain Warden"]', '[]', '["ride_chain_or_cut_it"]', 'Build to the prison lord.', 0, '{}', '{}'),
(805, 8, 5, 'Tidebound Keep', 'boss', 'boss', 'A keep dragged through the sea by its prisoner king.', 'deep bells and chain hunger', '[]', '["Rook Emberfin"]', '["boss_offers_cursed_freedom"]', 'Confront chain-eating freedom.', 0, '{}', '{"boss":"Varrox"}'),
(901, 9, 1, 'Index of Possible Births', 'story', 'introduction', 'Shelves list every body the soul could have entered.', 'paper dust and unborn names', '["Index Wisp"]', '["Page, the Ink Familiar"]', '["find_rejected_body"]', 'Introduce alternate lives.', 1, '{}', '{}'),
(902, 9, 2, 'Footnote Maze', 'story', 'puzzle', 'Footnotes become corridors that contradict the main text.', 'ink trails and shifting grammar', '["Comma Imp"]', '[]', '["edit_path_with_truth"]', 'Puzzle with story logic.', 0, '{}', '{}'),
(903, 9, 3, 'Erased Companion Archive', 'story', 'quiet', 'Shelves preserve companions forgotten by previous deaths.', 'quiet pages and familiar grief', '[]', '["Page, the Ink Familiar"]', '["restore_forgotten_name"]', 'Quiet chapter about loss.', 1, '{}', '{}'),
(904, 9, 4, 'False Ending Stacks', 'story', 'intense_challenge', 'Books offer peaceful endings that trap readers forever.', 'warm lamps and dangerous comfort', '["Ending Lure"]', '[]', '["reject_perfect_ending"]', 'Test desire to stop fighting.', 0, '{}', '{}'),
(905, 9, 5, 'Unlived Life Vault', 'boss', 'boss', 'A vault where the archivist files souls that never chose.', 'silence, dust, and impossible biographies', '[]', '["Page, the Ink Familiar"]', '["boss_uses_player_history"]', 'Fight memory control.', 0, '{}', '{"boss":"Archivist Null"}'),
(1001, 10, 1, 'Hall of First Death', 'story', 'introduction', 'A hall replaying every beginning without letting the player look away.', 'rain, pavement, and dungeon stone', '["Regret Echo"]', '["All surviving companions"]', '["first_death_changes"]', 'Return to the origin.', 0, '{}', '{}'),
(1002, 10, 2, 'Gallery of Abandoned Bodies', 'story', 'mystery', 'Former avatars stand like statues, each missing the moment they died.', 'cold marble and borrowed faces', '["Body Husk"]', '[]', '["recover_body_memory"]', 'Make reincarnation physical.', 0, '{}', '{}'),
(1003, 10, 3, 'Council of Saved and Lost', 'story', 'moral_decision', 'Every major NPC consequence gathers into one impossible council.', 'voices from all journeys', '[]', '["Legacy witnesses"]', '["reckon_with_choices"]', 'Force history to speak.', 1, '{}', '{}'),
(1004, 10, 4, 'Mirror War Field', 'story', 'intense_challenge', 'The player fights echoes of repeated tactics.', 'mirrors, dust, and copied movements', '["Strategy Echo","Habit Wraith"]', '[]', '["counter_own_pattern"]', 'Prepare for the guardian.', 0, '{}', '{}'),
(1005, 10, 5, 'Throne of the Previous Self', 'boss', 'boss', 'The final throne where the last completed hero waits as a living legend.', 'all victories breathing at once', '[]', '["The Eternal Guardian"]', '["guardian_fights_like_player"]', 'Face the strongest self that ever lived.', 0, '{}', '{"boss":"Eternal Guardian"}');

INSERT INTO boss_profiles (dungeon_floor_id, boss_name, reason_for_existing, personality_json, entrance_text, defeat_text, dialogue_json, mechanics_json) VALUES
(105, 'Mawroot, the Hunger Under Bark', 'The forest grew a stomach to devour newly reincarnated souls before they learned too much.', '{"temper":"patient predator","flaw":"overconfident when prey panics"}', 'The roots pull away from the earth, revealing a mouth full of wooden teeth.', 'Mawroot collapses into seed-black ash, and the forest stops breathing for one full minute.', '["Little soul. Still warm from death.","Run if you want. Hunger enjoys the chase."]', '{"phases":["root snare","devour memory"],"weaknesses":["fire","stillness"],"rewards":["Heartroot Splinter"]}'),
(205, 'Silk-Mother Velratha', 'She preserves the Glassweb Hollows by deciding which children deserve to molt and which deserve to be eaten.', '{"temper":"elegant tyrant","flaw":"cannot understand mercy without ownership"}', 'A curtain of glass silk opens, and the queen descends without touching the floor.', 'Her crown web snaps strand by strand, sounding almost like applause.', '["Mercy is only hunger wearing perfume.","Show me the shape of your next body."]', '{"phases":["venom debate","web execution"],"weaknesses":["saved hatchlings","cut anchor threads"],"rewards":["Glassweb Spinneret"]}'),
(305, 'Prince Gorrik of the Rot-Crown', 'He inherited a sinking kingdom and believes cruelty is the only thing keeping it above the mud.', '{"temper":"proud and desperate","flaw":"needs witnesses to respect him"}', 'The swamp prince rises from his throne, crown dripping black water over one eye.', 'Gorrik kneels as the throne sinks behind him, still trying to look royal.', '["A crown is just a wound everyone agrees to obey.","Kneel, stranger, or teach me why I should."]', '{"phases":["court duel","mud command"],"weaknesses":["public shame","honorable refusal"],"rewards":["Rot-Crown Signet"]}'),
(405, 'Headmaster Cindervane', 'He burned the academy to keep one forbidden lesson from leaving the school.', '{"temper":"strict, ashamed, brilliant","flaw":"cannot admit his final lesson was fear"}', 'The office door opens by itself, and a chalk line writes your name under FAILED.', 'Cindervane turns to ash at his desk, leaving one passing grade behind.', '["Power without discipline is arson.","Class begins when survival ends."]', '{"phases":["detention fire","final examination"],"weaknesses":["learned spellcraft","student letters"],"rewards":["Cindervane Formula"]}'),
(505, 'The Debt Saint of Lantern Row', 'The Bazaar needed a holy figure to make exploitation feel righteous.', '{"temper":"soft-spoken collector","flaw":"bound by exact wording"}', 'Every lantern bows toward the chapel as a saint made of receipts steps down.', 'The saint smiles as the last unpaid debt burns blue.', '["All souls owe something.","Do not worry. I keep perfect accounts."]', '{"phases":["contract chains","interest of blood"],"weaknesses":["loopholes","destroyed memory deed"],"rewards":["Lantern Row Ledger"]}'),
(605, 'General Pomegranate-9', 'The orchard created a general to harvest wars before humans could start them.', '{"temper":"strategic and tender toward machines","flaw":"predicts patterns too literally"}', 'A fruit of red iron opens, and the general steps out already saluting your death.', 'Pomegranate-9 plants its sword and asks whether peace is also a command.', '["Your tactics have ripened.","I do not hate you. I have grown the correct response."]', '{"phases":["adaptive formation","harvest artillery"],"weaknesses":["unpredictable creativity","freed saplings"],"rewards":["Iron Orchard Core"]}'),
(705, 'Seraphel, the Empty Halo', 'An angel remained after its god vanished and turned obedience into worship.', '{"temper":"radiant, hollow, judgmental","flaw":"cannot judge mercy correctly"}', 'The empty halo turns, and every shadow in the cathedral kneels except yours.', 'Seraphel falls upward, leaving feathers that weigh more than stone.', '["Confess to the silence.","Mercy is disorder unless sanctioned."]', '{"phases":["holy verdict","halo rupture"],"weaknesses":["mercy history","honest confession"],"rewards":["Empty Halo Feather"]}'),
(805, 'Varrox Tidebound, Chain-Eater', 'He devoured prison chains for centuries, but freedom became another appetite.', '{"temper":"booming, wounded, seductive","flaw":"mistakes release for salvation"}', 'The sea rises into a throne, and Varrox bites through a chain thicker than a tower.', 'Varrox laughs as the storm leaves his body, finally quiet.', '["Break one chain and the next tastes sweeter.","Free me, little soul, or prove I am still a prisoner."]', '{"phases":["storm bite","curse bargain"],"weaknesses":["refusing bargain","true name glyph"],"rewards":["Tidebound Chain Fang"]}'),
(905, 'Archivist Null, Keeper of Unlived Lives', 'Null files away choices that souls were too afraid to make.', '{"temper":"calm, precise, lonely","flaw":"believes unlived lives are safer than real ones"}', 'A blank book opens, and the archivist reads your name from a page that has not been written.', 'Null closes its own book and discovers there is no title on the cover.', '["Every choice damages eternity.","Let me preserve the version of you that never suffered."]', '{"phases":["rewrite action","false ending"],"weaknesses":["remembered companions","rejected perfect ending"],"rewards":["Unlived Index Page"]}'),
(1005, 'The Eternal Guardian', 'The Dungeon keeps the completed hero as the final proof that every victory becomes a future enemy.', '{"temper":"mirrors previous player behavior","flaw":"inherits previous player weakness"}', 'A figure wearing your old legend steps down from the throne with your best weapon in hand.', 'The guardian lowers their weapon, and for a moment you understand why the Dungeon kept them.', '["I was you when winning still felt like escape.","Show me what the next life learned."]', '{"phases":["favorite weapon","signature skill","legacy desperation"],"weaknesses":["recorded behavior weakness","new soul growth"],"rewards":["Legacy Crown"]}');
