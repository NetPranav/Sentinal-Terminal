export const PromptConfig = {
  defaultSystemPrompt: 'You are an advanced AI routing and planning engine for a terminal environment.',
  injectionTokens: {
    tools: '{{AVAILABLE_TOOLS}}',
    examples: '{{FEW_SHOT_EXAMPLES}}',
    os: '{{OS}}'
  }
};
