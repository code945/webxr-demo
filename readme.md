<!--
 * @Author: hongxu.lin
 * @Date: 2020-07-13 17:42:16
 * @LastEditTime: 2020-07-14 22:02:58
-->

WebXR 标准从 2018 年开始，经过 2 年的沉淀，基本上在 chrome 上已经迈入正式版的支持行列。笔者从最开始的尝鲜版开始，趟过 n 多坑一路陪伴它的成长。现在记录下，如何手撸一个 webXR 的 AR 测量应用。（其实之前写过好几遍 WebXR 应用，主要标准一直在更新，之前跑的好好的 Demo，过几个月就跑不起来了。不过好在从最开始只支持 pixel google 亲儿子，到后来安卓硬件的大面积支持，硬件层面跟步还挺迅速）。这次写个最新热乎的，大家赶紧来看，过几个月可能又 GG 了，哈哈哈~~

# 准备工作

WebXR 目前还是比较挑硬件的，要跑起来 WebXR 的 demo，必须使用兼容的设备。安卓手机需要安装好 google 全家桶，保证 ARCore 能跑起来。

![](http://blogstatic.linhongxu.com/readme/20200714093452917.png)

[AR Core 的 play 商店地址](https://play.google.com/store/apps/details?id=com.google.ar.core)

google 官方的支持设备列表可以看这个

[https://developers.google.cn/ar/discover/supported-devices](https://developers.google.cn/ar/discover/supported-devices)

在开发之前，建议先在 google play 商店随便下载一个 AR 应用，证明你手机的 ARCore 套件安装没问题。比如你可以安装 google 自家的 demo 应用 AR Elements [play store](https://play.google.com/store/apps/details?id=com.google.ar.unity.ddelements)

![](http://blogstatic.linhongxu.com/readme/20200714093555989.png)

其次，一定要使用 Chrome Canary 版本的浏览器，且打开手机中的 WebXR 相关 flag。具体操作如下：

![](http://blogstatic.linhongxu.com/readme/20200714093637215.png)

1.  在 canary 版 chrome 中浏览器地址栏输入 chrome://flags
2.  搜索 webxr，然后设置为启用。

![](http://blogstatic.linhongxu.com/readme/20200714093720279.png)

至此，我们的准备工作基本完成，开始创建工程，撸代码吧。

# 编写 WebXR 应用

应用描述：我们将创建一个用来测量长度的 web 应用，使用 webxr 技术提供的 AR 相关 api，实现一个在真实场景中测量长度的简单 demo。

主要交互：点击开始，记录开始点，点击结束记录结束点，然后展示这段线段的距离。就这么简单傻瓜~~~

主要要素：

-   渲染使用 Three.js
-   平面识别使用 WebXR Device API - Hit Testing (底层调用 ARCore)
-   6DoF 空间位置追踪使用 WebXR Device API - Spatial Tracking (底层调用 ARCore)

ok，我们开始 coding

## 授权开启 webxr

首先，我们需要在页面上使用一个按钮，用来开启 WebXR Session 会话。由于浏览器安全策略的原因，用户必须手动授权开启 WebXR 的 session，才能开启 XR 功能，否则 webxr 的功能将不能执行。这点和许多用户授权的模型一致，比如 webRTC、webAudio、陀螺仪数据等。

```
 <a id="xrBtn" href="javascript:void(0)" class="btn-ar">点击开启AR</a>
```

我们在代码中做一些兼容性检查，通过 `navigator.xr.isSessionSupported` 判断当前浏览器是否支持 WebXR，如果浏览器支持 webxr 的话，我们监听按钮点击事件，初始化获取 session 会话，如果不支持给出友好提示。

```

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

```

## 获取 session

假设你手头正好有个支持 webxr 的设备，那么代码可以继续向下执行，初始化 webxr 的 session。

```
const onRequestSession = async () => {
    xrSession = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["local", "hit-test"],
        optionalFeatures: ["dom-overlay"],
        domOverlay: { root: uiOverlay },
    });
    // 观察者参考空间
    xrViewerSpace = await xrSession.requestReferenceSpace("viewer");
    // 真实世界参考空间
    xrRefSpace = await xrSession.requestReferenceSpace("local");
    // 获取碰撞检测源 以观察点为参考空间
    xrHitTestSource = await xrSession.requestHitTestSource({
        space: xrViewerSpace,
    });
    // 设置webgl兼容webxr
    view3d.makeXRCompatible(xrSession);
    // 开启主渲染循环
    xrSession.requestAnimationFrame(onXRFrame);
};

```

我们继续调用 webxr 的 device api `navigator.xr.requestSession(sessionMode,featureDependencies)` 来获取一个 webxr 的 session。这个 api 有两个参数，一个参数是 XRSessionMode 即 XRSession 的模式；另外一个是 Feature Dependencies 即这个模式下需要附加的功能。

XR session 的种类有三种，分别是内联（`inline`）、VR（`immersive-vr`）、AR（`immersive-ar`）。

> enum XRSessionMode {
> "inline",
> "immersive-vr",
> "immersive-ar"
> };

附加功能一般包含 `requiredFeatures` 、 `optionalFeatures` 两个数组。

这里我们使用 AR 模式，所以传入的值为`immersive-ar` ，我们需要空间追踪以及空间碰撞检测功能，额外的我们还需要一个 dom-overlay 的功能作为 UI 组件。注意如果不添加 dom-overlay 的话普通的 dom 不会显示出来，AR 场景会显示在整个 dom 的最前面。获取完 session 之后，我们继续从 session 中获取参考空间，用来做空间追踪和碰撞检测使用。最后让 webgl 兼容 WebXR，以及创建一个 webxr 的主循环。在主循环中的每一帧内，我们进行空间追踪，并绘制 webgl 场景。

## 在 threejs 中使 webgl 兼容 WebXR
threejs的普通场景创建和正常的没有什么区别，注意renderer的alpha设置为true；preserveDrawingBuffer设置为true；autoClear设置为false。
```
this.renderer = new THREE.WebGLRenderer({
    alpha: true,
    preserveDrawingBuffer: true,
});
this.renderer.autoClear = false;
```

在XR的session初始化完成之后，我们要手动进行webglcontext的兼容设置。代码如下：

```
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

```

## webxr 主循环

```
const onXRFrame = (time, frame) => {
    let pose = frame.getViewerPose(xrRefSpace);
    if (pose) {
        const xrView = pose.views[0];
        const hitPose = getHitPose(frame);
        view3d.render(xrView, hitPose);
    }
    xrSession.requestAnimationFrame(onXRFrame);
};
```

在主循环中我们可以使用`getViewerPose`方法获取一个视角姿态对象，整个对象包含一个`views`数组，如果是 VR 的场景，整个数组会有两个值分别代表左眼右眼的相机，如果是 AR 场景，我们获取第一个值就是手机的相机参数。然后我们可以在封装好的 3d render 方法中根据 XRView 来更新我们 3d 场景的相机参数。

```
let viewMatrix = xrView.transform.matrix;
let projectionMatrix = xrView.projectionMatrix;
let worldInverseMatrix = xrView.transform.inverse.matrix;

this.camera.projectionMatrix.fromArray(projectionMatrix);
this.camera.matrix.fromArray(viewMatrix);
this.camera.matrixWorldInverse.fromArray(worldInverseMatrix);
this.camera.updateMatrixWorld(true);
```

根据前端渲染 SDK 的不同，我们也可以选择其他更新相机的方式，官方文档的解释 [github](https://github.com/immersive-web/webxr/blob/master/explainer.md#viewer-tracking)

## 真实世界的碰撞检测

在 webxr 的主循环中我们可以使用 `getHitTestResults` 方法来获取碰撞检测结果。其中`xrHitTestSource`参数我们在 session 初始化的时候已经声明过，不必每次重新声明，直接使用就好。如果碰撞检测有结果，我们可以拿到一个世界坐标参考系中的 XRPose 对象，它里面包含 transform 信息。

```
const getHitPose = (frame) => {
    if (xrHitTestSource) {
        let results = frame.getHitTestResults(xrHitTestSource);
        if (results.length > 0) {
            let pose = results[0].getPose(xrRefSpace);
            return pose;
        }
    }
};
```

## 3D 场景操作

我们在 3D 场景的 Render 方法中更新当前的位置指示图标，并且在 UI button 点击时创建线段的一个端点，结束时构造一个线段。这部分代码就是普通的 threejs 代码，这里不展开。

最后放上一个 demo 视频，实测家中的地砖，每格子15cm，三格45cm，测量结果基本准确。

<video src="http://blogstatic.linhongxu.com/readme/902d86b3b57c63bd6c46c550bb03687b.mp4" ></video>

有兴趣的同学也可以直接 github 拉代码跑跑看~

github
