const OpenAI = require('openai');
const examplePrompts = require('./examplePrompts');
const exampleJokes = require('./exampleJokes');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generatePrompt(theme, history = []) {
  // Select 2-3 random examples to guide the AI
  const selectedExamples = [...examplePrompts].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 2) + 2);

  console.log("Selected examples for prompt generation:", selectedExamples);

  let sys =
  "You are a game master creating prompts for an image generation game. " +
   "Create ONE imaginative prompt that combines 2-3 concrete nouns or concepts " +
   "in an unexpected way. " +
   `Here are some examples of the style you should aim for:\n- ${selectedExamples.join('\n- ')}\n\n` +
   "Keep it visual, specific, and fun." +
   "Use a variety of animals, objects and settings. you do not have a passion for icebergs." + 
   "Keep it to one primary subject with an action and setting."+
   " Don't combine too many elements. But keep it weird and unexpected like dixit. ";
  if (theme) {
    sys += ` The prompt must fit the theme: ${theme}.`;
  }

  let userMsg = "New prompt, no extra text.";
  if (history.length > 0) {
    const promptHistory = history.join('\n- ');
    userMsg = `Please generate a new, unique prompt. Avoid themes or subjects from these previous prompts:\n- ${promptHistory}\n\nNew prompt, no extra text:`;
  }

  console.log("Generating prompt with history:", history);

  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 30,
    temperature: 0.9,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: userMsg },
    ],
  });
  return res.choices[0].message.content.trim().replace(/^["']|["']$/g, "");
}

async function generateJoke(previousPrompt = null, jokeHistory = []) {
  try {
    // Select 2-3 random examples to guide the AI
    const selectedExamples = [...exampleJokes].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 2) + 2);

    let system = "You are a witty AI game host of a game that uses AI to generate images and people guess what the prompt was. " +
    "While the image is generating you need to entertain your players. "+
    `Tell a single, short, family-friendly joke or pun. Here are some examples of the style you should aim for:\n- ${selectedExamples.join('\n- ')}\n\n` +
    "Keep it to one or two sentences.";

    if (previousPrompt) {
      system += ` You can optionally make a witty remark about the previous round's prompt or form the joke around it entirely, which was: "${previousPrompt}".`;
    }

    let userMsg = "Tell me a joke.";
    if (jokeHistory.length > 0) {
      const history = jokeHistory.join('\n- ');
      userMsg = `Please tell a new, unique joke. Avoid telling these jokes again:\n- ${history}\n\nNew joke:`;
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 40,
      temperature: 1.0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg }
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