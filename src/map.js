import { core } from './state.js';
import { addMapBound } from './physics.js';

/**
 * Builds the city map.
 * Optimized with BufferGeometryUtils to merge static meshes and reduce draw calls.
 */
export function buildMap() {
    const geometries = [];
    const bColors = [0x1a1a2e, 0x242436, 0x191919, 0x1c2128, 0x221a1a];
    
    // Formato: [x, z, w, h, d]
    const bldCfg = [
        [25, 25, 18, 24, 18], [45, 25, 16, 15, 18], [25, 45, 18, 18, 16],
        [-25, 25, 18, 30, 18], [-45, 25, 16, 12, 18], [-25, 45, 18, 20, 16],
        [25, -25, 18, 16, 18], [45, -25, 16, 25, 18], [25, -45, 18, 14, 16],
        [-25, -25, 18, 22, 18], [-45, -25, 16, 18, 18], [-25, -45, 18, 16, 16]
    ];

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshPhongMaterial({ color: 0x171717, shininess: 4 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    core.scene.add(ground);

    // Grid helper
    const grid = new THREE.GridHelper(200, 50, 0x000000, 0x000000);
    grid.material.opacity = 0.25;
    grid.material.transparent = true;
    core.scene.add(grid);

    // Merge static city geometries
    const staticGeometries = [];
    
    bldCfg.forEach(c => {
        const [x, z, w, h, d] = c;
        const box = new THREE.BoxGeometry(w, h, d);
        box.translate(x, h/2, z);
        staticGeometries.push(box);
        
        // Add roof edges
        const roof = new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4);
        roof.translate(x, h + 0.2, z);
        staticGeometries.push(roof);

        // Bounds for physics (exact AABB)
        addMapBound({ minX: x - w/2, maxX: x + w/2, minZ: z - d/2, maxZ: z + d/2, maxY: h });
    });

    // Outer walls
    const walls = [[0, 56, 130, 4, 2], [0, -56, 130, 4, 2], [56, 0, 2, 4, 130], [-56, 0, 2, 4, 130]];
    walls.forEach(w => {
        const wallGeo = new THREE.BoxGeometry(w[2], w[3], w[4]);
        wallGeo.translate(w[0], w[3]/2, w[1]);
        staticGeometries.push(wallGeo);
        addMapBound({ minX: w[0] - w[2]/2, maxX: w[0] + w[2]/2, minZ: w[1] - w[4]/2, maxZ: w[1] + w[4]/2, maxY: w[3] });
    });

    // Perform merge if BufferGeometryUtils is available
    if (THREE.BufferGeometryUtils) {
        const mergedGeo = THREE.BufferGeometryUtils.mergeBufferGeometries(staticGeometries);
        const cityMesh = new THREE.Mesh(mergedGeo, new THREE.MeshPhongMaterial({ color: 0x222233, flatShading: true }));
        cityMesh.castShadow = true;
        cityMesh.receiveShadow = true;
        core.scene.add(cityMesh);
    } else {
        // Fallback if not merged
        staticGeometries.forEach(geo => {
            const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: 0x222233 }));
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            core.scene.add(mesh);
        });
    }

    // Interactive props/lights remain separate
    // ...
}
