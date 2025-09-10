(function(){
  const $ = sel => document.querySelector(sel);
  const resEl = $('#resources');
  const actionsEl = $('#actions');
  const logEl = $('#log');
  const fireTag = $('#fireTag');
  const expeditionTag = $('#expeditionTag');
  const bossTag = $('#bossTag');
  const timeOfDay = $('#timeOfDay');
  const saveInfo = $('#saveInfo');
  const toastEl = $('#toast');
  const tipFooter = $('#tipFooter');
  const startOverlay = $('#startOverlay');
  const startBtn = $('#startBtn');
  const audioBtn = document.querySelector('#audioBtn');
  const achEl = document.querySelector('#achievements');
  const hpTag = $('#hpTag');
  const villagersTag = document.createElement('span');
  villagersTag.className = 'tag';
  const notesBody = document.querySelector('#notesBody');
  const mapBody = document.querySelector('#mapBody');
  const mapFooter = document.querySelector('#mapFooter');
  const fightOverlay = document.querySelector('#fightOverlay');
  const fightTitle = document.querySelector('#fightTitle');
  const fightInfo = document.querySelector('#fightInfo');
  const fightFooter = document.querySelector('#fightFooter');
  const btnAttack = document.querySelector('#btnAttack');
  const btnDefend = document.querySelector('#btnDefend');
  const btnHeal = document.querySelector('#btnHeal');
  const fightAscii = document.querySelector('#fightAscii');
  const encounterOverlay = document.querySelector('#encounterOverlay');
  const encounterTitle = document.querySelector('#encounterTitle');
  const encounterInfo = document.querySelector('#encounterInfo');
  const encounterCountdown = document.querySelector('#encounterCountdown');
  const btnEncAccept = document.querySelector('#btnEncAccept');
  const btnEncDecline = document.querySelector('#btnEncDecline');

  const now = () => Date.now();

  function toast(text){
    toastEl.textContent = text;
    toastEl.classList.add('show');
    setTimeout(()=>toastEl.classList.remove('show'), 2400);
  }

  function log(text, cls){
    const p = document.createElement('p');
    if(cls) p.className = cls;
    p.textContent = text;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function save(){
    try{
      localStorage.setItem('lys_save_v2', JSON.stringify(S));
      saveInfo.textContent = 'Guardado ' + new Date().toLocaleTimeString();
    }catch(e){/* noop */}
  }

  function load(){
    try{
      const raw = localStorage.getItem('lys_save_v2');
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null }
  }

  const blank = () => ({
    version:3,
    started:false,
    startedAt: now(),
    lastTick: now(),
    time: { day: 1, minutes: 0 },
    fire: { lit:false, heat:0, fuel:0 },
    player: { hp:100, maxHp:100, guard:false },
    unlocked:{ water:false, olives:false, herbs:false, village:false, expedition:false, forge:false, crafting:false, molino:false, acequia:false },
    stats:{ explore:0, renown:0, bossesDefeated:0, bossTipShown:false },
    people:{ villagers:0 },
    resources:{ lenia:0, agua:0, aceitunas:0, hierbas:0, piedra:0, hierro:0, trigo:0, sal:0, antorchas:0, medicina:0 },
    cooldowns:{ cut:0, fetch:0, forage:0, explore:0, stoke:0, boss:0, craft:0 },
    expedition:null,
    threat:null,
    achievements:{},
    regionFocus:null,
    discoveries:{ lenia:false, agua:false, aceitunas:false, hierbas:false, piedra:false, hierro:false, trigo:false, sal:false }
  });

  let S = load() || blank();

  const RES_META = {
    lenia:{ label:'Leña', icon:'🪵' },
    agua:{ label:'Agua', icon:'💧' },
    aceitunas:{ label:'Aceitunas', icon:'🫒' },
    hierbas:{ label:'Hierbas', icon:'🌿' },
    piedra:{ label:'Piedra', icon:'🪨' },
    hierro:{ label:'Hierro', icon:'⛓️' },
    trigo:{ label:'Trigo', icon:'🌾' },
    sal:{ label:'Sal', icon:'🧂' },
    antorchas:{ label:'Antorchas', icon:'🔥' },
    medicina:{ label:'Medicina', icon:'💊' }
  };
  const ACTION_LOCKS = {
    crafting: () => S.unlocked.crafting,
    recruit: () => S.unlocked.village,
    exploreAdvanced: () => S.stats.renown>=6 || S.unlocked.expedition
  };

  const BUTTON_REFS = {};
  function setCooldown(btn, key, totalMs){
    S.cooldowns[key] = now()+totalMs;
    BUTTON_REFS[key] = { btn, total: totalMs, baseText: btn.textContent };
  }

  function updateCooldownVisuals(){
    const entries = Object.entries(BUTTON_REFS);
   
    entries.forEach(([key, ref])=>{
      let t = now();
      const remain = Math.max(0, (S.cooldowns[key]||0) - t);
      const ratio = Math.min(1, remain / ref.total);
      if(ref.btn){
        ref.btn.classList.add('cooldown');
        ref.btn.style.setProperty('--cd', String(ratio));
        const shouldDisable = remain>0;
        if(ref.btn.disabled !== shouldDisable){
          ref.btn.disabled = shouldDisable;
        }
        if(remain>0){
          const secs = Math.ceil(remain/1000);
          const txt = ref.baseText || ref.btn.textContent.replace(/ \(.*\)$/,'');
          ref.btn.textContent = `${txt} (${secs}s)`;
        } else {
          if(ref.baseText) ref.btn.textContent = ref.baseText;
          ref.btn.classList.remove('cooldown');
          ref.btn.style.removeProperty('--cd'); 
        }  
      }
      if(remain<=0){ delete BUTTON_REFS[key];  }
       
    });
  }

  // Regiones andaluzas para expediciones/eventos
  const REGIONS = [
    { name:'Sevilla', emoji:'🏰', unlockDay:1, loot:[{k:'piedra',n:[2,4]},{k:'hierro',n:[1,2]},{k:'renown',n:[1,2]}], events:['Cruzaste el Guadalquivir por un viejo puente.','Un mercader te enseña un truco de forja.'] },
    { name:'Granada', emoji:'🕌', unlockDay:1, loot:[{k:'hierbas',n:[2,3]},{k:'agua',n:[1,2]},{k:'renown',n:[1,3]}], events:['El eco de la Alhambra susurra historias antiguas.','Las Alpujarras te ofrecen senderos y manantiales.'] },
    { name:'Cádiz', emoji:'⚓', unlockDay:1, loot:[{k:'sal',n:[2,3]},{k:'piedra',n:[1,2]},{k:'renown',n:[1,2]}], events:['Las salinas brillan bajo el sol.','Los vientos de la costa te empujan hacia el oeste.'] },
    { name:'Jaén', emoji:'🫒', unlockDay:1, loot:[{k:'aceitunas',n:[2,4]},{k:'hierbas',n:[1,2]},{k:'renown',n:[1,2]}], events:['Un mar de olivos se extiende hasta el horizonte.','Aprendes a podar para mejorar la cosecha.'] },
    { name:'Málaga', emoji:'🏖️', unlockDay:3, loot:[{k:'sal',n:[1,2]},{k:'renown',n:[2,3]}], events:['El viento del levante refresca la costa.'] },
    { name:'Córdoba', emoji:'🏛️', unlockDay:4, loot:[{k:'piedra',n:[2,3]},{k:'renown',n:[2,3]}], events:['Sombras bajo los arcos de la Mezquita.'] },
    { name:'Huelva', emoji:'⛵', unlockDay:5, loot:[{k:'sal',n:[2,3]},{k:'agua',n:[1,2]}], events:['Marismas y esteros te guían.'] },
    { name:'Almería', emoji:'🏜️', unlockDay:6, loot:[{k:'piedra',n:[3,4]},{k:'hierro',n:[1,2]}], events:['Tierras áridas, recursos duros.'] },
    { name:'Toledo', emoji:'🗡️', unlockDay:8, loot:[{k:'hierro',n:[2,3]},{k:'renown',n:[2,3]}], events:['Forjas legendarias te inspiran.'] },
    { name:'Madrid', emoji:'⭐', unlockDay:10, loot:[{k:'renown',n:[3,4]}], events:['Un cruce de caminos te abre oportunidades.'] }
  ];

  const BOSSES = [
    { key:'boss_guadalquivir', name:'La Sombra del Guadalquivir', icon:'🌊', hp:12, duration:90000, region:'Sevilla' },
    { key:'boss_toro', name:'Toro de Fuego', icon:'🐂', hp:20, duration:120000, region:'Jaén' },
    { key:'boss_alhambra', name:'Eco de la Alhambra', icon:'🏯', hp:28, duration:150000, region:'Granada' },
    { key:'boss_cadiz', name:'Dama de Cádiz', icon:'🧜', hp:32, duration:150000, region:'Cádiz' },
    { key:'boss_sierra', name:'Centinela de Sierra Morena', icon:'🌲', hp:18, duration:120000, region:'Sevilla' }
  ];

  // Logros extra (no bosses)
  const EXTRA_ACHIEVEMENTS = [
    { key:'ach_aceitunero', name:'Maestro Aceitunero', icon:'🫒' },
    { key:'ach_acequia', name:'Arquitecto del Agua', icon:'🚰' },
    { key:'ach_herrero', name:'Herrero Mayor', icon:'⚒️' }
  ];

  function spawnBoss(){
    const pool = BOSSES;
    const pick = pool[Math.floor(Math.random()*pool.length)];
    S.threat = { key: pick.key, name: pick.name, icon: pick.icon, hp: pick.hp, max: pick.hp, endsAt: now()+pick.duration, region: pick.region };
    log(`${pick.name} emerge cerca de ${pick.region}.`, 'bad');
    showEncounterPrompt();
    if(!S.stats.bossTipShown){
      tipFooter.textContent = 'Consejo: vuelve cada cierto tiempo para reclamar expediciones y bosses temporales.';
      S.stats.bossTipShown = true;
    }
  }

  let encounterTimer = null;
  function showEncounterPrompt(){
    if(!S.threat) return;
    encounterTitle.textContent = 'Amenaza: ' + S.threat.name;
    encounterInfo.textContent = '¿Deseas enfrentarte ahora mismo?';
    let remain = 10;
    encounterCountdown.textContent = String(remain);
    encounterOverlay.classList.remove('hidden');
    clearInterval(encounterTimer);
    encounterTimer = setInterval(()=>{
      remain--; encounterCountdown.textContent = String(remain);
      if(remain<=0){
        clearInterval(encounterTimer);
        encounterOverlay.classList.add('hidden');
        // Si no aceptas, la amenaza permanece hasta su expiry normal
      }
    }, 1000);
  }

  btnEncAccept.addEventListener('click', ()=>{
    if(encounterTimer) clearInterval(encounterTimer);
    encounterOverlay.classList.add('hidden');
    openCombat();
  });
  btnEncDecline.addEventListener('click', ()=>{
    if(encounterTimer) clearInterval(encounterTimer);
    encounterOverlay.classList.add('hidden');
    log('Has decidido postergar el enfrentamiento.', 'dim');
  });

  function craft(item){
    if(item==='antorchas' && S.resources.lenia>=1 && S.resources.aceitunas>=1){
      S.resources.lenia--; S.resources.aceitunas--; S.resources.antorchas++;
      log('Has fabricado una antorcha.','good');
    }
    if(item==='medicina' && S.resources.hierbas>=2 && S.resources.agua>=1){
      S.resources.hierbas-=2; S.resources.agua--; S.resources.medicina++;
      log('Has preparado una medicina.','good');
    }
    renderResources();
  }

  function build(edificio){
    if(edificio==='molino' && S.resources.piedra>=5){
      S.resources.piedra-=5; S.unlocked.molino=true;
      log('Has construido un molino.','good');
    }
    if(edificio==='acequia' && S.resources.piedra>=3 && S.resources.agua>=2){
      S.resources.piedra-=3; S.resources.agua-=2; S.unlocked.acequia=true;
      log('Has construido una acequia.','good');
      unlockAchievement('ach_acequia','Arquitecto del Agua');
    }
    if(edificio==='fragua' && S.resources.hierro>=5){
      S.resources.hierro-=5; S.unlocked.forge=true;
      log('Has construido una fragua.','good');
      unlockAchievement('ach_herrero','Herrero Mayor');
    }
    renderResources();
  }

  function unlockAchievement(key, text){
    if(!S.achievements[key]){
      S.achievements[key]=true;
      log(`🏅 Logro desbloqueado: ${text}`,'warn');
      toast(`Logro: ${text}`);
      renderAchievements();
    }
  }

  function checkAchievements(){
    if(S.fire.lit && S.fire.heat>=24) unlockAchievement('luzEterna','Primer rayo de sol');
    if(S.resources.aceitunas>=100) unlockAchievement('ach_aceitunero','Maestro Aceitunero');
  }

  function renderAchievements(){
    if(!achEl) return;
    achEl.innerHTML = '';
    // Mostrar todos los bosses como slots
    BOSSES.forEach(b=>{
      const d = document.createElement('div');
      const has = !!S.achievements[b.key];
      d.className = 'ach'+(has?'':' locked');
      d.title = b.name;
      d.textContent = b.icon;
      achEl.appendChild(d);
    });
    // Extra achievements
    EXTRA_ACHIEVEMENTS.forEach(a=>{
      const d = document.createElement('div');
      const has = !!S.achievements[a.key];
      d.className = 'ach'+(has?'':' locked');
      d.title = a.name;
      d.textContent = a.icon;
      achEl.appendChild(d);
    });
  }

  function renderNotes(){
    if(!notesBody) return;
    const heat = Math.floor(S.fire.heat);
    const villagers = S.people.villagers||0;
    const lines = [];
    lines.push(`👥 Aldeanos: aportan producción pasiva de trigo (más con calor). Actual: ${villagers}.`);
    lines.push(`🔥 Fogata: calor ${heat}°. Con calor alto aumenta el ritmo de acequia/molino y la productividad.`);
    lines.push(`🏚️ Molino: transforma trigo de forma pasiva y da renombre.`);
    lines.push(`💧 Acequia: genera agua pasiva con probabilidad por tick.`);
    lines.push(`⚒️ Fragua: pequeñas vetas de hierro pasivas y +1 daño al atacar.`);
    lines.push(`🔥 Antorchas: +1 daño en ataque y se consumen al usar.`);
    notesBody.innerHTML = '<ul style="margin:0;padding-left:18px">'+lines.map(t=>`<li>${t}</li>`).join('')+'</ul>';
  }

  const SCALE = 3.0; // 30% más separación
  const OFFSET_X = -300; 
  const OFFSET_Y = -310;
  
  const REGION_POS = {
    'Sevilla':{x:120*SCALE+OFFSET_X, y:120*SCALE+OFFSET_Y}, 
    'Cádiz':{x:90*SCALE+OFFSET_X, y:160*SCALE+OFFSET_Y}, 
    'Huelva':{x:70*SCALE+OFFSET_X, y:130*SCALE+OFFSET_Y}, 
    'Málaga':{x:160*SCALE+OFFSET_X, y:160*SCALE+OFFSET_Y}, 
    'Córdoba':{x:150*SCALE+OFFSET_X, y:120*SCALE+OFFSET_Y}, 
    'Jaén':{x:190*SCALE+OFFSET_X, y:120*SCALE+OFFSET_Y}, 
    'Granada':{x:200*SCALE+OFFSET_X, y:150*SCALE+OFFSET_Y}, 
    'Almería':{x:230*SCALE+OFFSET_X, y:150*SCALE+OFFSET_Y},
    'Toledo':{x:170*SCALE+OFFSET_X, y:80*SCALE+OFFSET_Y}, 
    'Madrid':{x:190*SCALE+OFFSET_X, y:60*SCALE+OFFSET_Y}
  };

  function getRandomPos(existing, minDist = 40) {
    let x, y, ok = false;
    while (!ok) {
      x = 20 + Math.random() * 260;
      y = 20 + Math.random() * 180;
      ok = existing.every(p => Math.hypot(p.x - x, p.y - y) >= minDist);
    }
    return { x, y };
  }

  function renderMap(){
    if(!mapBody) return;
    const w=300,h=220;
    const unlocked = REGIONS.filter(r=> (r.unlockDay||1) <= S.time.day);
    const placed = [];
    const nodes = unlocked.map(r=>{
      const p = REGION_POS[r.name] || {x: 10+Math.random()*280, y: 10+Math.random()*200};
      const active = (!S.expedition && S.unlocked.expedition);
      const focused = (S.regionFocus===r.name);
      const fill = focused? '#ffe08a' : (active? '#f2a65a' : '#6b7280');
      const stroke = focused? '#f59e0b' : '#1b2636';
      const radius = focused? 12 : 10;
      return `<g data-region="${r.name}" cursor="pointer">
        <circle cx="${p.x}" cy="${p.y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2" />
        <text x="${p.x+12}" y="${p.y+4}" fill="#e9f0ff" font-size="10" font-family="Segoe UI, Arial">${r.emoji} ${r.name}</text>
      </g>`;
    }).join('');
    mapBody.innerHTML = `<svg id="mapSvg" viewBox="0 0 ${w} ${h}" width="100%" height="350px" style="background:#0b1020;border:1px solid #1b2636;border-radius:8px">
      <rect x="0" y="0" width="${w}" height="${h}" fill="#0b1020"/>
      ${nodes}
    </svg>`;
    const svg = document.querySelector('#mapSvg');
    if(svg){
      svg.querySelectorAll('g[data-region]').forEach(g=>{
        g.addEventListener('click', ()=>{
          const regionName = g.getAttribute('data-region');
          const region = REGIONS.find(r=>r.name===regionName);
          if(!region) return;
          // Si hay expedición desbloqueada y libre, permitir organizar desde el mapa
          if(S.unlocked.expedition && !S.expedition){
            const dur = (3 + Math.floor(Math.random()*6)) * 60 * 1000;
            S.expedition = { endsAt: now()+dur, startedAt: now(), region: region.name };
            log(`${region.emoji} Expedición organizada hacia ${region.name} desde el mapa.`,'warn');
            updateTags(); save(); renderActions(); renderMap(); renderNotes();
          } else {
            S.regionFocus = region.name; log(`Región enfocada: ${region.name}.`, 'dim'); save(); renderMap();
          }
        });
      });
    }
    if(mapFooter){
      if(S.unlocked.expedition && !S.expedition && S.regionFocus){
        mapFooter.innerHTML = `<button id="mapExpBtn" class="action" style="width:auto">Organizar expedición a ${S.regionFocus}</button>`;
        const btn = document.querySelector('#mapExpBtn');
        if(btn){
          btn.onclick = ()=>{
            const region = REGIONS.find(r=>r.name===S.regionFocus) || regionPicker();
            const dur = (3 + Math.floor(Math.random()*6)) * 60 * 1000;
            S.expedition = { endsAt: now()+dur, startedAt: now(), region: region.name };
            log(`${region.emoji} Expedición organizada hacia ${region.name}.`,'warn');
            updateTags(); save(); renderActions(); renderMap();
          };
        }
      } else if(S.expedition){
        const remain = S.expedition.endsAt - now();
        mapFooter.textContent = remain>0 ? `Expedición en curso: ${S.expedition.region} (${fmtMs(remain)})` : 'Expedición lista para reclamar en Acciones';
      } else {
        mapFooter.textContent = S.unlocked.expedition ? 'Selecciona una región para enviar una expedición.' : 'Desbloquea expediciones explorando.';
      }
    }
  }

  // Combate por turnos con ASCII
  let combatState = null;
  function openCombat(){
    if(!S.threat) return;
    combatState = { boss: S.threat, turn: 'player' };
    fightTitle.textContent = `Combate: ${S.threat.name}`;
    fightInfo.textContent = 'Turnos: tú actúas primero. Decide atacar, defender o curarte.';
    fightFooter.textContent = `HP Jugador: ${S.player.hp}/${S.player.maxHp} | HP Enemigo: ${combatState.boss.hp}/${combatState.boss.max}`;
    fightOverlay.classList.remove('hidden');
    renderAscii();
  }

  function closeCombat(){
    fightOverlay.classList.add('hidden');
    combatState = null;
    renderActions(); updateTags(); save();
  }

  function enemyTurn(){
    if(!combatState) return;
    const base = 6 + Math.floor(Math.random()*4); // 6-9
    let dmg = base;
    if(S.player.guard){
      dmg = Math.max(0, Math.floor(base*0.3)); // 70% mitigación
      // 30% de posibilidad de riposte por 1 de daño
      if(Math.random()<0.3){
        combatState.boss.hp = Math.max(0, combatState.boss.hp - 1);
        log('Riposte oportuno: devuelves 1 de daño.', 'good');
      }
    }
    S.player.guard = false;
    S.player.hp = Math.max(0, S.player.hp - dmg);
    fightInfo.textContent = `El enemigo ataca y te hace ${dmg} de daño.`;
    fightFooter.textContent = `HP Jugador: ${S.player.hp}/${S.player.maxHp} | HP Enemigo: ${combatState.boss.hp}/${combatState.boss.max}`;
    updateTags();
    renderAscii();
    if(S.player.hp<=0){
      log('Has caído en combate. Pierdes algo de renombre.', 'bad');
      S.stats.renown = Math.max(0, S.stats.renown-2);
      closeCombat();
      return;
    }
    combatState.turn = 'player';
  }

  btnAttack.addEventListener('click', ()=>{
    if(!combatState || combatState.turn!=='player') return;
    const atk = 1 + (S.resources.antorchas>0?1:0) + (S.unlocked.forge?1:0);
    if(S.resources.antorchas>0) S.resources.antorchas--;
    combatState.boss.hp -= atk;
    fightInfo.textContent = `Atacas e infliges ${atk} de daño.`;
    fightFooter.textContent = `HP Jugador: ${S.player.hp}/${S.player.maxHp} | HP Enemigo: ${combatState.boss.hp}/${combatState.boss.max}`;
    renderResources(); renderAscii();
    if(combatState.boss.hp<=0){
      const t = combatState.boss;
      log(`${t.name} ha sido derrotado.`, 'good');
      S.stats.bossesDefeated++;
      if(t.key) unlockAchievement(t.key, `Derrotaste a ${t.name}`);
      S.threat = null;
      bossTag.textContent='👁️ Sin amenaza';
      toast('Has protegido la aldea.');
      closeCombat();
      return;
    }
    combatState.turn = 'enemy';
    setTimeout(enemyTurn, 500);
  });

  btnDefend.addEventListener('click', ()=>{
    if(!combatState || combatState.turn!=='player') return;
    S.player.guard = true;
    fightInfo.textContent = 'Te pones en guardia (mitiga el próximo golpe).';
    combatState.turn = 'enemy';
    setTimeout(enemyTurn, 400);
  });

  btnHeal.addEventListener('click', ()=>{
    if(!combatState || combatState.turn!=='player') return;
    if(S.resources.medicina>0){
      S.resources.medicina--;
      S.player.hp = Math.min(S.player.maxHp, S.player.hp + 20);
      fightInfo.textContent = 'Usas una medicina y recuperas 20 HP.';
      fightFooter.textContent = `HP Jugador: ${S.player.hp}/${S.player.maxHp} | HP Enemigo: ${combatState.boss.hp}/${combatState.boss.max}`;
      renderResources(); updateTags(); save();
      renderAscii();
      combatState.turn = 'enemy';
      setTimeout(enemyTurn, 400);
    } else {
      fightInfo.textContent = 'No te quedan medicinas.';
    }
  });

  function bar(current, max, width){
    const filled = Math.max(0, Math.min(width, Math.round((current/max)*width)));
    return '[' + '#'.repeat(filled) + '-'.repeat(width-filled) + `] ${current}/${max}`;
  }

  function renderAscii(){
    if(!combatState) return;
    const boss = combatState.boss;
    const lines = [];
    lines.push('  +--------------------------------------+');
    lines.push('  | Enemigo                               |');
    lines.push(`  | ${boss.name.padEnd(36,' ')} |`);
    lines.push(`  | ${bar(boss.hp,boss.max,22).padEnd(36,' ')} |`);
    lines.push('  +--------------------------------------+');
    lines.push('');
    lines.push('    (•‿•) Jugador');
    lines.push('    ' + bar(S.player.hp, S.player.maxHp, 22));
    lines.push('');
    lines.push(`    Turno: ${combatState.turn==='player'?'Jugador':'Enemigo'}`);
    fightAscii.textContent = lines.join('\n');
  }

  function renderResources(){
    resEl.innerHTML='';
    for(const [k,v] of Object.entries(S.resources)){
      if(v<=0) continue;
      const meta = RES_META[k]; if(!meta) continue;
      const d=document.createElement('div');d.className='res';
      d.innerHTML=`<b>${meta.icon} ${meta.label}: ${v}</b>`;
      resEl.appendChild(d);
    }
  }

  function markDiscovery(key){
    if(S.discoveries[key]) return;
    S.discoveries[key] = true;
    const meta = RES_META[key];
    if(meta){ log(`Has descubierto ${meta.label.toLowerCase()}.`, 'dim'); }
    renderActions();
  }

  function addRes(key, n){
    S.resources[key] = (S.resources[key]||0) + n;
    if(S.resources[key]>0) markDiscovery(key);
    // Re-render para habilitar crafteo/otras acciones dependientes
    renderResources();
    tryUnlocks();
    renderActions();
  }

  function fmtMs(ms){
    const s = Math.ceil(ms/1000);
    if(s<60) return s+'s';
    const m = Math.floor(s/60); const r = s%60;
    return m+'m'+(r?(' '+r+'s'):'');
  }

  function can(action){
    const t = S.cooldowns[action]||0;
    return now()>=t;
  }

  function setCd(action, ms){
    S.cooldowns[action] = now()+ms;
  }

  function timeLabel(){
    const m = S.time.minutes % (24*60);
    const h = Math.floor(m/60);
    if(h>=6 && h<12) return '🌤️ Mañana';
    if(h>=12 && h<19) return '🌞 Tarde';
    if(h>=19 && h<23) return '🌆 Atardecer';
    return '🌙 Noche';
  }

  function updateTags(){
    fireTag.textContent = S.fire.lit ? `🔥 Lumbre encendida (${Math.floor(S.fire.heat)}°)` : '🔥 Lumbre apagada';
    expeditionTag.textContent = S.expedition ? '🧭 Expedición en curso' : '🧭 Sin expedición';
    bossTag.textContent = S.threat ? `👁️ ${S.threat.name}` : '👁️ Sin amenaza';
    timeOfDay.textContent = timeLabel();
    if(hpTag) hpTag.textContent = `❤️ ${S.player.hp}/${S.player.maxHp}`;
    // Contador de aldeanos en la barra
    if(!villagersTag.parentElement){
      const container = expeditionTag.parentElement || expeditionTag;
      container.parentElement.appendChild(villagersTag);
    }
    villagersTag.textContent = `👥 ${S.people.villagers||0}`;
    renderNotes();
  }

  function tryUnlocks(){
    if(!S.unlocked.water && S.resources.lenia>=3) { S.unlocked.water=true; log('Puedes buscar agua en un arroyo cercano.','dim'); }
    if(!S.unlocked.herbs && S.resources.agua>=2) { S.unlocked.herbs=true; log('Detectas aroma a romero y tomillo en la sierra.','dim'); }
    if(!S.unlocked.olives && S.resources.hierbas>=1) { S.unlocked.olives=true; log('Al sureste hay olivares. Podrías recolectar aceitunas.','dim'); }
    if(!S.unlocked.crafting && (S.resources.aceitunas>=1 && S.resources.lenia>=1)) { S.unlocked.crafting=true; log('Has aprendido a fabricar antorchas y remedios.','good'); }
    if(!S.unlocked.village && S.stats.renown>=5) { S.unlocked.village=true; log('Unos viajantes se unen. Nace una pequeña aldea.','good'); }
    if(!S.unlocked.expedition && S.stats.explore>=8) { S.unlocked.expedition=true; log('Puedes organizar expediciones por Andalucía.','good'); }
  }

  function regionPicker(){
    // Pondera por renombre para abrir variedad
    const unlocked = REGIONS.filter(r=> (r.unlockDay||1) <= S.time.day);
    const idx = Math.min(unlocked.length-1, Math.floor(S.stats.renown/5));
    const slice = unlocked.slice(0, Math.max(2, idx+2));
    return slice[Math.floor(Math.random()*slice.length)];
  }

  function renderActions(){
    actionsEl.innerHTML='';

    // Fuego
    const btnLight = document.createElement('button');
    btnLight.className='action';
    btnLight.textContent = S.fire.lit ? 'Mantener la fogata (+calor)' : 'Encender la fogata';
    btnLight.disabled = !can('stoke') || (!S.fire.lit && S.resources.lenia<=0);
    btnLight.onclick = () => {
      if(!S.fire.lit){
        if(S.resources.lenia<=0) return;
        S.resources.lenia--; S.fire.fuel += 3; S.fire.lit=true; log('Has encendido la fogata. El frío retrocede.','good');
      } else {
        if(S.resources.lenia<=0){ log('No tienes leña suficiente.','warn'); return; }
        S.resources.lenia--; S.fire.fuel += 2; log('Avivas la lumbre.','dim');
      }
      setCd('stoke', 1500);
      renderResources(); updateTags(); save();  
    };
    actionsEl.appendChild(btnLight);

    // Recolecta básica
    const btnWood = document.createElement('button');
    btnWood.className='action';
    btnWood.textContent = can('cut') ? 'Cortar leña' : 'Cortar leña ('+fmtMs(S.cooldowns.cut-now())+')';
    btnWood.disabled = !can('cut');
    btnWood.onclick = () => { 
      const gained = 1 + (Math.random()<0.35?1:0);
      addRes('lenia', gained);
      log(`Recolectas ${gained} leña.`, '');
      setCooldown(btnWood, 'cut', 1800);
      renderResources(); save(); renderActions();
    };
    BUTTON_REFS['cut'] = { btn: btnWood, total: 1800 };
    actionsEl.appendChild(btnWood);

    if(S.unlocked.water){
      const btnWater = document.createElement('button');
      btnWater.className='action';
      btnWater.textContent = can('fetch') ? 'Buscar agua' : 'Buscar agua ('+fmtMs(S.cooldowns.fetch-now())+')';
      btnWater.disabled = !can('fetch');
      btnWater.onclick = () => {
        const gained = 1;
        addRes('agua', gained);
        log('Llenas un odre con agua fresca.', '');
        setCooldown(btnWater, 'fetch', 3000);
        renderResources(); save(); renderActions();
      };
      BUTTON_REFS['fetch'] = { btn: btnWater, total: 3000 };
      actionsEl.appendChild(btnWater);
    }

    if(S.unlocked.herbs){
      const btnHerb = document.createElement('button');
      btnHerb.className='action';
      btnHerb.textContent = can('forage') ? 'Forrajear hierbas' : 'Forrajear hierbas ('+fmtMs(S.cooldowns.forage-now())+')';
      btnHerb.disabled = !can('forage');
      btnHerb.onclick = () => {
        const roll = Math.random();
        if(roll<0.6){ addRes('hierbas', 1); log('Recolectas hierbas aromáticas.', ''); }
        else { addRes('aceitunas', 1); log('Encuentras unas aceitunas maduras.', ''); }
        setCooldown(btnHerb, 'forage', 3500);
        renderResources(); tryUnlocks(); save(); renderActions();
      };
      BUTTON_REFS['forage'] = { btn: btnHerb, total: 3500 };
      actionsEl.appendChild(btnHerb);
    }

    // Explorar
    const btnExplore = document.createElement('button');
    btnExplore.className='action';
    btnExplore.textContent = can('explore') ? 'Explorar los contornos' : 'Explorar ('+fmtMs(S.cooldowns.explore-now())+')';
    btnExplore.disabled = !can('explore');
    btnExplore.onclick = () => {
      const roll = Math.random();
      S.stats.explore++;
      if(roll<0.4){ addRes('piedra', 1); log('Hallaste piedra útil.',''); }
      else if(roll<0.6){ addRes('hierro', 1); log('Recoges vetas de hierro.',''); }
      else { S.stats.renown+=1; log('Ayudas a un viajero; se corre la voz. (+Renombre)','good'); }
      if(!S.threat && Math.random()<0.18){ spawnBoss(); }
      setCooldown(btnExplore, 'explore', 6000);
      renderResources(); tryUnlocks(); updateTags(); save(); renderActions();
    };
    BUTTON_REFS['explore'] = { btn: btnExplore, total: 6000 };
    actionsEl.appendChild(btnExplore);

    // Crafteo
    if(ACTION_LOCKS.crafting()){
      const row = document.createElement('div'); row.className='inline';
      const b1 = document.createElement('button'); b1.className='action'; b1.textContent='Fabricar antorcha (-1 leña, -1 aceituna)';
      b1.disabled = !(S.resources.lenia>=1 && S.resources.aceitunas>=1) || !can('craft');
      b1.onclick = ()=>{ craft('antorchas'); setCooldown(b1, 'craft', 800); renderActions(); save(); renderActions(); };
      const b2 = document.createElement('button'); b2.className='action'; b2.textContent='Preparar medicina (-2 hierbas, -1 agua)';
      b2.disabled = !(S.resources.hierbas>=2 && S.resources.agua>=1) || !can('craft');
      b2.onclick = ()=>{ craft('medicina'); setCooldown(b2, 'craft', 800); renderActions(); save();  renderActions();};
      row.appendChild(b1); row.appendChild(b2);
      actionsEl.appendChild(row);
    }

    // Construcciones (solo visibles al descubrir materiales)
    const buildWrap = document.createElement('div'); buildWrap.className='inline';
    if(S.discoveries && S.discoveries.piedra){
      const bm = document.createElement('button'); bm.className='action'; bm.textContent = 'Construir molino (-5 piedra)';
      bm.disabled = S.unlocked.molino || S.resources.piedra<5;
      bm.onclick = ()=>{ build('molino'); renderActions(); save(); renderActions(); };
      buildWrap.appendChild(bm);
    }
    if(S.discoveries && S.discoveries.agua && S.discoveries.piedra){
      const ba = document.createElement('button'); ba.className='action'; ba.textContent = 'Construir acequia (-3 piedra, -2 agua)';
      ba.disabled = S.unlocked.acequia || !(S.resources.piedra>=3 && S.resources.agua>=2);
      ba.onclick = ()=>{ build('acequia'); renderActions(); save();  renderActions();};
      buildWrap.appendChild(ba);
    }
    if(S.discoveries && S.discoveries.hierro){
      const bf = document.createElement('button'); bf.className='action'; bf.textContent = 'Construir fragua (-5 hierro)';
      bf.disabled = S.unlocked.forge || S.resources.hierro<5;
      bf.onclick = ()=>{ build('fragua'); renderActions(); save(); renderActions(); };
      buildWrap.appendChild(bf);
    }
    if(buildWrap.children.length>0) actionsEl.appendChild(buildWrap);

    // Expediciones andaluzas
    if(S.unlocked.expedition){
      if(!S.expedition){
        const bx = document.createElement('button'); bx.className='action'; bx.textContent='Organizar expedición (3-8 min)';
        bx.onclick = ()=>{
          const region = regionPicker();
          const dur = (3 + Math.floor(Math.random()*6)) * 60 * 1000; // 3-8m
          S.expedition = { endsAt: now()+dur, startedAt: now(), region: region.name };
          log(`${region.emoji} Una expedición parte hacia ${region.name}.`,'warn');
          tipFooter.textContent = 'Vuelve más tarde para reclamar los hallazgos de la expedición.';
          updateTags(); save(); renderActions();
        };
        actionsEl.appendChild(bx);
      } else {
        const remain = S.expedition.endsAt-now();
        const bx = document.createElement('button'); bx.className='action'; bx.textContent = remain>0 ? ('Expedición en curso ('+fmtMs(remain)+')') : 'Reclamar expedición';
        bx.disabled = remain>0;
        bx.onclick = ()=>{
          if(now()<S.expedition.endsAt) return;
          const region = REGIONS.find(r=>r.name===S.expedition.region) || regionPicker();
          // Loot
          region.loot.forEach(item=>{
            const min = item.n[0], max = item.n[1];
            const n = min + Math.floor(Math.random()*(max-min+1));
            if(item.k==='renown'){ S.stats.renown += n; }
            else { addRes(item.k, n); }
          });
          const ev = region.events[Math.floor(Math.random()*region.events.length)];
          log(`${region.emoji} La expedición regresa de ${region.name}: ${ev}`,'good');
          S.expedition = null;
          updateTags(); renderResources(); tryUnlocks(); save(); renderActions();
        };
        actionsEl.appendChild(bx);
      }
    }

    // Boss / Amenaza
    if(S.threat){
      const t = S.threat;
      const remain = t.endsAt-now();
      const bb = document.createElement('button'); bb.className='action';
      bb.textContent = remain>0 ? `Enfrentar: ${t.name} (HP ${t.hp}/${t.max})` : `La amenaza se desvanece`;
      bb.disabled = remain<=0;
      bb.onclick = ()=>{ openCombat(); };
      actionsEl.appendChild(bb);
    }

    // Explorar avanzado (aparece con renombre 6 o expedición)
    if(ACTION_LOCKS.exploreAdvanced()){
      const bAdv = document.createElement('button'); bAdv.className='action'; bAdv.textContent = 'Explorar rutas andaluzas (avanzado)';
      bAdv.onclick = () => {
        const region = regionPicker();
        const roll = Math.random();
        if(roll<0.5){ addRes('piedra', 2); log(`Exploras ${region.name} y recoges materiales.`, ''); }
        else if(roll<0.75){ addRes('hierro', 2); log(`Encuentras mejores vetas en ${region.name}.`, ''); }
        else { S.stats.renown+=2; log(`Te reconocen en ${region.name}. (+2 Renombre)`, 'good'); }
        setCooldown(bAdv, 'explore_adv', 12000); // cansancio más largo
        renderResources(); tryUnlocks(); updateTags(); save();
      };
      BUTTON_REFS['explore_adv'] = { btn: bAdv, total: 12000 };
      actionsEl.appendChild(bAdv);
    }

    // Reclutar aldeano (aparece al desbloquear aldea)
    if(ACTION_LOCKS.recruit()){
      const bVill = document.createElement('button'); bVill.className='action'; bVill.textContent = 'Reclutar aldeano (-2 comida variada)';
      bVill.disabled = !((S.resources.trigo>=1 && S.resources.aceitunas>=1) || (S.resources.trigo>=2) || (S.resources.aceitunas>=2));
      bVill.onclick = ()=>{
        if(S.resources.trigo>=1 && S.resources.aceitunas>=1){ S.resources.trigo--; S.resources.aceitunas--; }
        else if(S.resources.trigo>=2){ S.resources.trigo-=2; }
        else if(S.resources.aceitunas>=2){ S.resources.aceitunas-=2; }
        else return;
        S.people.villagers = (S.people.villagers||0)+1;
        log('Un nuevo aldeano se une a tu poblado.', 'good');
        renderResources(); save(); renderActions();
      };
      actionsEl.appendChild(bVill);
    }
  }

  function gameTick(){
    const nowTs = now();

    // Tiempo
    S.time.minutes += 1;
    if(S.time.minutes>=(24*60)){ S.time.minutes=0; S.time.day++; log('Amanece un nuevo día en Andalucía.','dim'); }

    // Fuego y clima
    if(S.fire.lit){
      if(S.fire.fuel>0){ S.fire.fuel -= 0.05; S.fire.heat = Math.min(30, S.fire.heat + 0.2 + (S.unlocked.molino?0.05:0)); }
      else { S.fire.heat = Math.max(0, S.fire.heat - 0.5); }
      if(S.fire.heat<=0){ S.fire.lit=false; log('La lumbre se ha apagado.','warn'); }
    }

    // Fogata aporta bonus suaves
    const heat = S.fire.heat;
    const heatBonus = heat>20 ? 0.02 : heat>10 ? 0.01 : 0;
    // Efectos idle de edificios y aldeanos
    if(S.unlocked.acequia && Math.random() < (0.05 + heatBonus)) { addRes('agua', 1); }
    if(S.unlocked.molino && Math.random() < (0.05 + heatBonus) && S.resources.trigo>0){ S.resources.trigo--; S.stats.renown+=1; }
    if(S.unlocked.forge && Math.random() < 0.02) { addRes('hierro', 1); }
    // Producción pasiva por aldeanos (mejora con fogata)
    if((S.people.villagers||0)>0 && Math.random() < (0.03 + heatBonus)){
      addRes('trigo', Math.max(1, Math.floor((S.people.villagers||0)/3)));
    }

    // Despawn boss
    if(S.threat && nowTs>=S.threat.endsAt){ log(`${S.threat.name} se desvanece entre la bruma.`, 'dim'); S.threat=null; }

    // Spawns
    // Bosses a partir del día 2
    if(!S.threat && S.time.day>=2 && Math.random()<0.006){ spawnBoss(); }

    updateTags(); renderResources(); checkAchievements(); renderMap(); renderNotes();
    updateCooldownVisuals();
  }

  function resumeIdleProgress(){
    const elapsed = now()-S.lastTick;
    if(elapsed>5000){
      const mins = Math.floor(elapsed/1000);
      S.time.minutes += mins;
      const passiveWood = Math.floor(mins/90); // 1 leña/1.5min
      if(passiveWood>0) S.resources.lenia += passiveWood;
      log(`Has estado fuera ${fmtMs(elapsed)}. Progreso idle aplicado.`, 'dim');
    }
  }

  let audio;
  function startGame(){
    if(S.started) return;
    S.started = true;
    save();
    try{
      if(!audio){
        audio = new Audio('audio1.mp3');
        audio.loop = true;
        audio.volume = 0.28;
      }
      audio.play().catch(()=>{});
    }catch(e){}
    startOverlay.classList.add('hidden');
    log('Despiertas en una habitación fría. Una fogata apagada te acompaña.', '');
  }

  // Inicialización
  function init(){
    resumeIdleProgress();
    renderResources();
    tryUnlocks();
    renderActions();
    renderAchievements();
    updateTags(); renderNotes(); renderMap();
    setInterval(()=>{ gameTick(); S.lastTick = now(); }, 1000);
    setInterval(save, 10000); 
    setInterval(updateCooldownVisuals, 100);
  }

  // Bind inicio
  startBtn.addEventListener('click', startGame);
  if(audioBtn){
    audioBtn.addEventListener('click', ()=>{
      try{
        if(!audio){ audio = new Audio('audio1.mp3'); audio.loop=true; audio.volume=0.28; }
        if(audio.paused){ audio.play().catch(()=>{}); audioBtn.textContent = '🔊 Audio'; }
        else { audio.pause(); audioBtn.textContent = '🔈 Audio'; }
      }catch(e){}
    });
  }

  // Autoinicio si ya se comenzó
  if(S.started){
    startOverlay.classList.add('hidden');
  }

  init();
})();


