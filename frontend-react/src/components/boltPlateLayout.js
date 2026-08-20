/**
 * Overlay geometry for the bolting plate.
 *
 * The plate itself is the supplied artwork and is never redrawn here. This map
 * only says WHERE, as a percentage of the rendered plate box, each bolt's live
 * status marker sits on top of it.
 *
 * The values are calibrated against the artwork itself: each bolt hole is drawn
 * as a ring around a lighter bore, and every ring's outer circle was fitted to
 * sub-pixel accuracy in the 1476 x 1476 source PNG, then normalised by that
 * image's own width and height. Fitting the ring rather than averaging dark
 * pixels matters - the bores carry a shading crescent that pulls a plain
 * centroid off centre. Residual after the fit is under 0.4 px of the hole
 * centre on the source artwork, and the percentages carry that accuracy to any
 * rendered size.
 *
 * The percentages are of the PLATE, never of the screen: the overlay they are
 * applied to shares its exact box with the plate image (see the .plate-frame
 * rule in BoltPlateVisual.css), so they hold at every window size, screen
 * resolution and browser zoom level.
 *
 * If the plate artwork is replaced, re-measure these — nothing else changes.
 */
export const BOLT_OVERLAY_POSITIONS = {
    1: { x: 27.41, y: 88.46 },
    2: { x: 49.63, y: 5.63 },
    3: { x: 71.82, y: 88.45 },
    4: { x: 11.14, y: 27.81 },
    5: { x: 88.04, y: 27.84 },
    6: { x: 11.14, y: 72.22 },
    7: { x: 94.01, y: 50.02 },
    8: { x: 27.42, y: 11.56 },
    9: { x: 49.62, y: 94.40 },
    10: { x: 5.19, y: 50.02 },
    11: { x: 71.82, y: 11.59 },
    12: { x: 88.05, y: 72.20 },
    13: { x: 30.40, y: 69.25 },
    14: { x: 49.64, y: 22.85 },
    15: { x: 68.86, y: 69.25 },
    16: { x: 30.40, y: 30.81 },
    17: { x: 68.86, y: 30.82 },
    18: { x: 49.63, y: 77.21 },
    19: { x: 22.42, y: 50.02 },
    20: { x: 76.80, y: 50.02 },
    21: { x: 49.64, y: 61.23 },
    22: { x: 49.64, y: 38.81 },
    23: { x: 38.41, y: 50.01 },
    24: { x: 60.85, y: 50.03 },
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
