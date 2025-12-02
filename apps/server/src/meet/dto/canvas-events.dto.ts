export class CanvasOpenedDto {
  sessionId: string;
  userId: string;
  userFullName: string;
  userAvatar?: string;
  canvasState?: {
    operations: Array<{
      type: string;
      data: Record<string, unknown>;
      timestamp: string;
    }>;
    metadata: {
      width: number;
      height: number;
      backgroundColor: string;
    };
  };
}

export class CanvasClosedDto {
  sessionId: string;
  userId: string;
  userFullName: string;
  userAvatar?: string;
}

export class CanvasDrawEventDto {
  sessionId: string;
  userId: string;
  userFullName: string;
  type: 'draw' | 'shape' | 'text' | 'erase';
  data: Record<string, unknown>;
  timestamp: string;
}

export class CanvasClearedDto {
  sessionId: string;
  userId: string;
  userFullName: string;
  userAvatar?: string;
}

export class CanvasStateResponseDto {
  sessionId: string;
  isActive: boolean;
  canvasState?: {
    operations: Array<{
      type: string;
      data: Record<string, unknown>;
      timestamp: string;
    }>;
    metadata: {
      width: number;
      height: number;
      backgroundColor: string;
    };
  };
}


