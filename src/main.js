const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const ui = document.querySelector('#ui');
const modes = document.querySelector('#modes');
const garage = document.querySelector('#garage');
const hud = document.querySelector('#hud');
const toast = document.querySelector('#toast');
const speedEl = document.querySelector('#speed');
const nitroEl = document.querySelector('#nitro');
const driveModeEl = document.querySelector('#driveMode');
const coinEls = document.querySelectorAll('[data-coins]');
const carEls = document.querySelectorAll('[data-car]');
const carList = document.querySelector('#carList');

const cars = [
  { id:'zhiguli', name:'Жигуль', price:0, color:'#d8e1e8', accent:'#9aa7b3', speed:4.9, handling:4.5, nitro:4.2, mass:1.18, grip:.82 },
  { id:'bmw', name:'BMW M5 F90', price:2000, color:'#1f8cff', accent:'#08182d', speed:6.2, handling:6.3, nitro:5.8, mass:1.1, grip:.9 },
  { id:'dodge', name:'Dodge Challenger', price:5000, color:'#ff7a1a', accent:'#18120c', speed:7.2, handling:6.6, nitro:7.1, mass:1.22, grip:.88 },
  { id:'ferrari', name:'Ferrari', price:10000, color:'#ef233c', accent:'#2b0710', speed:8.3, handling:8.1, nitro:8, mass:.98, grip:.98 },
  { id:'bugatti', name:'Bugatti', price:20000, color:'#263bff', accent:'#050814', speed:9.4, handling:8.8, nitro:9.4, mass:1.04, grip:1.02 },
  { id:'formula', name:'Formula 1', price:50000, color:'#f5f7fb', accent:'#d71920', speed:10, handling:10, nitro:10, mass:.74, grip:1.18 }
];

const locations = {
  day:{ skyTop:'#62c8ff', skyBottom:'#ffe2a3', road:'#3f4552', shoulder:'#5d626d', grass:'#78c95c', lines:'#fff1ad', haze:'rgba(255,235,180,.22)', sun:'#fff3a5', city:true },
  night:{ skyTop:'#080a1f', skyBottom:'#18214d', road:'#252b3a', shoulder:'#151a2a', grass:'#111827', lines:'#74f7ff', haze:'rgba(76,40,190,.26)', sun:'#b7c8ff', neon:true },
  jungle:{ skyTop:'#4fae7e', skyBottom:'#d4f0a2', road:'#394238', shoulder:'#536245', grass:'#0e743a', lines:'#ffe987', haze:'rgba(73,255,128,.19)', sun:'#fff0a0', jungle:true }
};

let state = JSON.parse(localStorage.getItem('sticker-drift-save') || 'null') || { coins:0, owned:['zhiguli'], selected:'zhiguli' };
let game = { screen:'menu', location:'day', x:0, vx:0, yaw:0, speed:0, nitro:100, drift:false, distance:0, coins:[], traffic:[], particles:[], dust:[], keys:{}, last:0, shake:0 };

function save(){ localStorage.setItem('sticker-drift-save', JSON.stringify(state)); }
function selectedCar(){ return cars.find(c => c.id === state.selected) || cars[0]; }
function syncUI(){ coinEls.forEach(e => e.textContent = Math.floor(state.coins)); carEls.forEach(e => e.textContent = selectedCar().name); renderGarage(); }
function show(section){ [ui,modes,garage,hud].forEach(e=>e.classList.add('hidden')); section.classList.remove('hidden'); game.screen = section===hud?'game':'menu'; }
function notify(text){ toast.textContent = text; toast.classList.remove('hidden'); clearTimeout(notify.t); notify.t=setTimeout(()=>toast.classList.add('hidden'),1900); }
function reward(amount){ state.coins += amount; save(); syncUI(); notify(`Реклама завершена: +${amount} монет`); }
function shade(hex, amount){ const n=parseInt(hex.slice(1),16); const r=Math.max(0,Math.min(255,(n>>16)+amount)); const g=Math.max(0,Math.min(255,((n>>8)&255)+amount)); const b=Math.max(0,Math.min(255,(n&255)+amount)); return `rgb(${r},${g},${b})`; }

function renderGarage(){
  carList.innerHTML = cars.map(car => {
    const owned = state.owned.includes(car.id), active = state.selected === car.id;
    const action = owned ? (active ? 'Выбрана' : 'Выбрать') : `Купить за ${car.price}`;
    return `<article class="car-card"><div class="car-art premium" style="--car-color:${car.color};--car-accent:${car.accent}"><i class="shine"></i><i class="wheel a"></i><i class="wheel b"></i></div><h3>${car.name}</h3><p>${car.price ? car.price + ' монет' : 'Стартовая машина'}</p>${stat('Скорость',car.speed)}${stat('Управление',car.handling)}${stat('Нитро',car.nitro)}<button data-buy="${car.id}" ${active?'disabled':''}>${action}</button></article>`;
  }).join('');
}
function stat(label,value){ return `<small>${label}</small><div class="bar"><i style="width:${value*10}%"></i></div>`; }
function start(mode){ Object.assign(game,{screen:'game',location:mode,x:0,vx:0,yaw:0,speed:0,nitro:100,drift:false,distance:0,coins:[],traffic:[],particles:[],dust:[],last:performance.now(),shake:0}); show(hud); }
function laneX(lane,z){ return canvas.width/2 + lane * canvas.width * (.07 + .16*(1-z)); }
function projectY(z){ return 226 + (1-z)*(1-z)*510; }
function spawn(){ if(Math.random()<.04) game.coins.push({lane:Math.floor(Math.random()*3)-1,z:1.08,spin:Math.random()*7}); if(Math.random()<.02) game.traffic.push({lane:Math.floor(Math.random()*3)-1,z:1.12,color:['#c1121f','#06d6a0','#ffd166','#8d99ae'][Math.floor(Math.random()*4)],type:Math.random()>.55?'suv':'coupe'}); }

function update(dt){
  if(game.screen!=='game') return;
  const car=selectedCar();
  const nitroOn=(game.keys.ControlLeft||game.keys.ControlRight)&&game.nitro>0;
  const targetSpeed=car.speed*(nitroOn?1.58:1);
  game.speed += (targetSpeed-game.speed)*dt*(1.4/car.mass);
  game.speed -= Math.abs(game.vx)*dt*.28;
  if(nitroOn) game.nitro-=dt*car.nitro*13.5; else game.nitro=Math.min(100,game.nitro+dt*(7+car.nitro*.3));
  const steer=(game.keys.ArrowLeft||game.keys.KeyA?-1:0)+(game.keys.ArrowRight||game.keys.KeyD?1:0);
  const grip=car.grip*(game.drift?.52:1);
  const steeringForce=steer*dt*car.handling*(game.drift?1.95:1.1);
  game.vx += steeringForce;
  game.vx *= Math.pow(.08 + grip*.86, dt*5.8);
  game.x += game.vx*dt*(1.2+game.speed*.09);
  if(Math.abs(game.x)>1.08){ game.vx -= Math.sign(game.x)*dt*2.3; game.speed*=.992; }
  game.x=Math.max(-1.24,Math.min(1.24,game.x));
  game.yaw += ((game.vx*1.4 + steer*.12)-game.yaw)*dt*(game.drift?5.5:8.5);
  game.distance += game.speed*dt*58;
  game.shake=Math.max(0,game.shake-dt*2.2);
  if(game.drift && Math.abs(game.vx)>.18) game.dust.push({x:canvas.width/2+game.x*canvas.width*.18,y:644,life:1,side:Math.sign(game.vx)});
  spawn();
  for (const arr of [game.coins, game.traffic]) for (const o of arr) o.z -= dt*(.33+game.speed*.052);
  game.coins = game.coins.filter(c=>{ c.spin+=dt*9; if(c.z<.18 && Math.abs(c.lane-game.x)<.29){state.coins+=50; save(); syncUI(); game.particles.push({x:laneX(c.lane,c.z),life:1}); return false;} return c.z>.04; });
  game.traffic = game.traffic.filter(t=>{ if(t.z<.2 && Math.abs(t.lane-game.x)<.32){ game.speed*=.28; game.vx*=-.35; game.nitro=Math.max(0,game.nitro-28); game.shake=1; notify('Авария! Объезжайте машины.'); return false;} return t.z>.04; });
  game.particles=game.particles.filter(p=>(p.life-=dt)>0);
  game.dust=game.dust.filter(p=>(p.life-=dt*1.8)>0);
  speedEl.textContent=Math.round(game.speed*34);
  nitroEl.textContent=Math.max(0,Math.round(game.nitro));
  driveModeEl.textContent=game.drift?'Дрифт':'Обычная езда';
}

function rounded(x,y,w,h,r){ ctx.beginPath(); ctx.roundRect(x,y,w,h,r); }
function drawWheel(x,y,scale,turn=0){ ctx.save(); ctx.translate(x,y); ctx.rotate(turn); ctx.fillStyle='#06070a'; ctx.beginPath(); ctx.ellipse(0,0,15*scale,24*scale,0,0,7); ctx.fill(); ctx.strokeStyle='#687285'; ctx.lineWidth=4*scale; ctx.stroke(); ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=1.2*scale; for(let i=0;i<6;i++){ ctx.rotate(Math.PI/3); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-16*scale); ctx.stroke(); } ctx.restore(); }
function drawVehicle(x,y,scale,car,angle=0,lights=false){
  ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.scale(scale,scale);
  const body=car.color || car;
  const accent=car.accent || shade(body,-85);
  const grad=ctx.createLinearGradient(0,-88,0,62); grad.addColorStop(0,shade(body,62)); grad.addColorStop(.34,body); grad.addColorStop(1,shade(body,-70));
  ctx.fillStyle='rgba(0,0,0,.42)'; ctx.beginPath(); ctx.ellipse(0,58,86,23,0,0,7); ctx.fill();
  ctx.fillStyle=accent; rounded(-70,-32,140,92,22); ctx.fill();
  ctx.fillStyle=grad; rounded(-61,-73,122,116,26); ctx.fill();
  const glass=ctx.createLinearGradient(0,-78,0,16); glass.addColorStop(0,'rgba(236,252,255,.95)'); glass.addColorStop(1,'rgba(46,84,116,.82)');
  ctx.fillStyle=glass; rounded(-37,-60,74,38,13); ctx.fill(); rounded(-45,-17,90,35,10); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.42)'; ctx.fillRect(-25,-55,12,31); ctx.fillRect(8,-14,14,29);
  ctx.fillStyle=shade(body,-95); rounded(-64,9,128,32,14); ctx.fill();
  ctx.fillStyle=grad; rounded(-54,-1,108,37,16); ctx.fill();
  ctx.fillStyle='#fff7c2'; rounded(-45,-72,21,8,4); ctx.fill(); rounded(24,-72,21,8,4); ctx.fill();
  ctx.fillStyle='#ff375f'; rounded(-49,35,24,9,4); ctx.fill(); rounded(25,35,24,9,4); ctx.fill();
  if(lights){ const beam=ctx.createLinearGradient(0,-82,0,-210); beam.addColorStop(0,'rgba(255,246,184,.24)'); beam.addColorStop(1,'rgba(255,246,184,0)'); ctx.fillStyle=beam; ctx.beginPath(); ctx.moveTo(-42,-72); ctx.lineTo(-175,-230); ctx.lineTo(-38,-230); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(42,-72); ctx.lineTo(175,-230); ctx.lineTo(38,-230); ctx.closePath(); ctx.fill(); }
  drawWheel(-55,-9,1,angle*2); drawWheel(55,-9,1,angle*2); drawWheel(-47,43,.9,angle*2); drawWheel(47,43,.9,angle*2);
  ctx.restore();
}
function drawBackground(loc){
  const sky=ctx.createLinearGradient(0,0,0,canvas.height); sky.addColorStop(0,loc.skyTop); sky.addColorStop(.58,loc.skyBottom); sky.addColorStop(1,loc.grass); ctx.fillStyle=sky; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=loc.sun; ctx.beginPath(); ctx.arc(1050,95,loc.neon?34:58,0,7); ctx.fill();
  for(let i=0;i<9;i++){ const x=(i*170-(game.distance*.18)%170); const h=70+(i%4)*38; ctx.fillStyle=loc.neon?`hsl(${220+i*20} 75% ${28+i%2*15}%)`:'rgba(48,68,86,.24)'; if(loc.city){ ctx.fillRect(x,190-h,88,h); ctx.fillStyle='rgba(255,245,180,.55)'; for(let w=0;w<4;w++) ctx.fillRect(x+14+w*17,205-h,7,h-20); } if(loc.jungle){ ctx.fillStyle=i%2?'#0c5f31':'#177843'; ctx.beginPath(); ctx.moveTo(x,230); ctx.lineTo(x+45,70+h*.2); ctx.lineTo(x+90,230); ctx.fill(); ctx.fillRect(x+42,150,10,88); } }
  ctx.fillStyle=loc.grass; ctx.fillRect(0,235,canvas.width,485);
}
function drawRoad(loc){
  ctx.fillStyle=loc.shoulder; ctx.beginPath(); ctx.moveTo(canvas.width*.34,220); ctx.lineTo(canvas.width*.66,220); ctx.lineTo(canvas.width*.98,720); ctx.lineTo(canvas.width*.02,720); ctx.closePath(); ctx.fill();
  ctx.fillStyle=loc.road; ctx.beginPath(); ctx.moveTo(canvas.width*.39,220); ctx.lineTo(canvas.width*.61,220); ctx.lineTo(canvas.width*.86,720); ctx.lineTo(canvas.width*.14,720); ctx.closePath(); ctx.fill();
  for(let i=0;i<42;i++){ const z=((game.distance/76+i)%42)/42; const y=projectY(z); const roadW=canvas.width*(.12+.34*(1-z)); const x=canvas.width/2; ctx.fillStyle=`rgba(255,255,255,${.02+.12*(1-z)})`; ctx.fillRect(x-roadW,y,roadW*2,2); if(i%2===0){ ctx.fillStyle=loc.lines; const dashH=22+70*(1-z); const dashW=5+18*(1-z); ctx.fillRect(x-dashW/2,y,dashW,dashH); ctx.fillRect(x-roadW*.38-dashW/2,y,dashW*.75,dashH*.8); ctx.fillRect(x+roadW*.38-dashW/2,y,dashW*.75,dashH*.8); } }
  ctx.fillStyle=loc.haze; ctx.fillRect(0,0,canvas.width,canvas.height);
}
function drawCollectibles(){
  game.coins.forEach(c=>{ const y=projectY(c.z), x=laneX(c.lane,c.z), s=.45+(1-c.z)*1.9; ctx.save(); ctx.translate(x,y); ctx.scale(Math.abs(Math.cos(c.spin))*.35+.22,1); ctx.fillStyle='#ffcf33'; ctx.beginPath(); ctx.ellipse(0,0,20*s,25*s,0,0,7); ctx.fill(); ctx.strokeStyle='#fff0a2'; ctx.lineWidth=3*s; ctx.stroke(); ctx.fillStyle='#855f00'; ctx.font=`${18*s}px sans-serif`; ctx.fillText('₽',-6*s,7*s); ctx.restore(); });
  game.traffic.forEach(t=>{ const y=projectY(t.z), x=laneX(t.lane,t.z), s=.28+(1-t.z)*1.18; drawVehicle(x,y,s,{color:t.color,accent:shade(t.color,-95)},0,locations[game.location].neon); });
}
function drawEffects(){ game.dust.forEach(p=>{ ctx.fillStyle=`rgba(210,210,210,${p.life*.24})`; ctx.beginPath(); ctx.ellipse(p.x-p.side*46*p.life,p.y+20,70*(1-p.life+.2),24*(1-p.life+.25),0,0,7); ctx.fill(); }); game.particles.forEach(p=>{ctx.fillStyle=`rgba(255,232,90,${p.life})`;ctx.font=`${42*p.life}px sans-serif`;ctx.fillText('+50',p.x,430-p.life*90)}); }
function draw(){ const loc=locations[game.location]||locations.day; ctx.save(); if(game.shake){ ctx.translate((Math.random()-.5)*game.shake*16,(Math.random()-.5)*game.shake*10); } drawBackground(loc); drawRoad(loc); drawCollectibles(); drawEffects(); drawVehicle(canvas.width/2+game.x*canvas.width*.18,610,1.08,selectedCar(),game.yaw,loc.neon); ctx.restore(); }
function loop(now){ const dt=Math.min(.033,(now-game.last)/1000||0); game.last=now; update(dt); draw(); requestAnimationFrame(loop); }

document.addEventListener('click', e=>{ const a=e.target.closest('[data-action],[data-mode],[data-buy]'); if(!a) return; if(a.dataset.action==='play') show(modes); if(a.dataset.action==='garage') show(garage); if(a.dataset.action==='menu') show(ui); if(a.dataset.action==='reward1000') reward(1000); if(a.dataset.action==='reward2000') reward(2000); if(a.dataset.mode) start(a.dataset.mode); if(a.dataset.buy){ const car=cars.find(c=>c.id===a.dataset.buy); if(state.owned.includes(car.id)){state.selected=car.id;} else if(state.coins>=car.price){state.coins-=car.price;state.owned.push(car.id);state.selected=car.id;notify(`${car.name} куплена!`);} else notify('Недостаточно монет.'); save(); syncUI(); }});
document.addEventListener('keydown', e=>{ game.keys[e.code]=true; if(e.code==='ShiftLeft'||e.code==='ShiftRight'){ if(!e.repeat) game.drift=!game.drift; } });
document.addEventListener('keyup', e=>{ game.keys[e.code]=false; });

syncUI(); show(ui); requestAnimationFrame(loop);
