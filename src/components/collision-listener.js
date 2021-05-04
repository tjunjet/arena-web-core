/* global AFRAME, ARENA */

/**
 * @fileoverview Listen for collisions, callback on event.
 *
 * Open source software under the terms in /LICENSE
 * Copyright (c) 2020, The CONIX Research Center. All rights reserved.
 * @date 2020
 */

/**
 * Listen for collisions, callback on event.
 * Requires [Physics for A-Frame VR]{@link https://github.com/n5ro/aframe-physics-system}
 * @module collision-listener
 * @requires aframe-physics-system
 * @property {string} action - ['publish', 'teleport', 'url']
 * @property {any} target - URl target, or Vector3-like object
 * @property {string} animationEffect - Clientside clip to play when event happens
 * @property {boolean} playSound - play sound if this element has a sound component
 */
AFRAME.registerComponent('collision-listener', {
    schema: {
        action: {default: 'publish', oneOf: ['publish', 'teleport', 'url']},
        target: {default: null},
        animationEffect: {default: null},
        playSound: {default: false},
    },

    publish: function(evt) {
        // colliding object, only act if is clients' own
        const collider = evt.detail.body.el.id;
        if (collider !== 'my-camera') {
            return;
        }

        // const coordsData = ARENAUtils.setClickData(evt);
        const coordsData = {
            x: 0,
            y: 0,
            z: 0,
        };

        // original click event; simply publish to MQTT
        const thisMsg = {
            object_id: this.id,
            action: 'clientEvent',
            type: 'collision',
            data: {
                position: coordsData,
                source: collider,
            },
        };
        // publishing events attached to user id objects allows sculpting security
        ARENA.Mqtt.publish(ARENA.outputTopic + ARENA.camName, thisMsg);
    },

    teleport: function(evt) {
        const collider = evt.detail.body.el.id;
        if (collider !== 'my-camera' || !this.data.target) {
            return;
        }
        const dest = new THREE.Vector3(this.data.target.x, this.data.target.y,
            this.data.target.z);
        const navSys = this.el.sceneEl.systems.nav;
        if (this.data.constrainToNavMesh !== 'false' && navSys.navMesh) {
            const closestGroup = navSys.getGroup(dest, false);
            const closestNode = navSys.getNode(dest, closestGroup, false);
            if (closestNode) {
                navSys.clampStep(dest, dest, closestGroup, closestNode, dest);
            }
        }
        const myCam = document.getElementById('my-camera');
        myCam.object3D.position.copy(dest).y += ARENA.defaults.camHeight;
    },

    gotoURL: function(evt) {
        const collider = evt.detail.body.el.id;
        if (collider !== 'my-camera' || !this.data.target) {
            return;
        }
        window.location.replace(this.data.target);
    },

    // listen for collisions, call defined function on event evt
    init: function() {
        const actions = {
            'publish': this.publish,
            'teleport': this.teleport,
            'url': this.gotoURL,
        };
        this.el.addEventListener('collide', (evt) => {
            if (this.data.animationEffect) {
                this.el.setAttribute('animation-mixer', {
                    clip: this.data.animationEffect,
                    loop: 'once',
                });
            }
            if (this.data.playSound && this.el.components.sound ) {
                this.el.components.sound.playSound();
            }
            actions[this.data.action](evt);
        });
    },
});
