import { createContext, useContext } from "react";

/**
 * True while the analysis is rendered under the agent dock (canvas L7-12):
 * the shared field row drops its numbered badge and shows the question as a
 * bold line over its input, as on the board.
 */
const AgentAnalysisContext = createContext(false);

export const AgentAnalysisProvider = AgentAnalysisContext.Provider;
export const useAgentAnalysis = (): boolean => useContext(AgentAnalysisContext);
