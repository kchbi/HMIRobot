/**
 * Overlay geometry for the bolting plate.
 *
 * The plate itself is the supplied artwork and is never redrawn here. This map
 * only says WHERE, as a percentage of the rendered plate box, each bolt's live
 * status marker sits on top of it. The coordinates were measured from the
 * artwork's own bolt-hole centres, so they track it exactly.
 *
 * If the plate artwork is replaced, re-measure these — nothing else changes.
 */
export const BOLT_OVERLAY_POSITIONS = {
    1: { x: 27.21, y: 88.7 },
    2: { x: 49.54, y: 5.46 },
    3: { x: 71.79, y: 88.82 },
    4: { x: 10.96, y: 27.74 },
    5: { x: 88.13, y: 27.65 },
    6: { x: 10.91, y: 72.29 },
    7: { x: 94.26, y: 50.12 },
    8: { x: 27.33, y: 11.42 },
    9: { x: 49.54, y: 94.73 },
    10: { x: 4.99, y: 50.01 },
    11: { x: 71.71, y: 11.4 },
    12: { x: 88.29, y: 72.5 },
    13: { x: 30.01, y: 69.57 },
    14: { x: 49.47, y: 22.61 },
    15: { x: 68.86, y: 69.76 },
    16: { x: 30.1, y: 30.54 },
    17: { x: 68.77, y: 30.44 },
    18: { x: 49.37, y: 77.71 },
    19: { x: 22.0, y: 50.0 },
    20: { x: 77.26, y: 49.72 },
    21: { x: 49.22, y: 61.79 },
    22: { x: 49.3, y: 38.36 },
    23: { x: 37.83, y: 49.77 },
    24: { x: 60.71, y: 49.66 },
};

/** Torque value (lb-in) -> indicator colour. Matches the backend torque ids. */
export const TORQUE_COLORS = {
    20: '#ef4444',
    40: '#f59e0b',
    60: '#22c55e',
};

export const TORQUE_LEGEND = [
    { torque: 20, label: '20 lb-in' },
    { torque: 40, label: '40 lb-in' },
    { torque: 60, label: '60 lb-in' },
];
