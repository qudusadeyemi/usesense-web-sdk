import{r as m,j as l}from"./index-CNG0AH9M.js";var uo="step_up_v1",si=[uo],ho=20;function fo(e){var a;const t=e==null?void 0:e.step_up;if(!t||t.round!==2||!t.challenge||typeof t.challenge!="object")return null;const n=t.challenge;if(typeof n.seed!="string"||!n.seed||!(n.type==="head_turn"&&Array.isArray(n.sequence)&&n.sequence.length>0||n.type==="follow_dot"&&Array.isArray(n.waypoints)&&n.waypoints.length>0))return null;const r=typeof((a=t.upload)==null?void 0:a.max_frames)=="number"&&t.upload.max_frames>0?Math.floor(t.upload.max_frames):ho;return{round:2,challenge:n,maxFrames:r}}function po(e,t,n,s,r,a={}){const i={type:e.type,seed:e.seed||"",completed:!0,started_at:n,completed_at:s,frame_timestamps:r};return e.type==="head_turn"?{...i,...a,step_frames:t}:{...i,...a,waypoint_frames:t}}function mo(e){return{session_id:e.sessionId,sdk_version:e.sdkVersion,platform:"web",source:"sdk",step_up_round:2,client_capabilities:si,challenge_response:po(e.challenge,e.frameMap,e.startedAt,e.completedAt,e.frames.map(t=>t.timestamp),e.responseExtras),frame_hashes:e.frames.map(t=>t.hash),frames_manifest:e.frames.map(t=>({frame_index:t.index,capture_timestamp_ms:t.timestamp,resolution_w:t.resolution.w,resolution_h:t.resolution.h})),face_mesh_signals:e.meshSignals.length>0?{model:"mediapipe_face_landmarker_v2",frame_count:e.meshSignals.length,frames:e.meshSignals.map(t=>({frame_index:t.frameIndex,timestamp_ms:t.timestamp,headPose:t.headPose,leftEAR:t.leftEAR,rightEAR:t.rightEAR,bbox:t.bbox}))}:null,timestamps:{capture_started_at_ms:e.captureStartedAtMs,capture_ended_at_ms:e.captureEndedAtMs},channel_integrity:e.channelIntegrity,suspicion:e.suspicion,verification_package:e.verificationPackage,deep_classifier_on_device:null}}var go={dark:{background:"#12141B",surface:"#1D2029",foreground:"#F4F5F8",muted:"#A3A9B8",border:"rgba(255,255,255,0.08)"},light:{background:"#FDFCFA",surface:"#F5F3EF",foreground:"#1C1A17",muted:"#6B6760",border:"#E8E5DE"}},st={primary:"#4F7CFF",success:"#00D4AA",error:"#FF6B4A",warning:"#FFB84D",challenge:"#A878FC"},yo=["#FFFFFF","#1C1A17"],xo=3,bo="#333333",wo=.05,vo=8,he={cameraBackground:"#0D0F14",scanDim:"rgba(13,15,20,0.25)",cameraButton:"rgba(13,15,20,0.55)",cameraButtonInk:"#F4F5F8",ovalFill:"rgba(255,255,255,0.14)",ovalStroke:"rgba(255,255,255,0.90)",ringTrack:"rgba(255,255,255,0.18)",guidance:"#FFFFFF",guidanceSub:"rgba(255,255,255,0.82)",guidanceShadow:"0 1px 2px rgba(0, 0, 0, 0.35), 0 2px 14px rgba(0, 0, 0, 0.45)",shutter:"#FFFFFF",shutterRing:"rgba(255,255,255,0.95)",shutterOnFill:"#2A251E",fillLight:"rgba(255,244,226,0.38)",digitsPill:"rgba(13,15,20,0.72)",arrow:"#FFFFFF",poweredOnCamera:"rgba(255,255,255,0.55)",scrim:"rgba(0,0,0,0.5)"};function os(e){if(typeof e!="string")return null;const t=e.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);if(!t)return null;let n=t[1];return n.length===3&&(n=n.split("").map(s=>s+s).join("")),[parseInt(n.slice(0,2),16),parseInt(n.slice(2,4),16),parseInt(n.slice(4,6),16)]}function ma([e,t,n]){const s=r=>{const a=r/255;return a<=.03928?a/12.92:Math.pow((a+.055)/1.055,2.4)};return .2126*s(e)+.7152*s(t)+.0722*s(n)}function nr(e,t){const n=os(e),s=os(t);if(!n||!s)return 0;const r=ma(n),a=ma(s);return(Math.max(r,a)+.05)/(Math.min(r,a)+.05)}function It(e){return nr(e,bo)>=xo}function ko([e,t,n]){const s=r=>Math.round(Math.max(0,Math.min(255,r))).toString(16).padStart(2,"0");return`#${s(e)}${s(t)}${s(n)}`.toUpperCase()}function _o([e,t,n]){const s=e/255,r=t/255,a=n/255,i=Math.max(s,r,a),o=Math.min(s,r,a),c=(i+o)/2;if(i===o)return[0,0,c];const d=i-o,f=c>.5?d/(2-i-o):d/(i+o);let h;return i===s?h=(r-a)/d+(r<a?6:0):i===r?h=(a-s)/d+2:h=(s-r)/d+4,[h/6,f,c]}function Mo([e,t,n]){if(t===0)return[n*255,n*255,n*255];const s=n<.5?n*(1+t):n+t-n*t,r=2*n-s,a=i=>{let o=i;return o<0&&(o+=1),o>1&&(o-=1),o<1/6?r+(s-r)*6*o:o<1/2?s:o<2/3?r+(s-r)*(2/3-o)*6:r};return[a(e+1/3)*255,a(e)*255,a(e-1/3)*255]}function So(e){const t=os(e);if(!t)return null;const[n,s,r]=_o(t);for(let a=1;a<=vo;a++){const i=ko(Mo([n,s,Math.min(1,r+wo*a)]));if(It(i))return i}return null}function Nt(e,t){const n=os(e);return n?`rgba(${n[0]},${n[1]},${n[2]},${t})`:`color-mix(in srgb, ${e} ${Math.round(t*100)}%, transparent)`}var Fo="'Outfit', system-ui, -apple-system, 'Segoe UI', sans-serif",Ro="'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",Ge=e=>e!=null&&!(typeof e=="string"&&e.trim().length===0)&&!(typeof e=="number"&&!Number.isFinite(e)),Co="#4f46e5";function Ao(e){const t=[];e.appearance&&t.push({source:"code",a:e.appearance});const n=e.legacy;if(n){const r={};Ge(n.primaryColor)&&(r.colors={primary:n.primaryColor}),Ge(n.fontFamily)&&(r.typography={fontFamily:n.fontFamily}),Ge(n.buttonRadius)&&(r.shape={buttonRadius:n.buttonRadius}),Ge(n.logoUrl)&&(r.logo={url:n.logoUrl}),t.push({source:"code:legacy",a:r})}const s=e.server;if(s!=null&&s.appearance&&t.push({source:"dashboard",a:s.appearance}),s){const r={};Ge(s.primary_color)&&s.primary_color.trim().toLowerCase()!==Co&&(r.colors={primary:s.primary_color}),Ge(s.logo_url)&&(r.logo={url:s.logo_url}),t.push({source:"dashboard:flat",a:r})}return t}function ri(e={}){var Me,dt,ht,He;const t=Ao(e),n={};function s(E,P){for(const ie of t){const Oe=P(ie.a);if(Ge(Oe))return n[E]=ie.source,Oe}}function r(E,P,ie){return P!==void 0?P:(n[E]="default",ie)}const a=s("mode",E=>E.mode),i=a==="light"||a==="dark"||a==="auto"?a:"unset";i==="unset"&&(n.mode="default");const o=i==="light"?"light":i==="auto"?e.prefersDark?"dark":"light":"dark",c=o==="dark",d=go[o],f=E=>{const P=s(`page.${E}`,ie=>{var Oe,Ie,Le,at,ft;return c?(Ie=(Oe=ie.colors)==null?void 0:Oe.dark)==null?void 0:Ie[E]:E==="background"?((Le=ie.background)==null?void 0:Le.color)??((at=ie.colors)==null?void 0:at.background):(ft=ie.colors)==null?void 0:ft[E]});return r(`page.${E}`,P,d[E])},h=E=>s(`page.${E}`,P=>{var ie,Oe,Ie;return(c?(Oe=(ie=P.colors)==null?void 0:ie.dark)==null?void 0:Oe[E]:void 0)??((Ie=P.colors)==null?void 0:Ie[E])}),g=r("page.primary",h("primary"),st.primary);let x=h("primaryForeground");if(x===void 0){n["page.primaryForeground"]="default";const[E,P]=yo;x=n["page.primary"]==="default"?E:nr(P,g)>nr(E,g)?P:E}const b={background:f("background"),backgroundImage:s("page.backgroundImage",E=>{var P;return(P=E.background)==null?void 0:P.imageUrl})??null,surface:f("surface"),foreground:f("foreground"),muted:f("muted"),border:f("border"),primary:g,primaryForeground:x,success:r("page.success",h("success"),st.success),error:r("page.error",h("error"),st.error),warning:r("page.warning",h("warning"),st.warning)},C=s("camera.ring",E=>{var P;return(P=E.capture)==null?void 0:P.ring});let R;if(C&&It(C))R=C.trim();else if(It(b.primary))R=b.primary.trim(),n["camera.ring"]=n["page.primary"];else{const E=So(b.primary);E?(R=E,n["camera.ring"]="lightened"):(R=st.primary,n["camera.ring"]="default")}const T=s("camera.challenge",E=>{var P;return(P=E.capture)==null?void 0:P.challenge}),j=T&&It(T)?T.trim():st.challenge;j===st.challenge&&T!==j&&(n["camera.challenge"]="default");const B=s("camera.warning",E=>{var P;return(P=E.capture)==null?void 0:P.warning});let K;B&&It(B)?K=B.trim():It(b.warning)?(K=b.warning.trim(),n["camera.warning"]=n["page.warning"]):(K=st.warning,n["camera.warning"]="default");const H=It(b.success)?b.success.trim():st.success;n["camera.success"]=H===b.success.trim()?n["page.success"]:"default";const v=r("typography.fontFamily",s("typography.fontFamily",E=>{var P;return(P=E.typography)==null?void 0:P.fontFamily}),Ro),D=r("typography.displayFamily",s("typography.displayFamily",E=>{var P;return(P=E.typography)==null?void 0:P.displayFamily}),Fo),q=s("typography.fontCss",E=>{var P;return(P=E.typography)==null?void 0:P.fontCss})??null,W=s("shape.radius",E=>{var P;return typeof((P=E.shape)==null?void 0:P.radius)=="number"?E.shape.radius:void 0}),L=s("shape.buttonRadius",E=>{var P;return typeof((P=E.shape)==null?void 0:P.buttonRadius)=="number"?E.shape.buttonRadius:void 0}),Ue=L??W??14;L===void 0&&(n["shape.buttonRadius"]=W!==void 0?n["shape.radius"]:"default");const fe=s("shape.buttonStyle",E=>{var P;return(P=E.shape)==null?void 0:P.buttonStyle}),ke=fe==="outline"?"outline":"filled";fe===void 0&&(n["shape.buttonStyle"]="default");const Ee={buttonRadius:Ue,buttonStyle:ke,dialogRadius:W??20,sheetRadius:W!==void 0?Math.min(2*W,28):28,tileRadius:W??12},_e=s("logo.url",E=>{var P;return(P=E.logo)==null?void 0:P.url})??null,k=s("logo.placement",E=>{var P;return(P=E.logo)==null?void 0:P.placement}),z=k==="center"||k==="none"?k:"header",Pe=s("logo.height",E=>{var P;return typeof((P=E.logo)==null?void 0:P.height)=="number"&&E.logo.height>0?E.logo.height:void 0}),ze=Ge((Me=e.legacy)==null?void 0:Me.displayName)?e.legacy.displayName.trim():Ge((dt=e.server)==null?void 0:dt.display_name)?e.server.display_name.trim():null;n.displayName=Ge((ht=e.legacy)==null?void 0:ht.displayName)?"code:legacy":Ge((He=e.server)==null?void 0:He.display_name)?"dashboard":"default";const de=E=>s(`icons.${String(E)}`,P=>{var ie;return(ie=P.icons)==null?void 0:ie[E]})??null,xe=s("loader.style",E=>{var P;return(P=E.loader)==null?void 0:P.style}),re=s("loader.imageUrl",E=>{var P;return(P=E.loader)==null?void 0:P.imageUrl})??null;return{mode:o,modeSetting:i,page:b,camera:{ring:R,challenge:j,warning:K,success:H},typography:{displayFamily:D,fontFamily:v,fontCss:q},shape:Ee,logo:{url:_e,placement:z,height:Pe??28},displayName:ze,icons:{success:de("success"),review:de("review"),notVerified:de("notVerified")},loader:{style:xe==="dots"||xe==="bar"?xe:"spinner",imageUrl:re},sources:n}}function To(e){const t=e.page,n=s=>s.replace(/[;{}<>]/g,"");return{"--us-page-bg":n(t.background),"--us-page-bg-image":t.backgroundImage?`url("${encodeURI(t.backgroundImage).replace(/"/g,"%22")}")`:"none","--us-page-surface":n(t.surface),"--us-page-fg":n(t.foreground),"--us-page-muted":n(t.muted),"--us-page-border":n(t.border),"--us-page-muted-tint":Nt(n(t.muted),.18),"--us-primary":n(t.primary),"--us-primary-fg":n(t.primaryForeground),"--us-primary-tint":Nt(n(t.primary),.16),"--us-success":n(t.success),"--us-success-tint":Nt(n(t.success),.16),"--us-error":n(t.error),"--us-error-tint":Nt(n(t.error),.16),"--us-warning":n(t.warning),"--us-warning-tint":Nt(n(t.warning),.16),"--us-cam-ring":e.camera.ring,"--us-cam-challenge":e.camera.challenge,"--us-cam-challenge-tint":Nt(e.camera.challenge,.16),"--us-cam-warning":e.camera.warning,"--us-cam-success":e.camera.success,"--us-font-display":n(e.typography.displayFamily),"--us-font-body":n(e.typography.fontFamily),"--us-btn-radius":`${e.shape.buttonRadius}px`,"--us-dialog-radius":`${e.shape.dialogRadius}px`,"--us-sheet-radius":`${e.shape.sheetRadius}px`,"--us-tile-radius":`${e.shape.tileRadius}px`,"--us-logo-height":`${e.logo.height}px`}}function jo(e){const t=n=>n.split(".").reduce((s,r)=>s==null?void 0:s[r],e);return Object.keys(e.sources).sort().map(n=>{const s=t(n);return s===void 0?`${n} (${e.sources[n]})`:`${n}=${String(s??"")} (${e.sources[n]})`})}function Eo(){return`
    .usesense-engine--guided {
      background: var(--us-page-bg);
      color: var(--us-page-fg);
      font-family: var(--us-font-body);
    }

    /* -- Camera surface (always dark; brand only as accents) */

    .usesense-contour-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 3;
      pointer-events: none;
    }

    .usesense-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .usesense-shutter {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 68px;
      height: 68px;
      margin-top: 14px;
      border-radius: 50%;
      border: 4px solid ${he.shutterRing};
      background: transparent;
      cursor: pointer;
      padding: 0;
    }

    .usesense-shutter:focus-visible {
      outline: 3px solid var(--us-cam-ring);
      outline-offset: 3px;
    }

    .usesense-shutter-inner {
      display: block;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: ${he.shutter};
      transition: transform 120ms ease;
    }

    .usesense-shutter:active .usesense-shutter-inner {
      transform: scale(0.9);
    }

    /* EVIDENCE-v1 colour sequence: a flat tint over the preview, the
       guide and the fill-light veil, under the guidance text. Opacity and
       colour are set per segment by the colour player (fixed, never brand);
       no transition, so the colour changes on the frame it is recorded. */
    .usesense-colour-tint {
      position: absolute;
      inset: 0;
      z-index: 4;
      opacity: 0;
      background: transparent;
      pointer-events: none;
    }

    /* Fill light: the canvas paints warm white around the oval (browsers
       cannot raise screen brightness). The light is fixed warm white whatever
       the theme, so the shutter's ink on it is fixed too. */
    .usesense-engine--fill .usesense-shutter {
      border-color: ${he.shutterOnFill};
    }

    .usesense-engine--fill .usesense-shutter-inner {
      background: ${he.shutterOnFill};
    }

    /* Full-bleed mirrored preview; guide, lines and ring are on the canvas. */
    .usesense-camera-container--guided {
      background: ${he.cameraBackground};
    }

    .usesense-camera-container--guided .usesense-camera-video--blurred {
      display: none;
    }

    .usesense-camera-container--guided .usesense-camera-video--clear {
      clip-path: none;
    }

    .usesense-capture-blur {
      position: absolute;
      inset: 0;
      z-index: 4;
      background: ${he.scanDim};
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      pointer-events: none;
    }

    .usesense-capture-top {
      position: absolute;
      left: 16px;
      right: 16px;
      top: 54px;
      z-index: 6;
      display: flex;
      justify-content: space-between;
      pointer-events: none;
    }

    .usesense-capture-circ {
      pointer-events: auto;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      padding: 0;
      background: ${he.cameraButton};
      color: ${he.cameraButtonInk};
      display: grid;
      place-items: center;
      font-size: 16px;
      font-family: var(--us-font-body);
      cursor: pointer;
    }

    .usesense-capture-circ svg {
      width: 16px;
      height: 16px;
    }

    .usesense-capture-circ:focus-visible {
      outline: 2px solid var(--us-cam-ring);
      outline-offset: 2px;
    }

    /* Guidance (spec v1.1): plain centred text, top edge 28 px below the
       oval (oval bottom = 40% + 23.5% of the height). No box, no icon. */
    .usesense-guidance {
      position: absolute;
      left: 24px;
      right: 24px;
      top: var(--us-guidance-top, calc(63.5% + 28px));
      z-index: 5;
      text-align: center;
      color: ${he.guidance};
      font-family: var(--us-font-body);
      text-shadow: ${he.guidanceShadow};
      pointer-events: none;
      animation: usesense-guidance-in 200ms ease;
    }

    .usesense-guidance-text {
      display: block;
      font-size: 22px;
      font-weight: 600;
      line-height: 1.25;
      letter-spacing: -0.01em;
    }

    .usesense-guidance-sub {
      display: block;
      margin-top: 6px;
      font-size: 15px;
      font-weight: 500;
      line-height: 1.35;
      color: ${he.guidanceSub};
    }

    @keyframes usesense-guidance-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .usesense-shutter--guided {
      position: absolute;
      left: 50%;
      top: var(--us-shutter-y, 85%);
      transform: translate(-50%, -50%);
      margin: 0;
      z-index: 5;
    }

    .usesense-powered {
      font-family: var(--us-font-body);
      font-size: 11px;
      text-align: center;
      color: var(--us-page-muted);
      white-space: nowrap;
    }

    .usesense-powered--camera {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 12px;
      z-index: 5;
      color: ${he.poweredOnCamera};
      pointer-events: none;
    }

    /* Extra check on the camera */
    .usesense-xc-overlay {
      position: absolute;
      inset: 0;
      z-index: 4;
      pointer-events: none;
    }

    .usesense-xc-arrow {
      fill: none;
      stroke: ${he.arrow};
      stroke-width: 5;
      stroke-linecap: round;
      animation: usesense-xc-nudge 1.2s ease-in-out infinite;
    }

    @keyframes usesense-xc-nudge {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.55; }
    }

    .usesense-xc-tick {
      animation: usesense-guidance-in 200ms ease;
    }

    .usesense-xc-tick-disc { fill: var(--us-cam-success); fill-opacity: 0.9; }
    .usesense-xc-tick-mark { stroke: ${he.arrow}; }
    .usesense-xc-dot { fill: var(--us-cam-warning); }
    .usesense-xc-dot-ring,
    .usesense-xc-dot-trail { stroke: var(--us-cam-warning); }

    .usesense-xc-digits {
      position: absolute;
      left: 50%;
      top: 96px;
      transform: translateX(-50%);
      z-index: 5;
      background: ${he.digitsPill};
      border-radius: 16px;
      padding: 10px 22px;
      color: ${he.guidance};
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 34px;
      font-weight: 500;
      letter-spacing: 0.32em;
      white-space: nowrap;
    }

    .usesense-xc-meter {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      z-index: 5;
      display: flex;
      gap: 5px;
      align-items: flex-end;
      height: 34px;
      pointer-events: none;
    }

    .usesense-xc-meter span {
      width: 6px;
      border-radius: 3px;
      background: var(--us-cam-success);
    }

    /* -- Page surface (follows the full palette and mode) */

    .usesense-xc-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      border-radius: var(--us-tile-radius);
    }

    .usesense-xc-badge--success { background: var(--us-success-tint); color: var(--us-success); }
    .usesense-xc-badge--warning { background: var(--us-warning-tint); color: var(--us-warning); }
    .usesense-xc-badge--danger { background: var(--us-error-tint); color: var(--us-error); }
    .usesense-xc-badge--info { background: var(--us-primary-tint); color: var(--us-primary); }
    .usesense-xc-badge--extra { background: var(--us-cam-challenge-tint); color: var(--us-cam-challenge); }

    .usesense-xc-illustration {
      display: block;
      max-width: 160px;
      max-height: 160px;
      object-fit: contain;
    }

    .usesense-upload-sheet,
    .usesense-xc-sheet {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 8px;
      z-index: 7;
      border-radius: var(--us-sheet-radius);
      background: var(--us-page-surface);
      color: var(--us-page-fg);
      font-family: var(--us-font-body);
    }

    .usesense-upload-sheet {
      display: grid;
      gap: 10px;
      justify-items: center;
      padding: 22px;
      text-align: center;
    }

    .usesense-upload-sheet-title {
      font-family: var(--us-font-display);
      font-size: 18px;
      font-weight: 600;
    }

    .usesense-upload-sheet-sub {
      font-size: 13px;
      color: var(--us-page-muted);
    }

    .usesense-upload-sheet-bar {
      width: 100%;
      height: 4px;
      border-radius: 4px;
      background: var(--us-page-border);
      overflow: hidden;
    }

    .usesense-upload-sheet-bar i {
      display: block;
      height: 100%;
      background: var(--us-cam-ring);
      /* Redrawn every frame by the engine; a transition would lag it. */
    }

    .usesense-xc-sheet {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 26px 24px 24px;
      text-align: left;
      animation: usesense-xc-rise 240ms ease;
    }

    @keyframes usesense-xc-rise {
      from { transform: translateY(24px); opacity: 0; }
      to { transform: none; opacity: 1; }
    }

    .usesense-xc-sheet-title {
      font-family: var(--us-font-display);
      font-size: 20px;
      font-weight: 600;
    }

    .usesense-xc-sheet-body {
      font-size: 15px;
      line-height: 1.5;
      color: var(--us-page-fg);
    }

    .usesense-xc-primary {
      height: 56px;
      border: 1.5px solid var(--us-primary);
      border-radius: var(--us-btn-radius);
      background: var(--us-primary);
      color: var(--us-primary-fg);
      font-family: var(--us-font-body);
      font-size: 17px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    }

    .usesense-xc-primary--sheet {
      height: 54px;
      margin-top: 6px;
    }

    .usesense-xc-secondary {
      height: 48px;
      border: none;
      border-radius: var(--us-btn-radius);
      background: none;
      color: var(--us-page-muted);
      font-family: var(--us-font-body);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    }

    .usesense-xc-primary:focus-visible,
    .usesense-xc-secondary:focus-visible,
    .usesense-xc-cancel:focus-visible,
    .usesense-xc-dialog button:focus-visible {
      outline: 2px solid var(--us-primary);
      outline-offset: 2px;
    }

    .usesense-xc-page {
      position: absolute;
      inset: 0;
      z-index: 40;
      background-color: var(--us-page-bg);
      background-image: var(--us-page-bg-image);
      background-size: cover;
      background-position: center;
      color: var(--us-page-fg);
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 16px;
      padding: 120px 28px 16px;
      box-sizing: border-box;
      font-family: var(--us-font-body);
      text-align: left;
      overflow-y: auto;
    }

    .usesense-xc-page--header {
      padding-top: 24px;
    }

    .usesense-xc-header {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      min-height: var(--us-logo-height);
      margin-bottom: 56px;
    }

    .usesense-xc-header--center {
      justify-content: center;
    }

    .usesense-xc-header img {
      height: var(--us-logo-height);
      max-width: 180px;
      object-fit: contain;
    }

    .usesense-xc-header-name {
      font-family: var(--us-font-display);
      font-weight: 600;
      font-size: 17px;
      color: var(--us-page-fg);
    }

    .usesense-xc-page-title {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.01em;
      font-family: var(--us-font-display);
    }

    .usesense-xc-page-body {
      margin: 0;
      font-size: 16px;
      line-height: 1.55;
      color: var(--us-page-fg);
    }

    .usesense-xc-tips {
      list-style: none;
      margin: 4px 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .usesense-xc-tips li {
      display: flex;
      gap: 12px;
      align-items: center;
      font-size: 15px;
      color: var(--us-page-fg);
    }

    .usesense-xc-tips li span {
      width: 8px;
      height: 8px;
      border-radius: 4px;
      background: var(--us-primary);
      flex: none;
    }

    .usesense-xc-spacer {
      flex: 1;
    }

    .usesense-xc-page .usesense-powered {
      margin-top: 4px;
    }

    /* Loading and camera-request pages */
    .usesense-xc-loading {
      position: absolute;
      inset: 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding: 24px 28px;
      background-color: var(--us-page-bg);
      background-image: var(--us-page-bg-image);
      background-size: cover;
      background-position: center;
      color: var(--us-page-fg);
      text-align: center;
      font-family: var(--us-font-body);
    }

    .usesense-xc-loading .usesense-xc-header {
      position: absolute;
      top: 24px;
      left: 28px;
      right: 28px;
      margin: 0;
    }

    .usesense-xc-loading .usesense-powered {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 16px;
    }

    .usesense-xc-loading-title {
      font-family: var(--us-font-display);
      font-size: 20px;
      font-weight: 600;
    }

    .usesense-xc-loading-body {
      font-size: 15px;
      line-height: 1.5;
      color: var(--us-page-muted);
      max-width: 320px;
    }

    .usesense-xc-cancel {
      position: absolute;
      top: 20px;
      right: 20px;
      z-index: 45;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 500;
      font-family: var(--us-font-body);
      color: var(--us-page-muted);
      padding: 6px 4px;
    }

    .usesense-loader-spinner {
      width: 48px;
      height: 48px;
      border: 3.5px solid var(--us-page-border);
      border-top-color: var(--us-primary);
      border-radius: 50%;
      animation: usesense-spin 0.9s linear infinite;
    }

    .usesense-loader-dots {
      display: flex;
      gap: 8px;
    }

    .usesense-loader-dots span {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--us-primary);
      animation: usesense-dot-blink 1.2s ease-in-out infinite;
    }

    .usesense-loader-dots span:nth-child(2) { animation-delay: 0.15s; }
    .usesense-loader-dots span:nth-child(3) { animation-delay: 0.3s; }

    @keyframes usesense-dot-blink {
      0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
      40% { opacity: 1; transform: scale(1); }
    }

    .usesense-loader-bar {
      width: 160px;
      height: 4px;
      border-radius: 4px;
      background: var(--us-page-border);
      overflow: hidden;
      position: relative;
    }

    .usesense-loader-bar i {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 40%;
      border-radius: 4px;
      background: var(--us-primary);
      animation: usesense-bar-slide 1.2s ease-in-out infinite;
    }

    @keyframes usesense-bar-slide {
      from { left: -40%; }
      to { left: 100%; }
    }

    .usesense-loader-image {
      display: block;
      max-width: 96px;
      max-height: 96px;
      object-fit: contain;
    }

    @keyframes usesense-spin {
      to { transform: rotate(360deg); }
    }

    @media (min-width: 600px) {
      .usesense-xc-page {
        padding-left: max(28px, calc(50% - 220px));
        padding-right: max(28px, calc(50% - 220px));
        padding-top: 96px;
      }
      .usesense-xc-page--header {
        padding-top: 24px;
      }
      .usesense-upload-sheet,
      .usesense-xc-sheet {
        left: 50%;
        right: auto;
        width: min(420px, calc(100% - 16px));
        transform: translateX(-50%);
        animation: none;
      }
    }

    .usesense-xc-scrim {
      position: absolute;
      inset: 0;
      z-index: 50;
      background: ${he.scrim};
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
    }

    .usesense-xc-dialog {
      width: 290px;
      max-width: 100%;
      background: var(--us-page-surface);
      color: var(--us-page-fg);
      border-radius: var(--us-dialog-radius);
      padding: 20px 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-family: var(--us-font-body);
    }

    .usesense-xc-dialog-title {
      font-family: var(--us-font-display);
      font-size: 17px;
      font-weight: 600;
      text-align: center;
    }

    .usesense-xc-dialog-body {
      font-size: 14px;
      line-height: 1.45;
      text-align: center;
      color: var(--us-page-muted);
    }

    .usesense-xc-dialog-buttons {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 6px;
    }

    .usesense-xc-dialog-buttons button {
      height: 44px;
      border: 1.5px solid transparent;
      border-radius: var(--us-btn-radius);
      font-family: var(--us-font-body);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }

    .usesense-xc-dialog-no {
      background: var(--us-page-muted-tint);
      color: var(--us-page-fg);
    }

    .usesense-xc-dialog-yes {
      background: var(--us-primary);
      border-color: var(--us-primary);
      color: var(--us-primary-fg);
    }

    /* shape.buttonStyle: outline primary buttons */
    .usesense-engine--btn-outline .usesense-xc-primary,
    .usesense-engine--btn-outline .usesense-xc-dialog-yes {
      background: transparent;
      color: var(--us-primary);
      border-color: var(--us-primary);
    }

    @media (prefers-reduced-motion: reduce) {
      .usesense-guidance,
      .usesense-xc-arrow,
      .usesense-xc-tick,
      .usesense-xc-sheet,
      .usesense-loader-spinner,
      .usesense-loader-dots span,
      .usesense-loader-bar i {
        animation: none !important;
      }
      .usesense-shutter-inner {
        transition: none !important;
      }
    }
  `}var Po="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",Io={bg:"#1C1A17",fg:"#FFFFFF",muted:"#6B6760",card:"#F5F3EF",border:"#E8E5DE",primaryFg:"#FFFFFF",success:"#00D4AA",destructive:"#FF6B4A",warning:"#FFB84D",fontDisplay:"'Outfit', sans-serif",fontBody:"'DM Sans', sans-serif",lightBg:"#FDFCFA",lightFg:"#1C1A17"};function No(e){const{capture:t,appearance:n,isDark:s,...r}=e??{},a=Object.fromEntries(Object.entries(r).filter(([,i])=>i!=null&&i!==""));return{...Io,...a}}function $o(e,t){const n=No(t);return`
    .usesense-engine {
      --us-bg: ${n.bg};
      --us-fg: ${n.fg};
      --us-muted: ${n.muted};
      --us-card: ${n.card};
      --us-border: ${n.border};
      --us-primary: ${e};
      --us-primary-fg: ${n.primaryFg};
      --us-success: ${n.success};
      --us-destructive: ${n.destructive};
      --us-warning: ${n.warning};
      --us-font-display: ${n.fontDisplay};
      --us-font-body: ${n.fontBody};
      --us-light-bg: ${n.lightBg};
      --us-light-fg: ${n.lightFg};
    }

    .usesense-engine {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--us-bg);
      color: var(--us-fg);
      font-family: var(--us-font-body);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }

    /* Light theme -- intro and done phases */
    .usesense-engine--light {
      background: var(--us-light-bg);
      color: var(--us-light-fg);
    }

    .usesense-engine * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* -- Back button (intro, light theme) */

    .usesense-back-btn {
      position: absolute;
      top: 20px;
      left: 20px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 500;
      font-family: var(--us-font-body);
      color: var(--us-muted);
      padding: 6px 4px;
      z-index: 30;
      transition: color 150ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .usesense-back-btn:hover {
      color: var(--us-light-fg);
    }

    /* -- Environment badge (intro, top-right) */

    .usesense-env-badge {
      position: absolute;
      top: 16px;
      right: 20px;
      font-size: 0.72rem;
      font-weight: 600;
      font-family: var(--us-font-body);
      color: #00AA88;
      border: 1px solid rgba(0,212,170,0.2);
      background: rgba(0,212,170,0.08);
      border-radius: 6px;
      padding: 4px 10px;
      z-index: 30;
    }

    /* -- Cancel button (dark phases, top-left plain text) */

    .usesense-cancel-btn {
      position: absolute;
      top: 20px;
      left: 20px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 500;
      font-family: var(--us-font-body);
      color: rgba(255, 255, 255, 0.85);
      padding: 6px 4px;
      z-index: 30;
    }

    /* -- Cancel pill (camera overlay, top-left) */

    .usesense-cancel-pill {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(28, 26, 23, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: none;
      border-radius: 9999px;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 500;
      font-family: var(--us-font-body);
      color: var(--us-fg);
      padding: 7px 16px;
      transition: background 150ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* -- Verifying badge (camera overlay, top-right) */

    .usesense-verifying-badge {
      position: absolute;
      top: 20px;
      right: 20px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: rgba(28, 26, 23, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 9999px;
      padding: 7px 14px;
      font-size: 0.72rem;
      font-weight: 600;
      font-family: var(--us-font-body);
      color: var(--us-fg);
    }

    /* -- Challenge brief screen */

    .usesense-challenge-brief-title {
      font-size: 1.6rem;
      font-weight: 700;
      font-family: var(--us-font-display);
      letter-spacing: -0.03em;
      color: var(--us-fg);
      text-align: center;
      margin-bottom: 4px;
    }

    .usesense-challenge-brief-desc {
      font-size: 0.88rem;
      font-family: var(--us-font-body);
      color: rgba(255, 255, 255, 0.5);
      text-align: center;
      line-height: 1.65;
      max-width: 360px;
    }

    .usesense-challenge-brief-tip {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px 20px;
      font-size: 0.88rem;
      font-family: var(--us-font-body);
      color: rgba(255, 255, 255, 0.5);
      text-align: center;
      max-width: 420px;
      width: 100%;
    }

    /* -- Video */

    .usesense-camera-container {
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: #0C0B09;
    }

    .usesense-camera-video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    /* Blurred background layer - covers the whole screen */
    .usesense-camera-video--blurred {
      transform: scaleX(-1) scale(1.06);
      filter: blur(20px) brightness(0.45);
      z-index: 1;
    }

    /* Clear layer - shows only the oval area unblurred */
    .usesense-camera-video--clear {
      transform: scaleX(-1);
      clip-path: ellipse(22vmin 29.5vmin at 50% 40%);
      z-index: 2;
    }

    /* -- Face Oval */

    .usesense-face-oval {
      position: absolute;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 44vmin;
      height: 59vmin;
      border: 3px solid rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      pointer-events: none;
      z-index: 3;
      animation: usesense-pulse-oval 2s ease-in-out infinite;
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.08);
    }

    .usesense-face-oval--ready {
      border-color: var(--us-fg);
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
      animation: none;
    }

    .usesense-face-oval--baseline {
      border-color: rgba(255, 255, 255, 0.5);
      animation: none;
    }

    /* Guided capture screens: see capture-styles.ts (BRAND-v1 tokens only). */

    @media (prefers-reduced-motion: reduce) {
      .usesense-face-oval,
      .usesense-countdown-number,
      .usesense-direction-arrow,
      .usesense-follow-dot,
      .usesense-recording-dot {
        animation: none !important;
      }
      .usesense-progress-fill {
        transition: none !important;
      }
    }

    /* -- Status Bar (absolute bottom overlay) */

    .usesense-status-area {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 10;
      padding: 24px 24px 48px;
      text-align: center;
      background: linear-gradient(to top, rgba(12, 11, 9, 0.8) 0%, transparent 100%);
    }

    .usesense-phase-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.58rem;
      font-weight: 700;
      font-family: var(--us-font-body);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 8px;
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.5);
    }

    .usesense-status-text {
      font-size: 1rem;
      font-weight: 700;
      font-family: var(--us-font-display);
      letter-spacing: -0.02em;
      color: var(--us-fg);
      margin-bottom: 4px;
    }

    .usesense-status-hint {
      font-size: 0.75rem;
      font-family: var(--us-font-body);
      color: rgba(255, 255, 255, 0.5);
    }

    /* -- Progress Bar */

    .usesense-progress {
      position: absolute;
      bottom: 130px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 48px);
      max-width: 360px;
      height: 4px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 9999px;
      overflow: hidden;
      z-index: 10;
    }

    .usesense-progress-fill {
      height: 100%;
      background: ${e};
      border-radius: 9999px;
      transition: width 250ms cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 0 8px ${e};
    }

    /* -- Buttons */

    .usesense-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 44px;
      padding: 0 24px;
      border-radius: 10px;
      border: none;
      font-size: 0.88rem;
      font-weight: 600;
      font-family: var(--us-font-body);
      cursor: pointer;
      transition: all 150ms cubic-bezier(0.16, 1, 0.3, 1);
      min-width: 160px;
    }

    .usesense-btn:hover { transform: scale(1.03); }
    .usesense-btn:active { transform: scale(0.97); }
    .usesense-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }
    .usesense-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(79,124,255,0.15); }

    .usesense-btn--primary {
      background: ${e};
      color: var(--us-fg);
      box-shadow: 0 4px 14px ${e}40;
    }

    .usesense-btn--primary:hover {
      background: ${e};
      opacity: 0.9;
    }

    .usesense-btn--secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--us-fg);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .usesense-engine--light .usesense-btn--secondary {
      background: #FFFFFF;
      color: var(--us-light-fg);
      border: 1px solid var(--us-border);
    }

    .usesense-engine--light .usesense-btn--secondary:hover {
      background: var(--us-card);
      border-color: #D0CCBF;
    }

    .usesense-btn--danger {
      background: var(--us-destructive);
      color: var(--us-fg);
    }

    .usesense-btn--danger:hover {
      background: #DB4E33;
    }

    /* -- Countdown */

    .usesense-countdown-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(12, 11, 9, 0.5);
      z-index: 20;
    }

    .usesense-countdown-number {
      font-size: 120px;
      font-weight: 800;
      font-family: var(--us-font-display);
      color: var(--us-fg);
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      animation: usesense-countdown-pop 0.9s cubic-bezier(0.16, 1, 0.3, 1);
      line-height: 1;
    }

    .usesense-countdown-label {
      font-size: 0.88rem;
      font-weight: 500;
      font-family: var(--us-font-body);
      color: rgba(255, 255, 255, 0.5);
      margin-top: 12px;
    }

    /* -- Challenge: Follow Dot */

    .usesense-follow-dot {
      position: absolute;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--us-destructive) 0%, #DB4E33 100%);
      box-shadow: 0 0 20px rgba(255, 107, 74, 0.8),
                  0 0 40px rgba(255, 107, 74, 0.4);
      transform: translate(-50%, -50%);
      transition: left 250ms cubic-bezier(0.16, 1, 0.3, 1),
                  top 250ms cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 15;
      animation: usesense-dot-pulse 1s ease-in-out infinite;
    }

    /* -- Challenge: Direction Arrow */

    .usesense-direction-arrow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      min-width: 120px;
      padding: 16px 20px;
      border-radius: 14px;
      background: rgba(28, 26, 23, 0.82);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      z-index: 15;
      animation: usesense-direction-enter 250ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .usesense-direction-arrow svg {
      width: 40px;
      height: 40px;
      color: var(--us-fg);
      stroke-width: 2.5;
    }

    .usesense-direction-label {
      font-size: 0.58rem;
      font-weight: 700;
      font-family: var(--us-font-body);
      color: var(--us-fg);
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    /* -- Speak Phrase */

    .usesense-phrase-display {
      margin-top: 16px;
      padding: 16px 24px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      font-size: 1.6rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 6px;
      color: var(--us-fg);
      text-align: center;
    }

    .usesense-recording-indicator {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      background: rgba(255, 107, 74, 0.08);
      border: 1px solid rgba(255, 107, 74, 0.2);
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 600;
      font-family: var(--us-font-body);
      color: var(--us-destructive);
      margin-bottom: 12px;
    }

    .usesense-recording-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--us-destructive);
      animation: usesense-blink 1s ease-in-out infinite;
    }

    /* -- Face Guide Feedback */

    .usesense-guide-feedback {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      background: rgba(12, 11, 9, 0.7);
      backdrop-filter: blur(8px);
      border-radius: 9999px;
      font-size: 0.88rem;
      font-weight: 500;
      font-family: var(--us-font-body);
      color: var(--us-fg);
      white-space: nowrap;
      z-index: 10;
    }

    .usesense-guide-feedback--ready {
      background: rgba(0, 212, 170, 0.15);
      border: 1px solid rgba(0, 212, 170, 0.3);
      color: var(--us-success);
    }

    /* -- Environment Warning */

    .usesense-env-warning {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      padding: 4px 10px;
      background: rgba(255, 184, 77, 0.08);
      border: 1px solid rgba(255, 184, 77, 0.2);
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 600;
      font-family: var(--us-font-body);
      color: #DB973A;
      z-index: 10;
      white-space: nowrap;
    }

    /* -- Result Screens */

    .usesense-result {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 40px 24px;
      gap: 16px;
    }

    .usesense-result-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }

    .usesense-result-icon--success {
      background: rgba(0, 212, 170, 0.08);
      color: var(--us-success);
    }

    .usesense-result-icon--failure {
      background: rgba(255, 107, 74, 0.08);
      color: var(--us-destructive);
    }

    .usesense-result-icon--review {
      background: rgba(255, 184, 77, 0.08);
      color: var(--us-warning);
    }

    .usesense-result-icon svg {
      width: 40px;
      height: 40px;
    }

    .usesense-result-title {
      font-size: 1.6rem;
      font-weight: 700;
      font-family: var(--us-font-display);
      letter-spacing: -0.03em;
      color: var(--us-fg);
    }

    .usesense-engine--light .usesense-result-title {
      color: var(--us-light-fg);
    }

    .usesense-result-subtitle {
      font-size: 0.88rem;
      font-family: var(--us-font-body);
      color: rgba(255, 255, 255, 0.5);
      line-height: 1.65;
      max-width: 320px;
    }

    .usesense-engine--light .usesense-result-subtitle {
      color: var(--us-muted);
    }

    .usesense-engine--light .usesense-result-icon--success {
      background: rgba(0, 212, 170, 0.08);
    }

    .usesense-engine--light .usesense-result-icon--failure {
      background: rgba(255, 107, 74, 0.06);
    }

    .usesense-engine--light .usesense-result-icon--review {
      background: rgba(255, 184, 77, 0.06);
    }

    .usesense-btn--full {
      width: 100%;
      max-width: 420px;
      border-radius: 14px;
    }

    /* -- Upload Progress */

    .usesense-progress-track {
      width: 100%;
      max-width: 320px;
      height: 4px;
      margin-top: 18px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.1);
      overflow: hidden;
    }

    .usesense-engine--light .usesense-progress-track {
      background: rgba(0, 0, 0, 0.08);
    }

    .usesense-progress-fill {
      height: 100%;
      border-radius: 999px;
      background: ${e};
      /* Eases the jump between XHR progress events, which arrive in chunks. */
      transition: width 0.25s ease-out;
    }

    /* -- Loading Spinner */

    .usesense-spinner {
      width: 64px;
      height: 64px;
      border: 3.5px solid rgba(255, 255, 255, 0.08);
      border-top-color: ${e};
      border-radius: 50%;
      animation: usesense-spin 0.9s linear infinite;
    }

    /* -- Logo */

    .usesense-logo {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      height: 28px;
      z-index: 30;
      opacity: 0.8;
    }

    /* -- Footer */

    .usesense-footer {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.65rem;
      font-family: 'JetBrains Mono', monospace;
      color: rgba(255, 255, 255, 0.3);
      white-space: nowrap;
      z-index: 5;
    }

    .usesense-engine--light .usesense-footer {
      color: #9E9A92;
    }

    ${Eo()}

    /* -- Animations */

    @keyframes usesense-spin {
      to { transform: rotate(360deg); }
    }

    @keyframes usesense-pulse-oval {
      0%, 100% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
      50% { opacity: 1; transform: translate(-50%, -50%) scale(1.02); }
    }

    @keyframes usesense-countdown-pop {
      0% { transform: scale(0.3); opacity: 0; }
      40% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes usesense-direction-enter {
      0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
      60% { transform: translate(-50%, -50%) scale(1.1); }
      100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }

    @keyframes usesense-dot-pulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); }
      50% { transform: translate(-50%, -50%) scale(1.1); }
    }

    @keyframes usesense-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* -- Responsive (mobile) */

    @media (max-width: 640px) {
      .usesense-camera-container {
        max-width: 100%;
        border-radius: 0;
        aspect-ratio: auto;
        flex: 1;
      }

      .usesense-engine {
        padding: 0;
        min-height: 100vh;
        min-height: 100dvh;
      }

      /* Larger face oval for arm's-length use on mobile.
         Switch from vmin to vw so the oval scales with screen width
         (the constraining axis in portrait). */
      .usesense-face-oval {
        width: 60vw;
        height: 80vw;
        top: 38%;
      }

      /* Match the clear clip-path to the larger oval */
      .usesense-camera-video--clear {
        clip-path: ellipse(30vw 40vw at 50% 38%);
      }

      .usesense-btn {
        height: 52px;
        font-size: 1rem;
        border-radius: 14px;
      }

      .usesense-btn--full {
        max-width: 100%;
        border-radius: 10px;
      }

      .usesense-countdown-number {
        font-size: 96px;
      }

      .usesense-challenge-brief-title {
        font-size: 1.35rem;
      }

      .usesense-challenge-brief-desc {
        font-size: 0.82rem;
      }

      .usesense-challenge-brief-tip {
        font-size: 0.82rem;
        padding: 12px 16px;
        border-radius: 10px;
      }

      .usesense-result {
        padding: 32px 16px;
        gap: 12px;
      }

      .usesense-result-title {
        font-size: 1.35rem;
      }

      .usesense-result-subtitle {
        font-size: 0.82rem;
      }

      .usesense-phrase-display {
        font-size: 1.2rem;
        padding: 12px 16px;
        letter-spacing: 4px;
        border-radius: 10px;
      }

      .usesense-direction-arrow {
        min-width: 100px;
        padding: 12px 16px;
        border-radius: 10px;
      }

      .usesense-direction-arrow svg {
        width: 32px;
        height: 32px;
      }

      .usesense-progress {
        bottom: 110px;
        width: calc(100% - 32px);
      }

      .usesense-status-area {
        padding: 16px 16px 28px;
      }

      .usesense-cancel-pill,
      .usesense-verifying-badge {
        top: 12px;
      }

      .usesense-cancel-pill {
        left: 12px;
      }

      .usesense-verifying-badge {
        right: 12px;
      }

      .usesense-follow-dot {
        width: 48px;
        height: 48px;
      }

      .usesense-guide-feedback {
        bottom: 8px;
        font-size: 0.82rem;
        padding: 6px 14px;
      }

      .usesense-env-warning {
        top: 8px;
        font-size: 0.65rem;
      }
    }

    /* ── Step-Up: Flash Reflection Overlay ─────────────────────────────── */

    .usesense-flash-overlay {
      position: absolute;
      inset: 0;
      z-index: 25;
      opacity: 0.6;
      mix-blend-mode: screen;
      pointer-events: none;
      transition: background-color 0.05s ease;
    }

    .usesense-step-up-status {
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 30;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      padding: 10px 24px;
      border-radius: 20px;
      font-size: 0.85rem;
      color: #fff;
      white-space: nowrap;
    }

    /* ── Step-Up: RMAS Action Prompt ───────────────────────────────────── */

    .usesense-rmas-card {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 30;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 16px;
      padding: 24px 32px;
      text-align: center;
      min-width: 240px;
      animation: usesense-rmas-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes usesense-rmas-in {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    .usesense-rmas-label {
      font-family: var(--us-font-display);
      font-size: 1.3rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 12px;
    }

    .usesense-rmas-step {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 10px;
    }

    .usesense-rmas-countdown-bar {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 2px;
      overflow: hidden;
    }

    .usesense-rmas-countdown-fill {
      height: 100%;
      background: ${e};
      border-radius: 2px;
      transition: width 0.1s linear;
    }

    /* ── Step-Up: Intro / Complete Overlays ────────────────────────────── */

    .usesense-step-up-overlay {
      position: absolute;
      inset: 0;
      z-index: 28;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      animation: usesense-stepup-fade-in 0.3s ease;
    }

    @keyframes usesense-stepup-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .usesense-step-up-icon {
      width: 48px;
      height: 48px;
      color: ${e};
      margin-bottom: 16px;
    }

    .usesense-step-up-title {
      font-family: var(--us-font-display);
      font-size: 1.2rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 8px;
    }

    .usesense-step-up-message {
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.7);
      text-align: center;
      max-width: 280px;
      line-height: 1.5;
    }
  `}var Oo="'Outfit', system-ui, -apple-system, Segoe UI, sans-serif",Lo="'DM Sans', system-ui, -apple-system, Segoe UI, sans-serif",ai={bg:"#FDFCFA",fg:"#1C1A17",muted:"#6B6760",card:"#F5F3EF",border:"#E8E5DE",primary:"#4F7CFF",primaryFg:"#FFFFFF",success:"#00D4AA",destructive:"#FF6B4A",warning:"#FFB84D",fontDisplay:Oo,fontBody:Lo,radius:12,buttonRadius:12,buttonStyle:"filled",isDark:!1};({...ai});var Bo=ai;function ii(e,t){var n,s;return e?t?{...t,...e,colors:{...t.colors,...e.colors,dark:{...(n=t.colors)==null?void 0:n.dark,...(s=e.colors)==null?void 0:s.dark}},typography:{...t.typography,...e.typography},shape:{...t.shape,...e.shape},logo:{...t.logo,...e.logo},background:{...t.background,...e.background},icons:{...t.icons,...e.icons},loader:{...t.loader,...e.loader},capture:{...t.capture,...e.capture}}:e:t}var ga=["Good light on your face","Take off sunglasses, hats and masks","Only you in the picture"],qs={primer:{selfieTitle:"Take a quick selfie",selfieBody:"Hold your phone at eye level and look at the screen for a few seconds.",selfieTips:ga,start:"Start",cancel:"Cancel",twoStepsTitle:"Two quick steps",twoStepsBody:"A selfie scan, then a short movement. About 10 seconds.",twoStepsTips:ga,gettingReady:"Getting ready...",cameraTitle:"Allow camera access",cameraBody:"We need access to your camera for identity verification"},guidance:{ready:"Hold still",centre:"Move your face to the centre",closer:"Move a little closer",back:"Move back a little",straight:"Look straight ahead",dark:"Find more light",darkHint:"Face a window or lamp",bright:"Too much light behind you",brightHint:"Turn away from the window",blur:"Hold your phone steady",eyes:"Keep your eyes open",onePerson:"Only you in the picture",showFace:"Show your face in the oval",covered:"Keep your face uncovered",holdStill:"Hold still",shutterHint:"Tap the button when you're ready"},extraCheck:{sheetTitle:"One more quick check",sheetBody:"Slowly turn your head to the left, then to the right.",continue:"Continue",headTurn:"Turn your head to the {side}",followDot:"Follow the dot with your head",speakDigits:"Say these numbers",lookCentre:"Now look straight ahead",tryNext:"Let's try the next one",done:"Done",headTurnNext:"Now to the {side}",slowly:"Slowly",tryAgain:"Let's try that again",turnFurther:"Turn a little further to the {side}",keepFollowing:"Keep following",towardDot:"Turn your head toward the dot",pausedTurn:"Then keep turning",pausedTurnSide:"Then keep turning to the {side}",pausedLookCentre:"Then look straight ahead",pausedDot:"The dot will wait for you",pausedDigits:"Then say the numbers",cantHear:"We can't hear you",speakLouder:"Speak a little louder",oneMoment:"One more moment",keepInOval:"Keep your face in the oval",screenColour:"The screen will change colour"},upload:{title:"Checking it's you",caption:"Usually under 10 seconds",failedTitle:"Couldn't send your scan",failedBody:"Check your connection. Your scan is kept, so you won't need to do it again.",retry:"Try again"},result:{approvedTitle:"You're verified",approvedBody:"Thanks. You can carry on in {app}.",reviewTitle:"Thanks, we're checking",reviewBody:"This can take a few minutes. {app} will let you know.",rejectedTitle:"We couldn't verify you",rejectedBody:"Please contact {app} for help.",retryTitle:"We couldn't verify you",retryBody:"This sometimes happens with poor light or movement. You can try once more.",done:"Done",tryAgain:"Try again",notNow:"Not now",retryTips:["Face a window or a lamp","Hold your phone at eye level"]},errors:{cameraDeniedTitle:"Camera access needed",cameraDeniedBody:"We use the camera only for this check. Allow camera access for this site in your browser's address bar or site settings, then try again.",openSettings:"Try again",cameraStoppedTitle:"The camera stopped",cameraStoppedBody:"Another app or tab may be using it. Close anything else that uses the camera, then try again.",micTitle:"Microphone needed",micBody:"This check needs your microphone. Allow it for this site in your browser's address bar or site settings and try again, or do a head movement instead.",useHeadMovement:"Do a head movement instead",offlineTitle:"You're offline",offlineBody:"Check your internet connection, then try again.",expiredTitle:"This check timed out",expiredBody:"For your security, each check is only open for 15 minutes.",startAgain:"Start again",errorTitle:"Something went wrong",errorBody:"It's not you. Please try again in a moment."},leave:{title:"Leave verification?",body:"You're nearly done. If you leave, you'll need to start again.",leave:"Leave",keepGoing:"Keep going"}},Mt={noApp:{approvedBody:"Thanks. You can carry on now.",reviewBody:"This can take a few minutes. You'll be told the result.",rejectedBody:"Please contact the service you are verifying with for help."},twoStepsBodyDigits:"A selfie scan, then say a few numbers out loud. About 10 seconds.",sheetBody:{follow_dot:"Keep your face in the oval and follow the dot with your head.",speak_phrase:"Say the numbers you see out loud. We'll need your microphone."},headTurnVertical:"Look {side}",headTurnNextVertical:"Now look {side}",turnFurtherVertical:"Look a little further {side}",turnFurtherCentre:"Look straight at the screen",pausedTurnVertical:"Then keep tilting your head {side}"};function Pt(e,t){return e.replace(/\{(app|side)\}/g,(n,s)=>{const r=t[s];return r??n})}var sr=e=>e==null||typeof e=="string"&&e.trim().length===0,xn={left:"left",right:"right",up:"up",down:"down"},Do={left:"to the left",right:"to the right",up:"up",down:"down"};function Uo(){var n;if(typeof document>"u")return null;const e=(n=document.title)==null?void 0:n.trim();return e||(typeof location<"u"?location.hostname:"")||null}var ds=class{constructor(e=void 0,t,n=Uo()){this.copy=e,this.app=t&&t.trim()?t.trim():null,this.appForOverrides=this.app??n}override(e,t){var r;const n=(r=this.copy)==null?void 0:r[e],s=n==null?void 0:n[t];return sr(s)?void 0:s}has(e,t){return this.override(e,t)!==void 0}t(e,t,n={}){const s=this.override(e,t);if(typeof s=="string")return Pt(s,{app:this.appForOverrides,side:n.side});if(e==="result"&&this.app===null){const a=Mt.noApp[t];if(a)return a}const r=qs[e][t];return Pt(r,{app:this.app,side:n.side})}list(e,t){const n=this.override(e,t);if(Array.isArray(n)){const s=n.filter(r=>typeof r=="string"&&r.trim().length>0).map(r=>Pt(r,{app:this.appForOverrides}));if(s.length>0)return s}return[...qs[e][t]]}primer(e){const t=e==="head_turn"||e==="follow_dot"||e==="speak_phrase";if(!t)return{title:this.t("primer","selfieTitle"),body:this.t("primer","selfieBody"),tips:this.list("primer","selfieTips"),start:this.t("primer","start"),two:t};const n=e==="speak_phrase"&&!this.has("primer","twoStepsBody")?Mt.twoStepsBodyDigits:this.t("primer","twoStepsBody");return{title:this.t("primer","twoStepsTitle"),body:n,tips:this.list("primer","twoStepsTips"),start:this.t("primer","start"),two:t}}sheetBody(e,t){if(this.has("extraCheck","sheetBody")){const s=(t??[]).find(r=>r!=="center");return this.t("extraCheck","sheetBody",{side:s?xn[s]:null})}if(e!=="head_turn")return Mt.sheetBody[e];const n=(t??[]).filter(s=>s in xn);return n.length===0?qs.extraCheck.sheetBody:`Slowly turn your head ${n.slice(0,2).map(s=>Do[s]).join(", then ")}.`}headTurn(e,t){if(e!=="left"&&e!=="right"&&e!=="up"&&e!=="down")return{text:this.t("extraCheck","lookCentre")};const n=xn[e],s=e==="up"||e==="down";return t?{text:s&&!this.has("extraCheck","headTurn")?Pt(Mt.headTurnVertical,{side:n}):this.t("extraCheck","headTurn",{side:n}),sub:this.t("extraCheck","slowly")}:{text:s&&!this.has("extraCheck","headTurnNext")?Pt(Mt.headTurnNextVertical,{side:n}):this.t("extraCheck","headTurnNext",{side:n})}}turnFurther(e){if(e!=="left"&&e!=="right"&&e!=="up"&&e!=="down")return Mt.turnFurtherCentre;const t=xn[e];return(e==="up"||e==="down")&&!this.has("extraCheck","turnFurther")?Pt(Mt.turnFurtherVertical,{side:t}):this.t("extraCheck","turnFurther",{side:t})}pausedTurn(e){if(e==="center")return this.t("extraCheck","pausedLookCentre");if(e!=="left"&&e!=="right"&&e!=="up"&&e!=="down")return this.t("extraCheck","pausedTurn");const t=xn[e];return(e==="up"||e==="down")&&!this.has("extraCheck","pausedTurnSide")?Pt(Mt.pausedTurnVertical,{side:t}):this.t("extraCheck","pausedTurnSide",{side:t})}gateHint(e){switch(e){case"face":return{text:this.t("guidance","showFace")};case"one_person":return{text:this.t("guidance","onePerson")};case"covered":return{text:this.t("guidance","covered")};case"in_frame":return{text:this.t("guidance","centre")};case"too_far":return{text:this.t("guidance","closer")};case"too_close":return{text:this.t("guidance","back")};case"pose":return{text:this.t("guidance","straight")};case"too_dark":return{text:this.t("guidance","dark"),sub:this.t("guidance","darkHint")};case"too_bright":return{text:this.t("guidance","bright"),sub:this.t("guidance","brightHint")};case"sharpness":return{text:this.t("guidance","blur")};case"eyes":return{text:this.t("guidance","eyes")};case"stillness":return{text:this.t("guidance","holdStill")};default:return null}}},Bt=new ds(void 0,null,null);function oi(e,t){if(!e)return t??void 0;if(!t)return e;const n={},s=new Set([...Object.keys(t),...Object.keys(e)]);for(const r of s){const a=t[r]??{},i=e[r]??{},o={...a};for(const[c,d]of Object.entries(i))sr(d)||Array.isArray(d)&&d.every(sr)||(o[c]=d);n[r]=o}return n}function zo(){const e="(prefers-color-scheme: dark)",[t,n]=m.useState(()=>{var s;return typeof window<"u"&&!!((s=window.matchMedia)!=null&&s.call(window,e).matches)});return m.useEffect(()=>{var a;if(typeof window>"u"||!window.matchMedia)return;const s=window.matchMedia(e),r=i=>n(i.matches);return n(s.matches),(a=s.addEventListener)==null||a.call(s,"change",r),()=>{var i;return(i=s.removeEventListener)==null?void 0:i.call(s,"change",r)}},[]),t}function Ho(e){if(!e)return;if(e.appearance)return e.appearance;const t={background:e.bg,surface:e.card,foreground:e.fg,muted:e.muted,border:e.border,primaryForeground:e.primaryFg,success:e.success,error:e.destructive,warning:e.warning},n=Object.fromEntries(Object.entries(t).filter(([,r])=>typeof r=="string"&&r.trim())),s={};return Object.keys(n).length&&(s.colors={...n,dark:{...n}}),(e.fontBody||e.fontDisplay)&&(s.typography={fontFamily:e.fontBody,displayFamily:e.fontDisplay}),e.capture&&(s.capture=e.capture),Object.keys(s).length?s:void 0}function Wo(e,t){if(!e)return t??null;if(!t)return e;const n=s=>e[s]!=null&&e[s]!==""?e[s]:t[s];return{display_name:n("display_name"),logo_url:n("logo_url"),primary_color:n("primary_color"),redirect_url:n("redirect_url"),appearance:ii(e.appearance??void 0,t.appearance??void 0)??null,copy:{capture:oi(rr(e.copy),rr(t.copy))}}}function rr(e){const t=e==null?void 0:e.capture;return t&&typeof t=="object"?t:void 0}function Vo(e){var a;const t=Wo(e.branding,e.sessionBranding),n=ii(e.appearance,Ho(e.theme)),s=ri({appearance:n,legacy:{primaryColor:e.primaryColor,logoUrl:e.logoUrl,displayName:e.displayName},server:t,prefersDark:e.prefersDark}),r=oi((a=e.copy)==null?void 0:a.capture,rr(t==null?void 0:t.copy));return{theme:s,strings:new ds(r,s.displayName)}}function qo(e){if(typeof document>"u")return;const t=e.trim(),n=/^https:\/\/\S+$/i.test(t),s="usesense-capture-font-css",r=document.getElementById(s);if((r==null?void 0:r.getAttribute("data-src"))===t)return;r==null||r.remove();let a;if(n){const i=document.createElement("link");i.rel="stylesheet",i.href=t,a=i}else{const i=document.createElement("style");i.textContent=t,a=i}a.id=s,a.setAttribute("data-src",t),document.head.appendChild(a)}var wn={title:"Take a selfie",body:"A quick face scan confirms you're a real, live person.",start:"Start face scan",busy:"Please wait…",cancel:"Cancel"};function Go({tokens:e,brandName:t,logoUrl:n,onCancel:s,cancelLabel:r=wn.cancel,fixed:a=!1,children:i}){const o=t||"Sense",c=t&&t!=="Sense"?`${t} · Sense`:"Sense";return l.jsxs("div",{style:{position:a?"fixed":"absolute",inset:0,background:e.bg,color:e.fg,display:"flex",flexDirection:"column",fontFamily:e.fontBody,textAlign:"left",...a?{zIndex:2147483600}:{zIndex:40},...e.backgroundImage?{backgroundImage:`url(${e.backgroundImage})`,backgroundSize:"cover",backgroundPosition:"center"}:{}},children:[l.jsxs("div",{style:{height:56,flex:"none",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",borderBottom:`1px solid ${e.border}`},children:[n?l.jsx("img",{src:n,alt:o,style:{height:28,maxWidth:160,objectFit:"contain"}}):l.jsx("span",{style:{fontWeight:600,color:e.fg,fontFamily:e.fontDisplay},children:o}),s&&l.jsx("button",{type:"button",onClick:s,"aria-label":r,style:{position:"absolute",right:16,background:"none",border:"none",color:e.muted,cursor:"pointer",fontSize:14,fontFamily:e.fontBody},children:r})]}),l.jsx("main",{style:{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:24},children:i}),l.jsxs("div",{style:{padding:12,textAlign:"center",fontSize:11,color:e.muted,fontFamily:e.fontBody},children:["Secured by ",c]})]})}function Yo({tokens:e,busy:t=!1,title:n,body:s,start:r,onStart:a}){const i=e.buttonStyle==="outline";return l.jsxs("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:12,maxWidth:380,textAlign:"center"},children:[l.jsx("h1",{style:{fontSize:24,fontWeight:700,margin:0,color:e.fg,fontFamily:e.fontDisplay,letterSpacing:"-0.01em"},children:n??wn.title}),l.jsx("p",{style:{color:e.muted,margin:0,fontFamily:e.fontBody,fontSize:15},children:s??wn.body}),l.jsx("div",{style:{display:"flex",flexDirection:"column",gap:10,width:"100%"},children:l.jsx("button",{type:"button",onClick:a,disabled:t,style:{background:i?"transparent":e.primary,color:i?e.primary:e.primaryFg,border:i?`1.5px solid ${e.primary}`:"none",borderRadius:e.buttonRadius,padding:"14px 16px",fontSize:16,fontWeight:600,fontFamily:e.fontBody,cursor:t?"default":"pointer",opacity:t?.5:1,width:"100%"},children:t?wn.busy:r??wn.start})})]})}var ya={start:.04,sending:{cap:.6,tauMs:1500},checking:{cap:.95,tauMs:5e3}},xa={idle:0,sending:1,checking:2,done:3},Xo=class{constructor(){this.stage="idle",this.since=0,this.from=0}get current(){return this.stage}advance(e,t){if(xa[e]<=xa[this.stage])return;const n=this.value(t);this.from=e==="sending"&&this.stage==="idle"?ya.start:n,this.stage=e,this.since=t}reset(){this.stage="idle",this.since=0,this.from=0}value(e){switch(this.stage){case"idle":return 0;case"done":return 1;default:{const{cap:t,tauMs:n}=ya[this.stage],s=Math.min(this.from,t),r=Math.max(0,e-this.since);return Math.min(t-.001,t-(t-s)*Math.exp(-r/n))}}}};function Ko(e){return Math.max(0,Math.min(100,Math.floor(e*10)*10))}var Jo=[{id:"obs",name:"OBS Virtual Camera",pattern:/\bobs\b.*(virtual|cam)|obs-camera|obs virtualcam/i,confidence:"high"},{id:"manycam",name:"ManyCam",pattern:/manycam/i,confidence:"high"},{id:"snap_camera",name:"Snap Camera",pattern:/snap\s*camera/i,confidence:"high"},{id:"xsplit",name:"XSplit VCam",pattern:/xsplit/i,confidence:"high"},{id:"e2esoft_vcam",name:"e2eSoft VCam",pattern:/e2e\s*soft|\bvcam\b/i,confidence:"high"},{id:"ivcam",name:"iVCam",pattern:/\bivcam\b/i,confidence:"high"},{id:"camtwist",name:"CamTwist",pattern:/camtwist/i,confidence:"high"},{id:"mmhmm",name:"mmhmm",pattern:/mmhmm/i,confidence:"high"},{id:"nvidia_broadcast",name:"NVIDIA Broadcast",pattern:/nvidia\s*broadcast/i,confidence:"high"},{id:"logi_capture",name:"Logi Capture virtual camera",pattern:/logi(tech)?\s*capture/i,confidence:"high"},{id:"droidcam",name:"DroidCam",pattern:/droid\s*cam/i,confidence:"high"},{id:"epoccam",name:"EpocCam",pattern:/epoc\s*cam/i,confidence:"high"},{id:"iriun",name:"Iriun Webcam",pattern:/iriun/i,confidence:"high"},{id:"camo",name:"Reincubate Camo",pattern:/\bcamo\b|reincubate/i,confidence:"high"},{id:"vmix",name:"vMix Video",pattern:/\bvmix\b/i,confidence:"high"},{id:"splitcam",name:"SplitCam",pattern:/splitcam/i,confidence:"high"},{id:"youcam",name:"CyberLink YouCam",pattern:/\byoucam\b/i,confidence:"high"},{id:"streamlabs",name:"Streamlabs virtual camera",pattern:/streamlabs/i,confidence:"high"},{id:"wirecast",name:"Wirecast virtual camera",pattern:/wirecast/i,confidence:"high"},{id:"unity_capture",name:"Unity Video Capture",pattern:/unity\s*(video\s*)?capture/i,confidence:"high"},{id:"akvcam",name:"akvcam / Webcamoid",pattern:/akvcam|webcamoid/i,confidence:"high"},{id:"v4l2loopback",name:"v4l2loopback",pattern:/v4l2\s*loopback|dummy video device/i,confidence:"high"},{id:"ndi",name:"NDI Virtual Input",pattern:/\bndi\b.*(webcam|virtual|video)/i,confidence:"high"},{id:"chromacam",name:"ChromaCam",pattern:/chromacam/i,confidence:"high"},{id:"facerig",name:"FaceRig",pattern:/facerig/i,confidence:"high"},{id:"avatarify",name:"Avatarify",pattern:/avatarify/i,confidence:"high"},{id:"generic_virtual",name:"Generic virtual camera",pattern:/virtual|\bfake\b|loopback|emulat/i,confidence:"medium"}];function ci(e){const t=(e??"").trim();if(!t)return null;for(const n of Jo)if(n.pattern.test(t))return{id:n.id,name:n.name,confidence:n.confidence};return null}var li=10,ba=120;async function Zo(e){try{const t=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(e));return Array.from(new Uint8Array(t)).map(n=>n.toString(16).padStart(2,"0")).join("").slice(0,32)}catch{return null}}function ar(e){return e.length>ba?e.slice(0,ba):e}function Gs(e){if(!e||typeof e!="object")return null;const{min:t,max:n}=e,s={};return typeof t=="number"&&Number.isFinite(t)&&(s.min=t),typeof n=="number"&&Number.isFinite(n)&&(s.max=n),s.min===void 0&&s.max===void 0?null:s}async function ui(){var e;try{return(e=navigator.mediaDevices)!=null&&e.enumerateDevices?(await navigator.mediaDevices.enumerateDevices()).filter(t=>t.kind==="videoinput"):null}catch{return null}}async function Qo(){const e=await ui();if(!e)return null;const t=e.map(s=>s.label).filter(s=>!!s).slice(0,li).map(ar),n=new Set;for(const s of t){const r=ci(s);r&&n.add(r.id)}return{video_input_count:e.length,labels:t,virtual_label_matches:[...n]}}async function wa(e,t){var n;try{const s=(n=e==null?void 0:e.getVideoTracks)==null?void 0:n.call(e)[0];if(!s)return null;let r=null;try{r=s.getSettings?s.getSettings():null}catch{r=null}let a=null;try{const b=s;a=typeof b.getCapabilities=="function"?b.getCapabilities():null}catch{a=null}const i=(r==null?void 0:r.deviceId)??"",o=i?await Zo(i):null,c=await ui(),d=(c??[]).map(b=>b.label).filter(b=>!!b).slice(0,li).map(ar),f=c&&i?c.some(b=>b.deviceId===i):null,h=typeof s.label=="string"?ar(s.label):null,g=a,x=r;return{schema:1,evidence:"client_reported",surface:t,collected_at:new Date().toISOString(),label:h,device_id_hash:o,settings:x?{width:typeof x.width=="number"?x.width:null,height:typeof x.height=="number"?x.height:null,frameRate:typeof x.frameRate=="number"?x.frameRate:null,facingMode:typeof x.facingMode=="string"&&x.facingMode?x.facingMode:null,resizeMode:typeof x.resizeMode=="string"?x.resizeMode:null,aspectRatio:typeof x.aspectRatio=="number"?x.aspectRatio:null,device_id_hash:o}:null,capabilities:g?{width:Gs(g.width),height:Gs(g.height),frameRate:Gs(g.frameRate),facingMode:Array.isArray(g.facingMode)?g.facingMode.slice(0,8):null,resizeMode:Array.isArray(g.resizeMode)?g.resizeMode.slice(0,8):null}:null,video_input_count:c?c.length:null,video_input_labels:d,selected_in_inventory:f,user_agent:navigator.userAgent,client_virtual_match:ci(h)}}catch{return null}}async function ec(){var s;const e={supports_webgl:tc(),supports_webgl2:nc(),supports_web_audio:typeof AudioContext<"u"||typeof window.webkitAudioContext<"u",supports_webrtc:typeof RTCPeerConnection<"u",supports_media_recorder:typeof MediaRecorder<"u",supports_wasm:typeof WebAssembly<"u",supports_service_worker:"serviceWorker"in navigator,supports_intersection_observer:typeof IntersectionObserver<"u",supports_web_crypto:!!(typeof crypto<"u"&&crypto.subtle),supports_shared_array_buffer:typeof SharedArrayBuffer<"u"},t={camera:"unsupported",microphone:"unsupported",geolocation:"unsupported",notifications:"unsupported"};if(navigator.permissions)for(const r of["camera","microphone","geolocation","notifications"])try{const a=await navigator.permissions.query({name:r});t[r]=a.state}catch{}const n={channel_type:"web",user_agent:navigator.userAgent,webdriver:!!navigator.webdriver,do_not_track:navigator.doNotTrack??null,automation_detected:rc(),cookie_enabled:navigator.cookieEnabled,has_focus:document.hasFocus(),visibility_state:document.visibilityState,hardware_concurrency:navigator.hardwareConcurrency||null,device_memory:navigator.deviceMemory||null,max_touch_points:navigator.maxTouchPoints??null,screen_resolution:`${screen.width}x${screen.height}`,screen_available:`${screen.availWidth}x${screen.availHeight}`,color_depth:screen.colorDepth||null,viewport_size:`${window.innerWidth}x${window.innerHeight}`,device_pixel_ratio:window.devicePixelRatio||1,timezone:null,timezone_offset:new Date().getTimezoneOffset(),language:navigator.language,languages:navigator.languages?[...navigator.languages]:[],canvas_hash:sc(),webgl_vendor:null,webgl_renderer:null,webgl_extensions:[],audio_fingerprint:null,avg_frame_interval_ms:0,frame_timestamps:[],feature_support:e,permissions_state:t,collected_at:new Date().toISOString()};try{n.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone}catch{}try{const r=document.createElement("canvas"),a=r.getContext("webgl2")||r.getContext("webgl")||r.getContext("experimental-webgl");if(a){const i=a,o=i.getExtension("WEBGL_debug_renderer_info");o&&(n.webgl_vendor=i.getParameter(o.UNMASKED_VENDOR_WEBGL)||null,n.webgl_renderer=i.getParameter(o.UNMASKED_RENDERER_WEBGL)||null),n.webgl_extensions=i.getSupportedExtensions()||[]}}catch{}try{n.audio_fingerprint=await ac()}catch{}try{const r=await((s=navigator.getBattery)==null?void 0:s.call(navigator));r&&(n.battery={charging:r.charging,level:r.level})}catch{}try{const r=await Qo();r&&(n.camera_inventory=r)}catch{}try{const r=navigator.connection||navigator.mozConnection||navigator.webkitConnection;r&&(n.connection={effective_type:r.effectiveType||null,downlink:r.downlink??null,rtt:r.rtt??null,save_data:r.saveData??null})}catch{}return console.log(`[UseSense] Collected ${Object.keys(n).length} web integrity signals`),n}function tc(){try{const e=document.createElement("canvas");return!!(e.getContext("webgl")||e.getContext("experimental-webgl"))}catch{return!1}}function nc(){try{return!!document.createElement("canvas").getContext("webgl2")}catch{return!1}}function sc(){try{const e=document.createElement("canvas");e.width=200,e.height=50;const t=e.getContext("2d");if(!t)return 0;t.textBaseline="top",t.font="14px Arial",t.fillStyle="#f60",t.fillRect(125,1,62,20),t.fillStyle="#069",t.fillText("UseSense",2,15),t.fillStyle="rgba(102,204,0,0.7)",t.fillText("UseSense",4,17);const n=e.toDataURL();let s=0;for(let r=0;r<n.length;r++)s=(s<<5)-s+n.charCodeAt(r),s|=0;return s}catch{return 0}}function rc(){try{const e=navigator,t=window,n=document;return!!(e.webdriver||t.domAutomation||t.__nightmare||n.__selenium_unwrapped||t.callPhantom||t._phantom||e.userAgent&&/HeadlessChrome/.test(e.userAgent))}catch{return!1}}async function ac(){try{const e=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!e)return null;const t=new e(1,44100,44100),n=t.createOscillator();n.type="triangle",n.frequency.setValueAtTime(1e4,t.currentTime);const s=t.createDynamicsCompressor();s.threshold.setValueAtTime(-50,t.currentTime),s.knee.setValueAtTime(40,t.currentTime),s.ratio.setValueAtTime(12,t.currentTime),s.attack.setValueAtTime(0,t.currentTime),s.release.setValueAtTime(.25,t.currentTime),n.connect(s),s.connect(t.destination),n.start(0);const a=(await t.startRendering()).getChannelData(0);let i=0;for(let d=4500;d<5e3;d++)i+=Math.abs(a[d]);let o=0;const c=i.toString();for(let d=0;d<c.length;d++)o=(o<<5)-o+c.charCodeAt(d),o|=0;return o}catch{return null}}var di={version:"float16/1",sha256:"64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff",sizeBytes:3758596,sourceUrl:"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",defaultCdnUrl:"https://cdn.usesense.ai/mediapipe/face_landmarker/64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff/face_landmarker.task",versionLabel:"mediapipe_face_landmarker@64184e22"},ic=.3,Ot=[151,50,280,5,13,199],$t=4,vn={baselineFrames:3,lumaLimit:.22,chromaLimit:.035,edgeRatioLimit:2.2,edgeFloor:4,patchOfFaceW:.07,sampleStep:2,confirmFrames:2,veilSettleMs:500},bn=(e,t)=>.299*e[t]+.587*e[t+1]+.114*e[t+2];function oc(e,t,n,s){if(s.length<468)return null;const r=vn,a=Math.abs(s[454].x-s[234].x),i=Math.max(2,Math.floor(r.patchOfFaceW*a)),o=new Float32Array(Ot.length*$t);let c=0;for(let f=0;f<Ot.length;f++){const h=s[Ot[f]],g=Math.floor(h.x),x=Math.floor(h.y),b=Math.max(1,g-i),C=Math.min(t-2,g+i),R=Math.max(1,x-i),T=Math.min(n-2,x+i);if(C<=b||T<=R)return null;let j=0,B=0,K=0,H=0,v=0;for(let D=R;D<=T;D+=r.sampleStep)for(let q=b;q<=C;q+=r.sampleStep){const W=(D*t+q)*4,L=e[W],Ue=e[W+1],fe=e[W+2],ke=Math.max(1,L+Ue+fe);j+=bn(e,W),B+=L/ke,K+=fe/ke,H+=Math.abs(bn(e,W+4)-bn(e,W-4))+Math.abs(bn(e,W+t*4)-bn(e,W-t*4)),v++}if(v===0)return null;o[f*$t]=j/v,o[f*$t+1]=B/v,o[f*$t+2]=K/v,o[f*$t+3]=H/v,c+=j/v}const d=Math.max(1,c/Ot.length);for(let f=0;f<Ot.length;f++)o[f*$t]/=d;return o}var cc=class{constructor(){this.baseline=null,this.frames=0,this.fails=new Uint8Array(Ot.length),this.veil=null,this.holdUntil=-1/0,this.rebaseline=!1,this.lastScore=0,this.lastRegion=-1,this.state="off"}reset(){this.restartBaseline(),this.veil=null,this.holdUntil=-1/0,this.rebaseline=!1}setVeil(e,t){this.veil!==null&&e!==this.veil&&(this.holdUntil=t+vn.veilSettleMs,this.rebaseline=!0),this.veil=e}hold(e){this.holdUntil=Math.max(this.holdUntil,e+vn.veilSettleMs),this.rebaseline=!0}isSettling(e){return e<this.holdUntil}get hasBaseline(){return this.baseline!==null&&this.frames>=vn.baselineFrames}restartBaseline(){this.baseline=null,this.frames=0,this.fails.fill(0),this.lastScore=0,this.lastRegion=-1,this.state="off"}covered(e,t=0,n=!0){if(this.isSettling(t))return this.state="off",!1;this.rebaseline&&(this.rebaseline=!1,this.restartBaseline());const s=vn;if(!this.hasBaseline){if(this.state="off",!e||!n)return this.baseline=null,this.frames=0,!1;const c=this.baseline??(this.baseline=new Float32Array(e.length));for(let d=0;d<e.length;d++)c[d]+=(e[d]-c[d])/(this.frames+1);return this.frames++,this.lastScore=0,!1}if(!n)return this.fails.fill(0),this.state="off",!1;if(!e)return this.state="off",!1;const r=this.baseline;let a=0,i=-1,o=!1;for(let c=0;c<Ot.length;c++){const d=c*$t,f=Math.abs(e[d]-r[d])/s.lumaLimit,h=Math.max(Math.abs(e[d+1]-r[d+1]),Math.abs(e[d+2]-r[d+2]))/s.chromaLimit,g=r[d+3]+s.edgeFloor,x=e[d+3]+s.edgeFloor,b=(Math.max(x/g,g/x)-1)/(s.edgeRatioLimit-1),C=Math.max(f,h,b);C>a&&(a=C,i=c),this.fails[c]=C>=1?Math.min(255,this.fails[c]+1):0,this.fails[c]>=s.confirmFrames&&(o=!0)}return this.lastScore=a,this.lastRegion=i,this.state=o?"covered":"clear",o}};function lc(e){let t=1/0,n=1/0,s=-1/0,r=-1/0;for(let a=0;a<e.length;a++){const i=e[a];i.x<t&&(t=i.x),i.x>s&&(s=i.x),i.y<n&&(n=i.y),i.y>r&&(r=i.y)}return[t,n,s,r]}function uc(e,t){const n=Math.max(0,Math.min(e[2],t[2])-Math.max(e[0],t[0])),s=Math.max(0,Math.min(e[3],t[3])-Math.max(e[1],t[1])),r=n*s,a=(e[2]-e[0])*(e[3]-e[1])+(t[2]-t[0])*(t[3]-t[1])-r;return a<=0?0:r/a}function dc(e,t){if(e.length===0)return 0;const n=Array.from({length:e.length},(r,a)=>lc(e[a]));let s=1;for(let r=0;r<n.length;r++)r!==t&&uc(n[r],n[t])<ic&&s++;return s}var Lt=["face","one_person","covered","distance","in_frame","pose","light","sharpness","eyes","stillness"],Xe={faceStreakFrames:3,ovalSlack:1.15,centredWithin:.08,expectedCentreDropOfRy:.25,distanceMin:.17,distanceMax:.32,distanceHoldMargin:.02,maxYaw:15,maxPitch:15,maxRoll:12,lumMin:70,lumMinToScan:20,lumMax:200,clipLuma:250,clipMaxFraction:.08,minSharpness:12,maxEyeBlink:.6,stillnessWindowMs:300,maxJitter:.04},je={face:"Show your face in the oval",one_person:"Only you in the picture",covered:"Keep your face uncovered",in_frame:"Move your face to the centre",too_far:"Move a little closer",too_close:"Move back a little",pose:"Look straight ahead",too_dark:"Find more light",too_dark_sub:"Face a window or lamp",too_bright:"Too much light behind you",too_bright_sub:"Turn away from the window",sharpness:"Hold your phone steady",eyes:"Keep your eyes open",stillness:"Hold still"},ir={onsetMs:400,minVisibleMs:1200},tn={maxPauseMs:1500,shutterAfterMs:2e4,shutterAfterPausedWindows:3,autoStartMs:2e3,fillLightSettleMs:1500},hc=468,va=473,fc=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109],pc=[1,33,263,152,10],mc=[1,33,263,10],ka=(e,t)=>Math.hypot(e.x-t.x,e.y-t.y),_a=(e,t)=>({x:(e.x+t.x)/2,y:(e.y+t.y)/2});function gc(e){return e.length>va?ka(e[hc],e[va]):e.length<468?0:ka(_a(e[33],e[133]),_a(e[362],e[263]))}var yc=.72;function xc(e){return e.rx*2/yc}function bc(e){return{x:(e[10].x+e[152].x+e[234].x+e[454].x)/4,y:(e[10].y+e[152].y+e[234].y+e[454].y)/4}}function wc(e){return{x:e.cx,y:e.cy+Xe.expectedCentreDropOfRy*e.ry}}function vc(e,t){let n=0;for(const s of e){const r=(s.x-t.cx)/t.rx,a=(s.y-t.cy)/t.ry,i=Math.sqrt(r*r+a*a);i>n&&(n=i)}return n}function cs(e){const t=e[0],n=e[4],s=e[8],r=e[9],a=e[10],i=180/Math.PI,o=Math.sqrt(t*t+n*n);return{yaw:Math.atan2(-s,o)*i,pitch:Math.atan2(r,a)*i,roll:Math.atan2(n,t)*i}}function kc(e,t){const n=Math.floor(e.length/4),s=t&&t.length===n?t:new Float32Array(n);for(let r=0,a=0;a<n;r+=4,a++)s[a]=.299*e[r]+.587*e[r+1]+.114*e[r+2];return s}function _c(e,t,n){const s=t*n;let r=0,a=0;for(let f=0;f<s;f++)r+=e[f],e[f]>=Xe.clipLuma&&a++;let i=0,o=0,c=0;for(let f=1;f<n-1;f++)for(let h=1;h<t-1;h++){const g=f*t+h,x=e[g-1]+e[g+1]+e[g-t]+e[g+t]-4*e[g];i+=x,o+=x*x,c++}const d=c?i/c:0;return{meanLuma:s?r/s:0,clippedFraction:s?a/s:0,sharpness:c?o/c-d*d:0}}var Ma=class{constructor(){this.faceStreak=0,this.samples=[]}reset(){this.faceStreak=0,this.samples=[],this.lastPixels=void 0}evaluate(e,t={}){const n=Xe,s=Object.fromEntries(Lt.map(h=>[h,"unknown"])),r={checks:s,firstFailing:null,firstBlocking:null,allPass:!1,measurements:{}},a=e.screenLandmarks;if(e.faceCount<1||!a||a.length<468)return this.faceStreak=0,this.samples=[],s.face="fail",this.finish(r);this.faceStreak++,s.face=this.faceStreak>=n.faceStreakFrames?"pass":"fail",s.one_person=e.faceCount>1?"fail":"pass",e.covered!==void 0&&(s.covered=e.covered?"fail":"pass");const i=gc(a),o=e.frameWidth??(e.oval?xc(e.oval):0);if(o>0&&i>0){const h=i/o;r.measurements.eyeRatio=h;const g=t.scanning?n.distanceHoldMargin:0;h<n.distanceMin-g?(s.distance="fail",r.distance="too_far"):h>n.distanceMax+g?(s.distance="fail",r.distance="too_close"):s.distance="pass"}if(e.oval){const h=fc.map(x=>a[x]),g=vc(h,e.oval);if(r.measurements.ovalFit=g,g<=n.ovalSlack)s.in_frame="pass";else{s.in_frame="fail";const x=bc(a),b=wc(e.oval),C=Math.max(Math.abs(x.x-b.x)/e.oval.rx,Math.abs(x.y-b.y)/e.oval.ry);r.measurements.centreOffset=C,r.inFrame=C<=n.centredWithin?"too_close":"off_centre"}}if(e.pose){const h=e.pose;r.measurements.pose=h,s.pose=Math.abs(h.yaw)<n.maxYaw&&Math.abs(h.pitch)<n.maxPitch&&Math.abs(h.roll)<n.maxRoll?"pass":"fail"}const c=e.pixels??this.lastPixels;e.pixels&&(this.lastPixels=e.pixels),c&&(r.measurements.meanLuma=c.meanLuma,r.measurements.sharpness=c.sharpness,c.meanLuma<n.lumMin?(s.light="fail",r.light="too_dark"):c.meanLuma>n.lumMax||c.clippedFraction>n.clipMaxFraction?(s.light="fail",r.light="too_bright"):s.light="pass",s.sharpness=c.sharpness>=n.minSharpness?"pass":"fail"),e.eyeBlink&&(s.eyes=e.eyeBlink.left<n.maxEyeBlink&&e.eyeBlink.right<n.maxEyeBlink?"pass":"fail");const d=(t.stillnessAnchors??pc).map(h=>a[h]);for(this.samples.push({t:e.now,pts:d});this.samples.length>2&&e.now-this.samples[1].t>=n.stillnessWindowMs;)this.samples.shift();if(e.now-this.samples[0].t>=n.stillnessWindowMs*.9&&i>0){const h=Ec(this.samples)/i;r.measurements.jitter=h,s.stillness=h<n.maxJitter?"pass":"fail"}else s.stillness="fail";return this.finish(r)}finish(e){return Fn(e)}};function Mc(e){return e.tooDark&&!e.on&&!e.scanning}var Sc={x0:.2,y0:.2,x1:.8,y1:.8},Fc=class{constructor(){this.since=null}update(e){const{faceFound:t,frameLuma:n,scanning:s,now:r}=e;return t||s?(this.since=null,!1):(n!==null&&(n<Xe.lumMin?this.since===null&&(this.since=r):this.since=null),this.since!==null&&r-this.since>=ir.onsetMs)}reset(){this.since=null}};function Rc(e){return!e.dark||e.scanning?null:e.fillLightSettling?"silent":"too_dark"}function hi(e,t){const n=e.measurements.meanLuma;return!t.scanning&&typeof n=="number"&&n<Xe.lumMinToScan}function Cc(e,t){if(!hi(e,t))return e;const n={...e.checks,light:"fail"},s=Lt.find(r=>n[r]==="fail")??null;return{...e,checks:n,light:"too_dark",firstFailing:s,firstBlocking:s,allPass:!1}}var Ac=new Set(["light"]),Tc=["face","stillness","in_frame","distance","pose"];function Sa(e){return Tc.every(t=>e.checks[t]==="pass")}function Fa(e,t){const n=t==="covered"?"fail":t==="clear"?"pass":"unknown";return Fn({...e,checks:{...e.checks,covered:n}})}function jc(e){return Fn(e)}function Fn(e){return e.firstFailing=Lt.find(t=>e.checks[t]==="fail")??null,e.firstBlocking=Lt.find(t=>e.checks[t]==="fail"&&!Ac.has(t))??null,e.allPass=e.firstBlocking===null,e}function Ra(e,t){return!(t.scanning||t.fillLightSettling)||e.checks.light!=="fail"?e:Fn({...e,checks:{...e.checks,light:"unknown"}})}function Ec(e){if(e.length<2)return 0;const t=e[0].pts.length;let n=0;for(let s=0;s<t;s++){let r=0,a=0;for(const o of e)r+=o.pts[s].x,a+=o.pts[s].y;r/=e.length,a/=e.length;let i=0;for(const o of e){const c=Math.hypot(o.pts[s].x-r,o.pts[s].y-a);c>i&&(i=c)}n+=i}return n/t}function Pc(e,t){const n=Xe,s=Object.fromEntries(Lt.map(a=>[a,"unknown"])),r={checks:s,firstFailing:null,firstBlocking:null,allPass:!1,measurements:{}};return e&&(r.measurements.meanLuma=e.meanLuma,r.measurements.sharpness=e.sharpness,e.meanLuma<n.lumMin?(s.light="fail",r.light="too_dark"):e.meanLuma>n.lumMax||e.clippedFraction>n.clipMaxFraction?(s.light="fail",r.light="too_bright"):s.light="pass",s.sharpness=e.sharpness>=n.minSharpness?"pass":"fail"),t!==void 0&&(s.stillness=t>Ic?"fail":"pass"),Fn(r),r}var Ic=8;function Ys(e,t){switch(e){case"face":return{id:"face",text:je.face};case"one_person":return{id:"one_person",text:je.one_person};case"covered":return{id:"covered",text:je.covered};case"in_frame":return t.inFrame==="too_close"?{id:"too_close",text:je.too_close}:{id:"in_frame",text:je.in_frame};case"distance":return t.distance==="too_close"?{id:"too_close",text:je.too_close}:{id:"too_far",text:je.too_far};case"pose":return{id:"pose",text:je.pose};case"light":return t.light==="too_bright"?{id:"too_bright",text:je.too_bright,sub:je.too_bright_sub}:{id:"too_dark",text:je.too_dark,sub:je.too_dark_sub};case"sharpness":return{id:"sharpness",text:je.sharpness};case"eyes":return{id:"eyes",text:je.eyes};case"stillness":return{id:"stillness",text:je.stillness}}}var Ca=class{constructor(e=ir.onsetMs,t=ir.minVisibleMs){this.onsetMs=e,this.minVisibleMs=t,this.failingSince=new Map,this.shown=null}reset(){this.failingSince.clear(),this.shown=null}update(e,t,n){for(const a of Lt)e.checks[a]==="fail"?this.failingSince.has(a)||this.failingSince.set(a,t):this.failingSince.delete(a);const s=Lt.find(a=>{const i=this.failingSince.get(a);return i!==void 0&&t-i>=this.onsetMs});if(this.shown&&t-this.shown.since<this.minVisibleMs)return this.shown.hint;if(!s)return this.shown=null,null;const r=n(s);return!this.shown||this.shown.hint.id!==r.id?this.shown={hint:r,check:s,since:t}:this.shown.hint=r,this.shown.hint}hasSustainedFailure(e){for(const t of this.failingSince.values())if(e-t>=this.onsetMs)return!0;return!1}get visibleCheck(){var e;return((e=this.shown)==null?void 0:e.check)??null}},ut=null,fi=null,as=!1,_n=!1,or=!1;async function Nc(e){if(!(_n||as)&&!or){as=!0;try{console.log("[UseSense] Loading MediaPipe Face Mesh...");const t=await $c(),{FilesetResolver:n,FaceLandmarker:s}=t;fi=Oc(s==null?void 0:s.FACE_LANDMARKS_TESSELATION);const r=await n.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm");ut=await s.createFromOptions(r,{baseOptions:{modelAssetPath:(e==null?void 0:e.mediapipeAssetBaseUrl)??di.defaultCdnUrl,delegate:"GPU"},runningMode:"VIDEO",numFaces:2,minFaceDetectionConfidence:.3,minFacePresenceConfidence:.5,minTrackingConfidence:.5,outputFaceBlendshapes:!0,outputFacialTransformationMatrixes:!0}),_n=!0,console.log("[UseSense] MediaPipe Face Mesh loaded successfully")}catch(t){console.warn("[UseSense] MediaPipe Face Mesh failed to load (graceful degradation):",t.message||t),_n=!1,or=!0}finally{as=!1}}}async function $c(){const e="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs";try{return await new Function("u","return import(u)")(e)}catch{return new Promise((t,n)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.js",s.onload=()=>{const r=window;r.FilesetResolver&&r.FaceLandmarker?t({FilesetResolver:r.FilesetResolver,FaceLandmarker:r.FaceLandmarker}):n(new Error("MediaPipe globals not found after script load"))},s.onerror=()=>n(new Error("Failed to load MediaPipe script")),document.head.appendChild(s)})}}function Oc(e){if(!Array.isArray(e)||e.length<3)return null;const t=[];for(let n=0;n+2<e.length;n+=3){const s=e[n],r=e[n+1];if(typeof(s==null?void 0:s.start)!="number"||typeof(s==null?void 0:s.end)!="number"||typeof(r==null?void 0:r.end)!="number")return null;t.push([s.start,s.end,r.end])}return t.length?t:null}function Lc(){return fi}function Ye(){return _n&&ut!==null}function dr(e){let t=performance.now();return t<=Xs&&(t=Xs+.01),Xs=t,ut.detectForVideo(e,t)}var Xs=0;function hr(e){let t=0,n=-1;for(let s=0;s<e.length;s++){let r=1/0,a=-1/0,i=1/0,o=-1/0;for(const d of e[s])d.x<r&&(r=d.x),d.x>a&&(a=d.x),d.y<i&&(i=d.y),d.y>o&&(o=d.y);const c=(a-r)*(o-i);c>n&&(n=c,t=s)}return t}function Aa(e){var t,n,s,r;if(!Ye()||!ut||!e||e.readyState<2)return null;try{const a=dr(e),i=a.faceLandmarks??[];if(i.length===0)return{faceCount:0};const o=hr(i),c=((n=(t=a.faceBlendshapes)==null?void 0:t[o])==null?void 0:n.categories)??[],d=g=>{var x;return(x=c.find(b=>b.categoryName===g))==null?void 0:x.score},f=d("eyeBlinkLeft"),h=d("eyeBlinkRight");return{faceCount:dc(i,o),landmarks:i[o],matrix:(r=(s=a.facialTransformationMatrixes)==null?void 0:s[o])==null?void 0:r.data,eyeBlink:f!==void 0&&h!==void 0?{left:f,right:h}:void 0}}catch(a){return console.warn("[UseSense] Face tracking error:",a),null}}function Bc(){if(ut){try{const e=ut.close();e&&typeof e.catch=="function"&&e.catch(()=>{})}catch{}ut=null}_n=!1,as=!1,or=!1}function Dc(e){var n,s,r,a;const t={faceDetected:!1,faceCentered:!1,faceDistance:"too_far",faceVisible:!1,message:"Position your face in the oval",ready:!1};if(!Ye()||!ut||!e||e.readyState<2)return t;try{const i=dr(e);if(!i.faceLandmarks||i.faceLandmarks.length===0)return{...t,message:"No face detected"};const o=hr(i.faceLandmarks),c=i.faceLandmarks[o],d=e.videoWidth||640,f=e.videoHeight||480,h=c.map(W=>W.x),g=c.map(W=>W.y),x=Math.min(...h),b=Math.max(...h),C=Math.min(...g),R=Math.max(...g),T=(b-x)*d,j=(R-C)*f;if(T<100)return{faceDetected:!0,faceCentered:!1,faceDistance:"too_far",faceVisible:!0,message:"Move closer",ready:!1};if(T>400)return{faceDetected:!0,faceCentered:!1,faceDistance:"too_close",faceVisible:!0,message:"Move further away",ready:!1};const B=x+(b-x)/2,K=C+(R-C)/2;if(!(Math.abs(B-.5)<.15&&Math.abs(K-.5)<.15))return{faceDetected:!0,faceCentered:!1,faceDistance:"good",faceVisible:!0,message:"Center your face in the oval",ready:!1};const v=((s=(n=i.faceBlendshapes)==null?void 0:n[o])==null?void 0:s.categories)||[],D=((r=v.find(W=>W.categoryName==="eyeBlinkLeft"))==null?void 0:r.score)||0,q=((a=v.find(W=>W.categoryName==="eyeBlinkRight"))==null?void 0:a.score)||0;return D>.7||q>.7?{faceDetected:!0,faceCentered:!0,faceDistance:"good",faceVisible:!0,message:"Please open your eyes",ready:!1}:{faceDetected:!0,faceCentered:!0,faceDistance:"good",faceVisible:!0,message:"Ready",ready:!0}}catch(i){return console.warn("[UseSense] Face guide evaluation error:",i),t}}function fr(e,t,n,s){var r,a,i,o;if(!Ye()||!ut)return null;if(s){if(s.width===0||s.height===0)return null}else if(!e||e.readyState<2)return null;try{const c=Date.now(),d=dr(s??e);if(!d.faceLandmarks||d.faceLandmarks.length===0)return null;const f=hr(d.faceLandmarks),h=d.faceLandmarks[f],g=h.flatMap(D=>[D.x,D.y,D.z]);let x={yaw:0,pitch:0,roll:0};if(d.facialTransformationMatrixes&&d.facialTransformationMatrixes.length>f){const D=d.facialTransformationMatrixes[f].data;x=Uc(D)}else x=zc(h);const b=Ta(h,[33,160,158,133,153,144]),C=Ta(h,[263,387,385,362,380,373]),R=h.map(D=>D.x),T=h.map(D=>D.y),j=Math.min(...R),B=Math.max(...R),K=Math.min(...T),H=Math.max(...T),v={x:j,y:K,w:B-j,h:H-K};return{timestamp:c,frameIndex:t,phase:n,landmarks:g,headPose:x,facialTransformationMatrix:(a=(r=d.facialTransformationMatrixes)==null?void 0:r[f])==null?void 0:a.data,blendshapes:(o=(i=d.faceBlendshapes)==null?void 0:i[f])==null?void 0:o.categories,leftEAR:b,rightEAR:C,bbox:v}}catch(c){return console.warn("[UseSense] Frame signal extraction error:",c),null}}function Uc(e){const t=cs(e),n=s=>{const r=Math.round(s*10)/10;return r===0?0:r};return{yaw:n(t.yaw),pitch:n(t.pitch),roll:n(t.roll)}}function zc(e){const t=e[1],n=e[234],s=e[454],r=e[152],a=e[33],i=e[263],o=t.x-n.x,c=s.x-t.x,d=Math.atan2(o-c,o+c)*(180/Math.PI)*1.5,f=(t.y-r.y)*-180,h=Math.atan2(i.y-a.y,i.x-a.x)*(180/Math.PI);return{yaw:d,pitch:f,roll:h}}function Ta(e,t){try{const[n,s,r,a,i,o]=t,c=e[n],d=e[s],f=e[r],h=e[a],g=e[i],x=e[o];if(!c||!d||!f||!h||!g||!x)return .35;const b=(j,B)=>Math.sqrt((j.x-B.x)**2+(j.y-B.y)**2),C=b(d,x),R=b(f,g),T=b(c,h);return T<.001?.35:(C+R)/(2*T)}catch{return .35}}function Hc(e){if(e.length<1404)return null;const t=Wc(e),n=Vc(e),s=qc(e),r=Gc(e),a=Yc(e);return{shapeParams:n,pose:t,depthPlausibility:a,geometricRatios:s,poseRatios2D:r}}function Wc(e){const t=[e[3],e[4],e[5]],n=[e[234*3],e[234*3+1],e[234*3+2]],s=[e[454*3],e[454*3+1],e[454*3+2]],r=[e[152*3],e[152*3+1],e[152*3+2]],a=[e[33*3],e[33*3+1],e[33*3+2]],i=[e[263*3],e[263*3+1],e[263*3+2]],o=t[0]-n[0],c=s[0]-t[0],d=Math.atan2(o-c,o+c)*(180/Math.PI)*1.5,f=(t[1]-r[1])*-180,h=Math.atan2(i[1]-a[1],i[0]-a[0])*(180/Math.PI);return{yaw:d,pitch:f,roll:h}}function Vc(e){const n=[[33,263],[1,152],[33,133],[263,362],[61,291],[0,17],[234,454],[10,152],[33,1],[263,1],[33,61],[263,291]].map(([r,a])=>{const i=e[r*3],o=e[r*3+1],c=e[r*3+2],d=e[a*3],f=e[a*3+1],h=e[a*3+2];return Math.sqrt((d-i)**2+(f-o)**2+(h-c)**2)}),s=n[0]||1;return n.map(r=>r/s)}function qc(e){const t=(s,r)=>{const a=e[s*3],i=e[s*3+1],o=e[s*3+2],c=e[r*3],d=e[r*3+1],f=e[r*3+2];return Math.sqrt((c-a)**2+(d-i)**2+(f-o)**2)},n=t(33,263)||1;return[n,t(1,152)/n,t(234,454)/n,t(61,291)/n,t(10,152)/n,t(33,1)/n]}function Gc(e){const t=[e[3],e[4]],n=[e[33*3],e[33*3+1]],s=[e[152*3],e[152*3+1]],r=[e[263*3],e[263*3+1]],a=[e[10*3],e[10*3+1]],i=Math.abs(s[1]-a[1])||1,o=Math.abs(r[0]-n[0])||1;return[(t[1]-n[1])/i,(t[0]-n[0])/o,(r[1]-n[1])/i,(s[0]-t[0])/o,o/i]}function Yc(e){const t=[];for(let a=2;a<e.length;a+=3)t.push(e[a]);const n=t.reduce((a,i)=>a+i,0)/t.length,s=t.reduce((a,i)=>a+(i-n)**2,0)/t.length,r=Math.sqrt(s);return Math.min(100,Math.round(r*1e3))}function Xc(e){const t=e.filter(o=>o.shapeParams.length>0);if(t.length<2)return null;const n=[];for(let o=0;o<t.length;o++)for(let c=o+1;c<t.length;c++){const d=t[o].shapeParams,f=t[c].shapeParams;let h=0;for(let g=0;g<Math.min(d.length,f.length);g++)h+=((d[g]??0)-(f[g]??0))**2;n.push(Math.sqrt(h))}const s=n.reduce((o,c)=>o+c,0)/n.length,r=t.map(o=>{let c=0;for(const d of o.shapeParams)c+=d*d;return Math.sqrt(c)}),a=r.reduce((o,c)=>o+c,0)/r.length,i=a>.001?s/a:0;return Math.max(0,Math.min(100,Math.round(100-i/.5*100)))}function Kc(e,t){if(e.length===0)return 0;const n=e.reduce((s,r)=>s+r.depthPlausibility,0)/e.length;return Math.round(t===null?n:n*.6+t*.4)}var ue={oval:{cx:.5,cy:.4,rxOfW:.36,ryOfH:.235},guide:{fill:he.ovalFill,stroke:he.ovalStroke,width:2},ring:{track:he.ringTrack,width:3,gap:6},lines:{spacing:7,width:1,sampleStep:3,top:0,bottomOfH:.84,fadeOfH:.14,ampOfFaceH:.16,flatAlpha:.5,peakAlpha:.95},depth:{grid:96,splatSigma:2.6,blurSigma:1.8,emaAlpha:.3,feather:.35,meshWeight:.8},dome:{rxOfFaceW:.62,ryOfFaceH:.78,cyShiftOfFaceH:-.12,height:.62,feather:.18},relief:{grid:64,bumpRxOfFaceW:.58,bumpRyOfFaceH:.65,bumpRyUpOfFaceH:.85,bumpCyShiftOfFaceH:.05,blurSigma:.9,detailSigma:2.5,detailLiftOfRy:.12,fillSigma:3,edgeSigma:2,edgeLo:.15,edgeHi:.95,ampUp:.5,ampDown:.32,tanhOfRy:.25,minGap:2.5,packedAlphaFloor:.25,alpha:.9,width:1.3,spacing:9,cameraBlurAfterMs:1500,cameraBlurPx:18},sweep:{durationMs:520,lineFadeMs:140},feedDimDuringScan:.12,faceHoldMs:300,fillLight:{color:he.fillLight}};function pi(e,t){return Math.min(e,t*390/844)}var Jc=1.4;function Zc(e,t){const n=pi(e,t);if(!(n>0))return 1;const s=Math.max(0,Math.min(1,(e/n-1)/.3));return 1+(Jc-1)*s}function Mn(e,t){const n=ue.oval,s=Zc(e,t);return{cx:e*n.cx,cy:t*n.cy,rx:pi(e,t)*n.rxOfW*s,ry:t*n.ryOfH*s}}function Qc(e,t){const n=Mn(e,t),s=n.cy+n.ry+28,r=Math.min(t-44,Math.max(t*.85,s+64+40));return{guidanceTop:s,shutterY:r}}var cr=(e,t,n)=>{const s=Math.min(1,Math.max(0,(n-e)/(t-e)));return s*s*(3-2*s)};function nn(e,t,n,s){const r=Math.ceil(s*2.5),a=[];let i=0;for(let d=-r;d<=r;d++){const f=Math.exp(-(d*d)/(2*s*s));a.push(f),i+=f}for(let d=0;d<a.length;d++)a[d]/=i;const o=new Float32Array(e.length),c=new Float32Array(e.length);for(let d=0;d<n;d++){const f=d*t;for(let h=0;h<t;h++){let g=0;for(let x=-r;x<=r;x++)g+=e[f+Math.min(t-1,Math.max(0,h+x))]*a[x+r];o[f+h]=g}}for(let d=0;d<n;d++)for(let f=0;f<t;f++){let h=0;for(let g=-r;g<=r;g++)h+=o[Math.min(n-1,Math.max(0,d+g))*t+f]*a[g+r];c[d*t+f]=h}return c}function el(e,t,n,s){const r=ue.depth,a=t*n,i=new Float32Array(a),o=new Float32Array(a);let c=1/0,d=-1/0;for(const L of e)L.z<c&&(c=L.z),L.z>d&&(d=L.z);const f=Math.max(1e-6,d-c),h=r.splatSigma,g=Math.ceil(h*2.5),x=1/(2*h*h);for(const L of e){const Ue=(d-L.z)/f,fe=L.x/s,ke=L.y/s,Ee=Math.round(fe),_e=Math.round(ke);for(let k=_e-g;k<=_e+g;k++)if(!(k<0||k>=n))for(let z=Ee-g;z<=Ee+g;z++){if(z<0||z>=t)continue;const Pe=Math.exp(-((z-fe)**2+(k-ke)**2)*x),ze=k*t+z;i[ze]+=Pe*Ue,o[ze]+=Pe}}let b=new Float32Array(a);for(let L=0;L<a;L++)b[L]=o[L]>1e-6?i[L]/o[L]*cr(0,r.feather,o[L]):0;b=nn(b,t,n,r.blurSigma);const C=e[10],R=e[152],T=e[234],j=e[454],B=Math.hypot(R.x-C.x,R.y-C.y),K=Math.abs(j.x-T.x),H=ue.dome,v=(C.x+R.x)/2,D=(C.y+R.y)/2+H.cyShiftOfFaceH*B,q=Math.max(1,H.rxOfFaceW*K),W=Math.max(1,H.ryOfFaceH*B);for(let L=0;L<n;L++){const Ue=(L+.5)*s;for(let fe=0;fe<t;fe++){const Ee=(((fe+.5)*s-v)/q)**2+((Ue-D)/W)**2,_e=Ee<1?Math.pow(1-Ee,.75)*H.height*cr(1,1-H.feather,Math.sqrt(Ee)):0,k=L*t+fe;b[k]=Math.min(1,_e+b[k]*r.meshWeight)}}return{field:b,faceH:B}}function tl(e,t,n,s,r,a,i=new Float32Array(t.length)){const o=ue.relief,c=Math.tanh((e-s)/Math.max(1e-6,o.tanhOfRy*r)),d=(c<0?o.ampUp:o.ampDown)*r*c,f=o.detailLiftOfRy*r;for(let h=0;h<t.length;h++)i[h]=Math.max(e+d*t[h]-f*n[h],a[h]+o.minGap);return i}function nl(e){const t=ue.relief;return t.packedAlphaFloor+(1-t.packedAlphaFloor)*Math.min(1,Math.max(0,e/t.spacing))}var ja=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];function sl(e,t,n,s,r){const a=ue.relief,i=n*s,o=new Float32Array(i),c=new Float32Array(i);let d=1/0,f=0;for(let z=0;z<468;z++)e[z].z<d&&(d=e[z].z);for(const z of ja)f+=e[z].z;f/=ja.length;const h=Math.max(1e-6,f-d),g=e.map(z=>[z.x/r,z.y/r,Math.max(0,(f-z.z)/h)]);for(const[z,Pe,ze]of t){const de=g[z],xe=g[Pe],re=g[ze];if(!de||!xe||!re)continue;const Me=Math.max(0,Math.floor(Math.min(de[0],xe[0],re[0]))),dt=Math.min(n-1,Math.ceil(Math.max(de[0],xe[0],re[0]))),ht=Math.max(0,Math.floor(Math.min(de[1],xe[1],re[1]))),He=Math.min(s-1,Math.ceil(Math.max(de[1],xe[1],re[1]))),E=(xe[1]-re[1])*(de[0]-re[0])+(re[0]-xe[0])*(de[1]-re[1]);if(!(Math.abs(E)<1e-9))for(let P=ht;P<=He;P++)for(let ie=Me;ie<=dt;ie++){const Oe=ie+.5,Ie=P+.5,Le=((xe[1]-re[1])*(Oe-re[0])+(re[0]-xe[0])*(Ie-re[1]))/E,at=((re[1]-de[1])*(Oe-re[0])+(de[0]-re[0])*(Ie-re[1]))/E,ft=1-Le-at;if(Le<-.02||at<-.02||ft<-.02)continue;const it=Le*de[2]+at*xe[2]+ft*re[2],Be=P*n+ie;(it>o[Be]||c[Be]===0)&&(o[Be]=it),c[Be]=1}}const x=n/130,b=z=>Math.max(.3,z*x),C=new Float32Array(i);for(let z=0;z<i;z++)C[z]=o[z]*c[z];const R=nn(C,n,s,b(a.fillSigma)),T=nn(c,n,s,b(a.fillSigma)),j=nn(c,n,s,b(a.edgeSigma)),B=new Float32Array(i);for(let z=0;z<i;z++){const Pe=c[z]?o[z]:T[z]>1e-4?R[z]/T[z]:0;B[z]=Pe*cr(a.edgeLo,a.edgeHi,j[z])}const K=nn(B,n,s,b(a.detailSigma)),H=e[10],v=e[152],D=e[234],q=e[454],W=Math.hypot(v.x-H.x,v.y-H.y),L=Math.abs(q.x-D.x),Ue=(H.x+v.x)/2,fe=(H.y+v.y)/2+a.bumpCyShiftOfFaceH*W,ke=Math.max(1,a.bumpRxOfFaceW*L),Ee=Math.max(1,a.bumpRyOfFaceH*W),_e=Math.max(1,a.bumpRyUpOfFaceH*W);let k=new Float32Array(i);for(let z=0;z<s;z++){const Pe=(z+.5)*r,ze=Pe<fe?_e:Ee;for(let de=0;de<n;de++){const re=(((de+.5)*r-Ue)/ke)**2+((Pe-fe)/ze)**2;k[z*n+de]=re<1?(1-re)*(1-re):0}}return k=nn(k,n,s,b(a.blurSigma)),{field:k,detail:K,faceH:W,cy:fe,ry:Ee}}function rl(e){let t=e.replace("#","");t.length===3&&(t=t.split("").map(s=>s+s).join(""));const n=parseInt(t,16);return[n>>16&255,n>>8&255,n&255]}var al=(()=>{const e=he.cameraBackground.slice(1);return`rgba(${parseInt(e.slice(0,2),16)},${parseInt(e.slice(2,4),16)},${parseInt(e.slice(4,6),16)},${ue.feedDimDuringScan})`})(),Ks=24,il=class{constructor(e,t,n){this.canvas=e,this.colors=t,this.reducedMotion=n,this.W=0,this.H=0,this.dpr=1,this.cols=0,this.rows=0,this.cell=1,this.field=new Float32Array(0),this.detail=new Float32Array(0),this.faceH=0,this.hasFace=!1,this.lastFaceAt=-1/0,this.sweepStart=0,this.styles=[],this.tris=null,this.bumpCy=0,this.bumpRy=0,this.setColors(t)}get target(){return this.canvas}setColors(e){this.colors=e;const t=rl(e.ring),n=t,s=ue.lines;this.styles=[];for(let r=0;r<Ks;r++){const a=r/(Ks-1),i=t.map((c,d)=>Math.round(c+(n[d]-c)*a)),o=s.flatAlpha+(s.peakAlpha-s.flatAlpha)*a;this.styles.push(`rgba(${i[0]},${i[1]},${i[2]},${o.toFixed(3)})`)}}fit(){const e=this.canvas,t=e.clientWidth,n=e.clientHeight;if(!t||!n)return null;const s=Math.min(3,typeof window<"u"&&window.devicePixelRatio||1);(t!==this.W||n!==this.H||s!==this.dpr)&&(this.W=t,this.H=n,this.dpr=s,e.width=Math.round(t*s),e.height=Math.round(n*s),this.cols=this.tris?ue.relief.grid:ue.depth.grid,this.rows=Math.max(1,Math.round(this.cols*n/t)),this.cell=t/this.cols,this.field=new Float32Array(this.cols*this.rows),this.detail=new Float32Array(this.cols*this.rows),this.hasFace=!1);const r=e.getContext("2d");return r?(r.setTransform(s,0,0,s,0,0),r):null}setTriangles(e){e!==this.tris&&(this.tris=e,this.W=0)}startSweep(e){this.sweepStart=e}revealAll(){this.sweepStart=-1e9}update(e,t,n=ue.depth.emaAlpha){if(!this.fit())return;if(!e||e.length<468){if(t-this.lastFaceAt>ue.faceHoldMs)for(let a=0;a<this.field.length;a++)this.field[a]*=1-n,this.detail[a]*=1-n;return}const s=this.hasFace?this.reducedMotion?Math.min(n,.12):n:1;let r;if(this.tris){const a=sl(e,this.tris,this.cols,this.rows,this.cell);r=a.field;for(let i=0;i<a.detail.length;i++)this.detail[i]+=(a.detail[i]-this.detail[i])*s;this.faceH=a.faceH,this.bumpCy+=(a.cy-this.bumpCy)*s,this.bumpRy+=(a.ry-this.bumpRy)*s}else{const a=el(e,this.cols,this.rows,this.cell);r=a.field,this.faceH=a.faceH}for(let a=0;a<r.length;a++)this.field[a]+=(r[a]-this.field[a])*s;this.hasFace=!0,this.lastFaceAt=t}sample(e,t,n=this.field){const s=e/this.cell,r=t/this.cell,a=Math.floor(s),i=Math.floor(r),o=s-a,c=r-i,d=this.cols,f=this.rows,h=(g,x)=>g<0||x<0||g>=d||x>=f?0:n[x*d+g];return h(a,i)*(1-o)*(1-c)+h(a+1,i)*o*(1-c)+h(a,i+1)*(1-o)*c+h(a+1,i+1)*o*c}clear(){const e=this.fit();e&&e.clearRect(0,0,this.W,this.H)}draw(e){const t=this.fit();if(!t)return;const{W:n,H:s}=this;if(t.clearRect(0,0,n,s),e.mode==="none")return;const r=Mn(n,s);if(e.fill&&(t.fillStyle=ue.fillLight.color,t.fillRect(0,0,n,s)),e.mode==="align"){const a=ue.guide;t.beginPath(),t.ellipse(r.cx,r.cy,r.rx,r.ry,0,0,Math.PI*2),t.fillStyle=a.fill,t.fill(),t.lineWidth=a.width,t.strokeStyle=e.warn?this.colors.warning:a.stroke,t.stroke();return}if(t.fillStyle=al,t.fillRect(0,0,n,s),e.mode==="challenge"){if(e.paused){const a=ue.ring;t.lineWidth=a.width,t.strokeStyle=this.colors.warning,t.globalAlpha=.45,t.beginPath(),t.ellipse(r.cx,r.cy,r.rx+a.gap,r.ry+a.gap,0,0,Math.PI*2),t.stroke(),t.globalAlpha=1}this.drawRing(t,r,e.progress??0,!!e.paused,e.ringColor);return}if(this.hasFace){const a=this.reducedMotion?1e9:e.now-this.sweepStart;this.tris?this.drawRelief(t,a):this.drawLines(t,a)}e.mode==="scan"&&this.drawRing(t,r,e.progress??0,!!e.paused)}drawLines(e,t){const n=ue.lines,s=ue.sweep,{W:r,H:a}=this,i=n.ampOfFaceH*this.faceH,o=a*n.bottomOfH,c=o-a*n.fadeOfH,d=Math.floor((o-n.top)/n.spacing);e.lineWidth=n.width,e.lineCap="round",e.lineJoin="round";for(let f=0;f<=d;f++){const h=n.top+f*n.spacing,g=f/d*s.durationMs,x=Math.min(1,Math.max(0,(t-g)/s.lineFadeMs));if(x<=0)continue;const b=h>c?1-(h-c)/(o-c):1,C=x*b;if(C<=.002)continue;e.globalAlpha=C;let R=this.sample(0,h),T=0,j=h-R*i,B=-1;for(let K=n.sampleStep;K<=r+n.sampleStep;K+=n.sampleStep){const H=this.sample(K,h),v=h-H*i,D=Math.min(1,(H+R)/2),q=Math.round(D*(Ks-1));q!==B&&(B>=0&&e.stroke(),B=q,e.strokeStyle=this.styles[q],e.beginPath(),e.moveTo(T,j)),e.lineTo(K,v),T=K,j=v,R=H}B>=0&&e.stroke()}e.globalAlpha=1}drawRelief(e,t){const n=ue.lines,s=ue.relief,r=ue.sweep,{W:a,H:i}=this,o=i*n.bottomOfH,c=o-i*n.fadeOfH,d=Math.floor((o-n.top)/s.spacing),f=Math.ceil(a/n.sampleStep)+2;let h=new Float32Array(f).fill(-1e9),g=new Float32Array(f);const x=new Float32Array(f),b=new Float32Array(f),C=new Float32Array(f);e.lineWidth=s.width,e.lineCap="round",e.lineJoin="round",e.strokeStyle=this.colors.ring;for(let R=0;R<=d;R++){const T=n.top+R*s.spacing,j=R/d*r.durationMs,B=Math.min(1,Math.max(0,(t-j)/r.lineFadeMs)),K=T>c?1-(T-c)/(o-c):1;for(let D=0;D<f;D++){const q=D*n.sampleStep;x[D]=this.sample(q,T),b[D]=this.sample(q,T,this.detail)}tl(T,x,b,this.bumpCy,this.bumpRy,h,g);const H=s.alpha*B*K;if(H>.002){for(let D=1;D<f;D++)C[D]=Math.round(20*nl(Math.min(g[D-1]-h[D-1],g[D]-h[D])))/20;for(let D=1;D<f;){const q=C[D];let W=D;for(;W+1<f&&C[W+1]===q;)W++;e.globalAlpha=H*q,e.beginPath(),e.moveTo((D-1)*n.sampleStep,g[D-1]);for(let L=D;L<=W;L++)e.lineTo(L*n.sampleStep,g[L]);e.stroke(),D=W+1}}const v=h;h=g,g=v}e.globalAlpha=1}drawRing(e,t,n,s,r){const a=ue.ring;e.lineWidth=a.width,e.lineCap="round",e.strokeStyle=a.track,e.beginPath(),e.ellipse(t.cx,t.cy,t.rx+a.gap,t.ry+a.gap,0,0,Math.PI*2),e.stroke();const i=Math.max(0,Math.min(1,n));i<=0||(e.strokeStyle=s?this.colors.warning:r??this.colors.ring,e.beginPath(),e.ellipse(t.cx,t.cy,t.rx+a.gap,t.ry+a.gap,0,-Math.PI/2,-Math.PI/2+i*Math.PI*2),e.stroke())}};Nt(st.challenge,.16);function ol(e,t,n=Bt){return n.sheetBody(e,e==="head_turn"?(t??[]).map(s=>s.direction):void 0)}function cl(e,t,n=Bt){return n.headTurn(e,t)}function ll(e,t=Bt){return t.turnFurther(e)}var rt={doneMs:900,quietMs:2e3,lostAfterMs:300,foundAfterMs:150,holdAtTargetMs:600,hintAfterMs:4e3,missedNoticeMs:1200,dotGlideMs:600,dotSettleMs:500},mi={turnYaw:15,turnPitch:12,centreTolerance:10,dotYaw:10,dotPitch:8,dotCentreBand:.1},Sn={leftYaw:-1,upPitch:1},ul=2;function dl(e,t,n=2){const s=Math.max(0,e);return t<=0?s:Math.max(Math.min(n,s),Math.floor(s/t))}function Ea(e,t,n){const s=mi;switch(e){case"left":case"right":{if(t==null)return null;const r=t*Sn.leftYaw;return e==="left"?r>=s.turnYaw:-r>=s.turnYaw}case"up":case"down":{if(n==null)return null;const r=n*Sn.upPitch;return e==="up"?r>=s.turnPitch:-r>=s.turnPitch}default:return t==null||n==null?null:Math.abs(t)<s.centreTolerance&&Math.abs(n)<s.centreTolerance}}function hl(e,t,n,s,r,a){if(n==null||s==null)return null;const i=mi,o=e.x-t.x,c=t.y-e.y,d=(n-r)*1,f=(s-a)*Sn.upPitch,h=o>0?d:-d,g=c>0?f:-f,x=Math.abs(o)>i.dotCentreBand,b=Math.abs(c)>i.dotCentreBand;return!x&&!b?!0:x&&(!b||Math.abs(o)>=Math.abs(c))?h>=i.dotYaw&&(!b||g>-10):g>=i.dotPitch&&(!x||h>-10)}var fl=4;function pl(e,t,n,s,r){const a=(t-s)*Sn.leftYaw,i=(n-r)*Sn.upPitch;if(e.kind==="head_turn")switch(e.direction){case"left":return a;case"right":return-a;case"up":return i;case"down":return-i;default:return Math.hypot(s,r)-Math.hypot(t,n)}const o=e.wp.x-e.prev.x,c=e.prev.y-e.wp.y;return o===0&&c===0?null:Math.abs(o)>=Math.abs(c)?o>0?-a:a:c>0?i:-i}var Pa=class{constructor(e,t=1,n=Bt){this.plan=e,this.strings=n,this.stepIndex=0,this.finished=!1,this.retrying=!1,this.stepLog=[],this.stepElapsed=0,this.stepAge=0,this.atTarget=0,this.poseSeen=!1,this.stepPromptedAt=null,this.stepReachedAt=null,this.stepHinted=!1,this.lastAtTarget=null,this.reachedSteps=0,this.missedUntil=null,this.refYaw=0,this.refPitch=0,this.lastYaw=null,this.lastPitch=null,this.lastTime=null,this.present=!1,this.everPresent=!1,this.absentFor=0,this.presentFor=0,this.lastHint=null,this.movePrompt=null,this.moveFirst=null,this.moveMaxAway=0,this.framePose=null,this.retriesLeft=t}get stepCount(){return this.plan.kind==="head_turn"?this.plan.steps.length:this.plan.waypoints.length}durationMs(e){var n;const t=this.plan.kind==="head_turn"?this.plan.steps:this.plan.waypoints;return Math.max(200,((n=t[Math.min(e,t.length-1)])==null?void 0:n.duration_ms)??200)}get specStepIndex(){var t;const e=this.plan.kind==="head_turn"?this.plan.steps:this.plan.waypoints;return((t=e[Math.min(this.stepIndex,e.length-1)])==null?void 0:t.index)??0}get direction(){var e;return this.plan.kind==="head_turn"?((e=this.plan.steps[Math.min(this.stepIndex,this.plan.steps.length-1)])==null?void 0:e.direction)??null:null}get bankReason(){return this.finished||(this.lastAtTarget??!0)?"on_target":this.plan.kind==="follow_dot"&&this.stepAge>=this.dotGlideMs(this.stepIndex)+rt.dotSettleMs?"settled":"none"}dotGlideMs(e){return Math.min(rt.dotGlideMs,this.durationMs(e)*.4)}advance(e){const t=this.lastTime===null?0:Math.min(250,Math.max(0,e.now-this.lastTime));if(this.lastTime=e.now,this.stepPromptedAt===null&&(this.present||e.faceOk)&&!this.finished&&(this.stepPromptedAt=e.now),this.updatePresence(e.faceOk,t),(e.hint||e.faceOk)&&(this.lastHint=e.hint??null),this.framePose=e.yaw!=null&&e.pitch!=null?{yaw:e.yaw,pitch:e.pitch}:null,!this.finished&&!e.held&&this.stepPromptedAt!==null&&this.trackMove(e.now),this.present&&!e.held&&!this.finished)if(this.stepElapsed+=t,this.stepAge+=t,this.plan.kind==="head_turn"){const s=this.plan.steps[this.stepIndex];this.advanceTargeted(s.duration_ms,Ea(s.direction,e.yaw,e.pitch),t)}else{const s=this.plan.waypoints,r=s[this.stepIndex];e.yaw!=null&&e.pitch!=null&&(this.lastYaw=e.yaw,this.lastPitch=e.pitch);const a=this.stepAge>=this.dotGlideMs(this.stepIndex),i=this.stepIndex===0?Ea("center",e.yaw,e.pitch):hl(r,s[this.stepIndex-1],e.yaw,e.pitch,this.refYaw,this.refPitch);this.advanceTargeted(r.duration_ms,i===null?null:i&&a,t)}return this.display()}moveTarget(){return this.plan.kind==="head_turn"?{kind:"head_turn",direction:this.plan.steps[this.stepIndex].direction}:this.stepIndex===0?null:{kind:"follow_dot",wp:this.plan.waypoints[this.stepIndex],prev:this.plan.waypoints[this.stepIndex-1]}}trackMove(e){const t=this.framePose;if(!t)return;if(!this.movePrompt){this.movePrompt=t;return}const n=this.moveTarget();if(!n)return;const s=pl(n,t.yaw,t.pitch,this.movePrompt.yaw,this.movePrompt.pitch);s!==null&&(-s>this.moveMaxAway&&(this.moveMaxAway=-s),!this.moveFirst&&Math.hypot(t.yaw-this.movePrompt.yaw,t.pitch-this.movePrompt.pitch)>fl&&(this.moveFirst={deg:s,at:e}))}advanceTargeted(e,t,n){const s=Math.max(200,e);if(this.lastAtTarget=t,t===null){!this.poseSeen&&this.stepElapsed>=s&&this.endStep(null);return}if(this.poseSeen=!0,t&&this.atTarget===0&&(this.stepReachedAt=this.lastTime),this.atTarget=t?this.atTarget+n:0,t||(this.stepReachedAt=null),this.atTarget>=rt.holdAtTargetMs){this.endStep(!0);return}this.stepElapsed>=Math.max(rt.hintAfterMs,s)&&(!this.retrying&&this.retriesLeft>0?(this.retriesLeft--,this.retrying=!0,this.stepHinted=!0,this.stepElapsed=0):this.endStep(!1))}updatePresence(e,t){e?(this.presentFor+=t,this.absentFor=0,!this.present&&(!this.everPresent||this.presentFor>=rt.foundAfterMs)&&(this.present=!0,this.everPresent=!0)):(this.absentFor+=t,this.presentFor=0,this.present&&this.absentFor>=rt.lostAfterMs&&(this.present=!1))}endStep(e){var r;e!==!1&&this.reachedSteps++;const t=this.lastTime??0;this.missedUntil=e===!1?t+rt.missedNoticeMs:null;const n=this.stepPromptedAt??t,s=this.movePrompt!==null&&this.moveTarget()!==null;this.stepLog.push({index:this.specStepIndex,promptedAt:n,endedAt:t,reachedAt:e===!0?this.stepReachedAt:null,reached:e,hinted:this.stepHinted,...s?{firstMoveDeg:((r=this.moveFirst)==null?void 0:r.deg)??null,firstMoveAt:this.moveFirst?this.moveFirst.at-n:null,maxAwayDeg:this.moveMaxAway}:{}}),this.movePrompt=this.framePose,this.moveFirst=null,this.moveMaxAway=0,this.stepPromptedAt=t,this.stepReachedAt=null,this.stepHinted=!1,this.lastAtTarget=null,this.retrying=!1,this.plan.kind==="follow_dot"&&this.lastYaw!==null&&this.lastPitch!==null&&(this.refYaw=this.lastYaw,this.refPitch=this.lastPitch),this.stepIndex++,this.stepElapsed=0,this.stepAge=0,this.atTarget=0,this.poseSeen=!1,this.stepIndex>=this.stepCount&&(this.finished=!0,this.stepIndex=this.stepCount-1)}get progress(){return this.finished&&this.reachedSteps>=this.stepCount?1:Math.min(1,(this.reachedSteps+Math.min(1,this.atTarget/rt.holdAtTargetMs))/Math.max(1,this.stepCount))}get missedNoticeShowing(){return this.missedUntil!==null&&this.lastTime!==null&&!this.finished&&this.lastTime<this.missedUntil}display(){var g,x;const e=this.strings,t={done:e.t("extraCheck","done"),showFace:e.t("guidance","showFace"),nextOne:e.t("extraCheck","tryNext"),retry:e.t("extraCheck","tryAgain"),pointAtDot:e.t("extraCheck","towardDot"),dotFirst:e.t("extraCheck","followDot"),dotNext:e.t("extraCheck","keepFollowing"),headPaused:{text:e.t("guidance","centre"),sub:e.t("extraCheck","pausedTurn")},dotPaused:{text:e.t("guidance","showFace"),sub:e.t("extraCheck","pausedDot")}},n=this.everPresent&&!this.present&&!this.finished,s={progress:this.progress,warning:!1,paused:n,finished:this.finished,arrow:null,dot:null,trail:[]};if(this.plan.kind==="head_turn"){const b=this.plan.steps,C=b[Math.min(this.stepIndex,b.length-1)],R={kind:"head_turn",...s,text:""};if(this.finished)return R.text=t.done,R;if(!this.everPresent)R.text=t.showFace;else if(n)R.warning=!0,R.text=((g=this.lastHint)==null?void 0:g.text)??t.headPaused.text,R.sub=e.pausedTurn(C.direction);else if(this.missedNoticeShowing)R.warning=!0,R.text=t.nextOne;else if(this.retrying)R.text=t.retry,R.sub=ll(C.direction,e),R.arrow=C.direction==="center"?null:C.direction;else{const T=b.slice(0,this.stepIndex).every(B=>B.direction==="center"),j=cl(C.direction,T,e);R.text=j.text,R.sub=j.sub,R.arrow=C.direction==="center"?null:C.direction}return R}const r=this.plan.waypoints.map(b=>({x:b.x,y:b.y})),a=Math.min(this.stepIndex,r.length-1),i=a===0?r[0]:r[a-1],o=this.dotGlideMs(a),c=o>0?Math.min(1,this.stepAge/o):1,d=c*c*(3-2*c),f=this.finished?r[a]:{x:i.x+(r[a].x-i.x)*d,y:i.y+(r[a].y-i.y)*d},h={kind:"follow_dot",...s,dot:f,trail:[...r.slice(0,a),f],text:""};return this.finished?(h.text=t.done,h):(this.everPresent?n?(h.warning=!0,h.text=((x=this.lastHint)==null?void 0:x.text)??t.dotPaused.text,h.sub=t.dotPaused.sub):this.missedNoticeShowing?(h.warning=!0,h.text=t.nextOne):this.retrying?(h.text=t.retry,h.sub=t.pointAtDot):h.text=this.stepIndex*2<r.length?t.dotFirst:t.dotNext:h.text=t.showFace,h)}stepEvents(e){const t=n=>Math.round(n+e);return this.stepLog.map(n=>({index:n.index,prompted_at_ms:t(n.promptedAt),ended_at_ms:t(n.endedAt),hinted:n.hinted,...n.reachedAt!==null?{reached_at_ms:t(n.reachedAt),reaction_ms:Math.round(n.reachedAt-n.promptedAt)}:{},outcome:n.reached===null?"timed":n.reached?"reached":"timed_out",...n.firstMoveDeg!=null&&n.firstMoveAt!=null?{first_move_deg:Ia(n.firstMoveDeg),first_move_ms:Math.round(n.firstMoveAt)}:{},...n.maxAwayDeg!==void 0?{max_away_deg:Ia(n.maxAwayDeg)}:{}}))}},Ia=e=>Math.round(e*10)/10,ml=.04,gl=class{constructor(e=rt.quietMs,t=ml){this.windowMs=e,this.threshold=t,this.loudAt=null}update(e,t){return this.loudAt===null&&(this.loudAt=t),e>=this.threshold&&(this.loudAt=t),t-this.loudAt>=this.windowMs}};function Na(e,t=9,n=4,s=34){const r=[];for(let a=0;a<t;a++){const i=e[e.length-t+a]??0,o=Math.max(0,Math.min(1,i/.25));r.push(Math.round(n+(s-n)*o))}return r}function yl(e){const t=e.replace(/\s+/g,"");return/^\d+$/.test(t)?t.split("").join(" "):e.trim()}function xl(e,t){return e==="APPROVE"?"approved":e==="REJECT"?t?"rejected_retry":"rejected":"review"}var bl=15*60*1e3;function wl(e,t){const n=e,s=((n==null?void 0:n.message)??String(e??"")).toLowerCase();return/expired|timed out|\(410\)|session_expired/.test(s)?"expired":!t||(n==null?void 0:n.name)==="NetworkError"||(n==null?void 0:n.name)==="TypeError"||/network|failed to fetch|offline/.test(s)?"offline":"error"}function vl(e){const t=(e==null?void 0:e.name)??"";return t==="NotAllowedError"||t==="PermissionDeniedError"||t==="SecurityError"?"camera_denied":"camera_stopped"}function kl(e,t,n){const s=n??new ds(void 0,t,null);switch(e){case"approved":return{icon:"check",tone:"success",title:s.t("result","approvedTitle"),body:s.t("result","approvedBody"),primary:s.t("result","done")};case"review":return{icon:"clock",tone:"warning",title:s.t("result","reviewTitle"),body:s.t("result","reviewBody"),primary:s.t("result","done")};case"rejected_retry":return{icon:"x",tone:"danger",title:s.t("result","retryTitle"),body:s.t("result","retryBody"),tips:s.list("result","retryTips"),primary:s.t("result","tryAgain"),secondary:s.t("result","notNow")};case"rejected":return{icon:"x",tone:"danger",title:s.t("result","rejectedTitle"),body:s.t("result","rejectedBody"),primary:s.t("result","done")};case"camera_denied":return{icon:"camera",tone:"warning",title:s.t("errors","cameraDeniedTitle"),body:s.t("errors","cameraDeniedBody"),primary:s.t("errors","openSettings")};case"camera_stopped":return{icon:"camera",tone:"warning",title:s.t("errors","cameraStoppedTitle"),body:s.t("errors","cameraStoppedBody"),primary:s.t("result","tryAgain")};case"offline":return{icon:"wifi",tone:"warning",title:s.t("errors","offlineTitle"),body:s.t("errors","offlineBody"),primary:s.t("result","tryAgain")};case"expired":return{icon:"hourglass",tone:"warning",title:s.t("errors","expiredTitle"),body:s.t("errors","expiredBody"),primary:s.t("errors","startAgain")};case"mic_denied":return{icon:"mic",tone:"warning",title:s.t("errors","micTitle"),body:s.t("errors","micBody"),primary:s.t("result","tryAgain"),secondary:s.t("errors","useHeadMovement")};default:return{icon:"alert",tone:"warning",title:s.t("errors","errorTitle"),body:s.t("errors","errorBody"),primary:s.t("result","tryAgain")}}}function _l(e,t=Bt){const{title:n,body:s,tips:r,start:a}=t.primer(e);return{title:n,body:s,tips:r,start:a}}function Ml(e,t){return(e==null?void 0:e.enabled)!==!1&&t}function $a(e,t,n=Bt){const s=n;switch(e){case"intro":return{text:s.t("extraCheck","oneMoment"),sub:s.t("extraCheck","keepInOval"),ring:"warning",progress:1,tick:!1};case"flash":return{text:s.t("guidance","holdStill"),sub:s.t("extraCheck","screenColour"),ring:"warning",progress:1,tick:!1};case"rmas":return t?{text:t.label,sub:`${t.step} of ${t.total}`,ring:"warning",progress:Math.max(0,Math.min(1,t.countdown/100)),tick:!1}:{text:"Get ready",ring:"warning",progress:1,tick:!1};case"complete":return{text:s.t("extraCheck","done"),ring:"done",progress:1,tick:!0};default:return null}}function Sl(e,t){return e==="speak_phrase"?{yaw:Xe.maxYaw,pitch:Xe.maxPitch,roll:Xe.maxRoll,stillness:!0}:e==="follow_dot"?{yaw:40,pitch:35,roll:20,stillness:!1}:t==="left"||t==="right"?{yaw:50,pitch:Xe.maxPitch,roll:20,stillness:!1}:t==="up"||t==="down"?{yaw:Xe.maxYaw,pitch:40,roll:20,stillness:!1}:{yaw:30,pitch:30,roll:20,stillness:!1}}function Fl(e,t){const n=Sl(t.kind,t.direction),s={...e.checks};n.stillness||(s.stillness="unknown",s.sharpness="unknown");const r=e.measurements.pose;return r&&e.checks.face==="pass"&&(s.pose=Math.abs(r.yaw)<n.yaw&&Math.abs(r.pitch)<n.pitch&&Math.abs(r.roll)<n.roll?"pass":"fail"),jc({...e,checks:s})}var Rl={theme:ri(),strings:Bt},gi=m.createContext(Rl);function Rn(){return m.useContext(gi)}var Cl={check:"M5 12.5l4.5 4.5L19 7.5",clock:"M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",x:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6",camera:"M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",wifi:"M2 8.8a15 15 0 0 1 20 0M5 12.8a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18",mic:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3",hourglass:"M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10",alert:"M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",face:"M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0",turn:"M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2M18 2v4h-4M6 22v-4h4",dot:"M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M12 2v3M12 19v3M2 12h3M19 12h3",upload:"M12 16V4M7 9l5-5 5 5M4 20h16"};function pr({icon:e,tone:t,size:n}){const s=n>=64?36:26;return l.jsx("span",{className:`usesense-xc-badge usesense-xc-badge--${t}`,style:{width:n,height:n},"aria-hidden":"true",children:l.jsx("svg",{width:s,height:s,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:l.jsx("path",{d:Cl[e]})})})}function yi(){const{theme:e}=Rn(),{logo:t,displayName:n}=e;return t.placement==="none"||!t.url&&!n?null:l.jsx("div",{className:`usesense-xc-header${t.placement==="center"?" usesense-xc-header--center":""}`,children:t.url?l.jsx("img",{src:t.url,alt:n??""}):l.jsx("span",{className:"usesense-xc-header-name",children:n})})}function lr({camera:e=!1}){return l.jsx("div",{className:`usesense-powered${e?" usesense-powered--camera":""}`,"aria-hidden":e?"true":void 0,children:"Powered by Sense"})}function xi({icon:e,tone:t,title:n,body:s,tips:r,primary:a,secondary:i,onPrimary:o,onSecondary:c,testId:d,illustration:f}){const{theme:h}=Rn(),g=h.logo.placement!=="none"&&!!(h.logo.url||h.displayName);return l.jsxs("div",{className:`usesense-xc-page${g?" usesense-xc-page--header":""}`,role:"dialog","aria-labelledby":"usesense-xc-page-title","data-screen":d,children:[g&&l.jsx(yi,{}),f?l.jsx("img",{className:"usesense-xc-illustration",src:f,alt:"","aria-hidden":"true"}):l.jsx(pr,{icon:e,tone:t,size:72}),l.jsx("h1",{id:"usesense-xc-page-title",className:"usesense-xc-page-title",children:n}),l.jsx("p",{className:"usesense-xc-page-body",children:s}),r&&r.length>0&&l.jsx("ul",{className:"usesense-xc-tips",children:r.map(x=>l.jsxs("li",{children:[l.jsx("span",{"aria-hidden":"true"}),x]},x))}),l.jsx("div",{className:"usesense-xc-spacer"}),a&&l.jsx("button",{type:"button",className:"usesense-xc-primary",onClick:o,children:a}),i&&l.jsx("button",{type:"button",className:"usesense-xc-secondary",onClick:c,children:i}),l.jsx(lr,{})]})}function Al(e,t){return e==="approved"?t.success:e==="review"?t.review:e==="rejected"||e==="rejected_retry"?t.notVerified:null}function Js({screen:e,app:t,onPrimary:n,onSecondary:s}){const{theme:r,strings:a}=Rn(),i=t&&!a.app?new ds(void 0,t):a,o=kl(e,t,i);return l.jsx(xi,{testId:e,illustration:Al(e,r.icons),icon:o.icon,tone:o.tone,title:o.title,body:o.body,tips:o.tips,primary:o.primary,secondary:o.secondary,onPrimary:n,onSecondary:s})}function Oa({icon:e,tone:t,title:n,body:s,primary:r,onPrimary:a,testId:i}){return l.jsxs("div",{className:"usesense-xc-sheet",role:"dialog","aria-labelledby":"usesense-xc-sheet-title","data-screen":i,children:[e&&l.jsx(pr,{icon:e,tone:t??"extra",size:52}),l.jsx("div",{id:"usesense-xc-sheet-title",className:"usesense-xc-sheet-title",children:n}),s&&l.jsx("div",{className:"usesense-xc-sheet-body",children:s}),r&&l.jsx("button",{type:"button",className:"usesense-xc-primary usesense-xc-primary--sheet",onClick:a,children:r})]})}function Tl({onLeave:e,onStay:t}){const{strings:n}=Rn(),s={title:n.t("leave","title"),body:n.t("leave","body"),leave:n.t("leave","leave"),stay:n.t("leave","keepGoing")};return l.jsx("div",{className:"usesense-xc-scrim",children:l.jsxs("div",{className:"usesense-xc-dialog",role:"alertdialog","aria-labelledby":"usesense-xc-leave-title","aria-describedby":"usesense-xc-leave-body",children:[l.jsx("div",{id:"usesense-xc-leave-title",className:"usesense-xc-dialog-title",children:s.title}),l.jsx("div",{id:"usesense-xc-leave-body",className:"usesense-xc-dialog-body",children:s.body}),l.jsxs("div",{className:"usesense-xc-dialog-buttons",children:[l.jsx("button",{type:"button",className:"usesense-xc-dialog-no",onClick:e,children:s.leave}),l.jsx("button",{type:"button",className:"usesense-xc-dialog-yes",onClick:t,autoFocus:!0,children:s.stay})]})]})})}function La({W:e,H:t,oval:n,state:s}){if(!e||!t)return null;const{cx:r,cy:a,rx:i,ry:o}=n,c=46,d=22,f=Math.max(12,r-i-24-c),h=Math.min(e-12,r+i+24+c),g=x=>`${(x.x*e).toFixed(1)} ${(x.y*t).toFixed(1)}`;return l.jsxs(l.Fragment,{children:[l.jsxs("svg",{className:"usesense-xc-overlay",width:e,height:t,viewBox:`0 0 ${e} ${t}`,"aria-hidden":"true",children:[s.dot&&l.jsxs("g",{children:[s.trail&&s.trail.length>1&&l.jsx("path",{d:`M${s.trail.map(g).join(" L")}`,className:"usesense-xc-dot-trail",fill:"none",strokeOpacity:.35,strokeWidth:2,strokeDasharray:"4 6",strokeLinecap:"round",strokeLinejoin:"round"}),l.jsx("circle",{className:"usesense-xc-dot-ring",cx:s.dot.x*e,cy:s.dot.y*t,r:22,fill:"none",strokeOpacity:.5,strokeWidth:2}),l.jsx("circle",{className:"usesense-xc-dot",cx:s.dot.x*e,cy:s.dot.y*t,r:12})]}),s.arrow==="left"&&l.jsx("path",{className:"usesense-xc-arrow",d:`M${f} ${a} l ${d} -24 M${f} ${a} l ${d} 24 M${f} ${a} h ${c}`}),s.arrow==="right"&&l.jsx("path",{className:"usesense-xc-arrow",d:`M${h} ${a} l -${d} -24 M${h} ${a} l -${d} 24 M${h} ${a} h -${c}`}),s.arrow==="up"&&l.jsx("path",{className:"usesense-xc-arrow",d:`M${r} ${Math.max(12,a-o-24-c)} l -24 ${d} M${r} ${Math.max(12,a-o-24-c)} l 24 ${d} M${r} ${Math.max(12,a-o-24-c)} v ${c}`}),s.arrow==="down"&&l.jsx("path",{className:"usesense-xc-arrow",d:`M${r} ${a+o+24+c} l -24 -${d} M${r} ${a+o+24+c} l 24 -${d} M${r} ${a+o+24+c} v -${c}`}),s.tick&&l.jsxs("g",{className:"usesense-xc-tick",children:[l.jsx("circle",{className:"usesense-xc-tick-disc",cx:r,cy:a,r:44}),l.jsx("path",{className:"usesense-xc-tick-mark",d:`M${r-20} ${a+2} l 14 14 l 26 -30`,strokeWidth:6,strokeLinecap:"round",strokeLinejoin:"round",fill:"none"})]})]}),s.digits&&l.jsx("div",{className:"usesense-xc-digits","aria-label":`Numbers: ${s.digits}`,children:s.digits}),s.meter&&l.jsx("div",{className:"usesense-xc-meter",style:{top:Math.min(t-60,a+o+110)},"aria-hidden":"true",children:s.meter.map((x,b)=>l.jsx("span",{style:{height:x}},b))})]})}function jl(){const{theme:e}=Rn(),{style:t,imageUrl:n}=e.loader;return n?l.jsx("img",{className:"usesense-loader-image",src:n,alt:"","aria-hidden":"true"}):t==="dots"?l.jsxs("div",{className:"usesense-loader-dots","aria-hidden":"true",children:[l.jsx("span",{}),l.jsx("span",{}),l.jsx("span",{})]}):t==="bar"?l.jsx("div",{className:"usesense-loader-bar","aria-hidden":"true",children:l.jsx("i",{})}):l.jsx("div",{className:"usesense-loader-spinner","aria-hidden":"true"})}var El={version:"4.15.0"},Zs=El.version,mr="https://api.usesense.ai/v1",ur={idleTimeoutMs:2e4,backoffsMs:[1e3,2e3,4e3],stallWindowMs:6e4,uploadBudgetMs:3e5};async function Pl(e){const t=JSON.stringify(e),n={blob:new Blob([t],{type:"application/json"}),filename:"metadata.json",gzipped:!1};if(typeof CompressionStream>"u")return n;try{const s=new Blob([t]).stream().pipeThrough(new CompressionStream("gzip")),r=await new Response(s).arrayBuffer();return{blob:new Blob([r],{type:"application/gzip"}),filename:"metadata.json.gz",gzipped:!0}}catch{return n}}function Il(e,t,n,s,r=ur.idleTimeoutMs,a=0){return new Promise((i,o)=>{const c=new XMLHttpRequest;c.open("POST",e,!0);for(const[T,j]of Object.entries(t))c.setRequestHeader(T,j);const d=T=>Object.assign(new Error(T),{name:"NetworkError"});let f,h=!1;const g=()=>{f!==void 0&&clearTimeout(f),f=void 0},x=()=>{g(),f=setTimeout(()=>{h=!0,c.abort()},r)},b=Date.now();let C=-1;const R=()=>((Date.now()-b)/1e3).toFixed(1);c.upload.onprogress=T=>{x();const j=T.lengthComputable?T.total:0;if(j>0){const B=Math.floor(T.loaded/j*10);B>C&&B<10&&(C=B,console.debug(`[UseSense] upload attempt ${a+1}: ${T.loaded}/${j} bytes (${B*10}%) in ${R()}s`))}s==null||s({loaded:T.loaded,total:j,percent:j>0?Math.min(100,Math.round(T.loaded/j*100)):0})},c.upload.onload=T=>{x(),console.debug(`[UseSense] upload attempt ${a+1}: body sent ${T.loaded} bytes in ${R()}s, waiting for the server`)},c.onprogress=x,c.onreadystatechange=()=>{c.readyState<4&&x()},c.onload=()=>{g(),i({status:c.status,getHeader:T=>c.getResponseHeader(T),text:c.responseText})},c.onerror=()=>{g(),o(d("Network request failed"))},c.ontimeout=()=>{g(),o(d("Network request timed out"))},c.onabort=()=>{g(),o(d(h?`Upload stalled (no bytes for ${r/1e3} s)`:"Upload aborted"))},x(),c.send(n)})}function Nl(e,t,n,s,r){const a=`${e}/sessions/${t}/signals?env=${n}&nonce=${encodeURIComponent(s)}`;return r===2?`${a}&round=2`:a}async function Ba(e){var d,f,h,g;const t=e.apiBaseUrl||mr,n=Nl(t,e.sessionId,e.environment,e.nonce,e.round),s=crypto.randomUUID(),r=new FormData;for(const x of e.frames){const b=new Blob([x],{type:"image/jpeg"});r.append("frames[]",b,"frame.jpg")}const a=await Pl(e.metadata);r.append("metadata",a.blob,a.filename),e.audioBlob&&r.append("audio",e.audioBlob,"audio.webm");const i={"x-session-token":e.sessionToken,"x-nonce":e.nonce,"x-environment":e.environment,"x-idempotency-key":s,"x-usesense-mediapipe-model-version":di.versionLabel,"x-usesense-metadata-encoding":a.gzipped?"gzip":"identity"},o=ur.backoffsMs;let c=null;for(let x=0;x<=o.length;x++)try{(d=e.onAttempt)==null||d.call(e,x),x>0&&console.log(`[UseSense] Upload retry ${x} of ${o.length}`);const b=await Il(n,i,r,e.onProgress,ur.idleTimeoutMs,x);if(b.status<200||b.status>=300){const C=b.text||"";let R={};try{R=JSON.parse(C)}catch{}if(console.error("[UseSense] Upload error body:",C),b.status>=400&&b.status<500&&b.status!==429)throw new Error(((f=R.error)==null?void 0:f.message)||R.message||`Upload failed (${b.status})`);if(b.status===429){const T=parseInt(b.getHeader("Retry-After")||"2",10);if(x<o.length){await new Promise(j=>setTimeout(j,T*1e3));continue}}if(b.status>=500&&x<2){await new Promise(T=>setTimeout(T,2e3));continue}throw new Error(((h=R.error)==null?void 0:h.message)||R.message||`Upload failed (${b.status})`)}return JSON.parse(b.text)}catch(b){if(c=b,(b.name==="NetworkError"||b.name==="TypeError"||(g=b.message)!=null&&g.includes("fetch"))&&(console.warn(`[UseSense] Upload attempt ${x+1} failed (network):`,b.message),x<o.length)){await new Promise(C=>setTimeout(C,o[x]));continue}throw b}throw c||new Error("Upload failed after retries")}async function $l(e){var o,c,d;const n=`${e.apiBaseUrl||mr}/sessions/${e.sessionId}/complete?env=${e.environment}&nonce=${encodeURIComponent(e.nonce)}`,s=crypto.randomUUID(),r={"x-session-token":e.sessionToken,"x-nonce":e.nonce,"x-environment":e.environment,"x-idempotency-key":s},a=[1e3,2e3,4e3];let i=null;for(let f=0;f<=a.length;f++)try{const h=await fetch(n,{method:"POST",headers:r});if(!h.ok){const g=await h.json().catch(()=>({}));if(h.status>=400&&h.status<500&&h.status!==429)throw new Error(((o=g.error)==null?void 0:o.message)||g.message||`Complete failed (${h.status})`);if(h.status===429){const x=parseInt(h.headers.get("Retry-After")||"2",10);if(f<a.length){await new Promise(b=>setTimeout(b,x*1e3));continue}}if(h.status>=500&&f<2){await new Promise(x=>setTimeout(x,2e3));continue}throw new Error(((c=g.error)==null?void 0:c.message)||g.message||`Complete failed (${h.status})`)}return h.json()}catch(h){if(i=h,(h.name==="TypeError"||(d=h.message)!=null&&d.includes("fetch"))&&(console.warn(`[UseSense] Complete attempt ${f+1} failed (network):`,h.message),f<a.length)){await new Promise(g=>setTimeout(g,a[f]));continue}throw h}throw i||new Error("Complete failed after retries")}var is=class extends Error{constructor(e,t,n){super(t),this.code=e,this.status=n,this.name="ChallengeFallbackError"}};async function Ol(e){var i,o;const n=`${e.apiBaseUrl||mr}/sessions/${encodeURIComponent(e.sessionId)}/challenge-fallback?env=${e.environment}`,s=e.fetcher??fetch.bind(globalThis);let r;try{r=await s(n,{method:"POST",headers:{"Content-Type":"application/json","x-session-token":e.sessionToken,"x-environment":e.environment},body:JSON.stringify({reason:e.reason??"microphone_unavailable"})})}catch(c){throw new is("network",(c==null?void 0:c.message)||"Network unavailable")}const a=await r.json().catch(()=>({}));if(!r.ok){const c=(i=a==null?void 0:a.error)==null?void 0:i.code,d=((o=a==null?void 0:a.error)==null?void 0:o.message)||(a==null?void 0:a.message)||`Challenge fallback failed (${r.status})`,f=r.status===409&&(c==="capture_already_uploaded"||c==="fallback_not_allowed")?c:r.status===409?"fallback_not_allowed":r.status===400?"invalid_request":r.status===401?"unauthorized":"server";throw new is(f,d,r.status)}if(!a||typeof a!="object"||!a.policy)throw new is("server","Challenge fallback returned no policy",r.status);return a}function Da(e,t,n,s,r=!0){const a=Math.max(n/e,s/t),i=e*a,o=t*a,c=(n-i)/2,d=(s-o)/2;return{map:(f,h)=>({x:c+(r?1-f:f)*i,y:d+h*o}),renderedWidth:i}}var Ll=96;function ts(e,t,n,s,r,a){const i=Ll;t.width!==i&&(t.width=i),t.height!==i&&(t.height=i);const o=t.getContext("2d",{willReadFrequently:!0});if(!o)return null;const c=e.videoWidth,d=e.videoHeight,f=Math.max(0,Math.min(c-1,n)),h=Math.max(0,Math.min(d-1,s)),g=Math.max(1,Math.min(c-f,r)),x=Math.max(1,Math.min(d-h,a));try{o.drawImage(e,f,h,g,x,0,0,i,i);const b=kc(o.getImageData(0,0,i,i).data);return{stats:_c(b,i,i),luma:b}}catch{return null}}var Ua=160;function za(e,t,n,s,r,a,i){const o=e.videoWidth,c=e.videoHeight;if(!o||!c||a<=0||i<=0)return null;const d=a*.1,f=i*.1,h=Math.max(0,s-d),g=Math.max(0,r-f),x=Math.min(o-h,a+2*d),b=Math.min(c-g,i+2*f);if(x<=1||b<=1)return null;const C=Ua/x,R=Ua,T=Math.max(8,Math.round(b*C));t.width!==R&&(t.width=R),t.height!==T&&(t.height=T);const j=t.getContext("2d",{willReadFrequently:!0});if(!j)return null;try{j.drawImage(e,h,g,x,b,0,0,R,T);const B=j.getImageData(0,0,R,T).data,K=Array.from({length:n.length},(H,v)=>({x:(n[v].x*o-h)*C,y:(n[v].y*c-g)*C}));return oc(B,R,T,K)}catch{return null}}function Bl(e,t){if(e.length!==t.length||e.length===0)return 0;let n=0;for(let s=0;s<e.length;s++)n+=Math.abs(e[s]-t[s]);return n/e.length}function Dl(){var e;try{return typeof window<"u"&&!!((e=window.matchMedia)!=null&&e.call(window,"(prefers-reduced-motion: reduce)").matches)}catch{return!1}}function ns(e){try{typeof navigator<"u"&&typeof navigator.vibrate=="function"&&navigator.vibrate(e)}catch{}}function Ul(e){const t=new Uint8Array(e.length/2);for(let n=0;n<e.length;n+=2)t[n/2]=parseInt(e.substring(n,n+2),16);return t}function ls(e){return Array.from(e).map(t=>t.toString(16).padStart(2,"0")).join("")}async function zl(e){const t=await crypto.subtle.digest("SHA-256",e);return ls(new Uint8Array(t))}async function Hl(e,t,n,s){let r="none";if(s.length>0){const o=new Float64Array(s).buffer,c=await crypto.subtle.digest("SHA-256",o);r=ls(new Uint8Array(c))}const a=JSON.stringify({s:e,p:[t.yaw,t.pitch,t.roll],d:n,l:r}),i=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(a));return ls(new Uint8Array(i))}async function Wl(e,t,n){const s=Ul(e),r=await crypto.subtle.importKey("raw",s,{name:"HMAC",hash:"SHA-256"},!1,["sign"]),a=new TextEncoder().encode(`${t}:${n}`),i=await crypto.subtle.sign("HMAC",r,a);return ls(new Uint8Array(i))}var Vl=.8,ql=30,Gl=960;function Yl(e,t){const n=Math.min(1,Gl/Math.max(e,t));return{w:Math.max(1,Math.round(e*n)),h:Math.max(1,Math.round(t*n))}}async function Xl(e,t,n,s){if(!e||e.videoWidth===0)return null;const{w:r,h:a}=Yl(e.videoWidth,e.videoHeight),i=s??document.createElement("canvas");i.width=r,i.height=a;const o=i.getContext("2d");if(!o)return null;o.imageSmoothingEnabled=!0,o.imageSmoothingQuality="high",o.drawImage(e,0,0,r,a);const c=performance.now(),d=document.createElement("canvas"),f=64,h=48;d.width=f,d.height=h;const g=d.getContext("2d");let x=0;if(g){g.drawImage(e,0,0,f,h);const j=g.getImageData(0,0,f,h).data;let B=0;const K=f*h;for(let H=0;H<j.length;H+=4)B+=.299*j[H]+.587*j[H+1]+.114*j[H+2];x=B/K}const b=await new Promise(j=>i.toBlob(j,"image/jpeg",Vl));if(!b)return null;const C=await b.arrayBuffer(),R=new Uint8Array(C),T=await zl(R);return{index:t,bytes:R,hash:T,timestamp:Date.now(),luminance:x,resolution:{w:r,h:a},drawnAt:c}}function Ha(e){return e>=ql}function nt(e){return Math.floor(1e3/Math.max(1,e))}function $e(e){return new Promise(t=>setTimeout(t,e))}function Kl(e,t=[],n=3){if(e.length>=n&&new Set(e).size===1)return!0;const s=t.filter(a=>!!a&&a.length>0);if(s.length<n)return!1;const r=s[0];return s.every(a=>{if(a.length!==r.length)return!1;for(let i=0;i<a.length;i++)if(a[i]!==r[i])return!1;return!0})}function Jl(e,t){const n=t==null?void 0:t.captureTime;if(typeof n!="number"||!Number.isFinite(n))return e;const s=e-n;return s>=0&&s<1e3?n:e}var Zl=class{constructor(){this.latest=null,this.video=null,this.handle=null}start(e){this.stop();const t=e;if(typeof t.requestVideoFrameCallback!="function")return;this.video=e;const n=(s,r)=>{this.video===e&&(this.latest={captureTime:r==null?void 0:r.captureTime,callbackAt:s},this.handle=t.requestVideoFrameCallback(n))};this.handle=t.requestVideoFrameCallback(n)}stop(){const e=this.video;e&&this.handle!==null&&typeof e.cancelVideoFrameCallback=="function"&&e.cancelVideoFrameCallback(this.handle),this.video=null,this.handle=null,this.latest=null}};async function Wa(e,t){const n=MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?"audio/webm;codecs=opus":MediaRecorder.isTypeSupported("audio/webm")?"audio/webm":"audio/mp4",s=new MediaRecorder(e,{mimeType:n}),r=[];return s.ondataavailable=a=>{a.data.size>0&&r.push(a.data)},s.start(250),await new Promise(a=>{setTimeout(()=>{s.state==="recording"&&s.stop(),a()},t)}),s.state!=="inactive"&&await new Promise(a=>{s.onstop=()=>a()}),new Blob(r,{type:n})}function Ql(e){return e.name==="NotAllowedError"||e.name==="PermissionDeniedError"?"Camera access denied. Please allow camera permissions in your browser settings.":e.name==="NotFoundError"?"No camera detected. Please connect a camera and try again.":e.name==="NotReadableError"?"Camera is in use by another application. Please close other apps using the camera.":e.name==="OverconstrainedError"?"Camera does not support the required settings. Please try a different camera.":"Could not access camera. Please check your device and try again."}var eu=30,Va=.3,Qs=6,ss=class{constructor(e=55){this.buffer=[],this.emaScore=0,this.framesAnalyzed=0,this.triggered=!1,this.frameCounter=0,this.threshold=e}push(e,t,n){this.frameCounter++,this.buffer.push({yaw:e.yaw,pitch:e.pitch,roll:e.roll,luminance:t,sharpness:n,timestamp:Date.now()}),this.buffer.length>eu&&this.buffer.shift(),this.frameCounter%2===0&&this.buffer.length>=3&&this.evaluate()}shouldTrigger(){return this.triggered&&this.framesAnalyzed>=Qs}getScore(){return Math.round(this.emaScore)}getSnapshot(){const e=this.computeSignals(),t={score:this.getScore(),signals:e,framesAnalyzed:this.framesAnalyzed,reliable:this.framesAnalyzed>=Qs,timestamp:Date.now()};return{final_score:this.getScore(),triggered:this.triggered,snapshot:t}}evaluate(){this.framesAnalyzed++;const e=this.computeSignals();let t=0,n=0;for(const r of e)r.score>=0&&(n+=r.score*r.weight,t+=r.weight);const s=t>0?n/t:0;this.emaScore=Va*s+(1-Va)*this.emaScore,this.emaScore>=this.threshold&&this.framesAnalyzed>=Qs&&(this.triggered=!0)}computeSignals(){return[this.computeMicroTremor(),this.computeTemporalSmoothness(),this.computeBrightnessStability(),this.computeSharpnessPattern()]}computeMicroTremor(){if(this.buffer.length<3)return{name:"micro_tremor",score:-1,weight:.35,detail:"insufficient data"};const e=[];for(let i=1;i<this.buffer.length;i++){const o=Math.abs(this.buffer[i].yaw-this.buffer[i-1].yaw),c=Math.abs(this.buffer[i].pitch-this.buffer[i-1].pitch),d=Math.abs(this.buffer[i].roll-this.buffer[i-1].roll);e.push(Math.sqrt(o*o+c*c+d*d))}const t=[...e].sort((i,o)=>i-o),n=t[Math.floor(t.length/2)],s=e.reduce((i,o)=>i+o,0)/e.length,r=s>.001?Math.sqrt(e.reduce((i,o)=>i+(o-s)**2,0)/e.length)/s:0;let a;return n<.05?a=90:n<.08?a=70:n>.8?a=30:a=r>.5?Math.max(0,40-r*20):Math.min(80,60-r*10),{name:"micro_tremor",score:Math.round(Math.max(0,Math.min(100,a))),weight:.35,detail:`median=${n.toFixed(3)}, cv=${r.toFixed(2)}`}}computeTemporalSmoothness(){if(this.buffer.length<5)return{name:"temporal_smoothness",score:-1,weight:.25,detail:"insufficient data"};const e=[];for(let o=1;o<this.buffer.length;o++)e.push(this.buffer[o].yaw-this.buffer[o-1].yaw);const t=[];for(let o=1;o<e.length;o++)t.push(e[o]-e[o-1]);const n=[];for(let o=1;o<t.length;o++)n.push(t[o]-t[o-1]);if(n.length===0)return{name:"temporal_smoothness",score:-1,weight:.25,detail:"insufficient jerk data"};const s=n.reduce((o,c)=>o+Math.abs(c),0)/n.length;let r=0;for(let o=1;o<n.length;o++)(n[o]>0&&n[o-1]<0||n[o]<0&&n[o-1]>0)&&r++;const a=n.length>1?r/(n.length-1):0;let i;return s<.05&&a<.2?i=85:s<.1?i=65:i=Math.max(0,50-s*100),{name:"temporal_smoothness",score:Math.round(Math.max(0,Math.min(100,i))),weight:.25,detail:`jerk=${s.toFixed(3)}, zcr=${a.toFixed(2)}`}}computeBrightnessStability(){if(this.buffer.length<5)return{name:"brightness_stability",score:-1,weight:.2,detail:"insufficient data"};const e=this.buffer.map(a=>a.luminance),t=e.reduce((a,i)=>a+i,0)/e.length,n=e.reduce((a,i)=>a+(i-t)**2,0)/e.length,s=t>.001?Math.sqrt(n)/t:0;let r;return s<.02?r=85:s<.05?r=60:r=Math.max(0,30-s*100),{name:"brightness_stability",score:Math.round(Math.max(0,Math.min(100,r))),weight:.2,detail:`cv=${s.toFixed(4)}, mean=${t.toFixed(1)}`}}computeSharpnessPattern(){if(this.buffer.length<5)return{name:"sharpness_pattern",score:-1,weight:.2,detail:"insufficient data"};const e=this.buffer.map(r=>r.sharpness),t=e.reduce((r,a)=>r+a,0)/e.length,n=t>.001?Math.sqrt(e.reduce((r,a)=>r+(a-t)**2,0)/e.length)/t:0;let s;return t<45&&n<.1?s=80:t<45?s=55:n<.06?s=60:s=Math.max(0,30-n*50),{name:"sharpness_pattern",score:Math.round(Math.max(0,Math.min(100,s))),weight:.2,detail:`mean=${t.toFixed(1)}, cv=${n.toFixed(3)}`}}},bi="evidence-v1",wi="matrix_zyx_v3",tu="mediapipe_zyx_v2",kn=e=>!!e&&typeof e=="object"&&!Array.isArray(e),us=e=>typeof e=="number"&&Number.isFinite(e)&&e>0?e:null;function nu(e){if(!kn(e))return null;const t=typeof e.id=="string"&&e.id.length>0?e.id:null,n=Array.isArray(e.colours)?e.colours:null;if(!t||!n||n.length===0||!n.every(i=>typeof i=="string"&&/^#[0-9A-Fa-f]{6}$/.test(i)))return null;const s=us(e.segment_ms),r=typeof e.lead_in_ms=="number"&&Number.isFinite(e.lead_in_ms)&&e.lead_in_ms>=0?e.lead_in_ms:null,a=us(e.opacity);return s===null||r===null||a===null?null:{id:t,colours:n.map(i=>i.toUpperCase()),segmentMs:s,leadInMs:r,opacity:Math.min(1,a)}}function su(e){if(!kn(e)||e.contract!==bi)return null;const t=kn(e.closer_step)?{enabled:e.closer_step.enabled===!0,targetScale:us(e.closer_step.target_scale),minScale:us(e.closer_step.min_scale)}:null,n=kn(e.landmarks)?{required:e.landmarks.required===!0,format:typeof e.landmarks.format=="string"?e.landmarks.format:null}:null;return{colourSequence:nu(e.colour_sequence),closerStep:t,bindingV2Enabled:kn(e.binding_v2)&&e.binding_v2.enabled===!0,landmarks:n}}function sn(e,t){const n=10**t,s=Math.round(e*n)/n;return s===0?0:s}function qa(e,t=5){const n=new Array(e.length);for(let s=0;s<e.length;s++)n[s]=sn(e[s],t);return n}function ru(e){const t={landmarks:qa(e.landmarks,5)},n=e.matrix;if(n&&n.length===16){const o=qa(n,5);if(o.every(Number.isFinite)){t.transformMatrix=o;const c=cs(o);t.pose={yaw:sn(c.yaw,3),pitch:sn(c.pitch,3),roll:sn(c.roll,3)}}}const s=e.blendshapes??[],r=o=>{var c;return(c=s.find(d=>d.categoryName===o))==null?void 0:c.score},a=r("eyeBlinkLeft"),i=r("eyeBlinkRight");return typeof a=="number"&&typeof i=="number"&&Number.isFinite(a)&&Number.isFinite(i)&&(t.blendshapes={eyeBlinkLeft:sn(a,3),eyeBlinkRight:sn(i,3)}),t}function au(e,t){const n=new Map;for(const a of e){const i=a.frameIndex;!Number.isInteger(i)||i<0||i>=t.length||!t[i]||n.has(i)||n.set(i,a)}const s=new Set,r=[];for(const a of[...n.keys()].sort((i,o)=>i-o)){const i=t[a];s.has(i)||(s.add(i),r.push(n.get(a)))}return r}var iu=3,ou=class{constructor(e,t,n={}){this.host=null,this._phase={kind:"idle"},this._runs=0,this.shownThisPlay=!1,this.phaseStart=0,this.frameId=null,this.awbAll=!0,this.awbKnown=!1,this._nextIndex=0,this.wbChain=Promise.resolve(),this.sequence=e,this.clock=t,this.requestFrame=n.requestFrame??(s=>requestAnimationFrame(s)),this.cancelFrame=n.cancelFrame??(s=>cancelAnimationFrame(s)),this.lockWhiteBalance=n.lockWhiteBalance,this.now=n.now??(()=>performance.now()),this._record=this.emptyRecord()}emptyRecord(){return{sequence_id:this.sequence.id,segments:[],screen_brightness:null,completed:!1,interrupted_reason:null,awb_locked:!1}}get phase(){return this._phase}get record(){return{...this._record,segments:this._record.segments.map(e=>({...e}))}}get runs(){return this._runs}get nextIndex(){return this._nextIndex}get isPlaying(){return this._phase.kind==="leadIn"||this._phase.kind==="segment"}get finished(){return this._phase.kind==="done"}get tinting(){return this._phase.kind==="segment"}get canPlay(){return!this.isPlaying&&!this.finished&&this._runs<iu}remainingMs(){return this.sequence.leadInMs+(this.sequence.colours.length-this._nextIndex)*this.sequence.segmentMs}play(){this.canPlay&&(this.shownThisPlay=!1,this._phase={kind:"leadIn"},this.phaseStart=this.now(),this.lockWhiteBalance?this.whiteBalance(!0).then(e=>this.noteAwb(e)):this.noteAwb(!1),this.schedule())}whiteBalance(e){const t=this.wbChain.then(()=>this.lockWhiteBalance(e)).then(n=>n===!0,()=>!1);return this.wbChain=t,t}noteAwb(e){this.awbAll=this.awbAll&&e,this.awbKnown=!0,this._record.awb_locked=this.awbKnown&&this.awbAll}interrupt(e="gate_pause"){this.isPlaying&&(this._phase.kind==="segment"&&(this._record.segments.pop(),this._nextIndex=this._phase.index),this._record.completed=!1,this._record.interrupted_reason=e,this.stop({kind:"idle"}))}cancel(){this.interrupt("cancelled")}resetForNewWindow(){this.interrupt("window_dropped"),this._record=this.emptyRecord(),this._nextIndex=0,this._runs=0,this.awbAll=!0,this.awbKnown=!1,this._phase={kind:"idle"}}schedule(){this.frameId=this.requestFrame(e=>{this.frameId=null,this.isPlaying&&(this.advance(e),this.isPlaying&&this.schedule())})}advance(e){const{leadInMs:t,segmentMs:n,colours:s}=this.sequence,r=this._phase;r.kind==="leadIn"&&e-this.phaseStart>=t?this.begin(this._nextIndex,e):r.kind==="segment"&&e-this.phaseStart>=n&&(this.closeSegment(e),this._nextIndex=r.index+1,r.index+1<s.length?this.begin(r.index+1,e):(this._record.completed=!0,this.stop({kind:"done"})))}begin(e,t){var r;const n=this.clock(t);if(n===null)return;this._phase={kind:"segment",index:e},this.phaseStart=t,this.shownThisPlay||(this.shownThisPlay=!0,this._runs++);const s=this.sequence.colours[e];this._record.segments.push({colour:s,start_ms:n,end_ms:n}),(r=this.host)==null||r.showTint(s,this.sequence.opacity)}closeSegment(e){const t=this._record.segments[this._record.segments.length-1];if(!t)return;const n=this.clock(e);t.end_ms=Math.max(t.start_ms+1,n??t.start_ms+1)}stop(e){var n;const t=this.isPlaying;this.frameId!==null&&(this.cancelFrame(this.frameId),this.frameId=null),this._phase=e,t&&((n=this.host)==null||n.showTint(null,0),this.lockWhiteBalance&&this.whiteBalance(!1))}};function er(e,t){return t===null||!Number.isFinite(t)||!Number.isFinite(e)?null:Math.max(0,Math.round(e-t))}async function cu(e,t){try{if(!e||typeof e.getCapabilities!="function"||typeof e.applyConstraints!="function")return!1;const n=e.getCapabilities(),s=Array.isArray(n.whiteBalanceMode)?n.whiteBalanceMode:[],r=t?"manual":"continuous";if(!s.includes(r))return!1;const a=e.getSettings(),i={whiteBalanceMode:r};return t&&typeof a.colorTemperature=="number"&&(i.colorTemperature=a.colorTemperature),await Promise.race([e.applyConstraints({advanced:[i]}),new Promise((o,c)=>setTimeout(()=>c(new Error("timeout")),500))]),e.getSettings().whiteBalanceMode===r}catch{return!1}}function lu(e){return{landmarks:e,blendshapes:e,pose_method:e?wi:null,closer_step:!1,binding_v2:!1}}function uu(e){return{contract:bi,clock:"capture_monotonic_ms",...e.colour?{colour:e.colour}:{},closer:{completed:!1,skipped_reason:"platform_web"},capability:lu(e.meshAvailable)}}var du=150;function hu(e,t){return e.map(n=>t.filter(s=>s>=n.start_ms+du&&s<=n.end_ms).length)}function fu(e,t){const n=s=>s.length?{r:s.reduce((r,a)=>r+a.r,0)/s.length,b:s.reduce((r,a)=>r+a.b,0)/s.length}:null;return t.map(s=>{const r=n(e.filter(c=>c.t>=s.start_ms-200&&c.t<s.start_ms)),a=n(e.filter(c=>c.t>=s.end_ms-250&&c.t<=s.end_ms));if(!r||!a)return null;const i=Math.hypot(a.r-r.r,a.b-r.b);if(i<.002)return null;const o=e.find(c=>c.t>=s.start_ms&&c.t<=s.end_ms&&Math.hypot(c.r-r.r,c.b-r.b)>=i/2);return o?o.t-s.start_ms:null})}function pu(e){const t=/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(e);if(!t)return null;const n=parseInt(t[1],16),s=parseInt(t[2],16),r=parseInt(t[3],16),a=n+s+r;return a>0?{r:n/a,b:r/a}:null}function mu(e,t,n=400,s=10){const r=t.map(d=>({...d,c:pu(d.colour)})),a=d=>{const f=[],h=[];for(const j of e){const B=r.find(K=>j.t-d>=K.start_ms&&j.t-d<K.end_ms);B!=null&&B.c&&(f.push(j.r,j.b),h.push(B.c.r,B.c.b))}if(f.length<16)return null;const g=j=>{const B=j.filter((H,v)=>v%2===0).reduce((H,v)=>H+v,0)/(j.length/2),K=j.filter((H,v)=>v%2===1).reduce((H,v)=>H+v,0)/(j.length/2);return j.map((H,v)=>H-(v%2===0?B:K))},x=g(f),b=g(h);let C=0,R=0,T=0;for(let j=0;j<x.length;j++)C+=x[j]*b[j],R+=x[j]**2,T+=b[j]**2;return R>0&&T>0?{corr:C/Math.sqrt(R*T),n:f.length/2}:null},i=a(0);if(!i)return null;let o={lagMs:0,corr:i.corr};for(let d=s;d<=n;d+=s){const f=a(d);f&&f.corr>o.corr&&(o={lagMs:d,corr:f.corr})}const c=d=>Math.round(d*1e3)/1e3;return{lagMs:o.lagMs,corr:c(o.corr),corrAtZero:c(i.corr),frames:i.n}}function gu(e,t){return{luminance_histogram_spread:yu(t),edge_energy_ratio:xu(t),frame_luminance_cv:bu(e),color_channel_uniformity:wu(t)}}function yu(e){if(!e)return .5;try{if(!e.getContext("2d"))return .5;const n=120,s=90,r=document.createElement("canvas");r.width=n,r.height=s;const a=r.getContext("2d");if(!a)return .5;a.drawImage(e,0,0,n,s);const i=a.getImageData(0,0,n,s).data,o=new Uint32Array(256),c=n*s;for(let b=0;b<i.length;b+=4){const C=Math.round(.299*i[b]+.587*i[b+1]+.114*i[b+2]);o[Math.min(255,C)]++}let d=0,f=0,h=255;const g=c*.05,x=c*.95;for(let b=0;b<256;b++)if(d+=o[b],d>=g&&f===0&&(f=b),d>=x){h=b;break}return(h-f)/255}catch{return .5}}function xu(e){if(!e)return .5;try{if(!e.getContext("2d"))return .5;const n=120,s=90,r=document.createElement("canvas");r.width=n,r.height=s;const a=r.getContext("2d");if(!a)return .5;a.drawImage(e,0,0,n,s);const i=a.getImageData(0,0,n,s).data,o=new Float32Array(n*s);for(let f=0,h=0;f<i.length;f+=4,h++)o[h]=.299*i[f]+.587*i[f+1]+.114*i[f+2];let c=0,d=0;for(let f=0;f<s-1;f++)for(let h=0;h<n-1;h++){const g=f*n+h,x=o[g+1]-o[g],b=o[g+n]-o[g];c+=x*x+b*b,d+=o[g]*o[g]}return d>0?Math.min(1,c/d):.5}catch{return .5}}function bu(e){if(e.length<2)return 0;const t=e.reduce((s,r)=>s+r,0)/e.length;if(t<.001)return 0;const n=e.reduce((s,r)=>s+(r-t)**2,0)/e.length;return Math.sqrt(n)/t}function wu(e){if(!e)return .5;try{if(!e.getContext("2d"))return .5;const n=60,s=45,r=document.createElement("canvas");r.width=n,r.height=s;const a=r.getContext("2d");if(!a)return .5;a.drawImage(e,0,0,n,s);const i=a.getImageData(0,0,n,s).data;let o=0,c=0,d=0;const f=n*s;for(let T=0;T<i.length;T+=4)o+=i[T],c+=i[T+1],d+=i[T+2];const h=o/f,g=c/f,x=d/f,b=(h+g+x)/3;if(b<1)return .5;const C=((h-b)**2+(g-b)**2+(x-b)**2)/3,R=Math.sqrt(C)/b;return Math.max(0,Math.min(1,1-R*5))}catch{return .5}}var vu=["#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF","#00FFFF"],ku=400,Ga=600,_u=8;async function Mu(e,t){const s=[...vu].sort(()=>Math.random()-.5).slice(0,3),r=[];for(const c of s){t(null),await Xa(),await Ka(ku);const d=Ya(e);t(c),await Xa(),await Ka(Ga);const f=Ya(e),h=f[0]-d[0],g=f[1]-d[1],x=f[2]-d[2],b=Math.sqrt(h*h+g*g+x*x),C=b>=_u&&Su(c,h,g,x);r.push({color:c,durationMs:Ga,baselineRgb:d,flashRgb:f,colorDelta:Math.round(b*10)/10,reflectionDetected:C})}t(null);const i=r.filter(c=>c.reflectionDetected).length>=2,o=r.reduce((c,d)=>c+d.colorDelta,0)/r.length;return{type:"flash_reflection",flashes:r,passed:i,confidence:i?Math.min(100,Math.round(o*4)):Math.round(o*2),overallColorDelta:Math.round(o*10)/10}}function Ya(e){try{const s=document.createElement("canvas");s.width=120,s.height=90;const r=s.getContext("2d");if(!r)return[128,128,128];r.drawImage(e,0,0,120,90);const a=Math.floor(120*.3),i=Math.floor(90*.2),o=Math.floor(120*.4),c=Math.floor(90*.5),d=r.getImageData(a,i,o,c).data;let f=0,h=0,g=0;const x=o*c;for(let b=0;b<d.length;b+=4)f+=d[b],h+=d[b+1],g+=d[b+2];return[Math.round(f/x),Math.round(h/x),Math.round(g/x)]}catch{return[128,128,128]}}function Su(e,t,n,s){switch(e){case"#FF0000":return t>0&&t>=n&&t>=s;case"#00FF00":return n>0&&n>=t&&n>=s;case"#0000FF":return s>0&&s>=t&&s>=n;case"#FFFF00":return t>0&&n>0;case"#FF00FF":return t>0&&s>0;case"#00FFFF":return n>0&&s>0;default:return!0}}function Xa(){return new Promise(e=>requestAnimationFrame(()=>e()))}function Ka(e){return new Promise(t=>setTimeout(t,e))}var tr=1500,Fu=100,Ru=300,Cu=[{type:"blink",label:"Blink twice",validate:(e,t)=>t.leftEAR<.2||t.rightEAR<.2},{type:"smile",label:"Smile",validate:(e,t)=>e.mouthWidth>0&&(t.mouthWidth-e.mouthWidth)/e.mouthWidth>.15},{type:"raise_eyebrows",label:"Raise your eyebrows",validate:(e,t)=>e.browY-t.browY>.008},{type:"open_mouth",label:"Open your mouth",validate:(e,t)=>t.lipDistance-e.lipDistance>.025},{type:"turn_left",label:"Turn head left",validate:(e,t)=>t.yaw<-12},{type:"turn_right",label:"Turn head right",validate:(e,t)=>t.yaw>12}];async function Au(e,t){const s=[...Cu].sort(()=>Math.random()-.5).slice(0,3),r=Tu(e),a=[];for(let c=0;c<s.length;c++){const d=s[c];t({label:d.label,step:c+1,total:s.length,countdown:100});const f=Date.now();let h=!1,g=null;for(;Date.now()-f<tr;){const x=Date.now()-f,b=Math.max(0,100-x/tr*100);t({label:d.label,step:c+1,total:s.length,countdown:b});const C=ju(e);if(C&&d.validate(r,C)){h=!0,g=Date.now()-f;break}await Ja(Fu)}a.push({actionType:d.type,label:d.label,windowMs:tr,completed:h,reactionTimeMs:g}),c<s.length-1&&(t(null),await Ja(Ru))}t(null);const i=a.filter(c=>c.completed).length,o=i>=2;return{type:"rmas",actions:a,passed:o,confidence:Math.round(i/a.length*100),actionsCompleted:i,actionsTotal:a.length}}function Tu(e){const t=Ye()?fr(e,0,"baseline"):null;if(!t||t.landmarks.length<1404)return{mouthWidth:.1,browY:.3,lipDistance:.01,yaw:0};const n=t.landmarks;return{mouthWidth:vi(n,61,291),browY:n[10*3+1],lipDistance:Math.abs(n[13*3+1]-n[14*3+1]),yaw:t.headPose.yaw}}function ju(e){if(!Ye())return null;const t=fr(e,0,"baseline");if(!t||t.landmarks.length<1404)return null;const n=t.landmarks;return{leftEAR:t.leftEAR,rightEAR:t.rightEAR,mouthWidth:vi(n,61,291),browY:n[10*3+1],lipDistance:Math.abs(n[13*3+1]-n[14*3+1]),yaw:t.headPose.yaw}}function vi(e,t,n){const s=e[t*3]-e[n*3],r=e[t*3+1]-e[n*3+1];return Math.sqrt(s*s+r*r)}function Ja(e){return new Promise(t=>setTimeout(t,e))}var Eu=15e3;async function Pu(e,t,n,s,r){const a=Iu(e,t,n),i=new Promise(c=>{setTimeout(()=>{c({challengesRun:[],triggerSuspicionScore:e,flashReflection:null,rmas:null,passed:!1,hardReject:!1,timestamp:new Date().toISOString()})},Eu)}),o=Nu(e,a,s,r);return Promise.race([o,i])}function Iu(e,t,n){return n==="flash_reflection"?["flash_reflection"]:n==="rmas"?["rmas"]:e>=t+20?["flash_reflection","rmas"]:["flash_reflection"]}async function Nu(e,t,n,s){let r=null,a=null;s.setStepUpPhase("intro"),await Za(1500),t.includes("flash_reflection")&&(s.setStepUpPhase("flash"),r=await Mu(n,s.setFlashOverlayColor)),t.includes("rmas")&&(s.setStepUpPhase("rmas"),a=await Au(n,s.setRMASState)),s.setStepUpPhase("complete"),await Za(500);const i=$u(r,a,t),o=Ou(r,a,t);return{challengesRun:t,triggerSuspicionScore:e,flashReflection:r,rmas:a,passed:i,hardReject:o,timestamp:new Date().toISOString()}}function $u(e,t,n){return n.length===0?!1:n.length===1?e?e.passed:t?t.passed:!1:((e==null?void 0:e.passed)??!1)||((t==null?void 0:t.passed)??!1)}function Ou(e,t,n){const s=e!=null&&e.overallColorDelta<3,r=t!=null&&t.actionsCompleted===0;return!!(n.length>=2&&s&&r||n.length===1&&s||n.length===1&&r)}function Za(e){return new Promise(t=>setTimeout(t,e))}var Qa="verification_capture_engine",Lu=["face-guide","baseline","zoom","countdown","challenge","extra-check-brief","extra-check-done","step-up-round","step-up-intro","step-up-flash","step-up-rmas","step-up-complete"],rs=2e3,Bu=150,Du=200,Uu=1500,zu=8;function Hu(e){try{const s=document.createElement("canvas");s.width=64,s.height=48;const r=s.getContext("2d");if(!r)return 50;r.drawImage(e,0,0,64,48);const a=r.getImageData(0,0,64,48).data,i=new Float32Array(64*48);for(let h=0,g=0;h<a.length;h+=4,g++)i[g]=.299*a[h]+.587*a[h+1]+.114*a[h+2];let o=0,c=0;const d=63*47;for(let h=0;h<47;h++)for(let g=0;g<63;g++){const x=h*64+g,b=Math.abs(i[x]-i[x+1])+Math.abs(i[x]-i[x+64]);o+=b,c+=b*b}const f=o/d;return c/d-f*f}catch{return 50}}var Wu=()=>l.jsx("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round",strokeLinejoin:"round",children:l.jsx("polyline",{points:"20 6 9 17 4 12"})}),Vu=()=>l.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round",strokeLinejoin:"round",children:[l.jsx("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),l.jsx("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]}),qu=()=>l.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[l.jsx("circle",{cx:"12",cy:"12",r:"10"}),l.jsx("polyline",{points:"12 6 12 12 16 14"})]}),Gu=()=>l.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[l.jsx("path",{d:"M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"}),l.jsx("circle",{cx:"12",cy:"13",r:"4"})]}),ei=()=>l.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[l.jsx("circle",{cx:"12",cy:"12",r:"10"}),l.jsx("line",{x1:"12",y1:"8",x2:"12",y2:"12"}),l.jsx("line",{x1:"12",y1:"16",x2:"12.01",y2:"16"})]});function Yu({direction:e}){switch(e){case"left":return l.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"3",strokeLinecap:"round",strokeLinejoin:"round",children:[l.jsx("line",{x1:"19",y1:"12",x2:"5",y2:"12"}),l.jsx("polyline",{points:"12 19 5 12 12 5"})]});case"right":return l.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"3",strokeLinecap:"round",strokeLinejoin:"round",children:[l.jsx("line",{x1:"5",y1:"12",x2:"19",y2:"12"}),l.jsx("polyline",{points:"12 5 19 12 12 19"})]});case"up":return l.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"3",strokeLinecap:"round",strokeLinejoin:"round",children:[l.jsx("line",{x1:"12",y1:"19",x2:"12",y2:"5"}),l.jsx("polyline",{points:"5 12 12 5 19 12"})]});case"down":return l.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"3",strokeLinecap:"round",strokeLinejoin:"round",children:[l.jsx("line",{x1:"12",y1:"5",x2:"12",y2:"19"}),l.jsx("polyline",{points:"19 12 12 19 5 12"})]});default:return l.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",children:[l.jsx("circle",{cx:"12",cy:"12",r:"3"}),l.jsx("line",{x1:"12",y1:"2",x2:"12",y2:"6"}),l.jsx("line",{x1:"12",y1:"18",x2:"12",y2:"22"}),l.jsx("line",{x1:"2",y1:"12",x2:"6",y2:"12"}),l.jsx("line",{x1:"18",y1:"12",x2:"22",y2:"12"})]})}}var ti={head_turn:{title:"Head turn challenge",description:`You will be asked to turn your head in different directions.
Follow the on-screen arrows.`,tip:"Make sure you are in a well-lit area with your face clearly visible."},follow_dot:{title:"Follow the dot",description:`A dot will move around the screen.
Follow it with your gaze without moving your head.`,tip:"Stay still and move only your eyes."},speak_phrase:{title:"Speak a phrase",description:"You will be asked to read a short phrase aloud clearly.",tip:"Make sure you are in a quiet environment with your microphone enabled."}};function ni(e){return e==="left"||e==="right"||e==="up"||e==="down"?e:null}function Xu(e){return e>=1024*1024?`${(e/(1024*1024)).toFixed(1)} MB`:e>=1024?`${Math.round(e/1024)} KB`:`${e} B`}var Qu=({sessionData:e,environment:t,apiBaseUrl:n,primaryColor:s,logoUrl:r,displayName:a,appearance:i,copy:o,branding:c,sessionType:d,onComplete:f,onError:h,onCancel:g,onPhaseChange:x,onStreamInterrupted:b,showIntro:C=!0,showResultScreen:R=!0,allowRetryOnReject:T=!1,onRetry:j,liveSenseV4Enabled:B=!1,guidedCaptureEnabled:K=!0,theme:H})=>{const v=K!==!1,D=zo(),q=m.useMemo(()=>Vo({appearance:i,copy:o,theme:H,branding:c,sessionBranding:e.branding,primaryColor:s,logoUrl:r,displayName:a,prefersDark:D}),[i,o,H,c,e.branding,s,r,a,D]),W=m.useRef(q);W.current=q;const L=q.strings,Ue=q.theme.page.primary,fe=q.theme.logo.url??void 0,ke=q.theme.displayName??void 0,Ee=u=>{if(!u)return u;const p=W.current.strings.gateHint(u.id);return p?{...u,text:p.text,sub:p.sub}:u},_e=t??e.environment??"production",[k,z]=m.useState(C?"intro":"initializing"),[Pe,ze]=m.useState(!C),[de,xe]=m.useState("Initializing..."),[re,Me]=m.useState(0),[dt,ht]=m.useState(null),[He,E]=m.useState(null),[P,ie]=m.useState(null),[Oe,Ie]=m.useState(null),[Le,at]=m.useState(null),[ft,it]=m.useState(null),[Be,hs]=m.useState(null),[fs,ps]=m.useState(null),[rn,ms]=m.useState(null),[gr,gs]=m.useState(null),[Ku,ys]=m.useState(!1),[Ju,xs]=m.useState(0),[St,bs]=m.useState("idle"),[yr,xr]=m.useState(null),[Ft,br]=m.useState(null),[wr,ki]=m.useState(!1),[Rt,ws]=m.useState(null),[_i,vr]=m.useState(!1),[Mi,vs]=m.useState(!1),[Si,kr]=m.useState(!1),[_r,Fi]=m.useState(!1),Ke=m.useRef(new Xo),[Ri,Ci]=m.useState(0),[Dt,ot]=m.useState(null),[Ai,Je]=m.useState({}),[De,ks]=m.useState({W:0,H:0});m.useEffect(()=>{const u=un.current;if(!u||typeof ResizeObserver>"u")return;const p=()=>ks(w=>w.W===u.clientWidth&&w.H===u.clientHeight?w:{W:u.clientWidth,H:u.clientHeight});p();const y=new ResizeObserver(p);return y.observe(u),()=>y.disconnect()},[k]);const[Ti,ji]=m.useState(""),[Ei,Ct]=m.useState("error"),[Pi,Cn]=m.useState(!1),ye=m.useRef(null),pt=m.useRef(null),pe=m.useRef(null),ne=m.useRef([]),An=m.useRef(null),We=m.useRef([]),At=m.useRef(null),Mr=m.useRef(0),Sr=m.useRef(0),mt=m.useRef(""),gt=m.useRef(""),an=m.useRef(null),ae=m.useRef(!1),Y=m.useRef(0),Tn=m.useRef(0),yt=m.useRef(null),xt=m.useRef(null),Fr=m.useRef(null),Ze=m.useRef({}),Qe=m.useRef({}),Ut=m.useRef("initializing"),et=m.useRef(null),jn=m.useRef(null),Rr=m.useRef(Date.now()),En=m.useRef(0),on=m.useRef([]),Se=m.useRef(null),cn=m.useRef(null),ln=m.useRef(!1),Tt=m.useRef(b);Tt.current=b;const un=m.useRef(null),Ii=m.useRef(null),Cr=m.useRef(null),Ve=m.useRef(null),Pn=m.useRef(0);m.useRef(0);const bt=m.useRef(!1),wt=m.useRef(null),_s=m.useRef(new Ma),In=m.useRef(new Ca),dn=m.useRef(null),Ms=m.useRef(!1),Nn=m.useRef(!1),Ar=m.useRef(0),Tr=m.useRef(30),zt=m.useRef(0),jr=m.useRef(void 0),Er=m.useRef(void 0),Ss=m.useRef(null),hn=m.useRef(null),Fs=m.useRef(new Fc),fn=m.useRef(null),Pr=m.useRef(null),Rs=m.useRef(!1),[Ni,Ir]=m.useState(!1),$n=m.useRef(!1),On=m.useRef(0),Ln=m.useRef(0),Cs=m.useRef(0),Bn=m.useRef(!1),Dn=m.useRef(0),Un=m.useRef(!1),zn=m.useRef(!1),Ht=m.useRef(0),Wt=m.useRef(null),Hn=m.useRef(new cc),As=m.useRef(!1),Vt=m.useRef(null),Wn=m.useRef(null);Wn.current=m.useMemo(()=>su(e.evidence),[e.evidence]);const ct=m.useRef(null),Nr=m.useRef(null),$r=m.useRef(!1),Ts=m.useRef(new Zl),js=m.useRef([]),qt=m.useRef([]),Or=m.useRef(!1),Lr=m.useRef(0),Es=m.useRef(()=>{}),Fe=m.useRef(e.policy),qe=m.useRef(null),Br=m.useRef(new Ma),Gt=m.useRef({}),Dr=m.useRef(new Ca),$i=m.useRef(0),Ps=m.useRef([]),vt=m.useRef(!1),tt=m.useRef(()=>{}),Ur=m.useRef(()=>{}),Oi=m.useRef(!1),U=m.useCallback((u,p)=>{Ut.current=u,z(u),xe(p),x==null||x(u,p),console.log(`[UseSense] Phase: ${u} -- ${p}`)},[x]),Is=q.theme.typography.fontCss;m.useEffect(()=>{if(Is){qo(Is);return}const u="usesense-fonts";if(!document.getElementById(u)){const p=document.createElement("link");p.id=u,p.rel="stylesheet",p.href=Po,document.head.appendChild(p)}},[Is]),m.useEffect(()=>{typeof window<"u"&&window.__USESENSE_BRAND_TRACE__&&console.log(`[UseSense] Brand:
  ${jo(q.theme).join(`
  `)}`)},[q]),m.useEffect(()=>()=>{var u;ae.current=!0,yt.current&&clearInterval(yt.current),xt.current&&clearInterval(xt.current),pe.current&&pe.current.getTracks().forEach(p=>p.stop()),(u=ct.current)==null||u.cancel(),Ts.current.stop(),Bc()},[]);const zr=m.useRef(Promise.resolve()),Hr=async u=>{if(Ha(ne.current.length)||Se.current&&ne.current.length>=Se.current.maxFrames)return null;const p=ye.current;if(!p||p.readyState<2)return null;An.current||(An.current=document.createElement("canvas"));const y=An.current,w=Ts.current.latest,S=await Xl(p,ne.current.length,Sr.current,y);if(!S||Ha(ne.current.length))return null;S.index=ne.current.length,S.phase=u,ne.current.push(S),xs(ne.current.length);let _=null;if(Ye()&&(_=fr(p,S.index,u,y),_)){const N=Jl(S.drawnAt,w);N!==S.drawnAt&&js.current.push(S.drawnAt-N),_.captureMs=er(N,Pn.current)??void 0,We.current.push(_)}if(et.current){const N=Hu(p),M=(_==null?void 0:_.headPose)??{yaw:0,pitch:0,roll:0};et.current.push(M,S.luminance,N),on.current.push(S.luminance)}return S},Ns=m.useRef(Hr);Ns.current=Hr;const be=m.useCallback(u=>{const p=zr.current.then(()=>Ns.current(u),()=>Ns.current(u));return zr.current=p.catch(()=>null),p},[]),$s=m.useCallback(()=>{xt.current&&clearInterval(xt.current),xt.current=setInterval(()=>{const u=ye.current;if(!u||u.readyState<2)return;const p=160,y=120,w=document.createElement("canvas");w.width=p,w.height=y;const S=w.getContext("2d");if(!S)return;S.drawImage(u,0,0,p,y);const _=S.getImageData(0,0,p,y).data,N=p*y,M=new Float32Array(N);let A=0,O=0;for(let V=0,Q=0;V<_.length;V+=4,Q++){const F=.299*_[V]+.587*_[V+1]+.114*_[V+2];M[Q]=F,A+=F,F>245&&O++}const I=A/N,$=O/N*100;let me=0,oe=0;const le=(p-1)*(y-1);for(let V=0;V<y-1;V++)for(let Q=0;Q<p-1;Q++){const F=V*p+Q,ee=Math.abs(M[F]-M[F+1]),J=Math.abs(M[F]-M[F+p]),te=ee+J;me+=te,oe+=te*te}const ce=me/le,ve=oe/le-ce*ce;let G=0;const X=Fr.current;if(X){for(let V=0;V<N;V++)G+=Math.abs(M[V]-X[V]);G/=N}Fr.current=M,I<45?it("Too dark — move to a brighter area"):$>15?it("Too bright — avoid direct light"):ve<20?it("Hold still — image is blurry"):X&&G>8?it("Hold still — too much movement"):it(null)},500)},[]),Vn=m.useCallback(async()=>{var u,p;U("camera-request","Requesting camera access...");try{const y=!v&&Fe.current.challenge_type==="speak_phrase",w=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:"user",frameRate:{ideal:30}},audio:y});pe.current=w,ye.current&&(ye.current.srcObject=w,await ye.current.play()),pt.current&&(pt.current.srcObject=w,await pt.current.play()),Pn.current=performance.now(),ye.current&&Ts.current.start(ye.current),js.current=[],console.log("[UseSense] Camera access granted"),cn.current=null,wa(w,Qa).then(N=>{pe.current===w&&(cn.current=N)}).catch(()=>{cn.current=null}),ln.current=!1;const S=()=>{var N;pe.current!==w||ln.current||Lu.includes(Ut.current)&&(ln.current=!0,ae.current=!0,console.error("[UseSense] Camera stream interrupted mid-capture"),ie("Your camera was disconnected during capture. Please try again."),Ct("camera_stopped"),tt.current=()=>Kt.current(),U("camera-error","Camera disconnected"),(N=Tt.current)==null||N.call(Tt))};w.getTracks().forEach(N=>N.addEventListener("ended",S)),(u=w.addEventListener)==null||u.call(w,"inactive",S),(p=At.current)!=null&&p.permissions_state&&(At.current.permissions_state.camera="granted",y&&(At.current.permissions_state.microphone="granted"));const _=Fe.current.challenge_type;!v&&_!=="none"&&ti[_]?U("challenge-brief","Ready to start"):Os()}catch(y){console.error("[UseSense] Camera error:",y),ie(Ql(y)),Ct(vl(y)),tt.current=()=>Kt.current(),U("camera-error","Camera error")}},[e,U,$s]),Os=m.useCallback(()=>{if(U("face-guide","Position your face in the oval"),Ke.current.reset(),Tn.current=0,v){On.current||(On.current=performance.now()),Ln.current=0,Bn.current=!1,Cs.current=performance.now();return}$s(),yt.current&&clearInterval(yt.current),yt.current=setInterval(()=>{if(ae.current||Ut.current!=="face-guide")return;const u=ye.current;if(!u||u.readyState<2)return;const p=Ye()?Dc(u):{faceDetected:!0,faceCentered:!0,faceDistance:"good",faceVisible:!0,message:"Position your face in the oval",ready:!1};E(p),p.ready?(Tn.current++,Tn.current>=zu&&qn()):Tn.current=0},250)},[U,$s]),qn=m.useCallback(()=>{yt.current&&(clearInterval(yt.current),yt.current=null),Ui()},[]),Li=800,Wr=6e3,Bi=m.useCallback(async(u=Y.current)=>{const p=()=>ae.current||u!==Y.current;if(!B||(U("zoom","Bring the phone closer to fill the oval"),await $e(Li),p()))return;const y=e.upload.target_fps||4,w=nt(y),S=performance.now();for(;performance.now()-S<Wr&&!p();)await be("zoom"),await $e(w)},[B,e,U,be]),Di=()=>{var p;const u=(p=Wn.current)==null?void 0:p.colourSequence;if(!v||!u)return null;if(!ct.current){const y=new ou(u,w=>er(w,Pn.current||null),{lockWhiteBalance:w=>{var S;return cu((S=pe.current)==null?void 0:S.getVideoTracks()[0],w)}});y.host={showTint:(w,S)=>{$r.current=w!==null;const _=Nr.current;_&&(_.style.backgroundColor=w??"transparent",_.style.opacity=w?String(S):"0")}},ct.current=y}return ct.current},Vr=m.useCallback(()=>{var u;ne.current=[],We.current=[],on.current=[],xs(0),et.current=new ss(((u=e.policy.inline_step_up)==null?void 0:u.suspicion_threshold)??55)},[e]),qr=m.useCallback(async(u=Y.current)=>{var I;const p=()=>ae.current||u!==Y.current,y=e.upload.target_fps||4,w=nt(y);let S=0,_=performance.now(),N=null;Ht.current=0,(I=Ve.current)==null||I.startSweep(_);const M=Di();qt.current=[];let A=null,O=0;for(;;){if(p())return M==null||M.cancel(),!1;const $=performance.now(),me=Nn.current;if(me)N!==null&&(N=null),S+=Math.min($-_,1e3),await be("baseline");else if(N===null)N=$;else if(!Un.current&&$-N>tn.maxPauseMs)return Dn.current++,console.log(`[UseSense] Scan paused > ${tn.maxPauseMs} ms; discarding (paused window ${Dn.current})`),M==null||M.resetForNewWindow(),Vr(),Ht.current=0,Me(0),Os(),!1;_=$;let oe=rs;if(M){const ce=Nn.current;!ce&&M.isPlaying?(M.interrupt("gate_pause"),A=null,console.log("[UseSense] colour: paused by the gate")):ce&&M.canPlay&&(A=S+M.remainingMs()+Bu,console.log(`[UseSense] colour: play ${M.runs+1} from colour ${M.nextIndex+1} at ${Math.round(S)} ms`),M.play()),M.isPlaying&&A!==null&&(oe=Math.max(rs,A))}if(O=Math.max(O,Math.min(1,S/oe)),Ht.current=O,Me(Math.min(O*50,50)),S>=oe)break;const le=M!=null&&M.isPlaying?Math.min(w,Du):w;await $e(me?le:50)}if(M!=null&&M.isPlaying&&M.interrupt("scan_ended"),M){const $=M.record;console.log(`[UseSense] colour: completed=${$.completed} segments=${$.segments.length} awb_locked=${$.awb_locked}${$.interrupted_reason?` interrupted=${$.interrupted_reason}`:""}`)}return Ht.current=1,ns([20,60,20]),!0},[e,be,Vr]),Ui=m.useCallback(async(u=Y.current)=>{const p=()=>ae.current||u!==Y.current;U("baseline",v?"Hold still":"Keep your face still..."),Me(0),Sr.current=performance.now(),En.current=Date.now();const y=e.upload.target_fps||4,w=nt(y),S=performance.now();if(v){if(!await qr(u))return}else for(;performance.now()-S<rs&&!p();){await be("baseline");const N=performance.now()-S;Me(Math.min(N/rs*50,50)),await $e(w)}if(p())return;Mr.current=ne.current.length,B&&await Bi(u);const _=Fe.current.challenge_type;if(v&&_!=="none"){Kn.current(u,1);return}if(_==="none"){if(pn()&&(await mn(u),p()))return;lt(u)}else zi(u)},[e,U,be,qr]),zi=m.useCallback(async(u=Y.current)=>{const p=()=>ae.current||u!==Y.current;U("countdown","Get ready...");const y=e.upload.target_fps||4,w=nt(y);for(const S of[3,2,1]){if(p())return;ht(S);const _=performance.now()+1e3;for(;performance.now()<_&&!p();)await be("baseline"),await $e(w)}ht(null),!p()&&Hi(u)},[e,U,be]),Hi=m.useCallback(async(u=Y.current)=>{if(ae.current||u!==Y.current)return;const y=Fe.current.challenge_type;switch(mt.current=new Date().toISOString(),y){case"head_turn":await Gr(u);break;case"follow_dot":await Yr(u);break;case"speak_phrase":await Wi(u);break;default:lt(u)}},[e]),Gr=m.useCallback(async(u=Y.current)=>{var M;const p=()=>ae.current||u!==Y.current;U("challenge","Follow the instructions");const y=((M=Se.current)==null?void 0:M.challenge)??Fe.current.challenge;if(!(y!=null&&y.sequence)){Se.current?Yt(u):lt(u);return}const w=e.upload.target_fps||4,S=nt(w),_=y.sequence;Ze.current={},_.forEach(A=>{Ze.current[String(A.index)]=[]});const N={left:"Turn your head LEFT",right:"Turn your head RIGHT",up:"Tilt your head UP",down:"Tilt your head DOWN",center:"Look straight ahead"};for(let A=0;A<_.length;A++){if(p())return;const O=_[A];ms(O.direction),xe(N[O.direction]||"Follow the instructions"),Me(50+A/_.length*50);const I=performance.now()+O.duration_ms;for(;performance.now()<I&&!p();){const $=await be("challenge");$&&Ze.current[String(O.index)].push($.index),await $e(S)}}if(ms(null),!p()){if(Me(100),gt.current=new Date().toISOString(),Se.current){Yt(u);return}pn()&&await mn(u),lt(u)}},[e,U,be]),Yr=m.useCallback(async(u=Y.current)=>{var N;const p=()=>ae.current||u!==Y.current;U("challenge","Follow the dot with your eyes");const y=((N=Se.current)==null?void 0:N.challenge)??Fe.current.challenge;if(!(y!=null&&y.waypoints)){Se.current?Yt(u):lt(u);return}const w=e.upload.target_fps||4,S=nt(w),_=y.waypoints;Qe.current={},_.forEach(M=>{Qe.current[String(M.index)]=[]});for(let M=0;M<_.length;M++){if(p())return;const A=_[M];ps({x:A.x*100,y:A.y*100}),Me(50+M/_.length*50);const O=performance.now()+A.duration_ms;for(;performance.now()<O&&!p();){const I=await be("challenge");I&&Qe.current[String(A.index)].push(I.index),await $e(S)}}if(ps(null),!p()){if(Me(100),gt.current=new Date().toISOString(),Se.current){Yt(u);return}pn()&&await mn(u),lt(u)}},[e,U,be]),Wi=m.useCallback(async(u=Y.current)=>{const p=()=>ae.current||u!==Y.current,y=Fe.current.audio_challenge,w=(y==null?void 0:y.phrase)||"3 7 2 9 1",S=(y==null?void 0:y.total_duration_ms)||5e3;U("challenge","Please say the phrase below"),gs(w),ys(!0);const _=e.upload.target_fps||4,N=nt(_),M=pe.current,A=M?Wa(M,S):Promise.resolve(null),O=performance.now();for(;performance.now()-O<S&&!p();){await be("challenge");const $=performance.now()-O;Me(50+$/S*50),await $e(N)}const I=await A;an.current=I,ys(!1),gs(null),!p()&&(Me(100),gt.current=new Date().toISOString(),pn()&&await mn(u),lt(u))},[e,U,be]),pn=()=>{var u;return Ml(Fe.current.inline_step_up??e.policy.inline_step_up,!!((u=et.current)!=null&&u.shouldTrigger()))},mn=m.useCallback(async(u=Y.current)=>{var O;const p=()=>ae.current||u!==Y.current;if(p())return;const y=ye.current;if(!y)return;const w=e.policy.inline_step_up,S=((O=et.current)==null?void 0:O.getScore())??0;console.log(`[UseSense] Inline step-up: suspicion ${S}`);const _=await Pu(S,(w==null?void 0:w.suspicion_threshold)??55,(w==null?void 0:w.preferred_challenge)??"auto",y,{setFlashOverlayColor:xr,setRMASState:br,setStepUpPhase:I=>{bs(I);const $={intro:"Additional verification...",flash:"Hold still...",rmas:"Follow the prompts",complete:"Verification complete"};U("step-up-"+I,$[I])}});jn.current=_;const N=e.upload.target_fps||3,M=nt(N),A=performance.now()+500;for(;performance.now()<A&&!p();)await be("challenge"),await $e(M);bs("idle")},[e,U,be]),Xr=()=>{var p;return Kl(ne.current.map(y=>y.hash),We.current.map(y=>y.landmarks))?(console.warn(`[UseSense] Camera feed froze: ${ne.current.length} identical frames; not uploading`),ae.current=!0,ie("Your camera stopped sending a live picture. Please try again."),Ct("camera_stopped"),tt.current=()=>Kt.current(),U("camera-error","Camera disconnected"),(p=Tt.current)==null||p.call(Tt),!0):!1},Kr=async()=>{var p;let u=null;if(We.current.length>0)try{const y=[],w=[],S=(p=e.geometric_coherence)==null?void 0:p.mesh_binding_challenge,_=ne.current.map(M=>M.hash),N=Wn.current;for(const M of au(We.current,_))if(M.landmarks&&M.landmarks.length>=1404){const A=Hc(M.landmarks);if(A){w.push(A);const O=_[M.frameIndex],I=N?ru({landmarks:M.landmarks,matrix:M.facialTransformationMatrix,blendshapes:M.blendshapes}):null,$=I?I.landmarks:M.landmarks.slice(0,1404),me=(I==null?void 0:I.pose)??A.pose,oe=await Hl(A.shapeParams,me,A.depthPlausibility,$),le=S&&O?await Wl(S,O,oe).catch(ve=>(console.warn("[UseSense] Binding proof failed:",ve),"")):"",ce={frameIndex:M.frameIndex,timestamp:I&&typeof M.captureMs=="number"?M.captureMs:M.timestamp,shapeParams:A.shapeParams,pose:me,depthPlausibility:A.depthPlausibility,geometricRatios:A.geometricRatios,poseRatios2D:A.poseRatios2D,landmarks:$,frameHash:O,meshDigest:oe,bindingProof:le,poseNormalizationMethod:I!=null&&I.pose?wi:tu,...I!=null&&I.transformMatrix?{transformMatrix:I.transformMatrix}:{},...I!=null&&I.blendshapes?{blendshapes:I.blendshapes}:{}};y.push(ce)}}if(y.length>0){const M=Xc(w),A=Kc(w,M);u={frames:y,crossFrameConsistency:M,crossFrameConsistencyMethod:"cv_v1",preliminaryScore:A,attestation:{platform:"web"}},console.log(`[UseSense] Mesh package: ${y.length} frames, GC score: ${A}`)}}catch(y){console.warn("[UseSense] Mesh package assembly failed:",y)}return u},Jr=async u=>{const p=At.current||{};p.frame_timestamps=u,p.avg_frame_interval_ms=u.length>=2?Math.round((u[u.length-1]-u[0])/(u.length-1)):0,p.camera_permission_granted=!!pe.current,p.camera_resolution=ye.current?`${ye.current.videoWidth}x${ye.current.videoHeight}`:void 0,pe.current&&p.permissions_state&&(p.permissions_state.camera="granted");try{const y=cn.current??await wa(pe.current,Qa);y&&(p.capture_source=y)}catch(y){console.warn("[UseSense] capture_source collection failed:",y)}return p.screen_detection=gu(on.current,An.current),p},lt=m.useCallback(async(u=Y.current)=>{var y,w,S,_,N;const p=()=>ae.current||u!==Y.current;if(!p()){if(v&&qi()){Xn(new Error("Session expired"),()=>gn.current(u));return}if(!Xr()){U("uploading","Uploading verification data..."),Ke.current.advance("sending",performance.now()),xt.current&&(clearInterval(xt.current),xt.current=null);try{const M=Fe.current.challenge_type,A=ne.current.map(F=>F.timestamp);let O=null;if(M==="head_turn"){const F=Fe.current.challenge;O={type:"head_turn",seed:(F==null?void 0:F.seed)||"",completed:!0,step_frames:Ze.current,...Gt.current,started_at:mt.current,completed_at:gt.current,frame_timestamps:A}}else if(M==="follow_dot"){const F=Fe.current.challenge;O={type:"follow_dot",seed:(F==null?void 0:F.seed)||"",completed:!0,waypoint_frames:Qe.current,...Gt.current,started_at:mt.current,completed_at:gt.current,frame_timestamps:A}}else if(M==="speak_phrase"){const F=Fe.current.audio_challenge;O={type:"speak_phrase",seed:(F==null?void 0:F.seed)||"",completed:!0,started_at:mt.current,completed_at:gt.current}}else O={type:"none",completed:!0};const I=await Kr(),$=await Jr(A),me=ne.current.map(F=>F.hash),oe=We.current.length>0?{model:"mediapipe_face_landmarker_v2",frame_count:We.current.length,frames:We.current.map(F=>({frame_index:F.frameIndex,timestamp_ms:F.timestamp,headPose:F.headPose,leftEAR:F.leftEAR,rightEAR:F.rightEAR,bbox:F.bbox}))}:null,le=ne.current.map(F=>({frame_index:F.index,capture_timestamp_ms:F.timestamp,resolution_w:F.resolution.w,resolution_h:F.resolution.h})),ce=((y=et.current)==null?void 0:y.getSnapshot())??{final_score:0,triggered:!1,snapshot:{score:0,signals:[],framesAnalyzed:0,reliable:!1,timestamp:Date.now()}},G={session_id:e.session_id,sdk_version:Zs,platform:"web",source:"sdk",client_capabilities:si,capture_config:{captureDurationMs:e.upload.capture_duration_ms,targetFps:e.upload.target_fps,maxFrames:e.upload.max_frames},timestamps:{session_started_at_ms:Rr.current,capture_started_at_ms:En.current,capture_ended_at_ms:Date.now()},frames_manifest:le,frame_hashes:me,channel_integrity:$,challenge_response:O,face_mesh_signals:oe,verification_package:I,suspicion:ce,inline_step_up:jn.current,deep_classifier_on_device:null,...Wn.current?{evidence:uu({meshAvailable:Ye(),colour:((w=ct.current)==null?void 0:w.record)??null})}:{},...B?{frame_phases:ne.current.map(F=>F.phase??"other"),zoom_motion:{frames_total:ne.current.length,frames_in_zoom:ne.current.filter(F=>F.phase==="zoom").length,expected_duration_ms:Wr,sdk_version:Zs}}:{}};if(console.log("[UseSense] Upload metadata summary:",{channel_integrity_fields:Object.keys($).length,has_user_agent:!!$.user_agent,challenge_type:(O==null?void 0:O.type)??"none",verification_package_frames:((S=I==null?void 0:I.frames)==null?void 0:S.length)??0,frame_hashes_count:me.length,frame_count:ne.current.length,suspicion_score:ce.final_score,suspicion_frames_analyzed:ce.snapshot.framesAnalyzed,suspicion_signals:ce.snapshot.signals.map(F=>`${F.name}=${F.score}`),inline_step_up:jn.current?"present":"null",evidence:G.evidence?`colour ${((_=G.evidence.colour)==null?void 0:_.segments.length)??"none"} segments, capability ${JSON.stringify(G.evidence.capability)}`:"not issued"}),(N=G.evidence)!=null&&N.colour){const F=G.evidence.colour,ee=((I==null?void 0:I.frames)??[]).map(Z=>Z.timestamp);console.log("[UseSense] colour: segments",F.segments.map(Z=>`${Z.colour}@${Z.start_ms}-${Z.end_ms}`).join(" "),"| frames in window",hu(F.segments,ee).join(","),"| frame ms",ee.join(",")),console.log(`[UseSense] colour: optical onset ms ${fu(qt.current,F.segments).map(Z=>Z===null?"-":String(Z)).join(",")} (${qt.current.length} tracked frames; server skips the first 150 ms)`);const J=mu(qt.current,F.segments);console.log(`[UseSense] colour: lag fit ${J?`best ${J.lagMs} ms (corr ${J.corr}), at 0 ms corr ${J.corrAtZero}, ${J.frames} frames`:"not enough frames"}`);const te=[...js.current].sort((Z,se)=>Z-se);console.log(`[UseSense] frame clock: ${te.length?`capture time on ${te.length} frames, draw minus capture median ${Math.round(te[te.length>>1])} ms, max ${Math.round(te[te.length-1])} ms`:"no capture time (draw time used)"}`)}const X=ne.current.map(F=>F.bytes),V=await Ba({apiBaseUrl:n,environment:_e,sessionId:e.session_id,sessionToken:e.session_token,nonce:e.nonce,frames:X,metadata:G,audioBlob:an.current,onProgress:hs});console.log("[UseSense] Upload successful"),Oi.current=!0,Ke.current.advance("checking",performance.now());const Q=fo(V);if(Q&&pe.current&&!ln.current){Vi(Q,u);return}Gn(u)}catch(M){if(console.error("[UseSense] Upload failed:",M),p())return;if(v){Xn(M,()=>gn.current(u));return}const A=M.message||"Upload failed";Ie(A),U("failed","Upload failed"),h(A)}}}},[e,_e,n,U,h]),Vi=m.useCallback(async(u,p=Y.current)=>{var w;const y=()=>ae.current||p!==Y.current;if(!y()){if(Se.current=u,ne.current=[],We.current=[],on.current=[],et.current=new ss(((w=e.policy.inline_step_up)==null?void 0:w.suspicion_threshold)??55),Ze.current={},Qe.current={},hs(null),En.current=Date.now(),v){const S=u.challenge;ji(ol(S.type,S.type==="head_turn"?S.sequence:void 0,W.current.strings)),Ur.current=()=>{y()||Ut.current!=="extra-check-brief"||Kn.current(p,2)},U("extra-check-brief","One more quick check");return}U("step-up-round","One more quick check. Get ready..."),await $e(Uu),!y()&&(mt.current=new Date().toISOString(),u.challenge.type==="head_turn"?await Gr(p):await Yr(p))}},[U]),Yt=m.useCallback(async(u=Y.current)=>{var w,S;const p=()=>ae.current||u!==Y.current,y=Se.current;if(!(p()||!y)&&!Xr()){U("uploading","Uploading verification data..."),Ke.current.advance("sending",performance.now());try{const _=y.challenge.type==="head_turn"?Ze.current:Qe.current,N=ne.current.map($=>$.timestamp),M=await Kr(),A=await Jr(N),O=((w=et.current)==null?void 0:w.getSnapshot())??{final_score:0,triggered:!1,snapshot:{score:0,signals:[],framesAnalyzed:0,reliable:!1,timestamp:Date.now()}},I=mo({sessionId:e.session_id,sdkVersion:Zs,challenge:y.challenge,frameMap:_,startedAt:mt.current,completedAt:gt.current,frames:ne.current,meshSignals:We.current,captureStartedAtMs:En.current,captureEndedAtMs:Date.now(),responseExtras:Gt.current,channelIntegrity:A,suspicion:O,verificationPackage:M});console.log("[UseSense] Round 2 metadata summary:",JSON.stringify({frames:ne.current.length,channel_integrity_fields:Object.keys(A).length,capture_source:!!A.capture_source,verification_package_frames:((S=M==null?void 0:M.frames)==null?void 0:S.length)??0,suspicion_frames_analyzed:O.snapshot.framesAnalyzed})),await Ba({apiBaseUrl:n,environment:_e,sessionId:e.session_id,sessionToken:e.session_token,nonce:e.nonce,frames:ne.current.map($=>$.bytes),metadata:I,onProgress:hs,round:2}),console.log("[UseSense] Step-up round uploaded"),Ke.current.advance("checking",performance.now()),Gn(u)}catch(_){if(console.error("[UseSense] Step-up upload failed:",_),p())return;if(v){Xn(_,()=>Jn.current(u));return}const N=_.message||"Upload failed";Ie(N),U("failed","Upload failed"),h(N)}}},[e,_e,n,U,h]),Gn=m.useCallback(async(u=Y.current)=>{const p=()=>ae.current||u!==Y.current;if(!p()){U("completing","Verifying..."),Ke.current.advance("checking",performance.now());try{const y=await $l({apiBaseUrl:n,environment:_e,sessionId:e.session_id,sessionToken:e.session_token,nonce:e.nonce});console.log("[UseSense] Decision:",y.decision),pe.current&&(pe.current.getTracks().forEach(w=>w.stop()),pe.current=null),Ke.current.advance("done",performance.now()),f(y),at(y),U("done","Complete")}catch(y){if(console.error("[UseSense] Complete failed:",y),p())return;if(v){Xn(y,()=>na.current(u),!0);return}const w=y.message||"Verification failed";Ie(w),U("failed","Verification failed"),h(w)}}},[e,_e,n,U,f,h]),Yn=m.useCallback(()=>{var u,p;Ke.current.reset(),ne.current=[],We.current=[],Ze.current={},Qe.current={},Mr.current=0,an.current=null,xs(0),Me(0),at(null),ie(null),Ie(null),it(null),ps(null),ms(null),gs(null),ys(!1),ht(null),Y.current++,ae.current=!1,ln.current=!1,cn.current=null,pe.current&&(pe.current.getTracks().forEach(y=>y.stop()),pe.current=null),et.current=new ss(((u=e.policy.inline_step_up)==null?void 0:u.suspicion_threshold)??55),jn.current=null,on.current=[],bs("idle"),xr(null),br(null),_s.current.reset(),In.current.reset(),dn.current=null,ws(null),Ms.current=!1,vr(!1),Nn.current=!1,On.current=0,Dn.current=0,Un.current=!1,zn.current=!1,vs(!1),hn.current=null,bt.current=!1,kr(!1),Fs.current.reset(),$n.current=!1,Rs.current=!1,Ir(!1),Ss.current=null,Se.current=null,Ht.current=0,(p=ct.current)==null||p.cancel(),ct.current=null,qe.current=null,ot(null),Je({}),vt.current=!1,Cn(!1),Ps.current=[]},[e]),Xt=m.useCallback(()=>{Yn(),Vn()},[Yn,Vn]),qi=()=>{const u=e.expires_at?Date.parse(e.expires_at):NaN,p=Number.isFinite(u)?u:Rr.current+bl;return Date.now()>p},Xn=(u,p,y=!1)=>{const w=wl(u,typeof navigator>"u"||navigator.onLine!==!1),S=(u==null?void 0:u.message)||(y?"Verification failed":"Upload failed");if(Ie(S),w==="offline"&&!y){tt.current=p,U("upload-failed","Couldn't send your scan");return}if(w==="expired"){Ct("expired"),tt.current=()=>(j??g??Kt.current)(),U("failed","Timed out"),h(S);return}Ct(w==="offline"?"offline":"error"),tt.current=p,U("failed",y?"Verification failed":"Upload failed"),h(S)},Gi=()=>{Br.current.reset(),Dr.current.reset(),Hn.current.reset(),As.current=!1},Yi=()=>{const u=un.current;u&&ks({W:u.clientWidth,H:u.clientHeight})},Zr=async(u,p)=>{const y=()=>ae.current||u!==Y.current;if(!y()){if(gt.current=new Date().toISOString(),p===1&&pn()){if(qe.current=null,ot(null),Je({}),await mn(u),y())return}else{const w=W.current.strings.t("extraCheck","done");if(ot({text:w,paused:!1}),Je({tick:!0}),ns([20,60,20]),U("extra-check-done",w),await $e(rt.doneMs),y())return}for(;vt.current&&!y();)await $e(100);y()||(qe.current=null,ot(null),Je({}),p===2?Jn.current(u):gn.current(u))}},Qr=async(u,p)=>{var V,Q;var y;const w=()=>ae.current||u!==Y.current;if(w())return;const S=Fe.current,_=p===2?(V=Se.current)==null?void 0:V.challenge:S.challenge,N=p===2?_==null?void 0:_.type:S.challenge_type;if(Yi(),Gi(),p===2&&Ke.current.reset(),N==="speak_phrase"){await Ls.current(u);return}if(N==="head_turn"&&Array.isArray(_==null?void 0:_.sequence)&&_.sequence.length)Ze.current={},_.sequence.forEach(F=>{Ze.current[String(F.index)]=[]}),qe.current={kind:"head_turn",runner:new Pa({kind:"head_turn",steps:_.sequence},1,W.current.strings),state:null,faceOk:!0,progress:0,done:!1};else if(N==="follow_dot"&&Array.isArray(_==null?void 0:_.waypoints)&&_.waypoints.length)Qe.current={},_.waypoints.forEach(F=>{Qe.current[String(F.index)]=[]}),qe.current={kind:"follow_dot",runner:new Pa({kind:"follow_dot",waypoints:_.waypoints},1,W.current.strings),state:null,faceOk:!0,progress:0,done:!1};else{console.warn(`[UseSense] Extra check "${N}" has no steps; skipping`),p===2?Jn.current(u):gn.current(u);return}mt.current=new Date().toISOString(),Gt.current={};const M=Date.now()-performance.now(),A=qe.current,O=A.runner,I=O.display();A.display=I,ot({text:I.text,sub:I.sub,paused:!1}),Je(A.kind==="head_turn"?{arrow:ni(I.arrow)}:{dot:I.dot,trail:I.trail}),U("challenge",I.text);const $=e.upload.target_fps||4,me=nt($),oe=A.kind==="head_turn"?Ze.current:Qe.current,le=Math.min(30,p===2?((Q=Se.current)==null?void 0:Q.maxFrames)??20:e.upload.max_frames||30);let ce=-1,ve=ne.current.length,G=le,X=0;for(;!w();){const F=qe.current;if(!F||F!==A)return;if(O.finished)break;O.stepIndex!==ce&&(ce=O.stepIndex,ve=ne.current.length,G=dl(le-ve,O.stepCount-O.stepIndex));const ee=ne.current.length-ve,J=O.bankReason,te=J==="on_target"||J==="settled"&&ee<ul,Z=performance.now();if(F.faceOk&&te&&ee<G&&Z>=X&&!vt.current&&!0){X=Z+me;const Ae=O.specStepIndex,ge=await be("challenge");ge&&(oe[y=String(Ae)]??(oe[y]=[])).push(ge.index)}await $e(50)}w()||(Gt.current={step_events:O.stepEvents(M),...A.kind==="follow_dot"?{preview_mirrored:!0}:{}},console.log("[UseSense] Extra check steps:",JSON.stringify(Gt.current.step_events)),!w()&&await Zr(u,p))},Xi=(u,p)=>{var w;if(ae.current||u!==Y.current)return;console.warn("[UseSense] Microphone unavailable:",(p==null?void 0:p.name)||p);const y=(w=At.current)==null?void 0:w.permissions_state;y&&(y.microphone="denied"),qe.current=null,ot(null),Je({}),U("mic-denied","Microphone needed")},ea=async u=>{const p=()=>ae.current||u!==Y.current;if(!p())try{const y=await Ol({apiBaseUrl:n,environment:_e,sessionId:e.session_id,sessionToken:e.session_token,reason:"microphone_unavailable"});if(p())return;Fe.current=y.policy,an.current=null,console.log(`[UseSense] Challenge fallback: now ${y.policy.challenge_type}`),Kn.current(u,1)}catch(y){if(p())return;const w=y instanceof is?y.code:"server";console.error("[UseSense] Challenge fallback failed:",y),Ct(w==="network"?"offline":"error"),tt.current=w==="network"?()=>Bs.current(u):()=>Kt.current(),U("failed","Challenge fallback failed"),w!=="network"&&h((y==null?void 0:y.message)||"Challenge fallback failed")}},ta=async u=>{var Q;const p=()=>ae.current||u!==Y.current;if(p())return;const y=Fe.current.audio_challenge,w=yl((y==null?void 0:y.phrase)||"3 7 2 9 1"),S=(y==null?void 0:y.total_duration_ms)||5e3;qe.current={kind:"speak_phrase",state:null,faceOk:!0,progress:0,done:!1},Ps.current=[];const _=W.current.strings;ot({text:_.t("extraCheck","speakDigits"),paused:!1}),Je({digits:w,meter:Na([])}),U("challenge",_.t("extraCheck","speakDigits"));let N;try{if(N=await navigator.mediaDevices.getUserMedia({audio:!0}),!N.getAudioTracks().length)throw Object.assign(new Error("No microphone input"),{name:"NotFoundError"})}catch(F){Xi(u,F);return}if(p()){N.getTracks().forEach(F=>F.stop());return}const M=(Q=At.current)==null?void 0:Q.permissions_state;M&&(M.microphone="granted");let A=null,O=null,I=null;try{const F=window.AudioContext??window.webkitAudioContext;F&&(A=new F,O=A.createAnalyser(),O.fftSize=1024,A.createMediaStreamSource(N).connect(O),I=new Float32Array(O.fftSize),await A.resume().catch(()=>{}))}catch(F){console.warn("[UseSense] Mic meter unavailable:",F)}const $=()=>{if(!O||!I)return 0;O.getFloatTimeDomainData(I);let F=0;for(let ee=0;ee<I.length;ee++)F+=I[ee]*I[ee];return Math.sqrt(F/I.length)};mt.current=new Date().toISOString();const me=Wa(N,S).catch(F=>(console.warn("[UseSense] Audio recording failed:",F),null)),oe=e.upload.target_fps||4,le=nt(oe),ce=new gl,ve=performance.now();let G=ve,X="";for(;!p();){const F=performance.now(),ee=F-ve;if(ee>=S)break;const J=$();$i.current=J;const te=Ps.current;te.push(J),te.length>32&&te.shift();const Z=ce.update(J,F),se=qe.current,Ae=(se==null?void 0:se.faceOk)??!0;se&&(se.progress=ee/S);const ge=Ae?Z?{text:_.t("extraCheck","cantHear"),sub:_.t("extraCheck","speakLouder")}:{text:_.t("extraCheck","speakDigits"),sub:void 0}:{text:se!=null&&se.hint?se.hint.text:_.t("guidance","showFace"),sub:_.t("extraCheck","pausedDigits")},Te=!Ae||Z;se&&(se.state={progress:ee/S,paused:Te,capture:Ae,index:0,text:ge.text,sub:ge.sub,done:!1});const Ne=`${ge.text}|${ge.sub??""}|${Te}`;Ne!==X&&(X=Ne,ot({text:ge.text,sub:ge.sub,paused:Te})),Je({digits:w,meter:Na(te)}),Ae&&F>=G&&(G=F+le,await be("challenge")),await $e(50)}const V=await me;N.getTracks().forEach(F=>F.stop()),A==null||A.close().catch(()=>{}),!p()&&(an.current=V,await Zr(u,1))},Kn=m.useRef(Qr);Kn.current=Qr;const Ls=m.useRef(ta);Ls.current=ta;const Bs=m.useRef(ea);Bs.current=ea;const gn=m.useRef(lt);gn.current=lt;const Jn=m.useRef(Yt);Jn.current=Yt;const na=m.useRef(Gn);na.current=Gn;const Kt=m.useRef(Xt);Kt.current=Xt;const sa=m.useCallback(()=>{Y.current++,ae.current=!1,ze(!0)},[]),Ds=m.useCallback(()=>{Yn(),ae.current=!0,ze(!1),U("intro","Ready")},[Yn,U]),ra=g??(C?Ds:void 0),Ki=m.useCallback(()=>{vt.current=!1,Cn(!1),Y.current++,ae.current=!0,pe.current&&(pe.current.getTracks().forEach(u=>u.stop()),pe.current=null),console.log("[UseSense] Verification left by the user"),g?g():Ds()},[g,Ds]),Ji=m.useCallback(()=>{vt.current=!1,Cn(!1)},[]);m.useEffect(()=>{if(!Pe)return;let u=!0;async function p(){var S;U("initializing","Getting ready...");const[y]=await Promise.all([ec().catch(_=>(console.error("[UseSense] Signal collection failed:",_),{})),Nc().catch(()=>{})]);ki(!Ye());const w=((S=e.policy.inline_step_up)==null?void 0:S.suspicion_threshold)??55;if(et.current=new ss(w),At.current=y,console.log(`[UseSense] Channel integrity collected: ${Object.keys(y).length} fields`,y.user_agent?"(ok)":"(EMPTY -- collection may have failed)"),!!u){if(v&&typeof navigator<"u"&&navigator.onLine===!1){const _=()=>{navigator.onLine!==!1&&Vn()};Ct("offline"),tt.current=_,U("failed","Offline");return}Vn()}}return p().catch(y=>{u&&h((y==null?void 0:y.message)||"Initialization failed")}),()=>{u=!1}},[Pe]);const kt=q.theme.camera,Us=m.useRef(kt);Us.current=kt;const Zi=m.useMemo(()=>Dl(),[]),Qi=m.useCallback(()=>{Ut.current==="face-guide"&&(ws(null),dn.current=null,In.current.reset(),qn())},[qn]);Es.current=Qi;const eo=m.useCallback(()=>{Un.current=!0,zn.current=!1,vs(!1),ns(10),Es.current()},[]),zs=m.useCallback(u=>{if(u===Or.current)return;Or.current=u;const p=ye.current;p&&(p.style.filter=u?`blur(${ue.relief.cameraBlurPx}px)`:"")},[]),to=(u,p,y)=>{var oe,le,ce,ve;const w=qe.current;if(!w)return;const S=y.clientWidth,_=y.clientHeight,N=Mn(S,_);let M=!0,A,O=null;const I=((oe=w.runner)==null?void 0:oe.direction)??null;if(Ye()){const G=p.videoWidth,X=p.videoHeight,V=Aa(p);let Q,F,ee=null;if(V!=null&&V.landmarks){const se=V.landmarks,Ae=Da(G,X,S,_,!0);Q=se.map(we=>Ae.map(we.x,we.y));let ge=1,Te=0,Ne=1,Et=0;for(const we of se)we.x<ge&&(ge=we.x),we.x>Te&&(Te=we.x),we.y<Ne&&(Ne=we.y),we.y>Et&&(Et=we.y);u-zt.current>=100&&(zt.current=u,wt.current||(wt.current=document.createElement("canvas")),F=(le=ts(p,wt.current,ge*G,Ne*X,(Te-ge)*G,(Et-Ne)*X))==null?void 0:le.stats),Vt.current||(Vt.current=document.createElement("canvas")),ee=za(p,Vt.current,se,ge*G,Ne*X,(Te-ge)*G,(Et-Ne)*X)}A=V!=null&&V.matrix?cs(V.matrix):void 0;let J=Br.current.evaluate({now:u,faceCount:(V==null?void 0:V.faceCount)??0,screenLandmarks:Q,oval:N,pose:A,eyeBlink:V==null?void 0:V.eyeBlink,pixels:F},{scanning:!0,stillnessAnchors:w.kind==="speak_phrase"?mc:void 0});const te=Hn.current;te.setVeil(bt.current,u),te.covered(ee,u,Sa(J)),J=Fa(J,te.state);let Z=Fl(J,{kind:w.kind,direction:I});M=Z.allPass,O=Dr.current.update(Ra(Z,{scanning:!0,fillLightSettling:!1}),u,se=>Ys(se,{distance:Z.distance,light:Z.light,inFrame:Z.inFrame}))}w.faceOk=M,w.hint=M?null:Ee(O);const $=vt.current||!1,me=w.runner;if(me&&!$){const G=me.advance({now:u,faceOk:M,yaw:(A==null?void 0:A.yaw)??null,pitch:(A==null?void 0:A.pitch)??null,held:vt.current,hint:w.hint});w.display=G,w.progress=G.progress,w.done=G.finished;const X=`${G.text}|${G.sub??""}|${G.warning}`;if(w.shown!==X&&(w.shown=X,console.log(`[UseSense] Extra check: ${G.text}${G.sub?` / ${G.sub}`:""}${G.paused?" (paused)":""}`),ot({text:G.text,sub:G.sub,paused:G.warning})),w.kind==="head_turn"){const V=ni(G.arrow);Je(Q=>Q.arrow===V?Q:{arrow:V})}else Je({dot:G.dot,trail:G.trail})}(ve=Ve.current)==null||ve.draw({mode:"challenge",now:u,progress:w.progress,paused:w.display?w.display.warning:!!((ce=w.state)!=null&&ce.paused),ringColor:Us.current.challenge,fill:bt.current})},aa=m.useCallback(()=>{const u=performance.now();if(u-Ar.current<Tr.current)return;Ar.current=u;const p=Ut.current;if(p!=="face-guide"&&p!=="baseline"&&p!=="challenge")return;const y=ye.current,w=un.current;if(!y||y.readyState<2||!y.videoWidth||!w)return;if(p==="challenge"){to(u,y,w);return}const S=y.videoWidth,_=y.videoHeight,N=w.clientWidth,M=w.clientHeight,A=Da(S,_,N,M,!0),O=Mn(N,M);wt.current||(wt.current=document.createElement("canvas"));const I=u-zt.current>=100;let $,me=null;const oe=Ye();if(oe){const ee=performance.now(),J=Aa(y);Tr.current=performance.now()-ee>40?66:30;const te=p==="baseline";if(te!==As.current&&(As.current=te,Hn.current.reset()),!J||!J.landmarks){if($=_s.current.evaluate({now:u,faceCount:(J==null?void 0:J.faceCount)??0}),I&&!te){zt.current=u;const Z=Sc,se=ts(y,wt.current,S*Z.x0,_*Z.y0,S*(Z.x1-Z.x0),_*(Z.y1-Z.y0));fn.current=se?se.stats.meanLuma:null,fn.current!==null&&(Pr.current=fn.current)}else fn.current=null;$n.current=Fs.current.update({faceFound:!1,frameLuma:fn.current,scanning:te,now:u})}else{Fs.current.update({faceFound:!0,frameLuma:null,scanning:te,now:u}),$n.current=!1;const Z=J.landmarks,se=new Array(Z.length);let Ae=1,ge=0,Te=1,Ne=0;for(let Re=0;Re<Z.length;Re++){const Ce=Z[Re];se[Re]=A.map(Ce.x,Ce.y),Ce.x<Ae&&(Ae=Ce.x),Ce.x>ge&&(ge=Ce.x),Ce.y<Te&&(Te=Ce.y),Ce.y>Ne&&(Ne=Ce.y)}let Et;if(I){zt.current=u;const Re=ts(y,wt.current,Ae*S,Te*_,(ge-Ae)*S,(Ne-Te)*_);Et=Re==null?void 0:Re.stats}let we=null;if(te&&(Vt.current||(Vt.current=document.createElement("canvas")),we=za(y,Vt.current,Z,Ae*S,Te*_,(ge-Ae)*S,(Ne-Te)*_)),J.faceCount>1&&u-Lr.current>5e3&&(Lr.current=u,console.log("[UseSense] second_face_detected")),$=_s.current.evaluate({now:u,faceCount:J.faceCount,screenLandmarks:se,oval:O,pose:J.matrix?cs(J.matrix):void 0,eyeBlink:J.eyeBlink,pixels:Et},{scanning:te}),te){const Re=Hn.current;if(Re.setVeil(bt.current,u),$r.current&&Re.hold(u),we&&ct.current&&(ct.current.isPlaying||Re.isSettling(u))){let Ce=0,fa=0;const Vs=we.length/4;for(let es=0;es<Vs;es++)Ce+=we[es*4+1],fa+=we[es*4+2];const pa=er(u,Pn.current||null);pa!==null&&qt.current.length<600&&qt.current.push({t:pa,r:Ce/Vs,b:fa/Vs})}Re.covered(we,u,Sa($)),$=Fa($,Re.state)}me=Z.map((Re,Ce)=>({x:se[Ce].x,y:se[Ce].y,z:Re.z}))}}else{if(I){zt.current=u;const ee=ts(y,wt.current,S*.3,_*.2,S*.4,_*.55);if(ee){jr.current=ee.stats;const J=Ss.current;Er.current=J?Bl(J,ee.luma):void 0,Ss.current=ee.luma}}$=Pc(jr.current,Er.current)}const le=hi($,{scanning:p==="baseline"});le!==Rs.current&&(Rs.current=le,Ir(le),console.log(`[UseSense] Face ${le?"too dark to scan":"bright enough to scan"} (luma ${Math.round($.measurements.meanLuma??-1)})`)),le&&($=Cc($,{scanning:!1}));const ce=oe&&$n.current;Mc({tooDark:$.light==="too_dark"||ce,on:hn.current!==null,scanning:p==="baseline"})&&(ce&&console.log(`[UseSense] Dark frame with no face (luma ${Math.round(Pr.current??-1)}): fill light on`),hn.current=u,bt.current=!0,kr(!0));const ve=hn.current!==null&&u-hn.current<tn.fillLightSettleMs,G=Ra($,{scanning:p==="baseline",fillLightSettling:ve});let X=In.current.update(G,u,ee=>Ys(ee,{distance:$.distance,light:$.light,inFrame:$.inFrame}));const V=Rc({dark:ce,scanning:p==="baseline",fillLightSettling:ve});V==="silent"?X=null:V==="too_dark"&&(X=Ys("light",{light:"too_dark"})),X=Ee(X);const Q=dn.current;if((((X==null?void 0:X.id)??null)!==((Q==null?void 0:Q.id)??null)||(X==null?void 0:X.text)!==(Q==null?void 0:Q.text)||(X==null?void 0:X.sub)!==(Q==null?void 0:Q.sub))&&(dn.current=X,ws(X)),$.allPass!==Ms.current&&(Ms.current=$.allPass,vr($.allPass)),Nn.current=$.allPass,p==="face-guide"){const ee=Math.min(200,u-Cs.current);if(Cs.current=u,$.allPass){if(Ln.current+=ee,Bn.current||(Bn.current=!0,ns(20)),oe&&!Un.current&&Ln.current>=tn.autoStartMs){Es.current();return}}else In.current.hasSustainedFailure(u)&&(Ln.current=0,Bn.current=!1);(!oe||u-On.current>=tn.shutterAfterMs||Dn.current>=tn.shutterAfterPausedWindows)&&!le&&!zn.current&&(zn.current=!0,vs(!0))}p==="baseline"?Wt.current===null&&(Wt.current=u):Wt.current=null,zs(Wt.current!==null&&u-Wt.current>=ue.relief.cameraBlurAfterMs);const F=Ve.current;F&&(F.setTriangles(Lc()),F.update(me,u),F.draw(p==="baseline"?{mode:"scan",now:u,progress:Ht.current,paused:!$.allPass,fill:bt.current}:{mode:"align",now:u,warn:!$.allPass&&dn.current!==null,fill:bt.current}))},[]),no=v&&k.startsWith("step-up-")&&k!=="step-up-round";m.useEffect(()=>{var y;if(!no)return;const u=$a(St==="idle"?"complete":St,Ft,L),p=un.current;p&&(p.clientWidth!==De.W||p.clientHeight!==De.H)&&ks({W:p.clientWidth,H:p.clientHeight}),u&&((y=Ve.current)==null||y.draw({mode:"challenge",now:performance.now(),progress:u.progress,ringColor:u.ring==="done"?kt.success:kt.warning}))}),m.useEffect(()=>{var u,p;if(v&&k==="extra-check-done"){(u=Ve.current)==null||u.draw({mode:"challenge",now:performance.now(),progress:1,ringColor:Us.current.success,fill:bt.current});return}!v||k!=="uploading"&&k!=="completing"&&k!=="extra-check-brief"&&k!=="upload-failed"||(p=Ve.current)==null||p.draw({mode:"upload",now:performance.now()})},[v,k]);const ia=v&&(k==="face-guide"||k==="baseline"||k==="challenge");m.useEffect(()=>{if(!ia)return;let u=0,p=!1;const y=()=>{if(!p){u=requestAnimationFrame(y);try{aa()}catch(w){console.warn("[UseSense] Tracker error:",w)}}};return u=requestAnimationFrame(y),()=>{p=!0,cancelAnimationFrame(u)}},[ia,aa]),m.useEffect(()=>{k==="baseline"||k==="uploading"||k==="completing"||k==="extra-check-brief"||k==="upload-failed"||(Wt.current=null,zs(!1))},[k,zs]),m.useEffect(()=>{const u=Cr.current;if(!v||!u){Ve.current=null;return}!Ve.current||Ve.current.target!==u?Ve.current=new il(u,kt,Zi):Ve.current.setColors(kt)});const oa=v&&(k==="uploading"||k==="completing");m.useEffect(()=>{if(!oa)return;let u=0;const p=()=>{Ci(Ke.current.value(performance.now())),u=requestAnimationFrame(p)};return u=requestAnimationFrame(p),()=>cancelAnimationFrame(u)},[oa]),m.useEffect(()=>{const u=pe.current;u&&(ye.current&&!ye.current.srcObject&&(ye.current.srcObject=u,ye.current.play().catch(()=>{})),pt.current&&!pt.current.srcObject&&(pt.current.srcObject=u,pt.current.play().catch(()=>{})))});const ca=v&&(k==="uploading"||k==="completing"),Jt=v&&(k==="challenge"||k==="extra-check-done"),Zn=v&&(k==="step-up-intro"||k==="step-up-flash"||k==="step-up-rmas"||k==="step-up-complete"),_t=Zn?$a(St==="idle"?"complete":St,Ft,L):null,Zt=ca||v&&(k==="extra-check-brief"||k==="upload-failed"),so=Zt||["face-guide","baseline","countdown","challenge","extra-check-done","step-up-round","step-up-intro","step-up-flash","step-up-rmas","step-up-complete"].includes(k),yn=v&&(k==="face-guide"||k==="baseline"),ro=(yn||Jt)&&Si,Hs=v&&k==="face-guide"&&(Mi||wr)&&!Ni,ao=_t?`${_t.text}${_t.sub?`. ${_t.sub}`:""}`:Jt?Dt?`${Dt.text}${Dt.sub?`. ${Dt.sub}`:""}`:"":yn?Rt?`${Rt.text}${Rt.sub?`. ${Rt.sub}`:""}`:Hs?L.t("guidance","shutterHint"):"":"",Qt=_r?{text:L.t("guidance","straight"),sub:L.t("guidance","darkHint")}:Rt?{text:Rt.text,sub:Rt.sub}:Hs?{text:L.t("guidance","shutterHint")}:k==="baseline"||_i?{text:L.t("guidance","ready")}:null,la=Ri,io=()=>{if(!Le)return null;const u=Le.decision,p=u==="APPROVE",y=u==="REJECT",w=p?"usesense-result-icon--success":y?"usesense-result-icon--failure":"usesense-result-icon--review",S=p?"Verification successful":y?"Verification failed":"Pending review",_=p?"Your identity has been confirmed.":y?"We could not verify your identity.":"Your verification is being reviewed.";return l.jsxs("div",{className:"usesense-result",children:[l.jsx("div",{className:`usesense-result-icon ${w}`,children:p?l.jsx(Wu,{}):y?l.jsx(Vu,{}):l.jsx(qu,{})}),l.jsx("div",{className:"usesense-result-title",children:S}),l.jsx("div",{className:"usesense-result-subtitle",children:_}),l.jsxs("div",{style:{display:"flex",gap:"12px",marginTop:"16px"},children:[y&&l.jsx("button",{className:"usesense-btn usesense-btn--secondary",onClick:Xt,children:"Retry"}),l.jsx("button",{className:"usesense-btn usesense-btn--primary",onClick:g??(()=>f(Le)),children:"Finish"})]})]})},oo=e.policy.challenge_type,Qn=ti[oo],jt=q.theme.page,ua={bg:jt.background,fg:jt.foreground,muted:jt.muted,border:jt.border,primary:jt.primary,primaryFg:jt.primaryForeground,fontDisplay:q.theme.typography.displayFamily,fontBody:q.theme.typography.fontFamily,buttonRadius:q.theme.shape.buttonRadius,buttonStyle:q.theme.shape.buttonStyle,backgroundImage:jt.backgroundImage??void 0},co=!v&&(k==="intro"||k==="done"),da=ra?k==="face-guide"?ra:()=>{vt.current=!0,Cn(!0)}:void 0,ha=Mn(De.W,De.H),Ws=De.W&&De.H?Qc(De.W,De.H):null,en=_t??(Jt&&Dt?Dt:null),lo=["usesense-engine",v?"usesense-engine--guided":"",co?"usesense-engine--light":"",ro?"usesense-engine--fill":"",q.theme.shape.buttonStyle==="outline"?"usesense-engine--btn-outline":""].filter(Boolean).join(" ");return l.jsx(gi.Provider,{value:q,children:l.jsxs("div",{className:lo,"data-mode":q.theme.mode,style:{...To(q.theme),"--us-capture-ring":kt.ring,"--us-capture-warning":kt.warning},children:[l.jsx("style",{children:$o(Ue,H)}),!v&&fe&&k!=="intro"&&l.jsx("img",{className:"usesense-logo",src:fe,alt:ke||"Logo"}),k==="intro"&&v&&(()=>{const u=_l(Fe.current.challenge_type,L);return l.jsx(xi,{testId:u.title==="Two quick steps"?"primer_two":"primer",icon:"face",tone:"info",title:u.title,body:u.body,tips:u.tips,primary:u.start,onPrimary:sa,secondary:g?L.t("primer","cancel"):void 0,onSecondary:g})})(),k==="intro"&&!v&&l.jsx(Go,{tokens:ua,brandName:ke,logoUrl:fe,onCancel:g,children:l.jsx(Yo,{tokens:ua,onStart:sa})}),!v&&g&&(k==="challenge-brief"||k==="initializing"||k==="camera-request"||k==="camera-error"||k==="failed")&&l.jsx("button",{className:"usesense-cancel-btn",onClick:g,children:"Cancel"}),v&&(k==="initializing"||k==="camera-request")&&l.jsxs("div",{className:"usesense-xc-loading","data-screen":k==="initializing"?"loading":"camera_request",children:[l.jsx(yi,{}),g&&l.jsx("button",{type:"button",className:"usesense-xc-cancel",onClick:g,children:L.t("primer","cancel")}),k==="initializing"?l.jsxs(l.Fragment,{children:[l.jsx(jl,{}),l.jsx("div",{className:"usesense-xc-loading-title",role:"status",children:L.t("primer","gettingReady")})]}):l.jsxs(l.Fragment,{children:[l.jsx(pr,{icon:"camera",tone:"info",size:72}),l.jsx("div",{className:"usesense-xc-loading-title",children:L.t("primer","cameraTitle")}),l.jsx("div",{className:"usesense-xc-loading-body",children:L.t("primer","cameraBody")})]}),l.jsx(lr,{})]}),!v&&k==="initializing"&&l.jsxs("div",{className:"usesense-result",children:[l.jsx("div",{className:"usesense-spinner"}),l.jsx("div",{className:"usesense-result-title",style:{marginTop:"24px"},children:"Getting ready..."})]}),!v&&k==="camera-request"&&l.jsxs("div",{className:"usesense-result",children:[l.jsx("div",{className:"usesense-result-icon",style:{background:"rgba(255,255,255,0.1)",color:"#fff"},children:l.jsx(Gu,{})}),l.jsx("div",{className:"usesense-result-title",children:"Allow camera access"}),l.jsx("div",{className:"usesense-result-subtitle",children:"We need access to your camera for identity verification"})]}),v&&(k==="camera-error"||k==="failed")&&l.jsx(Js,{screen:Ei,app:ke,onPrimary:()=>tt.current()}),v&&k==="mic-denied"&&l.jsx(Js,{screen:"mic_denied",app:ke,onPrimary:()=>Ls.current(Y.current),onSecondary:()=>Bs.current(Y.current)}),k==="camera-error"&&!v&&l.jsxs("div",{className:"usesense-result",children:[l.jsx("div",{className:"usesense-result-icon usesense-result-icon--failure",children:l.jsx(ei,{})}),l.jsx("div",{className:"usesense-result-title",children:de==="Camera disconnected"?"Camera disconnected":"Camera access needed"}),l.jsx("div",{className:"usesense-result-subtitle",children:P}),l.jsx("button",{className:"usesense-btn usesense-btn--primary",onClick:Xt,style:{marginTop:"16px"},children:"Retry Camera"})]}),k==="failed"&&!v&&l.jsxs("div",{className:"usesense-result",children:[l.jsx("div",{className:"usesense-result-icon usesense-result-icon--failure",children:l.jsx(ei,{})}),l.jsx("div",{className:"usesense-result-title",children:"Verification incomplete"}),l.jsx("div",{className:"usesense-result-subtitle",children:Oe||"Something went wrong finishing your verification."}),l.jsx("button",{className:"usesense-btn usesense-btn--primary",onClick:Xt,style:{marginTop:"16px"},children:"Try Again"})]}),k==="challenge-brief"&&Qn&&l.jsxs("div",{className:"usesense-result",children:[l.jsx("div",{className:"usesense-challenge-brief-title",children:Qn.title}),l.jsx("div",{className:"usesense-challenge-brief-desc",children:Qn.description.split(`
`).map((u,p)=>l.jsxs("span",{children:[u,p===0&&l.jsx("br",{})]},p))}),l.jsx("div",{className:"usesense-challenge-brief-tip",children:Qn.tip}),l.jsx("button",{className:"usesense-btn usesense-btn--primary usesense-btn--full",onClick:Os,style:{marginTop:"8px"},children:"Got it, start"})]}),so&&l.jsxs(l.Fragment,{children:[l.jsxs("div",{ref:un,className:`usesense-camera-container${v?" usesense-camera-container--guided":""}`,style:Ws?{"--us-guidance-top":`${Ws.guidanceTop.toFixed(1)}px`,"--us-shutter-y":`${Ws.shutterY.toFixed(1)}px`}:void 0,children:[l.jsx("video",{ref:pt,className:"usesense-camera-video usesense-camera-video--blurred",autoPlay:!0,playsInline:!0,muted:!0}),l.jsx("video",{ref:ye,className:"usesense-camera-video usesense-camera-video--clear",autoPlay:!0,playsInline:!0,muted:!0}),v&&l.jsx("canvas",{ref:Cr,className:"usesense-contour-canvas","aria-hidden":"true",style:{visibility:yn||Zt||Jt||Zn?"visible":"hidden"}}),v&&l.jsx("div",{ref:Nr,className:"usesense-colour-tint","aria-hidden":"true"}),Jt&&l.jsx(La,{W:De.W,H:De.H,oval:ha,state:Ai}),Zn&&(_t==null?void 0:_t.tick)&&l.jsx(La,{W:De.W,H:De.H,oval:ha,state:{tick:!0}}),Zt&&l.jsx("div",{className:"usesense-capture-blur"}),v&&!Zt&&l.jsx(lr,{camera:!0}),v&&!Zt&&l.jsxs("div",{className:"usesense-capture-top",children:[da?l.jsx("button",{type:"button",className:"usesense-capture-circ",onClick:da,"aria-label":"Back",children:l.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[l.jsx("line",{x1:"19",y1:"12",x2:"5",y2:"12"}),l.jsx("polyline",{points:"12 19 5 12 12 5"})]})}):l.jsx("span",{}),l.jsx("button",{type:"button",className:"usesense-capture-circ",onClick:()=>Fi(u=>!u),"aria-label":"Help","aria-expanded":_r,children:l.jsx("span",{"aria-hidden":"true",children:"?"})})]}),!v&&g&&l.jsx("button",{className:"usesense-cancel-pill",onClick:g,style:{zIndex:30},children:"See results"}),!v&&(k==="baseline"||k==="challenge")&&l.jsxs("div",{className:"usesense-verifying-badge",style:{zIndex:30},children:[l.jsx("div",{className:"usesense-recording-dot"}),"Verifying"]}),!v&&(k==="face-guide"||k==="baseline")&&l.jsx("div",{ref:Ii,className:["usesense-face-oval",He!=null&&He.ready?"usesense-face-oval--ready":"",k==="baseline"?"usesense-face-oval--baseline":""].join(" ")}),en&&l.jsxs("div",{className:"usesense-guidance","aria-hidden":"true",children:[l.jsx("span",{className:"usesense-guidance-text",children:en.text}),en.sub&&l.jsx("span",{className:"usesense-guidance-sub",children:en.sub})]},`${en.text}|${en.sub??""}`),yn&&Qt&&l.jsxs("div",{className:"usesense-guidance","aria-hidden":"true",children:[l.jsx("span",{className:"usesense-guidance-text",children:Qt.text}),Qt.sub&&l.jsx("span",{className:"usesense-guidance-sub",children:Qt.sub})]},`${Qt.text}|${Qt.sub??""}`),Hs&&l.jsx("button",{type:"button",className:"usesense-shutter usesense-shutter--guided",onClick:eo,"aria-label":"Start the scan",children:l.jsx("span",{className:"usesense-shutter-inner"})}),k==="countdown"&&dt!==null&&l.jsxs("div",{className:"usesense-countdown-overlay",children:[l.jsx("div",{className:"usesense-countdown-number",children:dt},dt),l.jsx("div",{className:"usesense-countdown-label",children:"Get ready..."})]}),k==="challenge"&&fs&&l.jsx("div",{className:"usesense-follow-dot",style:{left:`${fs.x}%`,top:`${fs.y}%`}}),k==="challenge"&&rn&&l.jsxs("div",{className:"usesense-direction-arrow",children:[l.jsx(Yu,{direction:rn}),l.jsxs("span",{className:"usesense-direction-label",children:["Look ",rn.charAt(0).toUpperCase()+rn.slice(1)]})]},rn),!v&&ft&&l.jsx("div",{className:"usesense-env-warning",children:ft}),yr&&l.jsx("div",{className:"usesense-flash-overlay",style:{backgroundColor:yr}}),!v&&St==="intro"&&l.jsxs("div",{className:"usesense-step-up-overlay",children:[l.jsx("div",{className:"usesense-step-up-icon",children:l.jsx("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.5",children:l.jsx("path",{d:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"})})}),l.jsx("div",{className:"usesense-step-up-title",children:"Additional verification"}),l.jsx("div",{className:"usesense-step-up-message",children:"We need to verify your presence with a quick check. This will only take a few seconds."})]}),!v&&St==="complete"&&l.jsxs("div",{className:"usesense-step-up-overlay",children:[l.jsx("div",{className:"usesense-step-up-icon",style:{color:"#00D4AA"},children:l.jsx("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round",strokeLinejoin:"round",children:l.jsx("polyline",{points:"20 6 9 17 4 12"})})}),l.jsx("div",{className:"usesense-step-up-title",children:"Verification complete"})]}),!v&&Ft&&l.jsxs("div",{className:"usesense-rmas-card",children:[l.jsxs("div",{className:"usesense-rmas-step",children:[Ft.step," of ",Ft.total]}),l.jsx("div",{className:"usesense-rmas-label",children:Ft.label}),l.jsx("div",{className:"usesense-rmas-countdown-bar",children:l.jsx("div",{className:"usesense-rmas-countdown-fill",style:{width:`${Ft.countdown}%`}})})]}),!v&&St==="flash"&&l.jsx("div",{className:"usesense-step-up-status",children:"Hold still -- verifying..."})]}),v&&l.jsx("div",{className:"usesense-sr-only",role:"status","aria-live":"polite","aria-atomic":"true",children:ao}),v&&k==="extra-check-brief"&&Se.current&&l.jsx(Oa,{testId:`xc_${Se.current.challenge.type}`,icon:Se.current.challenge.type==="head_turn"?"turn":"dot",tone:"extra",title:L.t("extraCheck","sheetTitle"),body:Ti,primary:L.t("extraCheck","continue"),onPrimary:()=>Ur.current()}),v&&k==="upload-failed"&&l.jsx(Oa,{testId:"upload_failed",icon:"upload",tone:"warning",title:L.t("upload","failedTitle"),body:L.t("upload","failedBody"),primary:L.t("upload","retry"),onPrimary:()=>tt.current()}),ca&&l.jsx(l.Fragment,{children:l.jsxs("div",{className:"usesense-upload-sheet",children:[l.jsx("div",{className:"usesense-upload-sheet-title",children:L.t("upload","title")}),l.jsx("div",{className:"usesense-upload-sheet-bar",role:"progressbar","aria-valuenow":Ko(la),"aria-valuemin":0,"aria-valuemax":100,"aria-label":"Verification progress",children:l.jsx("i",{style:{width:`${(la*100).toFixed(2)}%`}})}),l.jsx("div",{className:"usesense-upload-sheet-sub",children:L.t("upload","caption")})]})}),!Zt&&!yn&&!Jt&&!Zn&&l.jsxs("div",{className:"usesense-status-area",children:[l.jsx("div",{className:"usesense-status-text",children:de}),k==="challenge"&&gr&&l.jsx("div",{className:"usesense-phrase-display",children:gr}),!v&&k==="face-guide"&&l.jsx("button",{className:"usesense-btn usesense-btn--primary",disabled:!(He!=null&&He.ready)&&!wr,onClick:qn,style:{marginTop:"16px"},children:"I'm Ready"}),(!v&&k==="baseline"||k==="challenge")&&l.jsx("div",{className:"usesense-status-hint",style:{marginTop:"6px"},children:"Follow the instructions"})]}),!v&&(k==="baseline"||k==="challenge")&&l.jsx("div",{className:"usesense-progress",children:l.jsx("div",{className:"usesense-progress-fill",style:{width:`${re}%`}})})]}),!v&&(k==="uploading"||k==="completing")&&l.jsxs(l.Fragment,{children:[g&&l.jsx("button",{className:"usesense-cancel-btn",onClick:g,children:"Cancel"}),l.jsxs("div",{className:"usesense-result",children:[l.jsx("div",{className:"usesense-spinner"}),l.jsx("div",{className:"usesense-result-title",style:{marginTop:"24px"},children:k==="uploading"?"Almost done":"Verifying..."}),l.jsx("div",{className:"usesense-result-subtitle",children:k==="uploading"?Be&&Be.total>0?`Uploading — ${Be.percent}% of ${Xu(Be.total)}`:"Finishing up — this will only take a moment.":"Analyzing your identity…"}),k==="uploading"&&Be&&Be.total>0&&l.jsx("div",{className:"usesense-progress-track",role:"progressbar","aria-valuenow":Be.percent,"aria-valuemin":0,"aria-valuemax":100,"aria-label":"Upload progress",children:l.jsx("div",{className:"usesense-progress-fill",style:{width:`${Be.percent}%`}})})]})]}),k==="done"&&R&&!v&&io(),k==="done"&&R&&v&&Le&&(()=>{const u=xl(Le.decision,T),p=g??(()=>f(Le));return l.jsx(Js,{screen:u,app:ke,onPrimary:u==="rejected_retry"?j??Xt:p,onSecondary:p})})(),Pi&&l.jsx(Tl,{onLeave:Ki,onStay:Ji})]})})};m.createContext(Bo);m.createContext(void 0);export{Qu as V};
