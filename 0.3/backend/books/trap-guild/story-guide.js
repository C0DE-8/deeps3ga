const trapGuildMetadata = {
  slug: "trap-guild",
  title: "Trap Guild: Three Bosses to Freedom",
  bookNumber: 2,
  world: "Veyra",
  status: "active",
  genre: ["Action", "Dungeon", "Fantasy", "Survival", "Boss Rush"],
  description: "You wake inside a stolen fighter's body in an overpowered guild trap. Three bosses hold the seals. Beat them, break the guild's contract, and win freedom."
};

const privateCanon = {
  world: "Veyra",
  laws: [
    "AI = GAME MASTER",
    "STORY GUIDE = CANON",
    "PLAYER = PROTAGONIST",
    "ENGINE = REALITY",
    "Player action is an attempt, not reality.",
    "No plot armor.",
    "No random victory.",
    "No future boss spoilers."
  ],
  coreStory: {
    model: "A trapped-body fight story with free routes and three fixed boss seals.",
    fixedCanon: [
      "The protagonist wakes inside a body that was prepared for a guild trap.",
      "The OP Guild controls the arena through a binding contract and three boss seals.",
      "The protagonist must defeat, outwit, break, or otherwise resolve three bosses to win freedom.",
      "The bosses can be reached through combat, alliances, traps, stealth, sacrifice, or clever use of the arena.",
      "Freedom is earned only when all three boss seals are broken."
    ],
    flexibleJourneys: [
      "A combat-heavy player may train, duel, bleed, and overpower bosses.",
      "A clever player may study rules, turn traps against bosses, and exploit guild contracts.",
      "A social player may ally with prisoners, broken guild members, or boss fragments.",
      "A reckless player may trigger traps early and survive through consequence."
    ],
    narratorInstruction: "Make every action feel playable, but let the arena, body limits, bosses, and guild contract answer realistically."
  },
  chapterArc: [
    { chapter: 1, title: "The Body in the Trap", endpoint: "I am awake, trapped, and owned by a guild contract." },
    { chapter: 2, title: "The First Boss Seal", endpoint: "The first boss seal breaks." },
    { chapter: 3, title: "The Second Boss Seal", endpoint: "The second boss reveals the trap has rules." },
    { chapter: 4, title: "The Third Boss Seal", endpoint: "The final seal opens the guild's true contract." },
    { chapter: 5, title: "Win and Be Free", endpoint: "The player wins freedom or pays the final cost." }
  ],
  futureTruths: [
    "The body was chosen because it can survive the guild's boss seals.",
    "The OP Guild is feeding on failed challengers.",
    "The three bosses are keys as much as enemies.",
    "The final freedom clause is hidden in the contract."
  ]
};

const startingState = {
  run: {
    currentChapter: 1,
    currentScene: "awakening",
    storyBeat: "body_trap"
  },
  character: {
    species: "Human",
    lifeStage: "Awakened Fighter",
    level: 1,
    experience: 0,
    experienceToNext: 100,
    healthCurrent: 20,
    healthMax: 20,
    manaCurrent: 5,
    manaMax: 5,
    manaKnown: true,
    conditionText: "Awake in an unfamiliar battle-ready body, bruised, armed with nothing, and sealed inside a guild trap.",
    evolutionState: { eligible: false, currentPathHints: [], lastEvaluation: "Freedom must be earned before final transformation." },
    location: "OP Guild Trap Chamber",
    territory: "Sealed Guild Arena",
    humanMemoriesRetained: true,
    physicalDevelopment: 1,
    combatDevelopment: 1,
    magicDevelopment: 0,
    analysisDevelopment: 0,
    leadershipDevelopment: 0,
    supportDevelopment: 0,
    survivalDevelopment: 1,
    scoutingDevelopment: 0,
    predatorDevelopment: 0,
    soulDevelopment: 0
  },
  discoveries: [
    {
      key: "guild-trap",
      title: "The Guild Trap",
      content: "You woke in a prepared fighter's body inside a sealed arena controlled by an overpowered guild."
    }
  ],
  relationships: [
    {
      targetType: "faction",
      targetKey: "op-guild",
      displayName: "OP Guild",
      trust: -10,
      fear: 5,
      respect: 0,
      loyalty: 0,
      hostility: 10,
      notes: "The guild owns the trap and expects challengers to die inside it."
    }
  ],
  worldState: [
    { key: "guild_trap", value: { active: true, bossSealsBroken: 0, totalBossSeals: 3, contractVisible: false }, visibility: "player" }
  ],
  openingNarration: [
    "You wake on cold stone with someone else's breath burning in your lungs.",
    "The body is human, adult, scarred, and stronger than the one you remember. It gets up before your mind fully understands how to command it, knees scraping against a floor carved with red guild marks.",
    "Above you, iron balconies circle the chamber. Empty seats. Broken banners. Three sealed gates stand ahead, each branded with a different boss mark.",
    "A voice rolls through the trap from nowhere and everywhere at once: challenger awake. Contract active. Three bosses remain. Win, and be free.",
    "Then the first gate grinds open just enough for you to hear something breathing behind it."
  ],
  openingChoices: [
    { label: "Check this body", action: "I check the body I woke in and test what it can do." },
    { label: "Study the trap", action: "I study the guild marks, gates, and contract signs before moving." },
    { label: "Call out", action: "I call out to see if anyone else is trapped here." },
    { label: "Face the first gate", action: "I move toward the first boss gate and prepare to fight." }
  ]
};

const revealBlocks = {
  1: ["final contract clause", "third boss identity", "guild master identity", "true body origin"],
  2: ["final contract clause", "guild master identity", "true body origin"],
  3: ["final contract clause", "true body origin"],
  4: ["final freedom cost"],
  5: []
};

function getBlockedRevelations(chapterNumber) {
  return revealBlocks[Number(chapterNumber)] || [];
}

module.exports = {
  getBlockedRevelations,
  privateCanon,
  startingState,
  trapGuildMetadata
};
