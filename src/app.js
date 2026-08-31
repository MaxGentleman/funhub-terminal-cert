/* FUNHUB — Terminal Certification Register
   ----------------------------------------
   A register is only worth having if a tick box cannot stand in for the work.
   Every recorded test carries a tester, a server-set timestamp, a reference or
   a written failure, and a proof file that the server confirms exists before it
   will write the row. The browser can ask; it cannot assert. */

import { T } from "./data/i18n.js";
import { TESTS } from "./data/tests.js";
import { PROCS, MANUAL_TAIL, UNIVERSAL, PROC_VIDEO, videoHref } from "./data/guides.js";
import { FOLDER, STORES, ROOT_DRIVE } from "./config.js";
import * as api from "./api.js";

/* Step screenshots are ~750 kB of the bundle and are only ever seen inside a
   guide. They load after first paint and the page redraws when they arrive. */
var STEP_IMG = {};
import("./data/images.js").then(function (m) {
  STEP_IMG = m.STEP_IMG;
  /* Never redraw out from under someone mid-entry. */
  if (!ui.openTest && !ui.draft) render();
}).catch(function () { /* guides still read fine without the pictures */ });

/* --------------------------------------------------------------- app state */
function emptyState() {
  return {
    cycle: { id: "", label: "—", startISO: "", expiryISO: "", driveId: ROOT_DRIVE },
    stores: STORES,
    devices: [],
    results: {},
    log: [],
    archives: [],
  };
}
var state = emptyState();

var ui = {
  view: "dev", lang: "en", store: "", q: "", filter: "all",
  guide: "", guideStore: "", scope: "", lightbox: null,
  gateCode: "", gateErr: "", gateBusy: false,
  advanced: false, openDev: null, openTest: null, modal: null,
  draft: null, blocked: false, saveState: "", readonly: false,
  loading: false, loadErr: "",
};

try { var L = localStorage.getItem("fh_lang"); if (L === "fr" || L === "en") ui.lang = L; } catch (e) {}
try { ui.advanced = localStorage.getItem("fh_adv") === "1"; } catch (e) {}

function tester() { try { return localStorage.getItem("fh_tester") || ""; } catch (e) { return ""; } }
function setTester(v) { try { localStorage.setItem("fh_tester", v); } catch (e) {} }
function t(k) {
  return (T[ui.lang] && T[ui.lang][k]) || (EXTRA[ui.lang] && EXTRA[ui.lang][k])
      || T.en[k] || EXTRA.en[k] || k;
}

/* ------------------------------------------------------------------ adapter
   The API speaks the database's shape; the views speak the shape they were
   written against. One translation, in one place, beats scattering
   snake_case through the rendering code. */
function applyData(p) {
  var s = emptyState();

  s.cycle = {
    id: p.cycle.id,
    label: p.cycle.label,
    startISO: String(p.cycle.started_on || "").slice(0, 10),
    expiryISO: String(p.cycle.expires_on || "").slice(0, 10),
    driveId: p.cycle.drive_folder_id || ROOT_DRIVE,
  };

  s.devices = (p.terminals || []).map(function (r) {
    return {
      id: r.id, store: r.store_code, name: r.name,
      proc: r.processor, model: r.model, mid: r.mid || "", serial: r.serial || "",
      purpose: r.purpose || "—", pos: r.pos || "—",
      drive: r.drive_folder_id || "",
      testDrive: (p.folders && p.folders[r.id]) || {},
      tests: r.tests || [], flag: r.flag || "",
    };
  });

  (p.results || []).forEach(function (r) {
    s.results[r.terminal_id + "|" + r.test_code] = {
      result: r.result, tester: r.tester_name,
      ref: r.reference || "", notes: r.notes || "",
      at: r.recorded_at, proof: true, file: r.proof_filename || "",
      path: r.proof_path || "", driveId: r.drive_file_id || "",
      driveErr: r.drive_error || "",
    };
  });

  s.log = (p.audit || []).map(function (a) {
    return { at: a.at, dev: a.terminal_id || "—", test: a.test_code || "—",
             result: a.result || a.action, by: a.actor || "—", detail: a.detail || "" };
  });

  state = s;
  ui.scope = p.scope;
}
/* ---------------------------------------------------- guides and steps */
function fmt(str){
  return esc(str)
    .replace(/\[\[(.+?)\]\]/g, '<span class="ui">“$1”</span>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
function universalBlock(){
  var items = UNIVERSAL[ui.lang] || UNIVERSAL.en;
  var h = '<div class="univ"><div class="univ-h">' + esc(t("universalTitle")) + '</div><ol>';
  for(var i=0;i<items.length;i++) h += '<li>' + fmt(items[i]) + '</li>';
  return h + '</ol></div>';
}
var MANUAL_CODES = ["DEBIT-REF","VMC-REF","AMEX-REF"];
var MANUAL_BY_MODEL = {"Go":"manual:Moneris|MANUAL-REF","Go Plus":"manual:Moneris|MANUAL-REF",
                       "Flex":"manual:Clover|MANUAL-REF","Mini":"manual:Clover|MANUAL-REF",
                       "P400":"pos:Intercard|INT-REF"};
/* systems where the POS refund already is the hand-keyed one */
var MANUAL_IS_INT = {Intercard:1};
function manualKey(model){ return MANUAL_BY_MODEL[model] || ("model:"+model+"|MANUAL-REF"); }
function procFor(d, code){
  if(MANUAL_CODES.indexOf(code)>=0) return PROCS[manualKey(d.model)] || null;
  if(code==="INT-REF") return PROCS["pos:"+d.pos+"|INT-REF"] || null;
  return null;
}
function procKeyOf(pr){
  var k; for(k in PROCS){ if(PROCS[k]===pr) return k; } return "";
}
function tailBlock(pos){
  var tail = MANUAL_TAIL[pos];
  if(!tail) return '';
  var items = tail[ui.lang] || tail.en, h = '<div class="proc tail"><div class="proc-h"><span class="eyebrow">'+esc(t("tailTitle"))+'</span></div><ol class="proc-steps">';
  for(var i=0;i<items.length;i++) h += '<li>'+fmt(items[i])+'</li>';
  return h + '</ol></div>';
}
function procBlock(pr){
  var steps = (pr[ui.lang] || pr.en).slice(), pk = procKeyOf(pr);
  var applies = ui.lang==="fr" ? pr.applies_fr : pr.applies_en;
  var h = '<div class="proc"><div class="proc-h"><span class="eyebrow">'+esc(t("stepByStep"))+'</span>'
        + (PROC_VIDEO.hasOwnProperty(pk) ? '<a class="vidlink" href="'+videoHref(pk)+'" target="_blank" rel="noopener">▶ '+esc(t("watchVideo"))+'</a>' : '')
        + '</div>'
        + (applies ? '<div class="proc-applies">'+fmt(applies)+'</div>' : '')
        + '<ol class="proc-steps">';
  for(var i=0;i<steps.length;i++){
    var img = STEP_IMG[pk+"|"+(i+1)];
    h += '<li>'+fmt(steps[i])
       + (img ? '<button class="stepshot" data-act="zoom" data-src="'+att(img)+'"><img src="'+att(img)+'" alt=""><span class="shotcue">'+esc(t("viewShot"))+'</span></button>' : '')
       + '</li>';
  }
  h += '</ol>';
  var w = ui.lang==="fr" ? pr.warn_fr : pr.warn_en;
  if(w) h += '<div class="proc-warn">'+fmt(w)+'</div>';
  return h + '</div>';
}

function testDef(c){ for(var i=0;i<TESTS.length;i++){ if(TESTS[i].code===c) return TESTS[i]; } return {code:c,en:{n:c,d:""},fr:{n:c,d:""}}; }

/* ---------------------------------------------------------------- access */
function isAdmin(){ return ui.scope==="ADMIN"; }
function canEdit(storeCode){
  if(ui.readonly) return false;
  if(isAdmin()) return true;
  return !!ui.scope && ui.scope===storeCode;
}
function scopeLabel(){
  if(isAdmin()) return t("scopeAdmin");
  if(!ui.scope) return t("scopeNone");
  return store(ui.scope).code + " · " + store(ui.scope).name;
}

/* --------------------------------------------------------------- helpers */
function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function att(s){ return esc(s).replace(/'/g,"&#39;"); }
function key(d,c){ return d+"|"+c; }
function res(d,c){ return state.results[key(d,c)]||null; }
function store(code){ for(var i=0;i<state.stores.length;i++){ if(state.stores[i].code===code) return state.stores[i]; } return {code:code,name:code,drive:""}; }
function dev(id){ for(var i=0;i<state.devices.length;i++){ if(state.devices[i].id===id) return state.devices[i]; } return null; }
function initials(n){
  var p=String(n||"").trim().split(/\s+/).filter(Boolean);
  if(!p.length) return "XX";
  if(p.length===1) return p[0].slice(0,2).toUpperCase();
  return (p[0][0]+p[p.length-1][0]).toUpperCase();
}
function todayISO(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function fmtDT(iso){
  if(!iso) return "—";
  var d=new Date(iso); if(isNaN(d)) return iso;
  var p=function(n){return String(n).padStart(2,"0");};
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+" "+p(d.getHours())+":"+p(d.getMinutes());
}
function daysBetween(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }
function proofName(devId,code,name){ return devId+"_"+code+"_"+todayISO()+"_"+initials(name||tester())+".pdf"; }
function testFolder(d,code){ return (d.testDrive && d.testDrive[code]) || d.drive; }

function devStats(d){
  var p=0,f=0,n=0,u=0;
  for(var i=0;i<d.tests.length;i++){
    var r=res(d.id,d.tests[i]);
    if(!r) u++; else if(r.result==="pass") p++; else if(r.result==="fail") f++; else n++;
  }
  return {p:p,f:f,n:n,u:u,total:d.tests.length,done:p+f+n};
}
function devStatus(d){
  var s=devStats(d);
  if(s.f>0) return "fail";
  if(s.u===0) return "complete";
  if(s.done===0) return "none";
  return "partial";
}
function totals(list){
  var o={p:0,f:0,n:0,u:0,total:0};
  for(var i=0;i<list.length;i++){ var s=devStats(list[i]); o.p+=s.p;o.f+=s.f;o.n+=s.n;o.u+=s.u;o.total+=s.total; }
  return o;
}

/* ------------------------------------------------------------------- csv */
function toCsv(){
  var rows = [["cycle","store_code","store_name","device_id","device_name","processor","model","mid","serial","purpose","pos","test_code","test_name","result","tester","reference","proof_file","proof_uploaded","recorded_at","notes"]];
  for(var i=0;i<state.devices.length;i++){
    var d = state.devices[i], st = store(d.store);
    for(var j=0;j<d.tests.length;j++){
      var c = d.tests[j], r = res(d.id,c), def = testDef(c);
      rows.push([state.cycle.label, d.store, st.name, d.id, d.name, d.proc, d.model, d.mid, d.serial, d.purpose, d.pos,
        c, def.en.n, r?r.result:"untested", r?r.tester:"", r?r.ref:"",
        r&&r.file?r.file:"", r?(r.proof?"yes":"no"):"", r?r.at:"", r?r.notes:""]);
    }
  }
  return rows.map(function(r){
    return r.map(function(v){ v = String(v==null?"":v); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }).join(",");
  }).join("\n");
}

/* -------------------------------------------------------- render pieces */
function segBar(d){
  var h = "";
  for(var i=0;i<d.tests.length;i++){
    var r = res(d.id, d.tests[i]);
    var cls = !r ? "" : (r.result==="pass" ? "p" : r.result==="fail" ? "f" : "n");
    h += '<i class="'+cls+'" title="'+att(testDef(d.tests[i])[ui.lang].n)+'"></i>';
  }
  return '<span class="seg">'+h+'</span>';
}
function statusPill(s){
  if(s==="complete") return '<span class="pillbadge pb-ok">'+esc(t("st_complete"))+'</span>';
  if(s==="fail")     return '<span class="pillbadge pb-bad">'+esc(t("st_fail"))+'</span>';
  if(s==="partial")  return '<span class="pillbadge pb-acc">'+esc(t("st_partial"))+'</span>';
  return '<span class="pillbadge pb-na">'+esc(t("st_none"))+'</span>';
}
function resPill(r){
  if(!r) return '<span class="pillbadge pb-na">'+esc(t("never"))+'</span>';
  if(r.result==="pass") return '<span class="pillbadge pb-ok">'+esc(t("pass"))+'</span>';
  if(r.result==="fail") return '<span class="pillbadge pb-bad">'+esc(t("fail"))+'</span>';
  return '<span class="pillbadge pb-na">'+esc(t("na"))+'</span>';
}
function bar(o){
  var tot = o.total||1;
  var pc = function(n){ return (n/tot*100).toFixed(2)+"%"; };
  return '<span class="bar">'
    +'<i class="p" style="width:'+pc(o.p)+'"></i>'
    +'<i class="f" style="width:'+pc(o.f)+'"></i>'
    +'<i class="n" style="width:'+pc(o.n)+'"></i></span>';
}
function legend(){
  return '<div class="legend">'
   +'<span><i class="dot" style="background:var(--pass)"></i>'+esc(t("leg_pass"))+'</span>'
   +'<span><i class="dot" style="background:var(--fail)"></i>'+esc(t("leg_fail"))+'</span>'
   +'<span><i class="dot" style="background:var(--surface-3);border:1px solid var(--line)"></i>'+esc(t("leg_todo"))+'</span>'
   +'</div>';
}

function cycleBar(){
  var c = state.cycle;
  var left = daysBetween(new Date(), c.expiryISO);
  var cls = left < 0 ? "expired" : left < 30 ? "warn" : "";
  var badge = left < 0
    ? '<span class="pillbadge pb-bad">'+esc(t("expired"))+'</span>'
    : left < 30
      ? '<span class="pillbadge pb-warn">'+left+' '+esc(t("daysLeft"))+'</span>'
      : '<span class="pillbadge pb-ok">'+esc(t("active"))+' · '+left+' '+esc(t("daysLeft"))+'</span>';
  return '<div class="card cyclebar '+cls+'">'
    +'<div><div class="eyebrow">'+esc(t("cycle"))+'</div><div class="cy-name">'+esc(c.label)+'</div></div>'
    +'<div class="cy-meta">'+esc(t("started"))+' '+esc(c.startISO)+' · '+esc(t("expires"))+' '+esc(c.expiryISO)+'</div>'
    +badge
    +'<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">'
      +'<a class="btn sm" href="'+FOLDER+esc(c.driveId||ROOT_DRIVE)+'" target="_blank" rel="noopener">'+esc(t("driveRoot"))+' ↗</a>'
      +'<button class="btn sm" data-act="csv">'+esc(t("exportCsv"))+'</button>'
    +'</div></div>';
}

/* ---------------------------------------------------------------- views */
function viewDash(){
  var o = totals(state.devices);
  var h = '<div class="stack">' + cycleBar();

  if(ui.readonly) h += '<div class="banner warn">'+esc(t("readonly"))+'</div>';
  else if(!ui.scope) h += '<div class="banner warn">'+esc(t("lockedNone"))+' <button class="btn sm" data-act="openlock" style="margin-left:8px">'+esc(t("unlock"))+'</button></div>';
  else h += '<div class="banner info">'+esc(t("lockedFor"))+' <b>'+esc(scopeLabel())+'</b><button class="btn sm" data-act="openlock" style="margin-left:auto">'+esc(t("lockBtn"))+'</button></div>';


  h += '<div class="kpis">'
    +'<div class="card kpi"><div class="n">'+state.devices.length+'</div><div class="l eyebrow">'+esc(t("k_devices"))+'</div></div>'
    +'<div class="card kpi pass"><div class="n">'+o.p+'</div><div class="l eyebrow">'+esc(t("k_certified"))+' / '+o.total+'</div></div>'
    +'<div class="card kpi fail"><div class="n">'+o.f+'</div><div class="l eyebrow">'+esc(t("k_failed"))+'</div></div>'
    +'<div class="card kpi todo"><div class="n">'+o.u+'</div><div class="l eyebrow">'+esc(t("k_untested"))+'</div></div>'
    +'</div>';

  h += '<section><div class="sec-h"><h2>'+esc(t("progress"))+'</h2>'+legend()+'</div><div class="storegrid">';
  for(var i=0;i<state.stores.length;i++){
    var s = state.stores[i];
    var list = state.devices.filter(function(d){ return d.store===s.code; });
    var so = totals(list);
    var pct = so.total ? Math.round((so.p+so.n)/so.total*100) : 0;
    h += '<div class="card storecard">'
      +'<div class="top"><h3>'+esc(s.code)+' · '+esc(s.name)+'</h3><span class="pillbadge '+(pct===100?"pb-ok":pct>0?"pb-acc":"pb-na")+'">'+pct+'%</span></div>'
      + bar(so)
      +'<div class="cnt">'+list.length+' '+esc(t("k_devices")).toLowerCase()+' · '+(so.p+so.f+so.n)+' '+esc(t("of"))+' '+so.total+' '+esc(t("tests_done"))+'</div>'
      +'<div style="margin-top:auto"><a class="btn sm" href="#" data-act="gostore" data-store="'+att(s.code)+'">'+esc(t("openStore"))+' →</a></div>'
      +'</div>';
  }
  h += '</div></section>';

  var att_list = [];
  for(var j=0;j<state.devices.length;j++){
    var d = state.devices[j];
    for(var k=0;k<d.tests.length;k++){
      var r = res(d.id, d.tests[k]);
      if(r && r.result==="fail") att_list.push({d:d, c:d.tests[k], r:r});
    }
  }
  h += '<section><div class="sec-h"><h2>'+esc(t("attention"))+'</h2></div><div class="card">';
  if(!att_list.length){ h += '<div class="empty">'+esc(t("attention_none"))+'</div>'; }
  else {
    h += '<div class="tblwrap"><table><thead><tr><th>'+esc(t("log_dev"))+'</th><th>'+esc(t("log_test"))+'</th><th>'+esc(t("whatFailed"))+'</th><th>'+esc(t("log_by"))+'</th><th>'+esc(t("log_when"))+'</th></tr></thead><tbody>';
    for(var m=0;m<att_list.length;m++){
      var a = att_list[m];
      h += '<tr><td class="m">'+esc(a.d.id)+' · '+esc(a.d.name)+'</td><td>'+esc(testDef(a.c)[ui.lang].n)+'</td><td>'+esc(a.r.notes)+'</td><td>'+esc(a.r.tester)+'</td><td class="m">'+esc(fmtDT(a.r.at))+'</td></tr>';
    }
    h += '</tbody></table></div>';
  }
  h += '</div></section>';

  if(state.archives && state.archives.length){
    h += '<section><div class="sec-h"><h2>'+esc(t("archived"))+'</h2></div><div class="card"><div class="tblwrap"><table><thead><tr><th>'+esc(t("cycle"))+'</th><th>'+esc(t("started"))+'</th><th>'+esc(t("expires"))+'</th><th>'+esc(t("k_certified"))+'</th><th>'+esc(t("k_failed"))+'</th></tr></thead><tbody>';
    for(var q=0;q<state.archives.length;q++){
      var A = state.archives[q], ap=0, af=0;
      for(var kk in A.results){ if(A.results[kk].result==="pass") ap++; else if(A.results[kk].result==="fail") af++; }
      h += '<tr><td>'+esc(A.cycle.label)+'</td><td class="m">'+esc(A.cycle.startISO)+'</td><td class="m">'+esc(A.cycle.expiryISO)+'</td><td class="m">'+ap+'</td><td class="m">'+af+'</td></tr>';
    }
    h += '</tbody></table></div></div></section>';
  }

  return h + '</div>';
}

/* ------------------------------------------------------------------ devices */
function filtered(){
  var q = ui.q.toLowerCase().trim();
  var only = isAdmin() ? ui.store : ui.scope;   /* managers are pinned to their store */
  return state.devices.filter(function(d){
    if(only && d.store!==only) return false;
    if(ui.filter!=="all"){
      var s = devStatus(d);
      if(ui.filter==="todo" && !(s==="none"||s==="partial")) return false;
      if(ui.filter==="fail" && s!=="fail") return false;
      if(ui.filter==="done" && s!=="complete") return false;
    }
    if(!q) return true;
    return (d.id+" "+d.name+" "+d.proc+" "+d.model+" "+d.mid+" "+d.serial+" "+d.pos+" "+d.purpose).toLowerCase().indexOf(q)>=0;
  });
}

function lockMsg(d){
  if(ui.readonly) return t("readonly");
  if(!ui.scope) return t("lockedNone");
  return t("lockedFor")+" "+scopeLabel()+" \u2014 "+t("lockedElse");
}
function deviceCard(d){
  var st = store(d.store), s = devStats(d), open = ui.openDev===d.id;
  var h = '<div class="card dev">';
  h += '<button class="dev-h" data-act="toggledev" data-dev="'+att(d.id)+'" aria-expanded="'+open+'">'
    +'<span class="dv-id dev-id">'+esc(d.id)+'</span>'
    +'<span class="dv-name"><span class="dev-name">'+esc(d.name)+'</span><span class="dev-sub">'+esc(st.name)+' · '+esc(d.purpose)+'</span></span>'
    +'<span class="dv-mid dev-cell">'+esc(t("mid"))+'<b>'+esc(d.mid||"—")+'</b></span>'
    +'<span class="dv-pos dev-cell">'+esc(d.proc)+' '+esc(d.model)+'<b>'+esc(d.pos)+'</b></span>'
    +'<span class="dv-seg">'+segBar(d)+'</span>'
    +'<span class="dev-right">'+statusPill(devStatus(d))+'<span class="mono" style="font-size:11.5px;color:var(--ink-3)">'+s.done+'/'+s.total+'</span><span class="caret">'+(open?"▾":"▸")+'</span></span>'
    +'</button>';

  if(open){
    h += '<div class="dev-body">';
    if(d.flag==="MID-CHECK") h += '<div class="flagnote">'+(ui.lang==="fr"
      ? "Le MID inscrit est un MID Moneris alors que le terminal est un Windcave. À vérifier avant de certifier."
      : "The MID on file is a Moneris MID but this terminal is a Windcave. Verify before certifying.")+'</div>';
    if(d.flag==="NOT-DEPLOYED") h += '<div class="flagnote">'+(ui.lang==="fr"
      ? "Terminal non déployé. Marquez les tests S/O jusqu'à sa mise en service."
      : "Terminal not deployed. Mark tests N/A until it goes into service.")+'</div>';
    if(d.flag==="UNUSED") h += '<div class="flagnote">'+(ui.lang==="fr"
      ? "Poste inutilisé selon la feuille d'origine. Confirmez avant de tester."
      : "Listed as unused on the original sheet. Confirm before testing.")+'</div>';

    h += '<div class="dev-meta">'
      +'<span>'+esc(t("processor"))+' <b>'+esc(d.proc)+'</b></span>'
      +'<span>'+esc(t("model"))+' <b>'+esc(d.model)+'</b></span>'
      +'<span>'+esc(t("mid"))+' <b>'+esc(d.mid||"—")+'</b></span>'
      +(d.serial?'<span>'+esc(t("serial"))+' <b>'+esc(d.serial)+'</b></span>':'')
      +'<span>'+esc(t("pos"))+' <b>'+esc(d.pos)+'</b></span>'
      +'<span><a href="'+FOLDER+esc(d.drive)+'" target="_blank" rel="noopener">'+esc(t("openFolder"))+' ↗</a></span>'
      +'</div>';

    h += '<div class="tests">';
    for(var i=0;i<d.tests.length;i++){
      var code = d.tests[i], r = res(d.id, code), def = testDef(code);
      var isOpen = ui.openTest === key(d.id, code);
      h += '<div class="test">';
      h += '<button class="test-h" data-act="toggletest" data-dev="'+att(d.id)+'" data-code="'+att(code)+'" aria-expanded="'+isOpen+'">'
        +'<span class="th-code test-code">'+esc(code)+'</span>'
        +'<span class="th-name test-name">'+esc(def[ui.lang].n)+'</span>'
        +'<span class="th-ev test-ev">'+(r ? esc((r.ref||r.notes||"").slice(0,60)) : "")+'</span>'
        +'<span class="th-status">'+resPill(r)+'</span>'
        +'<span class="th-when test-when">'+(r ? esc(fmtDT(r.at))+'<br>'+esc(r.tester) : "")+'</span>'
        +'</button>';
      if(isOpen && canEdit(d.store)) h += testPanel(d, code);
      else if(isOpen){ var pr2 = procFor(d, code);
        h += '<div class="test-body"><div class="howto"><b>'+esc(def[ui.lang].n)+'</b>'+esc(def[ui.lang].d)+'</div>'
          + (pr2 ? procBlock(pr2) : '') + (MANUAL_CODES.indexOf(code)>=0 ? tailBlock(d.pos) : '')
          + '<div class="folderline"><span class="eyebrow">'+esc(t("proofFolderFor"))+' '+esc(code)+'</span>'
          + '<a class="btn sm" href="'+FOLDER+esc(testFolder(d,code))+'" target="_blank" rel="noopener">'+esc(t("openTestFolder"))+' ↗</a></div>'
          + '<div class="banner warn">'+esc(lockMsg(d))+'</div></div>'; }
      h += '</div>';
    }
    h += '</div></div>';
  }
  return h + '</div>';
}

function procClass(d){
  var x = String(d.proc||"").toLowerCase();
  if(x.indexOf("clover")>=0) return "p-clover";
  if(x.indexOf("moneris")>=0) return "p-moneris";
  if(x.indexOf("windcave")>=0) return "p-windcave";
  return "";
}
function simpleDeviceCard(d){
  var s2 = devStats(d), open = ui.openDev===d.id, i;
  var h = '<div class="card sdev '+procClass(d)+'">';
  h += '<button class="sdev-h" data-act="toggledev" data-dev="'+att(d.id)+'" aria-expanded="'+open+'">'
    + '<span class="sdev-main"><span class="sdev-name">'+(isAdmin()?esc(d.id)+' · ':'')+esc(d.name)+'</span>'
      + '<span class="sdev-sub"><span class="pbadge">'+esc(d.proc)+' '+esc(d.model)+'</span>'
      + '<span>'+esc(d.purpose)+'</span><span class="mono">'+esc(d.pos)+'</span></span></span>'
    + '<span class="sdev-count'+(s2.u===0?' done':'')+'">'+(s2.total-s2.u)+'/'+s2.total+'</span>'
    + '<span class="sdev-caret">'+(open?"▾":"▸")+'</span></button>';
  if(open){
    h += '<div class="sdev-body">';
    for(i=0;i<d.tests.length;i++){
      var code = d.tests[i], r = res(d.id, code), isOpen = ui.openTest === key(d.id, code);
      h += '<div class="stest">'
        + '<button class="stest-h" data-act="toggletest" data-dev="'+att(d.id)+'" data-code="'+att(code)+'" aria-expanded="'+isOpen+'">'
        + '<span class="stest-n">'+esc(testDef(code)[ui.lang].n)+'</span>'+resPill(r)
        + '<span class="sdev-caret">'+(isOpen?"▾":"▸")+'</span></button>';
      if(isOpen && canEdit(d.store)) h += testPanel(d, code, true);
      else if(isOpen) h += '<div class="stest-body"><div class="banner warn">'+esc(lockMsg(d))+'</div></div>';
      h += '</div>';
    }
    h += '</div>';
  }
  return h + '</div>';
}

function viewDevicesSimple(){
  var i, list = filtered();
  var h = '<div class="stack">';
  h += '<div class="card filters">'
    + '<input type="search" data-fld="q" value="'+att(ui.q)+'" placeholder="'+att(t("search"))+'">'
    + '<div class="chipset">'
      + '<button class="chip" data-act="filter" data-v="all"  aria-pressed="'+(ui.filter==="all")+'">'+esc(t("f_all"))+'</button>'
      + '<button class="chip" data-act="filter" data-v="todo" aria-pressed="'+(ui.filter==="todo")+'">'+esc(t("f_todo"))+'</button>'
      + '<button class="chip" data-act="filter" data-v="done" aria-pressed="'+(ui.filter==="done")+'">'+esc(t("f_done"))+'</button>'
    + '</div></div>';
  h += '<div class="devlist">';
  if(!list.length) h += '<div class="card"><div class="empty">—</div></div>';
  for(i=0;i<list.length;i++) h += simpleDeviceCard(list[i]);
  return h + '</div></div>';
}

function viewDevices(){
  if(!ui.advanced) return viewDevicesSimple();
  var list = filtered();
  var h = '<div class="stack">' + cycleBar();
  h += '<div class="card filters">'
    +'<input type="search" data-fld="q" value="'+att(ui.q)+'" placeholder="'+att(t("search"))+'">'
    +'<select data-fld="store"><option value="">'+esc(t("allStores"))+'</option>';
  for(var i=0;i<state.stores.length;i++){
    var s=state.stores[i];
    h += '<option value="'+att(s.code)+'"'+(ui.store===s.code?" selected":"")+'>'+esc(s.code)+' · '+esc(s.name)+'</option>';
  }
  h += '</select><div class="chipset">'
    +'<button class="chip" data-act="filter" data-v="all"  aria-pressed="'+(ui.filter==="all")+'">'+esc(t("f_all"))+'</button>'
    +'<button class="chip" data-act="filter" data-v="todo" aria-pressed="'+(ui.filter==="todo")+'">'+esc(t("f_todo"))+'</button>'
    +'<button class="chip" data-act="filter" data-v="fail" aria-pressed="'+(ui.filter==="fail")+'">'+esc(t("f_fail"))+'</button>'
    +'<button class="chip" data-act="filter" data-v="done" aria-pressed="'+(ui.filter==="done")+'">'+esc(t("f_done"))+'</button>'
    +'</div>'
    +'</div>';

  h += '<div class="devlist">';
  if(!list.length) h += '<div class="card"><div class="empty">—</div></div>';
  for(var j=0;j<list.length;j++) h += deviceCard(list[j]);
  h += '</div></div>';
  return h;
}

/* ---------------------------------------------------------------------- log */
function viewLog(){
  var h = '<div class="stack">' + cycleBar() + '<div class="card">';
  if(!state.log.length){ h += '<div class="empty">'+esc(t("log_empty"))+'</div></div></div>'; return h; }
  h += '<div class="tblwrap"><table><thead><tr>'
    +'<th>'+esc(t("log_when"))+'</th><th>'+esc(t("log_dev"))+'</th><th>'+esc(t("log_test"))+'</th>'
    +'<th>'+esc(t("log_res"))+'</th><th>'+esc(t("log_by"))+'</th><th>'+esc(t("log_detail"))+'</th></tr></thead><tbody>';
  for(var i=0;i<state.log.length && i<600;i++){
    var L = state.log[i], D = dev(L.dev);
    var pill = L.result==="pass" ? '<span class="pillbadge pb-ok">'+esc(t("pass"))+'</span>'
      : L.result==="fail" ? '<span class="pillbadge pb-bad">'+esc(t("fail"))+'</span>'
      : L.result==="na" ? '<span class="pillbadge pb-na">'+esc(t("na"))+'</span>'
      : '<span class="pillbadge pb-na">—</span>';
    h += '<tr><td class="m">'+esc(fmtDT(L.at))+'</td>'
      +'<td class="m">'+esc(L.dev)+(D?' · '+esc(D.name):'')+'</td>'
      +'<td>'+esc(testDef(L.test)[ui.lang].n)+'</td>'
      +'<td>'+pill+'</td><td>'+esc(L.by)+'</td><td class="m">'+esc(L.detail||"")+'</td></tr>';
  }
  return h + '</tbody></table></div></div></div>';
}
function guideData(storeCode){
  var byPos = {}, noRef = {}, i, d;
  for(i=0;i<state.devices.length;i++){
    d = state.devices[i];
    if(storeCode && d.store !== storeCode) continue;
    if(!byPos[d.pos]) byPos[d.pos] = {pos:d.pos, n:0, models:{}, stores:{}};
    var g = byPos[d.pos]; g.n++; g.stores[d.store] = 1;
    var canRefund = false;
    for(var q=0;q<d.tests.length;q++){
      if(MANUAL_CODES.indexOf(d.tests[q])>=0 || d.tests[q]==="INT-REF"){ canRefund = true; break; }
    }
    if(canRefund) g.models[d.model] = (g.models[d.model]||0)+1;
    else { noRef[d.pos] = noRef[d.pos] || []; noRef[d.pos].push(d); }
  }
  var out = [], k;
  for(k in byPos){
    var G = byPos[k];
    G.modelList = Object.keys(G.models);
    G.storeList = Object.keys(G.stores).sort();
    G.intProc = PROCS["pos:"+k+"|INT-REF"] || null;
    G.noRefund = noRef[k] || [];
    G.manuals = [];
    var seenPr = [];
    for(i=0;i<G.modelList.length;i++){
      var mdl = G.modelList[i], pr = PROCS[manualKey(mdl)] || null, hit = -1, z;
      for(z=0;z<G.manuals.length;z++){ if(pr && G.manuals[z].pr===pr){ hit=z; break; } }
      if(hit>=0){ G.manuals[hit].model += " · " + mdl; G.manuals[hit].n += G.models[mdl]; }
      else G.manuals.push({model:mdl, n:G.models[mdl], pr:pr});
    }
    out.push(G);
  }
  out.sort(function(a,b){ return b.n - a.n; });
  return out;
}

function guideCard(G){
  var i, h = '<div class="card guide-body">';

  h += '<div class="guide-top">'
    + '<div><div class="eyebrow">' + esc(t("guideFor")) + '</div><h2 class="guide-name">' + esc(G.pos) + '</h2></div>'
    + '<div class="guide-where mono">' + esc(store(ui.guideStore).code) + ' · ' + esc(store(ui.guideStore).name) + '<br>'
    + G.n + ' ' + esc(t("k_devices")).toLowerCase() + ' · ' + esc(G.modelList.join(" · ")) + '</div></div>';

  h += universalBlock();

  /* --- the POS refund --- */
  h += '<div class="guide-sec"><div class="guide-sec-h"><h3>' + esc(t("guideIntegrated")) + '</h3></div>';
  h += G.intProc ? procBlock(G.intProc) : '<div class="proc-none">' + esc(t("guideNoInt")) + '</div>';
  h += '</div>';

  /* --- the manual backup, only when there is one --- */
  var manuals = [];
  if(!MANUAL_IS_INT[G.pos]){
    for(i=0;i<G.manuals.length;i++){ if(G.manuals[i].pr) manuals.push(G.manuals[i]); }
  }
  if(manuals.length){
    h += '<div class="guide-sec"><div class="guide-sec-h"><h3>' + esc(t("guideManual")) + '</h3></div>';
    h += '<p class="guide-lead">' + esc(t("guideManualLead")) + '</p>';
    for(i=0;i<manuals.length;i++){
      if(manuals.length > 1 || manuals[i].model !== G.modelList.join(" · "))
        h += '<div class="manual-h"><b>' + esc(manuals[i].model) + '</b></div>';
      h += procBlock(manuals[i].pr);
    }
    h += tailBlock(G.pos);
    h += '</div>';
  } else {
    var tb = tailBlock(G.pos);
    if(tb) h += '<div class="guide-sec">' + tb + '</div>';
  }

  h += '<div class="guide-foot"><button class="btn sm" data-act="gostore" data-store="' + att(ui.guideStore) + '">'
     + esc(t("guideRecord")) + ' →</button></div>';

  return h + '</div>';
}

function viewGuide(){
  var i, all = state.stores.filter(function(st){
    return state.devices.filter(function(d){ return d.store===st.code; }).length > 0;
  });
  /* a manager only ever sees their own store */
  var stores = isAdmin() ? all : all.filter(function(st){ return st.code===ui.scope; });
  if(!stores.length) stores = all;
  if(!ui.guideStore || !stores.filter(function(st){ return st.code===ui.guideStore; }).length) ui.guideStore = stores[0].code;

  var guides = guideData(ui.guideStore);
  if(!ui.guide || !guides.filter(function(g){ return g.pos===ui.guide; }).length) ui.guide = guides[0].pos;
  var sel = guides.filter(function(g){ return g.pos===ui.guide; })[0];

  var h = '<div class="stack">';

  if(stores.length > 1){
    h += '<div class="card guide-pick"><div class="eyebrow">' + esc(t("pickStore")) + '</div><div class="pickrow">';
    for(i=0;i<stores.length;i++){
      var S = stores[i], son = S.code===ui.guideStore;
      var sn = state.devices.filter(function(d){ return d.store===S.code; }).length;
      h += '<button class="gbtn' + (son ? " on" : "") + '" data-act="guidestore" data-v="' + att(S.code) + '" aria-pressed="' + son + '">'
        + '<span class="gbtn-n">' + esc(S.code) + ' · ' + esc(S.name) + '</span>'
        + '<span class="gbtn-s mono">' + sn + ' ' + esc(t("k_devices")).toLowerCase() + '</span></button>';
    }
    h += '</div></div>';
  }

  h += '<div class="card guide-pick"><div class="eyebrow">' + esc(t("pickSystem")) + '</div><div class="pickrow">';
  for(i=0;i<guides.length;i++){
    var G = guides[i], on = G.pos===ui.guide;
    h += '<button class="gbtn' + (on ? " on" : "") + '" data-act="guide" data-v="' + att(G.pos) + '" aria-pressed="' + on + '">'
      + '<span class="gbtn-n">' + esc(G.pos) + '</span>'
      + '<span class="gbtn-s mono">' + G.n + ' ' + esc(t("k_devices")).toLowerCase() + '</span></button>';
  }
  h += '</div></div>';

  h += guideCard(sel);
  return h + '</div>';
}

/* ------------------------------------------------------- strings this app
   adds on top of the artifact's vocabulary. FR is not a translation layer
   bolted on later — a manager in Trois-Rivières reads this in French. */
var EXTRA = {
  en: {
    proofLead: "Photograph the signed merchant copy. The register will not accept the test without it.",
    proofPick: "Take or choose a photo",
    proofRetake: "Replace",
    proofUploading: "Uploading…",
    proofTooBig: "That file is over 25 MB — take a photo rather than a scan.",
    prevLead: "Already on file. Re-testing needs its own photo.",
    checking: "Checking…",
    signOut: "Sign out",
    loading: "Loading the register…",
    retry: "Try again",
    errOffline: "No connection. Nothing was recorded — try again once you are back online.",
    errSession: "That session has expired. Enter your store code again.",
    errStore: "That test belongs to another store.",
    errProof: "The photo did not finish uploading. Take it again.",
    errGeneric: "Something went wrong and nothing was recorded.",
    driveWait: "Backing up to Drive",
    driveOk: "In Drive",
  },
  fr: {
    proofLead: "Photographiez la copie marchand signée. Le registre refuse le test sans elle.",
    proofPick: "Prendre ou choisir une photo",
    proofRetake: "Remplacer",
    proofUploading: "Téléversement…",
    proofTooBig: "Ce fichier dépasse 25 Mo — prenez une photo plutôt qu'un scan.",
    prevLead: "Déjà au dossier. Un nouveau test exige sa propre photo.",
    checking: "Vérification…",
    signOut: "Se déconnecter",
    loading: "Chargement du registre…",
    retry: "Réessayer",
    errOffline: "Aucune connexion. Rien n'a été enregistré — réessayez une fois reconnecté.",
    errSession: "Session expirée. Entrez de nouveau votre code de magasin.",
    errStore: "Ce test appartient à un autre magasin.",
    errProof: "La photo ne s'est pas téléversée. Reprenez-la.",
    errGeneric: "Une erreur est survenue et rien n'a été enregistré.",
    driveWait: "Sauvegarde vers Drive",
    driveOk: "Dans Drive",
  },
};

/* Server error codes are for logs. This is what a manager reads. */
function errText(err) {
  var c = (err && err.code) || "";
  if (c === "offline") return t("errOffline");
  if (c === "unauthorised") return t("errSession");
  if (c === "wrong_store") return t("errStore");
  if (c === "proof_not_uploaded" || c === "upload_failed" || c === "proof_path_mismatch") return t("errProof");
  return t("errGeneric");
}

function setSave(kind, msg) {
  ui.saveState = kind;
  var el = document.getElementById("savechip");
  if (el) { el.className = "savechip " + kind; el.textContent = msg; }
}

/* ------------------------------------------------------------------ loading */
function refresh() {
  return api.load().then(function (p) {
    applyData(p);
    ui.loading = false; ui.loadErr = "";
    render();
  }).catch(function (err) {
    ui.loading = false;
    if (err.code === "unauthorised") { api.signOut(); ui.scope = ""; ui.loadErr = ""; render(); return; }
    ui.loadErr = errText(err);
    render();
  });
}

/* ------------------------------------------------------------------ actions */
/**
 * A re-test starts empty on purpose. Carrying the previous run's photo forward
 * would let someone re-date an old receipt with two taps, which is the exact
 * move this register exists to prevent. The old result stays visible above the
 * form as context; it just cannot be reused as evidence.
 */
function openDraft(devId, code) {
  ui.openTest = key(devId, code);
  ui.blocked = false;
  ui.draft = {
    result: "", tester: tester(), ref: "", notes: "",
    proofPath: "", proofName: "",
    uploading: false, uploadErr: "", saving: false, saveErr: "",
  };
}

function draftErrors() {
  var d = ui.draft, e = {};
  if (!d.result) e.result = 1;
  if (!String(d.tester).trim()) e.tester = 1;
  if (d.result === "pass" && !String(d.ref).trim()) e.ref = 1;
  if (d.result === "fail" && !String(d.notes).trim()) e.notes = 1;
  /* pass or fail, the receipt is filed either way */
  if (!d.proofPath) e.proof = 1;
  return e;
}

/* The upload happens when the photo is picked, not when Save is pressed, so a
   manager finds out about a bad connection before they have typed anything. */
function pickProof(devId, code, file) {
  var d = ui.draft;
  if (!d || !file) return;
  if (file.size > 25 * 1024 * 1024) { d.uploadErr = t("proofTooBig"); render(); return; }
  d.uploading = true; d.uploadErr = ""; render();
  api.uploadProof(devId, code, file).then(function (path) {
    if (ui.draft !== d) return;
    d.proofPath = path; d.proofName = file.name; d.uploading = false;
    if (ui.blocked && !Object.keys(draftErrors()).length) ui.blocked = false;
    render();
  }).catch(function (err) {
    if (ui.draft !== d) return;
    d.uploading = false; d.uploadErr = errText(err);
    render();
  });
}

function saveDraft(devId, code) {
  var e = draftErrors();
  if (Object.keys(e).length) { ui.blocked = true; render(); return; }
  var d = ui.draft, name = String(d.tester).trim();
  setTester(name);
  d.saving = true; d.saveErr = "";
  setSave("busy", t("saving"));
  render();

  api.record({
    terminal_id: devId, test_code: code, result: d.result,
    tester_name: name, reference: String(d.ref).trim(),
    notes: String(d.notes).trim(), proof_path: d.proofPath,
  }).then(function () {
    ui.openTest = null; ui.draft = null; ui.blocked = false;
    setSave("ok", t("saved"));
    /* Fire and forget: a Drive hiccup must never make a saved test feel unsaved. */
    api.syncDrive();
    return refresh();
  }).then(function () {
    setTimeout(function () { if (ui.saveState === "ok") setSave("", ""); }, 2600);
  }).catch(function (err) {
    if (ui.draft === d) { d.saving = false; d.saveErr = errText(err); }
    setSave("err", t("saveErr"));
    render();
  });
}

function exportCsv() {
  var name = "FUNHUB_terminal_certification_" + state.cycle.label + "_" + todayISO() + ".csv";
  var blob = new Blob(["﻿" + toCsv()], { type: "text/csv;charset=utf-8" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
}

/* ------------------------------------------------------------- test panel */
function testPanel(d, code, simple) {
  var def = testDef(code), dr = ui.draft, e = ui.blocked ? draftErrors() : {};
  var h = '<div class="' + (simple ? 'stest-body' : 'test-body') + '">';
  if (!simple) h += '<div class="howto"><b>' + esc(def[ui.lang].n) + '</b>' + esc(def[ui.lang].d) + '</div>';
  if (simple) h += '<div class="bigrow">'
    + '<button class="bigbtn" data-act="goguide" data-dev="' + att(d.id) + '"><span class="ico">📖</span>' + esc(t("btnHow")) + '<small>' + esc(d.pos) + '</small></button>'
    + '</div>';

  var isRefund = MANUAL_CODES.indexOf(code) >= 0 || code === "INT-REF";
  if (!simple) {
    var pr = procFor(d, code);
    if (pr) {
      h += procBlock(pr);
      if (MANUAL_CODES.indexOf(code) >= 0) h += tailBlock(d.pos);
    } else {
      h += '<div class="proc-none">' + esc(t("noFilm")) + '</div>';
    }
  }
  if (isRefund)
    h += '<div class="univ-mini"><b>' + esc(t("universalTitle")) + ':</b> ' + fmt((UNIVERSAL[ui.lang] || UNIVERSAL.en)[1]) + ' ' + fmt((UNIVERSAL[ui.lang] || UNIVERSAL.en)[2]) + '</div>';

  var prev = res(d.id, code);
  if (prev) {
    h += '<div class="prevres">' + resPill(prev)
      + '<span class="mono">' + esc(fmtDT(prev.at)) + ' · ' + esc(prev.tester) + (prev.ref ? ' · ' + esc(prev.ref) : '') + '</span>'
      + '<span class="prevnote">' + esc(t("prevLead")) + '</span></div>';
  }

  h += '<div class="fld"><label>' + esc(t("result")) + '</label><div class="segbtns">'
    + '<button class="segbtn p" data-act="draftres" data-v="pass" aria-pressed="' + (dr.result === "pass") + '">' + esc(t("pass")) + '</button>'
    + '<button class="segbtn f" data-act="draftres" data-v="fail" aria-pressed="' + (dr.result === "fail") + '">' + esc(t("fail")) + '</button>'
    + '</div></div>';

  h += '<div class="grid2">'
    + '<div class="fld req"><label>' + esc(t("tester")) + '</label><input data-fld="tester" class="' + (e.tester ? "bad" : "") + '" value="' + att(dr.tester) + '" autocomplete="name"></div>'
    + '<div class="fld' + (dr.result === "pass" ? " req" : "") + '"><label>' + esc(t("ref")) + '</label><input data-fld="ref" class="mono ' + (e.ref ? "bad" : "") + '" value="' + att(dr.ref) + '"></div>'
    + '</div>';

  var noteLabel = dr.result === "fail" ? t("whatFailed") : t("notes");
  h += '<div class="fld' + (dr.result === "fail" ? " req" : "") + '"><label>' + esc(noteLabel) + '</label>'
    + '<textarea data-fld="notes" class="' + (e.notes ? "bad" : "") + '">' + esc(dr.notes) + '</textarea></div>';

  if (dr.result === "pass" || dr.result === "fail") {
    var pf = 'data-proof="' + att(d.id) + '|' + att(code) + '"';
    h += '<div class="proofbox' + (e.proof ? ' bad' : '') + '">'
      + '<div class="eyebrow">' + esc(t("proofTitle")) + '</div>'
      + '<div class="prooflead">' + esc(t("proofLead")) + '</div>';
    if (dr.uploading) {
      h += '<div class="proofbusy">' + esc(t("proofUploading")) + '</div>';
    } else if (dr.proofPath) {
      h += '<div class="proofok"><span class="tick">✓</span><span class="mono pname">' + esc(dr.proofName) + '</span>'
        + '<label class="btn sm ghost">' + esc(t("proofRetake")) + '<input type="file" accept="image/*,application/pdf" capture="environment" ' + pf + ' hidden></label></div>';
    } else {
      h += '<label class="btn primary proofpick">' + esc(t("proofPick"))
        + '<input type="file" accept="image/*,application/pdf" capture="environment" ' + pf + ' hidden></label>';
    }
    if (dr.uploadErr) h += '<div class="blockmsg">' + esc(dr.uploadErr) + '</div>';
    h += '</div>';
  }

  if (ui.blocked && Object.keys(e).length) h += '<div class="blockmsg">' + esc(t("blocked")) + '</div>';
  if (dr.saveErr) h += '<div class="blockmsg">' + esc(dr.saveErr) + '</div>';

  h += '<div class="rowend">'
    + '<button class="btn primary" data-act="savedraft" data-dev="' + att(d.id) + '" data-code="' + att(code) + '"' + (dr.saving || dr.uploading ? ' disabled' : '') + '>' + esc(dr.saving ? t("saving") : t("save")) + '</button>'
    + '<button class="btn ghost" data-act="canceldraft">' + esc(t("cancel")) + '</button>'
    + '</div></div>';
  return h;
}

/* ------------------------------------------------------------------ modals */
function modalSettings() {
  return '<div class="scrim" data-act="scrim"><div class="modal" role="dialog" aria-modal="true">'
    + '<div class="modal-h"><h2>' + esc(t("codesTitle")) + '</h2><button class="btn ghost" data-act="closemodal">✕</button></div>'
    + '<div class="modal-b">'
    + '<div class="toggrow"><div><b>' + esc(t("advTitle")) + '</b>' + esc(t("advLead")) + '</div>'
    + '<button class="btn sm' + (ui.advanced ? ' primary' : '') + '" data-act="toggleadv">' + esc(ui.advanced ? t("advOn") : t("advOff")) + '</button></div>'
    + '</div><div class="modal-f">'
    + '<button class="btn ghost" data-act="signout" style="margin-right:auto">' + esc(t("signOut")) + '</button>'
    + '<button class="btn" data-act="closemodal">' + esc(t("cancel")) + '</button>'
    + '</div></div></div>';
}

/* Nothing is readable until a code is entered. */
function viewGate() {
  var err = ui.gateErr ? '<div class="blockmsg">' + esc(ui.gateErr) + '</div>' : '';
  return '<div class="gate"><div class="gate-card">'
    + '<div class="gate-lang"><div class="lang">'
    + '<button data-act="lang" data-v="en" aria-pressed="' + (ui.lang === "en") + '">EN</button>'
    + '<button data-act="lang" data-v="fr" aria-pressed="' + (ui.lang === "fr") + '">FR</button>'
    + '</div></div>'
    + '<div class="eyebrow">' + esc(t("sub")) + '</div>'
    + '<h1 class="gate-title">' + esc(t("title")) + '</h1>'
    + '<p class="gate-lead">' + esc(t("gateLead")) + '</p>'
    + '<div class="fld req"><label>' + esc(t("unlockCode")) + '</label>'
    + '<input id="gatecode" class="mono" data-gate="1" value="' + att(ui.gateCode || "") + '" placeholder="XX-0000" autocomplete="off" spellcheck="false" autocapitalize="characters"></div>'
    + err
    + '<button class="btn primary" data-act="gateunlock"' + (ui.gateBusy ? ' disabled' : '') + '>' + esc(ui.gateBusy ? t("checking") : t("unlock")) + '</button>'
    + '<p class="gate-foot">' + esc(t("gateFoot")) + '</p>'
    + '</div></div>';
}

function viewLoading() {
  return '<div class="gate"><div class="gate-card">'
    + '<div class="eyebrow">' + esc(t("sub")) + '</div>'
    + '<h1 class="gate-title">' + esc(t("title")) + '</h1>'
    + (ui.loadErr
      ? '<div class="blockmsg">' + esc(ui.loadErr) + '</div><button class="btn primary" data-act="reload">' + esc(t("retry")) + '</button>'
      : '<p class="gate-lead">' + esc(t("loading")) + '</p>')
    + '</div></div>';
}

/* ------------------------------------------------------------------- render */
function render() {
  var app = document.getElementById("app");

  if (!ui.scope) { app.innerHTML = ui.loading ? viewLoading() : viewGate();
    var g = document.getElementById("gatecode"); if (g) g.focus();
    return; }
  if (ui.loading || (ui.loadErr && !state.devices.length)) { app.innerHTML = viewLoading(); return; }

  if (!isAdmin()) { if (ui.view === "dash" || ui.view === "log") ui.view = "dev"; ui.advanced = false; }
  var body = ui.view === "dash" ? viewDash()
    : ui.view === "dev" ? viewDevices()
    : ui.view === "log" ? viewLog()
    : viewGuide();

  var h = '<header class="topbar"><div class="wrap topbar-in">'
    + '<div class="brand"><b>' + esc(t("title")) + '</b><span>' + esc(t("sub")) + '</span></div>'
    + '<nav class="nav">'
    + (isAdmin() ? '<button data-act="view" data-v="dash"  aria-current="' + (ui.view === "dash") + '">' + esc(t("nav_dash")) + '</button>' : '')
    + '<button data-act="view" data-v="dev"   aria-current="' + (ui.view === "dev") + '">' + esc(t("nav_dev")) + '</button>'
    + (isAdmin() ? '<button data-act="view" data-v="log"   aria-current="' + (ui.view === "log") + '">' + esc(t("nav_log")) + '</button>' : '')
    + '<button data-act="view" data-v="guide" aria-current="' + (ui.view === "guide") + '">' + esc(t("nav_guide")) + '</button>'
    + '</nav>'
    + '<div class="tool">'
    + '<span class="savechip ' + ui.saveState + '" id="savechip">' + esc(ui.saveState === "busy" ? t("saving") : ui.saveState === "ok" ? t("saved") : ui.saveState === "err" ? t("saveErr") : "") + '</span>'
    + '<button class="gearbtn" data-act="opensettings" title="' + att(t("codesTitle")) + '" aria-label="' + att(t("codesTitle")) + '">⚙</button>'
    + '<button class="lockchip' + (isAdmin() ? " admin" : " on") + '" data-act="opensettings">'
    + '<span class="lockdot"></span>' + esc(scopeLabel()) + '</button>'
    + '<div class="lang">'
    + '<button data-act="lang" data-v="en" aria-pressed="' + (ui.lang === "en") + '">EN</button>'
    + '<button data-act="lang" data-v="fr" aria-pressed="' + (ui.lang === "fr") + '">FR</button>'
    + '</div>'
    + '</div>'
    + '</div></header><main><div class="wrap">' + body + '</div></main>';

  if (ui.modal && ui.modal.kind === "settings") h += modalSettings();
  if (ui.lightbox) h += '<div class="scrim lb" data-act="closelb"><img src="' + att(ui.lightbox) + '" alt=""><button class="btn ghost lb-x" data-act="closelb">✕</button></div>';

  app.innerHTML = h;
}

/* ------------------------------------------------------------------- events */
function doUnlock() {
  var code = String(ui.gateCode || "").trim();
  if (!code || ui.gateBusy) return;
  ui.gateBusy = true; ui.gateErr = ""; render();
  api.signIn(code).then(function () {
    ui.gateCode = ""; ui.gateBusy = false; ui.loading = true; render();
    return refresh();
  }).catch(function (err) {
    ui.gateBusy = false;
    ui.gateErr = err.code === "bad_code" ? t("unlockBad") : errText(err);
    render();
  });
}

document.addEventListener("click", function (ev) {
  var el = ev.target.closest("[data-act]");
  if (!el) return;
  var a = el.getAttribute("data-act");

  if (a === "scrim") { if (ev.target === el) { ui.modal = null; render(); } return; }
  ev.preventDefault();

  if (a === "view") { ui.view = el.getAttribute("data-v"); render(); window.scrollTo(0, 0); return; }
  if (a === "lang") { ui.lang = el.getAttribute("data-v"); try { localStorage.setItem("fh_lang", ui.lang); } catch (e) {} render(); return; }
  if (a === "gostore") { ui.store = el.getAttribute("data-store"); ui.view = "dev"; render(); window.scrollTo(0, 0); return; }
  if (a === "filter") { ui.filter = el.getAttribute("data-v"); render(); return; }
  if (a === "guide") { ui.guide = el.getAttribute("data-v"); render(); return; }
  if (a === "guidestore") { ui.guideStore = el.getAttribute("data-v"); ui.guide = ""; render(); return; }
  if (a === "zoom") { ui.lightbox = el.getAttribute("data-src"); render(); return; }
  if (a === "closelb") { if (ev.target === el || el.classList.contains("lb-x")) { ui.lightbox = null; render(); } return; }
  if (a === "gateunlock") { doUnlock(); return; }
  if (a === "reload") { ui.loading = true; ui.loadErr = ""; render(); refresh(); return; }
  if (a === "csv") { exportCsv(); return; }

  if (a === "goguide") {
    var gd = dev(el.getAttribute("data-dev"));
    if (gd) { ui.guideStore = gd.store; ui.guide = gd.pos; ui.view = "guide"; render(); window.scrollTo(0, 0); }
    return;
  }
  if (a === "opensettings") { ui.modal = { kind: "settings" }; render(); return; }
  if (a === "closemodal") { ui.modal = null; render(); return; }
  if (a === "signout") {
    api.signOut();
    state = emptyState();
    ui.scope = ""; ui.modal = null; ui.openDev = null; ui.openTest = null; ui.draft = null;
    render(); return;
  }
  if (a === "toggleadv") {
    if (!isAdmin()) return;
    ui.advanced = !ui.advanced;
    try { localStorage.setItem("fh_adv", ui.advanced ? "1" : "0"); } catch (e) {}
    ui.openDev = null; ui.openTest = null; ui.draft = null;
    ui.modal = null; ui.view = "dev";
    render(); window.scrollTo(0, 0); return;
  }

  if (a === "toggledev") {
    var id = el.getAttribute("data-dev");
    ui.openDev = (ui.openDev === id) ? null : id;
    ui.openTest = null; ui.draft = null;
    render(); return;
  }
  if (a === "toggletest") {
    var dId = el.getAttribute("data-dev"), c = el.getAttribute("data-code");
    if (ui.openTest === key(dId, c)) { ui.openTest = null; ui.draft = null; }
    else openDraft(dId, c);
    render(); return;
  }
  if (a === "draftres") { ui.draft.result = el.getAttribute("data-v"); ui.blocked = false; render(); return; }
  if (a === "canceldraft") { ui.openTest = null; ui.draft = null; ui.blocked = false; render(); return; }
  if (a === "savedraft") { saveDraft(el.getAttribute("data-dev"), el.getAttribute("data-code")); return; }

  if (a === "copy") {
    var txt = el.getAttribute("data-copy"), lbl = el.textContent;
    var done = function () { el.textContent = t("copied"); setTimeout(function () { el.textContent = lbl; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () {});
    return;
  }
});

document.addEventListener("input", function (ev) {
  var el = ev.target;
  if (el.getAttribute && el.getAttribute("data-gate")) { ui.gateCode = el.value; return; }
  var f = el.getAttribute && el.getAttribute("data-fld");
  if (!f) return;
  if (f === "q") {
    ui.q = el.value; var pos = el.selectionStart; render();
    var ne = document.querySelector('[data-fld="q"]');
    if (ne) { ne.focus(); try { ne.setSelectionRange(pos, pos); } catch (e) {} }
    return;
  }
  if (ui.draft && ui.draft.hasOwnProperty(f)) { ui.draft[f] = el.value; return; }
});

document.addEventListener("change", function (ev) {
  var el = ev.target;
  var pf = el.getAttribute && el.getAttribute("data-proof");
  if (pf) {
    var bits = pf.split("|");
    pickProof(bits[0], bits[1], el.files && el.files[0]);
    return;
  }
  var f = el.getAttribute && el.getAttribute("data-fld");
  if (f === "store") { ui.store = el.value; render(); return; }
});

document.addEventListener("keydown", function (ev) {
  if (ev.key === "Enter" && ev.target && ev.target.getAttribute && ev.target.getAttribute("data-gate")) {
    ev.preventDefault(); doUnlock(); return;
  }
  if (ev.key === "Escape") {
    if (ui.lightbox) { ui.lightbox = null; render(); return; }
    if (ui.modal) { ui.modal = null; render(); }
    else if (ui.openTest) { ui.openTest = null; ui.draft = null; render(); }
  }
});

/* --------------------------------------------------------------------- boot */
if (api.token()) { ui.loading = true; render(); refresh(); }
else render();
