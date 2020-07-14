/*
 * @Author: hongxu.lin
 * @Date: 2020-07-13 23:17:41
 * @LastEditTime: 2020-07-14 22:52:22
 */

export class Viewer3D {
    constructor() {
        this.container = null;
        this.stats = null;
        this.controls = null;
        this.camera = null;
        this.scene = null;
        this.renderer = null;
        this.gl = null;

        this.cube = null;
        this.lineRoot = null;
        this.currentPin = null;
        this.currentLineSeg = null;
        this.geometryreticle = null;
        this.materialreticle = null;
        this.lines = [];
    }

    // webgl
    initWebgl() {
        this.camera = new THREE.PerspectiveCamera(
            90,
            window.innerWidth / window.innerHeight,
            0.01,
            2000
        );
        this.camera.matrixAutoUpdate = false;
        this.camera.fov = 90;
        this.scene = new THREE.Scene();

        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            preserveDrawingBuffer: true,
        });
        this.renderer.autoClear = false;

        document.body.insertBefore(
            this.renderer.domElement,
            document.body.firstChild
        );

        let geometryreticle = new THREE.RingGeometry(0.005, 0.01, 32, 1);
        let materialreticle = new THREE.MeshBasicMaterial({
            color: 0xffffff,
        });
        // Orient the geometry so its position is flat on a horizontal surface
        geometryreticle.applyMatrix(
            new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(-90))
        );

        this.currentPin = new THREE.Mesh(geometryreticle, materialreticle);
        this.currentPin.visible = false;
        this.scene.add(this.currentPin);

        this.lineRoot = new THREE.Group();
        this.scene.add(this.lineRoot);

        this.matLine = new THREE.LineMaterial({
            color: 0x27a22c,
            linewidth: 10, // in pixels
            dashed: false,
        });

        this.setInteractions();
    }

    setInteractions() {
        document
            .querySelector("#placementBtn")
            .addEventListener("click", () => {
                if (this.currentPin.visible) {
                    if (this.currentLineSeg == null) {
                        document.querySelector("#placementBtn").innerText =
                            "结束";
                        this.currentLineSeg = new lineSeg(
                            this.lineRoot,
                            this.currentPin,
                            this.matLine
                        );
                        this.currentLineSeg.start.position.copy(
                            this.currentPin.position
                        );
                        this.lines.push(this.currentLineSeg);
                    } else {
                        this.currentLineSeg.end.position.copy(
                            this.currentPin.position
                        );
                        this.currentLineSeg = null;
                        document.querySelector("#placementBtn").innerText =
                            "开始";
                    }
                } else {
                }
            });

        document.querySelector(".btn-cancel").addEventListener("click", () => {
            this.removeLine(this.currentLineSeg);
        });

        document.querySelector(".btn-clear").addEventListener("click", () => {
            for (var i = this.lines.length - 1; i >= 0; i--) {
                this.removeLine(this.lines[i]);
            }
            this.lines = [];
            this.currentLineSeg = null;
        });
    }

    removeLine(line) {
        this.lines.splice(this.lines.indexOf(line), 1);
        line.dispose();
        line = null;
    }

    async makeXRCompatible(xrSession) {
        this.gl = this.renderer.getContext();
        await this.gl.makeXRCompatible();
        var baseLayer = new XRWebGLLayer(xrSession, this.gl);
        xrSession.updateRenderState({
            baseLayer: baseLayer,
        });
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, baseLayer.framebuffer);
        this.renderer.setSize(
            baseLayer.framebufferWidth,
            baseLayer.framebufferHeight
        );
        this.matLine.resolution.set(
            baseLayer.framebufferWidth,
            baseLayer.framebufferHeight
        );
    }

    render(xrView, hitPose) {
        let viewMatrix = xrView.transform.matrix;
        let projectionMatrix = xrView.projectionMatrix;
        let worldInverseMatrix = xrView.transform.inverse.matrix;

        this.camera.projectionMatrix.fromArray(projectionMatrix);
        this.camera.matrix.fromArray(viewMatrix);
        this.camera.matrixWorldInverse.fromArray(worldInverseMatrix);
        this.camera.updateMatrixWorld(true);

        if (hitPose) {
            const hitMatrix = new THREE.Matrix4().fromArray(
                hitPose.transform.matrix
            );
            this.currentPin.visible = true;
            this.currentPin.position.setFromMatrixPosition(hitMatrix);
            if (this.currentLineSeg)
                this.currentLineSeg.updateEnd(this.currentPin.position);
        }

        this.lines.forEach((item) => {
            item.middle = item.end.position
                .clone()
                .add(item.start.position)
                .multiplyScalar(0.5);
            item.middlePointInScreen = this.toScreenPosition(item.middle);
            item.label.style.left =
                (item.middlePointInScreen.x / devicePixelRatio).toFixed(0) +
                "px";
            item.label.style.top =
                (item.middlePointInScreen.y / devicePixelRatio).toFixed(0) +
                "px";
            item.label.innerText = item.distance.toFixed(2) + " m";
        });

        this.renderer.render(this.scene, this.camera);
    }

    toScreenPosition(vector) {
        //calculate screen half size
        var widthHalf = 0.5 * this.renderer.domElement.clientWidth;
        var heightHalf = 0.5 * this.renderer.domElement.clientHeight;
        vector.project(this.camera);
        //get 2d position on screen
        vector.x = (vector.x + 1) * widthHalf;
        vector.y = (-vector.y + 1) * heightHalf;

        return {
            x: vector.x,
            y: vector.y,
        };
    }
}

export class lineSeg {
    constructor(lineRoot, pinMesh, matLine) {
        this.lineRoot = lineRoot;
        this.start = pinMesh.clone();
        this.end = pinMesh.clone();
        lineRoot.add(this.start);
        lineRoot.add(this.end);

        var geometry = new THREE.LineGeometry();
        this.linMesh = new THREE.Line2(geometry, matLine);
        this.linMesh.scale.set(1, 1, 1);
        lineRoot.add(this.linMesh);

        this.middlePointInScreen = null;
        this.distance = 0;
        this.label = document.createElement("div");
        this.label.style.cssText =
            "font-size:1rem;position: fixed;color: red;transform: translate(-50%, -50%);";
        document.querySelector(".overlay").appendChild(this.label);
    }

    updateEnd(vec) {
        this.id = THREE.Math.generateUUID();
        this.end.position.copy(vec);
        var vect1 = this.start.position;
        var vect2 = this.end.position;

        var positions = [vect1.x, vect1.y, vect1.z, vect2.x, vect2.y, vect2.z];
        this.linMesh.geometry.setPositions(positions);
        this.linMesh.computeLineDistances();
        this.distance = vect2.distanceTo(vect1);
    }

    dispose() {
        this.lineRoot.remove(this.linMesh);
        this.lineRoot.remove(this.start);
        this.lineRoot.remove(this.end);
        document.querySelector(".overlay").removeChild(this.label);
        this.linMesh = null;
        this.start = null;
        this.end = null;
        this.lineRoot = null;
    }
}
