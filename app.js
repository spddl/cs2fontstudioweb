"use strict";
// show script errors on the page instead of failing silently
addEventListener("error",e=>{
  let p=document.getElementById("jserr");
  if(!p){p=document.createElement("pre");p.id="jserr";p.style.cssText="position:fixed;left:8px;bottom:8px;max-width:60vw;margin:0;padding:8px;background:#400;color:#fcc;font:12px monospace;z-index:99;white-space:pre-wrap";document.body.append(p)}
  p.textContent+=e.message+" (line "+e.lineno+")"+String.fromCharCode(10);
});

const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// Families requested by the game CSS. The authoritative list is families.json (tools/scan_panorama.py, generated from the game's
// panorama styles); this list is the fallback and is merged with it so nothing disappears if the scan misses a family.
const GAME_FAMILIES_FALLBACK=["Stratum2","Stratum2 Thin","Stratum2 Thin Italic","Stratum2 Thin Condensed","Stratum2 Thin TF","Stratum2 Light","Stratum2 Light Italic","Stratum2 Light Condensed","Stratum2 Light TF","Stratum2 Medium","Stratum2 Medium Italic","Stratum2 Medium Condensed","Stratum2 Medium TF","Stratum2 Bold Condensed","Stratum2 Bold TF","Stratum2 Black","Stratum2 Black Italic","Stratum2 Black Condensed","Stratum2 Black TF","Stratum2 Condensed","Stratum2 TF","Stratum2 Mono","Stratum2 Mono Light","Stratum2 Monodigit","Stratum2 Regular Monodigit","Stratum2 Bold Monodigit","Noto Mono","notosans"];
let GAME_FAMILIES=[...GAME_FAMILIES_FALLBACK];
let FAMDATA=null;                    // families.json: {families:{name:{areas,files}}}
const FAMIDX=new Map();              // famKey -> {areas,files}
// fontconfig compares family names ignoring case and blanks: "Noto Sans" and "notosans" are one group for the game
const famKey=f=>f.toLowerCase().replace(/\s+/g,"");
const usage=f=>FAMIDX.get(famKey(f));
function loadFamilies(fj){
  FAMDATA=fj&&fj.families?fj:null;
  const seen=new Map(GAME_FAMILIES_FALLBACK.map(f=>[famKey(f),f]));
  if(FAMDATA) for(const [f,d] of Object.entries(FAMDATA.families)){
    const k=famKey(f), o=FAMIDX.get(k);
    if(o){ // the same family under two spellings: merge their usage
      const areas={...o.areas};for(const [a,n] of Object.entries(d.areas))areas[a]=(areas[a]||0)+n;
      FAMIDX.set(k,{areas,files:[...new Set([...o.files,...d.files])].sort()});
    }else FAMIDX.set(k,d);
    if(!seen.has(k)) seen.set(k,f);
  }
  GAME_FAMILIES=[...seen.values()];
}
// the group a family name from a saved rule belongs to (other spelling of the same family)
const groupOf=g=>ctl[g]?g:Object.keys(ctl).find(k=>famKey(k)===famKey(g));

const DEF={font:"",scale:1,weight:0,italic:false,width:1};
const STORE={};                      // group -> {font, scale, weight, italic, width}
const isChg=v=>!!(v&&(v.font||v.scale!==1||v.weight||v.italic||v.width!==1));
const WEIGHTS=[[0,"As in the game"],[100,"Thin"],[200,"Extra light"],[300,"Light"],[400,"Regular"],[500,"Medium"],[600,"Semi bold"],[700,"Bold"],[800,"Extra bold"],[900,"Black"]];
const ctl={};                        // group -> {set}
const stage=$("stage");
let selected=null;
let savedKey=null, isDirty=false, uid=0, started=false;   // savedKey: the settings of the last download
let textScale=1;                     // global text size: multiplier on every font's pixel size
let cfgName="", cfgKey="";          // loaded configuration and the settings it had when loaded

// Preview fonts for groups without a chosen font (fonts/preview-fonts.css, tools/make_preview_fonts.py): font families named like
// the game's ("Stratum2 Bold TF") that are the original face when it is installed on this PC (local() only, Stratum2 is not
// bundled), followed by a free stand-in
const isMonoFam=f=>/\bmono\b/i.test(f);
const NOLOCAL=new URLSearchParams(location.search).get("nolocal")==="1";   // ?nolocal=1: stand-ins only
// the default font (FIXED) has the cap height of Noto Sans
const gameFam=f=>f===FIXED?"notosans":f;
const origCap=f=>/noto|default font/i.test(f)?0.714:0.666;   // cap height per em of the game's font (Noto Sans and the default font, Stratum2)
// The free stand-ins (fonts/, static files): Saira SemiCondensed, Saira ExtraCondensed for the condensed cut, Chivo Mono for the
// mono cut (the console needs the fixed pitch; its zero has no slash, like Stratum2 Mono). They are drawn at the cap height and
// average width of the Stratum2 cut (Noto Sans is wider; Chivo Mono squeezed to the 0.52 em advance of Stratum2 Mono). The
// "Preview fonts" preset puts the same fonts and numbers into the game, so it looks there like the preview of unchanged groups.
const standIn=f=>isMonoFam(f)?{font:"Chivo Mono",cap:0.686,width:0.893}
  :/condensed/i.test(f)?{font:"Saira ExtraCondensed",cap:0.688,width:0.9}
  :{font:"Saira SemiCondensed",cap:0.688,width:/noto|default font/i.test(f)?1.1:1.02};
const standScale=f=>Math.round(origCap(f)/standIn(f).cap*1000)/1000;
const fallback=f=>`"${standIn(f).font}",`+(isMonoFam(f)?"Consolas,monospace":'"Segoe UI",sans-serif');
// The original faces that are installed (the probe: families of preview-fonts.css): family -> [{lo, hi, style, ok}] (weight
// range: a family with the weight in its name has one face for every weight)
const gameFaces=new Map();
if(!NOLOCAL) Promise.all([...document.fonts].map(f=>{
  const fam=f.family.replace(/^"|"$/g,"").replace(/^probe:/,"");
  if(!f.family.replace(/^"/,"").startsWith("probe:")) return;   // probe: the original face alone, without the stand-in source
  const [lo,hi=lo]=f.weight.split(" ").map(Number);
  const e={lo,hi,style:f.style,ok:false};
  if(!gameFaces.has(fam)) gameFaces.set(fam,[]);
  gameFaces.get(fam).push(e);
  return f.load().then(()=>{e.ok=true},()=>{});
})).then(()=>restyle());
// is the face the browser picks for this family, weight and style installed? (CSS font matching by weight)
function haveGameFace(fam,w,style){
  let l=gameFaces.get(fam)||[];
  if(l.some(e=>e.style===style)) l=l.filter(e=>e.style===style); else if(style==="italic") l=l.filter(e=>e.style==="normal");
  const hit=l.find(e=>e.lo<=w&&w<=e.hi);
  if(hit) return hit.ok;
  const ws=l.map(e=>e.lo), up=ws.filter(x=>x>w).sort((a,b)=>a-b), dn=ws.filter(x=>x<w).sort((a,b)=>b-a);
  const pick=w>500?(up[0]??dn[0]):w<400?(dn[0]??up[0]):(up.find(x=>x<=500)??dn[0]??up[0]);
  return !!l.find(e=>e.lo===pick)?.ok;
}
const TEXT_SCALE=1.25/(1440/1080);  // text size relative to the layout scale (measured at 2560x1440)

$("hlchg").onchange=e=>document.body.classList.toggle("hlchg",e.target.checked);
$("onlychg").onchange=e=>{document.body.classList.toggle("onlychg",e.target.checked);updateVisibility()};
$("frames").onchange=e=>document.body.classList.toggle("frames",e.target.checked);
let statusTimer=null;
// act: optional {label, run} shown as a small button after the message (the next step, e.g. "Export as .zip")
function setStatus(m,c="",act){
  const s=$("status");s.textContent=m;s.className=c;s.setAttribute("role",c==="err"?"alert":"status");
  if(act){const b=document.createElement("button");b.type="button";b.className="sec sm";b.textContent=act.label;b.onclick=()=>{b.remove();act.run()};s.append(" ",b)}
  clearTimeout(statusTimer);
  if(c==="ok"&&m) statusTimer=setTimeout(()=>{if(s.firstChild?.textContent===m)s.textContent=""},act?15000:8000);
}
function saveBlob(blob,name){
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
// range inputs paint their filled part from --p (CS2 sliders show the value as a filled track)
const fillRange=r=>r.style.setProperty("--p",(r.value-r.min)/(r.max-r.min)*100+"%");

// ---- preview faces of the chosen fonts (fonts.js): Google fonts as woff2 per subset, own files from their bytes; a font of
// this PC is used by its name
const faces=new Map();                 // family -> Promise<boolean>
function ensureFace(name){
  if(!name) return Promise.resolve(false);
  if(faces.has(name)) return faces.get(name);
  const p=FONTS.ensureFull(name);
  faces.set(name,p);
  p.then(ok=>{if(ok)restyle()});
  return p;
}
const famCss=(name,rest)=>`"full:${name}","${name}",${rest}`;

// ---- vertical calibration: scenes.js y = middle of the capital letters; CSS centres the font's content area instead
const capCtx=document.createElement("canvas").getContext("2d");
function fontBox(e){ // ascent and descent of the element's font per em, as the browser sees it (matches FreeType/Pango)
  const cs=getComputedStyle(e);
  capCtx.font=`${cs.fontStyle} ${cs.fontWeight} 1000px ${cs.fontFamily}`;
  const m=capCtx.measureText("H");
  return m.fontBoundingBoxAscent===undefined?null:{A:m.fontBoundingBoxAscent/1000,D:m.fontBoundingBoxDescent/1000};
}
function capShift(e){
  const cs=getComputedStyle(e);
  capCtx.font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m=capCtx.measureText("H");
  if(m.fontBoundingBoxAscent===undefined) return 0;
  // baseline B = y + cap/2; content-area centre = B + (descent - ascent)/2
  return m.actualBoundingBoxAscent/2 + (m.fontBoundingBoxDescent-m.fontBoundingBoxAscent)/2;
}

// ---- scenes (tabs with arrow-key navigation)
const tabs=$("tabs");
SCENES.forEach((s,i)=>{
  const b=document.createElement("button");
  b.type="button";b.textContent=s.name;b.id="tab-"+i;b.setAttribute("role","tab");b.setAttribute("aria-controls","stage");
  b.onclick=()=>show(i);
  b.onkeydown=e=>{
    const n=SCENES.length;let j=-1;
    if(e.key==="ArrowRight")j=(i+1)%n;else if(e.key==="ArrowLeft")j=(i-1+n)%n;else if(e.key==="Home")j=0;else if(e.key==="End")j=n-1;
    if(j<0)return;e.preventDefault();show(j);tabs.children[j].focus();
  };
  tabs.append(b);
});
function show(i){
  [...tabs.children].forEach((b,j)=>{b.setAttribute("aria-selected",i===j);b.tabIndex=i===j?0:-1});
  stage.setAttribute("aria-labelledby","tab-"+i);
  const sc=SCENES[i]; stage.style.backgroundImage=`url(${sc.img})`; stage.textContent="";
  for(const [x,y,a,text,fam,px,w,color,area,ex] of sc.items){
    const e=document.createElement("div"); e.className="t "+a; e.textContent=text; e.dataset.fam=fam; e.dataset.px=px; e.dataset.w=w; e.dataset.area=area;
    if(fam===FIXED){ // drawn in a family no group of the app reaches: shown, but nothing to select
      e.classList.add("fixed");e.setAttribute("aria-label",`${text.trim()||"(blank)"}, default font, not adjustable`);
    }else{e.tabIndex=0;e.setAttribute("role","button");e.setAttribute("aria-label",`${text.trim()||"(blank)"}, font group ${fam}`)}
    if(ex?.up) e.style.textTransform="uppercase";
    if(ex?.runs){e.textContent="";for(const [t,rp,rc,rw] of ex.runs){const r=document.createElement("span");r.className="run";r.textContent=t;r.dataset.px=rp;if(rc)r.style.color=rc;if(rw)r.dataset.w=rw;e.append(r)}}
    if(ex?.clipR) e.dataset.clipR=ex.clipR;
    if(ex?.vbox){e.dataset.vtop=ex.vbox[0];e.dataset.vh=ex.vbox[1]}
    if(ex?.hbox){e.dataset.hl=ex.hbox[0];e.dataset.hw=ex.hbox[1]}
    e.dataset.y=y;
    if(ex?.cells){e.dataset.cells=ex.cells;e.textContent="";for(const ch of text){const c=document.createElement("span");c.className="cell";c.textContent=ch;e.append(c)}}
    if(ex?.bw||ex?.bh){e.classList.add("box");e.dataset.bw=ex.bw||"";e.dataset.bh=ex.bh||"";e.dataset.top=ex.top?1:"";e.style.textAlign=ex.ta||({l:"left",c:"center",r:"right"}[a])}
    Object.assign(e.style,{left:x/20+"%",top:y/11.24+"%",color});
    {const m=/^#([0-9a-f]{3}|[0-9a-f]{6})/i.exec(color);if(m){let v=m[1];if(v.length===3)v=[...v].map(c=>c+c).join("");const l=(.299*parseInt(v.slice(0,2),16)+.587*parseInt(v.slice(2,4),16)+.114*parseInt(v.slice(4,6),16))/255;if(l<.4)e.style.textShadow="none"}}
    if(ex?.ls) e.dataset.ls=ex.ls;
    if(ex?.face) e.dataset.face=ex.face;
    if(ex?.row){e.dataset.row=ex.row;e.dataset.ow=ex.ow;if(ex.slot)e.dataset.slot=ex.slot}
    if(ex?.chip){ // a box behind the text that moves with it (e.g. the selected tab)
      const c=document.createElement("div");c.className="chip";c.dataset.pad=ex.chip[2];
      Object.assign(c.style,{top:ex.chip[0]/11.24+"%",height:ex.chip[1]/11.24+"%",background:ex.chip[3]});
      stage.append(c);e.chip=c;
    }
    if(ex?.shrink) e.dataset.shrink=ex.shrink;
    if(ex?.after!=null) e.dataset.after=ex.after;
    if(ex?.before!=null) e.dataset.before=ex.before;
    if(ex?.col){e.dataset.colR=ex.col[0];e.dataset.colW=ex.col[1]}
    if(ex?.flow){e.dataset.flow=ex.flow;e.dataset.fcol=ex.fcol}
    if(fam!==FIXED){
      e.onmouseenter=()=>hl(fam,true); e.onmouseleave=()=>hl(fam,false); e.onclick=()=>select(fam);
      e.onfocus=()=>hl(fam,true); e.onblur=()=>hl(fam,false);
      e.onkeydown=ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();select(fam)}};
    }
    if(ex?.ns) e.style.textShadow="none";
    stage.append(e);
  }
  restyle();
}
function restyle(){
  const s=stage.clientWidth/2000;
  stage.querySelectorAll(".t").forEach(e=>{
    const f=e.dataset.fam, st=STORE[f], look=e.dataset.face||f;   // look: the face the game shows (the stand-in imitates it)
    // Weight/slant: the game only requests a weight for "Stratum2" (bold) and "Stratum2 Mono" (bold);
    // otherwise it is part of the family name. A chosen font is therefore shown regular/upright, an unchanged group in its original look.
    const w=+e.dataset.w, requested=(f==="Stratum2"||f==="Stratum2 Mono")?w:400;
    const isMono=/mono|monodigit/i.test(look);
    const original=isMono?(/light/i.test(look)?300:w):/black/i.test(look)?900:/bold/i.test(look)?700:/medium/i.test(look)?500:/light|thin/i.test(look)?300:w;
    const style=st?.italic ? "italic" : (st?.font ? "normal" : (/italic/i.test(look)?"italic":"normal"));
    const real=!st?.font&&haveGameFace(gameFam(look),original,style);   // the game's own face is installed: no stand-in corrections
    const stand=!st?.font&&!real;
    const wd=(st?.width||1)*(stand?standIn(look).width:1);
    e.style.fontWeight = st?.weight ? st.weight : (st?.font ? requested : original);
    e.style.fontStyle = style;
    e.style.fontSynthesis = st?.italic||stand ? "style" : "none"; // the game shears the glyphs if the font has no italic face (the stand-ins have none)
    if(st?.font) ensureFace(st.font);
    // the game appends ",Arial" to every font-family list; Monodigit only has digits, the rest comes from Stratum2. The game's
    // family comes first (the original font where it is installed), then the stand-in
    e.style.fontFamily = st?.font ? famCss(st.font,"Arial,sans-serif")
      : `${NOLOCAL?"":`"${gameFam(look)}",${real&&/monodigit/i.test(look)?'"Stratum2",':""}`}${fallback(look)}`;
    // em size in the game = CSS px * TEXT_SCALE * UI scale (* fontconfig factors): measured with the measurement fonts, text is
    // drawn at 1.25 per CSS px where the layout uses 1440/1080. A stand-in is drawn at the size where its capitals are as tall
    // as the original's.
    const capk=stand?standScale(look):1;
    const emFor=px=>px*1.0407*s*TEXT_SCALE*(st?.scale||1)*capk*textScale;
    const em=Math.max(1,emFor(+e.dataset.px));
    e.style.fontSize = em+"px";
    // a run with its own weight (bold and regular parts of one label); a weight set by the user wins
    e.querySelectorAll(".run").forEach(r=>{r.style.fontSize=Math.max(1,emFor(+r.dataset.px))+"px";r.style.fontWeight=r.dataset.w&&!st?.weight?r.dataset.w:""});
    if(e.dataset.cells){const cw=e.dataset.cells*1.0407*s/wd+"px";e.querySelectorAll(".cell").forEach(c=>c.style.width=cw)}
    if(e.classList.contains("box")){ // fixed frame from the game CSS: does not grow with the font
      const u=1.0407*s;
      e.style.width = e.dataset.bw ? (e.dataset.bw*u/wd)+"px" : "";
      e.style.height = e.dataset.bh ? (e.dataset.bh*u)+"px" : "";
      e.style.lineHeight = e.dataset.top ? "1" : (e.dataset.bh ? (e.dataset.bh*u)+"px" : "1");
    }
    e.classList.toggle("sel",f===selected);
    e.setAttribute("aria-pressed",f===selected);
    if(e.dataset.hl){ // the game centres the label in its container and anchors it at the left edge once it is wider
      const w=e.offsetWidth*wd/s;
      e.style.left=((+e.dataset.hl+Math.max(0,(+e.dataset.hw-w)/2))/20)+"%";
    }
    e.style.letterSpacing = e.dataset.ls ? (e.dataset.ls*1.0407*s/wd)+"px" : "";   // inside the scaleX
    e.style.setProperty("--sx",wd);
    // after letter spacing and scaleX: both change where the text ends
    if(e.dataset.clipR){ // the game cuts the text at the frame: larger text is not wrapped or shrunk, the end just disappears
      e.style.clipPath="";
      const over=e.getBoundingClientRect().right-(stage.getBoundingClientRect().left+e.dataset.clipR*s);
      e.style.clipPath=over>0?`inset(-100px ${over/wd}px -100px -100px)`:"";
    }
    if(e.dataset.shrink){ // text-overflow: shrink: the game makes the text smaller until it fits the width
      const over=(e.offsetWidth-4)*wd/(e.dataset.shrink*1.0407*s);
      if(over>1){e.style.fontSize=em/over+"px";e.querySelectorAll(".run").forEach(r=>{r.style.fontSize=parseFloat(r.style.fontSize)/over+"px"})}
    }
    if(e.dataset.colR){ // centred in a right-aligned column that grows with the text once it is wider than the other children
      const w=(e.offsetWidth-4)*wd/s;
      e.style.left=((e.dataset.colR-Math.max(w,+e.dataset.colW)/2)/20)+"%";
    }
    // y in scenes.js = middle of the capital height (digits/caps) as measured in the game; place the line box accordingly
    let mt=capShift(e);
    if(e.dataset.vtop&&st?.font){
      // Pango sizes a line by the font's ascent+descent and, when that is taller than the container, anchors it at the top
      // (not centred), so a font with a big line box sits lower than the cap-centred original
      const m=fontBox(e);
      if(m){
        const base=e.dataset.vtop*s+Math.max(0,(e.dataset.vh*s-(m.A+m.D)*em)/2)+m.A*em;   // baseline, stage px
        mt=base-(m.A-m.D)*em/2-e.dataset.y*s;
      }
    }
    e.style.marginTop = mt+"px";
    e.classList.toggle("chg",isChg(st));
  });
  // labels that continue another one (a clan tag and the name next to it): placed at its end, so they move when its font changes
  const sr=stage.getBoundingClientRect(), pad=el=>2*(parseFloat(el.style.getPropertyValue("--sx"))||1);
  stage.querySelectorAll(".t[data-after],.t[data-before]").forEach(e=>{
    if(e.dataset.after){const p=e.previousElementSibling;e.style.left=((p.getBoundingClientRect().right-pad(p)-sr.left)/s+ +e.dataset.after)/20+"%"}
    else{const n=e.nextElementSibling;e.style.left=((n.getBoundingClientRect().left+pad(n)-sr.left)/s- +e.dataset.before)/20+"%"}
  });
  layoutRows(s);
  layoutFlows(s);
}
// Columns that flow to the right (FLOWS in scenes.js): a column starts after the widest text of the one before it; the text
// wraps (lines as tall as the font's ascent+descent, like Pango) where it would run past the parent's right edge.
function layoutFlows(s){
  const flows={};
  stage.querySelectorAll(".t[data-flow]").forEach(e=>((flows[e.dataset.flow]??=[])[+e.dataset.fcol]??=[]).push(e));
  for(const [id,cols] of Object.entries(flows)){
    const f=FLOWS[id];
    if(!f) continue;
    let x=f.x;
    cols.forEach((els,i)=>{
      const avail=f.right-f.gap-x;
      let w=0;
      for(const e of els){
        const sx=parseFloat(e.style.getPropertyValue("--sx"))||1;
        Object.assign(e.style,{left:x/20+"%",whiteSpace:"",maxWidth:"",lineHeight:""});
        if((e.offsetWidth-4)*sx/s>avail){
          Object.assign(e.style,{lineHeight:"normal"});
          const line=e.offsetHeight;
          Object.assign(e.style,{whiteSpace:"normal",maxWidth:avail*s/sx+"px"});
          e.style.marginTop=parseFloat(e.style.marginTop)+(e.offsetHeight-line)/2+"px";   // the first line stays where it was
        }
        w=Math.max(w,(e.offsetWidth-4)*sx/s);
      }
      const st=STORE[els[0].dataset.fam];
      if(f.ow[i]&&els.every(e=>!STORE[e.dataset.fam]?.font)) w=f.ow[i]*(st?.scale||1)*(st?.width||1)*textScale;
      x+=w+f.gap;
    });
  }
}
// Rows of tabs (ROWS in scenes.js): the game makes each tab as wide as its text and centres the row, so a wider font pushes the
// tabs apart. A group without a chosen font keeps the measured Stratum2 widths, so the stand-in does not move anything.
function layoutRows(s){
  const rows={};
  stage.querySelectorAll(".t[data-row]").forEach(e=>(rows[e.dataset.row]??=[]).push(e));
  for(const [id,els] of Object.entries(rows)){
    const r=ROWS[id];
    if(!r) continue;
    const w=els.map(e=>{
      const st=STORE[e.dataset.fam];
      if(!st?.font) return +e.dataset.ow*(st?.scale||1)*(st?.width||1)*textScale;
      const ls=parseFloat(e.style.letterSpacing)||0;   // CSS also spaces after the last letter, the game does not
      return (e.offsetWidth-4-ls)*(parseFloat(e.style.getPropertyValue("--sx"))||1)/s;   // minus the 2px padding on each side
    });
    let total=0;
    els.forEach((e,i)=>{total+=e.dataset.slot?+e.dataset.slot:w[i]+(i&&!els[i-1].dataset.slot?r.gap:0)});
    let x=r.c-total/2;
    els.forEach((e,i)=>{
      if(e.dataset.slot){e.style.left=(x+e.dataset.slot/2)/20+"%";x+=+e.dataset.slot;return}
      if(i&&!els[i-1].dataset.slot) x+=r.gap;
      e.style.left=(x+w[i]/2)/20+"%";
      if(e.chip){const pad=+e.chip.dataset.pad;Object.assign(e.chip.style,{left:(x-pad)/20+"%",width:(w[i]+2*pad)/20+"%"})}
      x+=w[i];
    });
  }
}
addEventListener("resize",restyle);
function hl(f,on){stage.querySelectorAll(".t").forEach(e=>e.classList.toggle("hl",on&&e.dataset.fam===f))}
function select(f){
  selected=f;
  document.querySelectorAll(".fam").forEach(e=>{const on=e.dataset.f===f;e.classList.toggle("sel",on);e.querySelector(".fam-head")?.setAttribute("aria-expanded",on)});
  restyle();
  const el=document.querySelector(`.fam[data-f="${CSS.escape(f)}"]`);
  if(el){el.closest("details")?.setAttribute("open","");el.scrollIntoView({block:"nearest"})}
}
function deselect(){
  selected=null;
  document.querySelectorAll(".fam:not(.all)").forEach(e=>{e.classList.remove("sel");e.querySelector(".fam-head")?.setAttribute("aria-expanded","false")});
  restyle();
}

// ---- font picker: the text box is a search field; arrow keys change the preview live, Enter / click chooses
let FONTLIST=[];
const pop=document.createElement("div");pop.id="pop";
const popStat=document.createElement("div");popStat.id="popStat";popStat.setAttribute("aria-live","polite");
const popList=document.createElement("div");popList.id="popList";popList.setAttribute("role","listbox");popList.setAttribute("aria-label","Fonts");
// filter by kind of font (Google's categories; "own" = uploaded, from a URL or installed on this PC)
const CATS=[["","All"],["own","Own"],["sans-serif","Sans"],["serif","Serif"],["monospace","Mono"],["display","Display"],["handwriting","Script"]];
let pickCat="";
const catOf=n=>{const c=FONTS.category(n);return c==="mine"||c==="pc"?"own":c};
const popCats=document.createElement("div");popCats.id="popCats";popCats.setAttribute("role","group");popCats.setAttribute("aria-label","Font kind");
for(const [c,label] of CATS){
  const b=document.createElement("button");b.type="button";b.tabIndex=-1;b.textContent=label;b.dataset.c=c;b.setAttribute("aria-pressed",c===pickCat);
  b.onmousedown=e=>e.preventDefault();   // the text box keeps the focus
  b.onclick=()=>{pickCat=c;[...popCats.children].forEach(x=>x.setAttribute("aria-pressed",x.dataset.c===c));if(pk){render(false);pk.idx=0;paint(false)}};
  popCats.append(b);
}
pop.append(popStat,popCats,popList);document.body.append(pop);
let pk=null;
const RECENT_KEY="recentFonts";
const loadRecent=()=>{try{const r=JSON.parse(localStorage.getItem(RECENT_KEY));return Array.isArray(r)?r:[]}catch{return []}};
function pushRecent(name){
  if(!name) return;
  try{localStorage.setItem(RECENT_KEY,JSON.stringify([name,...loadRecent().filter(x=>x!==name)].slice(0,6)))}catch{}
}
const snapshot=()=>JSON.parse(JSON.stringify(STORE));
function restoreSnapshot(s){for(const g in ctl)ctl[g].set(s[g]||DEF);restyle()}

// Search: every word must occur somewhere in the name, ignoring case, spaces and punctuation
// ("segoeui" finds "Segoe UI", "arial bl" finds "Arial Black"). Better matches come first.
const normKey=s=>s.replace(/[^\p{L}\p{N}]+/gu,"");
const fontKeys=new Map();
function fontKey(n){
  let k=fontKeys.get(n);
  if(!k){const low=n.toLowerCase();k={low,norm:normKey(low),words:low.split(/[^\p{L}\p{N}]+/u).filter(Boolean)};fontKeys.set(n,k)}
  return k;
}
const pickable=()=>pickCat?FONTLIST.filter(n=>catOf(n)===pickCat):FONTLIST;
function searchFonts(q){
  const tokens=q.toLowerCase().split(/\s+/).map(normKey).filter(Boolean), list=pickable();
  if(!tokens.length) return list;
  const whole=tokens.join(""), first=tokens[0], hits=[];
  list.forEach((n,i)=>{
    const k=fontKey(n);
    if(!tokens.every(t=>k.norm.includes(t))) return;
    const rank=k.norm===whole?0:k.norm.startsWith(first)?1:k.words.some(w=>w.startsWith(first))?2:3;
    hits.push([rank,i]);
  });
  return hits.sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map(h=>list[h[1]]);
}

// a text typed into the box only searches; nothing is written to the settings until a font is chosen
function attachPicker(input,apply,preview){
  let typing=null, justFocused=false;
  const open=()=>{
    if(pk&&pk.input===input) return;
    closePicker(true);
    pk={input,apply,preview,snap:snapshot(),initial:input.value,q:"",list:[],idx:0,done:false,nRecent:0};
    input.setAttribute("aria-expanded","true");
    render(true); place(true);
  };
  // the typed word is applied after a short pause, so fast typing does not rebuild the list on every key
  const run=()=>{
    typing=null;if(!pk||pk.input!==input) return;
    pk.q=input.value.trim();render(false);
    pk.idx=0;paint(false);
    // live preview of the best match, without touching the text the user is typing
    if(pk.preview) pk.preview(pk.q&&pk.list.length?pk.list[0]:pk.q?pk.initial:"");
  };
  const flush=()=>{if(typing!==null){clearTimeout(typing);run()}};
  input.addEventListener("focus",()=>{justFocused=true;open();input.select()});  // typing replaces the current font name
  input.addEventListener("mouseup",e=>{if(justFocused){e.preventDefault();justFocused=false}});
  input.addEventListener("click",open);
  input.addEventListener("input",()=>{if(!pk)open();clearTimeout(typing);typing=setTimeout(run,70)});
  input.addEventListener("keydown",e=>{
    if(!pk||pk.input!==input){ if(e.key==="ArrowDown"||e.key==="ArrowUp"){open();e.preventDefault()} return }
    flush();
    const n=pk.list.length, page=Math.max(1,Math.floor(pop.clientHeight/28));
    const move=d=>{if(!n)return;pk.idx=Math.max(0,Math.min(n-1,pk.idx+d));paint(true);e.preventDefault()};
    switch(e.key){
      case "ArrowDown":move(1);break; case "ArrowUp":move(-1);break;
      case "PageDown":move(page);break; case "PageUp":move(-page);break;
      case "Home": if(!input.value||pk.q===""){pk.idx=0;paint(true);e.preventDefault()} break;
      case "End": if(pk.q===""){pk.idx=n-1;paint(true);e.preventDefault()} break;
      case "Enter": commit();e.preventDefault();break;
      case "Tab": commit();break;
      case "Escape": closePicker(true);e.preventDefault();e.stopPropagation();break;
    }
  });
  input.addEventListener("blur",()=>{justFocused=false;clearTimeout(typing);typing=null;setTimeout(()=>{ if(pk&&pk.input===input&&!pk.done) closePicker(true) },120)});
}
function items(){
  const q=pk.q;
  if(q){pk.nRecent=0;return searchFonts(q)}
  const list=pickable(), recent=loadRecent().filter(r=>list.includes(r));
  pk.nRecent=recent.length;
  return ["",...recent,...list.filter(f=>!recent.includes(f))];
}
// the name with the searched text marked
function nameWithMark(o,name,q){
  const at=q?name.toLowerCase().indexOf(q.toLowerCase()):-1;
  if(at<0){o.textContent=name;return}
  const m=document.createElement("mark");m.textContent=name.slice(at,at+q.length);
  o.append(name.slice(0,at),m,name.slice(at+q.length));
}
function render(scrollToCurrent){
  pk.list=items(); popList.textContent="";
  const total=pickable().length;
  popStat.textContent=!FONTLIST.length?"Loading the font list…":pk.q?(pk.list.length?`${pk.list.length} of ${total} fonts`:`No font matches “${pk.q}”`):`${total} fonts`;
  popStat.classList.toggle("none",!!pk.q&&!pk.list.length);
  if(!pk.list.length) return;
  const cur=pk.initial;
  pk.list.forEach((name,i)=>{
    const o=document.createElement("div");
    o.className="opt"+(name===""?" orig":"")+(name===cur?" cur":"")+(i>=1&&i<=pk.nRecent?" recent":"")+(pk.nRecent&&i===pk.nRecent+1?" first-all":"");
    o.dataset.i=i;o.id="opt-"+i;o.setAttribute("role","option");
    if(name){
      const n=document.createElement("span");n.className="nm";nameWithMark(n,name,pk.q);o.append(n);
      const t=FONTS.tag(name);if(t){const g=document.createElement("span");g.className="tag";g.textContent=t;o.append(g)}
    }else o.textContent="Original (unchanged)";
    o.onmousedown=e=>e.preventDefault();
    o.onmouseenter=()=>{pk.idx=i;paint(false)};
    o.onclick=()=>{pk.idx=i;commit()};
    popList.append(o);
  });
  if(scrollToCurrent){const i=pk.list.indexOf(cur);pk.idx=i<0?0:i}
  paint(false,true);
  loadVisible();
}
let lvTimer=null;
function loadVisible(){
  clearTimeout(lvTimer);
  lvTimer=setTimeout(()=>{
    if(!pk) return;
    const top=pop.scrollTop-60, bottom=pop.scrollTop+pop.clientHeight+60;
    [...popList.children].forEach(o=>{
      const name=pk.list[+o.dataset.i];
      if(!name||o.offsetTop+o.offsetHeight<top||o.offsetTop>bottom) return;
      if(o.dataset.pv) return;o.dataset.pv=1;
      FONTS.previewFamily(name).then(f=>{if(f)o.firstChild.style.fontFamily=f+",sans-serif"});
    });
  },60);
}
pop.addEventListener("scroll",()=>loadVisible());
function paint(preview,center){
  [...popList.children].forEach((o,i)=>{o.classList.toggle("act",i===pk.idx);o.setAttribute("aria-selected",i===pk.idx)});
  const el=popList.children[pk.idx];
  if(el){
    pk.input.setAttribute("aria-activedescendant",el.id);
    if(center) pop.scrollTop=Math.max(0,el.offsetTop-pop.clientHeight/2+14); else el.scrollIntoView({block:"nearest"});
  }
  if(preview&&pk.list[pk.idx]!==undefined){const name=pk.list[pk.idx];pk.input.value=name;pk.apply(name)}
}
function place(first){
  const r=pk.input.getBoundingClientRect(), below=innerHeight-r.bottom-12, above=r.top-12;
  const up=below<220&&above>below, h=Math.min(380,up?above:below);
  Object.assign(pop.style,{display:"block",left:r.left+"px",width:Math.max(r.width,260)+"px",maxHeight:h+"px",top:up?"auto":(r.bottom+2)+"px",bottom:up?(innerHeight-r.top+2)+"px":"auto"});
  if(first&&pk) paint(false,true);
}
function endPicker(){
  pk.input.setAttribute("aria-expanded","false");pk.input.removeAttribute("aria-activedescendant");
  pk.done=true; pop.style.display="none";
}
function commit(){
  if(!pk) return;
  const name=pk.list[pk.idx];
  if(name===undefined) return;           // nothing matches: stay open, the list says so
  pk.input.value=name;pk.apply(name);pushRecent(name);
  endPicker(); const i=pk.input; pk=null; i.blur();
}
function closePicker(revert){
  if(!pk) return;
  if(revert){ pk.input.value=pk.initial; restoreSnapshot(pk.snap) }
  endPicker(); pk=null;
}
addEventListener("resize",()=>{if(pk)place()});
document.fonts?.addEventListener?.("loadingdone",()=>restyle());
document.addEventListener("scroll",e=>{if(pk&&e.target!==pop)place()},true);

// ---- sidebar: font groups
const groups={};
SCENES.forEach(sc=>sc.items.forEach(it=>{const f=it[4],a=it[8];if(f!==FIXED)(groups[f]??={areas:new Set()}).areas.add(a)}));
const rulesNow=()=>Object.entries(STORE).filter(([,v])=>isChg(v)).map(([group,v])=>({group,font:v.font||"",scale:v.scale||1,weight:v.weight||0,italic:!!v.italic,width:v.width||1}));
const rulesKey=()=>JSON.stringify({r:rulesNow().sort((a,b)=>a.group<b.group?-1:1),t:textScaleNow()});
const emptyKey=JSON.stringify({r:[],t:0});

// "Stratum2 Black Italic" -> "Black · Italic"
function famDesc(n){
  const l=n.toLowerCase();
  if(l==="stratum2") return "Default text · regular and bold";
  if(l==="notosans"||l==="noto sans") return "Fallback text";
  if(/noto ?mono|notomono/.test(l)) return "Fallback · fixed-width";
  const p=[];
  for(const [rx,t] of [[/\bthin\b/,"Thin"],[/\blight\b/,"Light"],[/\bmedium\b/,"Medium"],[/\bbold\b/,"Bold"],[/\bblack\b/,"Black"]]) if(rx.test(l)){p.push(t);break}
  if(!p.length) p.push("Regular");
  if(/italic/.test(l)) p.push("Italic");
  if(/condensed/.test(l)) p.push("Condensed");
  if(/monodigit/.test(l)) p.push("Fixed-width digits"); else if(/\bmono\b/.test(l)) p.push("Fixed-width");
  if(/\btf\b/.test(l)) p.push("Tabular figures");
  return p.join(" · ");
}

function updateDirty(){
  updateCfgLabel();
  if(!started) return;
  const k=rulesKey();
  isDirty=k!==savedKey;
  $("dirty").classList.toggle("on",isDirty);
  $("dirtyText").textContent=isDirty?"Not downloaded yet":(k===emptyKey?"No changes":"Same as the last download");
  rememberCurrent();
}
function updateCount(){
  const n=document.querySelectorAll(".fam.changed:not(.gtext)").length;
  const c=$("count"); c.textContent=n+(n===1?" group changed":" groups changed"); c.classList.toggle("some",n>0);
  updateDirty();updateVisibility();
}
// filter box + "changed only"
function updateVisibility(){
  const tokens=$("q").value.toLowerCase().split(/\s+/).filter(Boolean), onlyChg=document.body.classList.contains("onlychg");
  let shown=0, shownMore=0, more=0;
  document.querySelectorAll(".fam:not(.all):not(.gtext)").forEach(e=>{
    const match=tokens.every(t=>e.dataset.hay.includes(t));
    e.classList.toggle("hide",!match);
    const inMore=!!e.closest("#more");
    if(inMore)more++;
    if(match&&(!onlyChg||e.classList.contains("changed"))){shown++;if(inMore)shownMore++}
  });
  $("nomatch").hidden=shown>0;
  $("moreBox").hidden=more===0;
  $("moreCount").textContent="("+(tokens.length?shownMore+"/":"")+more+")";
  if(tokens.length&&shownMore>0) $("moreBox").setAttribute("open","");
}
const refreshAllRst=()=>{document.querySelectorAll(".fam").forEach(e=>e.refreshRst&&e.refreshRst());updateCount()};

function renderAreas(el,f,preview){
  el.textContent="";
  const u=usage(f);
  const line=document.createElement("span");
  if(u){
    const names=Object.keys(u.areas);
    line.textContent="Used in: "+names.slice(0,3).join(" · ")+(names.length>3?" · +"+(names.length-3)+" more":"");
    line.title=names.map(a=>`${a} (${u.areas[a]})`).join("\n")+"\n\nStyle files: "+u.files.join(", ");
  }else line.textContent=preview?"":"Not found in the scanned game styles (may be unused).";
  el.append(line);
  if(preview){const p=document.createElement("span");p.className="prev";p.textContent="Preview: "+preview;el.append(p)}
}

function famBox(f,preview,parent,isAll){
  const d=document.createElement("div");d.className="fam"+(isAll?" all":"");d.dataset.f=f;
  const id="g"+(++uid), label=isAll?"All groups":f;
  d.innerHTML=`<div class="fam-top">
   <button type="button" class="fam-head" aria-expanded="false" aria-controls="${id}-ctl"><span class="fam-name">${esc(label)}</span><span class="fam-desc">${esc(isAll?"Sets the same font for every group, including the ones not in the preview":famDesc(f))}</span></button>
   <button type="button" class="rst" title="Reset all settings of this group" aria-label="Reset ${esc(label)}">Reset</button></div>
   <div class="sum"></div>
   <div class="areas"></div>
   <div class="ctl" id="${id}-ctl" role="group" aria-label="Settings for ${esc(label)}">
   <label class="l" for="${id}-fp">Font</label><input class="fp span2" id="${id}-fp" placeholder="Original (unchanged)" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="popList">
   <label class="l" for="${id}-sz">Size</label><input class="sz" id="${id}-sz" type="range" min="0.5" max="1.5" step="0.05" value="1" title="Double-click to reset"><output class="v" for="${id}-sz">×1.00</output>
   <label class="l" for="${id}-wd">Width</label><input class="wd" id="${id}-wd" type="range" min="0.5" max="1.5" step="0.05" value="1" title="Double-click to reset"><output class="wv" for="${id}-wd">×1.00</output>
   <label class="l" for="${id}-wt">Weight</label><select class="wt span2" id="${id}-wt">${WEIGHTS.map(([n,t])=>`<option value="${n}">${t}${n?" ("+n+")":""}</option>`).join("")}</select>
   <span class="l">Style</span><span class="chk span2">
    <label class="sw"><input type="checkbox" class="it"><span class="cap"><i class="knob"></i></span><span>Italic</span></label></span></div>`;
  const q=s=>d.querySelector(s);
  const fi=q(".fp"),sc=q(".sz"),wd=q(".wd"),wt=q(".wt"),it=q(".it"),v=q(".v"),wv=q(".wv");
  const read=()=>({font:fi.value.trim(),scale:+sc.value,weight:+wt.value,italic:it.checked,width:+wd.value});
  const show=x=>{fi.value=x.font;sc.value=x.scale;wd.value=x.width;wt.value=x.weight;it.checked=x.italic;v.textContent="×"+(+x.scale).toFixed(2);wv.textContent="×"+(+x.width).toFixed(2);fillRange(sc);fillRange(wd)};
  const set=x=>{x={...DEF,...x};show(x);STORE[f]=x;d.refreshRst&&d.refreshRst()};
  const upd=()=>{
    const x=read(); show(x);
    if(isAll){for(const g of GAME_FAMILIES)ctl[g]?.set(x)} else STORE[f]=x;
    restyle();refreshAllRst();
  };
  // live preview of the best match while typing: only the settings change, never the text in the box
  const previewFont=font=>{
    const x={...read(),font};
    STORE[f]=x;restyle();updateCount();
  };
  attachPicker(fi,font=>{fi.value=font;upd()},isAll?null:previewFont);
  const rst=q("button.rst"), sum=q(".sum");
  if(isAll) q(".areas").remove();
  else renderAreas(q(".areas"),f,preview);
  const u=usage(f);
  d.dataset.hay=(f+" "+(isAll?"":famDesc(f))+" "+(preview||"")+" "+(u?Object.keys(u.areas).join(" ")+" "+u.files.join(" "):"")).toLowerCase();
  const refreshRst=()=>{
    const x=read(), changed=isChg(x);
    rst.disabled=!changed; d.classList.toggle("changed",changed&&!isAll);
    updateCount();
    sum.textContent=changed?[x.font||"original font",x.scale!==1?"size ×"+x.scale.toFixed(2):"",x.width!==1?"width ×"+x.width.toFixed(2):"",x.weight?"weight "+x.weight:"",x.italic?"italic":""].filter(Boolean).join(" · "):"";
  };
  rst.onclick=e=>{e.stopPropagation();
    if(isAll){for(const g of GAME_FAMILIES)ctl[g]?.set(DEF);show(DEF)} else ctl[f].set(DEF);
    restyle();refreshAllRst()};
  d.refreshRst=refreshRst;
  q(".fam-head").onclick=()=>{
    if(isAll){const on=d.classList.toggle("sel");q(".fam-head").setAttribute("aria-expanded",on)}
    else if(selected===f) deselect(); else select(f);
  };
  if(!isAll){d.onmouseenter=()=>hl(f,true);d.onmouseleave=()=>hl(f,false);ctl[f]={set}}
  for(const c of [sc,wd,wt,it]) c.oninput=upd;
  sc.ondblclick=()=>{sc.value=1;upd()};
  wd.ondblclick=()=>{wd.value=1;upd()};
  parent.append(d);
}

function buildGroupList(){
  famBox("*",null,$("allbox"),true);
  Object.keys(groups).sort().forEach(f=>famBox(f,[...groups[f].areas].join(" · "),$("fams")));
  const inPreview=new Set(Object.keys(groups).map(famKey));
  const more=GAME_FAMILIES.filter(f=>!inPreview.has(famKey(f))).sort((a,b)=>a.toLowerCase()<b.toLowerCase()?-1:1);
  more.forEach(f=>famBox(f,"",$("more")));
  GAME_FAMILIES=[...Object.keys(groups),...more];   // one name per family, as the groups are shown
}
$("q").oninput=updateVisibility;

// Global text size: one fontconfig rule that multiplies the pixel size of every font, fallback fonts included.
// (The game's Pango resolution is fixed at 72 dpi and fontconfig's "dpi" is not consulted, so dpi cannot be used for this.)
// Fixed frames do not grow with it, so larger text gets clipped there.
const textScaleNow=()=>textScale===1?0:Math.round(textScale*100)/100;
function setTextScale(x){
  textScale=x>0?Math.min(2,Math.max(.5,x)):1;
  $("gt").value=textScale;fillRange($("gt"));
  $("gtOut").textContent="×"+textScale.toFixed(2);
  $("gtext").classList.toggle("changed",textScale!==1);
  $("gtReset").disabled=textScale===1;
  restyle();updateCount();
}
$("gt").oninput=()=>{const x=+$("gt").value;setTextScale(Math.abs(x-1)<.001?0:x)};
$("gt").ondblclick=()=>setTextScale(0);
$("gtReset").onclick=()=>setTextScale(0);

// ---- font list (fonts.js: Google Fonts, own files, fonts of this PC)
let FONTSET=new Set();
function fillFonts(){FONTLIST=FONTS.names(); FONTSET=new Set(FONTLIST.map(f=>f.toLowerCase()));if(pk)render(false);renderSources()}
FONTS.onChange(fillFonts);

// ---- configurations: one menu for saved ones, presets, save / import / export
// A configuration is a list of rules. Loading one replaces the settings in the UI; "Download .zip" packs them for the game.
// A preset sets one font (font) or builds each group's rule (fonts: all must be available, rule: group -> rule fields).
// The weight comes from the group's name: with a chosen font the game no longer finds it in the family name.
const nameWeight=g=>/black|bold/i.test(g)?700:/medium/i.test(g)?600:/light|thin/i.test(g)?300:0;
const PRESETS=[
  // Google fonts, scaled to the cap height of Stratum2 (0.666 em; Barlow and Roboto 0.70, the mono fonts 0.73: the size slider
  // steps by 5%). Barlow is DIN-like like Stratum2 and has a condensed cut of its own.
  {label:"Barlow (DIN-like)",fonts:["Barlow","Barlow Condensed","JetBrains Mono"],match:g=>/^stratum2/i.test(g),rule:g=>{
    const italic=/italic/i.test(g);
    if(/\bmono\b/i.test(g)) return {font:"JetBrains Mono",scale:0.9,weight:/light/i.test(g)?300:0,italic};
    return {font:/condensed/i.test(g)?"Barlow Condensed":"Barlow",scale:0.95,weight:nameWeight(g),italic};
  }},
  {label:"Roboto (Roboto, Roboto Condensed, Roboto Mono)",fonts:["Roboto","Roboto Condensed","Roboto Mono"],match:g=>/^stratum2/i.test(g),rule:g=>{
    const italic=/italic/i.test(g);
    if(/\bmono\b/i.test(g)) return {font:"Roboto Mono",scale:0.9,weight:/light/i.test(g)?300:0,italic};
    return {font:/condensed/i.test(g)?"Roboto Condensed":"Roboto",scale:0.95,weight:nameWeight(g),italic};
  }},
  // the preview's own stand-ins with the same size and width the preview draws them at: the game then looks like the preview
  // of unchanged groups (the bundled files in fonts/ are named differently from the Google families)
  {label:"Preview fonts (Saira, Chivo Mono)",fonts:["Saira Semi Condensed","Saira Extra Condensed","Chivo Mono"],
   match:g=>/^stratum2/i.test(g),rule:g=>{
    const x=standIn(g), italic=/italic/i.test(g), scale=standScale(g);
    if(isMonoFam(g)) return {font:"Chivo Mono",scale,width:x.width,weight:/light/i.test(g)?300:0,italic};
    const weight=/black/i.test(g)?900:/bold/i.test(g)?700:/medium/i.test(g)?500:/light/i.test(g)?300:/thin/i.test(g)?100:0;
    return {font:{"Saira SemiCondensed":"Saira Semi Condensed","Saira ExtraCondensed":"Saira Extra Condensed"}[x.font],scale,width:x.width,weight,italic};
  }},
  // fonts of this PC (only listed once the browser may use them): Windows 11's own fonts. Bahnschrift is at equal cap height
  // only 3.5% wider than Stratum2 (capitals 0.71 em, hence 95%); the condensed groups squeezed to its own condensed cut.
  {label:"Windows 11 (Bahnschrift, Consolas)",fonts:["Bahnschrift","Consolas"],match:g=>/^stratum2/i.test(g),rule:g=>{
    const italic=/italic/i.test(g);
    if(/\bmono\b/i.test(g)) return {font:"Consolas",italic};
    return {font:"Bahnschrift",scale:0.95,weight:nameWeight(g),italic,width:/condensed/i.test(g)?0.75:1};
  }},
  {label:"Segoe UI for all groups",font:"Segoe UI",match:()=>true},
];
const presetFonts=p=>p.fonts||[p.font];
const presetRules=p=>Object.keys(ctl).filter(p.match).map(group=>({group,...(p.rule?p.rule(group):{font:p.font})}));

// replaces the settings in the UI with a list of rules
function applyRuleList(list,ts){
  const clamp=(x,d)=>Number.isFinite(+x)&&+x>0?Math.min(1.5,Math.max(.5,+x)):d;
  const next={};let skipped=0;const missing=new Set();
  for(const r of list){
    const g=typeof r?.group==="string"?groupOf(r.group):null;
    if(!g){skipped++;continue}
    let font=typeof r.font==="string"?r.font:"";
    if(font){const s=FONTS.get(font);if(s)font=s.family;else if(FONTSET.size){missing.add(font);font=""}}
    const wt=WEIGHTS.some(([n])=>n===+r.weight)?+r.weight:0;
    next[g]={font,scale:clamp(r.scale,1),weight:wt,italic:!!r.italic,width:clamp(r.width,1)};
  }
  const tv=Number(ts), tsOk=Number.isFinite(tv)&&tv>=.5&&tv<=2&&tv!==1?tv:0;
  setTextScale(tsOk);
  for(const g of Object.keys(ctl)) ctl[g].set(next[g]||DEF);
  restyle();refreshAllRst();
  return {n:Object.keys(next).length,skipped,missing:[...missing],textScale:tsOk};
}
const loadedMsg=(what,{n,skipped,missing,textScale})=>`${what}: ${n} ${n===1?"rule":"rules"}`+(textScale?`, text size ${Math.round(textScale*100)}%`:"")+(skipped?`, ${skipped} unknown group(s) skipped`:"")+(missing.length?`. Missing fonts (upload them, then load again): ${nameList(missing)}`:"")+".";
// loading replaces the current settings: ask first if there are changes that are not saved or downloaded
const confirmReplace=()=>!isDirty||confirm("Replace your current changes?");
// fonts from a URL come back by themselves: a configuration remembers where they were downloaded
async function fetchUrlFonts(sources){
  const failed=[];
  for(const s of sources||[]) if(s?.kind==="url"&&s.url&&!FONTS.get(s.family)){
    try{setStatus(`Downloading ${s.family}…`);await FONTS.addUrl(s.url)}catch(e){failed.push(`${s.family}: ${e.message}`)}
  }
  if(failed.length) setStatus(failed.join(" · "),"err");
}
async function useRules(name,list,what,ts,sources){
  await fetchUrlFonts(sources);
  const r=applyRuleList(list,ts);
  cfgName=name;cfgKey=rulesKey();updateCfgLabel();
  setStatus(loadedMsg(what,r),r.skipped||r.missing.length?"err":"ok");
}
// where the fonts of the current rules come from, for saved configurations and exported .json files
const sourcesNow=rules=>[...new Set(rules.map(r=>r.font).filter(Boolean))].map(f=>{const s=FONTS.get(f);return s?.kind==="file"&&s.url?{family:s.family,kind:"url",url:s.url}:{family:f,kind:s?.kind||""}});

// saved configurations: in this browser (localStorage)
const PROF_KEY="profiles-v1";
let PROFILES=[];
function loadProfiles(){try{const p=JSON.parse(localStorage.getItem(PROF_KEY));PROFILES=Array.isArray(p)?p:[]}catch{PROFILES=[]}}
function storeProfiles(){try{localStorage.setItem(PROF_KEY,JSON.stringify(PROFILES));return true}catch{return false}}
function loadProfile(p){
  if(!confirmReplace()) return;
  useRules(p.name,p.rules||[],`Loaded “${p.name}”`,p.textScale,p.fonts);
}
function importFile(){$("import").click()}
$("import").onchange=e=>{const file=e.target.files[0];e.target.value="";if(file)importAny(file)};
const isZip=f=>/\.zip$/i.test(f.name)||/zip/.test(f.type);
const isFontFile=f=>/\.(ttf|otf|ttc)$/i.test(f.name);
const fileBytes=async f=>new Uint8Array(await f.arrayBuffer());
async function importAny(file){
  if(isZip(file)) return importZip(file);
  if(!confirmReplace()) return;
  try{
    const j=JSON.parse(await file.text()), list=Array.isArray(j)?j:(j.rules||(j.textScale?[]:null));
    if(!Array.isArray(list)) throw new Error("no rules found");
    await useRules(file.name.replace(/\.json$/i,""),list,"Imported",Array.isArray(j)?0:j.textScale,j.fonts);
  }catch(err){setStatus("Import failed: "+err.message,"err")}
}
const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
const nameList=a=>a.slice(0,3).join(", ")+(a.length>3?` +${a.length-3} more`:"");
// a .zip: one made here (99-spddl.conf + fonts) or by the exe ("Export with fonts": config.json + fonts/) loads its settings
// and adds the fonts that are not Google fonts; any other zip only adds the fonts in it
async function importZip(file){
  setStatus(`Opening “${file.name}”…`);
  try{
    const entries=ZIP.read(await fileBytes(file));
    const top=re=>entries.filter(e=>re.test(e.name)).sort((a,b)=>a.name.split("/").length-b.name.split("/").length)[0];
    const confE=top(/(^|\/)99-spddl\.conf$/i), cfgE=top(/(^|\/)config\.json$/i);
    let st=null, name=file.name.replace(/\.zip$/i,"");
    if(confE) st=CONF.readState(new TextDecoder().decode(await confE.read()));
    else if(cfgE){try{const j=JSON.parse(new TextDecoder().decode(await cfgE.read()));if(Array.isArray(j.rules)){st={rules:j.rules,textScale:j.textScale,fonts:[]};if(j.name)name=j.name}}catch{}}
    if(st&&!confirmReplace()) return setStatus("");
    // fonts: Google fonts are downloaded fresh, everything else is kept in the browser like an upload
    const files=[];
    for(const e of entries) if(isFontFile(e)&&e.size<64<<20){
      const bytes=await e.read();
      let fam="";try{fam=SFNT.parse(bytes)[0].family}catch{continue}
      if(FONTS.get(fam)?.kind!=="google") files.push({name:e.name.split("/").pop(),bytes});
    }
    const added=files.length?(await FONTS.addFiles(files,"zip")).families:[];
    if(!st){
      if(!added.length) throw new Error("no fonts and no CS2 Font Studio settings found");
      return setStatus(`Added ${plural(added.length,"font","fonts")}: ${nameList(added)}.`,"ok");
    }
    await useRules(name,st.rules,`Imported “${name}”`+(added.length?` (${plural(added.length,"font","fonts")} added)`:""),st.textScale,st.fonts);
  }catch(err){setStatus("Import failed: "+err.message,"err")}
}

// ---- the zip for the game: unpacked into the "Counter-Strike Global Offensive" folder it puts the fonts into
// game\csgo\panorama\fonts and the rules into game\core\panorama\fonts\conf.d (the paths CS2 Font Studio writes to)
const GAME_FONTS="game/csgo/panorama/fonts/", GAME_CONF="game/core/panorama/fonts/conf.d/99-spddl.conf";
let building=false;
async function buildGameZip(rules,ts){
  const warnings=[], needs=new Map();
  rules=rules.map(r=>{
    if(!r.font) return r;
    const s=FONTS.get(r.font);
    if(!s){warnings.push(`${r.font}: font not available (upload it), the group keeps its original font`);return {...r,font:""}}
    if(!needs.has(s.family)) needs.set(s.family,[]);
    needs.get(s.family).push({weight:r.weight,italic:r.italic});
    return {...r,font:s.family};
  }).filter(r=>!CONF.trivial(r));
  const got=await FONTS.collect(needs,(d,n)=>n&&setStatus(`Downloading fonts… ${d} / ${n}`));
  warnings.push(...got.warnings);
  const conf=CONF.build({rules,copied:got.files.filter(isFontFile).map(f=>f.name),textScale:ts,fonts:got.sources},FONTS.hasItalic);
  setStatus("Packing…");
  const blob=await ZIP.build([...got.files.map(f=>({name:GAME_FONTS+f.name,data:f.data})),{name:GAME_CONF,data:conf}]);
  return {blob,warnings,local:got.sources.some(s=>s.kind==="local")};
}
async function downloadZip(name,rules,ts){
  if(building) return;
  building=true;$("save").disabled=true;
  const label=(name||"cs2-fonts").replace(/[\\/:*?"<>|]+/g,"_");
  try{
    const r=await buildGameZip(rules,ts);
    saveBlob(r.blob,label+".zip");
    const nothing=!rules.length&&!ts;
    const msg=`Downloaded “${label}.zip” (${(r.blob.size/1048576).toFixed(1)} MB). `+(nothing?"It holds no changes: unpacked, it turns earlier changes off. ":"")+
      "Unpack it into the “Counter-Strike Global Offensive” folder and allow it to replace files, then restart CS2."+
      (r.local?" It contains fonts of this PC: do not share it.":"")+(r.warnings.length?" Problems: "+r.warnings.join(" · "):"");
    setStatus(msg,r.warnings.length?"err":"ok",{label:"How to install",run:()=>{$("howto").open=true;$("howto").scrollIntoView({block:"nearest"})}});
    savedKey=rulesKey();updateDirty();
  }catch(e){setStatus("Download failed: "+e.message,"err")}
  finally{building=false;$("save").disabled=false}
}
function exportRules(){
  const rules=rulesNow(), ts=textScaleNow();
  if(!rules.length&&!ts) return setStatus("Nothing to export: nothing is changed.","err");
  const fonts=sourcesNow(rules);
  saveBlob(new Blob([JSON.stringify({app:"CS2FontStudio",version:1,rules,...(ts?{textScale:ts}:{}),...(fonts.length?{fonts}:{})},null,2)],{type:"application/json"}),(cfgName||"cs2-fonts")+".json");
  setStatus(`Exported ${rules.length} ${rules.length===1?"rule":"rules"}. Uploaded fonts are not in the file: the other PC needs them too.`,"ok");
}
// drop a configuration (.zip/.json) or font files anywhere on the window
{
  let depth=0;const drop=$("drop");
  const hasFile=e=>[...(e.dataTransfer?.types||[])].includes("Files");
  addEventListener("dragenter",e=>{if(!hasFile(e))return;e.preventDefault();if(++depth===1)drop.hidden=false});
  addEventListener("dragover",e=>{if(hasFile(e)){e.preventDefault();e.dataTransfer.dropEffect="copy"}});
  addEventListener("dragleave",e=>{if(hasFile(e)&&--depth<=0){depth=0;drop.hidden=true}});
  addEventListener("drop",e=>{
    if(!hasFile(e))return;e.preventDefault();depth=0;drop.hidden=true;
    const all=[...e.dataTransfer.files], fonts=all.filter(isFontFile);
    if(fonts.length) return addFontFiles(fonts);
    const f=all.find(f=>isZip(f)||/\.json$/i.test(f.name));
    if(f) importAny(f); else setStatus("Drop font files (.ttf, .otf, .ttc), a .zip or a .json configuration.","err");
  });
}
function openSaveForm(){
  const f=$("profForm"),p=PROFILES.find(x=>x.name===cfgName);
  f.hidden=false;$("profName").value=p?p.name:(cfgName&&!PRESETS.some(x=>x.label===cfgName)?cfgName:"");$("profName").focus();$("profName").select();
}
$("profCancel").onclick=()=>{$("profForm").hidden=true;$("cfgBtn").focus()};
$("profName").onkeydown=e=>{if(e.key==="Escape"){e.preventDefault();$("profCancel").click()}};
$("profForm").onsubmit=e=>{
  e.preventDefault();
  const name=$("profName").value.trim().replace(/\.json$/i,"");
  if(!name) return setStatus("Give the configuration a name.","err");
  const old=PROFILES.find(p=>p.name.toLowerCase()===name.toLowerCase());
  if(old&&!confirm(`Overwrite the configuration “${old.name}”?`)) return;
  const rules=rulesNow(), ts=textScaleNow();
  const p={key:old?.key||String(Date.now()),name,rules,textScale:ts,fonts:sourcesNow(rules)};
  PROFILES=[...PROFILES.filter(x=>x!==old),p].sort((a,b)=>a.name.toLowerCase()<b.name.toLowerCase()?-1:1);
  if(!storeProfiles()) return setStatus("The browser does not allow saving (private window?). Export the settings as .json instead.","err");
  $("profForm").hidden=true;
  cfgName=name;cfgKey=rulesKey();updateCfgLabel();
  setStatus(`Saved configuration “${name}” in this browser (${plural(rules.length,"rule","rules")}).`,"ok");
};

// the menu
const cfgItems=()=>[...$("cfgMenu").querySelectorAll(".mi,.mexp,.mdel")];
const ICON_ZIP='<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function renderCfgMenu(){
  const m=$("cfgMenu");m.textContent="";
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e};
  const head=t=>{const h=el("div","mh",t);h.setAttribute("role","presentation");m.append(h)};
  const note=t=>{const n=el("div","mnote",t);n.setAttribute("role","presentation");m.append(n)};
  const item=(label,tag,run,title)=>{
    const b=el("button","mi");b.type="button";b.tabIndex=-1;b.setAttribute("role","menuitem");
    b.append(el("span","",label));if(tag)b.append(el("span","tag",tag));if(title)b.title=title;
    b.onclick=()=>{closeCfg(false);run()};return b;
  };
  head("Saved in this browser");
  if(!PROFILES.length) note("None yet. Use “Save current as…”.");
  for(const p of PROFILES){
    const row=el("div","mrow");
    row.append(item(p.name,"",()=>loadProfile(p),p.rules.length?`${p.rules.length} ${p.rules.length===1?"rule":"rules"}`:"text size only"));
    const x=el("button","mexp");x.type="button";x.tabIndex=-1;x.setAttribute("role","menuitem");x.innerHTML=ICON_ZIP;
    x.setAttribute("aria-label",`Download ${p.name} as .zip for the game`);x.title="Download as .zip for the game";
    x.onclick=async()=>{closeCfg(false);await fetchUrlFonts(p.fonts);downloadZip(p.name,p.rules,p.textScale)};
    row.append(x);
    const d=el("button","mdel","×");d.type="button";d.tabIndex=-1;d.setAttribute("role","menuitem");d.setAttribute("aria-label",`Delete ${p.name}`);d.title="Delete";
    twoStep(d,"Delete?",()=>{
      PROFILES=PROFILES.filter(x=>x.key!==p.key);storeProfiles();renderCfgMenu();cfgItems()[0]?.focus();setStatus(`Deleted “${p.name}”.`,"ok");
    });
    row.append(d);
    m.append(row);
  }
  const presets=PRESETS.filter(p=>presetFonts(p).every(f=>FONTSET.has(f.toLowerCase())));
  if(presets.length){
    head("Presets");
    for(const p of presets) m.append(item(p.label,"",()=>{if(confirmReplace())useRules(p.label,presetRules(p),p.label)}));
  }
  m.append(Object.assign(el("div","msep"),{role:"separator"}));
  m.append(item("Save current as…","",openSaveForm,"Kept in this browser"));
  m.append(item("Export settings…",".json",exportRules,"Only the settings: fonts from Google and from URLs come back by themselves, uploaded ones must be uploaded again"));
  m.append(item("Import…",".zip / .json",importFile,"A .json or .zip from here or from CS2 Font Studio. You can also drop the file onto the window"));
}
function openCfg(){
  loadProfiles();renderCfgMenu();$("cfgMenu").hidden=false;$("cfgBtn").setAttribute("aria-expanded","true");
  cfgItems()[0]?.focus();
}
function closeCfg(refocus){
  if($("cfgMenu").hidden) return;
  $("cfgMenu").hidden=true;$("cfgBtn").setAttribute("aria-expanded","false");
  if(refocus) $("cfgBtn").focus();
}
$("cfgBtn").onclick=()=>$("cfgMenu").hidden?openCfg():closeCfg(false);
$("cfgBtn").onkeydown=e=>{if(e.key==="ArrowDown"&&$("cfgMenu").hidden){e.preventDefault();openCfg()}};
$("cfgMenu").onkeydown=e=>{
  const items=cfgItems(), i=items.indexOf(document.activeElement);
  const go=j=>{e.preventDefault();items[(j+items.length)%items.length]?.focus()};
  if(e.key==="ArrowDown")go(i+1);else if(e.key==="ArrowUp")go(i-1);
  else if(e.key==="Home")go(0);else if(e.key==="End")go(items.length-1);
  else if(e.key==="Escape"){e.preventDefault();closeCfg(true)}
  else if(e.key==="Tab")closeCfg(false);
};
document.addEventListener("mousedown",e=>{if(!$("cfgMenu").hidden&&!e.target.closest(".cfg"))closeCfg(false)});
// the button names the loaded configuration and says honestly when the settings moved away from it
function updateCfgLabel(){
  $("cfgLabel").textContent=cfgName?`${cfgName}${rulesKey()===cfgKey?"":" (modified)"}`:"Configurations";
}

// ---- two-step buttons for actions that delete something
function twoStep(btn,armedText,action){
  const label=btn.textContent;let t=null;
  const disarm=()=>{clearTimeout(t);btn.classList.remove("armed");btn.textContent=label};
  btn.onclick=()=>{
    if(btn.classList.contains("armed")){disarm();action();return}
    btn.classList.add("armed");btn.textContent=armedText;t=setTimeout(disarm,5000);
  };
  btn.onblur=disarm;
}

// ---- font sources: upload, URL, fonts of this PC; the list of own fonts
async function addFontFiles(files){
  setStatus(`Reading ${plural(files.length,"file","files")}…`);
  try{
    const r=await FONTS.addFiles(await Promise.all(files.map(async f=>({name:f.name,bytes:await fileBytes(f)}))));
    const parts=[];
    if(r.families.length) parts.push(`Added ${plural(r.families.length,"font","fonts")}: ${nameList(r.families)}`);
    if(r.skipped.length) parts.push(`skipped: ${r.skipped.map(s=>`${s.name} (${s.why})`).join(", ")}`);
    setStatus((parts.join("; ")||"No fonts found")+".",r.skipped.length||!r.families.length?"err":"ok");
  }catch(e){setStatus(e.message,"err")}
}
$("fontIn").onchange=e=>{const f=[...e.target.files];e.target.value="";if(f.length)addFontFiles(f)};
$("upBtn").onclick=()=>$("fontIn").click();
$("urlBtn").onclick=()=>{$("urlForm").hidden=false;$("urlIn").focus()};
$("urlCancel").onclick=()=>{$("urlForm").hidden=true;$("urlBtn").focus()};
$("urlIn").onkeydown=e=>{if(e.key==="Escape"){e.preventDefault();$("urlCancel").click()}};
$("urlForm").onsubmit=async e=>{
  e.preventDefault();
  const url=$("urlIn").value.trim();
  if(!/^https?:\/\//i.test(url)) return setStatus("Enter a link that starts with https://","err");
  setStatus("Downloading…");
  try{
    const r=await FONTS.addUrl(url);
    if(!r.families.length) throw new Error(r.skipped.map(s=>s.why).join(", ")||"no font found");
    $("urlForm").hidden=true;$("urlIn").value="";
    setStatus(`Added ${plural(r.families.length,"font","fonts")}: ${nameList(r.families)}.`,"ok");
  }catch(err){setStatus("Could not add the font: "+err.message,"err")}
};
if(FONTS.hasLocalApi) $("pcBtn").hidden=false;
$("pcBtn").onclick=async()=>{
  try{const n=await FONTS.useLocal();setStatus(n?`${plural(n,"font","fonts")} of this PC added. Fonts of this PC are for your own game only: do not share a zip that contains them.`:"No further fonts found on this PC.","ok")}
  catch(e){setStatus("The browser did not allow access to the fonts of this PC.","err")}
};
let srcKey="";
function renderSources(){
  const own=FONTLIST.filter(n=>FONTS.get(n)?.kind==="file"), pc=FONTLIST.filter(n=>FONTS.get(n)?.kind==="local").length;
  const k=JSON.stringify([own,pc,FONTS.googleCount]);
  if(k===srcKey) return; srcKey=k;
  $("srcCount").textContent=[FONTS.googleCount?`${FONTS.googleCount} Google fonts`:"",own.length?`${own.length} own`:"",pc?`${pc} of this PC`:""].filter(Boolean).join(" · ")||"Loading the font list…";
  const l=$("ownList");l.textContent="";
  for(const n of own){
    const s=FONTS.get(n), row=document.createElement("div");row.className="own";
    const nm=document.createElement("span");nm.textContent=n;nm.title=s.url||"uploaded";
    const tg=document.createElement("span");tg.className="tag";tg.textContent=`${plural(s.faces.length,"face","faces")} · ${FONTS.tag(n)}`;
    const x=document.createElement("button");x.type="button";x.className="mdel";x.textContent="×";x.title="Remove";x.setAttribute("aria-label","Remove "+n);
    twoStep(x,"Remove?",async()=>{await FONTS.removeFamily(n);setStatus(`Removed “${n}”.`,"ok")});
    row.append(nm,tg,x);l.append(row);
  }
}

// ---- download / reset
// the current settings are kept in this browser, so a reload or a closed tab loses nothing
const CUR_KEY="current-v1";
function rememberCurrent(){try{localStorage.setItem(CUR_KEY,JSON.stringify({rules:rulesNow(),textScale:textScaleNow(),name:cfgName,saved:savedKey}))}catch{}}
function save(){
  const rules=rulesNow(), ts=textScaleNow();
  downloadZip(cfgName&&!PRESETS.some(x=>x.label===cfgName)?cfgName:"",rules,ts);
}
$("save").onclick=save;
twoStep($("reset"),"Reset all groups?",()=>{
  setTextScale(0);Object.values(ctl).forEach(c=>c.set(DEF));restyle();refreshAllRst();
  setStatus("All groups reset. To remove earlier changes from the game, download the (empty) zip and unpack it, or delete 99-spddl.conf.","ok");
});
addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();save()}});

// ---- start
(async()=>{
  loadFamilies(await fetch("families.json").then(r=>r.ok?r.json():null).catch(()=>null));
  buildGroupList();
  document.querySelectorAll("input[type=range]").forEach(fillRange);
  loadProfiles();
  let cur=null;try{cur=JSON.parse(localStorage.getItem(CUR_KEY))}catch{}
  await FONTS.restoreFiles();
  try{await FONTS.loadGoogle()}catch(e){setStatus(e.message+". Reload the page to try again; own font files still work.","err")}
  await FONTS.useLocalIfGranted();
  fillFonts();
  if(cur&&Array.isArray(cur.rules)){
    applyRuleList(cur.rules,cur.textScale);cfgName=cur.name||"";cfgKey=cur.name?rulesKey():"";
  }
  savedKey=cur&&typeof cur.saved==="string"?cur.saved:emptyKey;
  started=true;
  refreshAllRst();
})();

// Test hook: ?t=group|font|scale;...&frames=1
setTimeout(()=>{for(const p of (new URLSearchParams(location.search).get("t")||"").split(";").filter(Boolean)){const [f,font,sc,wt,it,,wd]=p.split("|");ctl[f]?.set({font,scale:+(sc||1),weight:+(wt||0),italic:it==="1",width:+(wd||1)})}restyle()},1200);
// highlighting is on by default, ?hl=0 turns it off
if(new URLSearchParams(location.search).get("hl")==="0"){$("hlchg").checked=false;document.body.classList.remove("hlchg")}
if(new URLSearchParams(location.search).get("frames")){$("frames").checked=true;document.body.classList.add("frames")}
show(+new URLSearchParams(location.search).get("s")||0);
// Test hook: ?sel=Group selects a group
{const g=new URLSearchParams(location.search).get("sel");if(g)setTimeout(()=>select(g),900)}
// Test hook: ?pick=Group&down=N simulates focus + N x arrow down
{const q=new URLSearchParams(location.search),g=q.get("pick");
 if(g)setTimeout(()=>{select(g);const el=document.querySelector(`.fam[data-f="${CSS.escape(g)}"] input.fp`);el.focus();
  if(q.get("q")){el.value=q.get("q");el.dispatchEvent(new Event("input",{bubbles:true}))}
  for(let i=0;i<+(q.get("down")||0);i++)el.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true}))},800)}
