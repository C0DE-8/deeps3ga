-- Simplify active play to five dungeons with three authored floors each.
-- Authentication accounts remain; all game progress is reset for the new world.

ALTER TABLE floor_runtime_states
  ADD COLUMN IF NOT EXISTS floor_complete TINYINT(1) NOT NULL DEFAULT 0 AFTER story_decision_completed,
  ADD COLUMN IF NOT EXISTS exit_unlocked TINYINT(1) NOT NULL DEFAULT 0 AFTER floor_complete;

DELETE FROM legacy_heroes;
DELETE FROM soul_profiles;

DELETE FROM quests;
DELETE FROM story_threads;
DELETE FROM factions;
DELETE FROM world_story_chapters;
DELETE FROM world_npcs;
DELETE FROM world_monsters;
DELETE FROM boss_profiles;
DELETE FROM floor_story_beats;
DELETE FROM dungeon_floors;
DELETE FROM dungeons;

INSERT INTO dungeons
  (id, dungeon_number, name, place_kind, description, theme, difficulty, unlock_requirements_json, story_arc_json)
VALUES
  (1, 1, 'Crimson Wakewood', 'Living Rebirth Forest', 'A red-sky forest where newly reincarnated souls are hunted before they understand their bodies.', 'survival, rebirth, and the forest that tests fear', 1, '{}', '{"conflict":"Survive the Wakewood and learn why it marks reincarnated souls."}'),
  (2, 2, 'Glassweb Dominion', 'Subterranean Silk Kingdom', 'A vertical kingdom woven from glasslike silk where monsters enforce laws of hunger and rank.', 'predator politics, evolution, and mercy', 2, '{"completedDungeon":1}', '{"conflict":"Choose whether to break or change the Dominion law that consumes its weak."}'),
  (3, 3, 'Drowned Crown', 'Sunken Goblin Principality', 'A flooded court of oath-magic, rival houses, and villages sinking beneath a cursed crown.', 'promises, loyalty, and dangerous belonging', 3, '{"completedDungeon":2}', '{"conflict":"Resolve the crown succession before the principality drowns."}'),
  (4, 4, 'Ashbell Academy', 'Ruined School of Living Magic', 'A dead academy where lessons, punishments, and unfinished spells continue without their students.', 'knowledge, sacrifice, and magical consequence', 4, '{"completedDungeon":3}', '{"conflict":"End the lesson that feeds students to the academy furnace."}'),
  (5, 5, 'Throne of Echoes', 'Legacy Realm', 'A realm assembled from the soul''s remembered victories, failures, companions, and abandoned selves.', 'memory, identity, and self-judgment', 5, '{"completedDungeon":4}', '{"conflict":"Reach the throne and overcome the strongest legend the Dungeon can preserve."}');

INSERT INTO dungeon_floors
  (id, dungeon_id, floor_number, floor_name, floor_type, purpose_type, description, atmosphere, enemies_available_json, npcs_available_json, hidden_events_json, story_purpose, quiet_chapter_allowed, floor_memory_json, boss_rules_json)
VALUES
  (101,1,1,'Rain-Birth Clearing','story','introduction','The player awakens after a real-world death and must survive the first hunt.','cold rain, crimson clouds, and movement between black trees','["Ashhide Wolf Pack","Lantern Antler Stag"]','["Liora Thorn"]','["the first Soul Echo","a wounded creature fleeing a larger hunter"]','Establish reincarnation, location, immediate danger, and one conflict that must be survived or resolved.',0,'{}','{}'),
  (102,1,2,'Hunter''s Lantern Road','story','intense_challenge','A ruined road crosses camps where the forest turns fear and mistrust into traps.','blue lantern moss, abandoned packs, and branches that move against the wind','["Thornback Brute","Carrion Imp"]','["Mara Fenroot"]','["the hunters caused the attacks","a root-mark that opens the den"]','Resolve the wounded hunters quest, learn Mawroot''s weakness, and obtain access to its den.',0,'{}','{}'),
  (103,1,3,'Heartroot Den','boss','boss','The pulsing chamber beneath Wakewood where its first law of hunger has a voice.','sap like blood, roots like ribs, and a heartbeat underfoot','[]','["Liora Thorn"]','["Mawroot can be starved by breaking three feeding roots"]','Defeat, purify, or starve Mawroot and claim the Wakewood passage.',0,'{}','{"boss":"Mawroot, the First Hunger","alternativeVictory":"Break all three saved feeding anchors."}'),
  (201,2,1,'Silkfall Descent','story','introduction','The player descends through a city suspended on webs and interrupts a hatchling cull.','silver threads over an endless dark and distant ceremonial bells','["Glassling Swarm","Silk Duelist"]','["Nessa Third-Eye"]','["the condemned hatchlings can speak through thread-sign"]','Enter the Dominion, survive its hunters, and decide what to do with the condemned hatchlings.',0,'{}','{}'),
  (202,2,2,'Molting Court','story','moral_decision','The court offers safe passage in exchange for enforcing its cruel law.','silk banners, sweet venom incense, and nobles clicking behind masks','["Mirror Larva","Bridge Widow"]','["Chancellor Vex"]','["the queen fears uncontrolled evolution","a hidden path beneath the egg gallery"]','Resolve the hatchling judgment and discover a route or leverage against Queen Velratha.',0,'{}','{}'),
  (203,2,3,'Queen Web Crucible','boss','boss','A throne-web turns every movement into a weapon for the patient queen.','glittering strands, suspended bones, and venom rain','[]','["Nessa Third-Eye"]','["Velratha may surrender if the court publicly rejects the hunger law"]','Defeat Queen Velratha or force a database-backed surrender from her court.',0,'{}','{"boss":"Queen Velratha","alternativeVictory":"Complete the court rebellion and save the marked hatchlings."}'),
  (301,3,1,'Mudgate Hamlet','story','introduction','A sinking border village asks the player to choose which oath will protect it.','warm rain, reed bells, and homes settling into black water','["Bog Mutt Pack","Oath Eel"]','["Pip Reedknife"]','["the flood follows broken royal promises"]','Protect Mudgate from the first flood assault and learn the terms of oath-magic.',0,'{}','{}'),
  (302,3,2,'Rot-Crown Court','story','npc_decision','Rival heirs demand testimony while assassins and floodwater close in.','perfume over rot, knives under silk, and water climbing the throne steps','["Crown Duelist","Mire Doppel"]','["Lady Murkla"]','["the crown itself is the flood anchor","Pip carries the missing oath"]','Resolve the succession quest and establish how the Rot Crown can be challenged.',0,'{}','{}'),
  (303,3,3,'Sinking Throne','boss','boss','Prince Gorrik wears the cursed crown as the court sinks around him.','war drums beneath water and green fire along the walls','[]','["Pip Reedknife"]','["Gorrik can be freed if the original oath is restored before the crown consumes him"]','Defeat Prince Gorrik or restore the original oath and separate him from the crown.',0,'{}','{"boss":"Prince Gorrik of the Rot Crown","alternativeVictory":"Restore the saved founding oath and remove the crown."}'),
  (401,4,1,'Rollcall Hall','story','introduction','The academy records the player as a late student and assigns a lesson that kills failures.','chalk dust, empty desks, and bells ringing without hands','["Chalk Wraiths","Equation Imp"]','["Mira Bellwisp"]','["erased names answer from inside the walls"]','Survive rollcall, protect another student, and learn the academy''s lethal rules.',0,'{}','{}'),
  (402,4,2,'Detention Furnace','story','puzzle','The player must recover an erased formula while the furnace hunts anyone carrying forbidden knowledge.','white heat, floating equations, and ash shaped like children','["Ash Prefect","Living Formula"]','["Professor Nym Vellum"]','["the furnace is powered by the headmaster''s unfinished examination"]','Complete the erased lesson quest and establish a way through the headmaster''s examination.',0,'{}','{}'),
  (403,4,3,'Headmaster''s Final Lesson','boss','boss','Headmaster Cinder writes attacks as equations and changes the arena when an answer is wrong.','burning blackboards, falling pages, and a bell counting failures','[]','["Mira Bellwisp"]','["the lesson can end if its unsolvable premise is proven false"]','Defeat Headmaster Cinder or prove the final lesson invalid using discovered evidence.',0,'{}','{"boss":"Headmaster Cinder","alternativeVictory":"Complete the proof that the final lesson has no valid solution."}'),
  (501,5,1,'Gallery of Forgotten Lives','story','introduction','Past bodies appear in portraits that offer power in exchange for replacing the present self.','footsteps with no owners and frames whispering old names','["Memory Mimic","Regret Knight"]','["Aster the Uncrowned"]','["one portrait remembers a completed hero","a false memory hides the safe road"]','Cross the gallery without surrendering identity and identify the memory that controls the path.',0,'{}','{}'),
  (502,5,2,'Road of Unmade Choices','story','mystery','Every abandoned decision becomes a living obstacle or a possible ally.','roads folding into one another beneath an eclipsed moon','["Could-Have-Been Legion","Soul Archivist"]','["The Nameless Witness"]','["accepting a failure weakens the throne","a companion memory opens the final gate"]','Resolve the soul archive and prepare a truthful answer to the final legend.',1,'{}','{}'),
  (503,5,3,'Throne of the Strongest Self','boss','boss','The final arena loads the saved legacy or the Dungeon''s first guardian when no legacy exists.','a black throne, reflected battlefields, and every old wound remembered','[]','["Aster the Uncrowned"]','["the guardian fights from saved habits and may yield only to an established identity victory"]','Win the final multi-turn confrontation and complete the five-dungeon cycle.',0,'{}','{"boss":"The Echo Sovereign","finalBoss":true,"alternativeVictory":"Complete the saved identity trial and cause the guardian to yield."}');

INSERT INTO world_npcs
  (id,name,race,personality_json,backstory,current_dungeon_id,current_floor_id,dialogue_json,relationship_with_player_json,quest_status,life_status)
VALUES
  (1,'Liora Thorn','Human','{"traits":["guarded","brave"]}','A hunter who has watched too many new souls die.',1,101,'["If you want to live, move before the trees decide for you."]','{}','available','alive'),
  (2,'Mara Fenroot','Bog Witch','{"traits":["blunt","protective"]}','A healer blamed for the Wakewood curse.',1,102,'["The forest is hungry, but hunger still follows rules."]','{}','available','alive'),
  (3,'Liora Thorn','Human','{"traits":["loyal","wary"]}','She follows only if earlier trust was earned.',1,103,'["Whatever it says, remember what it has eaten."]','{}','none','alive'),
  (4,'Nessa Third-Eye','Araknine','{"traits":["curious","rebellious"]}','A court seer hiding condemned hatchlings.',2,201,'["Mercy is illegal here. That does not make it impossible."]','{}','available','alive'),
  (5,'Chancellor Vex','Araknine','{"traits":["formal","calculating"]}','The queen''s minister and keeper of hunger law.',2,202,'["Civilization is merely appetite with witnesses."]','{}','available','alive'),
  (6,'Nessa Third-Eye','Araknine','{"traits":["defiant","observant"]}','She knows where the queen''s web is weakest.',2,203,'["Pull the silver strand when she begins to molt."]','{}','none','alive'),
  (7,'Pip Reedknife','Goblin','{"traits":["quick","loyal"]}','A courier carrying the principality''s missing oath.',3,301,'["A promise can drown you faster than water."]','{}','available','alive'),
  (8,'Lady Murkla','Goblin','{"traits":["proud","pragmatic"]}','A claimant trying to save a court that distrusts her.',3,302,'["Find me a truth the crown cannot twist."]','{}','available','alive'),
  (9,'Pip Reedknife','Goblin','{"traits":["terrified","steadfast"]}','He brings the founding oath to the sinking throne.',3,303,'["Say the words with me, or draw your weapon."]','{}','none','alive'),
  (10,'Mira Bellwisp','Spirit','{"traits":["gentle","stubborn"]}','The last student who still remembers her name.',4,401,'["Do not answer when the bell calls a name that is not yours."]','{}','available','alive'),
  (11,'Professor Nym Vellum','Living Book','{"traits":["precise","remorseful"]}','A teacher who erased a lesson to save his class.',4,402,'["Knowledge is not innocent, but neither is ignorance."]','{}','available','alive'),
  (12,'Mira Bellwisp','Spirit','{"traits":["hopeful","afraid"]}','She enters the final lesson beside the player.',4,403,'["Let this be the first lesson someone survives."]','{}','none','alive'),
  (13,'Aster the Uncrowned','Soul Echo','{"traits":["patient","honest"]}','A guide assembled from lives that refused the throne.',5,501,'["Every portrait tells the truth it needs you to believe."]','{}','available','alive'),
  (14,'The Nameless Witness','Unknown','{"traits":["quiet","mercilessly truthful"]}','The keeper of choices the soul abandoned.',5,502,'["You cannot take every road. You can remember why you chose."]','{}','available','alive'),
  (15,'Aster the Uncrowned','Soul Echo','{"traits":["resolute","compassionate"]}','The final witness to the soul''s answer.',5,503,'["Strength without memory is only repetition."]','{}','none','alive');

INSERT INTO world_monsters
  (name,species,stats_json,skills_json,loot_json,behavior_json,habitat_dungeon_id,habitat_floor_id)
VALUES
  ('Ashhide Wolf Pack','Cinder Wolf','{"hp":32,"attack":7,"defense":3}','["Pack Feint","Ash Bite"]','["Ashhide"]','{"canFlee":true,"motive":"protect hunting ground"}',1,101),
  ('Lantern Antler Stag','Woundlight Beast','{"hp":24,"attack":4,"defense":2}','["Lantern Flash"]','["Luminous Antler Shard"]','{"canFlee":true,"motive":"escape the larger hunter"}',1,101),
  ('Thornback Brute','Root Ogre','{"hp":48,"attack":10,"defense":7}','["Bark Rush","Thorn Sweep"]','["Heartwood Plate"]','{"canFlee":false,"weakness":"split armor beneath left shoulder"}',1,102),
  ('Carrion Imp','Dusk Imp','{"hp":18,"attack":6,"defense":1}','["Blood Scent"]','["Imp Wing"]','{"canFlee":true,"motive":"steal medicine"}',1,102),
  ('Glassling Swarm','Glass Spider','{"hp":38,"attack":9,"defense":4}','["Mirror Web"]','["Glass Silk"]','{"canFlee":true,"motive":"capture warm bodies"}',2,201),
  ('Silk Duelist','Araknine Soldier','{"hp":44,"attack":11,"defense":6}','["Thread Lunge"]','["Duelist Fang"]','{"canFlee":false,"motive":"enforce court law"}',2,201),
  ('Mirror Larva','Mimic Larva','{"hp":35,"attack":8,"defense":5}','["Borrowed Shape"]','["Mirror Husk"]','{"canFlee":true,"motive":"copy useful forms"}',2,202),
  ('Bridge Widow','Abyss Spider','{"hp":58,"attack":13,"defense":7}','["Cut the Bridge","Venom Rain"]','["Widow Venom"]','{"canFlee":false,"weakness":"weight-bearing silver thread"}',2,202),
  ('Bog Mutt Pack','Mire Hound','{"hp":50,"attack":12,"defense":6}','["Mud Ambush"]','["Bog Fang"]','{"canFlee":true,"motive":"defend the flood gate"}',3,301),
  ('Oath Eel','Promise Eater','{"hp":36,"attack":10,"defense":4}','["Broken Word"]','["Oath Scale"]','{"canFlee":true,"motive":"feed on lies"}',3,301),
  ('Crown Duelist','Goblin Knight','{"hp":62,"attack":15,"defense":10}','["Royal Riposte"]','["Court Blade"]','{"canFlee":false,"motive":"protect claimant"}',3,302),
  ('Mire Doppel','Swamp Mimic','{"hp":46,"attack":13,"defense":7}','["Borrowed Voice"]','["Mire Core"]','{"canFlee":true,"motive":"replace a witness"}',3,302),
  ('Chalk Wraiths','Classroom Dead','{"hp":58,"attack":14,"defense":8}','["Erase Name"]','["Ghost Chalk"]','{"canFlee":false,"motive":"complete rollcall"}',4,401),
  ('Equation Imp','Formula Fiend','{"hp":42,"attack":12,"defense":5}','["False Solution"]','["Living Ink"]','{"canFlee":true,"motive":"cause a failed answer"}',4,401),
  ('Ash Prefect','Furnace Warden','{"hp":72,"attack":18,"defense":12}','["Detention Bell","Ash Command"]','["Prefect Seal"]','{"canFlee":false,"weakness":"erased command phrase"}',4,402),
  ('Living Formula','Arcane Construct','{"hp":54,"attack":16,"defense":9}','["Variable Body"]','["Formula Fragment"]','{"canFlee":true,"motive":"finish itself"}',4,402),
  ('Memory Mimic','Soul Parasite','{"hp":68,"attack":17,"defense":11}','["Stolen Childhood"]','["Memory Glass"]','{"canFlee":true,"motive":"replace identity"}',5,501),
  ('Regret Knight','Unlived Hero','{"hp":82,"attack":21,"defense":14}','["Road Not Taken"]','["Unmade Steel"]','{"canFlee":false,"motive":"prove its life was better"}',5,501),
  ('Could-Have-Been Legion','Choice Echoes','{"hp":90,"attack":22,"defense":13}','["Many Roads"]','["Choice Shard"]','{"canFlee":false,"weakness":"accepted regret"}',5,502),
  ('Soul Archivist','Memory Golem','{"hp":76,"attack":19,"defense":16}','["Seal Memory","Index Soul"]','["Archive Key"]','{"canFlee":true,"motive":"preserve every choice without consent"}',5,502);

INSERT INTO boss_profiles
  (dungeon_floor_id,boss_name,reason_for_existing,personality_json,entrance_text,defeat_text,dialogue_json,mechanics_json)
VALUES
  (103,'Mawroot, the First Hunger','It consumes new souls to keep the Wakewood alive.','{"traits":["ancient","possessive"]}','The roots pull apart like jaws, and the forest speaks through them.','The heartbeat beneath the soil finally misses a beat.','["Every soul wakes owing the forest a body."]','{"phases":3,"weakness":"feeding roots","alternativeVictoryKey":"wakewood-feeding-anchors"}'),
  (203,'Queen Velratha','She preserves the Dominion by turning hunger into law.','{"traits":["patient","ruthless"]}','A hundred threads tighten as the queen descends without touching the floor.','The royal web falls slack across the bones beneath it.','["Mercy is a luxury paid for by someone else''s hunger."]','{"phases":3,"weakness":"silver throne strands","alternativeVictoryKey":"glassweb-court-rebellion"}'),
  (303,'Prince Gorrik of the Rot Crown','The cursed crown keeps him ruling while drowning everything he loves.','{"traits":["proud","desperate"]}','Gorrik rises as black water pours from the crown instead of blood.','The crown strikes the stone, and the flood begins to retreat.','["If I release it, my people lose their king. If I keep it, they lose their homes."]','{"phases":3,"weakness":"founding oath","alternativeVictoryKey":"drowned-crown-oath-restored"}'),
  (403,'Headmaster Cinder','His final lesson consumes students to prove magic demands sacrifice.','{"traits":["brilliant","fanatical"]}','The headmaster writes the player''s death across the burning board.','The final bell rings once, then cracks in the silence.','["A lesson without a cost is merely entertainment."]','{"phases":4,"weakness":"false premise","alternativeVictoryKey":"ashbell-proof-complete"}'),
  (503,'The Echo Sovereign','The Dungeon gives the strongest remembered self a throne and orders it to stop the next one.','{"traits":["adaptive","intimate","unyielding"]}','A familiar figure rises wearing every victory the soul still envies.','The throne remembers the answer even after its guardian falls.','["I am not your future. I am the proof that you once stopped changing."]','{"phases":4,"legacyEnabled":true,"alternativeVictoryKey":"echo-identity-trial"}');

INSERT INTO quests
  (quest_key,name,description,giver_npc_id,dungeon_id,floor_id,objectives_json,rewards_json,consequence_rules_json,overlap_json)
VALUES
  ('wakewood-wounded-truth','What Hunts the Wounded','Save or question the wounded hunters and learn what drives Wakewood creatures onto the road.',2,1,102,'{"requiredFacts":["hunter-cause","mawroot-weakness"],"required":2}','{"xp":75,"gold":25}','{"failure":"The boss receives an additional feeding root."}','{}'),
  ('glassweb-hatchlings','Children of the Molting Court','Determine the fate of the condemned hatchlings and obtain leverage against the queen.',5,2,202,'{"requiredFacts":["hatchling-verdict","queen-leverage"],"required":2}','{"xp":110,"gold":40}','{"failure":"The court reinforces the queen."}','{}'),
  ('drowned-founding-oath','The Promise Beneath the Crown','Recover the founding oath and choose which claimant hears it.',8,3,302,'{"requiredFacts":["oath-found","claimant-choice"],"required":2}','{"xp":150,"gold":60}','{"failure":"The flood rises in the boss arena."}','{}'),
  ('ashbell-erased-lesson','The Lesson That Refused to Burn','Recover the erased formula and prove why the headmaster removed it.',11,4,402,'{"requiredFacts":["formula-found","premise-understood"],"required":2}','{"xp":200,"gold":80}','{"failure":"The furnace learns the player''s magic."}','{}'),
  ('echo-soul-archive','A Name Outside the Throne','Recover the soul''s truthful history without accepting a false perfect life.',14,5,502,'{"requiredFacts":["false-memory-exposed","identity-answer"],"required":2}','{"xp":300,"gold":120,"soulEnergy":50}','{"failure":"The final guardian gains a copied habit."}','{}');

INSERT INTO floor_story_beats
  (floor_id,beat_number,beat_type,title,narrative_seed,required_signatures_json,available_choices_json,consequence_keys_json)
SELECT id,1,
       CASE WHEN floor_number = 1 THEN 'arrival' WHEN floor_number = 2 THEN 'discovery' ELSE 'climax' END,
       floor_name,
       CONCAT(description, ' Current objective: ', story_purpose),
       '[]','[]','[]'
FROM dungeon_floors;

INSERT INTO factions (faction_key,name,description,dungeon_id) VALUES
  ('WAKEWOOD_DENIZENS','Wakewood Survivors','Hunters, healers, and creatures trapped beneath the crimson sky.',1),
  ('GLASSWEB_COURT','Glassweb Court','Nobles and rebels bound by the Dominion hunger law.',2),
  ('DROWNED_HOUSES','Drowned Houses','Rival families trying to survive the cursed succession.',3),
  ('ASHBELL_REMAINS','Ashbell Remains','Teachers, students, and spells that outlived the academy.',4),
  ('ECHO_WITNESSES','Echo Witnesses','Memories that judge whether the soul still owns its identity.',5);
