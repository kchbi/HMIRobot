import { useEffect } from 'react';
import { BOLT_OVERLAY_POSITIONS, TORQUE_COLORS, TORQUE_LEGEND, BOLT_TORQUE_COLORS } from './boltPlateLayout';
import plateImage from '../assets/bolting-plate.png';
import './BoltPlateVisual.css';

/** Fallback tint for a bolt the robot is working on before its torque id is known. */
const IN_PROGRESS_FALLBACK = '#f59e0b';

function resolveBoltColor(colorName) {
    if (!colorName) return null;
    const lower = String(colorName).trim().toLowerCase();
    return BOLT_TORQUE_COLORS[lower] || colorName;
}

function markerColor(bolt, active) {
    if (!bolt) return active ? IN_PROGRESS_FALLBACK : null;

    // 1. Direct color from get_bolt_torque (e.g. "lawngreen", "yellow", "orange", "red", "indigo", "white")
    const rawColor = typeof bolt === 'string' ? bolt : (bolt.color || null);
    if (rawColor) {
        const lower = rawColor.toLowerCase();
        // If bolt has a valid completed torque color, display it immediately
        if (lower !== 'white') {
            return resolveBoltColor(rawColor);
        }
        // If untorqued ("white"), show active amber-yellow pulse while robot is driving it
        if (active) return IN_PROGRESS_FALLBACK;
        return null;
    }

    // 2. Legacy torque/status property (from mock simulation fallback)
    const torqueVal = bolt.torque ?? bolt.torque_id;
    const torqueColor = TORQUE_COLORS[torqueVal]
        || (torqueVal === 1 ? TORQUE_COLORS[40] : null)
        || (torqueVal === 2 ? TORQUE_COLORS[60] : null)
        || null;

    if (bolt.status === 'complete') return torqueColor || '#22c55e';
    if (bolt.status === 'in_progress' || active) return torqueColor || IN_PROGRESS_FALLBACK;
    return null;
}

/**
 * Visual for the bolt task.
 *
 * Base layer  : the supplied bolting-plate artwork, rendered as-is. Swap the
 *               import above if the plate artwork is replaced (e.g. an SVG);
 *               nothing else in this component depends on the file type.
 * Overlay     : React-controlled status markers driven by live robot state.
 *
 * Blink source, in priority order, all from the same `status_update` payload:
 *   1. `active_bolt` — the id the controller says it is driving right now. This
 *      is the authoritative signal; it is null the moment the cycle stops.
 *   2. the first `in_progress` entry in `bolt_positions` — fallback for a
 *      controller that reports per-bolt status but no `active_bolt`.
 * `bolting` gates only the fallback: a stale `in_progress` left behind by an
 * abort keeps animating otherwise. An explicit `active_bolt` needs no gate —
 * the robot naming a live bolt is itself the statement that it is bolting.
 */
export default function BoltPlateVisual({ boltPositions, activeBolt = null, bolting = false }) {
    const bolts = boltPositions || {};

    // Ids arrive as numbers in `active_bolt` but as object keys (strings) in
    // `bolt_positions` — compare as strings so the marker is found either way.
    // A bolt only pulses if the robot is actively bolting.
    const reported = (bolting && activeBolt !== null && activeBolt !== undefined) ? String(activeBolt) : null;
    const activeId = reported
        || (bolting
            ? Object.keys(bolts).find((id) => bolts[id]?.status === 'in_progress') || null
            : null);

    // Fires only when the active bolt changes, not on every 1 s status poll.
    useEffect(() => {
        if (import.meta.env.DEV) {
            console.log('[bolt] active bolt:', activeId ?? 'none');
        }
    }, [activeId]);

    return (
        <div className="plate-visual">
            <div className="plate-stage">
                {/* One box for both layers: the image fills it and the marker
                    overlay fills it, so marker percentages are percentages of
                    the plate as actually rendered - never of leftover space. */}
                <div className="plate-frame">
                    <img className="plate-image" src={plateImage} alt="Top plate bolt layout" />

                    <div className="plate-overlay" aria-hidden="true">
                        {Object.entries(BOLT_OVERLAY_POSITIONS).map(([id, pos]) => {
                            const bolt = bolts[id];
                            // Only the one bolt the robot is currently driving pulses;
                            // pending, complete and failed bolts stay static.
                            const active = id === activeId;
                            const color = markerColor(bolt, active);
                            if (!color) return null;
                            return (
                                <span
                                    key={id}
                                    className={`bolt-marker${active ? ' active' : ''}`}
                                    style={{ left: `${pos.x}%`, top: `${pos.y}%`, '--bolt-glow': color }}
                                >
                                    {active && <span className="bolt-marker-ring" />}
                                    <span className="bolt-marker-dot" style={{ background: color }} />
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="torque-legend">
                <div className="torque-legend-title">Torque ID</div>
                {TORQUE_LEGEND.map((item) => (
                    <div className="legend-item" key={item.torque}>
                        <span className="legend-dot" style={{ background: TORQUE_COLORS[item.torque] }} />
                        {item.label}
                    </div>
                ))}
            </div>
        </div>
    );
}
