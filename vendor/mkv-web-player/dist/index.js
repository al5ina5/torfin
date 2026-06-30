import { jsxs as c, Fragment as Me, jsx as a } from "react/jsx-runtime";
import { Move as Ce, Minimize as tt, X as Mt, Loader2 as Oe, Play as nt, Expand as Ct, Pause as Ot, ChevronsLeft as It, ChevronsRight as Dt, VolumeX as At, Volume2 as Wt, Languages as $t, Captions as it, Settings as jt, PictureInPicture2 as _t, Airplay as Ht, Maximize as Ft, MonitorUp as Bt, Check as Ie, Gauge as Vt, FileDown as Xt } from "lucide-react";
import K from "hls.js";
import { useRef as C, useEffect as x, useCallback as L, useMemo as ue, useState as R } from "react";
function dt(t) {
  if (typeof t == "string")
    return { url: typeof window > "u" ? t : new URL(t, window.location.href).toString(), isObject: !1 };
  const i = URL.createObjectURL(t);
  return { url: i, objectUrl: i, isObject: !0 };
}
async function Yt(t, i) {
  const s = dt(t), d = (i == null ? void 0 : i.enabled) && typeof t == "string";
  if (!d || !(i != null && i.baseUrl))
    return /\.m3u8(\?|#|$)/i.test(s.url) ? {
      objectUrl: s.objectUrl,
      originalUrl: typeof t == "string" ? t : void 0,
      videoUrl: s.url,
      strategy: "server-hls"
    } : {
      objectUrl: s.objectUrl,
      originalUrl: typeof t == "string" ? t : void 0,
      videoUrl: s.url,
      strategy: "native"
    };
  try {
    if (i.delivery === "hls") {
      const S = new URL("/hls/session", i.baseUrl);
      S.searchParams.set("url", s.url);
      const N = await fetch(S);
      if (!N.ok) throw new Error(`HLS session request failed with ${N.status}`);
      const z = await N.json();
      return {
        originalUrl: s.url,
        videoUrl: new URL(z.playlistUrl, i.baseUrl).toString(),
        strategy: "server-hls",
        metadata: { ...z.metadata, strategy: "server-hls" }
      };
    }
    const u = new URL("/metadata", i.baseUrl);
    u.searchParams.set("url", s.url);
    const h = await fetch(u);
    if (!h.ok) throw new Error(`Metadata request failed with ${h.status}`);
    const o = await h.json(), f = new URL("/stream", i.baseUrl);
    return f.searchParams.set("url", s.url), f.searchParams.set("mode", "auto"), i.delivery && f.searchParams.set("delivery", i.delivery), {
      originalUrl: s.url,
      videoUrl: f.toString(),
      strategy: o.strategy ?? "server-remux",
      metadata: o
    };
  } catch (u) {
    if (d)
      throw u instanceof Error ? u : new Error("Server-assisted source resolution failed");
    return {
      objectUrl: s.objectUrl,
      originalUrl: typeof t == "string" ? t : void 0,
      videoUrl: s.url,
      strategy: "native",
      metadata: {
        strategy: "native"
      }
    };
  }
}
function Kt(t, i, s) {
  if (s.src) return s.src;
  if (!(t != null && t.enabled) || !t.baseUrl || typeof i != "string" || s.index == null) return;
  const d = dt(i), u = new URL("/subtitles", t.baseUrl);
  return u.searchParams.set("url", d.url), u.searchParams.set("track", String(s.index)), u.searchParams.set("format", "vtt"), u.toString();
}
const qt = /(?:(\d{2,}):)?(\d{2}):(\d{2})[,.](\d{3})/;
function rt(t) {
  const i = t.match(qt);
  if (!i) return 0;
  const s = Number(i[1] ?? 0), d = Number(i[2]), u = Number(i[3]), h = Number(i[4]);
  return s * 3600 + d * 60 + u + h / 1e3;
}
function Gt(t) {
  const i = t.replace(/\r/g, "").trim();
  return i.startsWith("WEBVTT") ? t : `WEBVTT

${i.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")}
`;
}
function Jt(t) {
  const i = Gt(t).replace(/\r/g, "").replace(/^WEBVTT.*?(\n\n|$)/s, "").trim();
  return i ? i.split(/\n{2,}/).flatMap((s) => {
    const d = s.split(`
`).filter(Boolean), u = d.findIndex((S) => S.includes("-->"));
    if (u < 0) return [];
    const [h, o] = d[u].split("-->").map((S) => S.trim().split(/\s+/)[0]), f = {
      start: rt(h),
      end: rt(o),
      text: d.slice(u + 1).join(`
`).replace(/<[^>]+>/g, "")
    };
    return f.end > f.start ? [f] : [];
  }) : [];
}
async function Qt(t) {
  const i = await fetch(t);
  if (!i.ok) throw new Error(`Subtitle request failed with ${i.status}`);
  return Jt(await i.text());
}
function Zt(t, i, s) {
  const d = i + s;
  return t.find((u) => d >= u.start && d <= u.end);
}
const ct = ["token", "apikey", "api_key", "key", "auth", "authorization", "password"];
function We(t) {
  try {
    const i = new URL(t);
    for (const s of Array.from(i.searchParams.keys()))
      ct.some((d) => s.toLowerCase().includes(d)) && i.searchParams.set(s, "[redacted]");
    return i.toString();
  } catch {
    return t.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "[redacted]");
  }
}
function Ee(t) {
  return typeof t == "string" ? We(t) : Array.isArray(t) ? t.map(Ee) : !t || typeof t != "object" ? t : Object.fromEntries(
    Object.entries(t).map(([i, s]) => ct.some((d) => i.toLowerCase().includes(d)) ? [i, "[redacted]"] : [i, Ee(s)])
  );
}
function en(t) {
  return typeof t == "string" ? { kind: "url", url: We(t) } : t instanceof File ? { kind: "file", fileName: t.name, fileSize: t.size, fileType: t.type } : { kind: "blob", fileSize: t.size, fileType: t.type };
}
function tn(t) {
  if (!t)
    return {
      currentTime: 0,
      duration: 0,
      paused: !0,
      readyState: 0,
      networkState: 0,
      buffered: []
    };
  const i = Array.from({ length: t.buffered.length }, (s, d) => ({
    start: t.buffered.start(d),
    end: t.buffered.end(d)
  }));
  return {
    currentSrc: We(t.currentSrc),
    currentTime: t.currentTime || 0,
    duration: Number.isFinite(t.duration) ? t.duration : 0,
    paused: t.paused,
    readyState: t.readyState,
    networkState: t.networkState,
    buffered: i,
    error: t.error ? { code: t.error.code, message: t.error.message } : void 0
  };
}
function nn({
  config: t,
  src: i,
  videoRef: s,
  metadata: d,
  selectedAudioId: u,
  selectedSubtitleId: h,
  onEvent: o
}) {
  const f = (t == null ? void 0 : t.enabled) ?? !1, S = (t == null ? void 0 : t.maxEvents) ?? 500, N = C(Date.now()), z = C(1), O = C([]), v = C(o);
  x(() => {
    v.current = o;
  }, [o]);
  const ee = L(
    ($, ne, A, m) => {
      var V;
      if (!f) return;
      const oe = {
        id: z.current++,
        at: (/* @__PURE__ */ new Date()).toISOString(),
        elapsedMs: Date.now() - N.current,
        level: $,
        category: ne,
        message: A,
        data: Ee(m)
      };
      O.current = [...O.current.slice(-(S - 1)), oe], (V = v.current) == null || V.call(v, oe);
    },
    [f, S]
  ), D = L(() => ({
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    userAgent: typeof navigator > "u" ? void 0 : navigator.userAgent,
    source: en(i),
    video: tn(s.current),
    metadata: Ee(d),
    selectedAudioId: u,
    selectedSubtitleId: h,
    events: [...O.current]
  }), [d, u, h, i, s]), te = L(() => {
    const $ = new Blob([JSON.stringify(D(), null, 2)], { type: "application/json" }), ne = URL.createObjectURL($), A = document.createElement("a");
    A.href = ne, A.download = `mkv-player-diagnostics-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.json`, document.body.append(A), A.click(), A.remove(), URL.revokeObjectURL(ne);
  }, [D]);
  return x(() => {
    if (!f || !(t != null && t.exposeGlobal) || typeof window > "u") return;
    const $ = t.globalName || "__MKV_PLAYER_DIAGNOSTICS__";
    return window[$] = { report: D }, () => {
      delete window[$];
    };
  }, [t == null ? void 0 : t.exposeGlobal, t == null ? void 0 : t.globalName, f, D]), ue(() => ({ add: ee, report: D, download: te }), [ee, D, te]);
}
const at = {
  currentTime: 0,
  duration: 0,
  bufferedEnd: 0,
  bufferedAhead: 0,
  paused: !0,
  waiting: !0,
  canPlay: !1,
  volume: 1,
  muted: !1,
  playbackRate: 1,
  readyState: 0,
  fullscreen: !1,
  pictureInPicture: !1
};
function rn(t, i, s) {
  const [d, u] = R(at);
  x(() => {
    u(at);
  }, [s]);
  const h = L(() => {
    const o = t.current;
    if (!o) return;
    const f = o.currentTime || 0;
    let S = o.buffered.length ? o.buffered.end(o.buffered.length - 1) : 0, N = 0;
    for (let z = 0; z < o.buffered.length; z += 1) {
      const O = o.buffered.start(z), v = o.buffered.end(z);
      if (f + 0.25 >= O && f <= v) {
        S = v, N = Math.max(0, v - f);
        break;
      }
    }
    u((z) => {
      const O = {
        ...z,
        currentTime: f,
        duration: Number.isFinite(o.duration) ? o.duration : 0,
        bufferedEnd: S,
        bufferedAhead: N,
        paused: o.paused,
        canPlay: z.canPlay || o.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
        volume: o.volume,
        muted: o.muted,
        playbackRate: o.playbackRate,
        readyState: o.readyState,
        fullscreen: document.fullscreenElement === o.parentElement,
        pictureInPicture: document.pictureInPictureElement === o
      };
      return i == null || i(O), O;
    });
  }, [i, t]);
  return x(() => {
    const o = t.current;
    if (!o) return;
    const f = () => u((v) => ({ ...v, waiting: !0, canPlay: !1 })), S = () => u((v) => ({ ...v, waiting: !0 })), N = () => {
      o.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || (u((v) => ({ ...v, waiting: !1, canPlay: !0 })), h());
    }, z = ["loadedmetadata", "durationchange", "timeupdate", "progress", "play", "pause", "volumechange", "ratechange", "seeking", "seeked"], O = ["loadeddata", "canplay", "canplaythrough", "playing", "seeked"];
    return z.forEach((v) => o.addEventListener(v, h)), o.addEventListener("loadstart", f), o.addEventListener("emptied", f), o.addEventListener("waiting", S), o.addEventListener("seeking", S), O.forEach((v) => o.addEventListener(v, N)), document.addEventListener("fullscreenchange", h), o.addEventListener("enterpictureinpicture", h), o.addEventListener("leavepictureinpicture", h), () => {
      z.forEach((v) => o.removeEventListener(v, h)), o.removeEventListener("loadstart", f), o.removeEventListener("emptied", f), o.removeEventListener("waiting", S), o.removeEventListener("seeking", S), O.forEach((v) => o.removeEventListener(v, N)), document.removeEventListener("fullscreenchange", h), o.removeEventListener("enterpictureinpicture", h), o.removeEventListener("leavepictureinpicture", h);
    };
  }, [h, t]), { state: d, sync: h };
}
const an = {
  size: 28,
  color: "#ffffff",
  backgroundOpacity: 0.45,
  position: 14,
  delay: 0
}, on = [0.5, 0.75, 1, 1.25, 1.5, 2], E = 18, Pe = 72, sn = { width: 420, height: 236 }, ln = { width: 280, height: 158 }, ot = 12, dn = /\.(avif|gif|jpe?g|png|svg|webp)(\?|#|$)/i;
function st(t) {
  if (!Number.isFinite(t) || t <= 0) return "0:00";
  const i = Math.floor(t / 3600), s = Math.floor(t % 3600 / 60), d = Math.floor(t % 60);
  return i > 0 ? `${i}:${String(s).padStart(2, "0")}:${String(d).padStart(2, "0")}` : `${s}:${String(d).padStart(2, "0")}`;
}
function lt(t) {
  return t.label || t.language || ("codec" in t && t.codec ? t.codec : void 0) || `Track ${"index" in t ? Number(t.index) + 1 : ""}`;
}
function cn(t) {
  const i = typeof t == "object" ? t : {};
  return {
    enabled: t !== !1 && (t === !0 || i.enabled === !0),
    defaultOpen: i.defaultOpen ?? !1,
    initialPlacement: i.initialPlacement ?? "bottom-right",
    initialSize: i.initialSize ?? sn,
    minSize: i.minSize ?? ln,
    maxWidthRatio: i.maxWidthRatio ?? 0.7,
    persistKey: i.persistKey ?? "",
    allowOffscreenPeek: i.allowOffscreenPeek ?? !0
  };
}
function ze(t, i) {
  if (typeof window > "u") return { x: E, y: E };
  const s = Math.max(E, window.innerWidth - i.width - E), d = Math.max(E, window.innerHeight - i.height - E);
  return {
    x: t.endsWith("right") ? s : E,
    y: t.startsWith("bottom") ? d : E
  };
}
function Z(t, i, s) {
  if (typeof window > "u") return t;
  const d = s ? Pe : i.width, u = s ? -(i.width - d) : E, h = s ? -(i.height - d) : E, o = s ? window.innerWidth - d : window.innerWidth - i.width - E, f = s ? window.innerHeight - d : window.innerHeight - i.height - E;
  return {
    x: Math.min(Math.max(t.x, u), Math.max(u, o)),
    y: Math.min(Math.max(t.y, h), Math.max(h, f))
  };
}
function ae(t, i, s) {
  if (typeof window > "u") return t;
  const d = Math.max(i.width, Math.floor(window.innerWidth * s)), u = Math.max(i.height, window.innerHeight - E * 2), h = Math.min(Math.max(t.width, i.width), d), o = Math.min(Math.max(t.height, i.height), u);
  return { width: h, height: o };
}
function De(t, i) {
  if (typeof window > "u") return "bottom-right";
  const s = t.y + i.height / 2 > window.innerHeight / 2 ? "bottom" : "top", d = t.x + i.width / 2 > window.innerWidth / 2 ? "right" : "left";
  return `${s}-${d}`;
}
function un(t, i) {
  return typeof window > "u" ? !1 : t.x < 0 || t.y < 0 || t.x + i.width > window.innerWidth || t.y + i.height > window.innerHeight;
}
function M({
  label: t,
  children: i,
  onClick: s,
  active: d,
  disabled: u
}) {
  return /* @__PURE__ */ a("button", { className: "mkv-icon-button", type: "button", "aria-label": t, title: t, onClick: s, "data-active": d, disabled: u, children: i });
}
function Ae({ children: t }) {
  return /* @__PURE__ */ a("div", { className: "mkv-panel", children: t });
}
function bn({
  src: t,
  title: i,
  poster: s,
  loadingPreview: d,
  autoPlay: u,
  muted: h,
  server: o,
  subtitles: f = [],
  className: S,
  storageKey: N,
  popout: z,
  diagnostics: O,
  onDiagnosticsEvent: v,
  onPopoutChange: ee,
  startAt: D = null,
  onReady: te,
  onError: $,
  onProgress: ne,
  onEnded: A
}) {
  const m = C(null), oe = C(null), V = C(), $e = C(), Te = C(), [j, me] = R(""), { state: y } = rn(m, ne, j), [xe, ut] = R(), [P, je] = R({
    title: i,
    audioTracks: [],
    subtitleTracks: f,
    chapters: [],
    strategy: "native"
  }), [_e, He] = R(), [q, se] = R("off"), [mt, le] = R([]), [H, pe] = R(an), [pt, Fe] = R(!0), [I, X] = R(null), [F, Be] = R(), [Ve, Le] = R(), [fe, Ne] = R(!1), [Xe, Ye] = R(!1), he = C(te), be = C($), ye = C(A), we = C(ee), l = ue(() => cn(z), [z]), [g, W] = R(() => {
    const e = typeof window > "u" ? l.initialSize : ae(l.initialSize, l.minSize, l.maxWidthRatio), n = {
      open: l.defaultOpen,
      position: ze(l.initialPlacement, e),
      size: e,
      dockedPlacement: l.initialPlacement,
      minimized: !1
    };
    if (!l.persistKey || typeof window > "u") return n;
    try {
      const r = JSON.parse(localStorage.getItem(`${l.persistKey}:popout`) ?? "null");
      if (!r) return n;
      const p = ae(r.size ?? e, l.minSize, l.maxWidthRatio);
      return {
        open: r.open ?? n.open,
        position: Z(r.position ?? n.position, p, l.allowOffscreenPeek),
        size: p,
        dockedPlacement: r.dockedPlacement ?? n.dockedPlacement,
        minimized: r.minimized ?? !1
      };
    } catch {
      return n;
    }
  });
  x(() => {
    he.current = te, be.current = $, ye.current = A, we.current = ee;
  }, [A, $, ee, te]);
  const ie = ue(
    () => P.subtitleTracks.find((e) => e.id === q),
    [P.subtitleTracks, q]
  ), ft = ue(() => JSON.stringify(f), [f]), Ke = ue(() => JSON.stringify(o), [o]), qe = Zt(mt, y.currentTime, H.delay), U = P.duration || y.duration, ht = U ? y.currentTime / U * 100 : 0, bt = U ? y.bufferedEnd / U * 100 : 0, { add: T, download: yt } = nn({
    config: O,
    src: t,
    videoRef: m,
    metadata: P,
    selectedAudioId: _e,
    selectedSubtitleId: q,
    onEvent: v
  }), k = l.enabled && g.open, Ge = k && un(g.position, g.size), Je = P.strategy !== "server-hls" || y.bufferedAhead >= Math.min(ot, Math.max(3, (U || ot) - y.currentTime)), B = !fe && !F && Xe, wt = !Xe && !F && !!d, gt = !!(d && (d.type === "image" || dn.test(d.src))), vt = B && y.waiting && !y.paused, Qe = B && (pt || y.paused), kt = k ? {
    left: `${g.position.x}px`,
    top: `${g.position.y}px`,
    width: `${g.size.width}px`,
    height: `${g.minimized ? 52 : g.size.height}px`
  } : void 0;
  x(() => {
    var e;
    (e = we.current) == null || e.call(we, g), !(!l.persistKey || typeof window > "u") && localStorage.setItem(`${l.persistKey}:popout`, JSON.stringify(g));
  }, [l.persistKey, g]), x(() => {
    !l.enabled && g.open && W((e) => ({ ...e, open: !1, minimized: !1 }));
  }, [l.enabled, g.open]), x(() => {
    !fe && !F && y.canPlay && Je && Ye(!0);
  }, [F, Je, fe, y.canPlay]), x(() => {
    const e = () => {
      W((n) => {
        const r = ae(n.size, l.minSize, l.maxWidthRatio);
        return {
          ...n,
          size: r,
          position: Z(n.position, r, l.allowOffscreenPeek)
        };
      });
    };
    return window.addEventListener("resize", e), () => window.removeEventListener("resize", e);
  }, [l.allowOffscreenPeek, l.maxWidthRatio, l.minSize]);
  const G = L(
    (e) => {
      var n;
      Be(e), T("error", "player", e.code, { message: e.message, cause: String(e.cause ?? "") }), (n = be.current) == null || n.call(be, e);
    },
    [T]
  ), Ze = L(
    (e, n) => {
      Le(e), le([]), se("off"), T("warn", "subtitles", e, { cause: String(n ?? "") }), window.setTimeout(() => Le(void 0), 5200);
    },
    [T]
  ), Re = C();
  x(() => {
    let e = !1;
    return Be(void 0), Le(void 0), Ne(!0), Ye(!1), me(""), le([]), se("off"), je({
      title: i,
      audioTracks: [],
      subtitleTracks: f,
      chapters: [],
      strategy: "native"
    }), T("info", "source", "Resolving playback source", { serverEnabled: o == null ? void 0 : o.enabled, delivery: o == null ? void 0 : o.delivery }), Yt(t, o).then((n) => {
      var p, w, b, _, Y, ce, ke, Q, Se;
      if (e) return;
      Re.current && URL.revokeObjectURL(Re.current), Re.current = n.objectUrl, me(n.videoUrl), ut(n.objectUrl);
      const r = {
        title: i,
        duration: (p = n.metadata) == null ? void 0 : p.duration,
        videoCodec: (w = n.metadata) == null ? void 0 : w.videoCodec,
        audioTracks: ((b = n.metadata) == null ? void 0 : b.audioTracks) ?? [],
        subtitleTracks: [...((_ = n.metadata) == null ? void 0 : _.subtitleTracks) ?? [], ...f],
        chapters: ((Y = n.metadata) == null ? void 0 : Y.chapters) ?? [],
        strategy: n.strategy
      };
      je(r), He(((ce = r.audioTracks.find((re) => re.default)) == null ? void 0 : ce.id) ?? ((ke = r.audioTracks[0]) == null ? void 0 : ke.id)), se(((Q = r.subtitleTracks.find((re) => re.default && re.src)) == null ? void 0 : Q.id) ?? "off"), T("info", "source", "Playback source ready", {
        strategy: n.strategy,
        videoUrl: n.videoUrl,
        audioTracks: r.audioTracks.length,
        subtitleTracks: r.subtitleTracks.length,
        duration: r.duration
      }), Ne(!1), (Se = he.current) == null || Se.call(he, r);
    }).catch((n) => {
      Ne(!1), G({ code: "SOURCE_RESOLUTION_FAILED", message: "Could not prepare this media source.", cause: n });
    }), () => {
      e = !0;
    };
  }, [T, G, Ke, t, ft, i]), x(() => () => {
    xe && URL.revokeObjectURL(xe);
  }, [xe]), x(() => {
    var n;
    const e = m.current;
    if (!(!e || !j || P.strategy !== "server-hls")) {
      if ((n = V.current) == null || n.destroy(), V.current = void 0, K.isSupported()) {
        const r = new K({
          backBufferLength: 90,
          maxBufferLength: 90,
          maxMaxBufferLength: 180,
          fragLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: 6e4,
              maxLoadTimeMs: 18e4,
              timeoutRetry: {
                maxNumRetry: 1,
                retryDelayMs: 1e3,
                maxRetryDelayMs: 1e3
              },
              errorRetry: {
                maxNumRetry: 2,
                retryDelayMs: 1e3,
                maxRetryDelayMs: 4e3
              }
            }
          }
        });
        return V.current = r, r.on(K.Events.MEDIA_ATTACHED, () => r.loadSource(j)), r.on(K.Events.MANIFEST_PARSED, (p, w) => {
          T("info", "hls", "HLS manifest ready", { levels: w.levels.length, duration: P.duration });
        }), r.on(K.Events.ERROR, (p, w) => {
          T(w.fatal ? "error" : "warn", "hls", w.details, {
            fatal: w.fatal,
            type: w.type,
            fragment: w.frag ? { sn: w.frag.sn, start: w.frag.start, duration: w.frag.duration } : void 0
          }), w.fatal && (w.type === K.ErrorTypes.NETWORK_ERROR ? r.startLoad() : w.type === K.ErrorTypes.MEDIA_ERROR ? r.recoverMediaError() : G({ code: "HLS_FATAL_ERROR", message: "The segmented stream could not be played.", cause: w.details }));
        }), r.attachMedia(e), () => {
          r.destroy(), V.current === r && (V.current = void 0);
        };
      }
      if (e.canPlayType("application/vnd.apple.mpegurl")) {
        e.src = j;
        return;
      }
      G({ code: "HLS_NOT_SUPPORTED", message: "This browser cannot play HLS streams." });
    }
  }, [T, P.duration, P.strategy, G, j]), x(() => {
    if (!ie || q === "off") {
      le([]);
      return;
    }
    const e = Kt(o, t, ie);
    if (!e) {
      le([]), T("warn", "subtitles", "No subtitle URL available", { subtitle: ie });
      return;
    }
    let n = !1;
    return T("info", "subtitles", "Loading subtitle track", { id: ie.id, url: e }), Qt(e).then((r) => {
      n || (le(r), T("info", "subtitles", "Subtitle track loaded", { id: ie.id, cues: r.length }));
    }).catch((r) => {
      n || Ze("Could not load the selected subtitles.", r);
    }), () => {
      n = !0;
    };
  }, [T, Ze, ie, q, Ke, t]), x(() => {
    const e = m.current;
    if (!e) return;
    const n = ["loadstart", "loadedmetadata", "canplay", "playing", "waiting", "seeking", "seeked", "stalled", "suspend", "ended", "error"], r = (p) => {
      T(p.type === "error" ? "error" : p.type === "waiting" || p.type === "stalled" ? "warn" : "debug", "media", p.type, {
        currentTime: e.currentTime,
        duration: Number.isFinite(e.duration) ? e.duration : void 0,
        readyState: e.readyState,
        networkState: e.networkState,
        bufferedEnd: e.buffered.length ? e.buffered.end(e.buffered.length - 1) : 0,
        error: e.error ? { code: e.error.code, message: e.error.message } : void 0
      });
    };
    return n.forEach((p) => e.addEventListener(p, r)), () => n.forEach((p) => e.removeEventListener(p, r));
  }, [T, j]), x(() => {
    const e = m.current;
    if (!e || !N) return;
    const n = D && D > 0 ? D : Number(localStorage.getItem(`${N}:time`) ?? 0);
    n > 0 && (e.currentTime = n);
    const r = window.setInterval(() => {
      e.currentTime > 5 && !e.ended && localStorage.setItem(`${N}:time`, String(e.currentTime));
    }, 2e3);
    return () => window.clearInterval(r);
  }, [D, N, j]), x(() => {
    const e = m.current;
    if (!e) return;
    const n = () => {
      var r;
      return (r = ye.current) == null ? void 0 : r.call(ye);
    };
    return e.addEventListener("ended", n), () => e.removeEventListener("ended", n);
  }, [j]);
  const et = L(() => {
    Fe(!0), window.clearTimeout($e.current), $e.current = window.setTimeout(() => {
      var e;
      (e = m.current) != null && e.paused || Fe(!1);
    }, 2600);
  }, []), de = L(() => {
    const e = m.current;
    !e || !y.canPlay || (e.paused ? e.play() : e.pause());
  }, [y.canPlay]), J = L((e) => {
    const n = m.current;
    !n || !y.canPlay || (n.currentTime = Math.min(Math.max(0, n.currentTime + e), U || Number.MAX_SAFE_INTEGER));
  }, [U, y.canPlay]), St = (e) => {
    const n = m.current;
    !n || !U || !y.canPlay || (n.currentTime = Number(e) / 1e3 * U);
  }, Ue = () => {
    const e = oe.current;
    e && (document.fullscreenElement ? document.exitFullscreen() : e.requestFullscreen());
  }, zt = async () => {
    const e = m.current;
    !e || !document.pictureInPictureEnabled || (document.pictureInPictureElement ? await document.exitPictureInPicture() : await e.requestPictureInPicture());
  }, Pt = L(() => {
    l.enabled && (X(null), W((e) => {
      const n = ae(e.size, l.minSize, l.maxWidthRatio), r = e.dockedPlacement ?? l.initialPlacement;
      return {
        ...e,
        open: !0,
        minimized: !1,
        size: n,
        dockedPlacement: r,
        position: Z(e.position ?? ze(r, n), n, l.allowOffscreenPeek)
      };
    }));
  }, [l.allowOffscreenPeek, l.enabled, l.initialPlacement, l.maxWidthRatio, l.minSize]), ge = L(() => {
    X(null), W((e) => ({ ...e, open: !1, minimized: !1 }));
  }, []), Et = L(() => {
    X(null), W((e) => {
      const n = De(e.position, e.size), r = n.endsWith("right") ? window.innerWidth - Pe : -(e.size.width - Pe), p = Math.min(Math.max(e.position.y, E), window.innerHeight - Pe);
      return { ...e, position: { x: r, y: p }, dockedPlacement: n, minimized: !1 };
    });
  }, []), Tt = L(() => {
    W((e) => {
      const n = De(e.position, e.size);
      return {
        ...e,
        minimized: !1,
        dockedPlacement: n,
        position: ze(n, e.size)
      };
    });
  }, []), xt = L(() => {
    X(null), W((e) => ({ ...e, minimized: !e.minimized }));
  }, []), Lt = L(() => {
    !k || typeof window > "u" || window.innerWidth <= 760 || W((e) => {
      const n = ae(l.initialSize, l.minSize, l.maxWidthRatio), p = Math.abs(e.size.width - n.width) < 8 && Math.abs(e.size.height - n.height) < 8 && Te.current ? Te.current : n;
      return Te.current = e.size, {
        ...e,
        size: p,
        minimized: !1,
        position: Z(e.position, p, l.allowOffscreenPeek)
      };
    });
  }, [l.allowOffscreenPeek, l.initialSize, l.maxWidthRatio, l.minSize, k]), Nt = L(
    (e) => {
      if (!k || e.button !== 0 || typeof window > "u" || window.innerWidth <= 760 || e.target.closest("button,input,select,.mkv-controls,.mkv-menu-wrap")) return;
      e.preventDefault();
      const r = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        position: g.position,
        size: g.size
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = (b) => {
        const _ = Z(
          {
            x: r.position.x + b.clientX - r.pointerX,
            y: r.position.y + b.clientY - r.pointerY
          },
          r.size,
          l.allowOffscreenPeek
        );
        W((Y) => ({ ...Y, position: _, minimized: !1 }));
      }, w = () => {
        window.removeEventListener("pointermove", p), window.removeEventListener("pointerup", w), W((b) => {
          const _ = De(b.position, b.size), Y = b.position.x <= E * 2 || b.position.y <= E * 2 || window.innerWidth - (b.position.x + b.size.width) <= E * 2 || window.innerHeight - (b.position.y + b.size.height) <= E * 2;
          return {
            ...b,
            dockedPlacement: _,
            position: Y ? ze(_, b.size) : Z(b.position, b.size, l.allowOffscreenPeek)
          };
        });
      };
      window.addEventListener("pointermove", p), window.addEventListener("pointerup", w, { once: !0 });
    },
    [l.allowOffscreenPeek, k, g.position, g.size]
  ), ve = L(
    (e, n) => {
      if (!k || e.button !== 0 || typeof window > "u" || window.innerWidth <= 760) return;
      e.preventDefault(), e.stopPropagation();
      const r = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        position: g.position,
        size: g.size
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = (b) => {
        const _ = b.clientX - r.pointerX;
        b.clientY - r.pointerY;
        const Y = n.endsWith("e") ? _ : -_, ce = r.size.width + Y, ke = Math.round(ce * 9 / 16), Q = ae({ width: ce, height: ke }, l.minSize, l.maxWidthRatio), Se = {
          x: n.endsWith("w") ? r.position.x + (r.size.width - Q.width) : r.position.x,
          y: n.startsWith("n") ? r.position.y + (r.size.height - Q.height) : r.position.y
        };
        W((re) => ({
          ...re,
          size: Q,
          minimized: !1,
          position: Z(Se, Q, l.allowOffscreenPeek)
        }));
      }, w = () => {
        window.removeEventListener("pointermove", p), window.removeEventListener("pointerup", w);
      };
      window.addEventListener("pointermove", p), window.addEventListener("pointerup", w, { once: !0 });
    },
    [l.allowOffscreenPeek, l.maxWidthRatio, l.minSize, k, g.position, g.size]
  ), Rt = (e) => {
    He(e.id), T("info", "audio", "Selecting audio track", e);
    const n = m.current;
    if (n != null && n.audioTracks && Array.from(n.audioTracks).forEach((r, p) => {
      r.enabled = r.id === e.id || p === e.index;
    }), o != null && o.enabled && typeof t == "string" && n) {
      const r = new URL(o.delivery === "hls" ? "/hls/session" : "/stream", o.baseUrl);
      r.searchParams.set("url", new URL(t, window.location.href).toString()), o.delivery !== "hls" && (r.searchParams.set("mode", "auto"), o.delivery && r.searchParams.set("delivery", o.delivery)), r.searchParams.set("audioTrack", String(e.index));
      const p = n.currentTime, w = n.paused;
      o.delivery === "hls" ? fetch(r).then((b) => {
        if (!b.ok) throw new Error(`HLS audio session failed with ${b.status}`);
        return b.json();
      }).then((b) => {
        me(new URL(b.playlistUrl, o.baseUrl).toString()), window.setTimeout(() => {
          m.current && (m.current.currentTime = p, w || m.current.play());
        }, 900);
      }).catch((b) => G({ code: "AUDIO_SWITCH_FAILED", message: "Could not switch audio tracks.", cause: b })) : (r.searchParams.set("subtitleTrack", "off"), me(r.toString()), window.setTimeout(() => {
        m.current && (m.current.currentTime = p, w || m.current.play());
      }, 600));
    }
  };
  x(() => {
    const e = (n) => {
      const r = n.target;
      (r == null ? void 0 : r.tagName) === "INPUT" || (r == null ? void 0 : r.tagName) === "TEXTAREA" || r != null && r.isContentEditable || (n.key === "Escape" && (I ? X(null) : k && ge()), n.key === " " && (n.preventDefault(), de()), n.key === "ArrowLeft" && J(-10), n.key === "ArrowRight" && J(10), n.key.toLowerCase() === "f" && Ue(), n.key.toLowerCase() === "m" && m.current && (m.current.muted = !m.current.muted));
    };
    return window.addEventListener("keydown", e), () => window.removeEventListener("keydown", e);
  }, [ge, I, k, J, de]);
  const Ut = {
    native: "Native",
    "server-remux": "Server remux",
    "server-transcode": "Server transcode",
    "server-hls": "Seekable HLS",
    unsupported: "Unsupported"
  };
  return /* @__PURE__ */ c(Me, { children: [
    k ? /* @__PURE__ */ a("div", { className: "mkv-popout-placeholder", "aria-hidden": "true" }) : null,
    /* @__PURE__ */ c(
      "div",
      {
        ref: oe,
        className: `mkv-player ${k ? "mkv-popout-open" : ""} ${g.minimized ? "mkv-popout-minimized" : ""} ${Ge ? "mkv-popout-tucked" : ""} ${S ?? ""}`,
        style: kt,
        "data-popout": k,
        "data-minimized": k && g.minimized,
        "data-loading": !B && !F,
        onMouseMove: et,
        onTouchStart: et,
        onPointerDown: Nt,
        onDoubleClick: (e) => {
          k && e.target.closest(".mkv-topbar") && Lt();
        },
        children: [
          k ? /* @__PURE__ */ c("div", { className: "mkv-popout-header", children: [
            /* @__PURE__ */ c("span", { className: "mkv-popout-grip", children: [
              /* @__PURE__ */ a(Ce, { size: 14 }),
              " Floating"
            ] }),
            /* @__PURE__ */ c("div", { className: "mkv-popout-actions", children: [
              /* @__PURE__ */ a(M, { label: g.minimized ? "Restore floating player" : "Minimize floating player", onClick: xt, children: /* @__PURE__ */ a(tt, {}) }),
              /* @__PURE__ */ a(M, { label: "Tuck floating player", onClick: Et, children: /* @__PURE__ */ a(Ce, {}) }),
              /* @__PURE__ */ a(M, { label: "Close floating player", onClick: ge, children: /* @__PURE__ */ a(Mt, {}) })
            ] })
          ] }) : null,
          Ge ? /* @__PURE__ */ a("button", { className: "mkv-popout-peek", type: "button", "aria-label": "Restore tucked player", onClick: Tt }) : null,
          /* @__PURE__ */ a(
            "video",
            {
              ref: m,
              className: `mkv-video ${B ? "" : "mkv-video-pending"}`,
              src: P.strategy === "server-hls" && K.isSupported() ? void 0 : j || void 0,
              poster: s,
              autoPlay: u,
              muted: h,
              playsInline: !0,
              controls: !1,
              onClick: B ? de : void 0,
              onDoubleClick: B ? Ue : void 0,
              onError: () => {
                j && G({ code: "MEDIA_ERROR", message: "This file could not be played by the current browser or stream helper." });
              }
            }
          ),
          wt && d ? gt ? /* @__PURE__ */ c("div", { className: "mkv-loading-preview-wrap", "aria-hidden": "true", children: [
            /* @__PURE__ */ a("img", { className: "mkv-loading-preview", src: d.src, alt: "" }),
            /* @__PURE__ */ a(Oe, { className: "mkv-preview-loader mkv-spin", size: 36 })
          ] }) : /* @__PURE__ */ a(
            "video",
            {
              className: "mkv-loading-preview",
              src: d.src,
              poster: d.poster,
              autoPlay: !0,
              muted: !0,
              loop: !0,
              playsInline: !0,
              "aria-hidden": "true"
            }
          ) : null,
          B ? /* @__PURE__ */ c(Me, { children: [
            /* @__PURE__ */ a("div", { className: "mkv-hit mkv-hit-left", onDoubleClick: () => J(-10) }),
            /* @__PURE__ */ a("div", { className: "mkv-hit mkv-hit-right", onDoubleClick: () => J(10) })
          ] }) : null,
          !B && !F && !d ? /* @__PURE__ */ c("div", { className: "mkv-center mkv-loading", children: [
            /* @__PURE__ */ a(Oe, { className: "mkv-spin", size: 44 }),
            /* @__PURE__ */ a("strong", { children: fe ? "Preparing video" : "Loading video" }),
            /* @__PURE__ */ a("span", { children: "Controls will appear when playback is ready." })
          ] }) : null,
          vt ? /* @__PURE__ */ a("div", { className: "mkv-center mkv-buffering", "aria-label": "Buffering", children: /* @__PURE__ */ a(Oe, { className: "mkv-spin", size: 34 }) }) : null,
          B && y.paused ? /* @__PURE__ */ a("button", { className: "mkv-big-play", type: "button", "aria-label": "Play", onClick: de, children: /* @__PURE__ */ a(nt, { fill: "currentColor", size: 42 }) }) : null,
          qe ? /* @__PURE__ */ a(
            "div",
            {
              className: "mkv-subtitles",
              style: {
                bottom: `${H.position}%`,
                fontSize: `${H.size}px`,
                color: H.color
              },
              children: /* @__PURE__ */ a("span", { style: { backgroundColor: `rgba(0, 0, 0, ${H.backgroundOpacity})` }, children: qe.text })
            }
          ) : null,
          F ? /* @__PURE__ */ c("div", { className: "mkv-error", children: [
            /* @__PURE__ */ a(Ct, { size: 38 }),
            /* @__PURE__ */ a("strong", { children: F.message }),
            /* @__PURE__ */ a("span", { children: o != null && o.enabled ? "Try another audio/subtitle track or a transcoded stream." : "Enable the FFmpeg helper for broader MKV support." })
          ] }) : null,
          Ve && !F ? /* @__PURE__ */ a("div", { className: "mkv-toast", role: "status", children: Ve }) : null,
          /* @__PURE__ */ a("div", { className: "mkv-topbar", "data-visible": Qe, children: /* @__PURE__ */ c("div", { children: [
            /* @__PURE__ */ a("strong", { children: i ?? P.title ?? "Untitled video" }),
            /* @__PURE__ */ c("span", { children: [
              P.videoCodec ? `${P.videoCodec} · ` : "",
              Ut[P.strategy]
            ] })
          ] }) }),
          /* @__PURE__ */ c("div", { className: "mkv-controls", "data-visible": Qe, children: [
            /* @__PURE__ */ c("div", { className: "mkv-timeline", children: [
              /* @__PURE__ */ a("div", { className: "mkv-buffer", style: { width: `${Math.min(100, bt)}%` } }),
              /* @__PURE__ */ a("div", { className: "mkv-progress", style: { width: `${Math.min(100, ht)}%` } }),
              P.chapters.map((e) => /* @__PURE__ */ a(
                "span",
                {
                  className: "mkv-chapter",
                  title: e.title,
                  style: { left: `${U ? e.start / U * 100 : 0}%` }
                },
                e.id
              )),
              /* @__PURE__ */ a("input", { "aria-label": "Seek", min: 0, max: 1e3, value: U ? Math.round(y.currentTime / U * 1e3) : 0, type: "range", onChange: (e) => St(e.target.value) })
            ] }),
            /* @__PURE__ */ c("div", { className: "mkv-control-row", children: [
              /* @__PURE__ */ c("div", { className: "mkv-cluster", children: [
                /* @__PURE__ */ a(M, { label: y.paused ? "Play" : "Pause", onClick: de, children: y.paused ? /* @__PURE__ */ a(nt, { fill: "currentColor" }) : /* @__PURE__ */ a(Ot, { fill: "currentColor" }) }),
                /* @__PURE__ */ a(M, { label: "Rewind 10 seconds", onClick: () => J(-10), children: /* @__PURE__ */ a(It, {}) }),
                /* @__PURE__ */ a(M, { label: "Forward 10 seconds", onClick: () => J(10), children: /* @__PURE__ */ a(Dt, {}) }),
                /* @__PURE__ */ c("span", { className: "mkv-time", children: [
                  st(y.currentTime),
                  " / ",
                  st(U || 0)
                ] })
              ] }),
              /* @__PURE__ */ c("div", { className: "mkv-cluster mkv-main-actions", children: [
                /* @__PURE__ */ a(M, { label: y.muted ? "Unmute" : "Mute", onClick: () => {
                  m.current && (m.current.muted = !m.current.muted);
                }, children: y.muted || y.volume === 0 ? /* @__PURE__ */ a(At, {}) : /* @__PURE__ */ a(Wt, {}) }),
                /* @__PURE__ */ a("input", { className: "mkv-volume", "aria-label": "Volume", type: "range", min: 0, max: 1, step: 0.01, value: y.muted ? 0 : y.volume, onChange: (e) => {
                  m.current && (m.current.volume = Number(e.target.value), m.current.muted = Number(e.target.value) === 0);
                } }),
                /* @__PURE__ */ a(M, { label: "Audio tracks", active: I === "audio", onClick: () => X(I === "audio" ? null : "audio"), children: /* @__PURE__ */ a($t, {}) }),
                /* @__PURE__ */ a(M, { label: "Subtitles", active: I === "subtitles", onClick: () => X(I === "subtitles" ? null : "subtitles"), children: /* @__PURE__ */ a(it, {}) }),
                /* @__PURE__ */ a(M, { label: "Settings", active: I === "settings", onClick: () => X(I === "settings" ? null : "settings"), children: /* @__PURE__ */ a(jt, {}) }),
                l.enabled ? /* @__PURE__ */ a(M, { label: k ? "Restore inline player" : "Pop out player", active: k, onClick: k ? ge : Pt, children: /* @__PURE__ */ a(Ce, {}) }) : null,
                /* @__PURE__ */ a(M, { label: "Picture in picture", onClick: zt, disabled: typeof document > "u" || !document.pictureInPictureEnabled, children: /* @__PURE__ */ a(_t, {}) }),
                /* @__PURE__ */ a(M, { label: "AirPlay", disabled: typeof window > "u" || !("WebKitPlaybackTargetAvailabilityEvent" in window), children: /* @__PURE__ */ a(Ht, {}) }),
                /* @__PURE__ */ a(M, { label: "Fullscreen", onClick: Ue, children: document.fullscreenElement ? /* @__PURE__ */ a(tt, {}) : /* @__PURE__ */ a(Ft, {}) })
              ] })
            ] }),
            I ? /* @__PURE__ */ c("div", { className: "mkv-menu-wrap", children: [
              I === "audio" ? /* @__PURE__ */ c(Ae, { children: [
                /* @__PURE__ */ c("h3", { children: [
                  /* @__PURE__ */ a(Bt, { size: 16 }),
                  " Audio"
                ] }),
                P.audioTracks.length ? P.audioTracks.map((e) => /* @__PURE__ */ c("button", { className: "mkv-menu-item", type: "button", onClick: () => Rt(e), children: [
                  /* @__PURE__ */ c("span", { children: [
                    lt(e),
                    /* @__PURE__ */ a("small", { children: [e.codec, e.channels, e.default ? "Default" : ""].filter(Boolean).join(" · ") })
                  ] }),
                  _e === e.id ? /* @__PURE__ */ a(Ie, { size: 18 }) : null
                ] }, e.id)) : /* @__PURE__ */ a("p", { className: "mkv-empty", children: "No alternate audio tracks reported." })
              ] }) : null,
              I === "subtitles" ? /* @__PURE__ */ c(Ae, { children: [
                /* @__PURE__ */ c("h3", { children: [
                  /* @__PURE__ */ a(it, { size: 16 }),
                  " Subtitles"
                ] }),
                /* @__PURE__ */ c("button", { className: "mkv-menu-item", type: "button", onClick: () => se("off"), children: [
                  /* @__PURE__ */ a("span", { children: "Off" }),
                  q === "off" ? /* @__PURE__ */ a(Ie, { size: 18 }) : null
                ] }),
                P.subtitleTracks.map((e) => /* @__PURE__ */ c("button", { className: "mkv-menu-item", type: "button", onClick: () => se(e.id), children: [
                  /* @__PURE__ */ c("span", { children: [
                    lt(e),
                    /* @__PURE__ */ a("small", { children: [e.codec, e.kind, e.default ? "Default" : ""].filter(Boolean).join(" · ") })
                  ] }),
                  q === e.id ? /* @__PURE__ */ a(Ie, { size: 18 }) : null
                ] }, e.id))
              ] }) : null,
              I === "settings" ? /* @__PURE__ */ c(Ae, { children: [
                /* @__PURE__ */ c("h3", { children: [
                  /* @__PURE__ */ a(Vt, { size: 16 }),
                  " Playback"
                ] }),
                /* @__PURE__ */ c("label", { children: [
                  "Speed",
                  /* @__PURE__ */ a("select", { value: y.playbackRate, onChange: (e) => {
                    m.current && (m.current.playbackRate = Number(e.target.value));
                  }, children: on.map((e) => /* @__PURE__ */ c("option", { value: e, children: [
                    e,
                    "x"
                  ] }, e)) })
                ] }),
                /* @__PURE__ */ c("label", { children: [
                  "Subtitle size",
                  /* @__PURE__ */ a("input", { type: "range", min: 18, max: 44, value: H.size, onChange: (e) => pe((n) => ({ ...n, size: Number(e.target.value) })) })
                ] }),
                /* @__PURE__ */ c("label", { children: [
                  "Subtitle background",
                  /* @__PURE__ */ a("input", { type: "range", min: 0, max: 0.85, step: 0.05, value: H.backgroundOpacity, onChange: (e) => pe((n) => ({ ...n, backgroundOpacity: Number(e.target.value) })) })
                ] }),
                /* @__PURE__ */ c("label", { children: [
                  "Subtitle position",
                  /* @__PURE__ */ a("input", { type: "range", min: 8, max: 36, value: H.position, onChange: (e) => pe((n) => ({ ...n, position: Number(e.target.value) })) })
                ] }),
                /* @__PURE__ */ c("label", { children: [
                  "Subtitle sync",
                  /* @__PURE__ */ a("input", { type: "number", min: -10, max: 10, step: 0.25, value: H.delay, onChange: (e) => pe((n) => ({ ...n, delay: Number(e.target.value) })) })
                ] }),
                /* @__PURE__ */ c("button", { className: "mkv-menu-item", type: "button", onClick: yt, children: [
                  /* @__PURE__ */ c("span", { children: [
                    "Export diagnostics",
                    /* @__PURE__ */ a("small", { children: "Playback events, metadata, buffer, and error state" })
                  ] }),
                  /* @__PURE__ */ a(Xt, { size: 18 })
                ] })
              ] }) : null
            ] }) : null
          ] }),
          k && !g.minimized ? /* @__PURE__ */ c(Me, { children: [
            /* @__PURE__ */ a("button", { className: "mkv-popout-resize mkv-popout-resize-se", type: "button", "aria-label": "Resize from bottom right", onPointerDown: (e) => ve(e, "se") }),
            /* @__PURE__ */ a("button", { className: "mkv-popout-resize mkv-popout-resize-sw", type: "button", "aria-label": "Resize from bottom left", onPointerDown: (e) => ve(e, "sw") }),
            /* @__PURE__ */ a("button", { className: "mkv-popout-resize mkv-popout-resize-ne", type: "button", "aria-label": "Resize from top right", onPointerDown: (e) => ve(e, "ne") }),
            /* @__PURE__ */ a("button", { className: "mkv-popout-resize mkv-popout-resize-nw", type: "button", "aria-label": "Resize from top left", onPointerDown: (e) => ve(e, "nw") })
          ] }) : null
        ]
      }
    )
  ] });
}
export {
  bn as MkvPlayer
};
//# sourceMappingURL=index.js.map
