/**
 * @fileoverview Component that stays within the frustum of the camera.
*/

import almostEqual from 'almost-equal';

/* global AFRAME, THREE */

AFRAME.registerComponent('ui-panel', {
    schema: {
        width: {default: 1},
        height: {default: 1},
    },
    init: function() {
        this.el.setAttribute('geometry', {
            primitive: 'roundedbox',
            width: this.data.width,
            height: this.data.height,
            depth: 0.05,
        });
        this.el.setAttribute('scale', '0.5 0.5 0.5');
        this.el.setAttribute('material', {
            color: '#424470',
            opacity: 0.9,
        });
    },
});

AFRAME.registerComponent('rounded-button', {
    schema: {
        width: {default: 1},
        height: {default: 1},
        text: {type: 'string', default: 'Left'},
        textWidth: {default: 12},
        textAlign: {type: 'string', default: 'center'},
    },
    init: function() {
        this.el.setAttribute('geometry', {
            primitive: 'roundedbox',
            width: this.data.width,
            height: this.data.height,
            depth: 0.15,
        });
        this.orgZ = this.el.position.z;
        this.el.setAttribute('material', {
            opacity: 0.88,
        });
        this.el.position.z += 0.06;
        const label = document.createElement('a-asset');
        label.setAttribute('text', {
            value: this.data.text,
            width: this.data.width,
            align: this.data.textAlign,
        });
        this.el.append(label);
        this.el.addListener('mousedown', () => {
            this.el.position = this.orgZ + 0.035;
            this.el.setAttribute('geometry', 'depth', 0.1);
        });
        this.el.addListener('mouseup', () => {
            this.el.position = this.orgZ + 0.06;
            this.el.setAttribute('geometry', 'depth', 0.1);
        });
    },
});

AFRAME.registerComponent('ui-tracker', {
    schema: {
        enabled: {default: true},
        angularOffset: {type: 'number', default: 0.33},
        duration: {type: 'number', default: 750},
    },
    init: function() {
        const self = this;

        this.camera = document.getElementById('my-camera');
        this.activationObject = this.el.children[0];

        this.lastPosition = new THREE.Vector3().copy(this.el.getAttribute('position'));
        this.newRotation = new THREE.Euler().copy(this.el.object3D.rotation);

        this.lerpingPosition = false;
        this.lerpingRotation = false;

        this.startPosition = new THREE.Vector3();
        this.targetPosition = new THREE.Vector3();
        this.startRotation = new THREE.Quaternion();
        this.targetRotation = new THREE.Quaternion();

        this.activated = false;

        this.activationObject.addEventListener('mouseenter', function(evt) {
            // self.activationObject.object3D.scale.set(0.5, 0.5, 0.5);
        });
        this.activationObject.addEventListener('mouseleave', function(evt) {
            // self.activationObject.object3D.scale.set(0.4, 0.4, 0.4);
        });
        this.activationObject.addEventListener('mousedown', function(evt) {
            this.activated = !this.activated;
            self.activationObject.children[0].object3D.visible = this.activated;
        });
    },
    tick: function() {
        if (this.data.enabled) {
            this.updateCameraRotation();
            this.checkForComponentChanged();

            let progress;
            const now = Date.now();
            const obj3d = this.el.object3D;

            // Lerp position
            if (this.lerpingPosition) {
                progress = (now - this.startLerpTimePosition) / this.data.duration;
                obj3d.position.lerpVectors(this.startPosition, this.targetPosition, Math.min(progress, 1));
                // console.log("new position", obj3d.position);
                if (progress >= 1) {
                    this.lerpingPosition = false;
                }
            }

            // Slerp rotation
            if (this.lerpingRotation) {
                progress = (now - this.startLerpTimeRotation) / this.data.duration;
                const cappedProgress = 1 - this.data.angularOffset;
                obj3d.quaternion.slerpQuaternions(
                    this.startRotation, this.targetRotation, Math.min(progress, cappedProgress),
                );
                if (progress >= cappedProgress) {
                    this.lerpingRotation = false;
                    this.newRotation.copy(obj3d.rotation);
                }
            }
        }
    },

    updateCameraRotation: function() {
        if (this.camera.components['arena-camera'] && !this.lerpingRotation &&
            !this.camera.components['arena-camera'].viewIntersectsObject3D(this.activationObject.object3D)) {
            this.newRotation.copy(this.camera.object3D.rotation);
        }
    },

    checkForComponentChanged: function() {
        const curPosition = this.camera.getAttribute('position');
        if (!this.almostEqualVec3(this.lastPosition, curPosition)) {
            this.toPosition(this.lastPosition, curPosition);
            this.lastPosition.copy(curPosition);
        }

        if (!this.lerpingRotation && !this.almostEqualVec3(this.el.object3D.rotation, this.newRotation)) {
            this.toRotation(this.el.object3D.rotation, this.newRotation);
        }
    },

    /**
     * Start lerp to position (vec3)
     */
    toPosition: function(from, to) {
        this.lerpingPosition = true;
        this.startLerpTimePosition = Date.now();
        this.startPosition.set(from.x, from.y, from.z);
        this.targetPosition.set(to.x, to.y, to.z);
    },

    /**
     * Start lerp to euler rotation (vec3,'YXZ')
     */
    toRotation: function(from, to) {
        this.lerpingRotation = true;
        this.startLerpTimeRotation = Date.now();
        this.startRotation.setFromEuler(from);
        this.targetRotation.setFromEuler(to);
    },

    almostEqualVec3: function(a, b) {
        return almostEqual(a.x, b.x) && almostEqual(a.y, b.y) && almostEqual(a.z, b.z);
    },
});
