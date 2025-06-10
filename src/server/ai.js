const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generatePrompt(theme) {
  try {
    let system = "You are a game master creating prompts for an image generation game. " +
                  "Create ONE imaginative prompt that combines 2-3 concrete nouns or concepts " +
                  "in an unexpected way. Examples: 'astronaut riding a dinosaur through a library', " +
                  "'giant teacup floating in a cyberpunk city', 'medieval knights playing basketball'. " +
                  "Keep it visual, specific, and fun." +
                  "Use a variety of animals, objects and settings." + 
                  "Keep it to one primary subject with an action and setting. Don't combine too many elements. But keep it weird and unexpected like dixit. ";
    
    if (theme) {
      system += ` The prompt should be inspired by the following theme: "${theme}".`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 30,
      temperature: 0.9,
      messages: [
        { role: "system", content: system },
        { role: "user", content: "Generate a creative visual prompt:" }
      ]
    });
    
    const prompt = response.choices[0].message.content
      .trim()
      .replace(/^["'\s]+|["'\s]+$/g, "")
      .replace(/^(Generate:|Create:|Prompt:)/i, "")
      .trim();
    
    console.log('Generated prompt:', prompt);
    return prompt;
  } catch (error) {
    console.error('Prompt generation error:', error);
    // Fallback prompts if API fails
    const fallbacks = [
      "robot chef cooking in a volcano",
      "penguin detective solving mysteries underwater",
      "dragon teaching yoga to knights",
      "alien tourist visiting a medieval market",
      "pirate ship sailing through clouds"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

async function generateJoke() {
  try {
    const system = "You are a witty AI game host. Tell a single, short, family-friendly joke or pun about art, artists, or painting. Keep it to one or two sentences.";
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 40,
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: "Tell me a joke." }
      ]
    });
    
    const joke = response.choices[0].message.content.trim();
    console.log('Generated joke:', joke);
    return joke;

  } catch (error) {
    console.error('Joke generation error:', error);
    return "Why did the artist get arrested? Because he was framed!";
  }
}

async function scoreGuesses(prompt, guesses) {
  try {
    const system = "You are an impartial judge in a guessing game. " +
                  "Players are trying to guess what prompt was used to generate an AI image. " +
                  "Score each guess based on how closely it matches the actual prompt. " +
                  "Consider: key objects/subjects mentioned, actions described, setting/context, and overall concept similarity. " +
                  "Be generous with partial matches but reserve high scores for very close guesses. " +
                  "Return ONLY a JSON object with a 'scores' array containing objects with 'team' and 'score' (0-1 float).";
    
    const user = `Secret prompt: "${prompt}"\n\n` +
                `Team guesses:\n${guesses.map(g => `- ${g.team}: "${g.text}"`).join('\n')}\n\n` +
                `Score each team's guess.`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    console.log('Scoring result:', result);
    
    // Extract scores array and validate
    const scores = result.scores || result;
    if (Array.isArray(scores)) {
      return scores.map(s => ({
        team: s.team,
        score: Math.max(0, Math.min(1, s.score || 0))
      }));
    }
    
    // Fallback if response format is unexpected
    throw new Error('Invalid response format');
    
  } catch (error) {
    console.error('Scoring error:', error);
    // Fallback: give everyone a low score
    return guesses.map(g => ({
      team: g.team,
      score: g.text ? 0.1 : 0
    }));
  }
}

module.exports = {
  generatePrompt,
  generateJoke,
  scoreGuesses
};