import {Logger} from './logger.js';
import {ARENAUtils} from '../utils.js';

// handle actions
const ACTIONS = {
    CREATE: 'create',
    UPDATE: 'update',
};

// default render order of objects; reserve 0 for occlusion
const RENDER_ORDER = 1;

/**
 * Create/Update object handler
 */
export class CreateUpdate {
    /**
     * Create/Update handler
     * @param {int} action action to carry out; one of: ACTIONS.CREATE, ACTIONS.UPDATE
     * @param {object} message message to be parsed
     */
    static handle(action, message) {
        const id = message.id;

        switch (message.type) {
        case 'object':
            // our own camera/controllers: bail, this message is meant for all other viewers
            if (id === ARENA.camName) {
                return;
            }
            if (id === ARENA.handLName) {
                return;
            }
            if (id === ARENA.handRName) {
                return;
            }
            if (id === ARENA.faceName) {
                return;
            }

            let entityEl = document.getElementById(id);

            if (action === ACTIONS.CREATE) {
                // delete object, if exists; ensures create clears all attributes
                if (entityEl) {
                    const parentEl = entityEl.parentEl;
                    if (parentEl) {
                        parentEl.removeChild(entityEl);
                    } else {
                        Logger.error('create', `Could not find parent of object_id "${id}" to clear object properties.`);
                    }
                    entityEl = undefined;
                }
            } else if (action === ACTIONS.UPDATE) {
                // warn that update to non-existing object will create it
                if (!entityEl) {
                    Logger.warning('update', `Object with object_id "${id}" does not exist; Creating...`);
                }
            }

            // create entity, if does not exist
            let addObj = false;
            if (!entityEl) {
                // create object
                if (message.data.object_type === 'videosphere') {
                    entityEl = document.createElement('a-videosphere');
                } else {
                    entityEl = document.createElement('a-entity');
                }
                entityEl.setAttribute('id', id);
                // after setting object attributes, we will add it to the scene
                addObj = true;
            }

            // set to default render order
            entityEl.object3D.renderOrder = RENDER_ORDER;

            // handle attributes of object
            if (!this.setObjectAttributes(entityEl, message)) return;

            // add object to the scene after setting all attributes
            if (addObj) {
                // Parent/Child handling
                if (message.data.parent) {
                    let parentName = message.data.parent;
                    if (ARENA.camName === message.data.parent) { // our camera is named 'my-camera'
                        if (!message.data.camera) { // Don't attach extra cameras, use own id to skip
                            parentName = 'my-camera';
                        } else {
                            return;
                        }
                    }
                    const parentEl = document.getElementById(parentName);
                    if (parentEl) {
                        entityEl.removeAttribute('parent');
                        entityEl.flushToDOM();
                        parentEl.appendChild(entityEl);
                    } else {
                        Logger.warning('create', 'Orphaned:', `${id} cannot find parent: ${message.data.parent}!`);
                    }
                } else {
                    const sceneRoot = document.getElementById('sceneRoot');
                    sceneRoot.appendChild(entityEl);
                }
            }

            if (message.ttl !== undefined) { // Allow falsy value of 0
                entityEl.setAttribute('ttl', {seconds: message.ttl});
            }

            return;

        case 'camera-override':
            if (id !== ARENA.camName) return; // bail if not for us
            this.handleCameraOverride(action, message);
            return;

        case 'rig':
            if (id === ARENA.camName) { // our camera Rig
                const cameraSpinnerObj3D = document.getElementById('cameraSpinner').object3D;
                const cameraRigObj3D = document.getElementById('cameraRig').object3D;
                const {position, rotation} = message.data;
                if (rotation) {
                    if (rotation.hasOwnProperty('w')) { // has 'w' coordinate: a quaternion
                        cameraSpinnerObj3D.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
                    } else { // otherwise its a rotation given in degrees
                        cameraSpinnerObj3D.rotation.set(
                            THREE.MathUtils.degToRad(rotation.x),
                            THREE.MathUtils.degToRad(rotation.y),
                            THREE.MathUtils.degToRad(rotation.z),
                        );
                    }
                }
                if (position) {
                    cameraRigObj3D.position.set(position.x, position.y, position.z);
                }
            }
            return;

        case 'scene-options':
            // update env-presets section in real-time
            const environmentOld = document.getElementById('env');
            const environment = document.createElement('a-entity');
            environment.id = 'env';
            const envPresets = message.data['env-presets'];
            for (const [attribute, value] of Object.entries(envPresets)) {
                environment.setAttribute('environment', attribute, value);
            }
            environmentOld.parentNode.replaceChild(environment, environmentOld);
            return;

        case 'face-features':
        case 'landmarks':
            // TODO : Remove once all existing persist landmark entities have converted
            return;

        default:
            Logger.warning((action === ACTIONS.UPDATE) ? 'update':'create', 'Unknown type:', JSON.stringify(message));
        }
    }

    /**
     * Handles object attributes
     * @param {object} entityEl the new aframe object
     * @param {object} message message to be parsed
     */
    static setObjectAttributes(entityEl, message) {
        const data = message.data;
        let type = data.object_type;
        delete data.object_type; // remove attribute so we don't set it later

        if (!type) {
            Logger.warning('Update/Create:', 'Malformed message; type is undefined; attributes might not be set correctly.');
        }

        // handle geometries and some type special cases
        // TODO: using components (e.g. for headtext, image, ...) that handle these would allow to remove most of the
        // special cases
        let isGeometry = false;
        switch (type) {
        case 'camera':
            if (data.hasOwnProperty('color')) {
                entityEl.setAttribute('arena-user', 'color', data.color);
            }
            if (data.hasOwnProperty('headModelPath')) {
                entityEl.setAttribute('arena-user', 'headModelPath', data.headModelPath); // update head model
            }
            if (data.hasOwnProperty('presence')) {
                entityEl.setAttribute('arena-user', 'presence', data.presence); // update presence
            }
            // decide if we need draw or delete videoCube around head
            if (message.hasOwnProperty('jitsiId')) {
                entityEl.setAttribute('arena-user', 'jitsiId', message.jitsiId);
                entityEl.setAttribute('arena-user', 'hasVideo', message.hasVideo);
                entityEl.setAttribute('arena-user', 'hasAudio', message.hasAudio);
            }
            if (message.hasOwnProperty('displayName')) {
                entityEl.setAttribute('arena-user', 'displayName', message.displayName); // update head text
            }
            break;
        case 'gltf-model':
            if (ARENA.armode && data.hasOwnProperty('hide-on-enter-ar')) {
                console.warn(`Skipping hide-on-enter-ar GLTF: ${entityEl.getAttribute('id')}`);
                return false; // do not add this object
            }
            if (ARENA.vr && data.hasOwnProperty('hide-on-enter-vr')) {
                console.warn(`Skipping hide-on-enter-vr GLTF: ${entityEl.getAttribute('id')}`);
                return false; // do not add this object
            }
            // support both url and src property
            if (data.hasOwnProperty('url')) {
                data.src = data.url; // make src=url
                delete data.url; // remove attribute so we don't set it later
            }
            // gltf is a special case in that the src is applied to the component 'gltf-model'
            if (data.hasOwnProperty('src')) {
                entityEl.setAttribute('gltf-model', ARENAUtils.crossOriginDropboxSrc(data.src));
                delete data.src; // remove attribute so we don't set it later
            }
            // add attribution by default, if not given
            if (!data.hasOwnProperty('attribution')) {
                entityEl.setAttribute('attribution', 'extractAssetExtras', true);
            }
            break;
        case 'headtext':
            // handle changes to other users head text
            if (message.hasOwnProperty('displayName')) {
                entityEl.setAttribute('arena-user', 'displayName', message.displayName); // update head text
            }
            break;
        case 'image':
            // image is just a textured plane
            // TODO: create an aframe component for this
            entityEl.setAttribute('geometry', 'primitive', 'plane');
            if (data.hasOwnProperty('url')) {
                entityEl.setAttribute('material', 'src', ARENAUtils.crossOriginDropboxSrc(data.url));
                delete data.url; // remove attribute so we don't set it later
            }
            if (data.hasOwnProperty('src')) {
                entityEl.setAttribute('material', 'src', ARENAUtils.crossOriginDropboxSrc(data.src));
                delete data.src; // remove attribute so we don't set it later
            }
            if (!data.hasOwnProperty('material-extras')) {
                // default images to sRGBEncoding, if not specified
                entityEl.setAttribute('material-extras', 'encoding', 'sRGBEncoding');
                entityEl.setAttribute('material-extras', 'needsUpdate', 'true');
            }
            delete data.image; // no other properties applicable to image; delete it
            break;
        case 'text':
            // Support legacy `data: { text: 'STRING TEXT' }`
            const theText = data.text;
            if (typeof theText === 'string' || theText instanceof String) {
                entityEl.setAttribute('text', 'value', data.text);
                delete data.text;
            }
            if (!data.hasOwnProperty('side')) entityEl.setAttribute('text', 'side', 'double'); // default to double (aframe default=front)
            if (!data.hasOwnProperty('width')) entityEl.setAttribute('text', 'width', 5); // default to width to 5 (aframe default=derived from geometry)
            if (!data.hasOwnProperty('align')) entityEl.setAttribute('text', 'align', 'center'); // default to align to center (aframe default=left)
            break;
        case 'handLeft':
        case 'handRight':
            entityEl.setAttribute('gltf-model', data.url);
            delete data[type];
            break;
        case 'cube':
            type='box'; // arena legacy! new libraries/persist objects should use box!
        case 'box':
        case 'circle':
        case 'cone':
        case 'cylinder':
        case 'dodecahedron':
        case 'icosahedron':
        case 'octahedron':
        case 'plane':
        case 'ring':
        case 'sphere':
        case 'tetrahedron':
        case 'torus':
        case 'torusKnot':
        case 'triangle':
            // handle A-Frame geometry types here for performance (custom geometries are handled in the default case)
            if (type) {
                entityEl.setAttribute('geometry', 'primitive', type);
                isGeometry = true;
            }
            break;
        default:
            // check if the type is a registered geometry (that we do not catch in the cases above)
            if (AFRAME.geometries[type]) {
                entityEl.setAttribute('geometry', 'primitive', type);
                isGeometry = true;
            }
        } // switch(type)

        // handle geometry attributes
        if (isGeometry) {
            this.setGeometryAttributes(entityEl, data, type);
        }

        if (!isGeometry && type) {
            // check if we have a registered component (type = component name) that takes the attributes received
            this.setComponentAttributes(entityEl, data, type);
        }

        // what remains in data are components we set as attributes of the entity
        this.setEntityAttributes(entityEl, data);

        if (typeof ARENA.clickableOnlyEvents !== 'undefined' && !ARENA.clickableOnlyEvents) {
            // unusual case: clickableOnlyEvents = true by default
            if (!entityEl.hasOwnProperty('click-listener')) {
                // attach click-listener to all objects that don't already have them
                entityEl.setAttribute('click-listener', '');
            }
        }
        return true;
    }

    /**
     * Handles geometry primitive attributes
     * @param {object} entityEl the new aframe object
     * @param {object} data data part of the message with the attributes
     * @param {string} gName geometry name
     */
    static setGeometryAttributes(entityEl, data, gName) {
        if (!AFRAME.geometries[gName]) return; // no geometry registered with this name
        for (const [attribute, value] of Object.entries(data)) {
            if (AFRAME.geometries[gName].Geometry.prototype.schema[attribute]) {
                entityEl.setAttribute('geometry', attribute, value);
                delete data[attribute]; // we handled this attribute; remove it
            }
        }
    }

    /**
     * Handles component attributes
     * Check if we have a registered component that takes the attributes given in data
     * @param {object} entityEl the new aframe object
     * @param {object} data data part of the message with the attributes
     * @param {string} cName component name
     */
    static setComponentAttributes(entityEl, data, cName) {
        if (!AFRAME.components[cName]) return; // no component registered with this name
        for (let [attribute, value] of Object.entries(data)) {
            if (AFRAME.components[cName].Component.prototype.schema[attribute]) {
                // replace dropbox links in any 'src' or 'url' attributes
                if (attribute == 'src' || attribute == 'url') value = ARENAUtils.crossOriginDropboxSrc(value);
                if (value === null) { // if null, remove attribute
                    entityEl.removeAttribute(cName);
                } else {
                    entityEl.setAttribute(cName, attribute, value);
                }
                delete data[attribute]; // we handled this attribute; remove it
            }
        }
    }

    /**
     * Handles entity attributes (components)
     *
     * @param {object} entityEl the new aframe object
     * @param {object} data data part of the message with the attributes
     */
    static setEntityAttributes(entityEl, data) {
        for (const [attribute, value] of Object.entries(data)) {
            // console.info("Set entity attribute [id type - attr value]:", entityEl.getAttribute('id'), attribute, value);
            // handle some special cases for attributes (e.g. attributes set directly to the THREE.js object);
            // default is to let aframe handle attributes directly
            switch (attribute) {
            case 'rotation':
                // rotation is set directly in the THREE.js object, for performance reasons
                if (value.hasOwnProperty('w')) entityEl.object3D.quaternion.set(value.x, value.y, value.z, value.w); // has 'w' coordinate: a quaternion
                else entityEl.object3D.rotation.set( THREE.MathUtils.degToRad(value.x), THREE.MathUtils.degToRad(value.y), THREE.MathUtils.degToRad(value.z)); // otherwise its a rotation given in degrees
                break;
            case 'position':
                // position is set directly in the THREE.js object, for performance reasons
                entityEl.object3D.position.set(value.x, value.y, value.z);
                break;
            case 'color':
                if (!entityEl.hasOwnProperty('text')) {
                    entityEl.setAttribute('material', 'color', value);
                } else {
                    entityEl.setAttribute('text', 'color', value);
                }
                break;
            case 'scale':
                // scale is set directly in the THREE.js object, for performance reasons
                entityEl.object3D.scale.set(value.x, value.y, value.z);
                break;
            case 'ttl':
                // ttl is applied to property 'seconds' of ttl component
                entityEl.setAttribute('ttl', {seconds: value});
                break;
            case 'src':
            case 'url':
                // replace dropbox links in any 'src'/'url' attributes that get here
                entityEl.setAttribute(attribute, ARENAUtils.crossOriginDropboxSrc(value));
            default:
                // all other attributes are pushed directly to aframe
                if (value === null) { // if null, remove attribute
                    entityEl.removeAttribute(attribute);
                } else {
                    // replace dropbox links in any url or src attribute inside value
                    if (value.hasOwnProperty('src')) value.src = ARENAUtils.crossOriginDropboxSrc(value.src);
                    if (value.hasOwnProperty('url')) value.url = ARENAUtils.crossOriginDropboxSrc(value.url);
                    entityEl.setAttribute(attribute, value);
                }
            } // switch attribute
        }
    }

    /**
     * Camera override handler
     * @param {string} action message action
     * @param {object} message message to be parsed
     */
    static handleCameraOverride(action, message) {
        if (action !== ACTIONS.UPDATE) return; // camera override must be an update

        const myCamera = document.getElementById('my-camera');

        if (message.data.object_type === 'camera') { // camera override
            if (!myCamera) {
                Logger.error('camera override', 'local camera object does not exist! (create camera before)');
                return;
            }
            const p = message.data.position;
            if (p) myCamera.object3D.position.set(p.x, p.y, p.z);
            const r = message.data.rotation;
            if (r) {
                myCamera.components['look-controls'].yawObject.rotation.setFromQuaternion(
                    new THREE.Quaternion(r.x, r.y, r.z, r.w));
                Logger.warning('camera override', message);
            }
        } else if (message.data.object_type === 'look-at') { // camera look-at
            if (!myCamera) {
                Logger.error('camera look-at', 'local camera object does not exist! (create camera before)');
                return;
            }
            let target = message.data.target;
            if (!target.hasOwnProperty('x')) { // check if an object id was given
                const targetObj = document.getElementById(target);
                if (targetObj) target = targetObj.object3D.position; // will be processed as x, y, z below
                else {
                    Logger.error('camera look-at', 'target not found.');
                    return;
                }
            }
            // x, y, z given
            if (target.hasOwnProperty('x') &&
                target.hasOwnProperty('y') &&
                target.hasOwnProperty('z')) {
                myCamera.components['look-controls'].yawObject.lookAt( target.x, target.y, target.z );
                myCamera.components['look-controls'].pitchObject.lookAt( target.x, target.y, target.z );
                Logger.warning('camera look-at', message);
            }
        }
    }
}
