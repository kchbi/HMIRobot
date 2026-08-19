import { useEffect } from 'react';
import { BOLT_OVERLAY_POSITIONS, TORQUE_COLORS, TORQUE_LEGEND } from './boltPlateLayout';
import plateImage from '../assets/bolting-plate.png';
import './BoltPlateVisual.css';

/** Fallback tint for a bolt the robot is working on before its torque id is known. */
const IN_PROGRESS_FALLBACK = '#f59e0b';

function markerColor(bolt, active) {
    // The controller can name a bolt in `active_bolt` a poll before its entry in
    // `bolt_positions` flips to in_progress; light it anyway so the blink is not
    // swallowed by a marker that renders as nothing.
    if (!bolt) return active ? IN_PROGRESS_FALLBACK : null;
    // Torque colour is the base layer and always wins when the robot reported one,
    // so an active bolt still shows which torque category it belongs to.
    const torqueColor = TORQUE_COLORS[bolt.torque] || null;
    if (bolt.status === 'complete') return torqueColor;
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
    const reported = activeBolt === null || activeBolt === undefined ? null : String(activeBolt);
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
