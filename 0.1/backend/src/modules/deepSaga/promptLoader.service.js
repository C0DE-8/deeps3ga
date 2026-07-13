const fs = require('node:fs')
const path = require('node:path')

const promptPath = path.resolve(__dirname, '../../prompts/deep-saga-game-master.system.md')
let cachedPrompt = null

function loadGameMasterPrompt() {
  if (cachedPrompt === null) cachedPrompt = fs.readFileSync(promptPath, 'utf8').trim()
  return cachedPrompt
}

function clearPromptCache() {
  cachedPrompt = null
}

module.exports = { clearPromptCache, loadGameMasterPrompt }
