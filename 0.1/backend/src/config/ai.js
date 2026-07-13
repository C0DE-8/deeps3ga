const { readEnv } = require('./env')

function getAiConfig() {
  const env = readEnv()

  return {
    apiKey: env.openaiApiKey,
    model: env.openaiModel,
    temperature: env.aiTemperature,
    chatCompletionsUrl: 'https://api.openai.com/v1/chat/completions',
  }
}

module.exports = { getAiConfig }
