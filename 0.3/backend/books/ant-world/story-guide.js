const antWorldMetadata = {
  slug: "ant-world",
  title: "The Ant World: The King's Soul",
  bookNumber: 1,
  world: "Eldara",
  status: "active",
  genre: ["Fantasy", "Reincarnation", "Evolution", "War", "Mystery", "Adventure"],
  description: "A dead human awakens as an ant larva in Eldara, where a strange colony disturbance leads toward an ancient chamber, a dying Soul Seed, and the mystery of a vanished Ant King."
};

const privateCanon = {
  world: "Eldara",
  civilizations: ["Ants", "Spiders", "Bees", "Beetles", "Scorpions", "Grasshoppers", "Butterflies", "Flies", "Mosquitoes"],
  centralCanon: [
    "The First King united the great ant civilizations and prevented an ancient war from destroying Eldara.",
    "The First King possessed Royal Soul Resonance, an abnormal connection to the world's soul energy.",
    "The Grand Insect Tournament is part of an ancient soul-energy collection mechanism.",
    "The First King tried to destroy the mechanism, failed, fractured his soul, created a sanctuary, and hid safeguards.",
    "The protagonist is not the Ant King reincarnated in a simple sense.",
    "The protagonist is the beginning of the Ant King's next existence while remaining their own person."
  ],
  antagonistTruth: {
    name: "The Hollow Sovereign",
    publicTiming: "late Book I",
    truth: "An ancient consciousness that cannot naturally create life, so it consumes, redirects, and combines soul energy to build a perfect vessel.",
    relationshipToKing: "The First King discovered the Hollow Sovereign's system, which led to his disappearance.",
    relationshipToProtagonist: "The protagonist carries the beginning of the resonance the Hollow Sovereign wanted from the King."
  },
  laws: [
    "AI = GAME MASTER",
    "STORY GUIDE = CANON",
    "PLAYER = PROTAGONIST",
    "ENGINE = REALITY",
    "Player action is an attempt, not reality.",
    "No plot armor.",
    "No random power.",
    "No future spoilers."
  ],
  coreStory: {
    model: "One fixed canon spine, infinite possible player journeys.",
    fixedCanon: [
      "A human dies and reincarnates as an ant larva.",
      "The colony contains forgotten royal history beneath its current life.",
      "The Soul Seed is one remnant left behind when the First King's soul was deliberately divided.",
      "In Chapter 3, the chamber opens and the Soul Seed awakens.",
      "Royal Soul Resonance connects the protagonist to ancient royal soul architecture.",
      "The Grand Insect Tournament secretly harvests soul energy.",
      "The Great War is manipulated to generate unstable soul energy.",
      "The Hollow Sovereign is the hidden intelligence behind the ancient system.",
      "The protagonist remains themselves and resolves the King's legacy through their own choices."
    ],
    flexibleJourneys: [
      "Analytical players may reach canon through pheromones, symbols, clues, and deduction.",
      "Fearful or attached players may reach canon through protection, evacuation, separation, rescue, and worker relationships.",
      "Aggressive players may reach canon through guards, wounds, failed violence, survival, and dangerous attention.",
      "Passive or unusual players may reach canon by being carried, overlooked, displaced, protected, or caught in colony movement."
    ],
    narratorInstruction: "The Story Guide defines what must eventually happen and what must not happen yet. It never requires a specific player action, route, branch, or menu choice."
  },
  chapterArc: [
    { chapter: 1, title: "The Smallest Soul", endpoint: "I am an ant." },
    { chapter: 2, title: "Under the Earth", endpoint: "Something about my world is wrong." },
    { chapter: 3, title: "The Soul Below", endpoint: "My reincarnation is not an accident." },
    { chapter: 4, title: "The King Who Disappeared", endpoint: "The Ant King disappeared for a reason." },
    { chapter: 5, title: "The Grand Insect Tournament", endpoint: "The world is hiding something." },
    { chapter: 6, title: "The Soul That Should Not Exist", endpoint: "I am connected to the King's legacy." },
    { chapter: 7, title: "The War of Many Wings", endpoint: "The conflict is being manipulated." },
    { chapter: 8, title: "The Broken Kingdom", endpoint: "The world is collapsing." },
    { chapter: 9, title: "The Sanctuary", endpoint: "The King prepared for my existence." },
    { chapter: 10, title: "The Truth of the Tournament", endpoint: "Soul energy is being harvested." },
    { chapter: 11, title: "The Hollow Sovereign", endpoint: "There is an ancient intelligence behind it." },
    { chapter: 12, title: "The King's Last Memory", endpoint: "I am not the King. I am his continuation." },
    { chapter: 13, title: "The Last War", endpoint: "Everything converges." },
    { chapter: 14, title: "The Soul of the King", endpoint: "I decide what I become." },
    { chapter: 15, title: "The King's Soul", endpoint: "The final evolution and fate of Eldara." }
  ],
  futureTruths: [
    "Royal Soul Resonance connects the player to the vanished Ant King.",
    "The Grand Insect Tournament collects soul energy.",
    "The Great War is tied to ancient manipulation.",
    "The player is the beginning of the King's next existence but remains themselves.",
    "Final evolution and ending are resolved from the whole run."
  ]
};

const startingState = {
  run: {
    currentChapter: 1,
    currentScene: "awakening",
    storyBeat: "death_memory"
  },
  character: {
    species: "Ant",
    lifeStage: "Larva",
    level: 1,
    experience: 0,
    experienceToNext: 100,
    healthCurrent: 8,
    healthMax: 8,
    manaCurrent: 3,
    manaMax: 3,
    manaKnown: false,
    conditionText: "Newly awakened, helpless, and disoriented.",
    evolutionState: { eligible: false, currentPathHints: [], lastEvaluation: "Too early for evolution." },
    location: "Ant Nursery",
    territory: "Central Ant Colony",
    humanMemoriesRetained: true,
    physicalDevelopment: 0,
    combatDevelopment: 0,
    magicDevelopment: 0,
    analysisDevelopment: 0,
    leadershipDevelopment: 0,
    supportDevelopment: 0,
    survivalDevelopment: 1,
    scoutingDevelopment: 0,
    predatorDevelopment: 0,
    soulDevelopment: 1
  },
  discoveries: [
    {
      key: "human-death-memory",
      title: "A Human Death",
      content: "You remember being human, dying, and waking again in a body that is not human."
    }
  ],
  relationships: [
    {
      targetType: "npc",
      targetKey: "queen-elysra",
      displayName: "Queen Elysra",
      trust: 0,
      fear: 0,
      respect: 0,
      loyalty: 0,
      hostility: 0,
      notes: "The Queen has not yet personally examined the larva."
    },
    {
      targetType: "faction",
      targetKey: "ant-empire",
      displayName: "Ant Empire",
      trust: 0,
      fear: 0,
      respect: 0,
      loyalty: 10,
      hostility: 0,
      notes: "The colony is home, but the protagonist barely understands it."
    }
  ],
  worldState: [
    { key: "ant_colony", value: { military: "guarded", resources: "strained but stable", nurserySecurity: "normal", queenAlert: false }, visibility: "engine" },
    { key: "war_state", value: { greatWarStarted: false, tensions: "distant" }, visibility: "engine" },
    { key: "tournament_state", value: { announced: false, soulEnergyKnown: false }, visibility: "engine" }
  ],
  openingNarration: [
    "The last thing you remember is impact, light breaking into pieces, and the terrible certainty that your human life has ended.",
    "Then there is pressure. Warmth. A wet, close dark. Your limbs do not answer because they are not limbs in any shape you know.",
    "Scent rolls over you like language without words. Hunger. Brood. Protect. Move. The meanings are instinctive and incomplete, carried on pheromones through a chamber alive with tiny bodies.",
    "You try to breathe and instead feel your soft larval body twitch in the nursery of an ant colony. You are alive. You are not human."
  ],
  openingChoices: [
    { label: "Focus on the scents", action: "I focus on the pheromone scents around me." },
    { label: "Search human memory", action: "I search my human memories for the moment I died." },
    { label: "Stay very still", action: "I stay still and observe the workers around me." },
    { label: "Try to call out", action: "I try to call for help in any way this ant body can." }
  ]
};

const revealBlocks = {
  1: ["Soul Seed identity", "ancient chamber full truth", "full Ant King revelation", "Royal Soul Resonance name", "tournament soul-energy revelation", "Great War manipulation", "sanctuary truth", "Hollow Sovereign identity", "final enemy", "final evolution logic"],
  2: ["Soul Seed full nature", "complete King's next existence truth", "Royal Soul Resonance name", "tournament soul-energy revelation", "Great War manipulation", "sanctuary truth", "Hollow Sovereign identity", "final evolution logic"],
  3: ["complete King's next existence truth", "Royal Soul Resonance name", "tournament soul-energy revelation", "Great War manipulation", "sanctuary truth", "Hollow Sovereign identity", "final evolution logic"],
  4: ["Royal Soul Resonance full nature", "tournament soul-energy revelation", "Great War manipulation", "sanctuary truth", "Hollow Sovereign identity", "final evolution logic"],
  5: ["tournament soul-energy revelation", "Great War manipulation", "sanctuary truth", "Hollow Sovereign identity", "final evolution logic"],
  6: ["Great War full manipulation", "sanctuary truth", "Hollow Sovereign identity", "final evolution logic"],
  7: ["tournament mechanism full truth", "sanctuary truth", "Hollow Sovereign identity", "final evolution logic"],
  8: ["complete sanctuary truth", "Hollow Sovereign identity", "final evolution logic"],
  9: ["tournament mechanism full truth", "Hollow Sovereign identity", "final evolution logic"],
  10: ["Hollow Sovereign identity", "final evolution logic"],
  11: ["King's last memory full truth", "final evolution logic"],
  12: ["final evolution result", "final confrontation outcome"],
  13: ["final evolution result", "final ending result"],
  14: ["final ending result"],
  15: []
};

function getBlockedRevelations(chapterNumber) {
  return revealBlocks[Number(chapterNumber)] || [];
}

module.exports = {
  antWorldMetadata,
  getBlockedRevelations,
  privateCanon,
  startingState
};
