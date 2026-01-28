'use client';

import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { Minimize2, Maximize2, X, GripVertical, GripHorizontal } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface PanelSize {
  width: number;
  height: number;
}

interface PanelPosition {
  x: number;
  y: number;
}

interface ResizablePanelProps {
  children: ReactNode;
  title: string;
  icon?: ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  headerColor?: string;
  headerGradient?: string;
  showControls?: boolean;
  onClose?: () => void;
  className?: string;
  zIndex?: number;
  resizeHandles?: ('left' | 'right' | 'top' | 'bottom' | 'corner')[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  statusBadge?: ReactNode;
  draggable?: boolean;
}

// ============================================================================
// RESIZABLE PANEL COMPONENT
// ============================================================================

export default function ResizablePanel({
  children,
  title,
  icon,
  initialWidth = 400,
  initialHeight = 500,
  minWidth = 280,
  minHeight = 200,
  maxWidth = 900,
  maxHeight = 800,
  position = 'bottom-right',
  headerColor = '#1e40af',
  headerGradient = 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)',
  showControls = true,
  onClose,
  className = '',
  zIndex = 1000,
  resizeHandles = ['right', 'bottom', 'corner'],
  collapsible = true,
  defaultCollapsed = false,
  statusBadge,
  draggable = false,
}: ResizablePanelProps) {
  const [size, setSize] = useState<PanelSize>({ width: initialWidth, height: initialHeight });
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  
  const panelRef = useRef<HTMLDivElement>(null);
  const prevSizeRef = useRef<PanelSize>(size);
  const dragStartRef = useRef<{ x: number; y: number; panelX: number; panelY: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number; handle: string } | null>(null);

  // ============================================================================
  // RESIZE HANDLERS
  // ============================================================================

  const handleResizeStart = useCallback((e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      handle
    };
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [size]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizeStartRef.current) return;
    
    const { x: startX, y: startY, width: startWidth, height: startHeight, handle } = resizeStartRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newWidth = startWidth;
    let newHeight = startHeight;
    
    if (handle.includes('right') || handle === 'corner') {
      newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
    }
    if (handle.includes('left')) {
      newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
    }
    if (handle.includes('bottom') || handle === 'corner') {
      newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
    }
    if (handle.includes('top')) {
      newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
    }
    
    setSize({ width: newWidth, height: newHeight });
  }, [minWidth, maxWidth, minHeight, maxHeight]);

  const handleResizeEnd = useCallback(() => {
    resizeStartRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove]);

  // ============================================================================
  // DRAG HANDLERS
  // ============================================================================

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!draggable) return;
    e.preventDefault();
    
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: rect.left,
      panelY: rect.top
    };
    
    setIsDragging(true);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }, [draggable]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragStartRef.current) return;
    
    const { x: startX, y: startY, panelX, panelY } = dragStartRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    setPanelPosition({
      x: panelX + deltaX,
      y: panelY + deltaY
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  }, [handleDragMove]);

  // ============================================================================
  // CONTROL HANDLERS
  // ============================================================================

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleToggleMaximize = () => {
    if (isMaximized) {
      setSize(prevSizeRef.current);
    } else {
      prevSizeRef.current = size;
      setSize({ width: maxWidth, height: maxHeight });
    }
    setIsMaximized(!isMaximized);
  };

  // ============================================================================
  // POSITION CALCULATION
  // ============================================================================

  const getPositionStyles = (): React.CSSProperties => {
    if (panelPosition) {
      return {
        position: 'fixed',
        left: panelPosition.x,
        top: panelPosition.y,
        right: 'auto',
        bottom: 'auto'
      };
    }
    
    switch (position) {
      case 'top-left':
        return { top: 16, left: 16 };
      case 'top-right':
        return { top: 16, right: 16 };
      case 'bottom-left':
        return { bottom: 16, left: 16 };
      case 'bottom-right':
        return { bottom: 16, right: 16 };
      case 'center':
        return { 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)' 
        };
      default:
        return { bottom: 16, right: 16 };
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      ref={panelRef}
      className={`fixed ${className}`}
      style={{
        ...getPositionStyles(),
        width: isCollapsed ? 'auto' : size.width,
        height: isCollapsed ? 'auto' : size.height,
        zIndex,
        transition: isDragging ? 'none' : 'box-shadow 0.3s ease',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 60px rgba(0, 0, 0, 0.3)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: headerGradient,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: draggable ? 'move' : 'default',
          userSelect: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}
        onMouseDown={handleDragStart}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon}
          <h3 style={{ 
            margin: 0, 
            fontSize: 15, 
            fontWeight: 700, 
            color: '#fff',
            letterSpacing: '0.5px'
          }}>
            {title}
          </h3>
          {statusBadge}
        </div>
        
        {showControls && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {collapsible && (
              <button
                onClick={handleToggleCollapse}
                style={{
                  padding: 6,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                <Minimize2 size={14} color="#fff" />
              </button>
            )}
            <button
              onClick={handleToggleMaximize}
              style={{
                padding: 6,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              <Maximize2 size={14} color="#fff" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  padding: 6,
                  backgroundColor: 'rgba(239, 68, 68, 0.3)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.5)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)'}
                title="Close"
              >
                <X size={14} color="#fff" />
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Content */}
      {!isCollapsed && (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            position: 'relative'
          }}
        >
          {children}
        </div>
      )}
      
      {/* Resize Handles */}
      {!isCollapsed && !isMaximized && (
        <>
          {/* Right handle */}
          {resizeHandles.includes('right') && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: 6,
                cursor: 'ew-resize',
                backgroundColor: 'transparent'
              }}
              onMouseDown={(e) => handleResizeStart(e, 'right')}
            >
              <div style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                opacity: 0.3
              }}>
                <GripVertical size={12} color="#fff" />
              </div>
            </div>
          )}
          
          {/* Bottom handle */}
          {resizeHandles.includes('bottom') && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 6,
                cursor: 'ns-resize',
                backgroundColor: 'transparent'
              }}
              onMouseDown={(e) => handleResizeStart(e, 'bottom')}
            >
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                opacity: 0.3
              }}>
                <GripHorizontal size={12} color="#fff" />
              </div>
            </div>
          )}
          
          {/* Corner handle */}
          {resizeHandles.includes('corner') && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: 20,
                height: 20,
                cursor: 'nwse-resize',
                backgroundColor: 'transparent'
              }}
              onMouseDown={(e) => handleResizeStart(e, 'corner')}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                style={{
                  position: 'absolute',
                  right: 4,
                  bottom: 4,
                  opacity: 0.4
                }}
              >
                <path
                  d="M10 12L12 12L12 10M6 12L12 12L12 6M2 12L12 12L12 2"
                  stroke="#fff"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { ResizablePanelProps, PanelSize, PanelPosition };
