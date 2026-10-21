"use strict";
const $=s=>document.querySelector(s), shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const POS={first:0,middle:1,last:2}, EMOJI={CAT:'🐱',BAT:'🦇',SUN:'☀️',DOG:'🐶',PEN:'🖊️',HEN:'🐔',CUP:'☕',BUS:'🚌'};
let db, soundOn=true, audio=null;

/* ---------- storage (IndexedDB) ---------- */
const openDB=()=>new Promise((ok,no)=>{const r=indexedDB.open('ukg-words',1);r.onupgradeneeded=()=>r.result.createObjectStore('q',{keyPath:'id',autoIncrement:true});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
const tx=(mode,f)=>new Promise((ok,no)=>{const t=db.transaction('q',mode),r=f(t.objectStore('q'));t.oncomplete=()=>ok(r.result);t.onerror=()=>no(t.error)});
const getAll=()=>tx('readonly',s=>s.getAll()), put=q=>tx('readwrite',s=>s.put(q)), del=id=>tx('readwrite',s=>s.delete(id));

/* ---------- audio helpers ---------- */
function stopAudio(){if(audio){audio.pause();audio=null}speechSynthesis&&speechSynthesis.cancel()}
function playBlob(b){stopAudio();if(!soundOn||!b)return;audio=new Audio(URL.createObjectURL(b));audio.play().catch(()=>{})}
function speak(t){if(!soundOn||!window.speechSynthesis)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.rate=.85;speechSynthesis.speak(u)}
function tone(ok){if(!soundOn)return;const c=new (window.AudioContext||window.webkitAudioContext)();(ok?[523,659,784]:[262,220]).forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;g.gain.value=.12;o.connect(g);g.connect(c.destination);o.start(c.currentTime+i*.15);o.stop(c.currentTime+i*.15+.14)})}
const playQuestion=q=>q.qAudio?playBlob(q.qAudio):speak(q.instruction||`${q.word} ka letter drop karo.`);
const picHTML=(q,el)=>{el.innerHTML='';if(q.image){const i=new Image();i.alt=q.word;i.src=URL.createObjectURL(q.image);el.append(i)}else el.textContent=EMOJI[q.word]||'❓'};

/* ---------- screens ---------- */
const show=id=>{document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id));stopAudio()};
$('#playBtn').onclick=startGame; $('#again').onclick=startGame; $('#restart').onclick=startGame;
$('#adminBtn').onclick=()=>{show('admin');renderList()};
for(const id of['#homeBtn','#toHome','#adminBack'])$(id).onclick=()=>show('home');
$('#soundBtn').onclick=e=>{soundOn=!soundOn;e.target.textContent=soundOn?'🔊':'🔇';if(!soundOn)stopAudio()};
$('#fsBtn').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();

/* ---------- game ---------- */
let Q=[],qi=0,G,cur,sel,locked,tries;
async function startGame(){
  const list=await getAll();
  if(!list.length){alert('No words yet! Open the Teacher / Parent area and add words (or tap "Add sample words").');return}
  Q=shuffle(list).slice(0,10);qi=0;G={ok:0,bad:0,stars:0};$('#stars').textContent=0;show('game');loadQ();
}
function loadQ(){
  const q=Q[qi];tries=0;sel=null;locked=false;
  const p=q.pos==='random'?Math.random()*3|0:POS[q.pos], ans=q.word[p];
  let opts=q.pos==='random'?[ans,...shuffle(q.options.filter(l=>l!==ans)).slice(0,4)]:[...q.options];
  for(const l of shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')))if(opts.length<5&&!opts.includes(l))opts.push(l);
  cur={q,p,ans,opts:shuffle(opts)};
  $('#progress').textContent=`Question ${qi+1} of ${Q.length}`;$('#msg').textContent='';
  picHTML(q,$('#pic'));
  $('#word').className='word';$('#word').innerHTML=[...q.word].map((l,i)=>i===p?'<span class="slot" id="slot" role="button" aria-label="Answer box"></span>':`<span>${l}</span>`).join('');
  $('#tiles').innerHTML=cur.opts.map((l,i)=>`<div class="tile" data-l="${l}" data-i="${i}">${l}</div>`).join('');
  $('#slot').onclick=()=>{if(!locked)clearSlot()};
  playQuestion(q);
}
const slotEl=()=>$('#slot');
function clearSlot(){sel=null;const s=slotEl();s.textContent='';s.className='slot';document.querySelectorAll('.tile').forEach(t=>t.classList.remove('used'))}
function place(l,i){clearSlot();sel=l;const s=slotEl();s.textContent=l;s.classList.add('filled');document.querySelector(`.tile[data-i="${i}"]`).classList.add('used');$('#msg').textContent=''}
$('#replay').onclick=()=>cur&&playQuestion(cur.q);
$('#tiles').addEventListener('pointerdown',e=>{
  const t=e.target.closest('.tile');if(!t||locked)return;
  const sx=e.clientX,sy=e.clientY;let ghost=null;t.setPointerCapture(e.pointerId);
  t.onpointermove=ev=>{
    if(!ghost&&Math.hypot(ev.clientX-sx,ev.clientY-sy)>8){ghost=t.cloneNode(true);ghost.classList.add('ghost');document.body.append(ghost);t.classList.add('lift')}
    if(ghost){ghost.style.left=ev.clientX+'px';ghost.style.top=ev.clientY+'px'}
  };
  t.onpointerup=ev=>{
    t.onpointermove=t.onpointerup=null;t.classList.remove('lift');
    let hit=true;
    if(ghost){ghost.remove();const r=slotEl().getBoundingClientRect(),m=30;hit=ev.clientX>r.left-m&&ev.clientX<r.right+m&&ev.clientY>r.top-m&&ev.clientY<r.bottom+m}
    if(hit)place(t.dataset.l,t.dataset.i); /* a simple tap also places the letter */
  };
});
$('#submit').onclick=()=>{
  if(locked)return;const s=slotEl();
  if(!sel){$('#msg').textContent='Drop a letter in the box!';speak('Drop a letter in the box');return}
  if(sel===cur.ans){
    locked=true;s.classList.add('good');$('#word').classList.add('done');
    const st=Math.max(1,3-tries);G.ok++;G.stars+=st;$('#stars').textContent=G.stars;
    $('#msg').textContent=['Very good! ⭐','Well done! ⭐⭐','Well done! ⭐⭐⭐'][st>=3?2:st-1===0?0:1];
    tone(true);burst(st+4);setTimeout(()=>{speak('Very good!');setTimeout(()=>cur.q.wAudio&&playBlob(cur.q.wAudio),900)},500);
    setTimeout(next,3200);
  }else{
    tries++;G.bad++;s.classList.remove('filled');s.classList.add('bad');$('#msg').textContent='Try again! 💪';tone(false);speak('Try again!');
    setTimeout(clearSlot,900);
  }
};
$('#next').onclick=next;
function next(){if(!$('#game').classList.contains('active'))return;qi++;qi<Q.length?loadQ():finish()}
function burst(n){const b=$('#burst');for(let i=0;i<n*3;i++){const s=document.createElement('i');s.textContent=['⭐','🌟','✨'][i%3];s.style.left=Math.random()*95+'%';s.style.top=60+Math.random()*35+'%';s.style.animationDelay=Math.random()*.4+'s';b.append(s);setTimeout(()=>s.remove(),2200)}}
function finish(){
  show('result');const n=Q.length;
  $('#summary').innerHTML=`Total questions: <b>${n}</b><br>Correct answers: <b>${G.ok}</b><br>Wrong tries: <b>${G.bad}</b><br>Final score: <b>${Math.round(G.ok/n*100)}%</b><br>Stars earned: <b>${G.stars} ⭐</b><br>${G.ok===n?'Superstar! 🌈':'Great job! Keep practising! 🌟'}`;
  tone(true);speak('Well done!');
}

/* ---------- admin ---------- */
let draft={},editId=null;
$('#optRows').innerHTML=[0,1,2,3,4].map(i=>`<div class="optrow"><input type="text" maxlength="1" class="opt" aria-label="Choice ${i+1}"><input type="radio" name="ans" value="${i}" aria-label="Correct"></div>`).join('');
const optIn=()=>[...document.querySelectorAll('.opt')];
const pick=(el,key)=>el.onchange=()=>{draft[key]=el.files[0]||draft[key];preview()};
pick($('#fImg'),'image');pick($('#fQ'),'qAudio');pick($('#fW'),'wAudio');
['#fWord','#fPos'].forEach(s=>$(s).oninput=preview);
function preview(){
  const w=($('#fWord').value||'???').toUpperCase().padEnd(3,'?'),p=$('#fPos').value==='random'?0:POS[$('#fPos').value];
  picHTML({word:w,image:draft.image},$('#pvPic'));
  $('#pvWord').innerHTML=[...w].map((l,i)=>i===p?'<span class="slot">&nbsp;</span>':`<span>${l}</span>`).join('');
}
$('#pvQ').onclick=()=>draft.qAudio?playBlob(draft.qAudio):alert('No question audio uploaded yet.');
$('#pvW').onclick=()=>draft.wAudio?playBlob(draft.wAudio):alert('No word audio uploaded yet.');
function validate(){
  const e=[],w=[],word=$('#fWord').value.trim().toUpperCase(),o=optIn().map(i=>i.value.trim().toUpperCase()),a=document.querySelector('input[name=ans]:checked'),pos=$('#fPos').value;
  if(!/^[A-Z]{3}$/.test(word))e.push('Word must be exactly 3 letters (A–Z).');
  if(o.some(l=>!/^[A-Z]$/.test(l)))e.push('Enter one letter in each of the 5 choice boxes.');
  else if(new Set(o).size<5)e.push('The 5 choices must all be different.');
  if(!a)e.push('Tick the correct letter.');
  else if(/^[A-Z]{3}$/.test(word)&&pos!=='random'&&o[a.value]!==word[POS[pos]])e.push(`The ticked letter must be ${word[POS[pos]]} for the ${pos} letter of ${word}.`);
  else if(pos==='random'&&/^[A-Z]{3}$/.test(word)&&!o.every(l=>!word.includes(l)||true))e.push('');
  if(!draft.qAudio)w.push('⚠ No question audio uploaded. The computer voice will read the instruction instead.');
  if(!draft.image)w.push('⚠ No picture uploaded.');
  return{e:e.filter(Boolean),w,word,o,a,pos};
}
$('#form').onsubmit=async ev=>{
  ev.preventDefault();const v=validate();
  $('#errors').innerHTML=v.e.map(x=>`<div>✖ ${x}</div>`).join('')+v.w.map(x=>`<div class="w">${x}</div>`).join('');
  if(v.e.length)return;
  const q={...(editId?{id:editId}:{}),word:v.word,category:$('#fCat').value.trim(),pos:v.pos,instruction:$('#fInstr').value.trim()||`${v.word} ka ${v.pos==='random'?'missing':v.pos} letter drop karo.`,options:v.o,answer:v.o[v.a.value],...draft};
  await put(q);resetForm(v.w.join('')?$('#errors').innerHTML:'');renderList();
};
function resetForm(keep=''){editId=null;draft={};$('#form').reset();$('#formTitle').textContent='Add a new word';preview();$('#errors').innerHTML=keep+(keep?'':'')}
$('#cancel').onclick=()=>resetForm();
async function renderList(){
  const f=$('#search').value.toLowerCase(),all=(await getAll()).filter(q=>(q.word+q.category).toLowerCase().includes(f));
  $('#count').textContent=all.length;
  $('#list').innerHTML=all.map(q=>`<div class="item"><span><b>${q.word}</b> · ${q.category||'–'} · ${q.pos}${q.qAudio?'':' ⚠ no audio'}${q.image?'':' ⚠ no picture'}</span><button data-e="${q.id}">Edit</button><button data-d="${q.id}">Delete</button></div>`).join('')||'<p>No words yet. Fill in the form, or tap “Add sample words”.</p>';
}
$('#search').oninput=renderList;
$('#list').onclick=async e=>{
  const d=e.target.dataset.d,ed=e.target.dataset.e;
  if(d&&confirm('Delete this word?')){await del(+d);renderList()}
  if(ed){const q=(await getAll()).find(x=>x.id==ed);editId=q.id;draft={image:q.image,qAudio:q.qAudio,wAudio:q.wAudio};
    $('#fWord').value=q.word;$('#fCat').value=q.category;$('#fPos').value=q.pos;$('#fInstr').value=q.instruction;
    optIn().forEach((i,k)=>i.value=q.options[k]);document.querySelectorAll('input[name=ans]')[q.options.indexOf(q.answer)].checked=true;
    $('#formTitle').textContent='Edit word';preview();scrollTo(0,0)}
};
$('#sample').onclick=async()=>{
  const S=[['CAT','first','CBMST','Animals'],['BAT','middle','AEIOU','Animals'],['SUN','last','NMPTD','Nature'],['DOG','first','DBPSL','Animals'],['PEN','middle','EAIOU','Things'],['HEN','last','NMTPD','Animals'],['CUP','first','CKBMS','Things'],['BUS','last','STMNP','Things']];
  for(const[w,p,o,c]of S)await put({word:w,category:c,pos:p,instruction:`${w} ka ${p} letter drop karo.`,options:[...o],answer:w[POS[p]]});
  renderList();
};
/* export / import (media saved inside the JSON as base64) */
const b2u=b=>b?new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)}):null;
const u2b=u=>u?fetch(u).then(r=>r.blob()):undefined;
$('#export').onclick=async()=>{
  const out=[];for(const q of await getAll())out.push({...q,id:undefined,image:await b2u(q.image),qAudio:await b2u(q.qAudio),wAudio:await b2u(q.wAudio)});
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out)],{type:'application/json'}));a.download='word-quiz-backup.json';a.click();
};
$('#import').onchange=async e=>{
  try{const list=JSON.parse(await e.target.files[0].text());
    for(const q of list)await put({...q,id:undefined,image:await u2b(q.image),qAudio:await u2b(q.qAudio),wAudio:await u2b(q.wAudio)});
    renderList();alert(`Imported ${list.length} words.`)}catch{alert('That file could not be imported.')}
  e.target.value='';
};
openDB().then(d=>{db=d;preview()});
