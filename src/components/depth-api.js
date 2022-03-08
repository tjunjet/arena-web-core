/**
 * Scene-Level component to enable depth-api
 * @module depth-api
 */
AFRAME.registerComponent('depth-api', {
    schema: {
        usagePreference: {
            default: 'cpu-optimized',
            oneOf: ['cpu-optimized', 'gpu-optimized'],
        },
        dataFormatPreference: {
            default: 'luminance-alpha',
            oneOf: ['float32'],
        },
        updateRate: {type: 'number', default: 100},
    },
    init: function() {
        const webxrSys = this.el.sceneEl.systems.webxr;
        const requiredFeaturesArray = webxrSys.data.requiredFeatures;
        if (!requiredFeaturesArray.includes('depth-sensing')) {
            requiredFeaturesArray.push('depth-sensing');
            webxrSys.sessionConfiguration.depthSensing = {
                usagePreference: this.data.usagePreference,
                dataFormatPreference: this.data.dataFormatPreference,
            };
        }
        this.el.sceneEl.renderer.xr.addEventListener('sessionstart', () => {
            this.running = true;
        });
        this.el.sceneEl.renderer.xr.addEventListener('sessionend', () => {
            this.running = false;
        });
    },
});
