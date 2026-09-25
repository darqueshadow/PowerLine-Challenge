/* verify-egg-timer-theme-baseline.mjs: section T's record of every rule of the game's stylesheets, resolved
   to final values. Written by `node verify-egg-timer.mjs --write-theme-baseline` on 2026-09-25.
   Rewrite it ONLY when a style is changed on purpose, in the same commit. Never published (verify-*.mjs). */
export default {
 "@font-face": {
  "font-display": "RAW swap",
  "font-family": "\"DSEG7 Classic\"",
  "font-style": "normal",
  "font-weight": "RAW 700 900",
  "src": "RAW url(\"fonts/DSEG7Classic-Bold.woff2\") format(\"woff2\")"
 },
 "@font-face #2": {
  "font-display": "RAW swap",
  "font-family": "\"DSEG14 Classic\"",
  "font-style": "normal",
  "font-weight": "RAW 700 900",
  "src": "RAW url(\"fonts/DSEG14Classic-Bold.woff2\") format(\"woff2\")"
 },
 "@font-face #3": {
  "font-display": "RAW swap",
  "font-family": "Fredoka",
  "font-style": "normal",
  "font-weight": "700",
  "src": "RAW url(\"fonts/Fredoka-Bold.woff2\") format(\"woff2\")"
 },
 "@font-face #4": {
  "font-display": "RAW swap",
  "font-family": "\"Patrick Hand\"",
  "font-style": "normal",
  "font-weight": "400",
  "src": "RAW url(\"fonts/PatrickHand-Regular.woff2\") format(\"woff2\")"
 },
 "[hidden]": {
  "display": "none !important"
 },
 "*": {
  "box-sizing": "border-box"
 },
 "html, body": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "initial",
  "background-image": "radial-gradient(at 50% 35%, rgb(27, 15, 51), rgb(11, 7, 22) 70%)",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "color": "rgb(255, 247, 232)",
  "font-family": "\"Trebuchet MS\", Verdana, sans-serif",
  "height": "100%",
  "margin-bottom": "0px",
  "margin-left": "0px",
  "margin-right": "0px",
  "margin-top": "0px",
  "overflow-x": "hidden",
  "overflow-y": "hidden",
  "user-select": "none"
 },
 "button": {
  "font-family": "inherit",
  "font-feature-settings": "inherit",
  "font-kerning": "inherit",
  "font-language-override": "inherit",
  "font-optical-sizing": "inherit",
  "font-size": "inherit",
  "font-size-adjust": "inherit",
  "font-stretch": "inherit",
  "font-style": "inherit",
  "font-variant-alternates": "inherit",
  "font-variant-caps": "inherit",
  "font-variant-east-asian": "inherit",
  "font-variant-emoji": "inherit",
  "font-variant-ligatures": "inherit",
  "font-variant-numeric": "inherit",
  "font-variant-position": "inherit",
  "font-variation-settings": "inherit",
  "font-weight": "inherit",
  "line-height": "inherit"
 },
 ".screen": {
  "align-items": "center",
  "bottom": "0px",
  "column-gap": "18px",
  "display": "flex",
  "flex-direction": "column",
  "justify-content": "center",
  "left": "0px",
  "padding-bottom": "24px",
  "padding-left": "24px",
  "padding-right": "24px",
  "padding-top": "24px",
  "position": "fixed",
  "right": "0px",
  "row-gap": "18px",
  "text-align": "center",
  "top": "0px"
 },
 "#screen-title, #screen-setup, #screen-over": {
  "container-type": "inline-size"
 },
 ".screen.with-howto:not(#screen-play)": {
  "padding-right": "calc(44px + clamp(170px, 15vw, 250px))"
 },
 ".screen.with-howto:not(#screen-play) > .howto-panel": {
  "bottom": "0px",
  "position": "absolute",
  "right": "0px",
  "text-align": "center",
  "top": "0px",
  "z-index": "4"
 },
 "#screen-setup #howto": {
  "font-size": "clamp(13px, min(1.25vw, 2.2vh), 20px)",
  "padding-left": "18px",
  "padding-right": "18px",
  "width": "RAW <--panel-w>"
 },
 "#screen-setup #howto .title": {
  "column-gap": "12px",
  "font-size": "1.1em",
  "row-gap": "12px",
  "text-shadow": "none"
 },
 "#screen-setup #howto .signs": {
  "column-gap": "5px",
  "display": "flex",
  "row-gap": "5px"
 },
 "#screen-setup #howto .sign": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(42, 22, 64)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-left-radius": "6px",
  "border-bottom-right-radius": "6px",
  "border-bottom-style": "solid",
  "border-bottom-width": "3px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "3px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "3px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-left-radius": "6px",
  "border-top-right-radius": "6px",
  "border-top-style": "solid",
  "border-top-width": "3px",
  "box-shadow": "rgb(26, 13, 46) 3px 3px 0px",
  "color": "rgb(125, 106, 150)",
  "display": "inline-block",
  "padding-bottom": "1px",
  "padding-left": "4px",
  "padding-right": "4px",
  "padding-top": "1px"
 },
 "#screen-setup #howto .sign.on": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 210, 58)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "color": "rgb(26, 13, 46)"
 },
 "#howto-title": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 243, 209)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-left-radius": "20px 30px",
  "border-bottom-right-radius": "34px 18px",
  "border-bottom-style": "solid",
  "border-bottom-width": "5px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "5px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "5px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-left-radius": "30px 20px",
  "border-top-right-radius": "18px 32px",
  "border-top-style": "solid",
  "border-top-width": "5px",
  "box-shadow": "rgb(122, 44, 255) 8px 8px 0px",
  "color": "rgb(26, 13, 46)",
  "column-gap": "clamp(6px, 1.4vh, 16px)",
  "display": "flex",
  "flex-direction": "column",
  "font-size": "clamp(12px, min(1.05vw, 1.9vh), 17px)",
  "justify-content": "center",
  "margin-bottom": "12px",
  "margin-left": "8px",
  "margin-right": "12px",
  "margin-top": "10px",
  "padding-bottom": "12px",
  "padding-left": "14px",
  "padding-right": "14px",
  "padding-top": "clamp(10px, 2.4vh, 22px)",
  "row-gap": "clamp(6px, 1.4vh, 16px)",
  "text-align": "left",
  "width": "RAW <--panel-w>"
 },
 "#screen-title:not(.with-howto) #howto-title": {
  "display": "none"
 },
 "#howto-title .banner": {
  "align-self": "center",
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 61, 127)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-left-radius": "10px",
  "border-bottom-right-radius": "10px",
  "border-bottom-style": "solid",
  "border-bottom-width": "3px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "3px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "3px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-left-radius": "10px",
  "border-top-right-radius": "10px",
  "border-top-style": "solid",
  "border-top-width": "3px",
  "box-shadow": "rgb(26, 13, 46) 3px 3px 0px",
  "color": "rgb(255, 255, 255)",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "clamp(15px, 1.75vw, 32px)",
  "letter-spacing": "0.05em",
  "max-width": "100%",
  "padding-bottom": "4px",
  "padding-left": "10px",
  "padding-right": "10px",
  "padding-top": "4px",
  "text-shadow": "rgb(26, 13, 46) 2px 2px 0px",
  "text-wrap-mode": "nowrap",
  "transform": "rotate(-3deg)",
  "white-space-collapse": "collapse"
 },
 ".strip": {
  "column-gap": "clamp(4px, 1vh, 10px)",
  "display": "flex",
  "flex-direction": "column",
  "list-style-image": "initial",
  "list-style-position": "initial",
  "list-style-type": "none",
  "margin-bottom": "0px",
  "margin-left": "0px",
  "margin-right": "0px",
  "margin-top": "0px",
  "padding-bottom": "0px",
  "padding-left": "0px",
  "padding-right": "0px",
  "padding-top": "0px",
  "row-gap": "clamp(4px, 1vh, 10px)",
  "text-align": "left"
 },
 ".strip .cell": {
  "align-items": "center",
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-left-radius": "4px",
  "border-bottom-right-radius": "4px",
  "border-bottom-style": "solid",
  "border-bottom-width": "3px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "3px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "3px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-left-radius": "4px",
  "border-top-right-radius": "4px",
  "border-top-style": "solid",
  "border-top-width": "3px",
  "box-shadow": "rgb(26, 13, 46) 3px 3px 0px",
  "column-gap": "7px",
  "display": "grid",
  "grid-template-columns": "26% 1fr",
  "padding-bottom": "5px",
  "padding-left": "6px",
  "padding-right": "6px",
  "padding-top": "5px",
  "position": "relative",
  "row-gap": "2px"
 },
 ".strip .num": {
  "align-items": "center",
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-left-radius": "50%",
  "border-bottom-right-radius": "50%",
  "border-bottom-style": "solid",
  "border-bottom-width": "2px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "2px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "2px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-left-radius": "50%",
  "border-top-right-radius": "50%",
  "border-top-style": "solid",
  "border-top-width": "2px",
  "box-shadow": "rgb(26, 13, 46) 2px 2px 0px",
  "color": "rgb(26, 13, 46)",
  "display": "grid",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "0.95em",
  "height": "1.6em",
  "justify-items": "center",
  "left": "-9px",
  "position": "absolute",
  "top": "-9px",
  "width": "1.6em",
  "z-index": "1"
 },
 ".strip .cell:nth-child(1) .num": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(34, 227, 255)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial"
 },
 ".strip .cell:nth-child(2) .num": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(209, 0, 106)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "color": "rgb(255, 255, 255)"
 },
 ".strip .cell:nth-child(3) .num": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 210, 58)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial"
 },
 ".strip .cell:nth-child(4) .num": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 143, 199)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial"
 },
 ".strip .cell:nth-child(5) .num": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(61, 255, 154)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial"
 },
 ".strip .scene": {
  "align-items": "center",
  "column-gap": "2px",
  "display": "flex",
  "flex-wrap": "wrap",
  "justify-content": "center",
  "min-width": "0px",
  "padding-bottom": "0px",
  "padding-left": "0.7em",
  "padding-right": "0px",
  "padding-top": "0.75em",
  "row-gap": "2px"
 },
 ".strip .scene.split": {
  "flex-direction": "column",
  "flex-wrap": "nowrap"
 },
 ".strip .half": {
  "align-items": "center",
  "column-gap": "2px",
  "display": "flex",
  "row-gap": "2px",
  "width": "100%"
 },
 ".strip .half .tag": {
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "0.62em"
 },
 ".strip .fast .tag": {
  "color": "rgb(14, 143, 76)"
 },
 ".strip .slow .tag": {
  "color": "rgb(255, 61, 127)"
 },
 ".strip .pic": {
  "display": "block",
  "height": "auto",
  "max-width": "48px",
  "overflow-x": "visible",
  "overflow-y": "visible",
  "transform": "none",
  "width": "52%"
 },
 ".strip .pic.small": {
  "width": "34%"
 },
 ".strip .half .pic": {
  "width": "60%"
 },
 ".strip .clock-art.pic": {
  "width": "30%"
 },
 ".strip .dish.pic": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "auto",
  "animation-fill-mode": "none",
  "animation-iteration-count": "1",
  "animation-name": "none",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "ease",
  "position": "static",
  "transform": "none",
  "width": "60%"
 },
 ".strip .chip": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 210, 58)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-style": "solid",
  "border-bottom-width": "2px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "2px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "2px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-style": "solid",
  "border-top-width": "2px",
  "color": "rgb(59, 10, 92)",
  "font-family": "\"Courier New\", Courier, monospace",
  "font-size": "0.72em",
  "font-weight": "700",
  "padding-bottom": "0px",
  "padding-left": "3px",
  "padding-right": "3px",
  "padding-top": "0px"
 },
 ".strip .chip.bold": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(209, 0, 106)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "color": "rgb(255, 255, 255)"
 },
 ".strip .shout": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 255, 255)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-left-radius": "8px",
  "border-bottom-right-radius": "8px",
  "border-bottom-style": "solid",
  "border-bottom-width": "2px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "2px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "2px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-left-radius": "8px",
  "border-top-right-radius": "8px",
  "border-top-style": "solid",
  "border-top-width": "2px",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "0.62em",
  "padding-bottom": "0px",
  "padding-left": "4px",
  "padding-right": "4px",
  "padding-top": "0px",
  "text-wrap-mode": "nowrap",
  "white-space-collapse": "collapse"
 },
 ".strip .keys": {
  "column-gap": "2px",
  "display": "flex",
  "row-gap": "2px"
 },
 ".strip .keys i": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(43, 43, 51)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-left-radius": "2px",
  "border-bottom-right-radius": "2px",
  "border-bottom-style": "solid",
  "border-bottom-width": "2px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "2px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "2px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-left-radius": "2px",
  "border-top-right-radius": "2px",
  "border-top-style": "solid",
  "border-top-width": "2px",
  "display": "block",
  "height": "0.7em",
  "width": "1.3em"
 },
 ".strip .say": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 255, 255)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-left-radius": "12px",
  "border-bottom-right-radius": "12px",
  "border-bottom-style": "solid",
  "border-bottom-width": "2px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "2px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "2px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-left-radius": "12px",
  "border-top-right-radius": "12px",
  "border-top-style": "solid",
  "border-top-width": "2px",
  "color": "rgb(26, 13, 46)",
  "font-family": "\"Trebuchet MS\", Verdana, sans-serif",
  "font-weight": "700",
  "line-height": "1.22",
  "margin-bottom": "0px",
  "margin-left": "0px",
  "margin-right": "0px",
  "margin-top": "0px",
  "padding-bottom": "3px",
  "padding-left": "7px",
  "padding-right": "7px",
  "padding-top": "3px",
  "position": "relative"
 },
 ".strip .say::before": {
  "border-bottom-color": "transparent",
  "border-bottom-style": "solid",
  "border-bottom-width": "5px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "transparent",
  "border-left-style": "solid",
  "border-left-width": "4px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "5px",
  "border-top-color": "transparent",
  "border-top-style": "solid",
  "border-top-width": "5px",
  "content": "\"\"",
  "left": "-9px",
  "margin-top": "-5px",
  "position": "absolute",
  "top": "50%"
 },
 ".strip .clock-art .case": {
  "fill": "rgb(122, 74, 34)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "3"
 },
 ".strip .clock-art .window": {
  "fill": "rgb(36, 18, 63)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "2"
 },
 ".strip .clock-art .rod": {
  "stroke": "rgb(224, 176, 64)",
  "stroke-width": "2.5"
 },
 ".strip .clock-art .bob, .strip .clock-art .cap": {
  "fill": "rgb(224, 176, 64)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "2"
 },
 ".strip .clock-art .face": {
  "fill": "rgb(255, 244, 214)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "2.5"
 },
 ".strip .clock-art .tick, .strip .clock-art .hand": {
  "stroke": "rgb(26, 13, 46)",
  "stroke-linecap": "round",
  "stroke-width": "3"
 },
 ".strip .clock-art .fivex": {
  "display": "none"
 },
 "#howto .strip": {
  "display": "none"
 },
 "#screen-setup #howto .strip": {
  "display": "flex"
 },
 "#screen-setup #howto ul, #screen-setup #howto .doodles": {
  "display": "none"
 },
 ".label": {
  "color": "rgb(154, 143, 184)",
  "font-size": "0.75em",
  "letter-spacing": "0.12em"
 },
 ".blink": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "1s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "blink",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(2, start)"
 },
 "@keyframes blink » 100%": {
  "visibility": "hidden"
 },
 ".logo": {
  "color": "rgb(255, 247, 232)",
  "font-family": "\"Trebuchet MS\", Verdana, sans-serif",
  "font-size": "clamp(48px, 11cqw, 132px)",
  "font-weight": "400",
  "letter-spacing": "0.02em",
  "margin-bottom": "0px",
  "margin-left": "0px",
  "margin-right": "0px",
  "margin-top": "0px",
  "text-shadow": "rgb(0, 0, 0) 6px 6px 0px",
  "text-transform": "uppercase"
 },
 ".logo .et": {
  "color": "rgb(255, 61, 127)",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "1.25em",
  "font-weight": "900",
  "text-shadow": "rgb(0, 0, 0) 6px 6px 0px, rgb(122, 44, 255) 10px 10px 0px"
 },
 ".sub": {
  "color": "rgb(255, 210, 58)",
  "font-weight": "700",
  "letter-spacing": "0.4em",
  "margin-bottom": "0px",
  "margin-left": "0px",
  "margin-right": "0px",
  "margin-top": "0px"
 },
 "#title-prompt": {
  "color": "rgb(34, 227, 255)",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "24px"
 },
 ".error": {
  "color": "rgb(255, 61, 127)",
  "font-family": "\"Courier New\", Courier, monospace",
  "max-width": "640px"
 },
 "#title-scene": {
  "width": "min(560px, 82cqw, 70vh)"
 },
 "#title-scene svg": {
  "display": "block",
  "overflow-x": "visible",
  "overflow-y": "visible",
  "width": "100%"
 },
 "#title-scene .alien-skin": {
  "fill": "rgb(125, 255, 106)",
  "stroke": "rgb(20, 51, 15)",
  "stroke-width": "4"
 },
 "#title-scene .antenna, #title-scene .stalk": {
  "fill": "none",
  "stroke": "rgb(20, 51, 15)",
  "stroke-linecap": "round",
  "stroke-width": "4"
 },
 "#title-scene .antenna-tip": {
  "fill": "rgb(255, 61, 127)",
  "stroke": "rgb(20, 51, 15)",
  "stroke-width": "2"
 },
 "#title-scene .eye": {
  "fill": "rgb(255, 255, 255)",
  "stroke": "rgb(20, 51, 15)",
  "stroke-width": "3"
 },
 "#title-scene .pupil": {
  "fill": "rgb(20, 51, 15)"
 },
 "#title-scene .apron": {
  "fill": "rgb(255, 143, 199)",
  "stroke": "rgb(20, 51, 15)",
  "stroke-width": "3"
 },
 "#title-scene .apron-heart": {
  "fill": "rgb(255, 61, 127)"
 },
 "#title-scene .smile": {
  "fill": "rgb(59, 10, 42)",
  "stroke": "rgb(20, 51, 15)",
  "stroke-width": "3"
 },
 "#title-scene .smile-line": {
  "fill": "rgb(255, 92, 138)"
 },
 "#title-scene .cheek": {
  "fill": "rgb(255, 143, 199)",
  "opacity": "0.8"
 },
 "#title-scene .mouth-hole": {
  "fill": "rgb(59, 10, 42)",
  "stroke": "rgb(20, 51, 15)",
  "stroke-width": "2"
 },
 "#title-scene .teeth": {
  "fill": "rgb(255, 251, 232)",
  "stroke": "rgb(20, 51, 15)",
  "stroke-width": "0.8"
 },
 "#title-scene .note": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "2.2s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "note",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "linear",
  "fill": "rgb(255, 210, 58)",
  "font-size": "26px",
  "opacity": "0",
  "paint-order": "stroke",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "1.5"
 },
 "@keyframes note » 0%": {
  "opacity": "0",
  "transform": "translate(0px, 20px)"
 },
 "@keyframes note » 20%": {
  "opacity": "1"
 },
 "@keyframes note » 100%": {
  "opacity": "0",
  "transform": "translate(14px, -60px)"
 },
 "#title-scene .sway": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "1.56s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "sway",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "ease-in-out",
  "transform-box": "fill-box",
  "transform-origin": "50% 100%"
 },
 "@keyframes sway » 50%": {
  "transform": "rotate(-4deg)"
 },
 "#title-scene .bob": {
  "animation-delay": "0s",
  "animation-direction": "alternate",
  "animation-duration": "0.52s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "bob",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "ease-in-out"
 },
 "@keyframes bob » 100%": {
  "transform": "translateY(-8px)"
 },
 "#title-scene .mouth": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.26s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "sing",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(2)",
  "transform-box": "fill-box",
  "transform-origin": "50% 20%"
 },
 "@keyframes sing » 50%": {
  "transform": "scaleY(0.45)"
 },
 "#title-scene .wink": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "3.1s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "blink-eye",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(1)",
  "transform-box": "fill-box",
  "transform-origin": "center center"
 },
 "@keyframes blink-eye » 94%": {
  "transform": "scaleY(0.15)"
 },
 "#setup-critter": {
  "flex-basis": "auto",
  "flex-grow": "0",
  "flex-shrink": "0",
  "width": "min(300px, 40cqw, 31vh)"
 },
 "#setup-critter svg": {
  "display": "block",
  "overflow-x": "visible",
  "overflow-y": "visible",
  "width": "100%"
 },
 "#setup-critter .blob": {
  "fill": "rgb(199, 155, 255)",
  "stroke": "rgb(42, 15, 69)",
  "stroke-width": "4"
 },
 "#setup-critter .neck": {
  "fill": "none",
  "stroke": "rgb(42, 15, 69)",
  "stroke-linecap": "round",
  "stroke-width": "16"
 },
 "#setup-critter .neck-fill": {
  "fill": "none",
  "stroke": "rgb(199, 155, 255)",
  "stroke-linecap": "round",
  "stroke-width": "9"
 },
 "#setup-critter .head": {
  "fill": "rgb(199, 155, 255)",
  "stroke": "rgb(42, 15, 69)",
  "stroke-width": "4"
 },
 "#setup-critter .spot": {
  "fill": "rgb(125, 255, 106)",
  "stroke": "rgb(42, 15, 69)",
  "stroke-width": "1.5"
 },
 "#setup-critter .arm, #setup-critter .tuft": {
  "fill": "none",
  "stroke": "rgb(42, 15, 69)",
  "stroke-linecap": "round",
  "stroke-width": "4"
 },
 "#setup-critter .cheek": {
  "fill": "rgb(255, 143, 199)",
  "opacity": "0.85"
 },
 "#setup-critter .eye": {
  "fill": "rgb(255, 255, 255)",
  "stroke": "rgb(42, 15, 69)",
  "stroke-width": "2.5"
 },
 "#setup-critter .pupil": {
  "fill": "rgb(42, 15, 69)"
 },
 "#setup-critter .mouth-hole": {
  "fill": "rgb(59, 10, 42)",
  "stroke": "rgb(42, 15, 69)",
  "stroke-width": "2"
 },
 "#setup-critter .note": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "2.4s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "sour-note",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "linear",
  "fill": "rgb(255, 210, 58)",
  "font-size": "24px",
  "opacity": "0",
  "paint-order": "stroke",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "1.5"
 },
 "@keyframes sour-note » 0%": {
  "opacity": "0",
  "transform": "translate(0px, 18px) rotate(0deg)"
 },
 "@keyframes sour-note » 20%": {
  "opacity": "1"
 },
 "@keyframes sour-note » 45%": {
  "transform": "translate(-6px, -4px) rotate(-18deg)"
 },
 "@keyframes sour-note » 70%": {
  "opacity": "1",
  "transform": "translate(8px, -22px) rotate(14deg)"
 },
 "@keyframes sour-note » 100%": {
  "opacity": "0",
  "transform": "translate(-4px, -40px) rotate(-10deg)"
 },
 "#setup-critter .note #2": {
  "transform-box": "fill-box",
  "transform-origin": "center center"
 },
 "#setup-critter .breathe": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "2.8s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "breathe",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "ease-in-out",
  "transform-box": "fill-box",
  "transform-origin": "50% 100%"
 },
 "@keyframes breathe » 50%": {
  "transform": "scale(1.035, 0.97)"
 },
 "#setup-critter .bob": {
  "animation-delay": "0s",
  "animation-direction": "alternate",
  "animation-duration": "0.6s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "bob",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "ease-in-out"
 },
 "#setup-critter .mouth": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.3s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "sing",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(2)",
  "transform-box": "fill-box",
  "transform-origin": "50% 20%"
 },
 "@media (max-height: 700px) » #screen-setup": {
  "column-gap": "12px",
  "row-gap": "12px"
 },
 "h2": {
  "color": "rgb(255, 210, 58)",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "letter-spacing": "0.1em",
  "margin-bottom": "0px",
  "margin-left": "0px",
  "margin-right": "0px",
  "margin-top": "8px",
  "text-shadow": "rgb(0, 0, 0) 3px 3px 0px"
 },
 ".button-bank": {
  "column-gap": "18px",
  "display": "flex",
  "flex-wrap": "wrap",
  "justify-content": "center",
  "row-gap": "18px"
 },
 ".button-bank button, .start": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(27, 15, 51)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(255, 247, 232)",
  "border-bottom-style": "solid",
  "border-bottom-width": "4px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(255, 247, 232)",
  "border-left-style": "solid",
  "border-left-width": "4px",
  "border-right-color": "rgb(255, 247, 232)",
  "border-right-style": "solid",
  "border-right-width": "4px",
  "border-top-color": "rgb(255, 247, 232)",
  "border-top-style": "solid",
  "border-top-width": "4px",
  "box-shadow": "rgb(0, 0, 0) 6px 6px 0px",
  "color": "rgb(255, 247, 232)",
  "cursor": "pointer",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "18px",
  "line-height": "1.15",
  "min-width": "96px",
  "padding-bottom": "16px",
  "padding-left": "22px",
  "padding-right": "22px",
  "padding-top": "16px"
 },
 ".modes button": {
  "min-height": "92px",
  "min-width": "210px"
 },
 ".button-bank button.selected": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 210, 58)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(0, 0, 0)",
  "border-left-color": "rgb(0, 0, 0)",
  "border-right-color": "rgb(0, 0, 0)",
  "border-top-color": "rgb(0, 0, 0)",
  "box-shadow": "rgb(0, 0, 0) 2px 2px 0px",
  "color": "rgb(11, 7, 22)",
  "transform": "translate(4px, 4px)"
 },
 ".start": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 61, 127)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(0, 0, 0)",
  "border-left-color": "rgb(0, 0, 0)",
  "border-right-color": "rgb(0, 0, 0)",
  "border-top-color": "rgb(0, 0, 0)",
  "font-size": "26px",
  "margin-top": "10px",
  "padding-bottom": "14px",
  "padding-left": "48px",
  "padding-right": "48px",
  "padding-top": "14px"
 },
 ".hint": {
  "color": "rgb(154, 143, 184)",
  "font-size": "13px",
  "letter-spacing": "0.08em"
 },
 ".dev-note, #dev-badge": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(34, 227, 255)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "color": "rgb(11, 7, 22)",
  "font-family": "\"Courier New\", Courier, monospace",
  "font-weight": "700",
  "padding-bottom": "4px",
  "padding-left": "10px",
  "padding-right": "10px",
  "padding-top": "4px"
 },
 "#mute": {
  "align-items": "center",
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(27, 15, 51)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(255, 247, 232)",
  "border-bottom-style": "solid",
  "border-bottom-width": "3px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(255, 247, 232)",
  "border-left-style": "solid",
  "border-left-width": "3px",
  "border-right-color": "rgb(255, 247, 232)",
  "border-right-style": "solid",
  "border-right-width": "3px",
  "border-top-color": "rgb(255, 247, 232)",
  "border-top-style": "solid",
  "border-top-width": "3px",
  "box-shadow": "rgb(0, 0, 0) 3px 3px 0px",
  "color": "rgb(255, 247, 232)",
  "cursor": "pointer",
  "display": "grid",
  "height": "36px",
  "justify-items": "center",
  "left": "12px",
  "padding-bottom": "4px",
  "padding-left": "4px",
  "padding-right": "4px",
  "padding-top": "4px",
  "position": "fixed",
  "top": "10px",
  "width": "42px",
  "z-index": "61"
 },
 "#mute[hidden]": {
  "display": "none"
 },
 "#mute svg": {
  "fill": "none",
  "height": "100%",
  "stroke": "currentcolor",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "stroke-width": "2.2",
  "width": "100%"
 },
 "#mute .speaker": {
  "fill": "currentcolor"
 },
 "#mute .cross": {
  "display": "none"
 },
 "#mute[aria-pressed=\"true\"]": {
  "border-bottom-color": "rgb(255, 61, 127)",
  "border-left-color": "rgb(255, 61, 127)",
  "border-right-color": "rgb(255, 61, 127)",
  "border-top-color": "rgb(255, 61, 127)",
  "color": "rgb(255, 61, 127)"
 },
 "#mute[aria-pressed=\"true\"] .waves": {
  "display": "none"
 },
 "#mute[aria-pressed=\"true\"] .cross": {
  "display": "inline"
 },
 "#mute:focus-visible": {
  "outline-color": "rgb(34, 227, 255)",
  "outline-offset": "2px",
  "outline-style": "solid",
  "outline-width": "3px"
 },
 "#dev-badge": {
  "position": "fixed",
  "right": "8px",
  "top": "8px",
  "z-index": "50"
 },
 "#screen-play": {
  "align-items": "stretch",
  "column-gap": "0px",
  "justify-content": "stretch",
  "padding-bottom": "0px",
  "padding-left": "0px",
  "padding-right": "0px",
  "padding-top": "0px",
  "row-gap": "0px"
 },
 ".hud": {
  "align-items": "baseline",
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(0, 0, 0)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(255, 61, 127)",
  "border-bottom-style": "solid",
  "border-bottom-width": "4px",
  "column-gap": "clamp(14px, 3vw, 42px)",
  "display": "flex",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "clamp(16px, 2.2vw, 26px)",
  "padding-bottom": "10px",
  "padding-left": "70px",
  "padding-right": "18px",
  "padding-top": "10px",
  "row-gap": "clamp(14px, 3vw, 42px)"
 },
 ".hud #2": {
  "position": "relative"
 },
 ".hud .mode": {
  "color": "rgb(154, 143, 184)",
  "font-size": "0.6em",
  "letter-spacing": "0.1em",
  "margin-left": "auto"
 },
 ".pool": {
  "color": "rgb(255, 61, 127)",
  "letter-spacing": "0.15em"
 },
 ".pool.hit": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.5s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "1",
  "animation-name": "hit",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(4)"
 },
 "@keyframes hit » 0%, 50%": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 61, 127)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "color": "rgb(255, 247, 232)"
 },
 "#warp": {
  "align-items": "center",
  "display": "flex",
  "flex-direction": "column",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "clamp(10px, 1vw, 17px)",
  "left": "50%",
  "letter-spacing": "0.12em",
  "line-height": "1.1",
  "position": "absolute",
  "text-align": "center",
  "top": "50%",
  "transform": "translate(-50%, -50%)",
  "z-index": "1"
 },
 "#warp .clock-art": {
  "display": "block",
  "filter": "drop-shadow(rgb(0, 0, 0) 4px 4px 0px)",
  "height": "min(17cqh, 30cqw)",
  "overflow-x": "visible",
  "overflow-y": "visible",
  "width": "auto"
 },
 "#warp .plaque": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(7, 20, 13)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(31, 58, 42)",
  "border-bottom-left-radius": "3px",
  "border-bottom-right-radius": "8px",
  "border-bottom-style": "solid",
  "border-bottom-width": "3px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(31, 58, 42)",
  "border-left-style": "solid",
  "border-left-width": "3px",
  "border-right-color": "rgb(31, 58, 42)",
  "border-right-style": "solid",
  "border-right-width": "3px",
  "border-top-color": "rgb(31, 58, 42)",
  "border-top-left-radius": "8px",
  "border-top-right-radius": "3px",
  "border-top-style": "solid",
  "border-top-width": "3px",
  "box-shadow": "rgb(0, 0, 0) 3px 3px 0px",
  "color": "rgb(28, 53, 38)",
  "display": "block",
  "margin-top": "-1.6em",
  "padding-bottom": "3px",
  "padding-left": "8px",
  "padding-right": "8px",
  "padding-top": "3px",
  "text-wrap-mode": "nowrap",
  "transform": "rotate(-2deg)",
  "white-space-collapse": "collapse"
 },
 "#warp .plaque .letters": {
  "display": "inline-block"
 },
 "#warp .plaque.wobble .letters": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.36s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "warp-wobble",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "linear"
 },
 "@keyframes warp-wobble » 0%, 100%": {
  "transform": "none"
 },
 "@keyframes warp-wobble » 20%": {
  "transform": "scale(1.14, 0.86) skewX(-10deg)"
 },
 "@keyframes warp-wobble » 45%": {
  "transform": "translateX(1px) scale(0.9, 1.12) skewX(8deg)"
 },
 "@keyframes warp-wobble » 70%": {
  "transform": "translateX(-1px) scale(1.1, 0.92) skewX(-5deg)"
 },
 "#warp .plaque.on": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(61, 255, 154)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(176, 77, 255)",
  "border-left-color": "rgb(176, 77, 255)",
  "border-right-color": "rgb(176, 77, 255)",
  "border-top-color": "rgb(176, 77, 255)",
  "box-shadow": "rgb(0, 0, 0) 3px 3px 0px, rgba(61, 255, 154, 0.55) 0px 0px 14px 3px",
  "color": "rgb(4, 23, 12)"
 },
 "#warp .caption": {
  "color": "rgb(154, 143, 184)",
  "display": "block",
  "font-family": "\"Trebuchet MS\", Verdana, sans-serif",
  "font-size": "0.95em",
  "font-weight": "700",
  "letter-spacing": "0px",
  "line-height": "1.2",
  "margin-top": "4px",
  "max-width": "15em",
  "text-shadow": "rgb(0, 0, 0) 1px 1px 0px",
  "text-wrap-mode": "wrap",
  "white-space-collapse": "collapse"
 },
 "#warp.lit .caption": {
  "color": "rgb(61, 255, 154)"
 },
 "#warp.lit .clock-art": {
  "filter": "drop-shadow(rgb(0, 0, 0) 4px 4px 0px) drop-shadow(rgb(61, 255, 154) 0px 0px 7px)"
 },
 "#warp .case": {
  "fill": "rgb(122, 74, 34)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-linejoin": "round",
  "stroke-width": "2.5"
 },
 "#warp .window": {
  "fill": "rgb(36, 18, 63)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "2"
 },
 "#warp .rod": {
  "fill": "none",
  "stroke": "rgb(224, 176, 64)",
  "stroke-width": "2.5"
 },
 "#warp .bob": {
  "fill": "rgb(224, 176, 64)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "2"
 },
 "#warp .face": {
  "fill": "rgb(255, 244, 214)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "2.5"
 },
 "#warp.lit .face": {
  "fill": "rgb(214, 255, 232)"
 },
 "#warp .tick": {
  "fill": "none",
  "stroke": "rgb(26, 13, 46)",
  "stroke-linecap": "round",
  "stroke-width": "2"
 },
 "#warp .hand": {
  "fill": "none",
  "stroke": "rgb(26, 13, 46)",
  "stroke-linecap": "round",
  "stroke-width": "3.4"
 },
 "#warp .minute .hand": {
  "stroke-width": "2.4"
 },
 "#warp .cap": {
  "fill": "rgb(26, 13, 46)"
 },
 "#warp .fivex": {
  "display": "none",
  "fill": "rgb(26, 13, 46)",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "11px",
  "paint-order": "stroke",
  "stroke": "rgb(214, 255, 232)",
  "stroke-width": "3"
 },
 "#warp.still .fivex": {
  "display": "inline"
 },
 ".wallclock": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(3, 18, 0)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(57, 255, 20)",
  "border-bottom-style": "solid",
  "border-bottom-width": "4px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(57, 255, 20)",
  "border-left-style": "solid",
  "border-left-width": "4px",
  "border-right-color": "rgb(57, 255, 20)",
  "border-right-style": "solid",
  "border-right-width": "4px",
  "border-top-color": "rgb(57, 255, 20)",
  "border-top-style": "solid",
  "border-top-width": "4px",
  "box-shadow": "rgb(255, 61, 127) 5px 5px 0px",
  "color": "rgb(57, 255, 20)",
  "font-family": "\"DSEG7 Classic\", \"Courier New\", Courier, monospace",
  "font-size": "clamp(30px, 4vw, 62px)",
  "font-weight": "900",
  "letter-spacing": "0.04em",
  "line-height": "1",
  "padding-bottom": "2px",
  "padding-left": "14px",
  "padding-right": "14px",
  "padding-top": "2px",
  "text-shadow": "rgb(57, 255, 20) 0px 0px 0px, rgb(15, 58, 0) 2px 2px 0px",
  "text-wrap-mode": "nowrap",
  "white-space-collapse": "collapse"
 },
 "#wall-ss": {
  "font-size": "0.5em",
  "margin-left": "2px",
  "vertical-align": "0.8em"
 },
 ".playrow": {
  "display": "flex",
  "flex-basis": "0%",
  "flex-grow": "1",
  "flex-shrink": "1",
  "min-height": "0px"
 },
 "#field": {
  "display": "flex",
  "flex-basis": "0%",
  "flex-direction": "column",
  "flex-grow": "1",
  "flex-shrink": "1",
  "min-height": "0px",
  "min-width": "0px",
  "position": "relative",
  "touch-action": "none"
 },
 ".counts button": {
  "border-color": "RAW <--line>",
  "color": "RAW <--line>",
  "min-width": "110px",
  "opacity": "0.45"
 },
 ".button-bank.counts button.selected": {
  "background": "RAW <--line>",
  "border-bottom-color": "rgb(0, 0, 0)",
  "border-left-color": "rgb(0, 0, 0)",
  "border-right-color": "rgb(0, 0, 0)",
  "border-top-color": "rgb(0, 0, 0)",
  "box-shadow": "RAW 2px 2px 0 #000, 0 0 14px 3px <--line>",
  "color": "rgb(0, 0, 0)",
  "opacity": "1"
 },
 "#fieldtop .tip": {
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-left-radius": "7px",
  "border-bottom-right-radius": "7px",
  "border-bottom-style": "solid",
  "border-bottom-width": "2px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "2px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "2px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-left-radius": "7px",
  "border-top-right-radius": "7px",
  "border-top-style": "solid",
  "border-top-width": "2px",
  "box-shadow": "rgb(0, 0, 0) 3px 3px 0px",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "clamp(10px, 0.95vw, 15px)",
  "letter-spacing": "0.04em",
  "line-height": "1.15",
  "max-width": "30%",
  "padding-bottom": "3px",
  "padding-left": "8px",
  "padding-right": "8px",
  "padding-top": "3px",
  "pointer-events": "none",
  "position": "absolute",
  "text-wrap-mode": "wrap",
  "top": "50%",
  "transform": "translateY(-50%)",
  "white-space-collapse": "collapse"
 },
 "#tip-ready": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(209, 0, 106)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "color": "rgb(255, 255, 255)"
 },
 "#tip-clock": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 243, 209)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "color": "rgb(26, 13, 46)"
 },
 "#tip-clock .arrow": {
  "color": "rgb(57, 255, 20)",
  "text-shadow": "rgb(26, 13, 46) 1px 1px 0px"
 },
 "#cords .leader": {
  "fill": "none",
  "opacity": "0.85",
  "stroke": "rgb(255, 244, 214)",
  "stroke-dasharray": "6, 5",
  "stroke-width": "2px"
 },
 "#fieldtop": {
  "align-items": "center",
  "column-gap": "16px",
  "display": "flex",
  "flex-basis": "auto",
  "flex-grow": "0",
  "flex-shrink": "0",
  "justify-content": "center",
  "padding-bottom": "4px",
  "padding-left": "16px",
  "padding-right": "16px",
  "padding-top": "10px",
  "position": "relative",
  "row-gap": "16px",
  "z-index": "25"
 },
 "#board": {
  "container-type": "size",
  "flex-basis": "0%",
  "flex-grow": "1",
  "flex-shrink": "1",
  "min-height": "0px",
  "position": "relative"
 },
 "#screen-play, #screen-play *, body.playing #mute, body.playing #mute *": {
  "cursor": "none"
 },
 "#nozzle": {
  "height": "32px",
  "left": "0px",
  "pointer-events": "none",
  "position": "fixed",
  "top": "0px",
  "transform-origin": "3px 3px",
  "width": "32px",
  "z-index": "2147483647"
 },
 "#nozzle .n-hose-edge": {
  "fill": "none",
  "stroke": "rgb(0, 0, 0)",
  "stroke-linecap": "round",
  "stroke-width": "9"
 },
 "#nozzle .n-hose": {
  "fill": "none",
  "stroke": "rgb(34, 163, 74)",
  "stroke-linecap": "round",
  "stroke-width": "6"
 },
 "#nozzle .n-head": {
  "fill": "rgb(255, 210, 58)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "2"
 },
 "#hose": {
  "bottom": "0px",
  "height": "100%",
  "left": "0px",
  "overflow-x": "visible",
  "overflow-y": "visible",
  "pointer-events": "none",
  "position": "absolute",
  "right": "0px",
  "top": "0px",
  "width": "100%",
  "z-index": "3"
 },
 "#water": {
  "bottom": "0px",
  "left": "0px",
  "overflow-x": "hidden",
  "overflow-y": "hidden",
  "pointer-events": "none",
  "position": "absolute",
  "right": "0px",
  "top": "0px",
  "z-index": "3"
 },
 ".playrow #2": {
  "position": "relative"
 },
 "#field #2": {
  "z-index": "2"
 },
 ".hud, #console, #howto": {
  "position": "relative",
  "z-index": "4"
 },
 "#hose .hose-outline": {
  "fill": "none",
  "stroke": "rgb(6, 40, 15)",
  "stroke-linecap": "round"
 },
 "#hose .hose-body": {
  "fill": "none",
  "stroke": "rgb(47, 191, 90)",
  "stroke-linecap": "round"
 },
 "#cords": {
  "bottom": "0px",
  "height": "100%",
  "left": "0px",
  "overflow-x": "visible",
  "overflow-y": "visible",
  "pointer-events": "none",
  "position": "absolute",
  "right": "0px",
  "top": "0px",
  "width": "100%",
  "z-index": "1"
 },
 "#backdrop": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "transparent",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "overflow-x": "hidden",
  "overflow-y": "hidden",
  "pointer-events": "none",
  "position": "absolute",
  "z-index": "0"
 },
 "#backdrop .light": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 255, 255)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-left-radius": "50%",
  "border-bottom-right-radius": "50%",
  "border-top-left-radius": "50%",
  "border-top-right-radius": "50%",
  "opacity": "0",
  "position": "absolute"
 },
 "#backdrop .veil": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(2, 1, 6)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "bottom": "0px",
  "left": "0px",
  "opacity": "0",
  "position": "absolute",
  "right": "0px",
  "top": "0px",
  "transition-behavior": "normal",
  "transition-delay": "0s",
  "transition-duration": "0.5s",
  "transition-property": "opacity",
  "transition-timing-function": "linear"
 },
 "#backdrop .veil.dark": {
  "opacity": "0.8"
 },
 "#cords path[class^=\"cord-\"]": {
  "fill": "none",
  "stroke-linejoin": "round"
 },
 "#cords .cord-outline": {
  "stroke": "rgb(26, 0, 8)",
  "stroke-linecap": "round",
  "stroke-width": "calc(14px)"
 },
 "#cords .cord-line": {
  "stroke": "rgb(158, 10, 30)",
  "stroke-linecap": "round",
  "stroke-width": "10px"
 },
 "#cords .cord-stripes": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "1.4s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "cord-creep",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "linear",
  "stroke": "rgb(122, 44, 196)",
  "stroke-dasharray": "9, 9",
  "stroke-width": "10px"
 },
 "#cords .cord-ribs": {
  "opacity": "0.8",
  "stroke": "rgb(42, 0, 16)",
  "stroke-dasharray": "2, 5",
  "stroke-width": "calc(13px)"
 },
 "@keyframes cord-creep » 100%": {
  "stroke-dashoffset": "-18"
 },
 "#cords .lightning path": {
  "fill": "none",
  "stroke-linecap": "round",
  "stroke-linejoin": "miter"
 },
 "#cords .bolt-glow": {
  "opacity": "0.35",
  "stroke": "rgb(61, 255, 154)",
  "stroke-width": "7px"
 },
 "#cords .bolt-core": {
  "stroke": "rgb(200, 255, 226)",
  "stroke-width": "2.5px"
 },
 "#cords .cord-bulge": {
  "fill": "rgb(138, 47, 214)",
  "stroke": "rgb(59, 16, 96)",
  "stroke-width": "2px"
 },
 "#cords .cord-egg": {
  "fill": "rgb(125, 255, 106)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "2px"
 },
 "#hose .pipe": {
  "fill": "rgb(154, 160, 168)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "2"
 },
 "#hose .valve": {
  "fill": "rgb(208, 52, 44)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "2"
 },
 "#water .jet": {
  "pointer-events": "none",
  "position": "absolute",
  "transform-origin": "0px 50%"
 },
 "#water .jet .core": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.12s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "jet-flow",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "linear",
  "background-size": "22px 100%",
  "border-bottom-color": "rgb(10, 74, 122)",
  "border-bottom-left-radius": "2px",
  "border-bottom-right-radius": "50%",
  "border-bottom-style": "solid",
  "border-bottom-width": "2px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(10, 74, 122)",
  "border-left-style": "solid",
  "border-left-width": "2px",
  "border-right-color": "rgb(10, 74, 122)",
  "border-right-style": "solid",
  "border-right-width": "2px",
  "border-top-color": "rgb(10, 74, 122)",
  "border-top-left-radius": "2px",
  "border-top-right-radius": "50%",
  "border-top-style": "solid",
  "border-top-width": "2px",
  "bottom": "0px",
  "left": "0px",
  "position": "absolute",
  "right": "0px",
  "top": "0px"
 },
 "@keyframes jet-flow » 100%": {
  "background-position-x": "22px",
  "background-position-y": "0px"
 },
 "#water .jet .burst": {
  "animation-delay": "0s",
  "animation-direction": "alternate",
  "animation-duration": "0.16s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "jet-burst",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "ease-in-out",
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "initial",
  "background-image": "radial-gradient(rgb(234, 250, 255) 0px, rgb(234, 250, 255) 20%, rgba(190, 236, 255, 0.8) 45%, transparent 70%)",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-left-radius": "50%",
  "border-bottom-right-radius": "50%",
  "border-top-left-radius": "50%",
  "border-top-right-radius": "50%",
  "height": "220%",
  "left": "-30%",
  "position": "absolute",
  "top": "-60%",
  "width": "60%"
 },
 "@keyframes jet-burst » 0%": {
  "transform": "scale(0.75)"
 },
 "@keyframes jet-burst » 100%": {
  "transform": "scale(1.1)"
 },
 "#water .jet.still .core, #water .jet.still .burst": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "auto",
  "animation-fill-mode": "none",
  "animation-iteration-count": "1",
  "animation-name": "none",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "ease"
 },
 "#water .jet.still .burst": {
  "display": "none"
 },
 ".drop": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.35s",
  "animation-fill-mode": "forwards",
  "animation-iteration-count": "1",
  "animation-name": "drop",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "ease-out",
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgba(190, 236, 255, 0.8)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-left-radius": "50%",
  "border-bottom-right-radius": "50%",
  "border-top-left-radius": "50%",
  "border-top-right-radius": "50%",
  "height": "5px",
  "margin-bottom": "0px",
  "margin-left": "-2.5px",
  "margin-right": "0px",
  "margin-top": "-2.5px",
  "pointer-events": "none",
  "position": "absolute",
  "width": "5px"
 },
 "@keyframes drop » 100%": {
  "opacity": "0",
  "transform": "RAW translate(<--dx>, <--dy>)"
 },
 "#water .splash": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.3s",
  "animation-fill-mode": "forwards",
  "animation-iteration-count": "1",
  "animation-name": "splash",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "ease-out",
  "border-bottom-color": "rgba(190, 236, 255, 0.8)",
  "border-bottom-left-radius": "50%",
  "border-bottom-right-radius": "50%",
  "border-bottom-style": "solid",
  "border-bottom-width": "3px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgba(190, 236, 255, 0.8)",
  "border-left-style": "solid",
  "border-left-width": "3px",
  "border-right-color": "rgba(190, 236, 255, 0.8)",
  "border-right-style": "solid",
  "border-right-width": "3px",
  "border-top-color": "rgba(190, 236, 255, 0.8)",
  "border-top-left-radius": "50%",
  "border-top-right-radius": "50%",
  "border-top-style": "solid",
  "border-top-width": "3px",
  "pointer-events": "none",
  "position": "absolute",
  "transform": "translate(-50%, -50%) scale(0.3)"
 },
 "@keyframes splash » 100%": {
  "opacity": "0",
  "transform": "translate(-50%, -50%) scale(1.3)"
 },
 "#hose-tag": {
  "align-items": "center",
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(195, 201, 209)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-left-radius": "7px",
  "border-bottom-right-radius": "7px",
  "border-bottom-style": "solid",
  "border-bottom-width": "2px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "2px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "2px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-left-radius": "7px",
  "border-top-right-radius": "7px",
  "border-top-style": "solid",
  "border-top-width": "2px",
  "bottom": "RAW calc(<--trough> + 3px)",
  "box-shadow": "rgb(0, 0, 0) 2px 2px 0px",
  "color": "rgb(26, 13, 46)",
  "column-gap": "5px",
  "display": "flex",
  "font-size": "clamp(10px, 0.8vw, 13px)",
  "left": "calc(50% + 16px)",
  "line-height": "1.1",
  "padding-bottom": "2px",
  "padding-left": "4px",
  "padding-right": "7px",
  "padding-top": "2px",
  "pointer-events": "none",
  "position": "absolute",
  "row-gap": "5px",
  "text-wrap-mode": "nowrap",
  "white-space-collapse": "collapse",
  "z-index": "26"
 },
 "#hose-tag::before": {
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-style": "solid",
  "border-top-width": "2px",
  "content": "\"\"",
  "left": "-14px",
  "position": "absolute",
  "top": "50%",
  "width": "14px"
 },
 "#hose-tag b": {
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-weight": "400",
  "letter-spacing": "0.04em"
 },
 "#hose-tag .mouse": {
  "flex-basis": "auto",
  "flex-grow": "0",
  "flex-shrink": "0",
  "height": "1.7em",
  "width": "1.2em"
 },
 "#hose-tag .sink": {
  "flex-basis": "auto",
  "flex-grow": "0",
  "flex-shrink": "0",
  "height": "1.6em",
  "overflow-x": "visible",
  "overflow-y": "visible",
  "width": "2.6em"
 },
 "#hose-tag .sink .basin": {
  "fill": "rgb(110, 118, 130)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-linejoin": "round",
  "stroke-width": "2"
 },
 "#hose-tag .sink .rim": {
  "stroke": "rgb(26, 13, 46)",
  "stroke-linecap": "round",
  "stroke-width": "3"
 },
 "#hose-tag .sink .drain": {
  "fill": "rgb(26, 13, 46)"
 },
 "#hose-tag .sink .grate": {
  "stroke": "rgb(195, 201, 209)",
  "stroke-width": "1.2"
 },
 "#hose-tag .mouse rect, #hose-tag .mouse path": {
  "fill": "rgb(255, 255, 255)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "2"
 },
 "#hose-tag .mouse .btn": {
  "fill": "rgb(255, 61, 127)"
 },
 "@media (max-height: 700px) » #hose-tag": {
  "padding-bottom": "0px",
  "padding-left": "3px",
  "padding-right": "6px",
  "padding-top": "0px"
 },
 "@media (max-height: 700px) » #hose-tag .mouse": {
  "height": "1.2em",
  "width": "0.85em"
 },
 "@media (max-height: 700px) » #hose-tag .sink": {
  "height": "1.1em",
  "width": "1.9em"
 },
 "#howto": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 243, 209)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-left-radius": "14px 22px",
  "border-bottom-right-radius": "26px 12px",
  "border-bottom-style": "solid",
  "border-bottom-width": "4px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "4px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "4px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-left-radius": "22px 14px",
  "border-top-right-radius": "12px 24px",
  "border-top-style": "solid",
  "border-top-width": "4px",
  "box-shadow": "rgb(255, 61, 127) 6px 6px 0px",
  "color": "rgb(26, 13, 46)",
  "display": "flex",
  "flex-basis": "auto",
  "flex-direction": "column",
  "flex-grow": "0",
  "flex-shrink": "0",
  "font-size": "clamp(12px, 0.95vw, 15px)",
  "line-height": "1.35",
  "margin-bottom": "12px",
  "margin-left": "8px",
  "margin-right": "12px",
  "margin-top": "10px",
  "overflow-x": "visible",
  "overflow-y": "visible",
  "padding-bottom": "8px",
  "padding-left": "12px",
  "padding-right": "12px",
  "padding-top": "clamp(6px, 1.4vh, 12px)",
  "width": "clamp(170px, 15vw, 250px)"
 },
 "@media (max-height: 700px) » #howto": {
  "font-size": "11px",
  "line-height": "1.22"
 },
 "#howto .title": {
  "align-items": "center",
  "color": "rgb(42, 15, 69)",
  "column-gap": "12px",
  "display": "flex",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "1.1em",
  "justify-content": "center",
  "letter-spacing": "0.06em",
  "margin-bottom": "8px",
  "row-gap": "12px",
  "text-shadow": "rgb(255, 61, 127) 2px 2px 0px"
 },
 "#howto .title .doodle": {
  "flex-basis": "auto",
  "flex-grow": "0",
  "flex-shrink": "0",
  "height": "2.2em",
  "width": "2.2em"
 },
 "#howto ul": {
  "flex-basis": "auto",
  "flex-grow": "0",
  "flex-shrink": "0",
  "list-style-image": "initial",
  "list-style-position": "initial",
  "list-style-type": "none",
  "margin-bottom": "0px",
  "margin-left": "0px",
  "margin-right": "0px",
  "margin-top": "0px",
  "padding-bottom": "0px",
  "padding-left": "0px",
  "padding-right": "0px",
  "padding-top": "0px"
 },
 "#howto li": {
  "color": "rgb(26, 13, 46)",
  "margin-bottom": "clamp(4px, 1.1vh, 9px)",
  "margin-left": "0px",
  "margin-right": "0px",
  "margin-top": "0px"
 },
 "#howto b": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(34, 227, 255)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-left-radius": "8px",
  "border-bottom-right-radius": "8px",
  "border-bottom-style": "solid",
  "border-bottom-width": "2px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "2px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "2px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-left-radius": "8px",
  "border-top-right-radius": "8px",
  "border-top-style": "solid",
  "border-top-width": "2px",
  "box-shadow": "rgb(26, 13, 46) 2px 2px 0px",
  "color": "rgb(26, 13, 46)",
  "display": "table",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "0.85em",
  "font-weight": "400",
  "letter-spacing": "0.08em",
  "margin-bottom": "2px",
  "margin-left": "auto",
  "margin-right": "auto",
  "margin-top": "0px",
  "padding-bottom": "0px",
  "padding-left": "7px",
  "padding-right": "7px",
  "padding-top": "0px",
  "transform": "rotate(-2deg)"
 },
 "#howto li:nth-child(2n) b": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(184, 255, 158)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "transform": "rotate(2deg)"
 },
 "#howto .doodles": {
  "container-type": "size",
  "flex-basis": "0%",
  "flex-grow": "1",
  "flex-shrink": "1",
  "min-height": "0px",
  "overflow-x": "hidden",
  "overflow-y": "hidden",
  "position": "relative"
 },
 "#howto .doodles .doodle": {
  "aspect-ratio": "1 / 1",
  "height": "auto",
  "position": "absolute",
  "width": "min(34cqw, 40cqh, 64px)"
 },
 "#howto .doodle": {
  "overflow-x": "visible",
  "overflow-y": "visible",
  "transform": "rotate(0deg)",
  "transition-behavior": "normal",
  "transition-delay": "0s",
  "transition-duration": "0.45s",
  "transition-property": "transform",
  "transition-timing-function": "cubic-bezier(0.3, 1.8, 0.5, 1)"
 },
 ".howto-panel .doodle .ink": {
  "fill": "none",
  "stroke": "rgb(26, 13, 46)",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "stroke-width": "3"
 },
 ".howto-panel .doodle .green": {
  "fill": "rgb(125, 255, 106)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "3"
 },
 ".howto-panel .doodle .lilac": {
  "fill": "rgb(199, 155, 255)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "3"
 },
 ".howto-panel .doodle .pink": {
  "fill": "rgb(255, 143, 199)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "2.5"
 },
 ".howto-panel .doodle .shell": {
  "fill": "rgb(125, 255, 106)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "3"
 },
 ".howto-panel .doodle .eye": {
  "fill": "rgb(255, 255, 255)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "2.5"
 },
 ".howto-panel .doodle .dot": {
  "fill": "rgb(26, 13, 46)"
 },
 ".howto-panel": {
  "position": "relative"
 },
 ".howto-panel .bulbs": {
  "bottom": "-4px",
  "left": "-4px",
  "pointer-events": "none",
  "position": "absolute",
  "right": "-4px",
  "top": "-4px",
  "z-index": "1"
 },
 "#howto-title .bulbs": {
  "bottom": "-5px",
  "left": "-5px",
  "right": "-5px",
  "top": "-5px"
 },
 ".howto-panel .bulb": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(107, 74, 18)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-left-radius": "50%",
  "border-bottom-right-radius": "50%",
  "border-bottom-style": "solid",
  "border-bottom-width": "1.5px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "1.5px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "1.5px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-left-radius": "50%",
  "border-top-right-radius": "50%",
  "border-top-style": "solid",
  "border-top-width": "1.5px",
  "height": "9px",
  "margin-bottom": "0px",
  "margin-left": "-4.5px",
  "margin-right": "0px",
  "margin-top": "-4.5px",
  "position": "absolute",
  "transition-behavior": "normal, normal, normal",
  "transition-delay": "0s, 0s, 0s",
  "transition-duration": "0.05s, 0.05s, 0.05s",
  "transition-property": "background-color, box-shadow, opacity",
  "transition-timing-function": "ease, ease, ease",
  "width": "9px"
 },
 ".howto-panel .bulb.on": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 226, 90)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "box-shadow": "rgb(255, 207, 58) 0px 0px 5px 1px"
 },
 "#howto.calm .bulb": {
  "opacity": "0.55",
  "transition-behavior": "normal, normal, normal",
  "transition-delay": "0s, 0s, 0s",
  "transition-duration": "0.9s, 0.9s, 0.9s",
  "transition-property": "background-color, box-shadow, opacity",
  "transition-timing-function": "ease, ease, ease"
 },
 "#howto.calm .bulb.on": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(217, 184, 74)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "box-shadow": "rgb(184, 150, 42) 0px 0px 3px"
 },
 ".nest": {
  "position": "absolute",
  "transform": "translate(-50%, -50%)",
  "width": "clamp(84px, min(15.5cqw, 23cqh), 200px)"
 },
 ".nest.unlock": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.4s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "1",
  "animation-name": "unlock",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(4)"
 },
 "@keyframes unlock » 0%": {
  "transform": "translate(-50%, -50%) scale(0.2)"
 },
 "@keyframes unlock » 100%": {
  "transform": "translate(-50%, -50%) scale(1)"
 },
 ".ooze .pool": {
  "fill": "rgb(61, 255, 154)",
  "opacity": "0.28",
  "stroke": "rgb(26, 143, 85)",
  "stroke-width": "2"
 },
 ".nest.inactive .ooze": {
  "display": "none"
 },
 ".nest.inactive .twigs .look-live, .nest:not(.inactive) .twigs .look-slate": {
  "display": "none"
 },
 ".nest.inactive .readout": {
  "visibility": "hidden"
 },
 ".nest-art": {
  "display": "block",
  "overflow-x": "visible",
  "overflow-y": "visible",
  "transform": "RAW rotate(<--tilt>)",
  "width": "100%"
 },
 ".egg": {
  "display": "none"
 },
 ".nest[data-state=\"laying\"].popping .egg, .nest[data-state=\"active\"] .egg, .nest[data-state=\"overtime\"] .egg": {
  "display": "inline"
 },
 ".nest.hide-egg .egg": {
  "display": "none"
 },
 ".crack": {
  "fill": "none",
  "stroke": "rgb(26, 13, 46)",
  "stroke-dasharray": "1",
  "stroke-dashoffset": "1",
  "stroke-linejoin": "miter",
  "stroke-width": "3.5"
 },
 ".nest.mirrored .egg .mirror": {
  "transform": "scaleX(-1)"
 },
 ".egg .hint": {
  "display": "none"
 },
 ".nest.show-hint-3 .hint-3, .nest.show-hint-4 .hint-4, .nest.show-hint-5 .hint-5, .nest.show-hint-eye .hint-eye": {
  "display": "inline"
 },
 ".shells, .creature": {
  "display": "none"
 },
 ".nest[data-state=\"escape\"] .shells, .nest[data-state=\"escape\"] .creature": {
  "display": "inline"
 },
 ".shells .half": {
  "fill": "rgb(125, 255, 106)",
  "stroke": "rgb(26, 13, 46)",
  "stroke-width": "3"
 },
 ".creature": {
  "transform-box": "fill-box",
  "transform-origin": "center center"
 },
 ".creature .body": {
  "fill": "rgb(42, 13, 20)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "3"
 },
 ".creature .ribs": {
  "fill": "none",
  "stroke": "rgb(107, 31, 46)",
  "stroke-width": "1.6"
 },
 ".creature .maw": {
  "fill": "rgb(122, 0, 16)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "1.5"
 },
 ".creature .fangs": {
  "fill": "none",
  "stroke": "rgb(244, 240, 216)",
  "stroke-linejoin": "miter",
  "stroke-width": "1.3"
 },
 ".creature .drool": {
  "fill": "rgb(184, 255, 94)",
  "opacity": "0.9"
 },
 ".creature .eye": {
  "fill": "rgb(255, 26, 46)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "1.2"
 },
 ".creature .slit": {
  "fill": "rgb(255, 225, 77)"
 },
 ".creature .legs path": {
  "fill": "none",
  "stroke": "rgb(138, 42, 62)",
  "stroke-linecap": "square",
  "stroke-linejoin": "miter",
  "stroke-width": "3"
 },
 ".nest.scurry .creature": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "1.3s",
  "animation-fill-mode": "forwards",
  "animation-iteration-count": "1",
  "animation-name": "scurry",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(10)"
 },
 ".nest.scurry .legs": {
  "animation-delay": "0s",
  "animation-direction": "alternate",
  "animation-duration": "0.3s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "legs",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "ease-in-out",
  "transform-box": "fill-box",
  "transform-origin": "50% 50%"
 },
 "@keyframes scurry » 0%": {
  "transform": "translate(0px, -6px)"
 },
 "@keyframes scurry » 100%": {
  "transform": "translate(calc(520%), 80%) rotate(calc(90deg))"
 },
 "@keyframes legs » 0%": {
  "transform": "skewX(-14deg)"
 },
 "@keyframes legs » 100%": {
  "transform": "skewX(14deg)"
 },
 ".nest.lunge": {
  "z-index": "20"
 },
 ".nest.lunge .creature": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "1.3s",
  "animation-fill-mode": "forwards",
  "animation-iteration-count": "1",
  "animation-name": "lunge",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(8)"
 },
 "@keyframes lunge » 0%": {
  "transform": "translateY(-4px) scale(1)"
 },
 "@keyframes lunge » 60%": {
  "opacity": "1",
  "transform": "translateY(-40%) scale(6)"
 },
 "@keyframes lunge » 100%": {
  "opacity": "0",
  "transform": "translateY(-40%) scale(9)"
 },
 "#board.warp .nest.glow:not(.bold) .nest-art": {
  "filter": "drop-shadow(rgb(61, 255, 154) 0px 0px 3px) drop-shadow(rgb(61, 255, 154) 0px 0px 7px)"
 },
 "#board.warp .nest.glow:not(.bold) .readout > span": {
  "border-bottom-color": "rgb(61, 255, 154)",
  "border-left-color": "rgb(61, 255, 154)",
  "border-right-color": "rgb(61, 255, 154)",
  "border-top-color": "rgb(61, 255, 154)",
  "box-shadow": "rgb(0, 0, 0) 2px 2px 0px, rgb(61, 255, 154) 0px 0px 8px 2px"
 },
 ".readout": {
  "column-gap": "3px",
  "display": "flex",
  "font-family": "\"Courier New\", Courier, monospace",
  "font-size": "clamp(11px, 1.3vw, 19px)",
  "font-weight": "400",
  "margin-bottom": "0px",
  "margin-left": "50%",
  "margin-right": "0px",
  "margin-top": "-2px",
  "row-gap": "3px",
  "text-wrap-mode": "nowrap",
  "transform": "translateX(-50%)",
  "white-space-collapse": "collapse",
  "width": "max-content"
 },
 ".readout > span": {
  "border-bottom-color": "rgb(26, 13, 46)",
  "border-bottom-left-radius": "0.5em",
  "border-bottom-right-radius": "0.5em",
  "border-bottom-style": "solid",
  "border-bottom-width": "3px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(26, 13, 46)",
  "border-left-style": "solid",
  "border-left-width": "3px",
  "border-right-color": "rgb(26, 13, 46)",
  "border-right-style": "solid",
  "border-right-width": "3px",
  "border-top-color": "rgb(26, 13, 46)",
  "border-top-left-radius": "0.5em",
  "border-top-right-radius": "0.5em",
  "border-top-style": "solid",
  "border-top-width": "3px",
  "box-shadow": "rgb(0, 0, 0) 2px 2px 0px",
  "box-sizing": "content-box",
  "line-height": "1.25",
  "overflow-x": "hidden",
  "overflow-y": "hidden",
  "padding-bottom": "0.1em",
  "padding-left": "0.3em",
  "padding-right": "0.3em",
  "padding-top": "0.1em",
  "text-align": "center"
 },
 ".readout .unit": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 255, 255)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "color": "rgb(28, 79, 216)",
  "min-width": "4ch"
 },
 ".readout .code": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(185, 185, 198)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "color": "rgb(0, 0, 0)",
  "min-width": "3ch"
 },
 ".readout .clock": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 210, 58)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "color": "rgb(59, 10, 92)",
  "min-width": "5ch"
 },
 ".nest.bold .readout": {
  "font-weight": "900"
 },
 ".nest.bold .readout .unit": {
  "color": "rgb(11, 93, 30)"
 },
 ".nest.bold .readout .clock": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(209, 0, 106)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "color": "rgb(255, 255, 255)"
 },
 ".nest[data-state=\"idle\"] .readout, .nest[data-state=\"splat\"] .readout, .nest[data-state=\"escape\"] .readout": {
  "opacity": "0.55"
 },
 ".nest[data-state=\"idle\"] .readout > span, .nest[data-state=\"splat\"] .readout > span, .nest[data-state=\"escape\"] .readout > span": {
  "filter": "brightness(0.45) saturate(0.5)"
 },
 ".nest[data-state=\"trigger\"] .readout > span": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.6s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "cue",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(2)"
 },
 "@keyframes cue » 50%": {
  "border-bottom-color": "rgb(34, 227, 255)",
  "border-left-color": "rgb(34, 227, 255)",
  "border-right-color": "rgb(34, 227, 255)",
  "border-top-color": "rgb(34, 227, 255)"
 },
 ".nest.hide-readout .readout > span": {
  "visibility": "hidden"
 },
 ".nest.hide-clock .readout .clock": {
  "visibility": "hidden"
 },
 ".pan": {
  "left": "50%",
  "opacity": "0",
  "pointer-events": "none",
  "position": "absolute",
  "top": "34%",
  "transform": "translate(-45%, -60%)",
  "width": "118%",
  "z-index": "24"
 },
 ".pan svg": {
  "display": "block",
  "width": "100%"
 },
 ".pan .rim": {
  "fill": "rgb(43, 43, 51)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "3"
 },
 ".pan .base": {
  "fill": "rgb(67, 67, 79)"
 },
 ".pan .glint": {
  "fill": "rgb(140, 140, 160)"
 },
 ".pan .handle": {
  "fill": "rgb(90, 52, 24)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "3"
 },
 ".pan.hit": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.32s",
  "animation-fill-mode": "forwards",
  "animation-iteration-count": "1",
  "animation-name": "slam",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(6)"
 },
 "@keyframes slam » 0%": {
  "opacity": "1",
  "transform": "translate(-45%, -190%) rotate(-24deg) scale(1.15)"
 },
 "@keyframes slam » 45%": {
  "opacity": "1",
  "transform": "translate(-45%, -60%) rotate(0deg) scale(1)"
 },
 "@keyframes slam » 70%": {
  "opacity": "1",
  "transform": "translate(-45%, -66%) rotate(0deg) scale(1)"
 },
 "@keyframes slam » 100%": {
  "opacity": "0",
  "transform": "translate(-45%, -150%) rotate(-12deg) scale(1.05)"
 },
 ".dish": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "1s",
  "animation-fill-mode": "forwards",
  "animation-iteration-count": "1",
  "animation-name": "dish",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(10)",
  "pointer-events": "none",
  "position": "absolute",
  "text-align": "center",
  "transform": "translate(-50%, -60%)",
  "width": "clamp(90px, 9vw, 150px)"
 },
 ".dish svg": {
  "display": "block",
  "overflow-x": "visible",
  "overflow-y": "visible",
  "width": "100%"
 },
 "@keyframes dish » 0%": {
  "opacity": "1",
  "transform": "translate(-50%, -40%) scale(0.4)"
 },
 "@keyframes dish » 20%, 80%": {
  "opacity": "1",
  "transform": "translate(-50%, -60%) scale(1)"
 },
 "@keyframes dish » 100%": {
  "opacity": "0",
  "transform": "translate(-50%, -75%) scale(1)"
 },
 ".dish .caption": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 210, 58)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(0, 0, 0)",
  "border-bottom-style": "solid",
  "border-bottom-width": "3px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(0, 0, 0)",
  "border-left-style": "solid",
  "border-left-width": "3px",
  "border-right-color": "rgb(0, 0, 0)",
  "border-right-style": "solid",
  "border-right-width": "3px",
  "border-top-color": "rgb(0, 0, 0)",
  "border-top-style": "solid",
  "border-top-width": "3px",
  "box-shadow": "rgb(255, 61, 127) 3px 3px 0px",
  "color": "rgb(0, 0, 0)",
  "display": "inline-block",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "clamp(11px, 1.1vw, 16px)",
  "margin-top": "2px",
  "padding-bottom": "2px",
  "padding-left": "8px",
  "padding-right": "8px",
  "padding-top": "2px",
  "text-wrap-mode": "nowrap",
  "white-space-collapse": "collapse"
 },
 ".dish .plate": {
  "fill": "rgb(244, 244, 248)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "3"
 },
 ".dish .plate-rim": {
  "fill": "none",
  "stroke": "rgb(201, 201, 214)",
  "stroke-width": "2"
 },
 ".dish .white": {
  "fill": "rgb(255, 246, 224)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "2"
 },
 ".dish .yolk": {
  "fill": "rgb(255, 194, 26)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "2"
 },
 ".dish .yolk.pale": {
  "fill": "rgb(255, 224, 138)"
 },
 ".dish .muffin": {
  "fill": "rgb(201, 138, 75)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "2"
 },
 ".dish .sauce": {
  "fill": "rgb(255, 216, 77)",
  "stroke": "rgb(138, 90, 0)",
  "stroke-width": "1.5"
 },
 ".dish .avocado": {
  "fill": "rgb(140, 207, 77)",
  "stroke": "rgb(46, 90, 18)",
  "stroke-width": "2"
 },
 ".dish .steak": {
  "fill": "rgb(122, 58, 28)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "2.5"
 },
 ".dish .grill": {
  "fill": "none",
  "stroke": "rgb(58, 21, 7)",
  "stroke-width": "3"
 },
 ".dish .mug": {
  "fill": "rgb(224, 160, 24)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "2"
 },
 ".dish .foam": {
  "fill": "rgb(255, 251, 232)",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "1.5"
 },
 ".dish .handle": {
  "fill": "none",
  "stroke": "rgb(0, 0, 0)",
  "stroke-width": "3"
 },
 ".postit": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 233, 92)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(0, 0, 0)",
  "border-bottom-style": "solid",
  "border-bottom-width": "2px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(0, 0, 0)",
  "border-left-style": "solid",
  "border-left-width": "2px",
  "border-right-color": "rgb(0, 0, 0)",
  "border-right-style": "solid",
  "border-right-width": "2px",
  "border-top-color": "rgb(0, 0, 0)",
  "border-top-style": "solid",
  "border-top-width": "2px",
  "box-shadow": "rgb(0, 0, 0) 3px 3px 0px",
  "color": "rgb(42, 26, 0)",
  "font-family": "\"Trebuchet MS\", Verdana, sans-serif",
  "font-size": "clamp(10px, 1.05vw, 15px)",
  "font-weight": "400",
  "padding-bottom": "3px",
  "padding-left": "5px",
  "padding-right": "5px",
  "padding-top": "3px",
  "position": "absolute",
  "right": "-16%",
  "text-wrap-mode": "nowrap",
  "top": "2%",
  "transform": "rotate(6deg)",
  "white-space-collapse": "collapse",
  "z-index": "4"
 },
 ".nest.bold .postit": {
  "font-weight": "900"
 },
 ".postit.at-clock": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(43, 42, 46)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(57, 255, 20)",
  "border-bottom-style": "solid",
  "border-bottom-width": "3px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(57, 255, 20)",
  "border-left-style": "solid",
  "border-left-width": "3px",
  "border-right-color": "rgb(57, 255, 20)",
  "border-right-style": "solid",
  "border-right-width": "3px",
  "border-top-color": "rgb(57, 255, 20)",
  "border-top-style": "solid",
  "border-top-width": "3px",
  "box-shadow": "rgb(255, 61, 127) 3px 3px 0px",
  "color": "rgb(57, 255, 20)",
  "font-family": "\"DSEG7 Classic\", \"Courier New\", Courier, monospace",
  "font-weight": "900",
  "line-height": "1.1",
  "padding-bottom": "2px",
  "padding-left": "6px",
  "padding-right": "6px",
  "padding-top": "2px",
  "text-shadow": "rgb(15, 58, 0) 1px 1px 0px",
  "transform": "none"
 },
 ".postit.at-clock .led-text": {
  "color": "rgb(255, 243, 209)",
  "font-family": "Fredoka, \"Arial Rounded MT Bold\", \"Trebuchet MS\", sans-serif",
  "font-weight": "700",
  "text-shadow": "rgb(0, 0, 0) 1px 1px 0px"
 },
 ".postit.minutes": {
  "font-family": "\"Patrick Hand\", \"Trebuchet MS\", Verdana, sans-serif",
  "font-size": "clamp(13px, 1.3vw, 19px)",
  "line-height": "1.05",
  "padding-bottom": "2px",
  "padding-left": "7px",
  "padding-right": "7px",
  "padding-top": "2px"
 },
 ".bubble": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(255, 247, 232)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(0, 0, 0)",
  "border-bottom-left-radius": "14px",
  "border-bottom-right-radius": "14px",
  "border-bottom-style": "solid",
  "border-bottom-width": "3px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(0, 0, 0)",
  "border-left-style": "solid",
  "border-left-width": "3px",
  "border-right-color": "rgb(0, 0, 0)",
  "border-right-style": "solid",
  "border-right-width": "3px",
  "border-top-color": "rgb(0, 0, 0)",
  "border-top-left-radius": "14px",
  "border-top-right-radius": "14px",
  "border-top-style": "solid",
  "border-top-width": "3px",
  "color": "rgb(11, 7, 22)",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "clamp(11px, 1.2vw, 17px)",
  "left": "50%",
  "opacity": "0",
  "padding-bottom": "4px",
  "padding-left": "9px",
  "padding-right": "9px",
  "padding-top": "4px",
  "pointer-events": "none",
  "position": "absolute",
  "text-wrap-mode": "nowrap",
  "top": "-14%",
  "transform": "translateX(-50%)",
  "white-space-collapse": "collapse",
  "z-index": "25"
 },
 ".bubble::after": {
  "border-bottom-color": "currentcolor",
  "border-bottom-style": "none",
  "border-bottom-width": "0px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "transparent",
  "border-left-style": "solid",
  "border-left-width": "8px",
  "border-right-color": "transparent",
  "border-right-style": "solid",
  "border-right-width": "8px",
  "border-top-color": "rgb(0, 0, 0)",
  "border-top-style": "solid",
  "border-top-width": "8px",
  "bottom": "-11px",
  "content": "\"\"",
  "left": "30%",
  "position": "absolute"
 },
 ".bubble.show": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "1.6s",
  "animation-fill-mode": "forwards",
  "animation-iteration-count": "1",
  "animation-name": "bubble",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(12)"
 },
 "@keyframes bubble » 0%, 60%": {
  "opacity": "1"
 },
 "@keyframes bubble » 100%": {
  "opacity": "0"
 },
 ".skip-log": {
  "color": "rgb(154, 143, 184)",
  "font-family": "\"Courier New\", Courier, monospace",
  "font-size": "13px",
  "max-width": "80vw"
 },
 ".mess": {
  "height": "100%",
  "left": "-6%",
  "pointer-events": "none",
  "position": "absolute",
  "top": "6%",
  "width": "112%",
  "z-index": "5"
 },
 ".readout #2": {
  "position": "relative",
  "z-index": "3"
 },
 ".floor-mess": {
  "bottom": "0px",
  "height": "100%",
  "left": "0px",
  "pointer-events": "none",
  "position": "absolute",
  "right": "0px",
  "top": "0px",
  "width": "100%"
 },
 ".pieces": {
  "bottom": "0px",
  "height": "100%",
  "left": "0px",
  "pointer-events": "none",
  "position": "absolute",
  "right": "0px",
  "top": "0px",
  "width": "100%"
 },
 "#trough": {
  "bottom": "0px",
  "left": "0px",
  "pointer-events": "none",
  "position": "absolute",
  "right": "0px",
  "top": "0px"
 },
 "#trough i": {
  "background-color": "rgb(74, 82, 96)",
  "box-shadow": "rgb(26, 13, 46) 0px 0px 0px 1px inset",
  "position": "absolute"
 },
 "#trough .t-left, #trough .t-right": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.8s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "trough-down",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "linear",
  "background-image": "repeating-linear-gradient(rgba(120, 200, 255, 0.55) 0px, rgba(120, 200, 255, 0.55) 5px, transparent 5px, transparent 12px)",
  "bottom": "0px",
  "top": "0px",
  "width": "RAW <--trough>"
 },
 "#trough .t-left": {
  "left": "0px"
 },
 "#trough .t-right": {
  "right": "0px"
 },
 "#trough .t-bl, #trough .t-br": {
  "background-image": "repeating-linear-gradient(90deg, rgba(120, 200, 255, 0.55) 0px, rgba(120, 200, 255, 0.55) 5px, transparent 5px, transparent 12px)",
  "bottom": "0px",
  "height": "RAW <--trough>"
 },
 "#trough .t-bl": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.8s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "trough-right",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "linear",
  "left": "0px",
  "width": "50%"
 },
 "#trough .t-br": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.8s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "trough-left",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "linear",
  "left": "50%",
  "right": "0px"
 },
 "@keyframes trough-down » 0%": {
  "background-position-x": "0px",
  "background-position-y": "0px"
 },
 "@keyframes trough-down » 100%": {
  "background-position-x": "0px",
  "background-position-y": "12px"
 },
 "@keyframes trough-right » 0%": {
  "background-position-x": "0px",
  "background-position-y": "0px"
 },
 "@keyframes trough-right » 100%": {
  "background-position-x": "12px",
  "background-position-y": "0px"
 },
 "@keyframes trough-left » 0%": {
  "background-position-x": "0px",
  "background-position-y": "0px"
 },
 "@keyframes trough-left » 100%": {
  "background-position-x": "-12px",
  "background-position-y": "0px"
 },
 "#mom": {
  "overflow-x": "hidden",
  "overflow-y": "hidden",
  "pointer-events": "none",
  "position": "absolute",
  "z-index": "5"
 },
 "#mom .face": {
  "position": "absolute"
 },
 "#mom .face svg": {
  "display": "block",
  "height": "100%",
  "overflow-x": "visible",
  "overflow-y": "visible",
  "width": "100%"
 },
 "#mom .face.from-top": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.85s",
  "animation-fill-mode": "forwards",
  "animation-iteration-count": "1",
  "animation-name": "mom-top",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "cubic-bezier(0.2, 0.9, 0.3, 1)"
 },
 "#mom .face.from-bottom": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.85s",
  "animation-fill-mode": "forwards",
  "animation-iteration-count": "1",
  "animation-name": "mom-bottom",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "cubic-bezier(0.2, 0.9, 0.3, 1)"
 },
 "@keyframes mom-top » 0%": {
  "transform": "translateY(-105%)"
 },
 "@keyframes mom-top » 30%, 68%": {
  "transform": "translateY(0px)"
 },
 "@keyframes mom-top » 100%": {
  "transform": "translateY(-105%)"
 },
 "@keyframes mom-bottom » 0%": {
  "transform": "translateY(105%)"
 },
 "@keyframes mom-bottom » 30%, 68%": {
  "transform": "translateY(0px)"
 },
 "@keyframes mom-bottom » 100%": {
  "transform": "translateY(105%)"
 },
 ".mom-face .skin": {
  "fill": "rgb(63, 122, 44)",
  "stroke": "rgb(12, 26, 8)",
  "stroke-width": "5"
 },
 ".mom-face .shade": {
  "fill": "rgb(36, 80, 26)",
  "opacity": "0.7"
 },
 ".mom-face .stalk": {
  "fill": "none",
  "stroke": "rgb(12, 26, 8)",
  "stroke-linecap": "round",
  "stroke-width": "7"
 },
 ".mom-face .eye": {
  "fill": "rgb(255, 242, 214)",
  "stroke": "rgb(12, 26, 8)",
  "stroke-width": "4"
 },
 ".mom-face .vein": {
  "fill": "none",
  "stroke": "rgb(208, 16, 42)",
  "stroke-width": "2"
 },
 ".mom-face .pin": {
  "fill": "rgb(12, 0, 0)"
 },
 ".mom-face .brow": {
  "fill": "none",
  "stroke": "rgb(12, 26, 8)",
  "stroke-linecap": "round",
  "stroke-width": "6"
 },
 ".mom-face .maw": {
  "fill": "rgb(42, 0, 8)",
  "stroke": "rgb(12, 26, 8)",
  "stroke-width": "4"
 },
 ".mom-face .teeth": {
  "fill": "none",
  "stroke": "rgb(244, 236, 204)",
  "stroke-linejoin": "miter",
  "stroke-width": "3.5"
 },
 ".mom-face .drool": {
  "fill": "rgb(184, 255, 94)",
  "opacity": "0.85"
 },
 "#popups": {
  "bottom": "0px",
  "left": "0px",
  "pointer-events": "none",
  "position": "absolute",
  "right": "0px",
  "top": "0px",
  "z-index": "30"
 },
 ".popup": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "1.1s",
  "animation-fill-mode": "forwards",
  "animation-iteration-count": "1",
  "animation-name": "rise",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(8)",
  "color": "rgb(255, 210, 58)",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "clamp(16px, 2vw, 26px)",
  "position": "absolute",
  "text-shadow": "rgb(0, 0, 0) 3px 3px 0px",
  "transform": "translate(-50%, -50%)"
 },
 "@keyframes rise » 100%": {
  "opacity": "0",
  "transform": "translate(-50%, -160%)"
 },
 "#banner": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(0, 0, 0)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(255, 210, 58)",
  "border-bottom-style": "solid",
  "border-bottom-width": "4px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(255, 210, 58)",
  "border-left-style": "solid",
  "border-left-width": "4px",
  "border-right-color": "rgb(255, 210, 58)",
  "border-right-style": "solid",
  "border-right-width": "4px",
  "border-top-color": "rgb(255, 210, 58)",
  "border-top-style": "solid",
  "border-top-width": "4px",
  "box-shadow": "rgb(255, 61, 127) 8px 8px 0px",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "clamp(16px, 2vw, 24px)",
  "left": "50%",
  "padding-bottom": "14px",
  "padding-left": "34px",
  "padding-right": "34px",
  "padding-top": "14px",
  "pointer-events": "none",
  "position": "absolute",
  "top": "50%",
  "transform": "translate(-50%, -50%)",
  "z-index": "40"
 },
 "#banner .big": {
  "color": "rgb(255, 210, 58)",
  "font-size": "1.8em"
 },
 "#banner .good": {
  "color": "rgb(125, 255, 106)"
 },
 "#banner .left": {
  "color": "rgb(34, 227, 255)"
 },
 "#cleanup": {
  "align-items": "center",
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(34, 227, 255)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(0, 0, 0)",
  "border-bottom-style": "solid",
  "border-bottom-width": "4px",
  "bottom": "-4px",
  "color": "rgb(0, 0, 0)",
  "column-gap": "clamp(12px, 3vw, 48px)",
  "display": "flex",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "justify-content": "center",
  "left": "0px",
  "overflow-x": "hidden",
  "overflow-y": "hidden",
  "padding-bottom": "0px",
  "padding-left": "18px",
  "padding-right": "18px",
  "padding-top": "0px",
  "position": "absolute",
  "right": "0px",
  "row-gap": "clamp(12px, 3vw, 48px)",
  "text-wrap-mode": "nowrap",
  "top": "0px",
  "white-space-collapse": "collapse",
  "z-index": "3"
 },
 "#cleanup .call": {
  "align-items": "center",
  "display": "flex",
  "flex-direction": "column",
  "line-height": "1"
 },
 "#cleanup .head": {
  "font-size": "clamp(18px, 2.1vw, 32px)",
  "letter-spacing": "0.08em",
  "text-shadow": "rgb(255, 247, 232) 3px 3px 0px"
 },
 "#cleanup .sub": {
  "color": "rgb(0, 0, 0)",
  "font-family": "\"Trebuchet MS\", Verdana, sans-serif",
  "font-size": "clamp(11px, 1vw, 16px)",
  "font-weight": "700",
  "letter-spacing": "0.02em",
  "margin-top": "3px"
 },
 "#cleanup .left": {
  "display": "inline-block",
  "min-width": "1.4ch",
  "text-align": "right"
 },
 "#cleanup .result": {
  "font-size": "clamp(12px, 1.2vw, 18px)",
  "letter-spacing": "0.06em"
 },
 "#cleanup.flash": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "0.5s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "3",
  "animation-name": "cleanup-flash",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(1)"
 },
 "@keyframes cleanup-flash » 50%": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(0, 0, 0)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "color": "rgb(34, 227, 255)"
 },
 "#console": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(0, 0, 0)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-top-color": "rgb(255, 61, 127)",
  "border-top-style": "solid",
  "border-top-width": "4px",
  "column-gap": "14px",
  "display": "flex",
  "padding-bottom": "44px",
  "padding-left": "18px",
  "padding-right": "18px",
  "padding-top": "12px",
  "position": "relative",
  "row-gap": "14px"
 },
 ".box": {
  "align-items": "center",
  "border": "RAW 3px solid <--box>",
  "column-gap": "10px",
  "display": "flex",
  "flex-basis": "0%",
  "flex-grow": "1",
  "flex-shrink": "1",
  "min-width": "0px",
  "padding-bottom": "8px",
  "padding-left": "10px",
  "padding-right": "10px",
  "padding-top": "8px",
  "position": "relative",
  "row-gap": "10px"
 },
 ".box .num": {
  "align-items": "center",
  "background": "RAW <--box>",
  "color": "rgb(0, 0, 0)",
  "display": "grid",
  "flex-basis": "auto",
  "flex-grow": "0",
  "flex-shrink": "0",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "height": "30px",
  "justify-items": "center",
  "width": "30px"
 },
 ".box input": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "transparent",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "currentcolor",
  "border-bottom-style": "none",
  "border-bottom-width": "0px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "currentcolor",
  "border-left-style": "none",
  "border-left-width": "0px",
  "border-right-color": "currentcolor",
  "border-right-style": "none",
  "border-right-width": "0px",
  "border-top-color": "currentcolor",
  "border-top-style": "none",
  "border-top-width": "0px",
  "caret-color": "RAW <--box>",
  "color": "rgb(255, 247, 232)",
  "flex-basis": "0%",
  "flex-grow": "1",
  "flex-shrink": "1",
  "font-family": "\"Courier New\", Courier, monospace",
  "font-size": "clamp(16px, 1.7vw, 22px)",
  "font-weight": "700",
  "min-width": "0px",
  "outline-color": "initial",
  "outline-style": "initial",
  "outline-width": "0px",
  "text-transform": "uppercase"
 },
 ".box input::placeholder": {
  "color": "rgb(111, 102, 135)",
  "font-size": "0.8em",
  "opacity": "1",
  "text-transform": "none"
 },
 "#line-hints": {
  "bottom": "5px",
  "color": "rgb(154, 143, 184)",
  "font-size": "clamp(10px, 0.85vw, 13px)",
  "left": "18px",
  "line-height": "1.2",
  "overflow-x": "hidden",
  "overflow-y": "hidden",
  "pointer-events": "none",
  "position": "absolute",
  "right": "18px",
  "text-overflow": "ellipsis",
  "text-wrap-mode": "nowrap",
  "white-space-collapse": "collapse"
 },
 "#line-hints b": {
  "color": "rgb(255, 247, 232)",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-weight": "400",
  "letter-spacing": "0.04em"
 },
 ".box .err": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(232, 16, 42)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "color": "rgb(255, 255, 255)",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "14px",
  "left": "-3px",
  "letter-spacing": "0.12em",
  "line-height": "1.3",
  "padding-bottom": "0px",
  "padding-left": "6px",
  "padding-right": "6px",
  "padding-top": "0px",
  "position": "absolute",
  "top": "calc(100% + 7px)",
  "visibility": "hidden"
 },
 ".box.rejected .err": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "1s",
  "animation-fill-mode": "forwards",
  "animation-iteration-count": "1",
  "animation-name": "err",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(1)",
  "visibility": "visible"
 },
 ".box.rejected": {
  "border-bottom-color": "rgb(232, 16, 42)",
  "border-left-color": "rgb(232, 16, 42)",
  "border-right-color": "rgb(232, 16, 42)",
  "border-top-color": "rgb(232, 16, 42)"
 },
 "@keyframes err » 0%, 99%": {
  "opacity": "1"
 },
 "@keyframes err » 100%": {
  "opacity": "0"
 },
 ".box #2": {
  "opacity": "0.55"
 },
 ".box.active": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "2.4s",
  "animation-fill-mode": "none",
  "animation-iteration-count": "infinite",
  "animation-name": "neon",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "ease-in-out",
  "background": "RAW color-mix(in srgb, <--box> 16%, #000)",
  "border-bottom-width": "4px",
  "border-left-width": "4px",
  "border-right-width": "4px",
  "border-top-width": "4px",
  "box-shadow": "RAW 6px 6px 0 <--box>",
  "opacity": "1"
 },
 "@keyframes neon » 0%, 100%": {
  "box-shadow": "RAW 6px 6px 0 <--box>, 0 0 0 0 transparent"
 },
 "@keyframes neon » 50%": {
  "box-shadow": "RAW 6px 6px 0 <--box>, 0 0 14px 2px color-mix(in srgb, <--box> 55%, transparent)"
 },
 ".box.active.switched": {
  "animation-delay": "0s, 0.18s",
  "animation-direction": "normal, normal",
  "animation-duration": "0.18s, 2.4s",
  "animation-fill-mode": "none, none",
  "animation-iteration-count": "1, infinite",
  "animation-name": "switched, neon",
  "animation-play-state": "running, running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "steps(2), ease-in-out"
 },
 "@keyframes switched » 0%, 100%": {
  "background": "RAW <--box>",
  "box-shadow": "RAW 6px 6px 0 #fff7e8, 0 0 22px 6px <--box>"
 },
 ".overlay": {
  "align-items": "center",
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgba(0, 0, 0, 0.55)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "bottom": "0px",
  "display": "flex",
  "justify-content": "center",
  "left": "0px",
  "position": "fixed",
  "right": "0px",
  "top": "0px",
  "z-index": "60"
 },
 ".panel": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(11, 7, 22)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(255, 247, 232)",
  "border-bottom-style": "solid",
  "border-bottom-width": "4px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(255, 247, 232)",
  "border-left-style": "solid",
  "border-left-width": "4px",
  "border-right-color": "rgb(255, 247, 232)",
  "border-right-style": "solid",
  "border-right-width": "4px",
  "border-top-color": "rgb(255, 247, 232)",
  "border-top-style": "solid",
  "border-top-width": "4px",
  "box-shadow": "rgb(0, 0, 0) 10px 10px 0px",
  "min-width": "min(520px, 90vw)",
  "padding-bottom": "18px",
  "padding-left": "24px",
  "padding-right": "24px",
  "padding-top": "18px",
  "text-align": "center"
 },
 ".panel .title": {
  "color": "rgb(255, 210, 58)",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "28px",
  "margin-bottom": "10px"
 },
 ".panel .hint": {
  "margin-top": "12px"
 },
 "#dev-prompt input": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(0, 0, 0)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "border-bottom-color": "rgb(34, 227, 255)",
  "border-bottom-style": "solid",
  "border-bottom-width": "3px",
  "border-image-outset": "0",
  "border-image-repeat": "stretch",
  "border-image-slice": "100%",
  "border-image-source": "none",
  "border-image-width": "1",
  "border-left-color": "rgb(34, 227, 255)",
  "border-left-style": "solid",
  "border-left-width": "3px",
  "border-right-color": "rgb(34, 227, 255)",
  "border-right-style": "solid",
  "border-right-width": "3px",
  "border-top-color": "rgb(34, 227, 255)",
  "border-top-style": "solid",
  "border-top-width": "3px",
  "color": "rgb(255, 247, 232)",
  "font-family": "\"Courier New\", Courier, monospace",
  "font-size": "20px",
  "outline-color": "initial",
  "outline-style": "initial",
  "outline-width": "0px",
  "padding-bottom": "8px",
  "padding-left": "8px",
  "padding-right": "8px",
  "padding-top": "8px",
  "width": "100%"
 },
 "#dev-prompt .bar": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(27, 15, 51)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "height": "8px",
  "margin-top": "10px"
 },
 "#dev-prompt .bar i": {
  "background-attachment": "initial",
  "background-clip": "initial",
  "background-color": "rgb(34, 227, 255)",
  "background-image": "initial",
  "background-origin": "initial",
  "background-position-x": "initial",
  "background-position-y": "initial",
  "background-repeat": "initial",
  "background-size": "initial",
  "display": "block",
  "height": "100%",
  "transform-origin": "left center"
 },
 "#dev-prompt .msg": {
  "color": "rgb(255, 61, 127)",
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "margin-top": "8px",
  "min-height": "1.4em"
 },
 ".over": {
  "color": "rgb(255, 61, 127)",
  "font-size": "clamp(40px, 8cqw, 96px)",
  "text-shadow": "rgb(0, 0, 0) 6px 6px 0px"
 },
 "#screen-over p": {
  "font-family": "\"Arial Black\", Impact, Haettenschweiler, sans-serif",
  "font-size": "28px",
  "margin-bottom": "0px",
  "margin-left": "0px",
  "margin-right": "0px",
  "margin-top": "0px"
 },
 "#screen-over p.hint": {
  "font-family": "\"Trebuchet MS\", Verdana, sans-serif",
  "font-size": "13px"
 },
 "#over-buttons": {
  "margin-top": "12px"
 },
 "@media (prefers-reduced-motion: reduce) » #trough .t-left, #trough .t-right, #trough .t-bl, #trough .t-br, .blink, .nest[data-state=\"trigger\"] .readout > span, .nest.scurry .legs, #cords .cord-stripes, #water .jet .core, #water .jet .burst, .box.active, .box.active.switched, #cleanup.flash, #warp.lit, #warp .plaque.wobble .letters, #title-scene *, #setup-critter *": {
  "animation-delay": "0s",
  "animation-direction": "normal",
  "animation-duration": "auto",
  "animation-fill-mode": "none",
  "animation-iteration-count": "1",
  "animation-name": "none",
  "animation-play-state": "running",
  "animation-range-end": "normal",
  "animation-range-start": "normal",
  "animation-timeline": "auto",
  "animation-timing-function": "ease"
 },
 "@media (prefers-reduced-motion: reduce) » #title-scene .note, #setup-critter .note": {
  "opacity": "1"
 },
 "@media (prefers-reduced-motion: reduce) » .nest[data-state=\"trigger\"] .readout > span": {
  "border-bottom-color": "rgb(34, 227, 255)",
  "border-left-color": "rgb(34, 227, 255)",
  "border-right-color": "rgb(34, 227, 255)",
  "border-top-color": "rgb(34, 227, 255)"
 }
};
