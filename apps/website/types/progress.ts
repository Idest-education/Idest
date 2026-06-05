export interface TimelinePoint {
    timestamp: string;
    score: number;
    submissionId: string;
}

export interface TimelineTrend {
    rollingAverage: number | null;
    deltaVsPreviousWindow: number | null;
    direction: 'up' | 'down' | 'flat' | 'unknown';
}

export interface TimelineResponse {
    skill: string;
    window: string;
    points: TimelinePoint[];
    trend: TimelineTrend;
}

export interface QuestionTypeItem {
    questionType: string;
    accuracy: number;
    correctItems: number;
    totalItems: number;
    confidence: 'high' | 'medium' | 'insufficient_data';
    classification: 'strong' | 'weak' | 'neutral' | 'insufficient_data';
    trendDirection: 'improving' | 'declining' | 'stable' | 'unknown';
}

export interface QuestionTypesResponse {
    skill: string;
    window: string;
    items: QuestionTypeItem[];
}

export interface WritingRubricItem {
    criterion: 'task_response' | 'coherence_cohesion' | 'lexical_resource' | 'grammar_range_accuracy';
    averageBand: number | null;
    deltaVsPreviousWindow: number | null;
    trend: 'up' | 'down' | 'flat' | 'unknown';
    recommendation: string;
}

export interface WritingRubricsResponse {
    window: string;
    items: WritingRubricItem[];
}