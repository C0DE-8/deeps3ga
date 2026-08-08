const { getChapter } = require("./book.service");
const antWorld = require("../books/ant-world/story-guide");
const trapGuild = require("../books/trap-guild/story-guide");
const fs = require("node:fs");
const path = require("node:path");

const promptDir = path.join(__dirname, "..", "books", "ant-world", "prompts");
let promptPackageCache = null;

const guides = {
  "ant-world": antWorld,
  "trap-guild": trapGuild
};

function guideForBook(slug) {
  return guides[slug] || antWorld;
}

function readPromptFile(name) {
  return fs.readFileSync(path.join(promptDir, name), "utf8").trim();
}

function loadPromptPackage() {
  if (!promptPackageCache) {
    promptPackageCache = {
      bookArc: readPromptFile("book-arc.md"),
      storyBible: readPromptFile("story-bible.md"),
      narrationStyle: readPromptFile("style-guide.md")
    };
  }
  return promptPackageCache;
}

function promptPackageForBook(book, guide) {
  if (book.slug === "ant-world") return loadPromptPackage();
  return {
    bookArc: guide.privateCanon.chapterArc,
    storyBible: guide.privateCanon.coreStory,
    narrationStyle: "Write as a kinetic fantasy Game Master. Keep the trap, body, guild contract, boss seals, pain, tactics, and freedom goal present. Choices are playable next actions, not restrictions."
  };
}

function countMatches(text, patterns) {
  return patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0);
}

function deriveJourneyProfile({ action, memories = [], facts = [], discoveries = [], recentMessages = [] }) {
  const memoryText = memories.map((memory) => `${memory.content || ""} ${(memory.tags || []).join(" ")}`).join(" ");
  const factText = facts.map((fact) => fact.content || "").join(" ");
  const discoveryText = discoveries.map((discovery) => `${discovery.title || ""} ${discovery.content || ""}`).join(" ");
  const messageText = recentMessages.map((message) => message.content || "").join(" ");
  const actionText = String(action || "").toLowerCase();
  const historyText = `${memoryText} ${factText} ${discoveryText} ${messageText}`.toLowerCase();
  const routeScore = (patterns) => countMatches(actionText, patterns) * 2 + countMatches(historyText, patterns);
  const patterns = {
    investigation: [/\bobserve\b/, /\bstudy\b/, /\banaly[sz]e\b/, /\bunderstand\b/, /\bscent\b/, /\bpheromone\b/, /\bclue\b/, /\bsymbol\b/, /\bpattern\b/, /\binspect\b/, /\blisten\b/],
    attachment: [/\bhelp\b/, /\bprotect\b/, /\bsave\b/, /\bworker\b/, /\bfriend\b/, /\btrust\b/, /\bcomfort\b/, /\bstay close\b/, /\bfollow her\b/, /\bfear\b/, /\bhide\b/, /\bnursery\b/],
    conflict: [/\bbite\b/, /\battack\b/, /\bfight\b/, /\bstrike\b/, /\bguards?\b/, /\bstrong\b/, /\binjur/, /\bkill\b/, /\bthreat\b/, /\bweapon\b/, /\bresist\b/],
    accidental: [/\bsleep\b/, /\beat\b/, /\bwait\b/, /\bcarried\b/, /\blost\b/, /\bcrawl\b/, /\bwander\b/, /\bconfus/, /\bdo nothing\b/, /\bstill\b/, /\bfall\b/, /\bpushed\b/],
    spiritual: [/\bpray\b/, /\bwish\b/, /\bhope\b/, /\bsoul\b/, /\bdream\b/, /\bmemory\b/, /\bbless/, /\bheard\b/, /\bwarmth\b/, /\blight\b/]
  };
  const scores = {
    investigation: routeScore(patterns.investigation),
    attachment: routeScore(patterns.attachment),
    conflict: routeScore(patterns.conflict),
    accidental: routeScore(patterns.accidental),
    spiritual: routeScore(patterns.spiritual)
  };
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [dominantRoute, score] = entries[0] || ["unknown", 0];

  return {
    dominantRoute: score > 0 ? dominantRoute : "undetermined",
    scores,
    signals: entries.filter(([, value]) => value > 0).map(([key]) => key),
    instruction: "Use these as soft continuity signals for tone, knowledge, relationships, and consequences. Do not lock the player into a branch or override their newest intent."
  };
}

function publicChapterView(chapter) {
  return {
    chapterNumber: chapter.chapterNumber,
    slug: chapter.slug,
    title: chapter.title,
    purpose: chapter.purpose,
    sceneGuidance: chapter.sceneGuidance
  };
}

async function buildStoryContext({ book, run, character, chapter, discoveries, relationships, facts, memories, threads, worldState, traits, abilities, resources, recentMessages, action }) {
  const currentChapter = chapter || await getChapter(book.bookId, run.currentChapter);
  const guide = guideForBook(book.slug);
  const blocked = guide.getBlockedRevelations(run.currentChapter);
  const playerJourney = deriveJourneyProfile({ action, memories, facts, discoveries, recentMessages });

  return {
    universalLaws: guide.privateCanon.laws,
    centralCanon: guide.privateCanon.centralCanon || [],
    antagonistTruth: guide.privateCanon.antagonistTruth || null,
    storyCanon: guide.privateCanon.coreStory,
    chapterArc: guide.privateCanon.chapterArc,
    promptPackage: promptPackageForBook(book, guide),
    book: {
      slug: book.slug,
      title: book.title,
      world: book.world,
      genre: book.genre
    },
    currentChapter,
    scene: {
      key: run.currentScene,
      beat: run.storyBeat,
      guidance: currentChapter?.sceneGuidance || []
    },
    playerState: character,
    playerKnowledge: discoveries,
    allowedReveals: currentChapter?.majorRevelations || [],
    futureRevealsBlocked: blocked,
    relationships,
    canonicalFacts: facts,
    openThreads: threads,
    relevantMemories: memories,
    worldState,
    traits,
    abilities,
    resources,
    playerJourney,
    continuityGuidance: {
      hierarchy: ["Story Guide", "Game Master", "Engine", "Player"],
      roleplayModel: "Continue the roleplay from the full reality context. The player supplies protagonist intent; the Game Master reasons what realistically happens next.",
      storySpineRule: "Keep the story moving toward the chapter's canon milestones through the player's chosen route. Do not force a required action; adapt the route so canon arrives naturally.",
      guidedChoiceRule: "Return 2 to 4 short suggestedChoices derived from current story, state, and world logic. Mark the strongest/default one as guidedChoice. Choices should be plausible next actions, not restrictions.",
      selfCheck: [
        "Does the response follow Book World and Story Guide?",
        "Does it preserve the fixed canon spine while honoring the player's route?",
        "Does it contradict established facts or current character state?",
        "Does it grant unearned knowledge, power, items, relationships, evolution, location access, or success?",
        "Does it reveal future story information too early?",
        "Does the guided choice feel like a natural next action rather than a menu option?"
      ]
    },
    recentMessages,
    playerAction: action,
    strictSchema: "Return only the structured game master schema internally; the API never exposes raw model JSON."
  };
}

function playerVisibleContext(context) {
  return {
    book: context.book,
    chapter: publicChapterView(context.currentChapter),
    scene: context.scene,
    playerState: {
      species: context.playerState.species,
      lifeStage: context.playerState.lifeStage,
      level: context.playerState.level,
      location: context.playerState.location,
      conditionText: context.playerState.conditionText,
      manaKnown: context.playerState.manaKnown
    },
    playerKnowledge: context.playerKnowledge,
    relationships: context.relationships,
    openThreads: context.openThreads
  };
}

module.exports = {
  buildStoryContext,
  deriveJourneyProfile,
  playerVisibleContext
};
