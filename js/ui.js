/*
 * @Author: hongxu.lin
 * @Date: 2020-07-13 23:30:09
 * @LastEditTime: 2020-07-14 09:40:37
 */
// ui elements
export const xrStartBtn = document.querySelector("#xrBtn");
export const uiOverlay = document.querySelector(".overlay");

export const setupStartBtn = (supported, onRequestSession) => {
    if (supported) {
        xrStartBtn.addEventListener("click", () => onRequestSession());
    } else {
        xrStartBtn.innerText = "浏览器暂不支持AR";
        xrStartBtn.classList.add("disabled");
    }
};

export const enterXRUI = () => {
    xrStartBtn.classList.add("hide");
    uiOverlay.classList.remove("hide");
};
