const db = require("../db");
const { parseJson } = require("./json");

function serializeBook(row) {
  if (!row) return null;
  return {
    bookId: row.book_id,
    slug: row.slug,
    title: row.title,
    bookNumber: Number(row.book_number),
    world: row.world,
    status: row.status,
    genre: parseJson(row.genre_json, []),
    description: row.description,
    version: row.version,
    coverConfig: parseJson(row.cover_config_json, {})
  };
}

async function listBooks() {
  const rows = await db.query("SELECT * FROM deep_saga_books WHERE status = 'active' ORDER BY book_number");
  return rows.map(serializeBook);
}

async function getBookBySlug(slug) {
  const rows = await db.query("SELECT * FROM deep_saga_books WHERE slug = ? LIMIT 1", [slug]);
  return serializeBook(rows[0]);
}

async function getChapter(bookId, chapterNumber) {
  const rows = await db.query(
    "SELECT * FROM deep_saga_chapters WHERE book_id = ? AND chapter_number = ? LIMIT 1",
    [bookId, chapterNumber]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    chapterNumber: Number(row.chapter_number),
    slug: row.slug,
    title: row.title,
    purpose: row.purpose,
    requiredCanon: parseJson(row.required_canon_json, []),
    majorRevelations: parseJson(row.major_revelations_json, []),
    possibleDevelopments: parseJson(row.possible_developments_json, []),
    endConditions: parseJson(row.end_conditions_json, []),
    blockedRevelations: parseJson(row.blocked_revelations_json, []),
    sceneGuidance: parseJson(row.scene_guidance_json, [])
  };
}

module.exports = {
  getBookBySlug,
  getChapter,
  listBooks,
  serializeBook
};
