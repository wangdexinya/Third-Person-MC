import * as THREE from 'three'

/**
 * Check if target is within a rectangular attack zone in front of the attacker.
 * Uses OBB projection: project target position onto attacker's local forward/right axes.
 *
 * @param {THREE.Vector3} attackerPos - attacker position
 * @param {{x: number, z: number}} forwardDir - normalized forward direction (XZ plane)
 * @param {THREE.Vector3} targetPos - target position
 * @param {number} width - box width (lateral, perpendicular to forward)
 * @param {number} depth - box depth (forward extension)
 * @returns {boolean} true if target is within the attack box
 */
export function isInAttackBox(attackerPos, forwardDir, targetPos, width, depth) {
  const dx = targetPos.x - attackerPos.x
  const dz = targetPos.z - attackerPos.z

  // Project onto forward axis
  const forwardDist = dx * forwardDir.x + dz * forwardDir.z
  if (forwardDist < 0 || forwardDist > depth)
    return false

  // Project onto right axis (perpendicular to forward, 90° CW)
  const rightDist = dx * (-forwardDir.z) + dz * forwardDir.x
  if (Math.abs(rightDist) > width / 2)
    return false

  return true
}

/**
 * Calculate knockback direction from attacker to target
 * @param {THREE.Vector3} attackerPos
 * @param {THREE.Vector3} targetPos
 * @returns {THREE.Vector3} normalized direction (y=0)
 */
export function calculateKnockbackDir(attackerPos, targetPos) {
  const dir = new THREE.Vector3()
    .subVectors(targetPos, attackerPos)
    .normalize()
  dir.y = 0
  return dir
}

// ============================================================
// Debug Visualization
// ============================================================

/**
 * Create a debug wireframe box for attack zone visualization.
 * @param {number} color - hex color
 * @returns {THREE.LineSegments} debug box helper
 */
export function createAttackBoxHelper(color = 0xFF0000) {
  // 12 line segments = 24 vertices (bottom rect + top rect + 4 vertical edges)
  const positions = new Float32Array(24 * 3)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
    opacity: 0.6,
  })

  const lines = new THREE.LineSegments(geometry, material)
  lines.frustumCulled = false
  lines.renderOrder = 999
  return lines
}

/**
 * Update the attack box helper geometry to match current attack zone.
 * @param {THREE.LineSegments} helper - the debug box helper
 * @param {THREE.Vector3} attackerPos - attacker base position
 * @param {{x: number, z: number}} forwardDir - normalized forward direction
 * @param {number} width - box width
 * @param {number} depth - box depth
 * @param {number} height - box height for visualization (default 1.7)
 */
export function updateAttackBoxHelper(helper, attackerPos, forwardDir, width, depth, height = 1.7) {
  const arr = helper.geometry.attributes.position.array
  const hw = width / 2
  const rightX = -forwardDir.z
  const rightZ = forwardDir.x

  // 4 corners at ground level: near-left, near-right, far-left, far-right
  const nlX = attackerPos.x + rightX * (-hw)
  const nlZ = attackerPos.z + rightZ * (-hw)
  const nrX = attackerPos.x + rightX * hw
  const nrZ = attackerPos.z + rightZ * hw
  const flX = nlX + forwardDir.x * depth
  const flZ = nlZ + forwardDir.z * depth
  const frX = nrX + forwardDir.x * depth
  const frZ = nrZ + forwardDir.z * depth

  const yB = attackerPos.y
  const yT = attackerPos.y + height

  // 24 vertices = 12 line segments (bottom 4 + top 4 + vertical 4)
  const verts = [
    // Bottom rectangle
    nlX,
    yB,
    nlZ,
    nrX,
    yB,
    nrZ,
    nrX,
    yB,
    nrZ,
    frX,
    yB,
    frZ,
    frX,
    yB,
    frZ,
    flX,
    yB,
    flZ,
    flX,
    yB,
    flZ,
    nlX,
    yB,
    nlZ,
    // Top rectangle
    nlX,
    yT,
    nlZ,
    nrX,
    yT,
    nrZ,
    nrX,
    yT,
    nrZ,
    frX,
    yT,
    frZ,
    frX,
    yT,
    frZ,
    flX,
    yT,
    flZ,
    flX,
    yT,
    flZ,
    nlX,
    yT,
    nlZ,
    // Vertical edges
    nlX,
    yB,
    nlZ,
    nlX,
    yT,
    nlZ,
    nrX,
    yB,
    nrZ,
    nrX,
    yT,
    nrZ,
    flX,
    yB,
    flZ,
    flX,
    yT,
    flZ,
    frX,
    yB,
    frZ,
    frX,
    yT,
    frZ,
  ]

  for (let i = 0; i < verts.length; i++) {
    arr[i] = verts[i]
  }

  helper.geometry.attributes.position.needsUpdate = true
}
