import { jsPDF } from 'jspdf'
import './styles.css'
import { entrar, salir, haySesion, leerTodo, guardarDoc, borrarDoc, descargar } from './datos.js'


const DES=['Falta de sueño','Carga de trabajo','Disgustos','Turno de noche o guardia','Comida saltada','Alcohol','Menstruación','Cambio de tiempo'];
const AINES=['Ibuprofeno','Naproxeno','Dexketoprofeno','Diclofenaco','Ácido acetilsalicílico','Otro AINE'];
const TRIPTANES=['Sumatriptán','Zolmitriptán','Rizatriptán','Eletriptán','Almotriptán','Naratriptán','Frovatriptán'];
const ALARMAS=['Máximo en menos de 1 minuto','Debilidad o dificultad para hablar','Alteración visual nueva','Fiebre','Empeora con postura o esfuerzo'];
const ALIVIO=['Nada','Algo','Bastante','Del todo'];
const PAL={mel:['Melocotón y lavanda','#5A3E9B','#BF4A2B'],mar:['Mar en calma','#0B6B6B','#B4500F'],noche:['Noche suave','#BBA8FF','#FFB199']};
const TXT_ALARMA='Si fue brusco o hay síntomas neurológicos nuevos, llama al 112. En los demás casos, consulta pronto con tu médico.';
const LIM={trip:10,simple:15,total:10};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const ymd=d=>{d=new Date(d);return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())};
const parseYmd=s=>{const[a,b,c]=s.split('-').map(Number);return new Date(a,b-1,c)};
const addD=(s,n)=>{const d=parseYmd(s);d.setDate(d.getDate()+n);return ymd(d)};
const diffD=(a,b)=>Math.round((parseYmd(b)-parseYmd(a))/864e5);
const toLocal=d=>{d=new Date(d);return ymd(d)+'T'+p2(d.getHours())+':'+p2(d.getMinutes())};
const hora=d=>{d=new Date(d);return p2(d.getHours())+':'+p2(d.getMinutes())};
const MES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const SEM=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const fLarga=d=>{d=new Date(d);const s=SEM[d.getDay()];return s[0].toUpperCase()+s.slice(1)+', '+d.getDate()+' de '+MES[d.getMonth()]};
const fCorta=s=>{const d=parseYmd(s);return d.getDate()+' '+MES[d.getMonth()].slice(0,3)};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const ICO={ajustes:'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:22px"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
back:'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:24px"><path d="M15 5l-7 7 7 7"/></svg>',
hoy:'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/></svg>',
ta:'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
historial:'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
informe:'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14H7z"/><path d="M10 12h5M10 16h5"/></svg>'};

const AJ_DEF={pal:'mel',aine:'Ibuprofeno',triptan:'Sumatriptán',desenc:DES,semanaTA:null};
const S={screen:'hoy',ready:false,db:null,dl:true,lg:{email:'',pass:''},crisis:[],ta:[],dias:{},aj:{...AJ_DEF},d:null,f:null,t:null,toma:null,inf:30,mes:null,dia:null,barra:null,confirm:null,alarma:false,err:''};
try{const p=localStorage.getItem('pal');if(p&&PAL[p])S.aj.pal=p}catch(e){}
document.documentElement.dataset.pal=S.aj.pal;
const now0=new Date();S.mes=[now0.getFullYear(),now0.getMonth()];

/* ---------- cálculos ---------- */
const hoyS=()=>ymd(new Date());
const tomaDia=t=>ymd(t.hora);
const claseToma=t=>t.tipo==='triptan'?'trip':(t.tipo==='paracetamol'||t.tipo==='aine')?'simple':'otro';
function porDia(){const m={};for(const c of S.crisis){const a=ymd(c.inicio),b=ymd(c.fin||(new Date()));for(let d=a,i=0;d<=b&&i<60;d=addD(d,1),i++){(m[d]=m[d]||{max:0,crisis:[]});m[d].max=Math.max(m[d].max,c.intensidad||0);m[d].crisis.push(c)}}return m}
function medPorDia(){const m={};for(const c of S.crisis)for(const t of c.tomas||[]){const d=tomaDia(t);(m[d]=m[d]||[]).push(t)}return m}
function ventana(n,fin){fin=fin||hoyS();const r=[];for(let i=n-1;i>=0;i--)r.push(addD(fin,-i));return r}
function contadores(n){const dias=ventana(n),m=medPorDia();let trip=0,simple=0,total=0;for(const d of dias){const t=m[d];if(!t)continue;total++;if(t.some(x=>claseToma(x)==='trip'))trip++;if(t.some(x=>claseToma(x)==='simple'))simple++}return{trip,simple,total}}
const crisisAbierta=()=>S.crisis.filter(c=>!c.fin).sort((a,b)=>b.inicio.localeCompare(a.inicio))[0]||null;
const mediaLect=docs=>{const l=docs.flatMap(d=>d.lecturas||[]).filter(x=>x.s&&x.d);if(!l.length)return null;return[Math.round(l.reduce((a,x)=>a+x.s,0)/l.length),Math.round(l.reduce((a,x)=>a+x.d,0)/l.length)]};
const protoDe=ini=>S.ta.filter(x=>x.tipo==='protocolo'&&x.semana===ini);
function mediaSemana(ini){return mediaLect(protoDe(ini).filter(x=>x.fechaDia!==ini))}
function semanas(){return[...new Set(S.ta.filter(x=>x.tipo==='protocolo').map(x=>x.semana))].sort()}
const nombreToma=t=>t.nombre||({paracetamol:'Paracetamol'}[t.tipo])||'Otro';
const durTxt=c=>{if(!c.fin)return'en curso';const m=Math.round((new Date(c.fin)-new Date(c.inicio))/6e4);if(m<60)return m+' min';const h=Math.round(m/6)/10;return String(h).replace('.',',')+' h'};
const col=p=>!p?['var(--s0)','var(--t0)']:p<=3?['var(--s1)','var(--t1)']:p<=6?['var(--s2)','var(--t2)']:['var(--s3)','var(--t3)'];

/* ---------- datos ---------- */
const fail=e=>{console.error(e);toast(e&&e.status===401?'Tu sesión ha caducado. Vuelve a entrar.':'No se ha podido guardar. Inténtalo de nuevo.')};
async function put(path,data){const[c,id]=path.split('/');try{await guardarDoc(c,id,data);return true}catch(e){fail(e);return false}}
async function del(path){const[c,id]=path.split('/');try{await borrarDoc(c,id);return true}catch(e){fail(e);return false}}
const sinId=o=>{const{id,...r}=o;return r};
function setPal(p){S.aj.pal=p;document.documentElement.dataset.pal=p;try{localStorage.setItem('pal',p)}catch(e){}}
async function saveAj(){return put('ajustes/app',S.aj)}
function toast(t){const e=$('toast');e.textContent=t;e.hidden=false;clearTimeout(e._t);e._t=setTimeout(()=>e.hidden=true,2600)}

/* ---------- fragmentos ---------- */
const chips=(obj,key,opts,multi)=>`<div class="chips">${opts.map(o=>{const on=multi?(S[obj][key]||[]).includes(o):S[obj][key]===o;return`<button type="button" class="chip" aria-pressed="${on}" data-a="chip" data-o="${obj}" data-k="${key}" data-v="${esc(o)}" data-m="${multi?1:0}">${esc(o)}</button>`}).join('')}</div>`;
const sel=(obj,key,opts,id)=>`<select class="inp" id="${id}" data-o="${obj}" data-k="${key}" data-inp="1">${opts.map(o=>`<option${S[obj][key]===o?' selected':''}>${esc(o)}</option>`).join('')}</select>`;
const inp=(obj,key,type,id,extra='')=>`<input class="inp" id="${id}" type="${type}" data-o="${obj}" data-k="${key}" data-inp="1" value="${esc(S[obj][key]??'')}" ${extra}>`;
const back=a=>`<button type="button" class="icon back" aria-label="Volver" data-a="${a||'go'}" data-v="hoy">${ICO.back}</button>`;
const nums=(obj,key)=>`<div class="nums">${[0,1,2,3,4,5,6,7,8,9,10].map(n=>`<button type="button" class="num" aria-pressed="${S[obj][key]===n}" aria-label="Intensidad ${n}" data-a="num" data-o="${obj}" data-k="${key}" data-v="${n}">${n}</button>`).join('')}</div>`;
const intTxt=n=>n==null?'':n===0?'Sin dolor':n<=3?'Leve':n<=6?'Moderado':'Intenso';
const bpInputs=(obj,g,pre)=>`<div class="g3">${[['s','Sistólica'],['d','Diastólica'],['p','Pulso']].map(([k,l])=>`<label class="f">${l}<input class="inp bp" id="${pre}${k}" type="number" inputmode="numeric" data-o="${obj}" data-g="${g}" data-k="${k}" data-inp="1" value="${esc(S[obj][g][k]??'')}"></label>`).join('')}</div>`;
const medSelector=(obj)=>{const o=S[obj];const m=o.meds||[];return`${m.includes('AINE')?`<label class="f">¿Qué AINE?${sel(obj,'aine',AINES,obj+'Aine')}</label>`:''}${m.includes('Triptán')?`<label class="f">¿Qué triptán?${sel(obj,'triptan',TRIPTANES,obj+'Trip')}</label>`:''}${m.includes('Otros')?`<label class="f">¿Cuál?${inp(obj,'otro','text',obj+'Otro','placeholder="Escribe el nombre"')}</label>`:''}`};
function tomasDe(o,hora){const r=[];for(const x of o.meds||[]){if(x==='Paracetamol')r.push({tipo:'paracetamol',nombre:'Paracetamol',hora,alivio:''});if(x==='AINE')r.push({tipo:'aine',nombre:o.aine,hora,alivio:''});if(x==='Triptán')r.push({tipo:'triptan',nombre:o.triptan,hora,alivio:''});if(x==='Otros')r.push({tipo:'otro',nombre:(o.otro||'').trim()||'Otro',hora,alivio:''})}return r}

/* ---------- pantallas ---------- */
function vHoy(){
 const d=new Date(),h=hoyS(),pd=porDia(),abierta=crisisAbierta(),c=contadores(30);
 const pend=S.crisis.filter(x=>x.fin&&!x.detalle&&diffD(ymd(x.fin),h)<=7).sort((a,b)=>b.inicio.localeCompare(a.inicio))[0];
 const ini=S.aj.semanaTA,n=ini?diffD(ini,h)+1:0,activa=ini&&n>=1&&n<=7;
 let taTxt='Sin semana en marcha';
 if(activa){const x=protoDe(ini).filter(t=>t.fechaDia===h);taTxt=['manana','noche'].map(f=>(f==='manana'?'Mañana ':'Noche ')+(x.some(t=>t.franja===f)?'hecha':'pendiente')).join(' · ')}
 const dias=ventana(7).map(s=>{const hoyD=s===h,p=pd[s],sd=S.dias[s];const[bg,fg]=p?col(p.max):sd?col(0):['transparent','var(--muted)'];const v=p?p.max:sd?'–':'';return`<div class="dayc">${'DLMXJVS'[parseYmd(s).getDay()]}<span class="dot" style="background:${bg};color:${fg};border-color:${hoyD?'var(--primary)':p||sd?'transparent':'var(--line)'}">${v}</span></div>`}).join('');
 const cnt=[['Triptanes',c.trip,LIM.trip],['Paracetamol y AINEs',c.simple,LIM.simple],['Cualquier medicación',c.total,LIM.total]].map(([l,v,m])=>`<div><div class="li"><span>${l}</span><span>${v} de ${m}</span></div><div class="bar"><i style="width:${Math.min(100,v/m*100)}%"></i></div></div>`).join('');
 return`<div class="row"><div><p class="sub">${fLarga(d)}</p><h1>¿Qué tal hoy?</h1></div><button type="button" class="icon" aria-label="Ajustes" data-a="go" data-v="ajustes">${ICO.ajustes}</button></div>
 ${abierta?`<div class="card" style="background:var(--soft);color:var(--soft-ink);border-color:var(--soft)"><div class="row"><div><p style="font-weight:800;font-size:18px">Crisis en curso</p><p style="font-size:15px;font-weight:600">Desde las ${hora(abierta.inicio)}${ymd(abierta.inicio)!==h?' del '+fCorta(ymd(abierta.inicio)):''} · intensidad ${abierta.intensidad}</p></div></div>
 ${(abierta.tomas||[]).length?`<div>${abierta.tomas.map(t=>`<div class="li"><span>${esc(nombreToma(t))}</span><span>${hora(t.hora)}</span></div>`).join('')}</div>`:''}
 <button type="button" class="btn" data-a="nuevaToma" data-v="${abierta.id}">Tomé otra cosa</button>
 <div class="g3" style="grid-template-columns:repeat(2,minmax(0,1fr))"><button type="button" class="btn2" data-a="taDolor">Anotar TA</button><button type="button" class="btn2" data-a="cerrar" data-v="${abierta.id}">Ya ha pasado</button></div></div>`
 :`<button type="button" class="hero" data-a="nuevaCrisis"><b>Tengo dolor</b><span>Anótalo en unos segundos</span></button>
 ${pd[h]?'':`<button type="button" class="btn2" aria-pressed="${!!S.dias[h]}" data-a="sinDolor" style="min-height:56px;${S.dias[h]?'background:var(--soft);color:var(--soft-ink);border-color:var(--soft)':''}">${S.dias[h]?'Día sin dolor anotado':'Hoy sin dolor'}</button>`}`}
 ${pend?`<button type="button" class="btn2" data-a="editar" data-v="${pend.id}" style="text-align:left;padding:12px 16px;background:var(--soft);color:var(--soft-ink);border-color:var(--soft)">Falta el detalle de la crisis del ${fCorta(ymd(pend.inicio))}</button>`:''}
 <div class="card"><div class="row"><div><p style="font-weight:800">${activa?`Semana de TA: día ${n} de 7`:'Tensión arterial'}</p><p class="sub">${taTxt}</p></div><button type="button" class="btn3" data-a="go" data-v="ta">Anotar</button></div></div>
 <div class="card"><p style="font-weight:800">Días con medicación (30 días)</p>${cnt}<p class="small">Es un recuento, no un diagnóstico. Si llegas al límite, coméntalo con tu médico.</p></div>
 <div><h2>Última semana</h2><div class="week">${dias}</div></div>`}

function vCrisis(){const o=S.d;return`<div class="head">${back()}<h1>Anotar crisis</h1></div>
 <div><h2>¿Cuándo empezó?</h2>${chips('d','cuando',['Ahora','Hace 1 h','Hace 3 h','Otra hora'],false)}${o.cuando==='Otra hora'?`<label class="f" style="margin-top:10px">Fecha y hora${inp('d','otra','datetime-local','dOtra')}</label>`:''}</div>
 <div><div class="row"><h2>¿Cuánto duele?</h2><span class="sub">${intTxt(o.intensidad)}</span></div>${nums('d','intensidad')}</div>
 <div class="stack"><div><h2>¿Has tomado algo?</h2>${chipsMed('d')}</div>${medSelector('d')}</div>
 ${S.err?`<p class="alert" role="alert">${esc(S.err)}</p>`:''}
 <button type="button" class="btn" data-a="guardarCrisis">Guardar</button>
 <button type="button" class="link" data-a="alarma">¿Es distinto a lo habitual?</button>
 ${S.alarma?`<div class="alert"><b>Señales de alarma</b>Dolor máximo en menos de un minuto, debilidad, dificultad para hablar, alteración visual nueva, fiebre, o empeoramiento al cambiar de postura o hacer esfuerzo.<br><strong>${TXT_ALARMA}</strong></div>`:''}`}
function chipsMed(obj){const m=S[obj].meds||[];return`<div class="chips">${['Nada','Paracetamol','AINE','Triptán','Otros'].map(o=>`<button type="button" class="chip" aria-pressed="${m.includes(o)}" data-a="chipMed" data-o="${obj}" data-v="${o}">${o}</button>`).join('')}</div>`}

function vToma(){const o=S.toma;return`<div class="head">${back(o.volver==='detalle'?'volverDetalle':'go')}<h1>Otra toma</h1></div>
 <div class="stack"><div><h2>¿Qué has tomado?</h2>${chipsTomaUna()}</div>${medSelector('toma')}<label class="f">Hora${inp('toma','hora','datetime-local','tomaHora')}</label></div>
 ${S.err?`<p class="alert" role="alert">${esc(S.err)}</p>`:''}<button type="button" class="btn" data-a="guardarToma">Guardar</button>`}
function chipsTomaUna(){const m=S.toma.meds||[];return`<div class="chips">${['Paracetamol','AINE','Triptán','Otros'].map(o=>`<button type="button" class="chip" aria-pressed="${m.includes(o)}" data-a="chipToma" data-v="${o}">${o}</button>`).join('')}</div>`}

function vDetalle(){const f=S.f;const tomas=f.tomas||[];
 const g=(t,k,o,m)=>`<div><h2>${t}</h2>${chips('f',k,o,m)}</div>`;
 return`<div><div class="head">${back()}<h1>Detalle de la crisis</h1></div><p class="sub">Rellena solo lo que recuerdes.</p></div>
 <label class="f">Inicio${inp('f','inicioL','datetime-local','fIni')}</label>
 <label class="f">Fin${inp('f','finL','datetime-local','fFin')}</label>
 <div><div class="row"><h2>Intensidad máxima</h2><span class="sub">${intTxt(f.intensidad)}</span></div>${nums('f','intensidad')}</div>
 <div class="card"><h2 style="margin:0">Medicación</h2>${tomas.length?tomas.map((t,i)=>`<div class="stack ${i?'sep':''}"><div class="row"><span style="font-weight:800">${esc(nombreToma(t))}</span><button type="button" class="link" data-a="quitarToma" data-v="${i}" aria-label="Quitar ${esc(nombreToma(t))}">Quitar</button></div><label class="f">Hora<input class="inp" id="tH${i}" type="datetime-local" data-toma="${i}" data-inp="1" value="${toLocal(t.hora)}"></label><div><p class="small" style="font-weight:700;margin-bottom:6px">¿Te alivió?</p><div class="chips">${ALIVIO.map(a=>`<button type="button" class="chip" aria-pressed="${t.alivio===a}" data-a="alivio" data-i="${i}" data-v="${a}">${a}</button>`).join('')}</div></div></div>`).join(''):'<p class="small">Sin medicación anotada.</p>'}
 <button type="button" class="btn2" data-a="nuevaToma" data-v="${f.id}" data-volver="detalle">Añadir toma</button></div>
 ${g('¿Dónde dolía?','donde',['Lado derecho','Lado izquierdo','Ambos lados','Frente','Detrás del ojo','Nuca'],true)}
 ${g('¿Cómo era?','como',['Latido','Presión','Punzante','Otro'],true)}
 ${g('¿Qué más notaste?','sintomas',['Náuseas o vómitos','Molestia con la luz','Molestia con el ruido','Aura'],true)}
 ${g('¿Cuánto te limitó?','impacto',['Nada','Algo','Bastante','Tuve que parar'],false)}
 ${g('¿Volvió después?','recurrencia',['No','Sí'],false)}
 ${g('Antes de la crisis','desenc',[...new Set([...S.aj.desenc,...(f.desenc||[])])],true)}
 ${g('Señales de alarma','alarma',ALARMAS,true)}
 ${(f.alarma||[]).length?`<div class="alert" role="alert"><strong>${TXT_ALARMA}</strong></div>`:''}
 <label class="f">Notas<textarea class="inp" id="fNota" data-o="f" data-k="nota" data-inp="1">${esc(f.nota||'')}</textarea></label>
 ${S.err?`<p class="alert" role="alert">${esc(S.err)}</p>`:''}
 <button type="button" class="btn" data-a="guardarDetalle">Guardar</button>
 <button type="button" class="link" data-a="borrarCrisis" data-v="${f.id}">${S.confirm===f.id?'Pulsa otra vez para borrar la crisis':'Borrar crisis'}</button>`}

function pistaTA(ini){const h=hoyS();return`<div class="week">${[0,1,2,3,4,5,6].map(i=>{const s=addD(ini,i),x=protoDe(ini).filter(t=>t.fechaDia===s).length;const full=x>=2,parc=x===1;return`<div class="dayc"><span class="dot" style="background:${full?'var(--primary)':parc?'var(--soft)':'transparent'};color:${full?'var(--on-p)':'var(--ink)'};border-color:${s===h||full||parc?'var(--primary)':'var(--line)'}">${i+1}</span>${i===0?'no cuenta':s===h?'hoy':'&nbsp;'}</div>`}).join('')}</div>`}
function vTA(){const t=S.t,h=hoyS(),ini=S.aj.semanaTA,n=ini?diffD(ini,h)+1:0,activa=ini&&n>=1&&n<=7,fin=ini&&n>7;const med=ini?mediaSemana(ini):null;
 const seg=`<div class="seg"><button type="button" aria-pressed="${t.modo==='proto'}" data-a="modoTa" data-v="proto">Semana de TA</button><button type="button" aria-pressed="${t.modo==='dolor'}" data-a="modoTa" data-v="dolor">Con dolor</button></div>`;
 const brazo=`<div><h2>Brazo</h2>${chips('t','brazo',['Izquierdo','Derecho'],false)}</div>`;
 const err=S.err?`<p class="alert" role="alert">${esc(S.err)}</p>`:'';
 const alerta=`<div id="taAlert">${altaHtml()}</div>`;
 if(t.modo==='dolor'){const ab=crisisAbierta();return`<h1>Tensión arterial</h1>${seg}<p class="note">${ab?'Se guarda con la crisis en curso y no':'Esta toma no'} entra en la media semanal.</p>${bpInputs('t','ld','ld')}${alerta}<div><h2>¿Ya has tomado medicación?</h2>${chips('t','medPrev',['No','Sí'],false)}</div>${brazo}${err}<button type="button" class="btn" data-a="guardarTaDolor">Guardar</button>${listaTaDolor()}`}
 if(!activa)return`<h1>Tensión arterial</h1>${seg}${fin?`<div class="card"><h2 style="margin:0">Semana terminada</h2>${pistaTA(ini)}<p style="font-weight:800">Media: ${med?med.join('/')+' mmHg':'sin datos'}</p><p class="small">Sin el día 1. Referencia domiciliaria: 135/85 mmHg.</p></div>`:`<div class="card"><h2 style="margin:0">Semana de TA</h2><p>Dos lecturas por la mañana y dos por la noche, durante 7 días. El día 1 no cuenta para la media.</p></div>`}<button type="button" class="btn" data-a="empezarSemana">Empezar semana hoy</button>${historicoSemanas()}`;
 const yaHecha=protoDe(ini).find(x=>x.fechaDia===h&&x.franja===t.franja);
 return`<h1>Tensión arterial</h1>${seg}<div class="card">${pistaTA(ini)}<p style="font-weight:800">Media hasta ahora: ${med?med.join('/')+' mmHg':'aún sin datos'}</p><p class="small">Sin el día 1. Referencia domiciliaria: 135/85 mmHg.</p></div>
 <p class="sub">Tras 5 minutos sentada, antes de medicación, comida o ejercicio intenso.</p>
 <div class="seg"><button type="button" aria-pressed="${t.franja==='manana'}" data-a="franja" data-v="manana">Mañana</button><button type="button" aria-pressed="${t.franja==='noche'}" data-a="franja" data-v="noche">Noche</button></div>
 ${yaHecha?'<p class="note">Ya anotaste esta toma hoy. Si guardas, se sustituye.</p>':''}
 <div><h2>Lectura 1</h2>${bpInputs('t','l1','la')}</div><div><h2>Lectura 2</h2>${bpInputs('t','l2','lb')}</div>${alerta}${brazo}${err}
 <button type="button" class="btn" data-a="guardarTaProto">Guardar</button>
 <button type="button" class="link" data-a="terminarSemana">${S.confirm==='semana'?'Pulsa otra vez para terminar la semana':'Terminar semana'}</button>`}
function altaHtml(){const t=S.t;if(!t)return'';const g=t.modo==='dolor'?[t.ld]:[t.l1,t.l2];return g.some(x=>Number(x.s)>=180||Number(x.d)>=120)?`<div class="alert" role="alert"><b>TA muy elevada</b>Repite la toma tras 5 minutos de reposo. Si sigue así y tienes síntomas neurológicos, dolor torácico, dificultad para respirar o dolor muy intenso, llama al 112.</div>`:''}
function historicoSemanas(){const s=semanas().reverse();if(!s.length)return'';return`<div class="card"><h2 style="margin:0">Semanas anteriores</h2>${s.map(i=>{const m=mediaSemana(i);return`<div class="li"><span>Desde el ${fCorta(i)}</span><span>${m?m.join('/'):'–'}</span></div>`}).join('')}</div>`}
function listaTaDolor(){const l=S.ta.filter(x=>x.tipo==='dolor').sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,5);if(!l.length)return'';return`<div class="card"><h2 style="margin:0">Últimas tomas con dolor</h2>${l.map(x=>`<div class="li"><span>${fCorta(ymd(x.fecha))}, ${hora(x.fecha)}</span><span>${x.lecturas[0].s}/${x.lecturas[0].d}</span></div>`).join('')}</div>`}

function vHistorial(){const[y,m]=S.mes,pd=porDia(),md=medPorDia(),h=hoyS();const pri=new Date(y,m,1),hue=(pri.getDay()+6)%7,nd=new Date(y,m+1,0).getDate();let cells='';for(let i=0;i<hue;i++)cells+='<div></div>';
 for(let d=1;d<=nd;d++){const s=y+'-'+p2(m+1)+'-'+p2(d),p=pd[s],sd=S.dias[s];const[bg,fg]=p?col(p.max):sd?col(0):['transparent','var(--ink)'];const fut=s>h;cells+=`<button type="button" class="cell" ${fut?'disabled':''} aria-label="${d} de ${MES[m]}${p?': dolor '+p.max:sd?': sin dolor':''}${md[s]?', con medicación':''}" data-a="dia" data-v="${s}" style="background:${bg};color:${fut?'var(--muted)':fg};border-color:${S.dia===s?'var(--ink)':p||sd||fut?'transparent':'var(--line)'}">${d}${md[s]?'<i></i>':''}</button>`}
 let det='';const s=S.dia;if(s){const p=pd[s],tas=S.ta.filter(x=>(x.fechaDia||ymd(x.fecha))===s);det=`<div class="card"><p style="font-weight:800">${fLarga(parseYmd(s))}</p>${p?p.crisis.map(c=>`<div class="stack"><div class="row"><div style="min-width:0"><p style="font-weight:700">Dolor ${c.intensidad} · ${hora(c.inicio)} · ${durTxt(c)}</p><p class="small">${(c.tomas||[]).map(t=>esc(nombreToma(t))+' '+hora(t.hora)+(t.alivio?' ('+t.alivio.toLowerCase()+')':'')).join(', ')||'Sin medicación'}</p></div><button type="button" class="btn3" data-a="editar" data-v="${c.id}">Editar</button></div></div>`).join(''):`<p class="sub">${S.dias[s]?'Sin dolor.':'Sin anotar.'}</p>`}
 ${tas.map(x=>{const m=mediaLect([x]);return`<div class="row"><span style="font-weight:700">TA ${x.tipo==='dolor'?'con dolor':x.franja==='manana'?'mañana':'noche'}: ${m?m.join('/'):''}</span><button type="button" class="link" data-a="borrarTa" data-v="${x.id}">${S.confirm===x.id?'Confirmar':'Borrar'}</button></div>`}).join('')}
 ${!p?`<div class="g3" style="grid-template-columns:repeat(2,minmax(0,1fr))"><button type="button" class="btn2" data-a="crisisDia" data-v="${s}">Añadir crisis</button><button type="button" class="btn2" data-a="sinDolorDia" data-v="${s}">${S.dias[s]?'Quitar sin dolor':'Sin dolor'}</button></div>`:''}</div>`}
 return`<div class="row"><button type="button" class="icon" aria-label="Mes anterior" data-a="mes" data-v="-1">${ICO.back}</button><h1 style="font-size:26px;text-align:center">${MES[m][0].toUpperCase()+MES[m].slice(1)} ${y}</h1><button type="button" class="icon" aria-label="Mes siguiente" data-a="mes" data-v="1" style="transform:scaleX(-1)">${ICO.back}</button></div>
 <div class="cal">${['L','M','X','J','V','S','D'].map(x=>`<span>${x}</span>`).join('')}${cells}</div>
 <div class="legend"><span><i class="sw" style="background:var(--s0)"></i>Sin dolor</span><span><i class="sw" style="background:var(--s1)"></i>Leve</span><span><i class="sw" style="background:var(--s2)"></i>Moderado</span><span><i class="sw" style="background:var(--s3)"></i>Intenso</span><span><i style="width:8px;height:8px;border-radius:4px;background:var(--muted)"></i>Medicación</span></div>
 ${det||'<p class="sub">Toca un día para ver qué anotaste o añadir algo que se te pasó.</p>'}`}

function datosInforme(n){const dias=ventana(n),pd=porDia(),md=medPorDia(),rango=new Set(dias);
 const conDolor=dias.filter(d=>pd[d]),crisis=S.crisis.filter(c=>rango.has(ymd(c.inicio))).sort((a,b)=>a.inicio.localeCompare(b.inicio));
 const diasMed=dias.filter(d=>md[d]).length;
 const media=crisis.length?(crisis.reduce((a,c)=>a+(c.intensidad||0),0)/crisis.length).toFixed(1).replace('.',','):'–';
 const des={};crisis.forEach(c=>(c.desenc||[]).forEach(x=>des[x]=(des[x]||0)+1));
 const top=Object.entries(des).sort((a,b)=>b[1]-a[1]).slice(0,5);
 const meds={};crisis.forEach(c=>(c.tomas||[]).forEach(t=>{const k=nombreToma(t);(meds[k]=meds[k]||{n:0,bien:0,val:0,dias:new Set()});meds[k].n++;meds[k].dias.add(tomaDia(t));if(t.alivio){meds[k].val++;if(t.alivio==='Bastante'||t.alivio==='Del todo')meds[k].bien++}}));
 const escal=crisis.filter(c=>{const t=(c.tomas||[]).slice().sort((a,b)=>a.hora.localeCompare(b.hora));const iT=t.findIndex(x=>x.tipo==='triptan');return iT>0&&t.slice(0,iT).some(x=>claseToma(x)==='simple')}).length;
 const tas=S.ta.filter(x=>rango.has(x.fechaDia||ymd(x.fecha)));
 const proto=tas.filter(x=>x.tipo==='protocolo'&&x.fechaDia!==x.semana),dolor=tas.filter(x=>x.tipo==='dolor');
 return{dias,pd,md,conDolor,crisis,diasMed,media,top,meds,escal,tas,mProto:mediaLect(proto),mDolor:mediaLect(dolor)}}
function chartTA(r){const W=340,H=150,L=30,dias=r.dias,n=dias.length,idx={};dias.forEach((d,i)=>idx[d]=i);
 const vals=r.tas.flatMap(t=>(t.lecturas||[]).flatMap(x=>[x.s,x.d])).filter(Boolean);
 const lo=Math.min(60,...vals)-0,hi=Math.max(160,...vals)+5;const y=v=>H-6-(v-lo)/(hi-lo)*(H-14),x=i=>L+(i+.5)*(W-L)/n;const f=v=>Math.round(v*10)/10;
 const grid=[85,135].map(v=>`<line x1="${L}" x2="${W}" y1="${f(y(v))}" y2="${f(y(v))}" stroke="var(--line)" stroke-width="1"/><text x="0" y="${f(y(v))+4}" font-size="12" font-weight="700" fill="var(--muted)">${v}</text>`).join('');
 const sems={};r.tas.filter(t=>t.tipo==='protocolo').forEach(t=>{const w=sems[t.semana]=sems[t.semana]||{};(w[t.fechaDia]=w[t.fechaDia]||[]).push(t)});
 let lines='';for(const k in sems){const ds=Object.keys(sems[k]).sort();const pts=ds.map(d=>[idx[d],mediaLect(sems[k][d])]).filter(a=>a[1]);const pl=(j,c,dash)=>pts.length>1?`<polyline points="${pts.map(a=>f(x(a[0]))+','+f(y(a[1][j]))).join(' ')}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" ${dash?'stroke-dasharray="5 4"':''}/>`:pts.map(a=>`<circle cx="${f(x(a[0]))}" cy="${f(y(a[1][j]))}" r="3" fill="${c}"/>`).join('');lines+=pl(0,'var(--ca)')+pl(1,'var(--cb)',1)}
 const dots=r.tas.filter(t=>t.tipo==='dolor').map(t=>{const i=idx[ymd(t.fecha)],m=mediaLect([t]);return i==null||!m?'':`<circle cx="${f(x(i))}" cy="${f(y(m[0]))}" r="4" fill="var(--ca)" stroke="var(--card)" stroke-width="2"/><circle cx="${f(x(i))}" cy="${f(y(m[1]))}" r="4" fill="var(--cb)" stroke="var(--card)" stroke-width="2"/>`}).join('');
 return`<svg role="img" aria-label="Tensión arterial sistólica y diastólica en el periodo" viewBox="0 0 ${W} ${H}">${grid}${lines}${dots}</svg>`}
function chartDolor(r){const W=340,H=92,L=30,base=72,n=r.dias.length,bw=(W-L)/n,f=v=>Math.round(v*10)/10;let s='';r.dias.forEach((d,i)=>{const p=r.pd[d],x=L+i*bw,h=p?Math.max(3,p.max*6.8):0,t=(r.md[d]||[]);if(h)s+=`<rect x="${f(x+.8)}" y="${f(base-h)}" width="${f(Math.max(1.5,bw-1.6))}" height="${f(h)}" rx="${bw>6?3:1}" fill="${S.barra===d?'var(--accent)':'var(--primary)'}"/>`;if(t.some(a=>a.tipo==='aine')){const cx=x+bw/2;s+=`<path d="M${f(cx)} ${base+4}l3.5 3.5l-3.5 3.5l-3.5 -3.5z" fill="var(--cb)"/>`}if(t.some(a=>a.tipo==='triptan')){const cx=x+bw/2;s+=`<circle cx="${f(cx)}" cy="${base+15}" r="2.8" fill="var(--ink)"/>`}s+=`<rect x="${f(x)}" y="0" width="${f(bw)}" height="${H}" fill="transparent" data-a="barra" data-v="${d}" style="cursor:pointer"/>`});
 return`<svg role="img" aria-label="Intensidad del dolor por día" viewBox="0 0 ${W} ${H}"><line x1="${L}" x2="${W}" y1="${base}" y2="${base}" stroke="var(--line)"/><text x="0" y="12" font-size="12" font-weight="700" fill="var(--muted)">10</text><text x="0" y="${base}" font-size="12" font-weight="700" fill="var(--muted)">0</text>${s}</svg>`}
function vInforme(){const r=datosInforme(S.inf);const a=r.dias[0],b=r.dias[r.dias.length-1];
 const bt=S.barra&&r.dias.includes(S.barra)?S.barra:null;let txt='Toca un día del gráfico para ver el detalle.';if(bt){const p=r.pd[bt],t=(r.md[bt]||[]).map(nombreToma),tt=r.tas.filter(x=>(x.fechaDia||ymd(x.fecha))===bt),m=mediaLect(tt);txt=fCorta(bt)+': '+(p?'dolor '+p.max:'sin dolor')+(t.length?', '+[...new Set(t)].join(', '):'')+(m?', TA '+m.join('/'):'')}
 const vacio=!r.conDolor.length&&!r.tas.length;
 return`<div><h1>Informe para consulta</h1><p class="sub">${fCorta(a)} – ${fCorta(b)}</p></div>
 <div class="seg"><button type="button" aria-pressed="${S.inf===30}" data-a="inf" data-v="30">30 días</button><button type="button" aria-pressed="${S.inf===90}" data-a="inf" data-v="90">90 días</button></div>
 <div class="tiles"><div class="tile"><b>${r.conDolor.length}</b><span>días con cefalea</span></div><div class="tile"><b>${r.diasMed}</b><span>días con medicación</span></div><div class="tile"><b>${r.mProto?r.mProto.join('/'):'–'}</b><span>media de TA en casa</span></div></div>
 ${vacio?`<div class="card empty">Cuando anotes crisis o tensión arterial, aquí verás los gráficos.</div>`:`<div class="card"><h2 style="margin:0">Tensión arterial (mmHg)</h2>${chartTA(r)}<div class="legend" style="font-size:13px"><span><i style="width:18px;height:2px;background:var(--ca)"></i>Sistólica</span><span><i style="width:18px;border-top:2px dashed var(--cb)"></i>Diastólica</span><span><i style="width:8px;height:8px;border-radius:4px;background:var(--muted)"></i>Toma con dolor</span></div>
 <h2 style="margin:6px 0 0">Intensidad del dolor (0–10)</h2>${chartDolor(r)}<div class="row small" style="padding-left:9%;font-weight:700"><span>${fCorta(a)}</span><span>${fCorta(b)}</span></div>
 <div class="legend" style="font-size:13px"><span><i style="width:8px;height:8px;transform:rotate(45deg);background:var(--cb)"></i>AINE</span><span><i style="width:7px;height:7px;border-radius:4px;background:var(--ink)"></i>Triptán</span></div>
 <p style="font-size:15px;font-weight:700">${esc(txt)}</p></div>`}
 ${Object.keys(r.meds).length?`<div class="card"><h2 style="margin:0">Medicación</h2>${Object.entries(r.meds).map(([k,v])=>`<div class="li"><span>${esc(k)}</span><span>${v.dias.size} ${v.dias.size===1?'día':'días'}${v.val?' · alivió '+v.bien+' de '+v.val:''}</span></div>`).join('')}${r.escal?`<p class="small">${r.escal} ${r.escal===1?'crisis pasó':'crisis pasaron'} de paracetamol o AINE a triptán.</p>`:''}</div>`:''}
 ${r.top.length?`<div class="card"><h2 style="margin:0">Más anotados antes de una crisis</h2>${r.top.map(([k,v])=>`<div class="li"><span>${esc(k)}</span><span>${v} ${v===1?'vez':'veces'}</span></div>`).join('')}<p class="small">Es lo que has anotado, no una causa demostrada.</p></div>`:''}
 ${S.dl?'<button type="button" class="btn" data-a="pdf">Crear PDF</button>':''}`}

function vAjustes(){return`<div class="head">${back()}<h1>Ajustes</h1></div>
 <div><h2>Colores</h2><div class="stack" style="gap:8px">${Object.entries(PAL).map(([k,v])=>`<button type="button" class="btn2" aria-pressed="${S.aj.pal===k}" data-a="pal" data-v="${k}" style="display:flex;align-items:center;gap:10px;min-height:56px;text-align:left;${S.aj.pal===k?'border:2px solid var(--primary)':''}"><span aria-hidden="true" style="display:flex;flex:none"><span style="width:22px;height:22px;border-radius:11px;background:${v[1]}"></span><span style="width:22px;height:22px;border-radius:11px;margin-left:-6px;background:${v[2]}"></span></span>${v[0]}</button>`).join('')}</div></div>
 <div class="card"><h2 style="margin:0">Mis medicamentos</h2><p class="small">Paracetamol y AINEs comparten el límite de 15 días. Triptanes: 10 días. Cualquier mezcla de medicación: 10 días.</p><label class="f">AINE habitual${sel('aj','aine',AINES,'ajAine')}</label><label class="f">Triptán habitual${sel('aj','triptan',TRIPTANES,'ajTrip')}</label></div>
 <div><h2>Mis desencadenantes</h2><div class="chips">${S.aj.desenc.map(x=>`<button type="button" class="chip" data-a="quitarDes" data-v="${esc(x)}" aria-label="Quitar ${esc(x)}">${esc(x)} ×</button>`).join('')}</div><div class="row" style="margin-top:10px"><input class="inp" id="nuevoDes" aria-label="Nuevo desencadenante" placeholder="Añadir otro"><button type="button" class="btn3" data-a="addDes">Añadir</button></div></div>
 ${S.dl?`<div class="card"><h2 style="margin:0">Copia de seguridad</h2><p class="small">Descarga todos tus registros en un archivo.</p><button type="button" class="btn2" data-a="copia">Descargar copia</button></div>`:''}
 <button type="button" class="link" data-a="salir">Cerrar sesión</button>`}

const VIEWS={hoy:vHoy,crisis:vCrisis,toma:vToma,detalle:vDetalle,ta:vTA,historial:vHistorial,informe:vInforme,ajustes:vAjustes};
function render(){if(!S.ready)return;
 if(S.db===null){$('nav').hidden=true;$('app').innerHTML=vLogin();return}
 const off=S.db?'':'<p class="alert" role="alert"><b>Sin conexión</b>No se han podido cargar tus datos. Comprueba tu conexión y vuelve a abrir la app.</p>';
 $('app').innerHTML=off+VIEWS[S.screen]();
 const nv=$('nav'),show=['hoy','ta','historial','informe'].includes(S.screen);nv.hidden=!show;
 if(show)nv.innerHTML='<div>'+[['hoy','Hoy'],['ta','TA'],['historial','Historial'],['informe','Informe']].map(([k,l])=>`<button type="button" data-a="go" data-v="${k}" ${S.screen===k?'aria-current="page"':''}>${ICO[k]}${l}</button>`).join('')+'</div>';
 document.title='Mi diario de cefaleas y TA'}
const enForm=()=>{const a=document.activeElement;return a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)};
function go(s){S.screen=s;S.err='';S.confirm=null;if(s==='ta'&&!S.t)S.t=nuevoT();window.scrollTo(0,0);render()}
function nuevoT(modo){const h=new Date().getHours();return{modo:modo||'proto',franja:h<15?'manana':'noche',l1:{},l2:{},ld:{},brazo:'Izquierdo',medPrev:'No'}}
const bpOk=x=>{const s=Number(x.s),d=Number(x.d);return s>=60&&s<=300&&d>=30&&d<=200&&s>d};
const lect=x=>({s:Number(x.s),d:Number(x.d),p:x.p?Number(x.p):null});

/* ---------- acciones ---------- */
const A={
 go:(v)=>go(v),
 nuevaCrisis(){S.d={cuando:'Ahora',otra:toLocal(new Date()),intensidad:null,meds:[],aine:S.aj.aine,triptan:S.aj.triptan,otro:''};S.alarma=false;go('crisis')},
 crisisDia(v){S.d={cuando:'Otra hora',otra:v+'T12:00',intensidad:null,meds:[],aine:S.aj.aine,triptan:S.aj.triptan,otro:''};S.alarma=false;go('crisis')},
 alarma(){S.alarma=!S.alarma;render()},
 num(v,el){S[el.dataset.o][el.dataset.k]=Number(v);render()},
 chip(v,el){const o=S[el.dataset.o],k=el.dataset.k;if(el.dataset.m==='1'){const c=o[k]||[];o[k]=c.includes(v)?c.filter(x=>x!==v):[...c,v]}else o[k]=o[k]===v&&el.dataset.o!=='d'&&el.dataset.o!=='t'?'':v;render()},
 chipMed(v,el){const o=S[el.dataset.o],c=o.meds||[];o.meds=c.includes(v)?c.filter(x=>x!==v):v==='Nada'?['Nada']:[...c.filter(x=>x!=='Nada'),v];render()},
 chipToma(v){S.toma.meds=[v];render()},
 async guardarCrisis(){const o=S.d;if(o.intensidad==null){S.err='Elige la intensidad para guardar.';render();return}
  const n=new Date();const ini=o.cuando==='Ahora'?n:o.cuando==='Hace 1 h'?new Date(n-36e5):o.cuando==='Hace 3 h'?new Date(n-108e5):new Date(o.otra);
  if(isNaN(ini)||ini>new Date(+n+6e4)){S.err='Revisa la fecha y la hora: no pueden ser futuras.';render();return}
  const id=uid(),c={inicio:ini.toISOString(),fin:null,intensidad:o.intensidad,tomas:tomasDe(o,ini.toISOString()),detalle:false};
  const pasada=o.cuando==='Otra hora'&&(n-ini)>864e5;if(pasada)c.fin=new Date(+ini+36e5).toISOString();
  if(await put('crisis/'+id,c)){const h=ymd(ini);if(S.dias[h])await del('dias/'+h);S.crisis=[...S.crisis.filter(x=>x.id!==id),{id,...c}];if(pasada){abrirDetalle(id)}else{toast('Crisis guardada');go('hoy')}}},
 nuevaToma(v,el){S.toma={crisis:v,meds:[],aine:S.aj.aine,triptan:S.aj.triptan,otro:'',hora:toLocal(new Date()),volver:el.dataset.volver||'hoy'};S.toma.hora0=S.toma.hora;go('toma')},
 volverDetalle(){go('detalle')},
 async guardarToma(){const o=S.toma;if(!(o.meds||[]).length){S.err='Elige qué has tomado.';render();return}const h=o.hora===o.hora0?new Date():new Date(o.hora);if(isNaN(h)){S.err='Revisa la hora.';render();return}
  const base=S.f&&S.f.id===o.crisis?S.f:S.crisis.find(x=>x.id===o.crisis);if(!base)return go('hoy');const tomas=[...(base.tomas||[]),...tomasDe(o,h.toISOString())].sort((a,b)=>a.hora.localeCompare(b.hora));
  const reg=S.crisis.find(x=>x.id===o.crisis);if(await put('crisis/'+o.crisis,sinId({...reg,tomas}))){reg.tomas=tomas;if(S.f&&S.f.id===o.crisis)S.f.tomas=tomas;toast('Toma guardada');go(o.volver==='detalle'?'detalle':'hoy')}},
 taDolor(){S.t=nuevoT('dolor');go('ta')},
 async cerrar(v){const c=S.crisis.find(x=>x.id===v);if(!c)return;const fin=new Date().toISOString();if(await put('crisis/'+v,sinId({...c,fin}))){c.fin=fin;abrirDetalle(v)}},
 editar(v){abrirDetalle(v)},
 alivio(v,el){const t=S.f.tomas[Number(el.dataset.i)];t.alivio=t.alivio===v?'':v;render()},
 quitarToma(v){S.f.tomas=S.f.tomas.filter((_,i)=>i!==Number(v));render()},
 async guardarDetalle(){const f=S.f,ini=new Date(f.inicioL),fin=f.finL?new Date(f.finL):null;if(isNaN(ini)){S.err='Revisa la hora de inicio.';render();return}if(fin&&fin<ini){S.err='El fin no puede ser anterior al inicio.';render();return}
  const{id,inicioL,finL,...r}=f;const c={...r,inicio:ini.toISOString(),fin:fin?fin.toISOString():null,detalle:true};if(await put('crisis/'+id,c)){S.crisis=S.crisis.map(x=>x.id===id?{id,...c}:x);S.f=null;toast('Detalle guardado');go('hoy')}},
 async borrarCrisis(v){if(S.confirm!==v){S.confirm=v;render();return}if(await del('crisis/'+v)){S.crisis=S.crisis.filter(x=>x.id!==v);S.ta.filter(t=>t.crisisId===v).forEach(t=>del('ta/'+t.id));S.ta=S.ta.filter(t=>t.crisisId!==v);S.f=null;toast('Crisis borrada');go('hoy')}},
 async borrarTa(v){if(S.confirm!==v){S.confirm=v;render();return}if(await del('ta/'+v)){S.ta=S.ta.filter(x=>x.id!==v);S.confirm=null;render()}},
 modoTa(v){S.t.modo=v;S.err='';render()},franja(v){S.t.franja=v;S.t.l1={};S.t.l2={};S.err='';render()},
 async empezarSemana(){S.aj.semanaTA=hoyS();if(await saveAj())render()},
 async terminarSemana(){if(S.confirm!=='semana'){S.confirm='semana';render();return}S.aj.semanaTA=null;S.confirm=null;if(await saveAj())render()},
 async guardarTaProto(){const t=S.t,ls=[t.l1,t.l2].filter(x=>x.s||x.d);if(!ls.length||!ls.every(bpOk)){S.err='Revisa las cifras: la sistólica debe ser mayor que la diastólica.';render();return}
  const dia=hoyS(),id=dia+'-'+t.franja,doc={tipo:'protocolo',semana:S.aj.semanaTA,fecha:new Date().toISOString(),fechaDia:dia,franja:t.franja,lecturas:ls.map(lect),brazo:t.brazo};
  if(await put('ta/'+id,doc)){S.ta=[...S.ta.filter(x=>x.id!==id),{id,...doc}];const m=t.modo;S.t=nuevoT(m);toast('TA guardada');go('hoy')}},
 async guardarTaDolor(){const t=S.t;if(!bpOk(t.ld)){S.err='Revisa las cifras: la sistólica debe ser mayor que la diastólica.';render();return}const ab=crisisAbierta(),id=uid(),f=new Date().toISOString(),doc={tipo:'dolor',fecha:f,fechaDia:ymd(f),lecturas:[lect(t.ld)],brazo:t.brazo,medPrev:t.medPrev==='Sí',crisisId:ab?ab.id:null};
  if(await put('ta/'+id,doc)){S.ta=[...S.ta,{id,...doc}];S.t=nuevoT('proto');toast('TA guardada');go('hoy')}},
 async sinDolor(){const h=hoyS();if(S.dias[h]){if(await del('dias/'+h))delete S.dias[h]}else if(await put('dias/'+h,{sinDolor:true}))S.dias[h]={sinDolor:true};render()},
 async sinDolorDia(v){if(S.dias[v]){if(await del('dias/'+v))delete S.dias[v]}else if(await put('dias/'+v,{sinDolor:true}))S.dias[v]={sinDolor:true};render()},
 dia(v){S.dia=v;S.confirm=null;render()},
 mes(v){let[y,m]=S.mes;m+=Number(v);if(m<0){m=11;y--}if(m>11){m=0;y++}S.mes=[y,m];S.dia=null;render()},
 inf(v){S.inf=Number(v);S.barra=null;render()},barra(v){S.barra=v;render()},
 async pal(v){setPal(v);render();await saveAj()},
 async addDes(){const e=$('nuevoDes'),t=(e.value||'').trim();if(!t||S.aj.desenc.includes(t))return;S.aj.desenc=[...S.aj.desenc,t];if(await saveAj())render()},
 async quitarDes(v){S.aj.desenc=S.aj.desenc.filter(x=>x!==v);if(await saveAj())render()},
 async copia(){try{descargar('diario-cefaleas-'+hoyS()+'.json',JSON.stringify({crisis:S.crisis,ta:S.ta,dias:S.dias,ajustes:S.aj},null,2),'application/json');toast('Copia descargada')}catch(e){toast('No se ha podido descargar la copia.')}},
 async pdf(){try{descargar('informe-cefaleas-'+hoyS()+'.pdf',crearPDF(),'application/pdf');toast('PDF creado')}catch(e){console.error(e);toast('No se ha podido crear el PDF.')}}
};
function abrirDetalle(id){const c=S.crisis.find(x=>x.id===id);if(!c)return;S.f=JSON.parse(JSON.stringify({donde:[],como:[],sintomas:[],desenc:[],alarma:[],impacto:'',recurrencia:'',nota:'',...c}));S.f.inicioL=toLocal(c.inicio);S.f.finL=c.fin?toLocal(c.fin):'';go('detalle')}
document.addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(!el||el.disabled)return;const f=A[el.dataset.a];if(f)f(el.dataset.v,el)});
function onInp(e){const el=e.target;if(!el.dataset||!el.dataset.inp)return;
 if(el.dataset.toma!=null){const d=new Date(el.value);if(!isNaN(d))S.f.tomas[Number(el.dataset.toma)].hora=d.toISOString();return}
 const o=S[el.dataset.o],g=el.dataset.g;if(g)o[g][el.dataset.k]=el.value;else o[el.dataset.k]=el.value;
 if(g){const a=$('taAlert');if(a)a.innerHTML=altaHtml()}
 if(el.dataset.o==='aj'&&e.type==='change')saveAj()}
document.addEventListener('input',onInp);document.addEventListener('change',onInp);

/* ---------- PDF ---------- */
function crearPDF(){const r=datosInforme(S.inf);const d=new jsPDF({unit:'mm',format:'a4'});let y=18;const W=210,M=16,ink=[44,35,64],mut=[101,91,116],pri=[90,62,155],acc=[191,74,43];
 const sal=n=>{if(y+n>282){d.addPage();y=18}};const T=(t,s,b,c)=>{d.setFont('helvetica',b?'bold':'normal');d.setFontSize(s);d.setTextColor(...(c||ink));d.text(t,M,y)};
 T('Diario de cefaleas y TA',18,1);y+=7;T(fCorta(r.dias[0])+' - '+fCorta(r.dias[r.dias.length-1])+' ('+S.inf+' dias)',11,0,mut);y+=10;
 const lin=(a,b)=>{sal(6);T(a,11,0);d.setFont('helvetica','bold');d.text(String(b),W-M,y,{align:'right'});y+=6};
 T('Resumen',13,1);y+=7;lin('Dias con cefalea',r.conDolor.length);lin('Crisis',r.crisis.length);lin('Intensidad media',r.media);const c=contadores(S.inf);lin('Dias con triptan',c.trip);lin('Dias con paracetamol o AINE',c.simple);lin('Dias con cualquier medicacion',c.total);if(r.escal)lin('Crisis que pasaron de paracetamol/AINE a triptan',r.escal);lin('Media de TA en casa (sin el dia 1 de cada semana)',r.mProto?r.mProto.join('/')+' mmHg':'-');lin('Media de TA con dolor',r.mDolor?r.mDolor.join('/')+' mmHg':'-');y+=5;
 const n=r.dias.length,pw=W-2*M,sx=i=>M+(i+.5)*pw/n,idx={};r.dias.forEach((x,i)=>idx[x]=i);
 sal(46);T('Tension arterial (mmHg)',12,1);y+=4;const top=y,h=34,vals=r.tas.flatMap(t=>t.lecturas.flatMap(x=>[x.s,x.d])),lo=Math.min(60,...vals),hi=Math.max(160,...vals)+5,sy=v=>top+h-(v-lo)/(hi-lo)*h;
 d.setDrawColor(220,214,226);d.setLineWidth(.2);[85,135].forEach(v=>{d.line(M,sy(v),W-M,sy(v));d.setFontSize(7);d.setFont('helvetica','normal');d.setTextColor(...mut);d.text(String(v),M,sy(v)-.8)});
 r.tas.forEach(t=>{const i=idx[t.fechaDia||ymd(t.fecha)],m=mediaLect([t]);if(i==null||!m)return;d.setFillColor(...pri);d.circle(sx(i),sy(m[0]),t.tipo==='dolor'?1:.6,'F');d.setFillColor(...acc);d.circle(sx(i),sy(m[1]),t.tipo==='dolor'?1:.6,'F')});y=top+h+5;
 T('Punto morado: sistolica. Punto naranja: diastolica. Puntos grandes: tomas con dolor.',8,0,mut);y+=7;
 sal(34);T('Intensidad del dolor (0-10)',12,1);y+=3;const t2=y,h2=20;r.dias.forEach((x,i)=>{const p=r.pd[x];if(p){d.setFillColor(...pri);const bh=Math.max(.6,p.max/10*h2);d.rect(M+i*pw/n+.15,t2+h2-bh,Math.max(.4,pw/n-.3),bh,'F')}const tm=r.md[x]||[];if(tm.some(a=>a.tipo==='aine')){d.setFillColor(...acc);d.circle(sx(i),t2+h2+1.6,.7,'F')}if(tm.some(a=>a.tipo==='triptan')){d.setFillColor(...ink);d.circle(sx(i),t2+h2+3.6,.7,'F')}});y=t2+h2+9;T('Punto naranja: AINE. Punto oscuro: triptan.',8,0,mut);y+=8;
 if(Object.keys(r.meds).length){sal(12);T('Medicacion',13,1);y+=7;Object.entries(r.meds).forEach(([k,v])=>lin(k,v.dias.size+' dias'+(v.val?', alivio '+v.bien+' de '+v.val:'')));y+=4}
 if(r.top.length){sal(12);T('Anotado antes de una crisis',13,1);y+=7;r.top.forEach(([k,v])=>lin(k,v));y+=4}
 const sem=semanas().filter(i=>r.dias.includes(i)||r.dias.includes(addD(i,6)));if(sem.length){sal(12);T('Semanas de TA',13,1);y+=7;sem.forEach(i=>{const m=mediaSemana(i);lin('Desde el '+fCorta(i),m?m.join('/')+' mmHg':'-')});y+=4}
 if(r.crisis.length){sal(12);T('Crisis',13,1);y+=7;r.crisis.forEach(k=>{const l=fCorta(ymd(k.inicio))+' '+hora(k.inicio)+', dolor '+k.intensidad+', '+durTxt(k)+((k.tomas||[]).length?', '+k.tomas.map(t=>nombreToma(t)+' '+hora(t.hora)+(t.alivio?' ('+t.alivio.toLowerCase()+')':'')).join(', '):', sin medicacion');d.setFont('helvetica','normal');d.setFontSize(10);const ls=d.splitTextToSize(l,pw);sal(ls.length*5+1);d.setTextColor(...ink);d.text(ls,M,y);y+=ls.length*5+1})}
 return d.output('arraybuffer')}

/* ---------- acceso ---------- */
function vLogin(){return`<div class="stack login"><h1>Mi diario de cefaleas y TA</h1><p class="sub">Entra con el mismo correo y contraseña que usas en Kakebo.</p>
 <label class="f">Correo<input class="inp" id="lgMail" type="email" autocomplete="username" data-o="lg" data-k="email" data-inp="1" value="${esc(S.lg.email)}"></label>
 <label class="f">Contraseña<input class="inp" id="lgPass" type="password" autocomplete="current-password" data-o="lg" data-k="pass" data-inp="1" value="${esc(S.lg.pass)}"></label>
 ${S.err?`<p class="alert" role="alert">${esc(S.err)}</p>`:''}<button type="button" class="btn" data-a="entrar">Entrar</button></div>`}
A.entrar=async()=>{S.err='';try{await entrar(S.lg.email.trim(),S.lg.pass);S.lg={email:'',pass:''};await cargar()}catch(e){S.err='No se ha podido entrar. Revisa el correo y la contraseña.';render()}};
A.salir=()=>{salir();S.crisis=[];S.ta=[];S.dias={};S.aj={...AJ_DEF,pal:S.aj.pal};S.ready=false;S.screen='hoy';iniciar()};

/* ---------- arranque ---------- */
async function cargar(){
 try{const filas=await leerTodo();S.crisis=[];S.ta=[];S.dias={};
  for(const f of filas){if(f.coleccion==='crisis')S.crisis.push({id:f.doc_id,...f.data});if(f.coleccion==='ta')S.ta.push({id:f.doc_id,...f.data});if(f.coleccion==='dias')S.dias[f.doc_id]=f.data;if(f.coleccion==='ajustes'&&f.doc_id==='app'){S.aj={...AJ_DEF,...f.data};setPal(S.aj.pal||'mel')}}
  S.db=true}catch(e){console.error(e);S.db=false;if(e&&e.status===401){salir();S.db=null}}
 S.ready=true;render()}
async function iniciar(){if(!await haySesion()){S.ready=true;S.db=null;render();return}await cargar()}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.db&&!enForm()&&!['crisis','detalle','toma'].includes(S.screen))cargar()});
iniciar();
