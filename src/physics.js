import { EYE_HEIGHT } from './constants.js';

export let mapBounds = [];

/**
 * Axis-Aligned Bounding Box (AABB) collision detection.
 * Optimized to skip heavy Math.sqrt calls and use exact bounds.
 */
export function canMove(nx, nz, py, playerRadius = 0.4) {
    const pMinX = nx - playerRadius;
    const pMaxX = nx + playerRadius;
    const pMinZ = nz - playerRadius;
    const pMaxZ = nz + playerRadius;

    let groundY = EYE_HEIGHT;

    // Use a simple loop for maximum performance in hot code paths
    for (let i = 0, len = mapBounds.length; i < len; i++) {
        const b = mapBounds[i];
        
        // AABB Intersection check
        if (pMaxX > b.minX && pMinX < b.maxX && pMaxZ > b.minZ && pMinZ < b.maxZ) {
            // Vertical check: can we walk on top of this object?
            // If player's Y is high enough above the object's maxY...
            if (py >= b.maxY + EYE_HEIGHT - 0.4) {
                if (b.maxY + EYE_HEIGHT > groundY) {
                    groundY = b.maxY + EYE_HEIGHT;
                }
                continue;
            }
            // If not, it's a wall collision
            return { can: false, groundY };
        }
    }
    
    return { can: true, groundY };
}

/**
 * Utility for squared distance comparison to avoid Math.sqrt()
 */
export function getDistSq(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return dx * dx + dy * dy + dz * dz;
}

export function clearMapBounds() {
    mapBounds.length = 0;
}

export function addMapBound(bound) {
    mapBounds.push(bound);
}
