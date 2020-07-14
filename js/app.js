/*
 * @Author: hongxu.lin
 * @Date: 2020-07-13 20:26:07
 * @LastEditTime: 2020-07-14 12:20:00
 */

import { xrStartBtn, uiOverlay, setupStartBtn, enterXRUI } from "./ui.js";
import { Viewer3D } from "./viewer3d.js";
// webxr device apis
let xrSession, xrViewerSpace, xrRefSpace, xrHitTestSource;

const view3d = new Viewer3D();

const checkSupport = async () => {
    let xrSupport = navigator.xr;
    let xrSessionSupport = false;
    if (xrSupport) {
        xrSessionSupport = await navigator.xr.isSessionSupported(
            "immersive-ar"
        );
    }
    return xrSupport && xrSessionSupport;
};

const init = async () => {
    let supported = await checkSupport();
    setupStartBtn(supported, onRequestSession);
    view3d.initWebgl();
};

init();

const onRequestSession = async () => {
    enterXRUI();
    xrSession = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["local", "hit-test"],
        optionalFeatures: ["dom-overlay"],
        domOverlay: { root: uiOverlay },
    });

    xrViewerSpace = await xrSession.requestReferenceSpace("viewer");
    xrRefSpace = await xrSession.requestReferenceSpace("local");

    xrHitTestSource = await xrSession.requestHitTestSource({
        space: xrViewerSpace,
    });

    view3d.makeXRCompatible(xrSession);
    xrSession.requestAnimationFrame(onXRFrame);
};

const onXRFrame = (time, frame) => {
    let pose = frame.getViewerPose(xrRefSpace);
    if (pose) {
        const xrView = pose.views[0];
        const hitPose = getHitPose(frame);
        view3d.render(xrView, hitPose);
    }
    xrSession.requestAnimationFrame(onXRFrame);
};

const getHitPose = (frame) => {
    if (xrHitTestSource) {
        let results = frame.getHitTestResults(xrHitTestSource);
        if (results.length > 0) {
            let pose = results[0].getPose(xrRefSpace);
            return pose;
        }
    }
};
