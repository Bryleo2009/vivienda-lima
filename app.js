const fmt = n => new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN',maximumFractionDigits:0}).format(n);
const $ = s => document.querySelector(s);
let DATA;
let activeFilter='Todos';
const JUNTA_KEY='planCasaJuntaV2';

function mortgagePV(payment, annual=0.075, years=30){
  const r=Math.pow(1+annual,1/12)-1, n=years*12;
  return payment*(1-Math.pow(1+r,-n))/r;
}
function monthsToTarget(current, target, monthly){ return Math.max(0,Math.ceil((target-current)/monthly)); }
function monthLabel(months){
  if(months===0) return 'ya alcanzado';
  const y=Math.floor(months/12), m=months%12;
  return [y?`${y} año${y>1?'s':''}`:'',m?`${m} mes${m>1?'es':''}`:''].filter(Boolean).join(' y ');
}
function bankBadge(name,status){return `<span class="bank-badge ${status}">${name}</span>`}
function parseDate(value){ if(!value) return null; const [y,m,d]=value.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)); }
function addDays(date,days){ const d=new Date(date); d.setUTCDate(d.getUTCDate()+days); return d; }
function firstSaturdayOnOrAfter(date){
  if(!date) return null; const d=new Date(date); const delta=(6-d.getUTCDay()+7)%7; return addDays(d,delta);
}
function lastSaturdayOnOrBefore(date){
  if(!date) return null; const d=new Date(date); const delta=(d.getUTCDay()-6+7)%7; return addDays(d,-delta);
}
function saturdayCount(start,end){
  const a=firstSaturdayOnOrAfter(start), b=lastSaturdayOnOrBefore(end);
  if(!a||!b||a>b) return 0; return Math.floor((b-a)/(7*86400000))+1;
}
function turnDate(start,turn,totalTurns){
  const t=Number(turn); if(!start||!t||t<1||t>totalTurns) return null;
  return addDays(firstSaturdayOnOrAfter(start),(t-1)*7);
}
function humanDate(date){
  if(!date) return '—';
  return new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(date).replace('.','');
}
function futureSaturdayCount(end){
  const today=new Date(); const utcToday=new Date(Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()));
  return saturdayCount(utcToday,end);
}
function eventTargetDate(starting,target,events){
  let total=starting;
  if(total>=target) return new Date();
  for(const e of events.filter(e=>e.date).sort((a,b)=>a.date-b.date)){
    total+=e.amount;
    if(total>=target) return e.date;
  }
  return null;
}

function renderScenarios(){
  const el=$('#scenarioCards');
  el.innerHTML=DATA.scenarios.map((s,i)=>{
    const combined=DATA.profile.your_income+s.aunt_income;
    const safe=combined*.35;
    const cap=mortgagePV(safe);
    return `<article class="scenario ${i===1?'recommended':''}">
      <div class="scenario-top"><div><p class="eyebrow">${s.label}</p><h3>${fmt(s.aunt_income)} / mes</h3></div>${i===1?'<span class="tag">Más opciones</span>':''}</div>
      <p class="hint">${s.summary}</p>
      <div class="scenario-stats"><div><span>Ingreso conjunto</span><strong>${fmt(combined)}</strong></div><div><span>Crédito prudente aprox.</span><strong>${fmt(cap)}</strong></div></div>
      <div class="bank-badges">${Object.entries(s.bank_access).map(([k,v])=>bankBadge(k,v)).join('')}</div>
    </article>`
  }).join('');
}
function renderCredits(){
  $('#creditCards').innerHTML=DATA.credits.map(c=>`<article class="credit-card">
    <div class="credit-head"><div><h3>${c.bank} · ${c.product}</h3><p>${c.one_liner}</p></div><span class="fit ${c.fit}">${c.fit_label}</span></div>
    <div class="credit-details"><div><b>Ingreso</b><span>${c.income_rule}</span></div><div><b>Con tu tía</b><span>${c.aunt_case}</span></div><div><b>Financia</b><span>${c.financing}</span></div><div><b>Postulación</b><span>${c.apply}</span></div></div>
    <a href="${c.source}" target="_blank" rel="noopener">Ver fuente oficial ↗</a>
  </article>`).join('');
}
function renderMilestones(){
  const monthly=Number($('#monthlySaving')?.value||DATA.profile.monthly_saving);
  const usable=Math.max(0,DATA.profile.current_savings-DATA.profile.emergency_reserve);
  const targets=[40000,60000,80000,100000];
  $('#milestones').innerHTML=targets.map(t=>{
    const months=monthsToTarget(usable,t,monthly);
    const progress=Math.min(100,usable/t*100);
    return `<div class="milestone-row"><strong>${fmt(t)}</strong><div class="progress"><i style="width:${progress}%"></i></div><small>${monthLabel(months)}</small></div>`
  }).join('');
}
function renderProperties(){
  const allProps=[...(DATA.properties||[]),...(DATA.auto_properties||[])];
  const props=allProps.filter(p=>activeFilter==='Todos'||p.category===activeFilter||p.district===activeFilter);
  $('#propertyCards').innerHTML=props.map(p=>`<article class="property-card">
    <div class="property-top"><div><h3>${p.title}</h3><div class="district">${p.district} · ${p.type}</div></div><div class="price">${fmt(p.price)}</div></div>
    <div class="property-meta"><span>${p.bedrooms} dorm.</span><span>${p.area_m2} m²</span>${p.parking?'<span>cochera</span>':''}${p.multifamily?'<span>potencial renta</span>':''}</div>
    <div class="score"><p>${p.why}</p><strong>${p.score}/5</strong></div>
    <a href="${p.source}" target="_blank" rel="noopener">Revisar publicación / búsqueda ↗</a>
  </article>`).join('') || '<div class="card"><p>No hay opciones en este filtro.</p></div>';
}
function renderFilters(){
  const filters=['Todos','Casa','Dúplex','Departamento','Los Olivos','SMP','Pueblo Libre','Surquillo','Lince','Magdalena'];
  $('#filters').innerHTML=filters.map(f=>`<button class="filter-btn ${f===activeFilter?'active':''}" data-filter="${f}">${f}</button>`).join('');
  document.querySelectorAll('.filter-btn').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;renderFilters();renderProperties()});
}
function renderTrends(){ $('#trendList').innerHTML=DATA.trends.map(t=>`<div class="trend-item"><div class="trend-icon">${t.icon}</div><div><h3>${t.title}</h3><p>${t.text}</p></div></div>`).join(''); }
function renderSources(){ $('#sources').innerHTML=DATA.sources.map(s=>`<a class="source-link" href="${s.url}" target="_blank" rel="noopener"><span>${s.label}</span><span>abrir ↗</span></a>`).join(''); }

function juntaDefaults(){
  return {
    weekly:DATA.junta.weekly_per_person,
    start:DATA.junta.current.start,end:DATA.junta.current.end,
    turnBry:DATA.junta.current.turn_bry||'',turnAunt:DATA.junta.current.turn_aunt||'',
    includesPayout:DATA.junta.current.current_savings_include_payout,
    nextEnabled:DATA.junta.next.enabled,nextStart:DATA.junta.next.start,nextEnd:DATA.junta.next.end,
    nextTurnBry:DATA.junta.next.turn_bry,nextTurnAunt:DATA.junta.next.turn_aunt
  };
}
function loadJuntaForm(){
  let state=juntaDefaults();
  try{ state={...state,...JSON.parse(localStorage.getItem(JUNTA_KEY)||'{}')}; }catch(e){}
  $('#juntaWeekly').value=state.weekly; $('#juntaStart').value=state.start; $('#juntaEnd').value=state.end;
  $('#juntaTurnBry').value=state.turnBry; $('#juntaTurnAunt').value=state.turnAunt;
  $('#currentSavingsIncludesPayout').checked=state.includesPayout;
  $('#nextJuntaEnabled').checked=state.nextEnabled; $('#nextJuntaStart').value=state.nextStart; $('#nextJuntaEnd').value=state.nextEnd;
  $('#nextJuntaTurnBry').value=state.nextTurnBry; $('#nextJuntaTurnAunt').value=state.nextTurnAunt;
}
function juntaState(){ return {
  weekly:Number($('#juntaWeekly').value||0), start:$('#juntaStart').value,end:$('#juntaEnd').value,
  turnBry:$('#juntaTurnBry').value,turnAunt:$('#juntaTurnAunt').value,includesPayout:$('#currentSavingsIncludesPayout').checked,
  nextEnabled:$('#nextJuntaEnabled').checked,nextStart:$('#nextJuntaStart').value,nextEnd:$('#nextJuntaEnd').value,
  nextTurnBry:$('#nextJuntaTurnBry').value,nextTurnAunt:$('#nextJuntaTurnAunt').value
}; }
function saveJuntaForm(){ try{localStorage.setItem(JUNTA_KEY,JSON.stringify(juntaState()));}catch(e){} }
function metric(label,value,accent=false){ return `<article class="${accent?'accent':''}"><span>${label}</span><strong>${value}</strong></article>`; }
function updateJunta(){
  if(!DATA?.junta) return;
  const s=juntaState(), start=parseDate(s.start), end=parseDate(s.end), turns=saturdayCount(start,end);
  const payout=s.weekly*turns, jointWeekly=s.weekly*2, monthlyEq=jointWeekly*52/12;
  const bryDate=turnDate(start,s.turnBry,turns), auntDate=turnDate(start,s.turnAunt,turns);
  const pendingWeeks=futureSaturdayCount(end), pendingTotal=pendingWeeks*jointWeekly;
  $('#currentJuntaStatus').textContent=turns?`${turns} sábados · ${fmt(payout)} c/u`:'Revisar fechas';
  $('#currentJuntaResults').innerHTML=[
    metric('Pago semanal conjunto',fmt(jointWeekly)),metric('Equivalente mensual',fmt(monthlyEq)),
    metric('Monto por número',turns?fmt(payout):'—'),metric('Capital de 2 números',turns?fmt(payout*2):'—',true),
    metric('Tu cobro',bryDate?humanDate(bryDate):'pon tu número'),metric('Cobro de tu tía',auntDate?humanDate(auntDate):'pon su número'),
    metric('Sábados pendientes',String(pendingWeeks)),metric('Pagos pendientes aprox.',fmt(pendingTotal))
  ].join('');

  $('#nextJuntaFields').classList.toggle('is-disabled',!s.nextEnabled);
  if(!s.nextEnabled){ $('#nextJuntaResults').innerHTML=''; $('#juntaRecommendation').innerHTML='<b>Próxima junta desactivada.</b><span>El ahorro se proyecta solo con el monto mensual adicional.</span>'; saveJuntaForm(); return; }
  const ns=parseDate(s.nextStart), ne=parseDate(s.nextEnd), nturns=saturdayCount(ns,ne), npayout=s.weekly*nturns;
  const nb=turnDate(ns,s.nextTurnBry,nturns), na=turnDate(ns,s.nextTurnAunt,nturns);
  const target40=eventTargetDate(DATA.profile.current_savings,40000,[{date:nb,amount:npayout},{date:na,amount:npayout}]);
  const latestTurn=Math.max(Number(s.nextTurnBry)||999,Number(s.nextTurnAunt)||999);
  const earlyCut=Math.max(1,Math.ceil(nturns*.25)), midCut=Math.max(1,Math.ceil(nturns*.5));
  let verdict='';
  if(!nturns) verdict='<b>Revisa las fechas de la próxima junta.</b><span>No puedo calcular los turnos.</span>';
  else if(latestTurn<=earlyCut) verdict=`<b>🟢 Sí acelera bastante.</b><span>Ambos cobran dentro del primer 25% de la junta. Es el escenario donde la junta funciona mejor como adelanto sin intereses.</span>`;
  else if(latestTurn<=midCut) verdict=`<b>🟡 Acelera, pero de forma moderada.</b><span>Compararía este turno contra ahorrar directamente o usar una ruta bancaria de ahorro hipotecario.</span>`;
  else verdict=`<b>🟠 Se parece más a ahorro forzoso que a adelanto.</b><span>Si cobran tarde, asumen el riesgo de la junta sin ganar demasiados meses. Conviene comparar con ahorro bancario.</span>`;
  $('#nextJuntaResults').innerHTML=[
    metric('Turnos / sábados',String(nturns)),metric('Monto por número',nturns?fmt(npayout):'—'),
    metric('Tu cobro',nb?humanDate(nb):'revisar turno'),metric('Cobro de tu tía',na?humanDate(na):'revisar turno'),
    metric('Capital tras ambos cobros',nturns?fmt(DATA.profile.current_savings+npayout*2):'—',true),
    metric('S/40k disponibles',target40?humanDate(target40):'no solo con cobros')
  ].join('');
  $('#juntaRecommendation').innerHTML=verdict+`<small>La obligación semanal conjunta seguiría siendo ${fmt(jointWeekly)} hasta ${humanDate(ne)}.</small>`;
  saveJuntaForm();
}
function bindJunta(){
  loadJuntaForm();
  ['juntaWeekly','juntaStart','juntaEnd','juntaTurnBry','juntaTurnAunt','currentSavingsIncludesPayout','nextJuntaEnabled','nextJuntaStart','nextJuntaEnd','nextJuntaTurnBry','nextJuntaTurnAunt'].forEach(id=>{
    const el=$('#'+id); el.addEventListener('input',updateJunta); el.addEventListener('change',updateJunta);
  });
  updateJunta();
}
function updateSimulator(){
  const your=Number($('#yourIncome').value), aunt=Number($('#auntIncome').value), save=Number($('#monthlySaving').value), down=Number($('#downPayment').value);
  $('#yourIncomeValue').textContent=fmt(your);$('#auntIncomeValue').textContent=fmt(aunt);$('#monthlySavingValue').textContent=fmt(save);$('#downPaymentValue').textContent=fmt(down);
  const combined=your+aunt, payment=combined*.35, capacity=mortgagePV(payment), budget=capacity+down;
  $('#combinedIncome').textContent=fmt(combined);$('#safePayment').textContent=fmt(payment);$('#mortgageCapacity').textContent=fmt(capacity);$('#homeBudget').textContent=fmt(budget);
  renderMilestones(); updateJunta();
}
async function loadData(cacheBust=false){
  try{ const res=await fetch(`data/dashboard.json${cacheBust?'?t='+Date.now():''}`); DATA=await res.json(); }
  catch(e){ console.error(e); alert('No pude leer data/dashboard.json. Abre la web desde un servidor local o GitHub Pages.'); return; }
  $('#heroSavings').textContent=fmt(DATA.profile.current_savings);
  $('#heroIncome').textContent=fmt(DATA.profile.your_income+DATA.scenarios[0].aunt_income);
  $('#lastUpdated').textContent=`Actualizado: ${DATA.updated_at}`;
  renderScenarios();renderCredits();renderFilters();renderProperties();renderTrends();renderSources();
  ['yourIncome','auntIncome','monthlySaving','downPayment'].forEach(id=>$('#'+id).addEventListener('input',updateSimulator));
  bindJunta(); updateSimulator();
}
$('#refreshBtn').addEventListener('click',()=>loadData(true));
loadData();
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
