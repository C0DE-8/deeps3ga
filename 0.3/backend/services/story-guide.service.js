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

async function buildStoryContext({ book, run, character, chapter, discoveries, relationships, facts, memories, threads, worldState, recentMessages, action }) {
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
