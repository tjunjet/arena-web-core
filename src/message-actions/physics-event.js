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
            entityEl.body.position = {x: position[0], y: position[1], z: position[2]};
            const tempQuaternion = new THREE.Quaternion(rotation[0],
                rotation[1], rotation[2], rotation[3]);
            entityEl.body.quaternion.copy(tempQuaternion);
            entityEl.body.velocity = {x: linV[0], y: linV[1], z: linV[2]};
            entityEl.body.angularVelocity = {x: angV[0], y: angV[1], z: angV[2]};
            // Update AFrame attributes
            entityEl.object3D.position.set(position[0], position[1], position[2]);
            entityEl.object3D.quaternion.copy(tempQuaternion);
            break;
        default:
            break;
        }
    }
}
