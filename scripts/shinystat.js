function SSstoCk(cdom, nm) {
    var _st;
    if (cdom && cdom != "") {
        return 1;
    }
    if (window.opera) {
        return 1;
    }
    try {
        if (typeof(localStorage) == 'undefined' || typeof(sessionStorage) == 'undefined') {
            return 1;
        }
    } catch (e_r) {
        return 1;
    }
    if (!(_st = localStorage)) {
        return 1;
    }
    try {
        localStorage.setItem('sstat', '1');
        localStorage.removeItem('sstat');
        return 0;
    } catch (error) {
        return 1;
    }
    return 0;
}

function cCk(nm, vl, mn) {
    var ex = cdm = "";
    var okc = 0;
    var _sscdom = "";
    var saf = 0;
    try {
        if (navigator.vendor != null && navigator.vendor.match(/Apple/) && navigator.userAgent.indexOf('Safari') != -1) {
            saf = 1;
        }
    } catch (e_r) {}
    if (SSstoCk(_sscdom, nm)) {
        if (_sscdom && _sscdom != "") {
            cdm = " domain=" + _sscdom;
            if (mn) {
                document.cookie = nm + "=; expires=Thu, 01-Jan-70 00:00:01 GMT; path=/;";
            }
        }
        if (mn) {
            var d = new Date();
            d.setTime(d.getTime() + (mn * 6 * 1000));
            ex = "; expires=" + d.toGMTString();
        }
        document.cookie = nm + "=" + vl + ex + "; path=/;" + cdm + "";
    } else {
        try {
            if (saf) {
                sessionStorage.setItem(nm, vl);
                localStorage.setItem(nm, vl);
            } else {
                if (mn) {
                    _st = localStorage;
                } else {
                    _st = sessionStorage;
                }
                if (_st) {
                    _st.setItem(nm, vl);
                }
            }
        } catch (e_r) {}
    }
}

function rCk(nm) {
    var fcoo = null;
    var nEQ = nm + "=";
    var ca = document.cookie.split(';');
    var ses;
    var saf = 0;
    try {
        if (navigator.vendor != null && navigator.vendor.match(/Apple/) && navigator.userAgent.indexOf('Safari') != -1) {
            saf = 1;
        }
    } catch (e_r) {}
    if ((nm.indexOf("SV_") > -1) || (nm.indexOf("SSID_") > -1)) {
        ses = 1;
    }
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nEQ) == 0) {
            fcoo = c.substring(nEQ.length, c.length);
        }
    }
    if (SSstoCk("", nm)) {
        return (fcoo);
    } else {
        if (saf) {
            if ((sessionStorage.getItem(nm) == null) && (ses != 1)) {
                return (localStorage.getItem(nm));
            } else {
                return (sessionStorage.getItem(nm));
            }
        } else {
            if (ses) {
                if (fcoo) {
                    document.cookie = nm + "=; expires=Thu, 01-Jan-70 00:00:01 GMT; path=/;";
                    return (fcoo);
                }
                _sstore = sessionStorage;
            } else {
                if (fcoo || fcoo == "") {
                    document.cookie = nm + "=; expires=Thu, 01-Jan-70 00:00:01 GMT; path=/;";
                    return (fcoo);
                }
                _sstore = localStorage;
            }
            return (_sstore.getItem(nm));
        }
    }
}

function ud() {
    var u = "" + o_.getTime();
    return (u);
}

function udtb() {
    var u = "" + otb_.getTime();
    return (u);
}

function sswk_(tnow) {
    var w = Math.floor(((tnow / 86400000) - 4) / 7);
    return w
}

function _ssvoid() {
    return;
}

function sseC(d) {
    if (typeof(encodeURIComponent) == 'function') {
        return encodeURIComponent(d);
    } else {
        return escape(d);
    }
}

function sseXr(a, b) {
    var rt = "";
    for (var i = 0; i < a.length; i++) {
        rt += String.fromCharCode(b ^ a.charCodeAt(i));
    }
    return (rt);
}

function ss12m() {
    var th_ = ("https:" == document.location.protocol) ? "https://" : "http://";
    var ca = ";1;";
    var id = "53595029";
    var bk;
    var catg = "";
    var base = 16;
    var s = "b1/rihoxru`u/bnl.kry10.";
    if (ca) {
        var cad = ca.split(';');
        for (var i = 0; i < cad.length; i++) {
            if (cad[i]) {
                catg += "" + parseInt(cad[i], base);
                if (i < cad.length && cad[i + 1]) {
                    catg += ",";
                }
            }
        }
    }
    bk = sseXr(s, 1);
    var mble_ = document.createElement('script');
    mble_.type = 'text/javascript';
    mble_.id = "_12mblejs";
    mble_.async = true;
    mble_.src = th_ + bk + "4/" + id + "/" + catg;
    document.getElementsByTagName('head')[0].appendChild(mble_);
}

function ssxl(xl_) {
    var i_ = new Image(1, 1);
    i_.src = "https://s3.shinystat.com/cgi-bin/shinystat.cgi?TLR=1&USER=" + us_ + "&" + xl_ + "&RM=" + Math.round(Math.random() * 2147483647);
    for (i = 0; i < 100000; i++);
    i_.onload = function() {
        return;
    }
}

function stfCk(ck, v) {
    var ca = _pt_ = _iof_ = can = "";
    var _f_ = uv_ = uvw = 1;
    var _tf_ = ud();
    var _t_ = _bu_ = 0;
    _ort = new Date();
    _ort.setTime(o_.getTime() + (1000 * ssoffset_));
    if (!v) v = 0;
    if (ck) {
        ca = ck.split('%G');
        _f_ = parseInt(ca[2], 10);
        _tf_ = parseInt(ca[3], 10);
        if (otb_.getTime() - parseInt(v, 10) > st_) {
            _ot = new Date();
            _ot.setTime(parseInt(_tf_, 10) + (1000 * ssoffset_));
            if (_ort.getUTCMonth() == _ot.getUTCMonth()) {
                _f_++;
            } else {
                _f_ = 1;
                _tf_ = ud();
            }
        }
        _t_ = ca[0];
        _pt_ = ca[1];
        _bu_ = ca[4];
        if (ca[5]) can = ca[5];
    }
    _ot = new Date();
    _ot.setTime(parseInt(_bu_, 10) + (1000 * ssoffset_));
    if ((_ort.getUTCDay() == _ot.getUTCDay()) && (_ort.getUTCMonth() == _ot.getUTCMonth()) && (_ort.getUTCFullYear() == _ot.getUTCFullYear())) uv_ = 0;
    if (sswk_(_ort) == sswk_(_ot)) uvw = 0;
    _iof_ = "" + _t_ + "%G" + _pt_ + "%G" + _f_ + "%G" + _tf_ + "%G" + ud() + "%G";
    tf_ = "&FV=" + _f_ + "&UV=" + uv_ + "&US=" + uvw;
    return (_iof_);
}

function ssadbk(qs) {
    var img;
    img = new Image();
    th_ = ("https:" == document.location.protocol) ? "https:" : "http:";
    img.src = th_ + "//advm.brznetwork.com/commons/adsense.png";
    img.onload = function() {
        return;
    };
    img.onerror = function() {
        var iabk_ = new Image(1, 1);
        iabk_.src = "https://s3.shinystat.com/cgi-bin/adbsa.cgi" + qs + "&RM=" + Math.round(Math.random() * 2147483647);
        iabk_.onload = function() {
            return;
        }
    };
}

function ssImage_() {
    var parent;
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
        if (typeof scripts[i].src !== 'undefined') {
            if (scripts[i].src.indexOf("USER=" + us_) > -1) {
                parent = scripts[i];
                break;
            }
        }
    }
    var img = document.createElement('img'),
        a = document.createElement('a');
    img.src = ssqS_ + "&RM=" + Math.round(Math.random() * 2147483647);
    img.onload = function() {
        return;
    };
    a.href = "https://s3.shinystat.com/cgi-bin/shinystatv.cgi?USER=" + us_ + "&NH=1";
    a.style.display = "none";
    if (self != top) {
        a.target = "_blank";
    }
    a.appendChild(img);
    if (parent) parent.parentNode.insertBefore(a, parent.nextSibling);
}

function ssdbot() {
    var q = function(f, b) {
            try {
                return f()
            } catch (e) {
                return b
            }
        },
        n = navigator,
        u = q(function() {
            return n.userAgent || ""
        }, ""),
        l = u.toLowerCase(),
        m = /mobile|android|iphone|ipad|ipod/i.test(l),
        t = q(function() {
            return n.maxTouchPoints
        }, 0),
        c = q(function() {
            return window.matchMedia && matchMedia("(pointer: coarse)").matches
        }, !1),
        d = (m || t > 1 || c) ? "mobile" : "desktop",
        g = function() {
            var a = document.createElement("canvas"),
                b = a.getContext("webgl") || a.getContext("experimental-webgl");
            if (!b) return null;
            var e = b.getExtension("WEBGL_debug_renderer_info"),
                v = e ? b.getParameter(e.UNMASKED_VENDOR_WEBGL) : b.getParameter(b.VENDOR),
                r = e ? b.getParameter(e.UNMASKED_RENDERER_WEBGL) : b.getParameter(b.RENDERER);
            return {
                vendor: String(v),
                renderer: String(r)
            }
        },
        w = q(g, null),
        ws = w ? (w.vendor + " " + w.renderer).toLowerCase() : "",
        sw = ws.indexOf("swiftshader") > -1 || ws.indexOf("llvmpipe") > -1,
        wd = q(function() {
            return n.webdriver === !0
        }, !1),
        hk = /headless|phantomjs|selenium|puppeteer|playwright|webdriver/i.test(u),
        lg = q(function() {
            return n.languages
        }, null),
        pl = q(function() {
            return n.plugins ? n.plugins.length : null
        }, null),
        mt = q(function() {
            return n.mimeTypes ? n.mimeTypes.length : null
        }, null),
        ch = /chrome|chromium|crios/i.test(l),
        co = q(function() {
            return !!window.chrome
        }, !1),
        hc = q(function() {
            return n.hardwareConcurrency
        }, null),
        dm = q(function() {
            return n.deviceMemory
        }, null),
        S = function(p) {
            var s = 0;
            wd && (s -= 60);
            hk && (s -= p === "desktop" ? 35 : 30);
            (!lg || !lg.length) ? (s -= 15) : (s += 6);
            pl === 0 && (s -= p === "desktop" ? 4 : 0);
            mt === 0 && (s -= p === "desktop" ? 3 : 0);
            ch && !co && (s -= p === "desktop" ? 10 : 8);
            ((hc === 0 || hc === 1 || hc === null) && (dm === void 0 || dm === null)) ? (s -= p === "desktop" ? 10 : 6) : (s += 2);
            w ? sw ? (s -= p === "desktop" ? 18 : 14) : (s += 4) : (s -= p === "desktop" ? 6 : 3);
            p === "mobile" && m && t === 0 && !c && (s -= 4);
            s > 30 && (s = 30);
            s < -100 && (s = -100);
            return s
        },
        sc = d === "mobile" ? S("mobile") : S("desktop"),
        th = d === "mobile" ? {
            b: -30,
            s: -12
        } : {
            b: -35,
            s: -15
        },
        cl = "human";
    sc <= th.b ? cl = "bot" : sc <= th.s && (cl = "suspect");
    return {
        score: sc,
        classification: cl
    }
}

function SSsdk(e) {
    return ("");
}
us_ = "SS-53595029-55bae";
c_ = "";
l_ = "" + screen.width;
y_ = "" + screen.height;
v_ = navigator;
d_ = document.referrer;
var o_ = new Date();
var otb_ = new Date();
vu_ = "&VUT=-1";
n_ = "";
r_ = "" + escape(d_);
tf_ = "";
var st_ = 1800000;
if (self != top) {
    try {
        r_ = "" + escape(parent.document.referrer) + "&FHR=" + escape(d_);
    } catch (e_r) {}
}
ssid_ = "&SSID=";
o_.setTime(1000 * 1777400228);
var ssoffset_ = 7200;
var ssbot_ = ssdbot();
rssid_ = Math.round(Math.random() * ud());
k_ = "&CK=" + (v_.cookieEnabled ? "Y" : "N");
j_ = "&JV=" + (v_.javaEnabled() ? "Y" : "N");
hr_ = "&HR=" + escape(window.location.href);
if (v_.appName != "Netscape") {
    c_ = screen.colorDepth
} else {
    c_ = screen.pixelDepth
}
if (sv_ = rCk("SV_" + us_)) {
    vu_ = "&VUT=" + (o_.getTime() - parseInt(sv_, 10));
    if ((o_.getTime() - parseInt(sv_, 10)) > 1800000) {
        cCk("SSID_" + us_, rssid_);
        ssid_ += rssid_;
    } else {
        ssid_ += rCk("SSID_" + us_);
    }
} else {
    cCk("SSID_" + us_, rssid_);
    ssid_ += rssid_;
}
cCk("SV_" + us_, ud());
if (sn_ = rCk("SN_" + us_)) {
    if (sn_ == "ok") {
        sn_ = "";
    }
    cCk("SN_" + us_, stfCk(sn_, sv_, ""), 2592000);
} else {
    n_ = "&NUT=y";
    cCk("SN_" + us_, stfCk("", sv_, ""), 2592000);
}
var ssqS_ = "https://s3.shinystat.com/cgi-bin/shinystat.cgi?USER=" + us_ + "&REFER=" + r_ + "&COLOR=" + c_ + "&SIZE=" + l_ + "&RES=" + l_ + "X" + y_ + k_ + hr_ + j_ + vu_ + ssid_ + n_ + SSsdk(sv_) + tf_ + "&BSC=" + ssbot_.score + "&JS=Y&VJS=4017";
if (ssqS_.indexOf("NODW=yes") > -1) {
    var ig_ = new Image(1, 1);
    ig_.src = ssqS_ + "&RM=" + Math.round(Math.random() * 2147483647);
    ig_.onload = function() {
        _ssvoid();
    }
} else {
    ssImage_();
}
ssadbk(ssqS_.substring(ssqS_.indexOf('?')));
if (1) {
    function ssaE(d) {
        if (typeof(encodeURIComponent) == 'function') {
            return encodeURIComponent(d);
        } else {
            return escape(d);
        }
    }

    function ssaCss() {
        var par = "";
        try {
            if (typeof tfQXKMN_ != 'undefined') {
                par += tfQXKMN_;
            } else {
                if (typeof tf_ != 'undefined') {
                    par += tf_;
                }
            }
            if (typeof par_ != 'undefined') {
                var psl = par_.split('&');
                for (var i = 0; i < psl.length; i++) {
                    if (psl[i].indexOf("EMD5=") > -1) par += "&" + psl[i];
                    if (psl[i].indexOf("SEMER=") > -1) par += "&" + psl[i];
                    if (psl[i].indexOf("COCAM=") > -1) par += "&" + psl[i];
                }
            }
        } catch (e_r) {}
        return (par);
    }

    function ssaCls(nm, vl) {
        try {
            sessionStorage.setItem(nm, vl);
            localStorage.setItem(nm, vl);
        } catch (e_r) {}
    }

    function ssaRls(nm) {
        try {
            if (localStorage.getItem(nm) == null) {
                if (sessionStorage.getItem(nm) == null) {
                    return 0
                };
                return (sessionStorage.getItem(nm));
            } else {
                return (localStorage.getItem(nm));
            }
        } catch (e_r) {}
    }

    function ssaPm(e) {
        if (e == null) return;
        var msg = e.data;
        if (typeof msg === 'string' || msg instanceof String) {
            if (msg.indexOf("ssa_ls") > -1) {
                var ssa = msg.split('|');
                if (ssa[1]) {
                    if (ssa[1] != ssaRls("SSA")) {
                        ssaCls("SSA", ssa[1]);
                    }
                }
            }
        }
    }

    function ssaif() {
        var rf_ = ssaE(document.referrer);
        if (self != top) {
            try {
                rf_ = "" + ssaE(parent.document.referrer)
            } catch (e_r) {}
        }
        var sls_ = ssaRls("SSA");
        var nvs = 0;
        if ((typeof vu_ != "undefined") && vu_.indexOf("-1") > -1) {
            nvs = 1;
        } else {
            if (parseInt(vu_.substring(1 + vu_.indexOf("=")), 10) > 1800000) {
                nvs = 1;
            }
        }
        var ssals_ = "";
        if (sls_) {
            ssals_ = sls_;
        }
        var uri = "https://codicebusiness.shinystat.com/cgi-bin/getcod.cgi?IFSSA=yes&AFF=0&IDS=53595029&SSA=" + ssals_ + "&RF=" + rf_ + "&HR=" + ssaE(window.location.href) + ssaCss() + "&NV=" + nvs + "&RM=" + Math.round(Math.random() * 2147483647);

        if (document.getElementById('ifssa')) {
            //document.getElementById('ifssa').src=uri;
        } else {
            try {
                ifssa = document.createElement("IFRAME");
                ifssa.setAttribute("src", uri);
                ifssa.setAttribute("id", "ifssa");
                ifssa.setAttribute("name", "ifssa" + Math.round(Math.random() * 100000));
                ifssa.setAttribute("tabindex", "-1");
                ifssa.setAttribute("sandbox", "allow-same-origin allow-scripts");
                ifssa.style.width = 0 + "px";
                ifssa.style.height = 0 + "px";
                ifssa.style.display = "none";
                if (document.body) document.body.appendChild(ifssa);
                else document.addEventListener("DOMContentLoaded", function(event) {
                    document.body.appendChild(ifssa);
                });
                if (window.addEventListener) {
                    window.addEventListener("message", ssaPm, false);
                } else {
                    window.attachEvent("onmessage", ssaPm);
                }
            } catch (e_r) {}
        }
    }

    function ssckconsentiab(infgen) {
        var iabdebug = 0;

        function waitForTCFapi(success, failure) {
            var checks_done = 0;

            function checkTCFapiexist() {
                checks_done++;
                if (typeof window.__tcfapi === "function") {
                    success();
                } else {
                    if (checks_done < 5) {
                        setTimeout(checkTCFapiexist, 1000);
                    } else {
                        failure();
                    }
                }
            }
            checkTCFapiexist();
        }

        function addTCFListener() {
            __tcfapi('addEventListener', 2, function(TCData, success) {
                if (TCData.cmpStatus == 'loaded' && (TCData.eventStatus == 'tcloaded' || TCData.eventStatus == 'useractioncomplete')) {
                    __tcfapi('getTCData', 2, function(data, success) {
                        if (typeof data !== 'undefined' && typeof data.vendor !== 'undefined' && typeof data.vendor.consents !== 'undefined' && "491" in data.vendor.consents && data.vendor.consents[491]) {
                            // Do something here
                            if (iabdebug) console.log("Yeah, consent given!");
                            ssaif();
                        } else {
                            if (iabdebug) console.log("Nope, consent NOT given!");
                        }
                    }, [491]);
                }
            });
        }

        function checkTCFapiConsent() {
            var n_checks = 0;
            var max_checks = 10;
            waitForTCFapi(function() {
                // se trova la tfcapi...
                if (iabdebug) console.log('+++ tcfapi trovata!');
                // ma aggiungo il listener solo se la tcf e' pronta:
                // in caso aspetto 1 secondo al max.
                function checkTcfLoaded(stop) {
                    n_checks++;
                    if (iabdebug) console.log('check nr...', n_checks)
                    __tcfapi('ping', 2, function(pingReturn) {
                        if (pingReturn.cmpLoaded == true) {
                            addTCFListener();
                        } else {
                            if (stop == 1) {
                                if (iabdebug) console.log('+++ tcf presente ma non caricata');
                            } else {
                                if (n_checks < max_checks) {
                                    setTimeout(checkTcfLoaded, 500);
                                } else {
                                    setTimeout(checkTcfLoaded, 500, 1);
                                }
                            }
                        }
                    });
                }
                checkTcfLoaded();
            }, function() {
                // se non trova la tcfapi...
                if (iabdebug) console.log('+++ tcfapi non trovata');
                if (infgen != "0") {
                    if (iabdebug) console.log('+++ infogen !=0 lancio ssaif');
                    ssaif();
                }
            });
        }
        checkTCFapiConsent();
    }

    var infb = "0";
    var infgen = "0";

    function check_custom_consent(nck, value, log) {
        var numcheck = 50;

        function checkconsentssa() {
            setTimeout(function() {
                numcheck--;
                var cbc;
                cbc = rCk(nck);
                if (cbc) {
                    if (value) {
                        if (cbc.indexOf(value) > -1) {
                            ssaif();
                            if (log) console.log(log);
                            return;
                        } else {
                            return;
                        }
                    } else {
                        ssaif();
                        if (log) console.log(log);
                        return;
                    }
                } else {
                    if (numcheck > 0) {
                        checkconsentssa();
                    } else {}
                }
            }, 1000);
        }
        checkconsentssa();
    }




    if (infb != "0") {
        ssaif();
    } else {
        var nzgdpr = ["AT", "BE", "BG", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB"];
        var okgdpr = 1;
        for (var i = 0; i < nzgdpr.length; i++) {
            if (nzgdpr[i] == "IT") {
                okgdpr = 0;
                break;
            }
        }
        if (okgdpr) {
            ssaif();
        } else ssckconsentiab(infgen);
    }

}
if (vu_.indexOf("-1") > -1) {
    if (1) {
        var _consentCallback = function(found) {
            var cmp = "";
            if (found.length) {
                for (var i = 0; i < found.length; i++) {
                    cmp += "$" + encodeURIComponent(found[i].name);
                }
                var dcmp_ = new Image(1, 1);
                dcmp_.src = "//s6.shinystat.com/cgi-bin/csa.cgi?USER=dcmp&PAG=53595029" + cmp + "&RM=" + Math.round(Math.random() * 2147483647);
                dcmp_.onload = function() {
                    return;
                }
            }
        };

        (function(cb) {
            var consentProviders = [];
            consentProviders.push({
                id: 1,
                name: 'iubenda',
                test: function() {
                    return !!window._iub;
                }
            });
            consentProviders.push({
                id: 2,
                name: 'cookiebot',
                test: function() {
                    return window.CookieConsent && window.Cookiebot;
                }
            });
            consentProviders.push({
                id: 3,
                name: 'generic CookieConsent-compliant (like cookiebot)',
                test: function() {
                    return window.CookieConsent && !window.Cookiebot;
                }
            });
            consentProviders.push({
                id: 4,
                name: 'cookieconsent.insites.com',
                test: function() {
                    return !!window.cookieconsent;
                }
            });
            consentProviders.push({
                id: 5,
                name: 'civicuk',
                test: function() {
                    return window.CookieControl && !window.CookieConsent;
                }
            });
            consentProviders.push({
                id: 6,
                name: 'optanon by cookielaw.org',
                test: function() {
                    return !!window.Optanon;
                }
            });
            consentProviders.push({
                id: 7,
                name: 'cookie-script.com',
                test: function() {
                    return window.document.querySelectorAll('div[id^="cookiescript"]').length > 0;
                }
            });
            consentProviders.push({
                id: 8,
                name: 'generic cmp IAB guidelines compliant',
                test: function() {
                    return !!window.__cmp;
                }
            });

            setTimeout(function() {
                var found = [];
                for (var i = 0; i < consentProviders.length; i++) {
                    if (consentProviders[i].test()) {
                        found.push({
                            id: consentProviders[i].id,
                            name: consentProviders[i].name
                        });
                    }
                }

                if (cb) {
                    cb(found);
                }
            }, 1000);
        })(_consentCallback);
    }

}

function ssuser_func() {
    return ("SS-55951055-66dfb");
}
if (1) {
    var ssdcode_ = document.createElement('script');
    ssdcode_.type = 'text/javascript';
    ssdcode_.id = "_ssdcode";
    ssdcode_.async = true;
    ssdcode_.src = "//codicebusiness.shinystat.com/dcode/dcode.min.js";
    document.getElementsByTagName('head')[0].appendChild(ssdcode_);
}