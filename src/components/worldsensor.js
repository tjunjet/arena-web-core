/* global AFRAME, ARENA */

/**
 * @fileoverview Dumps worldsense data, attach component to scene root
 * Based on world sense demo:
 * https://github.com/MozillaReality/webxr-ios-js/blob/master/examples/sensing/index.html
 */

AFRAME.registerComponent('world-sensor', {
    schema: {
        enabled: {type: 'boolean', default: true},
    },
    init: function() {
        this.worldMap = undefined;
        this.reporting = false;
        this.session= undefined;
        this.meshMap = new Map();
        const isWebXRViewer = navigator.userAgent.includes('WebXRViewer');

        if (isWebXRViewer) {
            // request worldsense access features
            const self = this;
            const scene = this.el.sceneEl;
            const optionalFeatures = scene.getAttribute('optionalFeatures');
            scene.setAttribute(
                'optionalFeatures',
                optionalFeatures + ',worldSensing',
            );

            scene.addEventListener('enter-vr', async function() {
                if (scene.is('ar-mode')) {
                    self.reporting = true;
                    self.session = scene.renderer.xr.getSession();
                    // TODO: Add custom referencespace after relocalization
                    // self.localReferenceSpace = await self.session.requestReferenceSpace('local-floor');
                    // self.viewerReferenceSpace = await self.session.requestReferenceSpace('viewer');

                    // self.workingMatrix = new THREE.Matrix4();

                    self.session.requestAnimationFrame(async (t, xrFrame) => {
                        // self.workingMatrix.copyPosition(
                        //     xrFrame.getPose(self.localReferenceSpace, self.viewerReferenceSpace).transform.matrix,
                        // );
                        //
                        // await xrFrame.addAnchor(self.workingMatrix, self.localReferenceSpace);

                        self.session.updateWorldSensingState({
                            illuminationDetectionState: {
                                enabled: true,
                            },
                            meshDetectionState: {
                                enabled: true,
                                normals: true,
                            },
                        });

                        self.session.requestAnimationFrame(self.handleAnimationFrame.bind(self));
                    });
                }
            });
            scene.addEventListener('exit-vr', function() {
                self.session = undefined;
                self.reporting = false;
                // self.viewerReferenceSpace = null;
                // self.localReferenceSpace = null;
            });
        } else {
            // TODO: Chrome WebXR Plane Detection API
        }
    },
    handleAnimationFrame: function(t, xrFrame) {
        if (!this.session || this.session.ended) return;

        this.session.requestAnimationFrame(this.handleAnimationFrame.bind(this));

        // const viewerPose = xrFrame.getViewerPose(this.localReferenceSpace);
        // if (!viewerPose) {
        //     console.log('No viewer pose');
        //     return;
        // }
        const worldInfo = xrFrame.worldInformation;

        if (worldInfo.meshes) {
            // this.meshMap.forEach(object => { object.seen = false }); // Persist

            worldInfo.meshes.forEach((worldMesh) => {
                const object = this.meshMap.get(worldMesh.uid);
                if (object) {
                    this.handleUpdateNode(worldMesh, object);
                } else {
                    this.handleNewNode(worldMesh);
                }
            });

            this.meshMap.forEach((object) => {
                if (!object.seen) {
                    this.handleRemoveNode(object);
                }
            });
            window.worldInfo = worldInfo;
            window.meshMap = this.meshMap;
        }
    },
    handleUpdateNode: function(worldMesh, object) {
        object.seen = true;

        // we don't need to do anything if the timestamp isn't updated
        if (worldMesh.timeStamp <= object.ts) {
            return;
        }

        const {uid, triangleIndices, vertexPositions, textureCoordinates, vertexNormals} = worldMesh;
        let updateMsg = {};

        if (worldMesh.vertexCountChanged) {
            const newMesh = this.newMeshNode(worldMesh);
            object.threeMesh.geometry.dispose();
            object.node.remove(object.threeMesh);
            object.node.add(newMesh);
            object.threeMesh = newMesh;
            updateMsg = {triangleIndices, vertexPositions, vertexNormals};
        } else {
            if (worldMesh.vertexPositionsChanged) {
                const position = object.threeMesh.geometry.attributes.position;
                if (position.array.length !== vertexPositions.length) {
                    console.error('position and vertex arrays are different sizes', position, worldMesh);
                }
                // position.setArray(vertexPositions);
                object.threeMesh.geometry.setAttribute('position', vertexPositions);
                position.needsUpdate = true;
                updateMsg.vertexPositions = vertexPositions;
            }
            if (worldMesh.textureCoordinatesChanged) {
                const uv = object.threeMesh.geometry.attributes.uv;
                if (uv.array.length !== textureCoordinates.length) {
                    console.error('uv and vertex arrays are different sizes', uv, worldMesh);
                }
                // uv.setArray(textureCoordinates);
                object.threeMesh.geometry.setAttribute('uv', textureCoordinates);
                uv.needsUpdate = true;
                updateMsg.textureCoordinates = textureCoordinates;
            }
            if (worldMesh.triangleIndicesChanged) {
                const index = object.threeMesh.geometry.index;
                if (index.array.length !== triangleIndices) {
                    console.error('uv and vertex arrays are different sizes', index, worldMesh);
                }
                // index.setArray(triangleIndices);
                object.threeMesh.geometry.setAttribute('index', triangleIndices);
                index.needsUpdate = true;
                updateMsg.triangleIndices = triangleIndices;
            }
            if (worldMesh.vertexNormalsChanged && vertexNormals.length > 0) {
                // normals are optional
                const normals = object.threeMesh.geometry.attributes.normals;
                if (normals.array.length !== vertexNormals) {
                    console.error('uv and vertex arrays are different sizes', normals, worldMesh);
                }
                // normals.setArray(vertexNormals);
                object.threeMesh.geometry.setAttribute('normals', vertexNormals);
                normals.needsUpdate = true;
                updateMsg.vertexNormals = vertexNormals;
            }
        }
        const fieldsUpdated = Object.keys(updateMsg);
        if (fieldsUpdated.length > 0 && !(fieldsUpdated.length === 1 && fieldsUpdated[0] === 'vertexPositions')) {
            publishMsg({uid, action: 'update', ...updateMsg});
        }
    },

    handleRemoveNode: function(object) {
        object.threeMesh.geometry.dispose();
        publishMsg({uid: object.worldMesh.uid, action: 'delete'});
        this.meshMap.delete(object.worldMesh.uid);
    },

    handleNewNode: function(worldMesh) {
        const worldMeshGroup = new THREE.Group();
        const mesh = this.newMeshNode(worldMesh);

        worldMeshGroup.add(mesh);

        const axesHelper = createAxesHelper([0.1, 0.1, 0.1]);
        worldMeshGroup.add(axesHelper);

        // worldMesh.node = worldMeshGroup;

        this.meshMap.set(worldMesh.uid, {
            ts: worldMesh.timeStamp,
            worldMesh: worldMesh,
            node: worldMeshGroup,
            seen: true,
            threeMesh: mesh,
        });
    },

    newMeshNode: function(worldMesh) {
        const edgeColor = '#11FF11';
        const polyColor = '#009900';

        const mesh = new THREE.Group();
        const geometry = new THREE.BufferGeometry();

        const {uid, triangleIndices, vertexPositions, textureCoordinates, vertexNormals} = worldMesh;

        const indices = new THREE.BufferAttribute(triangleIndices, 1);
        indices.setUsage(THREE.DynamicDrawUsage);
        geometry.setIndex(indices);

        const verticesBufferAttribute = new THREE.BufferAttribute(vertexPositions, 3);
        verticesBufferAttribute.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute('position', verticesBufferAttribute);

        const uvBufferAttribute = new THREE.BufferAttribute(textureCoordinates, 2);
        uvBufferAttribute.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute('uv', uvBufferAttribute);

        if (worldMesh.vertexNormals.length > 0) {
            const normalsBufferAttribute = new THREE.BufferAttribute(vertexNormals, 3);
            normalsBufferAttribute.setUsage(THREE.DynamicDrawUsage);
            geometry.setAttribute('normal', normalsBufferAttribute);
        } else {
            geometry.computeVertexNormals();
        }

        // transparent mesh
        const wireMaterial = new THREE.MeshPhongMaterial({color: edgeColor, wireframe: true});
        const material = new THREE.MeshPhongMaterial({color: polyColor, transparent: true, opacity: 0.25});

        mesh.add(new THREE.Mesh(geometry, material));
        mesh.add(new THREE.Mesh(geometry, wireMaterial));

        mesh.geometry = geometry; // for later use

        // worldMesh.mesh = mesh;

        publishMsg({uid, action: 'create', triangleIndices, vertexPositions, vertexNormals});

        return mesh;
    },
});

const publishMsg = (msg) => {
    console.log(msg);
    ARENA.Mqtt.publish(`realm/s/public/worldmap/scene_geometry_${ARENA.userName}`, JSON.stringify(msg));
};

const createAxesHelper = (size=[1, 1, 1]) => {
    const vertices = [
        0, 0, 0,	size[0], 0, 0,
        0, 0, 0,	0, size[1], 0,
        0, 0, 0,	0, 0, size[2],
    ];

    const colors = [
        1, 0, 0,	1, 0.6, 0,
        0, 1, 0,	0.6, 1, 0,
        0, 0, 1,	0, 0.6, 1,
    ];

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );

    const material = new THREE.LineBasicMaterial( {vertexColors: THREE.VertexColors} );

    const helper = new THREE.LineSegments(geometry, material);
    return helper;
};
