/**
 * Universal Robots Standard Robot Mode Mappings
 * Corresponds to UR Primary/Secondary Client Interface sub-package 0 (ROBOT_MODE_DATA).
 */
export const ROBOT_MODE_NAMES = {
    '-1': 'NO_CONTROLLER',
    '0': 'DISCONNECTED',
    '1': 'CONFIRM_SAFETY',
    '2': 'BOOTING',
    '3': 'POWER_OFF',
    '4': 'POWER_ON',
    '5': 'IDLE',
    '6': 'BACKDRIVE',
    '7': 'RUNNING',
    '8': 'UPDATING_FIRMWARE',
};

/**
 * Normalizes any robot mode input (numeric code, 'ROBOT_MODE_*', or raw string)
 * into a clean, canonical string.
 */
export function formatRobotMode(rawMode) {
    if (rawMode === undefined || rawMode === null) return 'POWER_OFF';
    const str = String(rawMode).trim();
    if (ROBOT_MODE_NAMES[str]) {
        return ROBOT_MODE_NAMES[str];
    }
    return str.replace(/^ROBOT_MODE_/i, '').toUpperCase();
}

/**
 * Maps each robot mode to an indicator dot color:
 *  - 'green': Normal active motion (RUNNING)
 *  - 'yellow': Ready / transient / manual (IDLE, POWER_ON, BACKDRIVE, BOOTING, INITIALIZING)
 *  - 'red': Safety stop / disconnected / de-energized (POWER_OFF, DISCONNECTED, NO_CONTROLLER, CONFIRM_SAFETY, UPDATING_FIRMWARE)
 */
export function dotColorForMode(mode) {
    const formatted = formatRobotMode(mode);
    switch (formatted) {
        case 'RUNNING':
            return 'green';
        case 'IDLE':
        case 'POWER_ON':
        case 'BACKDRIVE':
        case 'BOOTING':
        case 'INITIALIZING':
            return 'yellow';
        case 'CONFIRM_SAFETY':
        case 'UPDATING_FIRMWARE':
        case 'POWER_OFF':
        case 'DISCONNECTED':
        case 'NO_CONTROLLER':
            return 'red';
        default:
            return 'yellow';
    }
}
