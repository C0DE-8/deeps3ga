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
      "An old threat is approaching the colony.",
      "An ancient underground chamber exists beneath the colony.",
      "The chamber contains a dying Soul Seed tied to forgotten colony history.",
      "In Chapter 3, the chamber opens and the Soul Seed awakens.",
      "The protagonist briefly sees an enormous crowned, wounded, ancient ant before the vision disappears."
    ],
    flexibleJourneys: [
      "Analytical players may reach canon through pheromones, symbols, clues, and deduction.",
      "Fearful or attached players may reach canon through protection, evacuation, separation, rescue, and worker relationships.",
      "Aggressive players may reach canon through guards, wounds, failed violence, survival, and dangerous attention.",
      "Passive or unusual players may reach canon by being carried, overlooked, displaced, protected, or caught in colony movement."
    ],
    narratorInstruction: "The Story Guide defines what must eventually happen and what must not happen yet. It never requires a specific player action, route, branch, or menu choice."
  },
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
    { label: "Focus on the scents", action: "I focus on the pheromone scents around me." }
  ]
};

const revealBlocks = {
  1: ["Soul Seed identity", "ancient chamber full truth", "full Ant King revelation", "Royal Soul Resonance name", "tournament soul-energy revelation", "sanctuary truth", "final enemy", "final evolution logic"],
  2: ["Soul Seed awakening", "crowned ancient ant vision", "complete King's next existence truth", "tournament soul-energy revelation", "sanctuary truth", "final enemy", "final evolution logic"],
  3: ["complete King's next existence truth", "Royal Soul Resonance name", "tournament soul-energy revelation", "sanctuary truth", "final enemy", "final evolution logic"],
  4: ["tournament soul-energy revelation", "Great War full truth", "sanctuary truth", "final enemy", "final evolution logic"],
  5: ["soul-energy mechanism", "sanctuary truth", "final enemy", "final evolution logic"],
  6: ["sanctuary truth", "final enemy", "final evolution logic"],
  7: ["soul-energy mechanism details", "sanctuary truth", "final enemy", "final evolution logic"],
  8: ["sanctuary truth", "final enemy", "final evolution logic"],
  9: ["complete sanctuary truth", "final enemy", "final evolution logic"],
  10: ["sanctuary truth", "final evolution logic"],
  11: ["sanctuary truth", "final enemy", "final evolution logic"],
  12: ["final enemy", "final evolution result"],
  13: ["final confrontation outcome"],
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
