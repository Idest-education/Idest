"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMeetStore } from "@/hooks/useMeetStore";
import { useMeetClient } from "@/hooks/useMeetClient";
import { CanvasState, CanvasDrawEvent } from "@/types/meet";
import type { Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { 
  Pen, 
  Circle, 
  Square, 
  Triangle as TriangleIcon,
  Slash,
  ChevronDown,
  Type, 
  Eraser, 
  Trash2,
  Minus,
  Plus,
  Hand,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Fabric.js will be loaded dynamically to avoid SSR issues
type FabricCanvas = any;
type FabricEvent = any;

type DrawingTool = 'hand' | 'draw' | 'shape' | 'text' | 'erase';
type ShapeType = 'circle' | 'rectangle' | 'triangle' | 'line';

type ShapeOption = {
  value: ShapeType;
  label: string;
  icon: LucideIcon;
};

const SHAPE_OPTIONS: ShapeOption[] = [
  { value: 'rectangle', label: 'Rectangle', icon: Square },
  { value: 'circle', label: 'Circle', icon: Circle },
  { value: 'triangle', label: 'Triangle', icon: TriangleIcon },
  { value: 'line', label: 'Line', icon: Slash },
];

const CANVAS_FONT_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif';

interface MeetCanvasProps {
  sessionId: string | null;
  socket?: Socket | null;
  onClear?: () => void;
}

export function MeetCanvas({ sessionId, socket, onClear }: MeetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const pendingOperationsRef = useRef<Set<string>>(new Set());
  const hasInitializedRef = useRef(false);
  const isCreatingShapeRef = useRef(false); // Prevent duplicate shape creation
  const hasLoadedInitialStateRef = useRef(false); // Track if we've loaded initial state
  const previewShapeRef = useRef<any | null>(null); // Live preview for shapes

  const isCanvasActive = useMeetStore((state) => state.isCanvasActive);
  const activeCanvasUser = useMeetStore((state) => state.activeCanvasUser);
  const canvasState = useMeetStore((state) => state.canvasState);
  const localUserId = useMeetStore((state) => state.localUserId);
  const participants = useMeetStore((state) => state.participants);
  const setCanvasState = useMeetStore((state) => state.setCanvasState);

  const { sendCanvasDraw, clearCanvas: emitClearCanvas } = useMeetClient({
    sessionId,
    autoJoin: false,
  });

  const [selectedTool, setSelectedTool] = useState<DrawingTool>('hand');
  const [selectedShape, setSelectedShape] = useState<ShapeType>('rectangle');
  const activeShape = SHAPE_OPTIONS.find((option) => option.value === selectedShape) ?? SHAPE_OPTIONS[0];
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isReady, setIsReady] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [fabricLib, setFabricLib] = useState<any>(null);

  const isActiveTeacher = activeCanvasUser === localUserId;

  // Load fabric.js dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    import('fabric').then((fabricModule) => {
      setFabricLib(fabricModule);
    }).catch((error) => {
      console.error('Failed to load fabric.js:', error);
      toast.error('Failed to load canvas library');
    });
  }, []);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || hasInitializedRef.current || !fabricLib) return;

    const { Canvas: FabricCanvas } = fabricLib;
    const canvas = new FabricCanvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#ffffff',
      isDrawingMode: false,
      selection: true, // Enable selection for shapes
      selectable: true, // Allow objects to be selected
      evented: true, // Enable event handling
      hoverCursor: 'pointer',
      moveCursor: 'move',
    });

    fabricCanvasRef.current = canvas;
    if (typeof window !== 'undefined') {
      (window as any).__meetCanvas = canvas;
    }
    hasInitializedRef.current = true;
    setIsInitialized(true);
    
    // Mark as ready after canvas is fully initialized
    setTimeout(() => {
      setIsReady(true);
      console.log('[Canvas] Canvas initialized and ready for interaction');
    }, 100);

    return () => {
      if (typeof window !== 'undefined' && (window as any).__meetCanvas === canvas) {
        delete (window as any).__meetCanvas;
      }
      canvas.dispose();
      fabricCanvasRef.current = null;
      hasInitializedRef.current = false;
      setIsInitialized(false);
      setIsReady(false);
    };
  }, [fabricLib]); // Only depend on fabricLib

  // Apply a canvas operation
  const applyOperation = useCallback((operation: { type: string; data: Record<string, unknown>; timestamp: string }, emit = false) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const opId = `${operation.type}-${operation.timestamp}`;
    
    // Skip if already applied
    if (pendingOperationsRef.current.has(opId)) {
      return;
    }

    // Mark as pending
    pendingOperationsRef.current.add(opId);
    
    // Clean up old pending operations (keep last 100)
    if (pendingOperationsRef.current.size > 100) {
      const opsArray = Array.from(pendingOperationsRef.current);
      pendingOperationsRef.current.clear();
      opsArray.slice(-50).forEach(id => pendingOperationsRef.current.add(id));
    }

    try {
      switch (operation.type) {
        case 'draw':
          applyDrawOperation(operation.data);
          break;
        case 'shape':
          applyShapeOperation(operation.data);
          break;
        case 'text':
          applyTextOperation(operation.data);
          break;
        case 'erase':
          applyEraseOperation(operation.data);
          break;
      }

      if (emit && isActiveTeacher) {
        sendCanvasDraw(
          operation.type as DrawingTool,
          operation.data,
          operation.timestamp,
        );
      }
    } catch (error) {
      console.error('Failed to apply operation:', error);
      pendingOperationsRef.current.delete(opId);
    }
  }, [isActiveTeacher, sendCanvasDraw]);

  // Load initial canvas state only once when canvas becomes active.
  // Don't reload on every local state change - local operations are applied directly.
  useEffect(() => {
    if (!fabricCanvasRef.current || !canvasState || !isCanvasActive) {
      return;
    }
    if (!isReady) {
      return;
    }
    const canvas = fabricCanvasRef.current;
    const hasObjects = canvas.getObjects().length > 0;

    // If canvas already has objects (from local drawing) and we haven't yet
    // marked initial state as loaded, assume this is a fresh local session
    // and skip clearing/replay to avoid wiping local drawings.
    if (hasObjects && !hasLoadedInitialStateRef.current) {
      console.log('[Canvas] Canvas already has objects, skipping initial state replay');
      hasLoadedInitialStateRef.current = true;
      return;
    }

    if (hasLoadedInitialStateRef.current) {
      // Already loaded initial state - don't reload or clear
      // Local operations are added directly to canvas, state is just for sync
      console.log(
        '[Canvas] State update detected but skipping reload (already loaded initial state)',
      );
      return;
    }

    console.log('[Canvas] Loading initial canvas state...');
    const operations = canvasState.operations || [];
    const metadata = canvasState.metadata || { width: 800, height: 600, backgroundColor: '#ffffff' };

    // Set canvas metadata
    canvas.setWidth(metadata.width);
    canvas.setHeight(metadata.height);
    
    // Clear existing objects before loading state (only on initial load)
    const objectsBeforeClear = canvas.getObjects().length;
    canvas.clear();
    console.log('[Canvas] Cleared', objectsBeforeClear, 'objects before loading state');
    
    // Set background color (property assignment in Fabric.js v6)
    canvas.backgroundColor = metadata.backgroundColor;

    // Replay operations (only on initial load)
    operations.forEach((op) => {
      try {
        applyOperation(op, false);
      } catch (error) {
        console.error('Failed to replay operation:', error, op);
      }
    });

    canvas.renderAll();
    hasLoadedInitialStateRef.current = true;
    console.log('[Canvas] Initial state loaded:', { 
      operationsCount: operations.length,
      objectsOnCanvas: canvas.getObjects().length 
    });
  }, [canvasState, isCanvasActive, isReady, applyOperation]);
  
  // Reset the flag when canvas becomes inactive
  useEffect(() => {
    if (!isCanvasActive) {
      hasLoadedInitialStateRef.current = false;
      console.log('[Canvas] Canvas inactive - reset initial state flag');
    }
  }, [isCanvasActive]);

  const applyDrawOperation = useCallback((data: Record<string, unknown>) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !fabricLib) return;

    const path = data.path as string;
    if (path && typeof path === 'string') {
      try {
        const pathData = JSON.parse(path);
        fabricLib.util.enlivenObjects([pathData], (objects: any[]) => {
          objects.forEach((obj) => {
            // Don't add if object already exists (prevent duplicates)
            const existing = canvas.getObjects().find((o: any) => 
              o.toObject && JSON.stringify(o.toObject()) === JSON.stringify(pathData)
            );
            if (!existing) {
              canvas.add(obj);
            }
          });
          canvas.renderAll();
        });
      } catch (error) {
        console.error('[Canvas] Failed to apply draw operation:', error);
      }
    }
  }, [fabricLib]);

  const applyShapeOperation = useCallback((data: Record<string, unknown>) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !fabricLib) return;

    try {
      const {
        Circle: FabricCircle,
        Rect: FabricRect,
        Triangle: FabricTriangle,
        Line: FabricLine,
      } = fabricLib;
      const shapeType = data.shapeType as string;
      const left = (data.left as number) || 0;
      const top = (data.top as number) || 0;
      const width = Math.max((data.width as number) || 50, 5); // Minimum size
      const height = Math.max((data.height as number) || 50, 5); // Minimum size
      const startX = (data.startX as number) ?? (left - width / 2);
      const startY = (data.startY as number) ?? (top - height / 2);
      const endX = (data.endX as number) ?? (left + width / 2);
      const endY = (data.endY as number) ?? (top + height / 2);
      const fill = (data.fill as string) || strokeColor;
      const stroke = (data.stroke as string) || strokeColor;
      const strokeWidth = Math.max((data.strokeWidth as number) || 2, 1);

      let shape: any;
      
      // Ensure fill is not transparent - use provided fill or default to stroke color or a visible color
      const shapeFill = fill && fill !== 'transparent' ? fill : (stroke || '#000000');
      
      if (shapeType === 'circle') {
        const radius = Math.max(Math.min(width, height) / 2, 5);
        shape = new FabricCircle({
          left: left - radius,
          top: top - radius,
          radius,
          fill: shapeFill,
          stroke: stroke || '#000000',
          strokeWidth,
          selectable: true,
          evented: true,
          visible: true,
        });
      } else if (shapeType === 'triangle' && FabricTriangle) {
        shape = new FabricTriangle({
          left: left - width / 2,
          top: top - height / 2,
          width,
          height,
          fill: shapeFill,
          stroke: stroke || '#000000',
          strokeWidth,
          selectable: true,
          evented: true,
          visible: true,
        });
      } else if (shapeType === 'line' && FabricLine) {
        shape = new FabricLine([startX, startY, endX, endY], {
          stroke: stroke || '#000000',
          strokeWidth,
          selectable: true,
          evented: true,
          visible: true,
        });
      } else {
        shape = new FabricRect({
          left: left - width / 2,
          top: top - height / 2,
          width,
          height,
          fill: shapeFill,
          stroke: stroke || '#000000',
          strokeWidth,
          selectable: true,
          evented: true,
          visible: true,
        });
      }

      canvas.add(shape);
      
      // Ensure shape is visible and properly positioned
      shape.setCoords();
      shape.set('dirty', true);
      
      // Force render
      canvas.requestRenderAll();
      
      console.log('[Canvas] Shape added to canvas:', {
        type: shapeType,
        left: shape.left,
        top: shape.top,
        width:
          shape.width ||
          (shape.radius ? shape.radius * 2 : shape.x2 ? Math.abs(shape.x2 - shape.x1) : 0),
        height:
          shape.height ||
          (shape.radius ? shape.radius * 2 : shape.y2 ? Math.abs(shape.y2 - shape.y1) : 0),
        fill: shape.fill,
        stroke: shape.stroke,
        visible: shape.visible,
        objectsCount: canvas.getObjects().length,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      });
    } catch (error) {
      console.error('[Canvas] Failed to apply shape operation:', error);
      throw error;
    }
  }, [fabricLib, strokeColor]);

  const applyTextOperation = (data: Record<string, unknown>) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !fabricLib) return;

    const { Textbox, IText, Text } = fabricLib as any;
    const TextClass = Textbox || IText || Text;
    if (!TextClass) return;

    const text = (data.text as string) || '';
    const left = (data.left as number) || 0;
    const top = (data.top as number) || 0;
    const fill = (data.fill as string) || strokeColor;
    const fontSize = (data.fontSize as number) || 20;
    const width = (data.width as number) || 180; // default text box width

    const textObj = new TextClass(text, {
      left,
      top,
      fill,
      fontSize,
      fontFamily: CANVAS_FONT_FAMILY,
      width,
      editable: true,
    });

    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    // Let Fabric handle rendering and editing
    if (typeof textObj.enterEditing === 'function') {
      textObj.enterEditing();
      const hiddenTextarea = (textObj as any).hiddenTextarea as HTMLTextAreaElement | undefined;
      hiddenTextarea?.focus();
    }
    canvas.requestRenderAll();
  };

  const applyEraseOperation = (data: Record<string, unknown>) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !fabricLib) return;

    const { Point: FabricPoint } = fabricLib;
    const pointer = data.pointer as { x: number; y: number };
    if (!pointer) return;

    const objects = canvas.getObjects();
    objects.forEach((obj) => {
      if (obj.containsPoint(new FabricPoint(pointer.x, pointer.y))) {
        canvas.remove(obj);
      }
    });

    canvas.renderAll();
  };

  // Configure brush properties whenever they change (separate effect for reliability)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isCanvasActive || !fabricLib || !isInitialized) return;
    
    if (selectedTool === 'draw' && isActiveTeacher && canvas.isDrawingMode) {
      try {
        // Create brush if it doesn't exist
        if (!canvas.freeDrawingBrush) {
          const { PencilBrush } = fabricLib;
          if (PencilBrush) {
            canvas.freeDrawingBrush = new PencilBrush(canvas);
            console.log('[Canvas] Created PencilBrush in property update effect');
          }
        }
        
        // Configure brush properties
        if (canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush.width = strokeWidth;
          canvas.freeDrawingBrush.color = strokeColor;
          console.log('[Canvas] Brush properties updated:', { 
            width: strokeWidth, 
            color: strokeColor 
          });
        }
      } catch (error) {
        console.error('[Canvas] Could not configure brush:', error);
      }
    }
  }, [strokeWidth, strokeColor, selectedTool, isActiveTeacher, isCanvasActive, isInitialized, fabricLib]);

  // Set up canvas event listeners for drawing
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isCanvasActive || !fabricLib || !isReady || !isInitialized) {
      return;
    }

    // Enable/disable drawing & selection based on tool selection
    if (selectedTool === 'draw' && isActiveTeacher) {
      // Drawing: disable selection to prevent conflicts
      canvas.selection = false;
      
      try {
        // In Fabric.js v6, we need to explicitly create the brush
        const { PencilBrush } = fabricLib;
        if (!canvas.freeDrawingBrush && PencilBrush) {
          canvas.freeDrawingBrush = new PencilBrush(canvas);
          console.log('[Canvas] Created PencilBrush');
        }
        
        // Configure brush properties
        if (canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush.width = strokeWidth;
          canvas.freeDrawingBrush.color = strokeColor;
          console.log('[Canvas] Brush configured:', { 
            width: strokeWidth, 
            color: strokeColor,
            brushType: canvas.freeDrawingBrush.constructor.name
          });
        }
        
        // Enable drawing mode after brush is configured
        canvas.isDrawingMode = true;
      } catch (error) {
        console.error('[Canvas] Error setting up drawing mode:', error);
        // Fallback: try without explicit brush creation
        canvas.isDrawingMode = true;
        setTimeout(() => {
          if (canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.width = strokeWidth;
            canvas.freeDrawingBrush.color = strokeColor;
          }
        }, 100);
      }
    } else {
      // Not in draw mode
      canvas.isDrawingMode = false;
      // Hand / shape / text: allow selecting & transforming objects
      // Erase: selection off so we can treat clicks as erase
      canvas.selection = selectedTool !== 'erase';
    }

    const handlePathCreated = (e: FabricEvent) => {
      console.log('[Canvas] Path created event fired!', { e, path: e.path });
      
      if (!isActiveTeacher) {
        console.log('[Canvas] Path created but user is not active teacher, skipping sync');
        return;
      }
      
      const path = e.path;
      if (!path) {
        console.warn('[Canvas] Path created event has no path');
        return;
      }

      console.log('[Canvas] Processing path:', { 
        pathType: path.constructor.name,
        objectsOnCanvas: canvas.getObjects().length 
      });

      // Ensure the path is visible and has correct properties
      try {
        path.set({
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          fill: '',
        });
        console.log('[Canvas] Path properties updated:', { stroke: strokeColor, width: strokeWidth });
        canvas.requestRenderAll();
      } catch (error) {
        console.warn('[Canvas] Could not update path properties:', error);
      }

      // The path is already added to canvas by Fabric.js, so we just need to sync it
      const timestamp = new Date().toISOString();
      const data = {
        path: JSON.stringify(path.toObject()),
      };

      const operation = {
        type: 'draw' as const,
        data,
        timestamp,
      };

      // Ensure path is persisted on canvas - make sure it's not removed
      path.selectable = false; // Prevent accidental removal
      path.evented = true;
      
      console.log('[Canvas] Path before state update:', {
        pathOnCanvas: canvas.getObjects().includes(path),
        objectsCount: canvas.getObjects().length,
        pathVisible: path.visible,
      });

      // Update local state optimistically - use current state from ref/store
      const currentState = canvasState || {
        operations: [],
        metadata: {
          width: canvas.width || 800,
          height: canvas.height || 600,
          backgroundColor: canvas.backgroundColor?.toString() || '#ffffff',
        },
      };

      const newState = {
        ...currentState,
        operations: [...currentState.operations, operation],
      };

      setCanvasState(newState);

      sendCanvasDraw('draw', data, timestamp);
      
      // Verify path is still on canvas after state update
      setTimeout(() => {
        console.log('[Canvas] Path after state update:', {
          pathOnCanvas: canvas.getObjects().includes(path),
          objectsCount: canvas.getObjects().length,
        });
      }, 100);
      
      console.log('[Canvas] Path created and synced:', { stroke: strokeColor, width: strokeWidth });
    };

    const handleMouseDown = (e: FabricEvent) => {
      if (!isActiveTeacher || !fabricLib) return;

      // Hand & draw tools: let Fabric handle selection / transforms / drawing
      if (selectedTool === 'hand') {
        console.log('[Canvas] Hand tool active - delegating to Fabric');
        isDrawingRef.current = false;
        lastPointRef.current = null;
        return;
      }
      
      // If clicking an existing object with non-erase tool, let Fabric handle move/resize/rotate.
      // We only want to start new shapes/text when clicking empty canvas.
      if (e.target && selectedTool !== 'erase') {
        console.log('[Canvas] Click on existing object, delegating to Fabric');
        isDrawingRef.current = false;
        lastPointRef.current = null;
        return;
      }
      
      // For drawing mode, don't interfere - let Fabric.js handle it completely
      if (selectedTool === 'draw') {
        console.log('[Canvas] Mouse down in draw mode - letting Fabric.js handle it');
        return; // Let Fabric.js handle drawing completely
      }
      
      const { Point: FabricPoint } = fabricLib;
      const pointer = canvas.getPointer(e.e);
      
      if (selectedTool === 'shape' || selectedTool === 'text') {
        // Start drag to define shape/text box
        lastPointRef.current = { x: pointer.x, y: pointer.y };
        isDrawingRef.current = true;
        console.log(
          selectedTool === 'shape'
            ? '[Canvas] Shape drawing started at:'
            : '[Canvas] Text box drawing started at:',
          lastPointRef.current,
        );
      } else if (selectedTool === 'erase') {
        const objects = canvas.getObjects();
        objects.forEach((obj) => {
          if (obj.containsPoint(new FabricPoint(pointer.x, pointer.y))) {
            const timestamp = new Date().toISOString();
            const data = {
              pointer: { x: pointer.x, y: pointer.y },
            };

            canvas.remove(obj);
            canvas.renderAll();

            const operation = {
              type: 'erase' as const,
              data,
              timestamp,
            };

            const currentState = canvasState || {
              operations: [],
              metadata: {
                width: canvas.width || 800,
                height: canvas.height || 600,
                backgroundColor: canvas.backgroundColor?.toString() || '#ffffff',
              },
            };

            setCanvasState({
              ...currentState,
              operations: [...currentState.operations, operation],
            });

            sendCanvasDraw('erase', data, timestamp);
          }
        });
      }
    };

    const handleMouseMove = (e: FabricEvent) => {
      // Live preview for shapes/text while dragging
      if (
        !isActiveTeacher ||
        !isDrawingRef.current ||
        (selectedTool !== 'shape' && selectedTool !== 'text')
      )
        return;
      if (!lastPointRef.current) return;

      const canvas = fabricCanvasRef.current;
      if (!canvas || !fabricLib) return;

      const { x: startX, y: startY } = lastPointRef.current;
      const pointer = canvas.getPointer(e.e);
      const currentX = pointer.x;
      const currentY = pointer.y;

      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      if (width < 1 || height < 1) {
        return;
      }

      const midX = (startX + currentX) / 2;
      const midY = (startY + currentY) / 2;

      const {
        Circle: FabricCircle,
        Rect: FabricRect,
        Triangle: FabricTriangle,
        Line: FabricLine,
      } = fabricLib;

      let shape = previewShapeRef.current;

      if (!shape) {
        // Create a new preview shape for the current type
        const previewAsRect = selectedTool === 'text';

        if (!previewAsRect && selectedShape === 'circle' && FabricCircle) {
          const radius = Math.max(Math.min(width, height) / 2, 1);
          shape = new FabricCircle({
            left: midX - radius,
            top: midY - radius,
            radius,
            fill: 'transparent',
            stroke: strokeColor,
            strokeWidth,
            selectable: false,
            evented: false,
          });
        } else if (!previewAsRect && selectedShape === 'triangle' && FabricTriangle) {
          shape = new FabricTriangle({
            left: midX - width / 2,
            top: midY - height / 2,
            width,
            height,
            fill: 'transparent',
            stroke: strokeColor,
            strokeWidth,
            selectable: false,
            evented: false,
          });
        } else if (!previewAsRect && selectedShape === 'line' && FabricLine) {
          shape = new FabricLine([startX, startY, currentX, currentY], {
            stroke: strokeColor,
            strokeWidth,
            selectable: false,
            evented: false,
          });
        } else if (FabricRect) {
          // rectangle (default) or text box preview
          shape = new FabricRect({
            left: midX - width / 2,
            top: midY - height / 2,
            width,
            height,
            fill: 'transparent',
            stroke: strokeColor,
            strokeWidth,
            selectable: false,
            evented: false,
          });
        }

        if (shape) {
          previewShapeRef.current = shape;
          canvas.add(shape);
        }
      } else {
        // Update existing preview shape
        if (selectedShape === 'circle' && shape.radius != null) {
          const radius = Math.max(Math.min(width, height) / 2, 1);
          shape.set({
            left: midX - radius,
            top: midY - radius,
            radius,
          });
        } else if (selectedShape === 'triangle') {
          shape.set({
            left: midX - width / 2,
            top: midY - height / 2,
            width,
            height,
          });
        } else if (selectedShape === 'line' && shape.set) {
          shape.set({
            x1: startX,
            y1: startY,
            x2: currentX,
            y2: currentY,
          });
        } else {
          // rectangle
          shape.set({
            left: midX - width / 2,
            top: midY - height / 2,
            width,
            height,
          });
        }
      }

      if (shape) {
        shape.setCoords();
        canvas.requestRenderAll();
      }
    };

    const handleMouseUp = (e: FabricEvent) => {
      // Reset drawing state
      if (!isDrawingRef.current) {
        return;
      }

      if (!isActiveTeacher || (selectedTool !== 'shape' && selectedTool !== 'text')) {
        isDrawingRef.current = false;
        lastPointRef.current = null;
        return;
      }

      const pointer = canvas.getPointer(e.e);
      if (!lastPointRef.current) {
        isDrawingRef.current = false;
        return;
      }

      // Calculate drag box dimensions
      const width = Math.abs(pointer.x - lastPointRef.current.x);
      const height = Math.abs(pointer.y - lastPointRef.current.y);
      
      // Only create if it has meaningful dimensions
      if (width < 5 && height < 5) {
        isDrawingRef.current = false;
        lastPointRef.current = null;
        return;
      }

      // Prevent duplicate shape creation
      if (isCreatingShapeRef.current) {
        console.warn('[Canvas] Shape creation already in progress, skipping');
        isDrawingRef.current = false;
        lastPointRef.current = null;
        return;
      }

      isCreatingShapeRef.current = true;

      const startX = lastPointRef.current.x;
      const startY = lastPointRef.current.y;
      const endX = pointer.x;
      const endY = pointer.y;
      const centerX = (endX + startX) / 2;
      const centerY = (endY + startY) / 2;

      const timestamp = new Date().toISOString();

      try {
        if (selectedTool === 'shape') {
          const data = {
            shapeType: selectedShape,
            left: centerX,
            top: centerY,
            width,
            height,
            startX,
            startY,
            endX,
            endY,
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth,
          };

          applyShapeOperation(data);

          const operation = {
            type: 'shape' as const,
            data,
            timestamp,
          };

          const currentState = canvasState || {
            operations: [],
            metadata: {
              width: canvas.width || 800,
              height: canvas.height || 600,
              backgroundColor: canvas.backgroundColor?.toString() || '#ffffff',
            },
          };

          const newState = {
            ...currentState,
            operations: [...currentState.operations, operation],
          };

          setCanvasState(newState);

          sendCanvasDraw('shape', data, timestamp);
          
          // Verify shape is still on canvas after state update
          setTimeout(() => {
            console.log('[Canvas] Shape after state update:', {
              objectsCount: canvas.getObjects().length,
              objects: canvas.getObjects().map((obj: any) => ({
                type: obj.constructor.name,
                left: obj.left,
                top: obj.top,
                visible: obj.visible,
              })),
            });
          }, 100);
          
          console.log('[Canvas] Shape created:', data);
        } else if (selectedTool === 'text') {
          const boxWidth = Math.max(width, 80);
          const boxLeft = Math.min(startX, endX);
          const boxTop = Math.min(startY, endY);

          const data = {
            text: '',
            left: boxLeft,
            top: boxTop,
            width: boxWidth,
            fill: fillColor,
            fontSize: 20,
          };

          applyTextOperation(data);

          const operation = {
            type: 'text' as const,
            data,
            timestamp,
          };

          const currentState = canvasState || {
            operations: [],
            metadata: {
              width: canvas.width || 800,
              height: canvas.height || 600,
              backgroundColor: canvas.backgroundColor?.toString() || '#ffffff',
            },
          };

          const newState = {
            ...currentState,
            operations: [...currentState.operations, operation],
          };

          setCanvasState(newState);

          // For now only sync creation; typing stays local.
          sendCanvasDraw('text', data, timestamp);

          console.log('[Canvas] Text box created:', data);
        }
      } catch (error) {
        console.error('[Canvas] Error creating shape:', error);
        toast.error('Failed to create shape');
      } finally {
        // Remove preview shape now that final shape is created
        const canvas = fabricCanvasRef.current;
        if (canvas && previewShapeRef.current) {
          canvas.remove(previewShapeRef.current);
          previewShapeRef.current = null;
        }
        isDrawingRef.current = false;
        lastPointRef.current = null;
        // Reset flag after a short delay to allow state to settle
        setTimeout(() => {
          isCreatingShapeRef.current = false;
        }, 100);
      }
    };

    // Make canvas interactive
    canvas.set('evented', true);
    canvas.set('selectable', true);
    
    // Always attach path:created handler
    canvas.on('path:created', handlePathCreated);
    
    // Also listen for path creation start/end events for debugging
    canvas.on('before:path:created', (e: any) => {
      console.log('[Canvas] before:path:created event fired', e);
    });
    
    // Only attach mouse handlers for non-drawing tools to avoid interference
    if (selectedTool !== 'draw') {
      canvas.on('mouse:down', handleMouseDown);
      canvas.on('mouse:move', handleMouseMove);
      canvas.on('mouse:up', handleMouseUp);
      
      console.log('[Canvas] Mouse handlers attached for tool:', selectedTool);
    } else {
      console.log('[Canvas] Drawing mode active - mouse handlers not attached to allow Fabric.js to handle drawing');
      
      // Verify brush is configured
      setTimeout(() => {
        if (canvas.freeDrawingBrush) {
          console.log('[Canvas] Brush status:', {
            width: canvas.freeDrawingBrush.width,
            color: canvas.freeDrawingBrush.color,
            brushType: canvas.freeDrawingBrush.constructor.name,
          });
        } else {
          console.error('[Canvas] Brush not available in drawing mode!');
        }
      }, 100);
    }
    
    // Test handler to verify events are working (but don't interfere with drawing)
    const testClickHandler = (e: FabricEvent) => {
      if (selectedTool === 'draw') {
        // Just log, don't interfere
        console.log('[Canvas] Mouse event in draw mode (Fabric.js should handle this):', {
          tool: selectedTool,
          isActiveTeacher,
          isDrawingMode: canvas.isDrawingMode,
        });
      } else {
        console.log('[Canvas] Canvas received click/mouse event:', {
          tool: selectedTool,
          isActiveTeacher,
          pointer: canvas.getPointer(e.e),
        });
      }
    };
    canvas.on('mouse:down', testClickHandler);
    
    console.log('[Canvas] Event handlers attached', {
      isActiveTeacher,
      selectedTool,
      isDrawingMode: canvas.isDrawingMode,
      evented: canvas.evented,
      selectable: canvas.selectable,
      hasBrush: !!canvas.freeDrawingBrush,
    });
    
    return () => {
      canvas.off('path:created', handlePathCreated);
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('mouse:down', testClickHandler);
    };
  }, [
    isCanvasActive,
    isActiveTeacher,
    selectedTool,
    selectedShape,
    strokeColor,
    fillColor,
    strokeWidth,
    isReady,
    canvasState,
    setCanvasState,
    sendCanvasDraw,
  ]);

  // Listen to socket events for remote draw events
  useEffect(() => {
    if (!socket || !isCanvasActive || !isReady) return;

    const handleCanvasDraw = (payload: CanvasDrawEvent) => {
      // Skip if this is our own event
      if (payload.userId === localUserId) return;

      const operation = {
        type: payload.type,
        data: payload.data,
        timestamp: payload.timestamp,
      };

      applyOperation(operation, false);
    };

    socket.on('canvas-draw', handleCanvasDraw);

    return () => {
      socket.off('canvas-draw', handleCanvasDraw);
    };
  }, [socket, isCanvasActive, isReady, localUserId, applyOperation]);

  // Handle canvas clear
  const handleClear = useCallback(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const backgroundColor = canvas.backgroundColor?.toString() || '#ffffff';
    
    canvas.clear();
    canvas.backgroundColor = backgroundColor;
    canvas.renderAll();

    emitClearCanvas();
    onClear?.();

    setCanvasState({
      operations: [],
      metadata: {
        width: canvas.width || 800,
        height: canvas.height || 600,
        backgroundColor,
      },
    });
  }, [emitClearCanvas, onClear, setCanvasState]);

  // Keyboard delete handler for removing selected objects
  useEffect(() => {
    if (!isCanvasActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const activeObjects = canvas.getActiveObjects();
      if (!activeObjects || activeObjects.length === 0) return;

      event.preventDefault();

      activeObjects.forEach((obj: any) => {
        canvas.remove(obj);
      });
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCanvasActive]);

  if (!isCanvasActive) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        Canvas is not active
      </div>
    );
  }

  if (!fabricLib) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        Loading canvas...
      </div>
    );
  }

  const activeTeacherName = activeCanvasUser 
    ? participants[activeCanvasUser]?.userFullName || 'Teacher'
    : 'Unknown';

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Canvas Toolbar */}
      {isActiveTeacher && (
        <div className="flex-shrink-0 border-b border-border/40 bg-background px-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Tool Selection */}
            <div className="flex items-center gap-1 border-r border-border pr-2">
              <Button
                variant={selectedTool === 'hand' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTool('hand')}
              >
                <Hand className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedTool === 'draw' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTool('draw')}
              >
                <Pen className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={selectedTool === 'shape' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedTool('shape')}
                    className="flex items-center gap-1"
                  >
                    <activeShape.icon className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup
                    value={selectedShape}
                    onValueChange={(value) => {
                      setSelectedShape(value as ShapeType);
                      setSelectedTool('shape');
                    }}
                  >
                    {SHAPE_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        <option.icon className="mr-2 h-4 w-4" />
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant={selectedTool === 'text' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTool('text')}
              >
                <Type className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedTool === 'erase' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTool('erase')}
              >
                <Eraser className="h-4 w-4" />
              </Button>
            </div>

            {/* Color Picker */}
            <div className="flex items-center gap-2 border-r border-border pr-2">
              <label className="text-xs text-muted-foreground">Stroke:</label>
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="h-8 w-8 rounded border border-input cursor-pointer"
              />
              <label className="text-xs text-muted-foreground">Fill:</label>
              <input
                type="color"
                value={fillColor}
                onChange={(e) => setFillColor(e.target.value)}
                className="h-8 w-8 rounded border border-input cursor-pointer"
              />
            </div>

            {/* Stroke Width */}
            <div className="flex items-center gap-2 border-r border-border pr-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStrokeWidth(Math.max(1, strokeWidth - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[2rem] text-center">
                {strokeWidth}px
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStrokeWidth(Math.min(20, strokeWidth + 1))}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Clear Button */}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClear}
            >
              <Trash2 className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Clear</span>
            </Button>
          </div>
        </div>
      )}

      {/* Canvas Status Bar */}
      <div className="flex-shrink-0 border-b border-border/40 bg-background px-4 py-1 text-xs text-muted-foreground">
        Canvas controlled by: {activeTeacherName}
      </div>

      {/* Canvas Container */}
      <div 
        className="flex-1 overflow-auto bg-gray-100 p-4" 
        style={{ touchAction: 'none' }}
        onClick={(e) => {
          // Allow clicks to pass through to canvas
          e.stopPropagation();
        }}
      >
        <div className="flex items-center justify-center h-full min-h-[600px] w-full">
          <div className="border border-border shadow-lg bg-white rounded-lg overflow-hidden">
            <canvas 
              ref={canvasRef} 
              className="block"
              width={800}
              height={600}
              style={{ 
                cursor: isActiveTeacher ? (selectedTool === 'draw' ? 'crosshair' : 'pointer') : 'default', 
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                display: 'block',
              }}
              onClick={(e) => {
                console.log('[Canvas] Direct canvas click detected');
                e.stopPropagation();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

