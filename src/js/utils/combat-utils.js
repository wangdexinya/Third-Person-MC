import * as THREE from 'three'

/**
 * Checks if target is within attack range and cone angle
 * @param {THREE.Vector3} attackerPos
 * @param {number} attackerFacingAngle (radians)
 * @param {THREE.Vector3} targetPos
 * @param {number} range
 * @param {number} fov (radians, e.g. Math.PI/2 for 90 degrees)
 * @returns {boolean} true if target is within attack cone
 */
export function isInAttackCone(attackerPos, attackerFacingAngle, targetPos, range, fov = Math.PI / 2) {
  const dist = attackerPos.distanceTo(targetPos)
  if (dist > range)
    return false

  // Calculate angle to target
  const dx = targetPos.x - attackerPos.x
  const dz = targetPos.z - attackerPos.z
  const angleToTarget = Math.atan2(dx, dz)

  // Normalize angles to -PI to PI
  let angleDiff = angleToTarget - attackerFacingAngle
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

  return Math.abs(angleDiff) <= (fov / 2)
}

/**
 * Calculate knockback direction from attacker to target
 * @param {THREE.Vector3} attackerPos
 * @param {THREE.Vector3} targetPos
 * @returns {THREE.Vector3} Normalized direction (y=0)
 */
export function calculateKnockbackDir(attackerPos, targetPos) {
  const dir = new THREE.Vector3()
    .subVectors(targetPos, attackerPos)
    .normalize()
  dir.y = 0
  return dir
}
