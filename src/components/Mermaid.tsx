import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import mermaid from 'mermaid';
import { Maximize2, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

// ------------------------
// Notion-style palette
// ------------------------
const PALETTE = {
  primary: '#0052CC',     // Primary Blue
  secondary: '#424242',   // Accent Gray
  highlight: '#33a0ff',   // Lighter Blue
  supporting: '#e4e4e7',  // Light Gray
  bg: '#fafafa',          // Very Light Gray
  surface: '#FFFFFF',     // White
  text: '#18181b',        // Dark Gray
  border: '#d4d4d8',      // Medium Light Gray
};

// ------------------------
// Mermaid theme
// ------------------------
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  themeVariables: {
    primaryColor: PALETTE.primary,
    primaryTextColor: '#FFFFFF',
    primaryBorderColor: PALETTE.primary,

    secondaryColor: PALETTE.secondary,
    tertiaryColor: PALETTE.supporting,

    background: PALETTE.bg,
    mainBkg: PALETTE.primary,
    secondBkg: PALETTE.secondary,
    tertiaryBkg: PALETTE.supporting,

    lineColor: PALETTE.secondary,
    defaultLinkColor: PALETTE.secondary,

    textColor: PALETTE.text,
    nodeTextColor: PALETTE.text,
    edgeLabelBackground: PALETTE.bg,

    clusterBkg: PALETTE.surface,
    clusterBorder: PALETTE.border,

    nodeBorder: PALETTE.border,
    border1: PALETTE.secondary,
    border2: PALETTE.supporting,

    fontSize: '16px',
  },
  securityLevel: 'loose',
});

interface MermaidProps {
  chart: string;
}

export function Mermaid({ chart }: MermaidProps) {
  const [svg, setSvg] = useState<string>('');
  const [isMaximized, setIsMaximized] = useState(false);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (chart) {
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      mermaid
        .render(id, chart)
        .then(({ svg }) => {
          setSvg(svg);
        })
        .catch((error) => {
          console.error('Mermaid render error:', error);
          setSvg('<div class="text-red-500 text-xs">Failed to render diagram</div>');
        });
    }
  }, [chart]);

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const scaleChange = -e.deltaY * 0.001;
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.1, Math.min(5, prev.scale + scaleChange)),
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetTransform = () => setTransform({ x: 0, y: 0, scale: 1 });

  return (
    <div className="relative group">
      {/* Inline (non-maximized) diagram */}
      <div
        className="mermaid my-4 flex justify-center p-6 rounded-lg overflow-x-auto min-h-[100px] border"
        style={{
          background: PALETTE.bg,
          borderColor: PALETTE.border,
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {/* Maximize Button */}
      <button
        onClick={() => {
          setIsMaximized(true);
          resetTransform();
        }}
        className="absolute top-2 right-2 p-1.5 rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-all border"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderColor: PALETTE.border,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = PALETTE.secondary;
          const icon = e.currentTarget.querySelector('svg');
          if (icon) (icon as SVGElement).style.color = '#FFFFFF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
          const icon = e.currentTarget.querySelector('svg');
          if (icon) (icon as SVGElement).style.color = PALETTE.primary;
        }}
        title="Maximize"
      >
        <Maximize2 className="w-4 h-4" style={{ color: PALETTE.primary }} />
      </button>

      {/* Modal */}
      {isMaximized &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md overflow-hidden"
            style={{ background: 'rgba(249, 246, 241, 0.96)' }} // PALETTE.bg with opacity
          >
            {/* Toolbar */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
              <div
                className="flex items-center gap-1 rounded-lg p-1 shadow-lg border"
                style={{
                  backgroundColor: PALETTE.surface,
                  borderColor: PALETTE.border,
                }}
              >
                {/* Zoom Out */}
                <button
                  onClick={() =>
                    setTransform((p) => ({ ...p, scale: Math.max(0.1, p.scale - 0.1) }))
                  }
                  className="p-2 rounded transition-colors"
                  style={{ color: PALETTE.text }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = PALETTE.supporting;
                    e.currentTarget.style.color = PALETTE.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = PALETTE.text;
                  }}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                {/* Reset */}
                <button
                  onClick={resetTransform}
                  className="p-2 rounded transition-colors"
                  style={{ color: PALETTE.text }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = PALETTE.supporting;
                    e.currentTarget.style.color = PALETTE.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = PALETTE.text;
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Zoom In */}
                <button
                  onClick={() =>
                    setTransform((p) => ({ ...p, scale: Math.min(5, p.scale + 0.1) }))
                  }
                  className="p-2 rounded transition-colors"
                  style={{ color: PALETTE.text }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = PALETTE.supporting;
                    e.currentTarget.style.color = PALETTE.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = PALETTE.text;
                  }}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {/* Close */}
              <button
                onClick={() => setIsMaximized(false)}
                className="p-2 rounded-lg transition-colors shadow-lg border"
                style={{
                  backgroundColor: PALETTE.surface,
                  color: PALETTE.highlight,
                  borderColor: PALETTE.highlight,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = PALETTE.highlight;
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = PALETTE.surface;
                  e.currentTarget.style.color = PALETTE.highlight;
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Canvas */}
            <div
              className="w-full h-full cursor-move flex items-center justify-center"
              style={{
                background:
                  'linear-gradient(135deg, rgba(15, 61, 62, 0.03) 0%, rgba(238, 108, 77, 0.03) 100%)',
              }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div
                style={{
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '12px',
                  padding: '32px',
                  boxShadow:
                    '0 20px 25px -5px rgba(15, 61, 62, 0.12), 0 8px 10px -6px rgba(15, 61, 62, 0.08)',
                  border: `1px solid rgba(212, 212, 212, 0.8)`,
                }}
                className="origin-center pointer-events-none select-none"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>

            {/* Hint */}
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm font-medium pointer-events-none backdrop-blur-sm px-4 py-2 rounded-full border shadow-sm"
              style={{
                color: PALETTE.text,
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                borderColor: PALETTE.border,
              }}
            >
              Scroll to zoom • Drag to pan
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
