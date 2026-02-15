/**
 * Session Search Tool
 * 
 * Search across all session transcripts (message history).
 * Supports keyword search with BM25-style scoring.
 */

import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

// ─── Tool Parameters Schema ───────────────────────────────────

export const SessionSearchParams = Type.Object({
  query: Type.String({ 
    description: "The search query to find in session transcripts" 
  }),
  agentId: Type.Optional(
    Type.String({ 
      description: "Filter by agent ID (optional)" 
    })
  ),
  maxResults: Type.Optional(
    Type.Number({ 
      description: "Maximum number of results to return (default: 10)" 
    })
  ),
});

// ─── Types ────────────────────────────────────────────────────

interface SearchResult {
  sessionId: string;
  sessionName: string;
  agentId: string;
  messageIndex: number;
  role: "user" | "assistant" | "toolResult";
  content: string;
  timestamp?: string;
  score: number;
}

// ─── BM25 Search Implementation ─────────────────────────────────

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Calculate BM25 score for a document
 */
function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  avgDocLength: number,
  k1 = 1.5,
  b = 0.75,
): number {
  const docLength = docTokens.length;
  const termFreqs = new Map<string, number>();
  
  for (const token of docTokens) {
    termFreqs.set(token, (termFreqs.get(token) || 0) + 1);
  }

  let score = 0;
  for (const term of queryTokens) {
    const tf = termFreqs.get(term) || 0;
    if (tf === 0) continue;

    // BM25 formula
    const idf = 1; // Simplified IDF since we don't have global doc stats
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
    score += idf * (numerator / denominator);
  }

  return score;
}

/**
 * Search messages across all sessions
 */
async function searchSessions(
  manager: any,
  query: string,
  agentId?: string,
  maxResults = 10,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const queryTokens = tokenize(query);
  
  if (queryTokens.length === 0) {
    return [];
  }

  // Get all sessions
  const sessions = await manager.listSessions();
  
  // Filter by agentId if specified
  const filteredSessions = agentId 
    ? sessions.filter((s: any) => s.agentId === agentId)
    : sessions;

  // Calculate average message length for BM25
  let totalLength = 0;
  let messageCount = 0;

  // Search each session
  for (const sessionInfo of filteredSessions) {
    const session = await manager.getSession(sessionInfo.id);
    if (!session?.messages) continue;

    for (let i = 0; i < session.messages.length; i++) {
      const msg = session.messages[i];
      
      // Only search user and assistant messages
      if (msg.role !== "user" && msg.role !== "assistant") continue;

      const content = typeof msg.content === "string" 
        ? msg.content 
        : JSON.stringify(msg.content);

      totalLength += content.length;
      messageCount++;
    }
  }

  const avgDocLength = messageCount > 0 ? totalLength / messageCount : 100;

  // Score each message
  for (const sessionInfo of filteredSessions) {
    const session = await manager.getSession(sessionInfo.id);
    if (!session?.messages) continue;

    for (let i = 0; i < session.messages.length; i++) {
      const msg = session.messages[i];
      
      if (msg.role !== "user" && msg.role !== "assistant") continue;

      const content = typeof msg.content === "string" 
        ? msg.content 
        : JSON.stringify(msg.content);

      const docTokens = tokenize(content);
      const score = bm25Score(queryTokens, docTokens, avgDocLength);

      if (score > 0) {
        results.push({
          sessionId: session.id,
          sessionName: session.name,
          agentId: session.agentId,
          messageIndex: i,
          role: msg.role,
          content: content.slice(0, 500), // Limit content length
          timestamp: msg.timestamp,
          score,
        });
      }
    }
  }

  // Sort by score and return top results
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

// ─── Tool Definition ──────────────────────────────────────────

export function createSessionSearchTool(manager: any): ToolDefinition {
  return {
    name: "session_search",
    label: "Search Sessions",
    description: 
      "Search through session transcripts (message history) to find relevant conversations. " +
      "Returns matching messages with context about which session they're from.",
    parameters: SessionSearchParams,
    async execute(_toolCallId: string, params: unknown, _signal, _onUpdate, _ctx) {
      try {
        const p = params as { query: string; agentId?: string; maxResults?: number };
        const { query, agentId, maxResults = 10 } = p;

        if (!query.trim()) {
          return {
            content: [{
              type: "text" as const,
              text: "Please provide a search query.",
            }],
          };
        }

        const results = await searchSessions(manager, query, agentId, maxResults);

        if (results.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: `No sessions found matching "${query}".`,
            }],
            details: { query, results: [] },
          };
        }

        // Format results
        const formattedResults = results.map((r, i) => {
          const preview = r.content.length > 300 
            ? r.content.slice(0, 300) + "..." 
            : r.content;
          
          return `${i + 1}. **${r.sessionName}** (${r.sessionId.slice(0, 8)}...) - ${r.role}
   Agent: ${r.agentId}
   Message #${r.messageIndex}
   Score: ${r.score.toFixed(2)}
   
   > ${preview.replace(/\n/g, "\n   > ")}`;
        }).join("\n\n");

        const responseText = `Found ${results.length} results for "${query}":

${formattedResults}

---
*Use \`get_session\` with the session ID to see full message history.*`;

        return {
          content: [{
            type: "text" as const,
            text: responseText,
          }],
          details: { query, results: results.map(r => ({
            sessionId: r.sessionId,
            sessionName: r.sessionName,
            agentId: r.agentId,
            messageIndex: r.messageIndex,
            role: r.role,
            score: r.score,
          }))},
        };
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: `Search failed: ${String(err)}`,
          }],
          details: undefined,
        };
      }
    },
  };
}
