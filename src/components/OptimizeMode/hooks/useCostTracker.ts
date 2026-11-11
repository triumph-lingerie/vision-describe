/**
 * Cost Tracker Hook
 *
 * @author Filippo Danesi
 * @description Cost tracking for AI operations: token usage, cost calculation,
 *              budget tracking, and session statistics.
 *
 * The app is Anthropic-only (Claude Fable 5.2).
 */

import { useState, useEffect } from 'react';

export interface ModelCostData {
  name: string;
  inputCostPer1M: number;  // Cost per 1M input tokens
  outputCostPer1M: number; // Cost per 1M output tokens
  tokensPerCharInput: number;  // Approximation of tokens per character in input (fallback)
  tokensPerCharOutput: number; // Approximation of tokens per character in output (fallback)
}

export interface CostRecord {
  timestamp: number;
  model: string;
  inputChars: number;
  outputChars: number;
  actualInputTokens?: number;  // Actual tokens from API response
  actualOutputTokens?: number; // Actual tokens from API response
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  actualCost?: number;         // Cost based on actual tokens
  estimatedCost: number;
}

// Per-model pricing. Claude Fable 5.2: $8 / $40 per MTok; Claude Opus 5
// ($5 / $25) stays for runs resumed on the model they started with.
const MODEL_COSTS: Record<string, ModelCostData> = {
  'claude-fable-5-2': {
    name: 'Claude Fable 5.2',
    inputCostPer1M: 8.00,
    outputCostPer1M: 40.00,
    tokensPerCharInput: 0.25,
    tokensPerCharOutput: 0.25
  },
  'claude-opus-5': {
    name: 'Claude Opus 5',
    inputCostPer1M: 5.00,
    outputCostPer1M: 25.00,
    tokensPerCharInput: 0.25,
    tokensPerCharOutput: 0.25
  },
};

// Initial Anthropic budget — realistic for production use.
const DEFAULT_BUDGET = 100.00;

export const useCostTracker = () => {
  // Cost history
  const [costHistory, setCostHistory] = useState<CostRecord[]>(() => {
    const saved = localStorage.getItem('ai_cost_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Remaining budget
  const [remainingBudget, setRemainingBudget] = useState<{ anthropic: number }>(() => {
    const saved = localStorage.getItem('ai_remaining_budget');
    return saved ? JSON.parse(saved) : { anthropic: DEFAULT_BUDGET };
  });

  // Total cost
  const [totalCost, setTotalCost] = useState<{ anthropic: number }>(() => {
    const saved = localStorage.getItem('ai_total_cost');
    return saved ? JSON.parse(saved) : { anthropic: 0 };
  });

  // Save data when it changes
  useEffect(() => {
    localStorage.setItem('ai_cost_history', JSON.stringify(costHistory));
    localStorage.setItem('ai_remaining_budget', JSON.stringify(remainingBudget));
    localStorage.setItem('ai_total_cost', JSON.stringify(totalCost));
  }, [costHistory, remainingBudget, totalCost]);

  // Reset tracking data
  const resetTracking = () => {
    setCostHistory([]);
    setRemainingBudget({ anthropic: DEFAULT_BUDGET });
    setTotalCost({ anthropic: 0 });
  };

  // Set the budget
  const setBudget = (amount: number) => {
    setRemainingBudget({ anthropic: amount });
  };

  // Calculate and register the cost of an operation with real tokens (if available)
  const trackOperation = (
    model: string,
    inputText: string,
    outputText: string,
    actualTokens?: { inputTokens: number; outputTokens: number }
  ): CostRecord | null => {
    const modelData = MODEL_COSTS[model];
    if (!modelData) {
      console.warn(`Model cost data not available for ${model}`);
      return null;
    }

    const inputChars = inputText.length;
    const outputChars = outputText.length;

    const actualInputTokens = actualTokens?.inputTokens;
    const actualOutputTokens = actualTokens?.outputTokens;

    const estimatedInputTokens = Math.ceil(inputChars * modelData.tokensPerCharInput);
    const estimatedOutputTokens = Math.ceil(outputChars * modelData.tokensPerCharOutput);

    const estimatedInputCost = (estimatedInputTokens / 1000000) * modelData.inputCostPer1M;
    const estimatedOutputCost = (estimatedOutputTokens / 1000000) * modelData.outputCostPer1M;
    const estimatedCost = estimatedInputCost + estimatedOutputCost;

    let actualCost: number | undefined;
    if (actualInputTokens !== undefined && actualOutputTokens !== undefined) {
      const actualInputCost = (actualInputTokens / 1000000) * modelData.inputCostPer1M;
      const actualOutputCost = (actualOutputTokens / 1000000) * modelData.outputCostPer1M;
      actualCost = actualInputCost + actualOutputCost;
    }

    const costRecord: CostRecord = {
      timestamp: Date.now(),
      model,
      inputChars,
      outputChars,
      actualInputTokens,
      actualOutputTokens,
      estimatedInputTokens,
      estimatedOutputTokens,
      actualCost,
      estimatedCost
    };

    setCostHistory(prev => [...prev, costRecord]);

    const costToSubtract = actualCost !== undefined ? actualCost : estimatedCost;

    setRemainingBudget(prev => ({ anthropic: Math.max(0, prev.anthropic - costToSubtract) }));
    setTotalCost(prev => ({ anthropic: prev.anthropic + costToSubtract }));

    return costRecord;
  };

  // Get cost data for a model
  const getModelCostData = (model: string): ModelCostData | undefined => {
    return MODEL_COSTS[model];
  };

  // Session totals
  const getSessionStats = () => {
    const totalOperations = costHistory.length;
    const totalActualCost = costHistory.reduce((sum, record) =>
      sum + (record.actualCost !== undefined ? record.actualCost : record.estimatedCost), 0);
    const totalActualTokensInput = costHistory.reduce((sum, record) =>
      sum + (record.actualInputTokens || record.estimatedInputTokens), 0);
    const totalActualTokensOutput = costHistory.reduce((sum, record) =>
      sum + (record.actualOutputTokens || record.estimatedOutputTokens), 0);

    return {
      totalOperations,
      totalActualCost,
      totalTokensInput: totalActualTokensInput,
      totalTokensOutput: totalActualTokensOutput,
      totalTokens: totalActualTokensInput + totalActualTokensOutput
    };
  };

  return {
    costHistory,
    remainingBudget,
    totalCost,
    trackOperation,
    resetTracking,
    setBudget,
    getModelCostData,
    getSessionStats
  };
};
