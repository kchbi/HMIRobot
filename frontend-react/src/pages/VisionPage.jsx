import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import './VisionPage.css';

export default function VisionPage() {
    const { onCameraFrame } = useApp();
    const [frameSrc, setFrameSrc] = useState(null);
    const [isLive, setIsLive] = useState(false);
    const [fps, setFps] = useState(0);
    const [resolution, setResolution] = useState({ width: 0, height: 0 });
    const [frameCount, setFrameCount] = useState(0);

    // Visual overlays
    const [showCrosshair, setShowCrosshair] = useState(true);
    const [showGrid, setShowGrid] = useState(false);
    const [fitCover, setFitCover] = useState(false);

    // Refs for performance & memory cleanup
    const prevUrlRef = useRef(null);
    const frameTimesRef = useRef([]);
    const watchdogRef = useRef(null);
    const containerRef = useRef(null);

    // Convert raw camera_frame payload into a renderable Object URL
    const processFrame = useCallback((data) => {
        if (!data) return;

        let newUrl = null;
        if (Array.isArray(data) || data instanceof Uint8Array) {
            const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
            if (u8.length < 4) return;

            // Detect PNG (137, 80, 78, 71) or JPEG (255, 216)
            const isPng = u8[0] === 137 && u8[1] === 80;
            const isJpeg = u8[0] === 255 && u8[1] === 216;
            const mime = isPng ? 'image/png' : (isJpeg ? 'image/jpeg' : 'image/png');

            const blob = new Blob([u8], { type: mime });
            newUrl = URL.createObjectURL(blob);
        } else if (typeof data === 'string') {
            newUrl = data.startsWith('data:') ? data : `data:image/png;base64,${data}`;
        }

        if (newUrl) {
            // Revoke previous object URL to prevent memory leaks in the browser
            if (prevUrlRef.current && prevUrlRef.current.startsWith('blob:')) {
                URL.revokeObjectURL(prevUrlRef.current);
            }
            prevUrlRef.current = newUrl;
            setFrameSrc(newUrl);
            setIsLive(true);
            setFrameCount((prev) => prev + 1);

            // Calculate rolling FPS over the last 1 second
            const now = performance.now();
            frameTimesRef.current.push(now);
            while (frameTimesRef.current.length > 0 && frameTimesRef.current[0] < now - 1000) {
                frameTimesRef.current.shift();
            }
            setFps(frameTimesRef.current.length);

            // Reset watchdog timer (mark offline if no frames for 2.5s)
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
            watchdogRef.current = setTimeout(() => {
                setIsLive(false);
                setFps(0);
            }, 2500);
        }
    }, []);

    // Subscribe to camera_frame messages from WebSocket
    useEffect(() => {
        if (!onCameraFrame) return;
        const unsubscribe = onCameraFrame(processFrame);
        return () => {
            unsubscribe();
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
            if (prevUrlRef.current && prevUrlRef.current.startsWith('blob:')) {
                URL.revokeObjectURL(prevUrlRef.current);
            }
        };
    }, [onCameraFrame, processFrame]);

    // Read natural resolution once image renders
    const handleImageLoad = (e) => {
        const { naturalWidth, naturalHeight } = e.target;
        if (naturalWidth && naturalHeight) {
            setResolution({ width: naturalWidth, height: naturalHeight });
        }
    };

    // Save snapshot capture as PNG
    const handleSnapshot = () => {
        if (!frameSrc) return;
        const a = document.createElement('a');
        a.href = frameSrc;
        a.download = `bolt_vision_snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // Toggle full screen on container
    const handleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    };

    return (
        <div className="vision-page">
            {/* Camera Viewport Area */}
            <div className="vision-feed-container" ref={containerRef}>
                {/* HUD Top Bar */}
                <div className="vision-hud-top">
                    <div className={`vision-hud-badge ${isLive ? 'live' : 'offline'}`}>
                        <span className={`pulse-dot ${isLive ? '' : 'offline'}`}></span>
                        <span>{isLive ? 'LIVE' : 'NO SIGNAL'}</span>
                    </div>

                    {isLive && (
                        <div className="vision-telemetry-pill">
                            <span>FPS: <strong>{fps}</strong></span>
                            {resolution.width > 0 && (
                                <span>RES: <strong>{resolution.width}×{resolution.height}</strong></span>
                            )}
                            <span>FRAME: <strong>#{frameCount}</strong></span>
                        </div>
                    )}
                </div>

                {/* Reticle / Crosshair Overlay */}
                {showCrosshair && isLive && (
                    <div className="vision-crosshair-overlay">
                        <div className="crosshair-line-h"></div>
                        <div className="crosshair-line-v"></div>
                        <div className="crosshair-center-circle"></div>
                        <div className="crosshair-inner-dot"></div>
                    </div>
                )}

                {/* Alignment Grid Overlay */}
                {showGrid && isLive && <div className="vision-grid-overlay"></div>}

                {/* Video / Image Display */}
                {frameSrc ? (
                    <img
                        src={frameSrc}
                        alt="Machine Vision Live Feed"
                        className={`vision-stream-image ${fitCover ? 'cover-mode' : ''}`}
                        onLoad={handleImageLoad}
                    />
                ) : (
                    /* Waiting / Empty State */
                    <div className="vision-waiting-state">
                        <div className="vision-radar-icon">
                            <div className="radar-sweep-ring"></div>
                            <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="10" y="18" width="60" height="44" rx="4" />
                                <circle cx="40" cy="40" r="12" />
                                <circle cx="40" cy="40" r="4" />
                                <rect x="30" y="12" width="20" height="8" rx="2" />
                            </svg>
                        </div>
                        <h3>Camera Stream Awaiting Signal</h3>
                        <p>Waiting for WebSocket frames (type: <code>camera_frame</code>)</p>
                        <span className="vision-hint">Frame payload format: byte array or Base64</span>
                    </div>
                )}
            </div>

            {/* Bottom Toolbar & Diagnostics */}
            <div className="vision-toolbar">
                <div className="vision-status-indicator">
                    <span className={`status-dot ${isLive ? 'green' : 'red'}`}></span>
                    <span>
                        Camera Status: {isLive ? (
                            <strong>Online ({resolution.width ? `${resolution.width}×${resolution.height}` : 'Active'})</strong>
                        ) : 'Disconnected / Idle'}
                    </span>
                </div>

                <div className="vision-tools-group">
                    <button
                        className={`vision-tool-btn ${showCrosshair ? 'active' : ''}`}
                        onClick={() => setShowCrosshair(!showCrosshair)}
                        title="Toggle Bolt Center Reticle"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="22" y1="12" x2="18" y2="12" />
                            <line x1="6" y1="12" x2="2" y2="12" />
                            <line x1="12" y1="6" x2="12" y2="2" />
                            <line x1="12" y1="22" x2="12" y2="18" />
                        </svg>
                        Reticle
                    </button>

                    <button
                        className={`vision-tool-btn ${showGrid ? 'active' : ''}`}
                        onClick={() => setShowGrid(!showGrid)}
                        title="Toggle Inspection Grid"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="3" y1="15" x2="21" y2="15" />
                            <line x1="9" y1="3" x2="9" y2="21" />
                            <line x1="15" y1="3" x2="15" y2="21" />
                        </svg>
                        Grid
                    </button>

                    <button
                        className={`vision-tool-btn ${fitCover ? 'active' : ''}`}
                        onClick={() => setFitCover(!fitCover)}
                        title="Toggle Aspect Fit / Fill"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                        </svg>
                        {fitCover ? 'Fit View' : 'Fill View'}
                    </button>

                    <button
                        className="vision-tool-btn"
                        onClick={handleSnapshot}
                        disabled={!frameSrc}
                        title="Save Current Frame to Disk"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Capture
                    </button>

                    <button
                        className="vision-tool-btn primary"
                        onClick={handleFullscreen}
                        title="Toggle Fullscreen"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                        </svg>
                        Fullscreen
                    </button>
                </div>
            </div>
        </div>
    );
}
