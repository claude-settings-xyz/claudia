// Common values, so that people can pick instead of type. The schema has no such lists,
// so keep these current with Claude Code. Keys are paths, as in "permissions.allow".
// A hint is a short explanation, shown next to the value.

export type Preset = { value: string; hint?: string };

const models: Preset[] = [
  { value: 'opus', hint: 'the most capable' },
  { value: 'sonnet', hint: 'fast, and strong at code' },
  { value: 'haiku', hint: 'the fastest' },
  { value: 'fable' },
  { value: 'best', hint: 'the best model for your plan' },
  { value: 'opusplan', hint: 'Opus to plan, Sonnet to write' },
  { value: 'opus[1m]', hint: 'Opus with a 1M context' },
  { value: 'sonnet[1m]', hint: 'Sonnet with a 1M context' },
  { value: 'fable[1m]', hint: 'Fable with a 1M context' },
];

export const presets: Record<string, Preset[]> = {
  model: models,
  advisorModel: models,
  fallbackModel: models,
  availableModels: models,
  deniedModels: models,
  outputStyle: [
    { value: 'default' },
    { value: 'Explanatory', hint: 'explains its choices' },
    { value: 'Learning', hint: 'asks you to write some of the code' },
    { value: 'Proactive' },
  ],
  language: ['english', 'spanish', 'french', 'german', 'portuguese', 'italian', 'japanese', 'korean', 'chinese'].map(
    (value) => ({ value }),
  ),
  'permissions.defaultMode': [
    { value: 'default', hint: 'asks before edits and commands' },
    { value: 'acceptEdits', hint: 'edits files without asking' },
    { value: 'plan', hint: 'changes nothing until you approve' },
    { value: 'auto', hint: 'asks only about risky actions' },
    { value: 'dontAsk', hint: 'denies what your rules do not allow' },
    { value: 'bypassPermissions', hint: 'allows everything, sandbox only' },
  ],
  'permissions.allow': [
    { value: 'Bash(npm run *)' },
    { value: 'Bash(git status)' },
    { value: 'Bash(git diff *)' },
    { value: 'Bash(git log *)' },
    { value: 'WebSearch' },
    { value: 'WebFetch(domain:github.com)' },
  ],
  'permissions.ask': [{ value: 'Bash(git push *)' }, { value: 'Bash(git commit *)' }, { value: 'Bash(npm publish *)' }],
  'permissions.deny': [
    { value: 'Read(./.env)' },
    { value: 'Read(./.env.*)' },
    { value: 'Read(./secrets/**)' },
    { value: 'Bash(rm -rf *)' },
    { value: 'Bash(curl *)' },
  ],
  claudeMdExcludes: [{ value: '**/node_modules/**' }, { value: '**/vendor/**' }],
  // The names of environment variables.
  env: [
    { value: 'ANTHROPIC_MODEL', hint: 'the model to use' },
    { value: 'ANTHROPIC_DEFAULT_OPUS_MODEL', hint: 'the model behind "opus"' },
    { value: 'ANTHROPIC_DEFAULT_SONNET_MODEL', hint: 'the model behind "sonnet"' },
    { value: 'ANTHROPIC_DEFAULT_HAIKU_MODEL', hint: 'the model behind "haiku"' },
    { value: 'CLAUDE_CODE_SUBAGENT_MODEL', hint: 'the model for subagents' },
    { value: 'ANTHROPIC_BASE_URL', hint: 'an API endpoint or proxy' },
    { value: 'CLAUDE_CODE_USE_BEDROCK', hint: '1 to use Amazon Bedrock' },
    { value: 'CLAUDE_CODE_USE_VERTEX', hint: '1 to use Google Vertex AI' },
    { value: 'MAX_THINKING_TOKENS', hint: 'the thinking budget' },
    { value: 'CLAUDE_CODE_MAX_OUTPUT_TOKENS', hint: 'the longest answer' },
    { value: 'BASH_DEFAULT_TIMEOUT_MS', hint: 'how long commands may run' },
    { value: 'BASH_MAX_TIMEOUT_MS', hint: 'the longest timeout Claude may ask for' },
    { value: 'MCP_TIMEOUT', hint: 'how long MCP servers may take to start' },
    { value: 'MAX_MCP_OUTPUT_TOKENS', hint: 'the longest MCP tool result' },
    { value: 'HTTPS_PROXY', hint: 'a proxy for all requests' },
    { value: 'NO_PROXY', hint: 'hosts that skip the proxy' },
    { value: 'DISABLE_TELEMETRY', hint: '1 to turn off telemetry' },
    { value: 'DISABLE_ERROR_REPORTING', hint: '1 to turn off error reports' },
    { value: 'DISABLE_AUTOUPDATER', hint: '1 to turn off updates' },
    { value: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', hint: '1 to send only what is needed' },
  ],
};
