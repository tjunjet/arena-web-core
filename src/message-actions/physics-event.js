/* global THREE */
import {Logger} from './logger.js';

/**
 * Physics Event handler
 */
export class PhysicsEvent {
    /**
     * Client Event handler
     * @param {object} message message to be parsed
     */
    static handle(message) {
        const id = message.id;
        const data = message.data;

        const entityEl = document.getElementById(id);
        if (!entityEl) {
            Logger.error('physicsEvent',
                `Object with object_id "${id}" does not exist!`);
            return;
        }
        if (entityEl.body === undefined ||
            !(entityEl.hasAttribute('static-body') ||
                entityEl.hasAttribute('dynamic-body'))) {
            Logger.error('physicsEvent',
                `Object with object_id "${id}" is not a physics-aware object!`);
            return;
        }

        switch (message.type) {
        // Future physicsEvent types
        case 'object':
            const {
                position,
                rotation,
                linear_velocity: linV,
                angular_velocity: angV,
            } = data;
            // Update physics first
            entityEl.body.position = new CANNON.Vec3(...position);
            const tempQuaternion = new THREE.Quaternion(...rotation);
            entityEl.body.quaternion.copy(tempQuaternion);
            entityEl.body.velocity = new CANNON.Vec3(...linV);
            entityEl.body.angularVelocity = new CANNON.Vec3(...angV);
            // Update AFrame attributes
            entityEl.object3D.position.set(...position);
            entityEl.object3D.quaternion.copy(tempQuaternion);
            break;
        default:
            break;
        }
    }
}
