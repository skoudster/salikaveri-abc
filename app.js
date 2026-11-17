'use strict';
const KEY='salikaveri_abc_data_v1';
// Aseta tähän palautteen vastaanottava osoite ennen julkaisua.
const FEEDBACK_EMAIL='skoudster@gmail.com';
const APP_VERSION='2.1.1';
let swRegistration=null, updateWaiting=false, applyingUpdate=false, publishedProgram=null, programStatus='';

const app=document.getElementById('app');
const fileInput=document.getElementById('import-file');
let tab='today', data, activeExerciseOpen=null, message='', finishPromptQuote=null, lastFinishQuoteIndex=-1, historyVisibleCount=10, historyOpenIndex=null, progressOpen=false, progressPeriod='25', progressMuscle=null, progressExercisesOpen=false, progressMetric='index', progressExerciseId=null;
const clone=x=>JSON.parse(JSON.stringify(x));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateString=iso=>new Date(iso).toLocaleDateString('fi-FI',{day:'numeric',month:'numeric',year:'numeric'});
const fmt=n=>Number(n).toLocaleString('fi-FI',{maximumFractionDigits:2});
const now=()=>new Date().toISOString();
// Leikkimieliset, itse kirjoitetut sitaatit. Hahmot ovat kuvitteellisia.
const FINISH_QUOTES=[
  {
    "text": "Voima ilman liikkuvuutta on kuin Ferrari ilman ohjausta.",
    "author": "Salikaverin automekaanikko"
  },
  {
    "text": "Vahva kuin härkä. Kankea kuin rautakanki.",
    "author": "Kuntosalifilosofi"
  },
  {
    "text": "Lihakset kasvoivat. Liikerata jäi matkasta.",
    "author": "Professori Jäykkis"
  },
  {
    "text": "Kehonhuolto jäi tekemättä. Jäykkyys kiittää.",
    "author": "Nivelten edunvalvoja"
  },
  {
    "text": "Voimaa on kuin pienessä kylässä. Liikkuvuutta kuin kylän kivessä.",
    "author": "Kyläseppä"
  },
  {
    "text": "Maastaveto kulkee, mutta sukan pukeminen on jo olympialaji.",
    "author": "Sukkatehtaan valmentaja"
  },
  {
    "text": "Lihas kasvaa treenissä. Liikerata ei kasva toivomalla.",
    "author": "Professori Jäykkis"
  },
  {
    "text": "Kehonhuolto ei ole salaliitto. Vaikka se siltä tuntuu.",
    "author": "Salikaverin tiedustelupalvelu"
  },
  {
    "text": "Voima ilman hallintaa on vain hyvin harjoiteltua kömpelyyttä.",
    "author": "Liikkeen filosofi"
  },
  {
    "text": "Kehonhuolto on kuin hammaslanka. Kaikki tietävät, harva tekee.",
    "author": "Hammaslääkäri Kankinen"
  },
  {
    "text": "Lihakset ilmoittautuivat töihin. Liikkuvuus jäi etätöihin.",
    "author": "Henkilöstöpäällikkö Jäykkä"
  },
  {
    "text": "Kehonhuolto: kolme liikettä. Tekosyyt: rajaton määrä.",
    "author": "Salikaveri"
  }
];
function pickFinishQuote(){
  let i=Math.floor(Math.random()*FINISH_QUOTES.length);
  if(FINISH_QUOTES.length>1&&i===lastFinishQuoteIndex)i=(i+1)%FINISH_QUOTES.length;
  lastFinishQuoteIndex=i;
  return FINISH_QUOTES[i];
}
function finishPromptView(){
  if(!finishPromptQuote)return '';
  const completed=data.active.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.done).length,0);
  return `<div class="finish-overlay"><section class="finish-dialog" role="dialog" aria-modal="true" aria-labelledby="finish-question" aria-describedby="finish-quote"><div class="eyebrow">Salikaveri huomauttaa</div><blockquote id="finish-quote" class="finish-quote">”${esc(finishPromptQuote.text)}”</blockquote><p class="finish-author">— ${esc(finishPromptQuote.author)}</p><div class="hr"></div><h2 id="finish-question">Oletko varma, että haluat lopettaa harjoituksen?</h2><p class="small muted">Kirjattuja sarjoja: ${completed}. Keskeneräisiä sarjoja ei lasketa painojen progressioon.</p><div class="finish-buttons"><button id="cancel-finish" class="btn secondary" data-action="cancel-finish">Takaisin treeniin</button><button class="btn" data-action="confirm-finish">Lopeta harjoitus</button></div></section></div>`;
}
function saveFinishedWorkout(){
  if(!data.active)return;
  const completed=data.active.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.done).length,0);
  if(!completed){toast('Kuittaa ensin ainakin yksi sarja.');return}
  finishPromptQuote=null;
  data.active.endedAt=now();data.history.push(data.active);
  data.weights=data.weights||{};
  for(const ex of data.active.exercises){const done=ex.sets.filter(x=>x.done);if(done.length)data.weights[ex.exerciseId]=done[0].weight;}
  data.active=null;data.nextIndex=(data.nextIndex+1)%data.program.rotation.length;
  persist();message='Treeni tallennettu! Seuraava harjoitus on '+getWorkout()+'.';tab='history';render();
}

function persist(){try{localStorage.setItem(KEY,JSON.stringify(data));document.getElementById('save-status').textContent='Tallennettu puhelimeen';return true}catch(e){message='Tallennus epäonnistui: vapauta selaimen tallennustilaa ja vie varmuuskopio.';document.getElementById('save-status').textContent='Tallennusvirhe';return false}}
function toast(t){message=t;render()}
function load(){try{const raw=localStorage.getItem(KEY);if(raw){const v=JSON.parse(raw);if(v&&v.program&&Array.isArray(v.history)&&v.settings){data=v;return}}}catch(e){}data=null}
function validateProgram(p){if(!p||p.schemaVersion!==1||typeof p.programId!=='string'||!p.programId.trim()||typeof p.name!=='string'||!Array.isArray(p.rotation)||!p.rotation.length||!p.profiles||!p.workouts)throw Error('Ohjelman rakenne tai schemaVersion ei kelpaa.');for(const mode of ['hypertrophy','strength',...(p.profiles.explosive?['explosive']:[])]){if(!p.profiles[mode])throw Error('Puuttuva harjoittelutila: '+mode);for(const role of ['main','accessory']){const r=p.profiles[mode][role];if(!validPrescription(r))throw Error('Virheelliset sarjat/toistot: '+mode+'/'+role)}}const ids=new Set();for(const w of p.rotation){if(typeof w!=='string'||!Array.isArray(p.workouts[w])||!p.workouts[w].length)throw Error('Puuttuva tai tyhjä treeni: '+w);for(const ex of p.workouts[w]){if(!ex||typeof ex.exerciseId!=='string'||!ex.exerciseId.trim()||typeof ex.name!=='string'||!['main','accessory'].includes(ex.role)||!Number.isFinite(ex.incrementKg)||ex.incrementKg<=0||![1,2].includes(ex.priority))throw Error('Virheellinen liike treenissä '+w);if(ex.muscleGroup!==undefined&&!MUSCLE_GROUPS.some(g=>g.id===ex.muscleGroup))throw Error('Tuntematon lihasryhmä: '+ex.exerciseId);if(ex.startWeightKg!==undefined&&(!Number.isFinite(ex.startWeightKg)||ex.startWeightKg<0))throw Error('Virheellinen alkupaino: '+ex.exerciseId);if(ids.has(ex.exerciseId))throw Error('Liikkeen exerciseId pitää olla yksilöllinen: '+ex.exerciseId);ids.add(ex.exerciseId);if(ex.prescriptions){for(const [mode,r] of Object.entries(ex.prescriptions)){if(!['hypertrophy','strength','explosive'].includes(mode)||!validPrescription({...p.profiles[mode][ex.role],...r}))throw Error('Virheellinen liikkeen määritys: '+ex.exerciseId)}}}}if(p.explosive!==undefined){if(!p.explosive||typeof p.explosive!=='object'||Array.isArray(p.explosive))throw Error('Virheellinen räjähtävä alku.');for(const [w,items] of Object.entries(p.explosive)){if(!p.rotation.includes(w)||!Array.isArray(items)||items.length>8)throw Error('Virheelliset räjähtävät liikkeet: '+w);const seen=new Set();for(const x of items){if(!x||typeof x.id!=='string'||!x.id.trim()||seen.has(x.id)||typeof x.name!=='string'||!x.name.trim()||typeof x.dose!=='string'||typeof x.instructions!=='string'||![1,2].includes(x.priority))throw Error('Virheellinen räjähtävä liike: '+w);seen.add(x.id)}}}if(p.mobility!==undefined){if(!p.mobility||typeof p.mobility!=='object'||Array.isArray(p.mobility))throw Error('Virheellinen kehonhuolto-osio.');for(const [w,items] of Object.entries(p.mobility)){if(!p.rotation.includes(w)||!Array.isArray(items)||items.length>12)throw Error('Virheellinen kehonhuolto treenissä '+w);const seen=new Set();for(const m of items){if(!m||typeof m.id!=='string'||!m.id.trim()||seen.has(m.id)||typeof m.name!=='string'||!m.name.trim()||typeof m.dose!=='string'||typeof m.instructions!=='string')throw Error('Virheellinen kehonhuoltoliike treenissä '+w);seen.add(m.id)}}}return true}
function validPrescription(p){return p&&Number.isInteger(p.sets)&&p.sets>=1&&p.sets<=12&&Number.isInteger(p.minReps)&&Number.isInteger(p.maxReps)&&p.minReps>=1&&p.maxReps>=p.minReps&&p.maxReps<=300}
function prescription(ex,mode){return {...(data.program.profiles[mode]||data.program.profiles.hypertrophy)[ex.role],...(ex.prescriptions?.[mode]||{})}}
function exerciseHistory(id){return data.history.flatMap(w=>w.exercises||[]).filter(x=>x.exerciseId===id).reverse()}
function lastCompleted(id){return exerciseHistory(id).find(x=>x.sets?.some(s=>s.done))}
function proposed(ex,mode){const p=prescription(ex,mode);const previous=lastCompleted(ex.exerciseId);if(!previous){const w=Number.isFinite(data.weights?.[ex.exerciseId])?data.weights[ex.exerciseId]:(Number.isFinite(ex.startWeightKg)&&ex.startWeightKg>=0?ex.startWeightKg:0);return {weight:w,reason:w>0?'Ehdotettu alkupaino '+fmt(w)+' kg. Tarkista kuorma ja tekniikka ensimmäisellä kerralla.':'Aseta aloituspaino ensimmäiselle kerralle.'};}const sets=previous.sets.filter(s=>s.done);const previousWeight=sets.length?sets[0].weight:0;const consistent=sets.length===p.sets&&sets.every(s=>s.weight===previousWeight&&s.reps>=p.maxReps&&s.good!==false)&&previous.mode===mode;
// Never automatically increase after an incomplete workout, a different training mode or a different target scheme.
const sameTarget=previous.target&&previous.target.sets===p.sets&&previous.target.maxReps===p.maxReps;
if(mode==='explosive')return {weight:previousWeight,reason:'Räjähtävyys: pidä kuorma kevyenä ja jokainen toisto nopeana. Älä korota automaattisesti.'};if(consistent&&sameTarget)return {weight:round(previousWeight+ex.incrementKg),reason:`Kaikki ${p.sets} × ${p.maxReps} onnistui → +${fmt(ex.incrementKg)} kg ehdotus.`};return {weight:previousWeight,reason:'Jatka halutessasi edellisellä painolla. Voit aina säätää kuormaa päivän mukaan.'}}
const round=n=>Math.round(n*100)/100;
function getWorkout(){return data.program.rotation[data.nextIndex%data.program.rotation.length]}
function createSession(){const letter=getWorkout(),mode=data.settings.goal,duration=data.settings.duration;const exercises=data.program.workouts[letter].filter(ex=>duration===60||ex.priority===1).map(ex=>{const p=prescription(ex,mode),s=proposed(ex,mode);return {exerciseId:ex.exerciseId,name:ex.name,muscleGroup:ex.muscleGroup||MUSCLE_BY_ID[ex.exerciseId]||null,role:ex.role,unit:ex.unit||'reps',incrementKg:ex.incrementKg,alternatives:ex.alternatives||[],target:{sets:p.sets,minReps:p.minReps,maxReps:p.maxReps},sets:Array.from({length:p.sets},()=>({weight:s.weight,reps:p.minReps,done:false,good:true})),suggestion:s.reason}});data.active={id:now(),startedAt:now(),letter,mode,duration,programVersion:data.program.version,exercises,explosive:(data.settings.explosiveEnabled?(data.program.explosive?.[letter]||[]).filter(x=>duration===60||x.priority===1).map(x=>({...x,done:false})):[]),mobility:(data.program.mobility?.[letter]||[]).map(m=>({...m,done:false}))};persist()}
function selectedTab(t){tab=t;message='';render()}
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>selectedTab(b.dataset.tab)));
function render(){document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));app.innerHTML=(message?`<div class="notice ${message.startsWith('Virhe')?'warning':''}">${esc(message)}</div>`:'')+({today:todayView,history:historyView,program:programView,settings:settingsView}[tab]());bind();if(finishPromptQuote)document.getElementById('cancel-finish')?.focus()}
function explosivePreview(items,duration,enabled){if(!enabled||!items?.length)return '';const chosen=items.filter(x=>duration===60||x.priority===1);return `<div class="mobility-section explosive-section"><h3>⚡ Räjähtävä alku</h3><p class="small muted">Lämmittelyn jälkeen, ennen raskaita sarjoja. Tee jokainen toisto terävästi ja lopeta laadun heiketessä.</p>${chosen.map(x=>`<div class="mobility-item"><strong>${esc(x.name)}</strong><div class="tag">${esc(x.dose)}</div><div class="small muted">${esc(x.instructions)}</div></div>`).join('')}</div>`}
function explosiveChecklist(items){if(!items?.length)return '';return `<div class="mobility-section explosive-section"><div class="row"><h3>⚡ Räjähtävä alku</h3><span class="pill">${items.filter(x=>x.done).length}/${items.length} tehty</span></div><p class="small muted">Tee lämmittelyn jälkeen ennen voimaliikkeitä. Palauta kunnolla ja pidä toistot nopeina.</p>${items.map((x,i)=>`<label class="mobility-check"><input type="checkbox" data-explosive="${i}" ${x.done?'checked':''}><span><strong>${esc(x.name)}</strong><span class="tag">${esc(x.dose)}</span><span class="small muted">${esc(x.instructions)}</span></span></label>`).join('')}</div>`}
function mobilityPreview(items){if(!items?.length)return '';return `<div class="mobility-section"><div class="row"><h3>🧘 Kehonhuolto</h3><span class="pill">n. 3–5 min</span></div>${items.map(m=>`<div class="mobility-item"><strong>${esc(m.name)}</strong><div class="tag">${esc(m.dose)}</div><div class="small muted">${esc(m.instructions)}</div></div>`).join('')}</div>`}
function mobilityChecklist(items){if(!items?.length)return '';return `<div class="mobility-section"><div class="row"><h3>🧘 Kehonhuolto</h3><span class="pill">${items.filter(m=>m.done).length}/${items.length} tehty</span></div><p class="small muted">Ruksit tallentuvat harjoitushistoriaan.</p>${items.map((m,i)=>`<label class="mobility-check"><input type="checkbox" data-mobility="${i}" ${m.done?'checked':''}><span><strong>${esc(m.name)}</strong><span class="tag">${esc(m.dose)}</span><span class="small muted">${esc(m.instructions)}</span></span></label>`).join('')}</div>`}
function todayView(){const w=getWorkout();if(data.active)return activeView();const exercises=data.program.workouts[w].filter(ex=>data.settings.duration===60||ex.priority===1);return `<div class="eyebrow">Seuraavana vuorossa</div><h1>Treeni ${esc(w)}</h1><p class="muted small">${esc(data.program.name)} · ${esc(data.program.version)}</p><div class="card"><h3>Käytettävissä oleva aika</h3><div class="seg"><button data-duration="45" class="${data.settings.duration===45?'selected':''}">45 min</button><button data-duration="60" class="${data.settings.duration===60?'selected':''}">60 min</button></div><h3>Harjoittelun painotus</h3><div class="seg"><button data-goal="hypertrophy" class="${data.settings.goal==='hypertrophy'?'selected':''}">Lihaskasvu</button><button data-goal="strength" class="${data.settings.goal==='strength'?'selected':''}">Voima</button></div><div class="explosive-toggle"><label><input type="checkbox" data-explosive-toggle ${data.settings.explosiveEnabled?'checked':''}> <strong>⚡ Räjähtävä alku</strong></label><p class="small muted">${data.settings.duration===45?'Yksi':'Kaksi'} treenikohtaista nopeus- ja kimmoisuusliikettä ennen voimaharjoittelua.</p></div>${explosivePreview(data.program.explosive?.[w],data.settings.duration,data.settings.explosiveEnabled)}<div class="notice">${data.settings.duration===45?'Tiivis kokokroppa: pääliikkeet ja tärkeimmät apuliikkeet.':'Täysi kokokroppa: mukana myös viimeistelevät lisäliikkeet.'} Painot ovat ehdotuksia, eivät pakkoja.</div>${exercises.map((ex,i)=>{const p=prescription(ex,data.settings.goal),s=proposed(ex,data.settings.goal);return `<div class="exercise"><div class="row"><div class="row flex1" style="justify-content:flex-start"><span class="num">${i+1}</span><div><div class="exercise-name">${esc(ex.name)}</div><div class="tag">${p.sets} × ${p.minReps}–${p.maxReps} ${ex.unit==='sec'?'s':'toistoa'} · ${ex.role==='main'?'Pääliike':'Apuliike'}</div></div></div><span class="pill">${fmt(s.weight)} kg</span></div></div>`}).join('')}${mobilityPreview(data.program.mobility?.[w])}<button class="btn full topspace" data-action="start">Aloita treeni →</button></div>`}
function activeView(){const w=data.active;return `<div class="eyebrow">Treeni käynnissä · ${dateString(w.startedAt)}</div><h1>Treeni ${esc(w.letter)}</h1><p class="muted small">${w.duration} min · ${w.mode==='strength'?'Voima':w.mode==='explosive'?'Räjähtävyys':'Lihaskasvu'} · ${w.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.done).length,0)} / ${w.exercises.reduce((n,e)=>n+e.sets.length,0)} sarjaa kirjattu</p><div class="card">${explosiveChecklist(w.explosive)}${w.exercises.map((ex,i)=>`<div class="exercise"><div class="row"><div><div class="exercise-name">${i+1}. ${esc(ex.name)}</div><div class="tag">${ex.target.sets} × ${ex.target.minReps}–${ex.target.maxReps} ${ex.unit==='sec'?'sekuntia':'toistoa'}</div></div><span class="pill">${ex.sets.filter(s=>s.done).length}/${ex.sets.length}</span></div><div class="suggest">${esc(ex.suggestion||'')}</div><div class="set-grid"><span class="head">Sarja</span><span class="head">Paino kg</span><span class="head">${ex.unit==='sec'?'Sek.':'Toistot'}</span><span class="head">OK</span>${ex.sets.map((s,j)=>`<span class="small muted" style="text-align:center">${j+1}</span><input aria-label="${esc(ex.name)} sarja ${j+1} paino" inputmode="decimal" type="number" step="0.5" min="0" data-weight="${i}:${j}" value="${esc(s.weight)}"><input aria-label="${esc(ex.name)} sarja ${j+1} toistot" inputmode="numeric" type="number" step="1" min="0" data-reps="${i}:${j}" value="${esc(s.reps)}"><button aria-label="Kuittaa sarja ${j+1}" class="check ${s.done?'done':''}" data-check="${i}:${j}">${s.done?'✓':'○'}</button>`).join('')}</div><div class="row" style="justify-content:flex-start;gap:12px;margin-top:10px"><button class="btn secondary" data-add-set="${i}" type="button">+ Lisää sarja</button>${ex.sets.length>ex.target.sets&&!ex.sets[ex.sets.length-1].done?`<button class="linkbtn" data-remove-set="${i}" type="button">Poista viimeinen lisäsarja</button>`:''}</div><div class="row"><span class="tag">${ex.sets.every(s=>s.done&&s.reps>=ex.target.maxReps)?'Kaikki sarjat kirjattu ✓':'Kuittaa tehdyt sarjat ✓'}</span><button class="linkbtn" data-alternative="${i}">Vaihda liike</button></div>${activeExerciseOpen===i?`<div class="notice">Vaihda liikettä vain, jos et ole vielä kirjannut sen sarjoja.<div class="gap topspace">${ex.alternatives.map((a,k)=>`<button class="btn secondary" data-swap="${i}:${k}">${esc(a)}</button>`).join('')||'<span>Ei vaihtoehtoja ohjelmassa.</span>'}</div></div>`:''}</div>`).join('')}${mobilityChecklist(w.mobility)}<div class="notice">Kirjaa toteutuneet painot ja toistot sellaisina kuin ne olivat. Jokainen tehty sarja on arvokasta harjoittelua.</div><button class="btn full" data-action="finish">Tallenna ja päätä treeni</button><button class="btn ghost full topspace" data-action="discard">Hylkää keskeneräinen treeni</button></div>${finishPromptView()}`}
// Historia 2.0: laske tilastot vain kuitatuista sarjoista.
// Sekunteina kirjatut pidot ja kävelyt eivät ole kg × toistot -volyymia.
function completedSets(w){return (w.exercises||[]).reduce((n,ex)=>n+(ex.sets||[]).filter(s=>s.done).length,0)}
function workoutVolume(w){return (w.exercises||[]).reduce((total,ex)=>{
  if(ex.unit==='sec')return total;
  return total+(ex.sets||[]).reduce((sum,s)=>{
    const weight=Number(s.weight),reps=Number(s.reps);
    return sum+(s.done&&Number.isFinite(weight)&&weight>=0&&Number.isFinite(reps)&&reps>=0?weight*reps:0);
  },0);
},0)}
function workoutDate(w){const t=Date.parse(w.endedAt||w.startedAt||'');return Number.isFinite(t)?t:NaN}
function workoutDuration(w){const a=Date.parse(w.startedAt||''),b=Date.parse(w.endedAt||'');if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)return '–';const minutes=Math.round((b-a)/60000);return minutes<60?`${minutes} min`:`${Math.floor(minutes/60)} h ${minutes%60} min`}
function workoutDateTime(w){const t=workoutDate(w);return Number.isFinite(t)?new Date(t).toLocaleString('fi-FI',{day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Päiväys puuttuu'}
function ironComparison(kg){
  if(kg<=0)return 'Kun rautaa kertyy, tänne ilmestyy sopivan absurdi vertaus. 🐘';
  const item=kg<1500?{weight:70,name:'pesukoneen'}:kg<30000?{weight:1500,name:'henkilöauton'}:{weight:6000,name:'norsun'};
  const amount=kg/item.weight;
  // Pieniä osuuksia ei pyöristetä nollaksi.
  const digits=amount<1?2:amount<10?1:0;
  return `Se vastaa noin ${amount.toLocaleString('fi-FI',{maximumFractionDigits:digits})} ${item.name} massan verran. ${kg<1500?'🧺':kg<30000?'🚗':'🐘'}`;
}
function historyStats(items){
  const end=Date.now(),start=end-28*24*60*60*1000;
  const recent=items.filter(w=>{const t=workoutDate(w);return Number.isFinite(t)&&t>=start&&t<=end});
  const sets=recent.reduce((n,w)=>n+completedSets(w),0);
  const volume=recent.reduce((n,w)=>n+workoutVolume(w),0);
  const mobility=recent.flatMap(w=>Array.isArray(w.mobility)?w.mobility:[]);
  const mobilityDone=mobility.filter(m=>m.done).length;
  return {count:recent.length,sets,volume,mobilityRate:mobility.length?Math.round(100*mobilityDone/mobility.length):null,totalVolume:items.reduce((n,w)=>n+workoutVolume(w),0)};
}

// Kehitys 2.0. Painot ja toistot tuottavat vertailukelpoisen liikeindeksin.
// Eri liikkeiden absoluuttisia kiloja ei yhdistetä keskenään.
const MUSCLE_GROUPS=[
  {id:'legs',name:'Jalat'}, {id:'chest',name:'Rinta'},
  {id:'back',name:'Selkä'}, {id:'shoulders',name:'Olkapäät'},
  {id:'arms',name:'Kädet'}, {id:'core',name:'Keskivartalo'}
];
// Vanhoissa treeneissä ei ole lihasryhmätunnistetta: nämä tunnisteet toimivat myös offline.
const MUSCLE_BY_ID={
  'squat':'legs','db-bench-neutral':'chest','cable-row':'back',
  'leg-curl':'legs','lateral-raise':'shoulders','calf-raise':'legs','farmers-walk':'core',
  'rdl':'legs','seated-db-shoulder-press':'shoulders','lat-pulldown':'back',
  'leg-press':'legs','chest-press':'chest','incline-curl':'arms','plank':'core',
  'split-squat':'legs','incline-db-press':'chest','chest-supported-row':'back',
  'hip-thrust':'legs','leg-extension':'legs','triceps-pushdown':'arms','face-pull':'shoulders'
};
function muscleOf(ex){
  if(MUSCLE_GROUPS.some(g=>g.id===ex.muscleGroup))return ex.muscleGroup;
  if(MUSCLE_BY_ID[ex.exerciseId])return MUSCLE_BY_ID[ex.exerciseId];
  // Vanhoissa ohjelmissa oli myös vaihdettavia vaihtoehtoliikkeitä.
  const name=String(ex.name||'').toLowerCase();
  if(/kyykky|jalkaprässi|koukistus|pohjenousu|reidenojennus|hip thrust|maastaveto/.test(name))return 'legs';
  if(/penkki|rintaprässi/.test(name))return 'chest';
  if(/soutu|ylätalja|leuanveto/.test(name))return 'back';
  if(/pystypunnerrus|vipunost|face pull/.test(name))return 'shoulders';
  if(/hauiskääntö|ojentajapunnerrus/.test(name))return 'arms';
  if(/lankku|farmer/.test(name))return 'core';
  return null;
}
function progressRecords(items){
  const records=[];
  for(const w of items){
    const date=workoutDate(w);
    if(!Number.isFinite(date))continue;
    for(const ex of w.exercises||[]){
      const muscle=muscleOf(ex);
      if(!muscle)continue;
      const sets=(ex.sets||[]).filter(s=>s.done);
      if(!sets.length)continue;
      // Sekuntipitoja ja nollapainoisia liikkeitä ei väitetä maksimivoimatestiksi.
      const estimates=ex.unit==='sec'?[]:sets.filter(s=>{
        const kg=Number(s.weight),reps=Number(s.reps);
        return Number.isFinite(kg)&&kg>0&&Number.isInteger(reps)&&reps>=1&&reps<=20&&s.good!==false;
      }).map(s=>Number(s.weight)*(1+Number(s.reps)/30));
      records.push({date,id:String(ex.exerciseId||ex.name),name:String(ex.name||'Liike'),muscle,sets:sets.length,estimate:estimates.length?Math.max(...estimates):null});
    }
  }
  return records.sort((a,b)=>a.date-b.date);
}
const PROGRESS_PERIODS=[['4','4 vk',4],['10','10 vk',10],['25','25 vk',25],['52','52 vk',52],['all','Kaikki',null]];
function progressWindow(records,period){
  const nowTime=Date.now(),weeks=PROGRESS_PERIODS.find(x=>x[0]===period)?.[2];
  const first=records.length?Math.min(...records.map(r=>r.date)):nowTime;
  const from=weeks===null?first:nowTime-weeks*7*86400000;
  // Näytä aikavälin ensimmäinen ja viimeinen viikko, korkeintaan 53 datapistettä.
  const days=weeks===null?Math.max(1,(nowTime-from)/86400000):weeks*7;
  const count=Math.max(2,Math.min(53,Math.ceil(days/7)+1));
  const ticks=Array.from({length:count},(_,i)=>from+(nowTime-from)*i/(count-1));
  return {from,ticks};
}
function exerciseTracks(records){
  const byId=new Map();
  for(const r of records){
    if(r.estimate===null)continue;
    const key=r.muscle+'|'+r.id;
    if(!byId.has(key))byId.set(key,[]);
    byId.get(key).push(r);
  }
  return byId;
}
function trackValue(track,t){
  const prior=track.filter(r=>r.date<=t);
  if(!prior.length)return null;
  // 3 viimeisimmän harjoituskerran keskiarvo vaimentaa yhden päivän vaihtelua.
  const recent=prior.slice(-3);
  const current=recent.reduce((n,r)=>n+r.estimate,0)/recent.length;
  const baseline=track[0].estimate;
  return baseline>0?100*current/baseline:null;
}
function progressSeries(tracks,ticks,muscle){
  const relevant=[...tracks.entries()].filter(([key])=>muscle===null||key.startsWith(muscle+'|'));
  return ticks.map(t=>{
    const values=relevant.map(([,track])=>trackValue(track,t)).filter(v=>v!==null);
    return values.length?values.reduce((n,v)=>n+v,0)/values.length:null;
  });
}
function progressCurrent(series){
  const values=series.filter(v=>v!==null);
  return values.length?values[values.length-1]:null;
}
function progressChangeLabel(series){
  const values=series.filter(v=>v!==null);
  if(values.length<2)return 'Ensimmäinen mittaus';
  const change=values[values.length-1]-values[0];
  if(Math.abs(change)<0.5)return 'Lähes ennallaan';
  return (change>0?'+':'')+fmt(Math.round(change))+' pistettä';
}
function progressChart(series,labels){
  const entries=series.map((value,i)=>({value,i})).filter(p=>p.value!==null&&Number.isFinite(p.value));
  if(!entries.length)return '<p class="small muted progress-empty">Voimakehityksen graafi syntyy, kun kirjaat painollisia sarjoja.</p>';
  const width=340,height=174,left=39,right=10,top=15,bottom=32;
  const vals=entries.map(p=>p.value),rawMin=Math.min(100,...vals),rawMax=Math.max(100,...vals);
  const margin=Math.max(3,(rawMax-rawMin)*.2);
  const low=Math.floor((rawMin-margin)/5)*5,high=Math.ceil((rawMax+margin)/5)*5;
  const x=i=>left+(width-left-right)*i/Math.max(1,series.length-1);
  const y=v=>top+(height-top-bottom)*(high-v)/Math.max(1,high-low);
  const grid=[0,.5,1].map(f=>{const v=low+(high-low)*f;return `<line x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}" stroke="#50617a" stroke-opacity=".4" stroke-dasharray="3 4"/><text x="${left-7}" y="${y(v)+4}" text-anchor="end" fill="#9db2c9" font-size="11">${Math.round(v)}</text>`}).join('');
  // Katkaise viiva, jos dataa ei vielä ole. Myöhempi puuttuva viikko säilyttää viimeisen tunnetun tuloksen.
  const segments=[];let segment=[];
  series.forEach((v,i)=>{if(v===null){if(segment.length)segments.push(segment);segment=[];}else segment.push([x(i),y(v)])});
  if(segment.length)segments.push(segment);
  const paths=segments.map(points=>`<polyline points="${points.map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#7de2b8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  const dots=entries.length<=16?entries.map(p=>`<circle cx="${x(p.i)}" cy="${y(p.value)}" r="3.2" fill="#7de2b8"/>`).join(''):'';
  const first=labels[0]||'',last=labels[labels.length-1]||'';
  return `<svg class="progress-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Kehitysindeksi ${fmt(vals[0])}–${fmt(vals[vals.length-1])}. ${esc(first)}–${esc(last)}">${grid}${paths}${dots}<text x="${left}" y="${height-6}" font-size="11" fill="#9db2c9">${esc(first)}</text><text x="${width-right}" y="${height-6}" font-size="11" fill="#9db2c9" text-anchor="end">${esc(last)}</text></svg>`;
}
function progressSpark(series){
  const entries=series.map((v,i)=>({v,i})).filter(p=>p.v!==null);
  if(!entries.length)return '<span class="progress-no-line">Ei vielä painollisia sarjoja</span>';
  const min=Math.min(...entries.map(p=>p.v)),max=Math.max(...entries.map(p=>p.v));
  const span=Math.max(8,max-min),low=min-span*.15;
  const points=entries.map(p=>`${(p.i/Math.max(1,series.length-1)*118+1).toFixed(1)},${(29-(p.v-low)/(span*1.3)*25).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 120 34" class="progress-spark" aria-hidden="true"><polyline points="${points}" fill="none" stroke="#79c7f0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function progressSetsChart(records,from){
  const nowTime=Date.now(),windowed=records.filter(r=>r.date>=from&&r.date<=nowTime);
  if(!windowed.length)return '<p class="small muted">Ei kirjattuja sarjoja tällä aikavälillä.</p>';
  const weeks=[];
  // Enintään 10 pylvästä, jotta kaavio toimii puhelimella.
  const span=Math.max(1,Math.ceil((nowTime-from)/(7*86400000)));
  const count=Math.min(10,span),bucket=(nowTime-from)/count||1;
  for(let i=0;i<count;i++){
    const a=from+i*bucket,b=i===count-1?nowTime+1:from+(i+1)*bucket;
    weeks.push(windowed.filter(r=>r.date>=a&&r.date<b).reduce((n,r)=>n+r.sets,0));
  }
  const max=Math.max(1,...weeks),barW=100/count;
  return `<div class="progress-bars" role="img" aria-label="Tehdyt sarjat ajanjaksoittain: ${weeks.join(', ')}"><div class="progress-bar-row">${weeks.map((n,i)=>`<div class="progress-bar-col"><span class="progress-bar-num">${n||''}</span><div class="progress-bar" style="height:${Math.max(n?5:2,n/max*84)}px;opacity:${n?1:.25}"></div></div>`).join('')}</div><div class="progress-bar-axis"><span>Alku</span><span>Nyt</span></div></div>`;
}
function progressView(items){
  const records=progressRecords(items),tracks=exerciseTracks(records),window=progressWindow(records,progressPeriod);
  const labels=window.ticks.map(t=>new Date(t).toLocaleDateString('fi-FI',{day:'numeric',month:'numeric'}));
  const groups=MUSCLE_GROUPS.map(g=>{
    const series=progressSeries(tracks,window.ticks,g.id);
    return {...g,series,current:progressCurrent(series),count:records.filter(r=>r.muscle===g.id&&r.date>=window.from).reduce((n,r)=>n+r.sets,0)};
  });
  // Kokonaisindeksi: kukin mitattu lihasryhmä on samanarvoinen, ei jokainen liike.
  const allSeries=window.ticks.map((_,i)=>{const values=groups.map(g=>g.series[i]).filter(v=>v!==null);return values.length?values.reduce((n,v)=>n+v,0)/values.length:null;});
  const allCurrent=progressCurrent(allSeries);
  const selected=groups.find(g=>g.id===progressMuscle)||groups.find(g=>g.current!==null)||groups[0];
  const selectedRecords=records.filter(r=>r.muscle===selected.id);
  const exercises=[...tracks.entries()].filter(([key])=>key.startsWith(selected.id+'|')).map(([key,track])=>{
    const series=window.ticks.map(t=>trackValue(track,t));
    return {id:key,name:track[track.length-1].name,series,current:progressCurrent(series),count:track.length,last:track[track.length-1]};
  }).sort((a,b)=>a.name.localeCompare(b.name,'fi'));
  return `<section class="card progress-section">
    <button class="progress-toggle" data-progress-toggle type="button" aria-expanded="${progressOpen}" aria-controls="progress-content"><span><strong>📈 Lihasryhmien kehitys</strong><small>Voimaindeksi ja harjoittelumäärä</small></span><span class="history-chevron" aria-hidden="true">${progressOpen?'⌃':'⌄'}</span></button>
    ${progressOpen?`<div id="progress-content" class="progress-content">
      <div class="progress-period" role="group" aria-label="Tarkastelujakso">${PROGRESS_PERIODS.map(([id,label])=>`<button type="button" data-progress-period="${id}" class="${progressPeriod===id?'active':''}" aria-pressed="${progressPeriod===id}">${label}</button>`).join('')}</div>
      <div class="progress-main-number"><span class="tag">Kokonaiskehitysindeksi</span><div class="progress-index-value">${allCurrent===null?'–':fmt(Math.round(allCurrent))}</div><span class="small muted">${allCurrent===null?'Ei vielä vertailukelpoisia sarjoja':esc(progressChangeLabel(allSeries))}</span></div>
      ${progressChart(allSeries,labels)}
      <p class="tiny muted">Indeksi perustuu kirjattuihin painoihin ja toistoihin. Lähtötaso on 100 per liike. Kyse on suuntaa antavasta suorituskyvyn arviosta, ei lihaskasvun mittauksesta.</p>
      <h3 class="progress-subheading">Lihasryhmittäin</h3>
      <div class="progress-muscle-grid">${groups.map(g=>`<button type="button" class="progress-muscle ${selected.id===g.id?'active':''}" data-progress-muscle="${g.id}" aria-pressed="${selected.id===g.id}"><span class="progress-muscle-name">${g.name}</span><strong>${g.current===null?'–':fmt(Math.round(g.current))}</strong>${progressSpark(g.series)}<span class="progress-muscle-count">${g.count} sarjaa jaksolla</span></button>`).join('')}</div>
      <div class="progress-detail"><h3>${selected.name}</h3><div class="progress-metric-tabs"><button type="button" data-progress-metric="index" class="${progressMetric==='index'?'active':''}" aria-pressed="${progressMetric==='index'}">Voimakehitys</button><button type="button" data-progress-metric="sets" class="${progressMetric==='sets'?'active':''}" aria-pressed="${progressMetric==='sets'}">Harjoittelumäärä</button></div>
      ${progressMetric==='index'?`<div class="progress-detail-stat">${selected.current===null?'–':fmt(Math.round(selected.current))}<span class="small muted">${selected.current===null?'Ei vielä painollisia sarjoja':esc(progressChangeLabel(selected.series))}</span></div>${progressChart(selected.series,labels)}`:`<div class="progress-detail-stat">${selected.count}<span class="small muted">tehtyä sarjaa valitulla jaksolla</span></div>${progressSetsChart(selectedRecords,window.from)}`}
      <button type="button" class="progress-exercises-toggle" data-progress-exercises aria-expanded="${progressExercisesOpen}">Liikkeiden kehitys <span aria-hidden="true">${progressExercisesOpen?'⌃':'⌄'}</span></button>
      ${progressExercisesOpen?`<div class="progress-exercise-list">${exercises.length?exercises.map(ex=>`<div class="progress-exercise-item"><button type="button" data-progress-exercise-id="${esc(ex.id)}" aria-expanded="${progressExerciseId===ex.id}" class="progress-exercise-trigger"><span>${esc(ex.name)}<small>${ex.count} harjoituskertaa</small></span><strong>${ex.current===null?'–':fmt(Math.round(ex.current))} <span aria-hidden="true">${progressExerciseId===ex.id?'⌃':'⌄'}</span></strong></button>${progressExerciseId===ex.id?`<div class="progress-exercise-chart"><span class="tag">Liikkeen oma kehitysindeksi</span>${progressChart(ex.series,labels)}<p class="tiny muted">Lähtötaso 100 · Painon ja toistojen perusteella arvioitu suorituskyky</p></div>`:''}</div>`).join(''):'<p class="small muted">Ei vielä painollisia liikkeitä.</p>'}</div>`:''}
      </div>
      <p class="tiny muted progress-footnote">Kehitysindeksi yhdistää liikkeiden suhteelliset muutokset, ei niiden kilolukuja. Arvio perustuu parhaaseen kirjattuun sarjaan ja tasoitetaan enintään kolmella viimeisimmällä harjoituskerralla. Uudet liikkeet aloittavat indeksistä 100. Liikkeet ilman kirjattua lisäpainoa eivät kuulu voimaindeksiin, mutta niiden sarjat näkyvät harjoittelumäärässä.</p>
    </div>`:''}
  </section>`;
}

function historyDetail(w,index){
  const doneExercises=(w.exercises||[]).filter(ex=>(ex.sets||[]).some(s=>s.done));
  const explosive=Array.isArray(w.explosive)?w.explosive:[];
  const mobility=Array.isArray(w.mobility)?w.mobility:[];
  return `<div class="history-detail" id="history-detail-${index}">
    <div class="history-detail-head">Tehdyt liikkeet</div>
    ${doneExercises.length?doneExercises.map(ex=>`<div class="history-exercise"><strong>${esc(ex.name)}</strong><div class="tag">${(ex.sets||[]).filter(s=>s.done).map(s=>`${fmt(s.weight)} kg × ${esc(s.reps)}${ex.unit==='sec'?' s':''}`).join(' · ')}</div></div>`).join(''):'<p class="small muted">Ei kirjattuja sarjoja.</p>'}
    ${explosive.length?`<div class="history-detail-head">⚡ Räjähtävä alku · ${explosive.filter(x=>x.done).length}/${explosive.length}</div>${explosive.map(x=>`<div class="history-mini ${x.done?'history-done':''}">${x.done?'✓':'○'} ${esc(x.name)} <span class="muted">${esc(x.dose||'')}</span></div>`).join('')}`:''}
    ${mobility.length?`<div class="history-detail-head">🧘 Kehonhuolto · ${mobility.filter(m=>m.done).length}/${mobility.length}</div>${mobility.map(m=>`<div class="history-mini ${m.done?'history-done':''}">${m.done?'✓':'○'} ${esc(m.name)}</div>`).join('')}`:''}
    <button class="linkbtn history-delete" data-delete-history="${index}">Poista tämä treeni</button>
  </div>`;
}
function historyView(){
  const items=data.history||[],stats=historyStats(items);
  const ordered=items.map((w,index)=>({w,index})).sort((a,b)=>{
    const ta=workoutDate(a.w),tb=workoutDate(b.w);
    return (Number.isFinite(tb)?tb:-Infinity)-(Number.isFinite(ta)?ta:-Infinity)||b.index-a.index;
  });
  const shown=ordered.slice(0,historyVisibleCount);
  return `<div class="eyebrow">Kehitys</div><h1>Harjoitushistoria</h1>
    <p class="muted small">${items.length} tallennettua treeniä. Painot ja sarjat säilyvät ohjelman vaihtuessa.</p>
    <h2 class="history-heading">Viimeiset 4 viikkoa</h2>
    <div class="history-stats">
      <div class="history-stat"><span class="history-stat-number">${fmt(stats.count)}</span><span class="history-stat-label">Treeniä</span></div>
      <div class="history-stat"><span class="history-stat-number">${fmt(stats.volume)} <small>kg</small></span><span class="history-stat-label">Nostettua rautaa</span></div>
      <div class="history-stat"><span class="history-stat-number">${fmt(stats.sets)}</span><span class="history-stat-label">Tehtyä sarjaa</span></div>
      <div class="history-stat"><span class="history-stat-number">${stats.mobilityRate===null?'–':stats.mobilityRate+' %'}</span><span class="history-stat-label">Kehonhuoltorastit</span></div>
    </div>
    <div class="history-iron card">
      <div class="eyebrow">Kaikki treenit yhteensä</div>
      <div class="history-iron-number">${fmt(stats.totalVolume)} <small>kg</small></div>
      <p class="history-comparison">${esc(ironComparison(stats.totalVolume))}</p>
      <p class="tiny muted">Laskettu kuitatuista sarjoista: kirjattu paino × toistot. Aikapohjaiset liikkeet eivät ole mukana. Käsipainopareja ei kerrota automaattisesti kahdella. Massavertaus on leikkimielinen.</p>
    </div>
    ${progressView(items)}
    <div class="row history-list-title"><h2>Viimeisimmät treenit</h2><span class="tag">Uusin ensin</span></div>
    ${shown.length?shown.map(({w,index})=>{
      const open=historyOpenIndex===index,sets=completedSets(w),kg=workoutVolume(w);
      const mode=w.mode==='strength'?'Voima':w.mode==='explosive'?'Räjähtävyys':'Lihaskasvu';
      return `<article class="history-tile card">
        <button type="button" class="history-tile-trigger" data-history-toggle="${index}" aria-expanded="${open}" aria-controls="history-detail-${index}">
          <span class="history-tile-top"><span><strong>Treeni ${esc(w.letter||'?')}</strong><span class="history-tile-meta">${esc(workoutDateTime(w))} · ${mode}</span></span><span class="history-chevron" aria-hidden="true">${open?'⌃':'⌄'}</span></span>
          <span class="history-tile-numbers"><span>🏋️ ${fmt(kg)} kg</span><span>☑ ${sets} sarjaa</span><span>◷ ${esc(workoutDuration(w))}</span></span>
        </button>
        ${open?historyDetail(w,index):''}
      </article>`;
    }).join(''):'<div class="card muted">Ei vielä tallennettuja treenejä. Ensimmäinen salikerta aloittaa historian.</div>'}
    ${ordered.length>historyVisibleCount?`<button class="btn secondary full history-more" data-history-more>Lisää treenejä (${ordered.length-historyVisibleCount} jäljellä)</button>`:''}
  `;
}
function programView(){return `<div class="eyebrow">Muokattava JSON-ohjelma</div><h1>${esc(data.program.name)}</h1><p class="muted small">Versio ${esc(data.program.version)} · ${data.program.rotation.length} harjoitusta · ${data.program.rotation.join(' → ')}</p>${data.program.rotation.map(w=>`<div class="card"><h2>Treeni ${esc(w)}</h2>${data.program.workouts[w].map(ex=>{const p=prescription(ex,data.settings.goal);return `<div class="list-item row"><div><strong>${esc(ex.name)}</strong><div class="tag">${ex.role==='main'?'Pääliike':'Apuliike'} · ${ex.priority===1?'45 ja 60 min':'60 min'}</div></div><span class="pill">${p.sets} × ${p.minReps}–${p.maxReps}</span></div>`}).join('')}</div>`).join('')}<div class="card"><h3>Julkaistu ohjelma</h3><p class="small muted">GitHubin yhteinen ohjelma on käyttäjän valittavissa. Omat painot ja historia säilyvät päivityksessä.</p><p class="small muted">${esc(programStatus||'Tarkista, onko uusi ohjelma julkaistu.')}</p>${publishedProgram?.announcement?.message?`<div class="notice">📣 ${esc(publishedProgram.announcement.message)}</div>`:''}<div class="file-actions"><button class="btn secondary" data-action="check-program">Tarkista ohjelma</button>${publishedProgram&&programDiffers(publishedProgram,data.program)?'<button class="btn" data-action="apply-program">Ota julkaistu ohjelma käyttöön</button>':''}</div></div><div class="card"><h3>Ohjelmatiedosto</h3><p class="small muted">Vie nykyinen ohjelma JSONina tai tuo uusi. Uusi ohjelma ei poista treenihistoriaa. Pidä samat exerciseId-tunnisteet samoille liikkeille.</p><div class="file-actions"><button class="btn secondary" data-action="export-program">Vie ohjelma</button><button class="btn" data-action="import-program">Tuo ohjelma</button></div></div>`}
function settingsView(){return `<div class="eyebrow">Tiedot ja asetukset</div><h1>Asetukset</h1><div class="card"><h3>Versiot ja päivitykset</h3><div class="list-item row"><span>Sovellus</span><strong>v${APP_VERSION}</strong></div><div class="list-item row"><span>Harjoitusohjelma</span><strong>${esc(data.program.version||"ei versiota")}</strong></div><div class="list-item row"><span>Ohjelma</span><strong>${esc(data.program.name)}</strong></div><p class="small muted" id="update-state">${updateWaiting?"Uusi versio on valmiina asennettavaksi.":"Voit tarkistaa uuden sovellusversion. Harjoitusohjelmaa ei vaihdeta automaattisesti."}</p><div class="file-actions"><button class="btn secondary" data-action="check-update">Tarkista päivitykset</button>${updateWaiting?'<button class="btn" data-action="apply-update">Asenna päivitys</button>':''}</div></div><div class="card"><h3>Seuraava treeni</h3><label class="field"><span>Valitse seuraavaksi</span><select id="next-workout">${data.program.rotation.map((w,i)=>`<option value="${i}" ${i===data.nextIndex?'selected':''}>Treeni ${esc(w)}</option>`).join('')}</select></label><p class="small muted">Voit korjata kiertoa, jos kävit salilla ilman sovellusta.</p></div><div class="card"><h3>Varmuuskopiointi</h3><p class="small muted">Vie kaikki tiedot JSON-tiedostoon. Tuo varmuuskopio palauttaa ohjelman, asetukset ja treenihistorian sekä korvaa tämän laitteen nykyiset tiedot.</p><div class="file-actions"><button class="btn secondary" data-action="export-backup">Vie kaikki tiedot</button><button class="btn" data-action="import-backup">Palauta varmuuskopio</button></div></div><div class="card"><h3>Tallennuksen huomioita</h3><p class="small muted">Tiedot tallennetaan selaimen localStorage-muistiin tällä laitteella. Safari voi poistaa sivustotietoja, ja yksityinen selaus ei sovellu pysyvään tallennukseen. Vie varmuuskopio säännöllisesti Tiedostot-sovellukseen tai iCloud Driveen. Eri laitteet eivät synkronoidu automaattisesti.</p></div><div class="card"><h3>💬 Palaute ja kehitysideat</h3><p class="small muted">Mikä toimii, mikä ei? Kerro idea, bugi tai muu palaute. Voit kopioida viestin tai avata sähköpostisovelluksen ja lähettää sen kehittäjälle.</p><label class="field"><span>Palautteen tyyppi</span><select id="feedback-type"><option value="Kehitysidea">💡 Kehitysidea</option><option value="Bugiraportti">🐛 Bugiraportti</option><option value="Muu palaute">💬 Muu palaute</option></select></label><label class="field"><span>Viesti</span><textarea id="feedback-message" rows="5" maxlength="5000" placeholder="Kerro tähän..."></textarea></label><div class="file-actions"><button class="btn secondary" data-action="copy-feedback">Kopioi palaute</button><button class="btn" data-action="send-feedback">Lähetä sähköpostilla</button></div><p class="small muted">Sovellus ei lähetä palautetta automaattisesti. Sähköpostin lähetys vahvistetaan omassa sähköpostisovelluksessasi.</p></div><div class="card"><h3>Tietojen tyhjennys</h3><button class="btn danger" data-action="reset">Poista kaikki paikalliset tiedot</button></div>`}
function downloadJson(obj,filename){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
function bind(){app.querySelectorAll('[data-add-set]').forEach(b=>b.onclick=()=>{const ex=data.active?.exercises[Number(b.dataset.addSet)];if(!ex||ex.sets.length>=20)return;const prev=ex.sets[ex.sets.length-1];ex.sets.push({weight:prev?.weight??0,reps:prev?.reps??ex.target.minReps,done:false,good:true});persist();render()});app.querySelectorAll('[data-remove-set]').forEach(b=>b.onclick=()=>{const ex=data.active?.exercises[Number(b.dataset.removeSet)];if(!ex||ex.sets.length<=ex.target.sets||ex.sets[ex.sets.length-1].done)return;ex.sets.pop();persist();render()});app.querySelectorAll('[data-explosive-toggle]').forEach(el=>el.onchange=()=>{data.settings.explosiveEnabled=el.checked;persist();render()});app.querySelectorAll('[data-explosive]').forEach(el=>el.onchange=()=>{if(!data.active)return;const x=data.active.explosive?.[Number(el.dataset.explosive)];if(!x)return;x.done=el.checked;persist();render()});app.querySelectorAll('[data-duration]').forEach(b=>b.onclick=()=>{data.settings.duration=Number(b.dataset.duration);persist();render()});app.querySelectorAll('[data-goal]').forEach(b=>b.onclick=()=>{data.settings.goal=b.dataset.goal;persist();render()});app.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));app.querySelectorAll('[data-weight]').forEach(el=>el.onchange=()=>setNumber(el,'weight'));app.querySelectorAll('[data-reps]').forEach(el=>el.onchange=()=>setNumber(el,'reps'));app.querySelectorAll('[data-mobility]').forEach(el=>el.onchange=()=>{if(!data.active)return;const m=data.active.mobility?.[Number(el.dataset.mobility)];if(!m)return;m.done=el.checked;persist();render()});app.querySelectorAll('[data-check]').forEach(b=>b.onclick=()=>{const [i,j]=b.dataset.check.split(':').map(Number),s=data.active.exercises[i].sets[j];if(!Number.isFinite(s.weight)||s.weight<0||!Number.isInteger(s.reps)||s.reps<0){toast('Virhe: tarkista paino ja toistot.');return}s.done=!s.done;persist();render()});app.querySelectorAll('[data-alternative]').forEach(b=>b.onclick=()=>{activeExerciseOpen=Number(b.dataset.alternative)===activeExerciseOpen?null:Number(b.dataset.alternative);render()});app.querySelectorAll('[data-swap]').forEach(b=>b.onclick=()=>{const [i,k]=b.dataset.swap.split(':').map(Number),ex=data.active.exercises[i];if(ex.sets.some(s=>s.done)){toast('Liikettä ei voi vaihtaa sarjojen kirjaamisen jälkeen.');return}const newName=ex.alternatives[k];if(!newName)return;ex.name=newName;ex.exerciseId='alternative:'+newName.toLowerCase().replace(/\s+/g,'-');const old=data.program.workouts[data.active.letter].find(x=>x.exerciseId===ex.exerciseId);const prev=lastCompleted(ex.exerciseId);ex.sets.forEach(s=>{s.weight=prev?.sets?.find(x=>x.done)?.weight||0});ex.suggestion='Vaihtoehtoinen liike: tarkista aloituspaino.';activeExerciseOpen=null;persist();render()});app.querySelectorAll('[data-progress-toggle]').forEach(b=>b.onclick=()=>{progressOpen=!progressOpen;render()});app.querySelectorAll('[data-progress-period]').forEach(b=>b.onclick=()=>{progressPeriod=b.dataset.progressPeriod;render()});app.querySelectorAll('[data-progress-muscle]').forEach(b=>b.onclick=()=>{progressMuscle=b.dataset.progressMuscle;progressExercisesOpen=false;progressExerciseId=null;render()});app.querySelectorAll('[data-progress-exercises]').forEach(b=>b.onclick=()=>{progressExercisesOpen=!progressExercisesOpen;render()});app.querySelectorAll('[data-progress-exercise-id]').forEach(b=>b.onclick=()=>{progressExerciseId=progressExerciseId===b.dataset.progressExerciseId?null:b.dataset.progressExerciseId;render()});app.querySelectorAll('[data-progress-metric]').forEach(b=>b.onclick=()=>{progressMetric=b.dataset.progressMetric;render()});app.querySelectorAll('[data-history-toggle]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.historyToggle);historyOpenIndex=historyOpenIndex===i?null:i;render()});app.querySelectorAll('[data-history-more]').forEach(b=>b.onclick=()=>{historyVisibleCount+=10;render()});app.querySelectorAll('[data-delete-history]').forEach(b=>b.onclick=()=>{if(confirm('Poistetaanko tämä harjoitus pysyvästi?')){data.history.splice(Number(b.dataset.deleteHistory),1);historyOpenIndex=null;persist();render()}});const next=document.getElementById('next-workout');if(next)next.onchange=()=>{data.nextIndex=Number(next.value);persist();render()}}
function setNumber(el,key){const [i,j]=(el.dataset.weight||el.dataset.reps).split(':').map(Number),n=Number(el.value.replace?.(',','.')??el.value);if(!Number.isFinite(n)||n<0||(key==='reps'&&!Number.isInteger(n))){toast('Virhe: anna kelvollinen nollaa suurempi tai yhtä suuri luku.');return}data.active.exercises[i].sets[j][key]=n;persist()}
function action(a){if(a==='check-program'){checkProgram();return}else if(a==='apply-program'){applyPublishedProgram();return}else if(a==='check-update'){checkUpdates();return}else if(a==='apply-update'){applyUpdate();return}else if(a==='start'){createSession();activeExerciseOpen=null;render()}else if(a==='finish'){
  if(!data.active)return;
  const completed=data.active.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.done).length,0);
  if(!completed){toast('Kuittaa ensin ainakin yksi sarja.');return}
  const mobility=data.active.mobility||[];
  if(mobility.length&&!mobility.some(m=>m.done)){
    finishPromptQuote=pickFinishQuote();render();return;
  }
  if(!confirm(`Tallennetaanko treeni? Kirjattuja sarjoja ${completed}. Keskeneräiset sarjat jätetään pois progression laskennasta.`))return;
  saveFinishedWorkout();
}else if(a==='cancel-finish'){
  finishPromptQuote=null;render();
}else if(a==='confirm-finish'){
  if(!finishPromptQuote)return;
  saveFinishedWorkout();
}else if(a==='copy-feedback'||a==='send-feedback'){const type=document.getElementById('feedback-type')?.value||'Palaute';const body=document.getElementById('feedback-message')?.value.trim()||'';if(!body){toast('Kirjoita ensin palaute.');return}const payload=type+' – Salikaveri ABC v'+APP_VERSION+'\n\n'+body;if(a==='copy-feedback'){if(navigator.clipboard?.writeText){navigator.clipboard.writeText(payload).then(()=>toast('Palaute kopioitu.')).catch(()=>toast('Kopiointi epäonnistui.'))}else toast('Kopiointi ei ole käytettävissä tällä laitteella.')}else{const address=FEEDBACK_EMAIL;if(!address){toast('Palautteen sähköpostiosoitetta ei ole vielä määritetty. Voit kopioida palautteen.');return}location.href='mailto:'+address+'?subject='+encodeURIComponent(type+' – Salikaveri ABC')+'&body='+encodeURIComponent(payload)}}else if(a==='discard'){if(confirm('Hylätäänkö keskeneräinen treeni? Kaikki sen kirjaukset katoavat.')){data.active=null;persist();render()}}else if(a==='export-program')downloadJson(data.program,`salikaveri-ohjelma-${data.program.version}.json`);else if(a==='export-backup')downloadJson({backupFormat:'salikaveri-abc-v1',exportedAt:now(),data},`salikaveri-varmuuskopio-${new Date().toISOString().slice(0,10)}.json`);else if(a==='import-program'||a==='import-backup'){fileInput.value='';fileInput.dataset.mode=a;fileInput.click()}else if(a==='reset'){if(confirm('Poistetaanko KAIKKI treenit, ohjelma ja asetukset tältä laitteelta? Vie ensin varmuuskopio.')){if(confirm('Vahvista vielä kaikkien paikallisten tietojen poistaminen.')){localStorage.removeItem(KEY);location.reload()}}}}
document.addEventListener('keydown',event=>{
  if(!finishPromptQuote)return;
  if(event.key==='Escape'){event.preventDefault();finishPromptQuote=null;render();return}
  if(event.key==='Tab'){
    const buttons=[...document.querySelectorAll('.finish-dialog button')];
    if(!buttons.length)return;
    const index=buttons.indexOf(document.activeElement);
    if(event.shiftKey&&index<=0){event.preventDefault();buttons[buttons.length-1].focus()}
    else if(!event.shiftKey&&(index===buttons.length-1||index===-1)){event.preventDefault();buttons[0].focus()}
  }
});
fileInput.addEventListener('change',async()=>{const f=fileInput.files?.[0];if(!f)return;try{if(f.size>2_000_000)throw Error('Tiedosto on liian suuri (enintään 2 Mt).');const parsed=JSON.parse(await f.text());if(fileInput.dataset.mode==='import-program'){validateProgram(parsed);if(data.active)throw Error('Päätä tai hylkää käynnissä oleva treeni ennen ohjelman vaihtoa.');if(!confirm(`Otetaan käyttöön ohjelma "${parsed.name}" (${parsed.version||'ei versiota'})? Historia säilyy.`))return;const oldLetter=getWorkout();migrateWeights(parsed);data.program=parsed;publishedProgram=null;programStatus='';data.nextIndex=Math.max(0,parsed.rotation.indexOf(oldLetter));persist();toast('Uusi ohjelma otettu käyttöön. Vanha treenihistoria säilyi.')}else{if(parsed?.backupFormat!=='salikaveri-abc-v1'||!parsed.data||!Array.isArray(parsed.data.history)||!parsed.data.settings||!['strength','hypertrophy','explosive'].includes(parsed.data.settings.goal)||![45,60].includes(parsed.data.settings.duration)||!Number.isInteger(parsed.data.nextIndex)||parsed.data.nextIndex<0)throw Error('Varmuuskopion rakenne ei kelpaa.');validateProgram(parsed.data.program);if(!confirm('Korvataanko kaikki nykyiset tiedot tämän varmuuskopion sisällöllä?'))return;data=parsed.data;upgradeLocalData();persist();toast('Varmuuskopio palautettu.')}}catch(e){toast('Virhe: '+e.message)}});
function upgradeLocalData(){
  data.weights=data.weights&&typeof data.weights==='object'?data.weights:{};
  // Copy initial weights only once; existing personal values always win.
  for(const w of data.program.rotation)for(const ex of data.program.workouts[w]){
    if(!Number.isFinite(data.weights[ex.exerciseId])&&Number.isFinite(ex.startWeightKg)&&ex.startWeightKg>0)data.weights[ex.exerciseId]=ex.startWeightKg;
  }
  // Existing history is the authority for the latest actually used load.
  for(const session of data.history)for(const ex of session.exercises||[]){
    const completed=ex.sets?.find(set=>set.done);
    if(completed&&Number.isFinite(completed.weight)&&completed.weight>=0)data.weights[ex.exerciseId]=completed.weight;
  }
  if(data.settings.goal==='explosive'){data.settings.goal='strength';if(data.settings.explosiveEnabled===undefined)data.settings.explosiveEnabled=true;}if(!['strength','hypertrophy'].includes(data.settings.goal))data.settings.goal='hypertrophy';if(typeof data.settings.explosiveEnabled!=='boolean')data.settings.explosiveEnabled=false;
}
function migrateWeights(newProgram){
  data.weights=data.weights||{};
  for(const w of newProgram.rotation)for(const ex of newProgram.workouts[w]){
    if(!Number.isFinite(data.weights[ex.exerciseId])&&Number.isFinite(ex.startWeightKg)&&ex.startWeightKg>0)data.weights[ex.exerciseId]=ex.startWeightKg;
  }
}
function programDiffers(a,b){return a.programId!==b.programId||a.version!==b.version}
async function checkProgram(){
  try{
    const response=await fetch('./program.json?check='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const p=await response.json();validateProgram(p);publishedProgram=p;
    programStatus=programDiffers(p,data.program)?`Julkaistu: ${p.name} (v${p.version}). Nykyinen: v${data.program.version}.`:`Ohjelma on ajan tasalla (v${p.version}).`;
    render();
  }catch(e){programStatus='Tarkistus epäonnistui: '+e.message;render()}
}
function applyPublishedProgram(){
  if(!publishedProgram)return;
  if(data.active){toast('Päätä tai hylkää keskeneräinen treeni ennen ohjelmapäivitystä.');return}
  const p=publishedProgram;
  if(!confirm(`Otetaan käyttöön julkaistu ohjelma "${p.name}" (v${p.version})? Omat painot ja treenihistoria säilyvät.`))return;
  const oldLetter=getWorkout();migrateWeights(p);data.program=clone(p);
  data.nextIndex=Math.max(0,p.rotation.indexOf(oldLetter));publishedProgram=null;
  programStatus='Julkaistu ohjelma otettiin käyttöön. Omat painot säilyivät.';persist();render();
}
function showUpdateNotice(){
  updateWaiting=true;
  message='Uusi sovellusversio on saatavilla. Avaa Asetukset ja valitse Asenna päivitys. Treenitiedot säilyvät.';
  render();
}
async function checkUpdates(){
  if(!('serviceWorker' in navigator)||location.protocol!=='https:'){
    toast('Päivitysten tarkistus vaatii HTTPS-yhteyden ja service worker -tuen.');return;
  }
  try{
    swRegistration=swRegistration||await navigator.serviceWorker.getRegistration('./');
    if(!swRegistration){toast('Päivityspalvelu ei ole vielä valmis. Avaa sovellus uudelleen ja yritä hetken päästä.');return;}
    await swRegistration.update();
    if(swRegistration.waiting){showUpdateNotice();return;}
    message='Päivitykset tarkistettu. Jos uusi julkaisu on juuri tehty, kokeile uudelleen hetken kuluttua.';
    render();
  }catch(e){toast('Päivityksen tarkistus epäonnistui: '+e.message)}
}
function applyUpdate(){
  if(!swRegistration?.waiting){toast('Uutta päivitystä ei ole vielä valmiina.');return;}
  applyingUpdate=true;
  message='Päivitetään sovellusta…';render();
  swRegistration.waiting.postMessage({type:'SKIP_WAITING'});
}
function watchServiceWorker(reg){
  swRegistration=reg;
  if(reg.waiting&&navigator.serviceWorker.controller)showUpdateNotice();
  reg.addEventListener('updatefound',()=>{
    const worker=reg.installing;
    if(!worker)return;
    worker.addEventListener('statechange',()=>{
      if(worker.state==='installed'&&navigator.serviceWorker.controller&&reg.waiting)showUpdateNotice();
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(applyingUpdate){applyingUpdate=false;location.reload()}
  });
}
async function init(){load();if(!data){let p;try{const r=await fetch('./program.json');if(!r.ok)throw Error('Ohjelmaa ei löytynyt');p=await r.json();validateProgram(p)}catch(e){app.innerHTML='<div class="card error">Sovellus ei latautunut. Avaa se HTTPS-palvelimelta (ei suoraan file://-tiedostona) ja päivitä sivu. '+esc(e.message)+'</div>';return}data={program:p,history:[],active:null,nextIndex:0,weights:{},settings:{goal:'hypertrophy',duration:60}};upgradeLocalData();persist()}else{upgradeLocalData();persist()}render();if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(watchServiceWorker).catch(()=>{})}
init();
