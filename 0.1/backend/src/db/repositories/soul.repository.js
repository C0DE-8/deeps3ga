const { query } = require('../connection')

async function createSoul({ accountId, soulName }) {
  const result = await query(
    'INSERT INTO soul_profiles (account_id, soul_name) VALUES (?, ?)',
    [accountId, soulName],
  )

  return {
    id: result.insertId,
    accountId,
    soulName,
    soulLevel: 1,
    totalDeaths: 0,
    totalCompletedRuns: 0,
    createdAt: new Date().toISOString(),
  }
}

module.exports = { createSoul }
