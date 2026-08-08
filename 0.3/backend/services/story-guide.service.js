const { getChapter } = require("./book.service");
const { getBlockedRevelations, privateCanon } = require("../books/ant-world/story-guide");

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
  const blocked = getBlockedRevelations(run.currentChapter);

  return {
    universalLaws: privateCanon.laws,
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
    continuityGuidance: {
      hierarchy: ["Story Guide", "Game Master", "Engine", "Player"],
      roleplayModel: "Continue the roleplay from the full reality context. The player supplies protagonist intent; the Game Master reasons what realistically happens next.",
      guidedChoiceRule: "Return exactly one short guidedChoice derived from current story, state, and world logic. It should be plausible for the protagonist's current reality.",
      selfCheck: [
        "Does the response follow Book World and Story Guide?",
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
  playerVisibleContext
};
