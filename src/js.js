//global variables
var showAll = false,
    extensionUrl = chrome.extension.getURL(''),
    urlExtensionUrl = 'url("' + extensionUrl,
    blankImg = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///////yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
    urlBlankImg = 'url("' + blankImg + '")',
    patternCSSUrl = 'url(' + extensionUrl + "pattern.png" + ')',
    patternLightUrl = extensionUrl + "pattern-light.png",
    patternLightCSSUrl = 'url(' + patternLightUrl + ')',
    eyeCSSUrl = 'url(' + extensionUrl + "eye.png" + ')',
    undoCSSUrl = 'url(' + extensionUrl + "undo.png" + ')',
    tagList = ['IMG', 'DIV', 'SPAN', 'A', 'UL', 'LI', 'TD', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'I', 'STRONG', 'B', 'BIG', 'BUTTON', 'CENTER', 'SECTION', 'TABLE', 'FIGURE', 'ASIDE', 'HEADER', 'VIDEO', 'P', 'ARTICLE'],
    tagListCSS = tagList.join(),
    iframes = [],
    contentLoaded = false,
    settings = null,
    quotesRegex = /['"]/g;

function inIframe () {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

//keep track of contentLoaded
window.addEventListener('DOMContentLoaded', function () {
    canvas_nacl = document.createElement('canvas');
    canvas_nacl.setAttribute('id', 'wizimage_canvas');
    document.body.appendChild(canvas_nacl);
    $('#wizimage_canvas').css({
        'display': 'none',
    });

    canvases_room = document.createElement('div');
    canvases_room.setAttribute('id', 'wizimage_canvases_room');
    document.body.appendChild(canvases_room);

    var paypal_div = document.getElementById("wizimage_paypal_donation");
    if((paypal_div == null || paypal_div == undefined) && inIframe() === false) {

        // Paypal donation
        var htmlText = 
                    '<div style="text-align: center">' + 
                        'Please support further development of this extension. 100% of your donation will be used for development.' +
                    '</div><br/>' + 
                    '<form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top" style="margin: 0 auto; width: 0">' +
                        '<input type="hidden" name="cmd" value="_s-xclick">' +
                        '<input type="hidden" name="hosted_button_id" value="KE9PLAN32JWS2">' +
                        '<input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!">' +
                        '<img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1">' +
                    '</form>'

        paypal_div = document.createElement('div');
        paypal_div.setAttribute('id', 'wizimage_paypal_donation');
        paypal_div.innerHTML = htmlText;
        paypal_div.className += ' ' + 'wzmPaypalDonation';
        document.body.appendChild(paypal_div);
        console.log("paypal donation");
    }

    contentLoaded = true; 
});



//start by seeing if is active or is paused etc.
chrome.runtime.sendMessage({ r: 'getSettings' }, function (s) {
    settings = s;
    //if is active - go
    if (settings && !settings.isExcluded && !settings.isExcludedForTab && !settings.isPaused && !settings.isPausedForTab) {
        //change icon
        chrome.runtime.sendMessage({ r: 'setColorIcon', toggle: true });
        //do main window
        DoWin(window, contentLoaded);
    }
});

//catch 'Show Images' option from browser actions
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.r == 'showImages') ShowImages();
    }
);

function ShowImages() {
    if (showAll) return;
    showAll = true;
    if (window == top)
        chrome.runtime.sendMessage({ r: 'setColorIcon', toggle: false });
    window.wzmShowImages();
    for (var i = 0, max = iframes.length; i < max; i++) {
        try {
            if (iframes[i].contentWindow && iframes[i].contentWindow.wzmShowImages)
                iframes[i].contentWindow.wzmShowImages();
        }
        catch (err) { /*iframe may have been rewritten*/ }
    }
}

function DoWin(win, winContentLoaded) {
    var doc = win.document,
        headStyles = {},
        observer = null,
        eye = null,
        mouseMoved = false,
        mouseEvent = null,
        mouseOverEl = null,
        elList = [],
        hasStarted = false;
    //start, or register start
    if (winContentLoaded)
        Start();
    else
        win.addEventListener('DOMContentLoaded', Start);
    //we need to set some css as soon as possible
    var pollID = setInterval(function () {
        if (showAll) clearInterval(pollID);
        else if (doc.head) {
            if (!hasStarted) AddHeadStyle('body', '{opacity: 0 !important; }');
            AddHeadStyle('body ', '{background-image: none !important;}');
            AddHeadStyle('.wzmHide', '{opacity: 0 !important;}');
            AddHeadStyle('.wzmPatternBgImg', '{ background-repeat: repeat !important;text-indent:0 !important;}'); //text-indent to show alt text
            AddHeadStyle('.wzmPaypalDonation', '{left: 0px; bottom: 0px; width: 100%; z-index: 9000; background: #d09327}');
            for (var i = 0; i < 8; i++) {
                AddHeadStyle('.wzmPatternBgImg.wzmShade' + i, '{background-image: ' + (settings.isNoPattern ? 'none' : 'url(' + extensionUrl + "pattern" + i + ".png" + ')') + ' !important; }');
                AddHeadStyle('.wzmPatternBgImg.wzmPatternBgImgLight.wzmShade' + i, '{background-image: ' + (settings.isNoPattern ? 'none' : 'url(' + extensionUrl + "pattern-light" + i + ".png" + ')') + ' !important; }');
            }
            clearInterval(pollID);
        }
    }, 1);
    //ALT-a, ALT-z
    doc.addEventListener('keydown', DocKeyDown);
    //notice when mouse has moved
    doc.addEventListener('mousemove', DocMouseMove);
    win.addEventListener('scroll', WindowScroll);

    function DocMouseMove(e) { mouseEvent = e; mouseMoved = true; };
    function WindowScroll() { mouseMoved = true; UpdateElRects(); CheckMousePosition(); }
    function DocKeyDown(e) {
        if (e.altKey && e.keyCode == 80 && !settings.isPaused) { //ALT-p
            settings.isPaused = true;
            chrome.runtime.sendMessage({ r: 'pause', toggle: true });
            ShowImages();
        }
        else if (mouseOverEl && e.altKey) {
            if (e.keyCode == 65 && mouseOverEl.wzmHasWizmageBG) { //ALT-a
                ShowEl.call(mouseOverEl);
                eye.style.display = 'none';
            } else if (e.keyCode == 90 && !mouseOverEl.wzmHasWizmageBG) { //ALT-z
                DoElement.call(mouseOverEl);
                eye.style.display = 'none';
            }
        }
    }
    //keep track of which image-element mouse if over
    function mouseEntered(e) {
        DoHover(this, true, e);
        e.stopPropagation();
    }
    function mouseLeft(e) {
        DoHover(this, false, e);
    }
    //process all elements with background-image, and observe mutations for new ones
    function Start() {
        if (!doc.body) return; //with iFrames it happens
        //when viewing an image (not a webpage)
        if (win == top && doc.body.children.length == 1 && doc.body.children[0].tagName == 'IMG') {
            ShowImages();
            return;
        }
        DoElements(doc.body, false);
        //show body
        if (headStyles['body']) RemoveHeadStyle('body');
        //create eye
        eye = doc.createElement('div');
        eye.style.display = 'none';
        eye.style.width = eye.style.height = '16px';
        eye.style.position = 'fixed';
        eye.style.zIndex = 1e8;
        eye.style.cursor = 'pointer';
        eye.style.padding = '0';
        eye.style.margin = '0';
        eye.style.opacity = '.5';
        doc.body.appendChild(eye);
        //create temporary div, to eager load background img light for noEye to avoid flicker
        if (settings.isNoEye) {
            for (var i = 0; i < 8; i++) {
                var div = doc.createElement('div');
                div.style.opacity = div.style.width = div.style.height = 0;
                div.className = 'wzmPatternBgImg wzmPatternBgImgLight wzmShade' + i;
                doc.body.appendChild(div);
            }
        }
        //mutation observer
        observer = new WebKitMutationObserver(function (mutations, observer) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type == 'attributes') {
                    if (m.attributeName == 'class') {
                        var oldHasLazy = m.oldValue != null && m.oldValue.indexOf('lazy') > -1, newHasLazy = m.target.className != null && m.target.className.indexOf('lazy') > -1;
                        if (oldHasLazy != newHasLazy)
                            DoElements(m.target, true);
                    } else if (m.attributeName == 'style' && m.target.style.backgroundImage.indexOf('url(') >- 1) {
                        var oldBgImg, oldBgImgMatch;
                        if (m.oldValue == null || !(oldBgImgMatch = /background(?:-image)?:[^;]*url\(['"]?(.+?)['"]?\)/.exec(m.oldValue)))
                            oldBgImg = '';
                        else
                            oldBgImg = oldBgImgMatch[1];
                        if (oldBgImg != /url\(['"]?(.+?)['"]?\)/.exec(m.target.style.backgroundImage)[1]) {
                            DoElement.call(m.target);
                        }
                    }
                }
                else if (m.addedNodes != null && m.addedNodes.length > 0)
                    for (var j = 0; j < m.addedNodes.length; j++) {
                        var el = m.addedNodes[j];
                        if (!el.tagName) //eg text nodes
                            continue;
                        if(el.tagName == 'CANVAS')
                            continue;
                        if (el.tagName == 'IFRAME')
                            DoIframe(el);
                        else
                            DoElements(el, true);
                    }
            }
        });
        observer.observe(doc, { subtree: true, childList: true, attributes: true, attributeOldValue: true });
        //CheckMousePosition every so often
        setInterval(CheckMousePosition, 250);
        setInterval(UpdateElRects, 3000);
        for (var i = 1; i < 7; i++)
            if ((i % 2) > 0)
                setTimeout(UpdateElRects, i * 1500);
        //empty iframes
        var iframes = doc.getElementsByTagName('iframe');
        for (var i = 0, max = iframes.length; i < max; i++) {
            DoIframe(iframes[i]);
        }
        //mark as started
        hasStarted = true;
    }
    function DoElements(el, includeEl) {
        if (includeEl && tagList.indexOf(el.tagName) > -1)
            DoElement.call(el);
        var all = el.querySelectorAll(tagListCSS);
        for (var i = 0, max = all.length; i < max; i++)
            DoElement.call(all[i]);
    }
    function DoIframe(iframe) {
        if (iframe.src && iframe.src != "about:blank" && iframe.src.substr(0, 11) != 'javascript:') return;
        iframes.push(iframe);
        var win = iframe.contentWindow;
        if (!win) return; //with iFrames it happens
        var pollNum = 0, pollID = setInterval(function () {
            if (doc.body) {
                clearInterval(pollID);
                DoWin(win, true);
            }
            if (++pollNum == 500)
                clearInterval(pollID);
        }, 10);
    }
    function load_processed() {
        $(this).removeClass("wzmHide");
        $(this).attr("wzmProcessed", "true");
        this.wzmProcessed = true;
        var uuid = $(this).attr("wiz-uuid");
        $("#" + uuid + "-canvas").remove();

        if(this.wzmProcessed) { // already processed
            DoWizmageBG(this, true); // Needed to enable eye icon in image
            //DoImgSrc(this, true);
            return;
        } 
    }
    function filter_rgba_array(rgba_arr) {
        for(var i = 0; i < rgba_arr.length; i++) {
            ri = i * 4 
            gi = ri + 1
            bi = gi + 1
            ai = bi + 1

            r = rgba_arr[ri];
            g = rgba_arr[gi];
            b = rgba_arr[bi];
           
            if(
                (r > 95 && g > 40 && b > 20) &&
                (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
                (Math.abs(r - g) > 15 && r > g && r > b)
                ) {
                rgba_arr[ri] = 127;
                rgba_arr[gi] = 127;
                rgba_arr[bi] = 127;
                rgba_arr[ai] = 255;
            }
        }
    }
    function filterImageContent(canvas, img, uuid) {
        canvas.setAttribute("width", img.width);
        canvas.setAttribute("height", img.height);

        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0); // at this point the img is loaded

        var width       = img.width;
        var height      = img.height;
        var image_data  = ctx.getImageData(0, 0, width, height);
        var rgba_arr    = image_data.data;

        filter_rgba_array(rgba_arr);
        image_data.data.set(rgba_arr);
        ctx.putImageData(image_data, 0, 0)
        data_url = canvas.toDataURL("image/png");

        img_actual = $("img[wiz-uuid="+ uuid + "]")[0];
        if(img_actual !== undefined) {
            img_actual.src = data_url;
            img_actual.srcset = '';
            img_actual.onload = load_processed;
        }
    }
    function ProcessImage() {

        var canvas = AddCanvasSibling(this);
        if(canvas) {
            this.wzmProcessed = true;
            var uuid = this.getAttribute("wiz-uuid")
            try {
                filterImageContent(canvas, this, uuid);
            } catch (err) {
                var xhr = new XMLHttpRequest();
                xhr.onload = function() {
                    var reader  = new FileReader();
                    reader.uuid = uuid;
                    reader.onloadend = function() {
                        var image         = new Image();
                        image.crossOrigin = "anonymous";
                        image.src         = reader.result;
                        image.uuid        = this.uuid;
                        image.onload = function(){
                            var width  = this.width;
                            var height = this.height;

                            var canvas_global = document.getElementById("wizimage_canvas");
                            canvas_global.setAttribute("width",  width );
                            canvas_global.setAttribute("height", height);

                            filterImageContent(canvas_global, this, this.uuid);
                        };
                    }
                    reader.readAsDataURL(xhr.response);
                };
                xhr.open("GET", this.src);
                xhr.responseType = "blob";
                xhr.send();
            }

            DoLoadProcessImageListener(this, false);
            DoLoadEventListener(this, false);
        }
    }
    function AddCanvasSibling(el) {
        var uuid = el.getAttribute("wiz-uuid") + "-canvas";
        while(document.getElementById(uuid)) {
            uuid = el.getAttribute("wiz-uuid") + "-canvas";
        }
        var canvas = document.createElement("canvas");
        canvas.setAttribute("id", uuid);

        var room = document.getElementById("wizimage_canvases_room");
        room.appendChild(canvas);

        //el.parentNode.insertBefore(canvas, el.nextSibling);
        AddClass(canvas, "wzmHide");
        return canvas;
    }
    function DoLoadProcessImageListener(el, toggle) {
        if (toggle && !el.wzmHasLoadProcessImageEventListener) {
            el.addEventListener('load', ProcessImage);
            el.wzmHasLoadProcessImageEventListener = true;
        } else if (!toggle && el.wzmHasLoadProcessImageEventListener) {
            el.removeEventListener('load', ProcessImage);
            el.wzmHasLoadProcessImageEventListener = false;
        }
    }
    function DoElement() {
        if (showAll) return;
        if (this.tagName == 'IMG') {

            //console.log(this.src);
            //this.crossOrigin = "Anonymous"; // To process images from other domains
            if(!$(this).hasClass("wiz-to-process")) {
                AddRandomWizId(this);
                AddClass(this, "wiz-to-process") // class used to trigger the load event once Nacl module is loaded
                AddAsSuspect(this);
            }

            //attach load event - needed 1) as we need to catch it after it is switched for the blankImg, 2) in case the img gets changed to something else later
            DoLoadProcessImageListener(this, true);
            DoLoadEventListener(this, true);

            //see if not yet loaded
            if (!this.complete) {
                //hide, to avoid flash until load event is handled
                DoHidden(this, true);
                return;
            }

            var elWidth = this.width, elHeight = this.height;
            if (this.src == blankImg) { //was successfully replaced
                DoHidden(this, false);
                DoWizmageBG(this, true);
                this.wzmBeenBlocked = true;
            } else if ((elWidth == 0 || elWidth > settings.maxSafe) && (elHeight == 0 || elHeight > settings.maxSafe)) { //needs to be hidden - we need to catch 0 too, as sometimes images start off as zero
                DoMouseEventListeners(this, true);
                if (!this.wzmHasTitleAndSizeSetup) {
                    // this.style.width = elWidth + 'px';
                    // this.style.height = elHeight + 'px';
                    if (!this.title)
                        if (this.alt)
                            this.title = this.alt;
                        else {
                            this.src.match(/([-\w]+)(\.[\w]+)?$/i);
                            this.title = RegExp.$1;
                        }
                    this.wzmHasTitleAndSizeSetup = true;
                }
                DoHidden(this, true);
                DoImgSrc(this, true);
                if (this.parentElement && this.parentElement.tagName == 'PICTURE') {
                    for (var i = 0; i < this.parentElement.childNodes.length; i++) {
                        var node = this.parentElement.childNodes[i];
                        //if (node.tagName == 'SOURCE')
                            //DoImgSrc(node, true);
                    }
                }
                //this.src = blankImg;
            } else { //small image
                DoHidden(this, false);
            }
        }
        // else if (this.tagName == 'VIDEO') {
        //     AddAsSuspect(this);
        //     DoHidden(this, true);
        //     DoWizmageBG(this, true);
        // } else {
        //     var compStyle = getComputedStyle(this), bgimg = compStyle['background-image'], width = parseInt(compStyle['width']) || this.clientWidth, height = parseInt(compStyle['height']) || this.clientHeight; //as per https://developer.mozilla.org/en/docs/Web/API/window.getComputedStyle, getComputedStyle will return the 'used values' for width and height, which is always in px. We also use clientXXX, since sometimes compStyle returns NaN.
        //     if (bgimg != 'none' && (width == 0 || width > settings.maxSafe) && (height == 0 || height > settings.maxSafe) we need to catch 0 too, as sometimes elements start off as zero
        //             && bgimg.indexOf('url(') != -1
        //             && !bgimg.startsWith(urlExtensionUrl) && bgimg != urlBlankImg
        //             ) {
        //         AddAsSuspect(this);
        //         DoWizmageBG(this, true);
        //         DoMouseEventListeners(this, true);
        //         if (this.wzmLastCheckedSrc != bgimg) {
        //             this.wzmLastCheckedSrc = bgimg;
        //             var i = new Image();
        //             i.owner = this;
        //             i.onload = CheckBgImg;
        //             var urlMatch = /\burl\(["']?(.*?)["']?\)/.exec(bgimg);
        //             if (urlMatch)
        //                 i.src = urlMatch[1];
        //         }
        //         this.wzmBeenBlocked = true;
        //     }
        // }
    }
    function CheckBgImg() {
        if (this.height <= settings.maxSafe || this.width <= settings.maxSafe) ShowEl.call(this.owner);
        this.onload = null;
    };

    function AddAsSuspect(el) {
        if (elList.indexOf(el) == -1) {
            elList.push(el);
            el.wzmRect = el.getBoundingClientRect();
        }
    }
    function DoWizmageBG(el, toggle) {
        if (toggle && !el.wzmHasWizmageBG) {
            // var shade = Math.floor(Math.random() * 8);
            // el.wzmShade = shade;
            // AddClass(el, 'wzmPatternBgImg wzmShade' + shade);
            el.wzmHasWizmageBG = true;
        } else if (!toggle && el.wzmHasWizmageBG) {
            // RemoveClass(el, 'wzmPatternBgImg');
            // RemoveClass(el, 'wzmShade' + el.wzmShade);
            el.wzmHasWizmageBG = false;
        }
    }
    // Used to store the original src of the image
    function DoImgSrc(el, toggle) {
        if (toggle && !$(el).attr("wiz-toggled-already")) {
            //console.log("DoImgSrc: " + el.src.slice(0, 80));
            el.oldsrc = el.src;
            el.oldsrcset = el.srcset;
            // Do not set to empty string, otherwise the processing
            // will result in an empty image
            //el.src = el.srcset = ''; 
            el.srcset = ''; // empty string to make sure filtered images are displayed in the img elements
            $(el).attr("wiz-toggled-already", "true")
        }
        else if (!toggle && $(el).attr("wiz-toggled-already") === "true"){
            var oldsrc = el.oldsrc;
            el.oldsrc = el.src;
            el.src = oldsrc;
            el.srcset = el.oldsrcset;
        }
    }
    function DoHidden(el, toggle) {
        if (toggle && !el.wzmHidden) {
            AddClass(el, 'wzmHide');
            el.wzmHidden = true;
        } else if (!toggle && el.wzmHidden) {
            RemoveClass(el, 'wzmHide');
            el.wzmHidden = false;
        }
    }
    function DoMouseEventListeners(el, toggle) {
        if (toggle && !el.wzmHasMouseEventListeners) {
            el.addEventListener('mouseover', mouseEntered);
            el.addEventListener('mouseout', mouseLeft);
            el.wzmHasMouseEventListeners = true;
        } else if (!toggle && el.wzmHasMouseEventListeners) {
            el.removeEventListener('mouseover', mouseEntered);
            el.removeEventListener('mouseout', mouseLeft);
            el.wzmHasMouseEventListeners = false;
        }
    }
    function DoLoadEventListener(el, toggle) {
        if (toggle && !el.wzmHasLoadEventListener) {
            el.addEventListener('load', DoElement);
            el.wzmHasLoadEventListener = true;
        } else if (!toggle && el.wzmHasLoadEventListener) {
            el.removeEventListener('load', DoElement);
            el.wzmHasLoadEventListener = false;
        }
    }

    function DoHover(el, toggle, evt) {
        var coords = el.wzmRect;
        if (toggle && !el.wzmHasHover) {
            if (mouseOverEl && mouseOverEl != el)
                DoHover(mouseOverEl, false);
            mouseOverEl = el;
            DoHoverVisual(el, true, coords);
            el.wzmHasHover = true;
        } else if (!toggle && el.wzmHasHover && (!evt || !IsMouseIn(evt, coords))) {
            DoHoverVisual(el, false, coords);
            el.wzmHasHover = false;
            if (el == mouseOverEl)
                mouseOverEl = null;
        }
    }

    function DoHoverVisual(el, toggle, coords) {
        if (toggle && !el.wzmHasHoverVisual && el.wzmHasWizmageBG) {
            if (!settings.isNoEye) {
                //eye
                PositionEye(el, coords);
                eye.style.display = 'block';
                function setupEye() {
                    eye.style.backgroundImage = eyeCSSUrl;
                    eye.onclick = function (e) {
                        e.stopPropagation();
                        ShowEl.call(el);
                        // hide the eye icon and not allow undo option for now
                        // TODO: Implement undo option
                        eye.style.display = 'none';
                        // eye.style.backgroundImage = undoCSSUrl;
                        // DoHoverVisualClearTimer(el, true);
                        // eye.onclick = function (e) {
                        //     e.stopPropagation();
                        //     DoElement.call(el);
                        //     setupEye();
                        //     DoHoverVisualClearTimer(el, true);
                        // }
                    }
                }
                setupEye();
            } else
                AddClass(el, 'wzmPatternBgImgLight');
            DoHoverVisualClearTimer(el, true);
            el.wzmHasHoverVisual = true;
        } else if (!toggle && el.wzmHasHoverVisual) {
            if (!settings.isNoEye)
                eye.style.display = 'none';
            else
                RemoveClass(el, 'wzmPatternBgImgLight');
            DoHoverVisualClearTimer(el, false);
            el.wzmHasHoverVisual = false;
        }
    }
    function DoHoverVisualClearTimer(el, toggle) {
        if (toggle) {
            DoHoverVisualClearTimer(el, false);
            el.wzmClearHoverVisualTimer = setTimeout(function () { DoHoverVisual(el, false); }, 2500);
        }
        else if (!toggle && el.wzmClearHoverVisualTimer) {
            clearTimeout(el.wzmClearHoverVisualTimer);
            el.wzmClearHoverVisualTimer = null;
        }
    }
    function PositionEye(el, coords) {
        eye.style.top = (coords.top < 0 ? 0 : coords.top) + 'px';
        var left = coords.right; if (left > doc.documentElement.clientWidth) left = doc.documentElement.clientWidth;
        eye.style.left = (left - 16) + 'px';

    }

    function UpdateElRects() {
        for (var i = 0, max = elList.length; i < max; i++) {
            var el = elList[i];
            el.wzmRect = el.getBoundingClientRect();
        }
    }

    function CheckMousePosition() {
        if (!mouseMoved || !mouseEvent || !contentLoaded || showAll) return;
        mouseMoved = false;
        //see if needs to defocus current
        if (mouseOverEl) {
            var coords = mouseOverEl.wzmRect;
            if (!IsMouseIn(mouseEvent, coords))
                DoHover(mouseOverEl, false);
            else if (mouseOverEl.wzmHasWizmageBG) {
                if (!mouseOverEl.wzmHasHoverVisual)
                    DoHoverVisual(mouseOverEl, true, coords);
                else {
                    DoHoverVisualClearTimer(mouseOverEl, true);
                    PositionEye(mouseOverEl, coords);
                }
            }
        }
        //find element under mouse
        var foundEl = mouseOverEl, found = false, foundSize = foundEl ? foundEl.wzmRect.width * foundEl.wzmRect.height : null;
        for (var i = 0, max = elList.length; i < max; i++) {
            var el = elList[i];
            if (el == foundEl)
                continue;
            var rect = el.wzmRect;
            if (IsMouseIn(mouseEvent, rect)) {
                //If not foundEl yet, use this. Else if foundEl has not got wzmBG, then if ours does, use it. Else if foundEl is bigger, use this.
                var useThis = false;
                if (!foundEl)
                    useThis = true;
                else if (!foundEl.wzmHasWizmageBG) {
                    if (el.wzmHasWizmageBG)
                        useThis = true;
                }
                else if ((foundSize > rect.width * rect.height) && foundEl.wzmHasWizmageBG == el.wzmHasWizmageBG)
                    useThis = true;
                if (useThis) {
                    foundEl = el;
                    foundSize = rect.width * rect.height;
                    found = true;
                }
            }
        }
        if (found && (foundEl.wzmHasWizmageBG || !mouseOverEl)) {
            DoHover(foundEl, true);
        }
    }
    function IsMouseIn(mouseEvt, coords) {
        return mouseEvt.x >= coords.left && mouseEvt.x < coords.right && mouseEvt.y >= coords.top && mouseEvt.y < coords.bottom;
    }

    function ShowEl() {
        DoHidden(this, false);
        if (this.tagName == 'IMG') {
            DoLoadEventListener(this, false);
            DoImgSrc(this, false);
            if (this.parentElement && this.parentElement.tagName == 'PICTURE') {
                for (var i = 0; i < this.parentElement.childNodes.length; i++) {
                    var node = this.parentElement.childNodes[i];
                    if (node.tagName == 'SOURCE')
                        DoImgSrc(node, false);
                }
            }
        }
        DoWizmageBG(this, false);
        if (this.wzmCheckTimeout) {
            clearTimeout(this.wzmCheckTimeout);
            this.wzmCheckTimeout = null;
        }
        if (showAll) {
            DoMouseEventListeners(this, false);
        }
    }

    function AddHeadStyle(n, s) {
        var styleel = doc.createElement('style');
        styleel.type = 'text/css';
        styleel.appendChild(doc.createTextNode(n + s));
        doc.head.appendChild(styleel);
        headStyles[n] = styleel;
    }
    function AddHeadScript(doc, src, code, onload) {
        var scriptel = doc.createElement('script');
        scriptel.type = 'text/javascript';
        if (src)
            scriptel.src = src;
        if (code)
            scriptel.appendChild(doc.createTextNode(code));
        if (onload)
            scriptel.onload = onload;
        doc.head.appendChild(scriptel);
    }
    function RemoveHeadStyle(n) {
        doc.head.removeChild(headStyles[n]);
        delete headStyles[n];
    }
    function RemoveClass(el, n) { //these assume long unique class names, so no need to check for word boundaries
        var oldClass = el.className, newClass = el.className.replace(new RegExp('\\b' + n + '\\b'), '');
        if (oldClass != newClass) {
            el.className = newClass;
        }
    }
    function AddClass(el, c) {
        el.className += ' ' + c;
    }
    function AddRandomWizId(el) {
        if($(el).attr("wiz-uuid") == null) {
            $(el).attr("wiz-uuid", guid());
        }
    }
    // from https://stackoverflow.com/a/105074/1065981
    function guid() {
      function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
      }
      return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
    }

    win.wzmShowImages = function () {
        doc.removeEventListener('keydown', DocKeyDown);
        doc.removeEventListener('mousemove', DocMouseMove);
        win.removeEventListener('scroll', WindowScroll);
        for (var i = 0, max = elList.length; i < max; i++)
            ShowEl.call(elList[i]);
        win.removeEventListener('DOMContentLoaded', Start);
        for (var s in headStyles)
            RemoveHeadStyle(s);
        if (mouseOverEl) {
            DoHover(mouseOverEl, false);
            mouseOverEl = null;
        }
        if (eye) {
            for (var i = 0, bodyChildren = doc.body.children; i < bodyChildren.length; i++) //for some reason, sometimes the eye is removed before
                if (bodyChildren[i] == eye)
                    doc.body.removeChild(eye);
        }
        if (observer)
            observer.disconnect();
    }

}
