export interface Model {
  id: string;
  name: string;
  description: string;
  provider: 'anthropic';
  costEffective?: boolean;
  speed: 'Fast' | 'Medium' | 'Slow';
  cost: 'Low' | 'Medium' | 'High';
  quality: 'Good' | 'Very Good' | 'Excellent';
}

// Every flow (Image Analysis, CSV Translation, Metadata Generation, Optimize)
// runs on Claude Fable 5.2; no user-facing model selector is exposed. Claude
// Opus 5 stays in the list because runs stored before 2026-11-11 carry its id:
// the Dashboard shows their model name and an interrupted run resumes on the
// model it started with.
export const models: Model[] = [
  {
    id: 'claude-fable-5-2',
    name: 'Claude Fable 5.2',
    description: 'Most capable Anthropic model: 1M context, always-on adaptive thinking, top text quality',
    provider: 'anthropic',
    speed: 'Slow',
    cost: 'High',
    quality: 'Excellent',
  },
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    description: 'Previous default (until 2026-11-11), kept for stored runs',
    provider: 'anthropic',
    speed: 'Medium',
    cost: 'High',
    quality: 'Excellent',
  },
];

export const getModelById = (id: string): Model | undefined => {
  return models.find(model => model.id === id);
};
