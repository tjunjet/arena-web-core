/* global AFRAME, ARENA */

/**
 * @fileoverview Tracking Hand controller movement in real time.
 *
 * Open source software under the terms in /LICENSE
 * Copyright (c) 2020, The CONIX Research Center. All rights reserved.
 * @date 2020
 */

// path to controler models
const handControllerPath = {
    Left: 'static/models/hands/valve_index_left.gltf',
    Right: 'static/models/hands/valve_index_right.gltf',
};

/**
 * Generates a hand event
 * @param {Object} evt event
 * @param {string} eventName name of event, i.e. 'triggerup'
 * @param {Object} myThis reference to object that generated the event
 * @private
 */
function eventAction(evt, eventName, myThis) {
    const newPosition = new THREE.Vector3();
    myThis.object3D.getWorldPosition(newPosition);

    const coordsData = {
        x: newPosition.x.toFixed(3),
        y: newPosition.y.toFixed(3),
        z: newPosition.z.toFixed(3),
    };

    // publish to MQTT
    const objName = myThis.name;
    if (objName) {
        // publishing events attached to user id objects allows sculpting security
        ARENA.Mqtt.publish(`${ARENA.outputTopic}${objName}`, {
            object_id: objName,
            action: 'clientEvent',
            type: eventName,
            data: {
                position: coordsData,
                source: ARENA.camName,
            },
        });
    }
}

/**
 *  Tracking Hand controller movement in real time.
 * @module arena-hand
 * @property {boolean} enabled - Controller enabled.
 * @property {string} hand - Controller hand.
 *
 */
AFRAME.registerComponent('arena-hand', {
    dependencies: ['laser-controls'],
    schema: {
        enabled: {type: 'boolean', default: false},
        hand: {type: 'string', default: 'left'},
    },

    init: function() {
        const el = this.el;
        const data = this.data;

        this.rotation = new THREE.Quaternion();
        this.position = new THREE.Vector3();

        this.lastPose = '';

        // capitalize hand type
        data.hand = data.hand.charAt(0).toUpperCase() + data.hand.slice(1);

        this.name = data.hand === 'Left' ? ARENA.handLName : ARENA.handRName;

        el.addEventListener('controllerconnected', () => {
            el.setAttribute('visible', true);
            ARENA.Mqtt.publish(`${ARENA.outputTopic}${this.name}`, {
                object_id: this.name,
                action: 'create',
                type: 'object',
                data: {
                    object_type: `hand${data.hand}`,
                    position: {x: 0, y: -1, z: 0},
                    url: this.getControllerURL(),
                    dep: ARENA.camName,
                },
            });
            data.enabled = true;
        });

        el.addEventListener('controllerdisconnected', () => {
            el.setAttribute('visible', false);
            // when disconnected, try to cleanup hands
            ARENA.Mqtt.publish(`${ARENA.outputTopic}${this.name}`, {
                object_id: this.name,
                action: 'delete',
            });
        });

        /*
        el.addEventListener('triggerup', function(evt) {
            eventAction(evt, 'triggerup', this);
        });
        el.addEventListener('triggerdown', function(evt) {
            eventAction(evt, 'triggerdown', this);
        });
        el.addEventListener('gripup', function(evt) {
            eventAction(evt, 'gripup', this);
        });
        el.addEventListener('gripdown', function(evt) {
            eventAction(evt, 'gripdown', this);
        });
        el.addEventListener('menuup', function(evt) {
            eventAction(evt, 'menuup', this);
        });
        el.addEventListener('menudown', function(evt) {
            eventAction(evt, 'menudown', this);
        });
        el.addEventListener('systemup', function(evt) {
            eventAction(evt, 'systemup', this);
        });
        el.addEventListener('systemdown', function(evt) {
            eventAction(evt, 'systemdown', this);
        });
        el.addEventListener('trackpadup', function(evt) {
            eventAction(evt, 'trackpadup', this);
        });
        el.addEventListener('trackpaddown', function(evt) {
            eventAction(evt, 'trackpaddown', this);
        });
         */

        this.tick = AFRAME.utils.throttleTick(this.tick, ARENA.camUpdateIntervalMs, this);
    },

    getControllerURL() {
        const el = this.el;
        const data = this.data;

        let url = el.getAttribute('gltf-model');
        if (!url) url = handControllerPath[data.hand];

        return url;
    },

    publishPose() {
        const data = this.data;
        if (!data.enabled || !data.hand) return;
        // const hand = data.hand.charAt(0).toUpperCase() + data.hand.slice(1);

        const msg = {
            object_id: this.name,
            action: 'update',
            type: 'object',
            data: {
                object_type: `hand${this.data.hand}`,
                position: {
                    x: parseFloat(this.position.x.toFixed(3)),
                    y: parseFloat(this.position.y.toFixed(3)),
                    z: parseFloat(this.position.z.toFixed(3)),
                },
                rotation: {
                    x: parseFloat(this.rotation._x.toFixed(3)),
                    y: parseFloat(this.rotation._y.toFixed(3)),
                    z: parseFloat(this.rotation._z.toFixed(3)),
                    w: parseFloat(this.rotation._w.toFixed(3)),
                },
                url: this.getControllerURL(),
                dep: ARENA.camName,
            },
        };
        ARENA.Mqtt.publish(`${ARENA.outputTopic}${this.name}`, msg);
    },

    tick: (function(t, dt) {
        if (!this.name) {
            this.name = this.data.hand === 'Left' ? ARENA.handLName : ARENA.handRName;
        }

        this.rotation.setFromRotationMatrix(this.el.object3D.matrixWorld);
        this.position.setFromMatrixPosition(this.el.object3D.matrixWorld);

        const rotationCoords = AFRAME.utils.coordinates.stringify(this.rotation);
        const positionCoords = AFRAME.utils.coordinates.stringify(this.position);

        const newPose = rotationCoords + ' ' + positionCoords;
        if (this.lastPose !== newPose) {
            this.publishPose();
            this.lastPose = newPose;
        }
    }),
});
