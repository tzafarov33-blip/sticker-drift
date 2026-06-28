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
  { id:'zhiguli', name:'Жигуль', price:0, color:'#d8e1e8', speed:4.9, handling:4.5, nitro:4.2 },
  { id:'bmw', name:'BMW M5 F90', price:2000, color:'#35a7ff', speed:6.2, handling:6.3, nitro:5.8 },
  { id:'dodge', name:'Dodge Challenger', price:5000, color:'#ff7a1a', speed:7.2, handling:6.6, nitro:7.1 },
  { id:'ferrari', name:'Ferrari', price:10000, color:'#ef233c', speed:8.3, handling:8.1, nitro:8.0 },
  { id:'bugatti', name:'Bugatti', price:20000, color:'#3949ff', speed:9.4, handling:8.8, nitro:9.4 },
  { id:'formula', name:'Formula 1', price:50000, color:'#f5f7fb', speed:10, handling:10, nitro:10 }
];
const locations = {
  day:{ sky:'#6fd3ff', road:'#454d61', verge:'#79c850', lines:'#fff2a6', fog:'rgba(255,226,126,.22)' },
  night:{ sky:'#10162f', road:'#252c42', verge:'#191c35', lines:'#7df9ff', fog:'rgba(125,45,255,.20)' },
  jungle:{ sky:'#6acb8c', road:'#3b4638', verge:'#0f7a3c', lines:'#f2df7e', fog:'rgba(76,255,134,.18)' }
};
let state = JSON.parse(localStorage.getItem('sticker-drift-save') || 'null') || { coins:0, owned:['zhiguli'], selected:'zhiguli' };
let game = { screen:'menu', location:'day', x:0, lane:0, y:0, speed:0, nitro:100, drift:false, distance:0, coins:[], traffic:[], particles:[], keys:{}, last:0 };

function save(){ localStorage.setItem('sticker-drift-save', JSON.stringify(state)); }
function selectedCar(){ return cars.find(c => c.id === state.selected) || cars[0]; }
function syncUI(){ coinEls.forEach(e => e.textContent = Math.floor(state.coins)); carEls.forEach(e => e.textContent = selectedCar().name); renderGarage(); }
function show(section){ [ui,modes,garage,hud].forEach(e=>e.classList.add('hidden')); section.classList.remove('hidden'); game.screen = section===hud?'game':'menu'; }
function notify(text){ toast.textContent = text; toast.classList.remove('hidden'); clearTimeout(notify.t); notify.t=setTimeout(()=>toast.classList.add('hidden'),1800); }
function reward(amount){ state.coins += amount; save(); syncUI(); notify(`Реклама завершена: +${amount} монет`); }

function renderGarage(){
  carList.innerHTML = cars.map(car => {
    const owned = state.owned.includes(car.id), active = state.selected === car.id;
    const action = owned ? (active ? 'Выбрана' : 'Выбрать') : `Купить за ${car.price}`;
    return `<article class="car-card"><div class="car-art" style="--car-color:${car.color}"><i class="wheel a"></i><i class="wheel b"></i></div><h3>${car.name}</h3><p>${car.price ? car.price + ' монет' : 'Стартовая машина'}</p>${stat('Скорость',car.speed)}${stat('Управление',car.handling)}${stat('Нитро',car.nitro)}<button data-buy="${car.id}" ${active?'disabled':''}>${action}</button></article>`;
  }).join('');
}
function stat(label,value){ return `<small>${label}</small><div class="bar"><i style="width:${value*10}%"></i></div>`; }

function start(mode){ Object.assign(game,{screen:'game',location:mode,x:0,lane:0,y:0,speed:0,nitro:100,drift:false,distance:0,coins:[],traffic:[],particles:[],last:performance.now()}); show(hud); }
function laneX(lane){ return canvas.width/2 + lane * canvas.width * .18; }
function spawn(){ if(Math.random()<.035) game.coins.push({lane:Math.floor(Math.random()*3)-1,z:1.1}); if(Math.random()<.018) game.traffic.push({lane:Math.floor(Math.random()*3)-1,z:1.15,color:['#ff3864','#39d98a','#ffd166','#a78bfa'][Math.floor(Math.random()*4)]}); }

function update(dt){
  if(game.screen!=='game') return; const car=selectedCar(); const accel=car.speed*(game.keys.ControlLeft&&game.nitro>0?1.55:1); game.speed += (accel-game.speed)*dt*1.8; if(game.keys.ControlLeft&&game.nitro>0) game.nitro-=dt*car.nitro*14; else game.nitro=Math.min(100,game.nitro+dt*8);
  const steer=(game.keys.ArrowLeft||game.keys.KeyA?-1:0)+(game.keys.ArrowRight||game.keys.KeyD?1:0); game.x += steer*dt*(car.handling*(game.drift?1.45:.9)); game.x *= game.drift?.986:.965; game.x=Math.max(-1.18,Math.min(1.18,game.x)); game.distance += game.speed*dt*55; spawn();
  for (const arr of [game.coins, game.traffic]) for (const o of arr) o.z -= dt*(.35+game.speed*.052);
  game.coins = game.coins.filter(c=>{ if(c.z<.18 && Math.abs(c.lane-game.x)<.28){state.coins+=50; save(); syncUI(); game.particles.push({x:laneX(c.lane),life:1}); return false;} return c.z>.05; });
  game.traffic = game.traffic.filter(t=>{ if(t.z<.2 && Math.abs(t.lane-game.x)<.30){ game.speed*=.35; game.nitro=Math.max(0,game.nitro-25); notify('Авария! Объезжайте машины.'); return false;} return t.z>.04; });
  game.particles=game.particles.filter(p=>(p.life-=dt)>0); speedEl.textContent=Math.round(game.speed*32); nitroEl.textContent=Math.max(0,Math.round(game.nitro)); driveModeEl.textContent=game.drift?'Дрифт':'Обычная езда';
}
function drawCar(x,y,scale,color,angle=0){ ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.scale(scale,scale); ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0,22,58,18,0,0,7); ctx.fill(); ctx.fillStyle=color; roundRect(-50,-48,100,88,18); ctx.fill(); ctx.fillStyle='rgba(190,238,255,.85)'; roundRect(-30,-32,60,30,12); ctx.fill(); ctx.fillStyle='#111'; [-34,34].forEach(px=>{ctx.fillRect(px-13,-45,26,8);ctx.fillRect(px-13,36,26,8)}); ctx.restore(); }
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.roundRect(x,y,w,h,r); }
function draw(){ const loc=locations[game.location]||locations.day; ctx.fillStyle=loc.sky; ctx.fillRect(0,0,canvas.width,canvas.height); for(let i=0;i<7;i++){ctx.fillStyle=`rgba(255,255,255,${.05+i*.025})`;ctx.beginPath();ctx.arc(120+i*170,90+i%2*36,45+i*6,0,7);ctx.fill()} ctx.fillStyle=loc.verge; ctx.fillRect(0,250,canvas.width,470); ctx.fillStyle=loc.road; ctx.beginPath(); ctx.moveTo(canvas.width*.38,230); ctx.lineTo(canvas.width*.62,230); ctx.lineTo(canvas.width*.88,720); ctx.lineTo(canvas.width*.12,720); ctx.closePath(); ctx.fill(); ctx.fillStyle=loc.lines; for(let i=0;i<24;i++){ const z=((game.distance/70+i)%24)/24; const y=240+z*z*520, w=8+z*24; [-.09,.09].forEach(off=>ctx.fillRect(canvas.width/2+off*y*1.4-w/2,y,w,34+z*60)); } ctx.fillStyle=loc.fog; ctx.fillRect(0,0,canvas.width,canvas.height);
  [...game.coins].forEach(c=>{ const y=240+(1-c.z)*(1-c.z)*560, x=laneX(c.lane)*(1-c.z)+canvas.width/2*c.z; ctx.fillStyle='#ffd84d'; ctx.beginPath(); ctx.ellipse(x,y,18*(1-c.z+.25),24*(1-c.z+.25),0,0,7); ctx.fill(); ctx.fillStyle='#fff3a0'; ctx.fillText('₽',x-5,y+5); });
  game.traffic.forEach(t=>{ const y=230+(1-t.z)*(1-t.z)*560, x=laneX(t.lane)*(1-t.z)+canvas.width/2*t.z; drawCar(x,y,.35+(1-t.z)*.9,t.color,0); });
  game.particles.forEach(p=>{ctx.fillStyle=`rgba(255,232,90,${p.life})`;ctx.font=`${42*p.life}px sans-serif`;ctx.fillText('+50',p.x,430-p.life*90)}); drawCar(canvas.width/2+game.x*canvas.width*.18,610,1.05,selectedCar().color,game.drift?game.x*.16:0); }
function loop(now){ const dt=Math.min(.033,(now-game.last)/1000||0); game.last=now; update(dt); draw(); requestAnimationFrame(loop); }

document.addEventListener('click', e=>{ const a=e.target.closest('[data-action],[data-mode],[data-buy]'); if(!a) return; if(a.dataset.action==='play') show(modes); if(a.dataset.action==='garage') show(garage); if(a.dataset.action==='menu') show(ui); if(a.dataset.action==='reward1000') reward(1000); if(a.dataset.action==='reward2000') reward(2000); if(a.dataset.mode) start(a.dataset.mode); if(a.dataset.buy){ const car=cars.find(c=>c.id===a.dataset.buy); if(state.owned.includes(car.id)){state.selected=car.id;} else if(state.coins>=car.price){state.coins-=car.price;state.owned.push(car.id);state.selected=car.id;notify(`${car.name} куплена!`);} else notify('Недостаточно монет.'); save(); syncUI(); }});
document.addEventListener('keydown', e=>{ game.keys[e.code]=true; if(e.code==='ShiftLeft'||e.code==='ShiftRight'){ if(!e.repeat) game.drift=!game.drift; } });
document.addEventListener('keyup', e=>{ game.keys[e.code]=false; });

syncUI(); show(ui); requestAnimationFrame(loop);
