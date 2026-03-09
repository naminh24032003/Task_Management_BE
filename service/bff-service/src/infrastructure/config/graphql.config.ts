import { registerAs } from '@nestjs/config';

export default registerAs('graphql', () => ({
  playground: process.env.GRAPHQL_PLAYGROUND === 'true',
  introspection: process.env.GRAPHQL_INTROSPECTION === 'true',
  debug: process.env.GRAPHQL_DEBUG === 'true',

  // ── Query protection ──────────────────────────────────────────────────────
  // Reject queries that exceed these limits before execution begins.
  // Tune these via env vars per environment (prod should be strict).
  maxDepth:       parseInt(process.env.GRAPHQL_MAX_DEPTH       || '10',   10),
  maxComplexity:  parseInt(process.env.GRAPHQL_MAX_COMPLEXITY  || '200',  10),
  maxTokens:      parseInt(process.env.GRAPHQL_MAX_TOKENS      || '1000', 10),
  listMultiplier: parseInt(process.env.GRAPHQL_LIST_MULTIPLIER || '10',   10),
}));
