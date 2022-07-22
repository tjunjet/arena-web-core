/* global AFRAME */

/**
 * @fileoverview Dumps worldsense data, attach to the scene element
 */

AFRAME.registerComponent('world-sensor', {
    schema: {
        updateRate: {type: 'number', default: 1000},
        enabled: {type: 'boolean', default: true},
    },
    init: function() {
        this.worldMap = undefined;
        this.reporting = false;
        this.session= undefined;
        const isWebXRViewer = navigator.userAgent.includes('WebXRViewer');
        if (isWebXRViewer) {
            const self = this;
            const scene = this.el.sceneEl;
            scene.addEventListener('enter-vr', function() {
                if (scene.is('ar-mode')) {
                    self.reporting = true;
                    self.session = scene.renderer.xr.getSession();
                    self.session.updateWorldSensingState({
                        illuminationDetectionState: {
                            enabled: true,
                        },
                        meshDetectionState: {
                            enabled: true,
                            normals: true,
                        },
                    });
                    console.log('World sensing status:', self.session.nonStandard_getWorldMappingStatus());
                }
            });
            scene.addEventListener('exit-vr', function() {
                self.session = undefined;
                self.reporting = false;
            });
        }
        this.tick = AFRAME.utils.throttleTick(this.tick, this.data.updateRate, this);
    },
    tick: function() {
        if (this.reporting && this.session && this.data.enabled) {
            this.session.nonStandard_getWorldMap().then((worldMap) => {
                self.worldMap = worldMap;
                console.log('got worldMap, size = ', worldMap.worldMap.length);
                console.log(worldMap);
            }).catch((err) => {
                console.error('Could not get world Map', err);
                self.worldMap = null;
            });
        }
    },
});
