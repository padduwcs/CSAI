/* CSAI — các mô phỏng từng bước. Mỗi .sim[data-sim] chứa một <script type="application/json"> cấu hình.
   Mọi con số đều được tính bằng code từ cấu hình, không vẽ tay. */
(function(){
'use strict';
const NS='http://www.w3.org/2000/svg';
let UID=0;
function S(tag,attrs,parent,text){const e=document.createElementNS(NS,tag);if(attrs)for(const k in attrs){if(attrs[k]!=null)e.setAttribute(k,attrs[k]);}if(text!=null)e.textContent=text;if(parent)parent.appendChild(e);return e;}
function fmt(x,d){if(d==null)d=2;if(x===Infinity)return '+∞';if(x===-Infinity)return '−∞';if(x==null||Number.isNaN(x))return '?';const m=Math.pow(10,d);let r=Math.round(x*m)/m;if(Object.is(r,-0))r=0;return String(r).replace('-','−');}
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

/* ---------- khung chung ---------- */
function shell(root,o){
  root.innerHTML='';
  const h=document.createElement('div');h.className='sim-h';
  h.innerHTML=`<div class="ttl">${o.title||'Mô phỏng'}${o.sub?`<small>${o.sub}</small>`:''}</div><div class="sim-ctl"></div>`;
  root.append(h);
  if(o.legend){const lg=document.createElement('div');lg.className='legend';lg.innerHTML=o.legend;root.append(lg);}
  const body=document.createElement('div');body.className='sim-body'+(o.stack?' stack':'');
  const viz=document.createElement('div');viz.className='sim-viz';
  const side=document.createElement('div');side.className='sim-side';
  body.append(viz,side);root.append(body);
  const note=document.createElement('div');note.className='sim-note';note.setAttribute('aria-live','polite');root.append(note);
  return {ctl:h.querySelector('.sim-ctl'),viz,side,note,body};
}
function stepper(ctl,onRender){
  const w=document.createElement('span');w.className='sim-ctl';
  w.innerHTML='<button type="button" data-a="reset" title="Về bước đầu">⏮</button><button type="button" data-a="prev">◀ Lùi</button><span class="sim-step"></span><button type="button" class="primary" data-a="next">Bước tiếp ▶</button><button type="button" data-a="end" title="Đến bước cuối">⏭</button>';
  ctl.append(w);
  let steps=[],i=0;const lab=w.querySelector('.sim-step');const B=a=>w.querySelector(`[data-a=${a}]`);
  function go(k){i=Math.max(0,Math.min(steps.length-1,k));lab.textContent=`Bước ${i}/${steps.length-1}`;B('prev').disabled=B('reset').disabled=i===0;B('next').disabled=B('end').disabled=i===steps.length-1;onRender(steps[i],i,steps);}
  w.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;({reset:()=>go(0),prev:()=>go(i-1),next:()=>go(i+1),end:()=>go(steps.length-1)})[b.dataset.a]();});
  const api={set(s){steps=s;go(/(^|[?&#])end$/.test(location.search+location.hash)?s.length-1:0);},go,get i(){return i;},
    /* khi in: nhảy tới bước cuối (giấy không bấm được), in xong trả lại bước cũ */
    toEnd(){if(api.saved==null&&steps.length){api.saved=i;go(steps.length-1);}},
    restore(){if(api.saved!=null){go(api.saved);api.saved=null;}}};
  STEPPERS.push(api);return api;
}
const STEPPERS=[];
addEventListener('beforeprint',()=>STEPPERS.forEach(s=>s.toEnd()));
addEventListener('afterprint',()=>STEPPERS.forEach(s=>s.restore()));
function seg(ctl,options,cur,onChange){
  const s=document.createElement('span');s.className='seg';
  options.forEach(([v,l])=>{const b=document.createElement('button');b.type='button';b.textContent=l;b.dataset.v=v;if(v===cur)b.classList.add('on');s.append(b);});
  s.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;s.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));onChange(b.dataset.v);});
  ctl.append(s);return s;
}
function newSvg(parent,w,h){parent.innerHTML='';return S('svg',{viewBox:`0 0 ${w} ${h}`,role:'img'},parent);}
function haloText(g,x,y,txt,cls,anchor){const t=S('text',{x,y,'text-anchor':anchor||'middle',class:cls||'',style:'paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round'},g,txt);return t;}

/* ---------- Tìm kiếm trên đồ thị: UCS và A* ---------- */
function graphSim(root,cfg){
  const algos=cfg.algos||['ucs'];let algo=cfg.algo||algos[0];
  const NAMES={ucs:'UCS',astar:'A*'};
  const ui=shell(root,{title:cfg.title||'Mô phỏng tìm kiếm',sub:cfg.sub,stack:true,legend:'<span><i style="border-color:var(--chance);background:var(--chance-soft)"></i>Frontier: đã thấy, chờ xét</span><span><i style="border-color:var(--ok);background:var(--ok-soft)"></i>Explored: đã chốt chi phí</span><span><i style="border-color:var(--accent);background:var(--accent)"></i>Đang mở rộng</span>'});
  if(algos.length>1)seg(ui.ctl,algos.map(a=>[a,NAMES[a]]),algo,v=>{algo=v;st.set(build());});
  const st=stepper(ui.ctl,render);
  const adj={};for(const n in cfg.nodes)adj[n]=[];
  cfg.edges.forEach(([u,v,c])=>{adj[u].push([v,c]);if(!cfg.directed)adj[v].push([u,c]);});
  for(const n in adj)adj[n].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  const H=n=>algo==='astar'?((cfg.h&&cfg.h[n])||0):0;
  const copy=o=>JSON.parse(JSON.stringify(o));
  function pathTo(n,ex){const p=[n];let c=n;while(ex[c]&&ex[c].par!=null){c=ex[c].par;p.unshift(c);}return p;}
  function build(){
    const steps=[],fr={},ex={};
    fr[cfg.start]={g:0,par:null};
    steps.push({fr:copy(fr),ex:copy(ex),cur:null,upd:{},note:`Khởi tạo: frontier chỉ chứa trạng thái bắt đầu <b>${cfg.start}</b> với g = 0${algo==='astar'?` (ưu tiên f = g + h = 0 + ${fmt(H(cfg.start))})`:''}. Explored còn rỗng. Bấm “Bước tiếp” để lấy phần tử có ưu tiên nhỏ nhất ra.`});
    for(let guard=0;guard<300;guard++){
      const keys=Object.keys(fr);
      if(!keys.length){steps.push({fr:copy(fr),ex:copy(ex),cur:null,upd:{},note:'Frontier rỗng mà chưa lấy được đích ra: không có đường đi.'});break;}
      keys.sort((a,b)=>(fr[a].g+H(a))-(fr[b].g+H(b))||(a<b?-1:1));
      const s=keys[0],rec=fr[s];delete fr[s];ex[s]=rec;
      const pri=algo==='astar'?`f = ${fmt(rec.g)} + ${fmt(H(s))} = ${fmt(rec.g+H(s))}`:`g = ${fmt(rec.g)}`;
      const tie=keys.length>1&&(fr[keys[1]].g+H(keys[1]))===(rec.g+H(s))?' (hòa điểm ưu tiên, chọn theo thứ tự chữ cái)':'';
      if(s===cfg.goal){const p=pathTo(s,ex);steps.push({fr:copy(fr),ex:copy(ex),cur:s,upd:{},done:p,note:`Lấy <b>${s}</b> ra khỏi frontier (${pri} nhỏ nhất${tie}). ${s} là đích nên dừng. Chi phí tối ưu = <b>${fmt(rec.g)}</b>, đường đi lần ngược theo cột “đến từ”: <b>${p.join(' → ')}</b>. Tổng cộng đã mở rộng <b>${Object.keys(ex).length}</b> trạng thái.`});break;}
      const upd={},parts=[];
      for(const [t,c] of adj[s]){
        if(ex[t]){parts.push(`${t} đã chốt, bỏ qua`);continue;}
        const ng=rec.g+c;
        if(!fr[t]){fr[t]={g:ng,par:s};upd[t]=1;parts.push(`thêm <b>${t}</b>: g = ${fmt(rec.g)} + ${fmt(c)} = ${fmt(ng)}`);}
        else if(ng<fr[t].g){parts.push(`<b>${t}</b> giảm từ ${fmt(fr[t].g)} xuống ${fmt(ng)} (qua ${s} rẻ hơn)`);fr[t]={g:ng,par:s};upd[t]=1;}
        else parts.push(`${t}: ${fmt(rec.g)} + ${fmt(c)} = ${fmt(ng)} không tốt hơn ${fmt(fr[t].g)}, giữ nguyên`);
      }
      steps.push({fr:copy(fr),ex:copy(ex),cur:s,upd,note:`Lấy <b>${s}</b> ra (${pri} nhỏ nhất${tie}) và chốt chi phí ${fmt(rec.g)}. Xét các bước đi từ ${s}: ${parts.length?parts.join('; '):'không có'}.`});
    }
    return steps;
  }
  const xs=Object.values(cfg.nodes).map(p=>p[0]),ys=Object.values(cfg.nodes).map(p=>p[1]);
  const pad=36,minx=Math.min(...xs)-pad,miny=Math.min(...ys)-pad-(cfg.h?12:0),W=Math.max(...xs)-minx+pad,Hh=Math.max(...ys)-miny+pad+14;
  const mid='ar'+(++UID);
  function render(step){
    const svg=newSvg(ui.viz,W,Hh);svg.setAttribute('viewBox',`${minx} ${miny} ${W} ${Hh}`);
    const defs=S('defs',null,svg);const mk=S('marker',{id:mid,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'},defs);S('path',{d:'M0,0L10,5L0,10z',class:'arrow-head'},mk);
    const P=cfg.nodes,R=19;
    const pathSet=new Set();if(step.done)for(let k=1;k<step.done.length;k++)pathSet.add(step.done[k-1]+'>'+step.done[k]);
    const treeSet=new Set();for(const m of [step.ex,step.fr])for(const n in m)if(m[n].par!=null)treeSet.add(m[n].par+'>'+n);
    const ge=S('g',null,svg);
    cfg.edges.forEach(([u,v,c])=>{
      const [x1,y1]=P[u],[x2,y2]=P[v];const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy);
      const a=[x1+dx/L*R,y1+dy/L*R],b=[x2-dx/L*(R+(cfg.directed?3:0)),y2-dy/L*(R+(cfg.directed?3:0))];
      const on=k=>pathSet.has(k)||(!cfg.directed&&pathSet.has(k.split('>').reverse().join('>')));
      const tr=k=>treeSet.has(k)||(!cfg.directed&&treeSet.has(k.split('>').reverse().join('>')));
      const key=u+'>'+v;const cls=on(key)?'s-edge-path':tr(key)?'s-edge-tree':'s-edge';
      S('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:cls,'marker-end':cfg.directed?`url(#${mid})`:null},ge);
      const mx=(x1+x2)/2-dy/L*11,my=(y1+y2)/2+dx/L*11+4;haloText(ge,mx,my,fmt(c),'t-small t-b');
    });
    for(const n in P){
      const [x,y]=P[n];const g=S('g',null,svg);
      let cls='s-node';if(step.ex[n])cls='s-node s-explored';if(step.fr[n])cls='s-node s-frontier';if(step.cur===n)cls='s-node s-current';
      S('circle',{cx:x,cy:y,r:R,class:cls},g);
      if(n===cfg.goal)S('circle',{cx:x,cy:y,r:R+5,fill:'none',class:'ln-dash'},g);
      S('text',{x,y:y+5,'text-anchor':'middle',class:'t-b'+(step.cur===n?' on-current':'')},g,n);
      const rec=step.ex[n]||step.fr[n];
      if(rec)haloText(g,x,y+R+15,'g='+fmt(rec.g),'t-small'+(step.ex[n]?' t-ok':' t-ch')+' t-b');
      if(algo==='astar'&&cfg.h)haloText(g,x,y-R-6,'h='+fmt(cfg.h[n]||0),'t-small t-muted');
    }
    // bảng
    const keys=Object.keys(step.fr).sort((a,b)=>(step.fr[a].g+H(a))-(step.fr[b].g+H(b))||(a<b?-1:1));
    let t=`<h5>Frontier · hàng đợi ưu tiên</h5><table><tr><th>Trạng thái</th><th>g</th>${algo==='astar'?'<th>h</th><th>f = g+h</th>':''}<th>đến từ</th></tr>`;
    if(!keys.length)t+=`<tr><td colspan="5" style="color:var(--muted)">(rỗng)</td></tr>`;
    keys.forEach((k,i)=>{const r=step.fr[k];t+=`<tr class="${i===0?'top':step.upd[k]?'new':''}"><td>${k}</td><td>${fmt(r.g)}</td>${algo==='astar'?`<td>${fmt(H(k))}</td><td>${fmt(r.g+H(k))}</td>`:''}<td>${r.par??'—'}</td></tr>`;});
    t+='</table><p style="margin:-4px 0 10px;color:var(--muted);font-size:.78rem">Dòng tô đậm là phần tử sẽ được lấy ra ở bước tiếp; dòng xanh vừa được thêm/cập nhật.</p>';
    t+=`<h5>Explored · đã chốt (theo thứ tự)</h5><div class="chips">${Object.keys(step.ex).map(k=>`<span class="chip${k===step.cur?' hot':''}">${k}: ${fmt(step.ex[k].g)}</span>`).join('')||'<span style="color:var(--muted)">(rỗng)</span>'}</div>`;
    ui.side.innerHTML=t;ui.note.innerHTML=step.note;
  }
  st.set(build());
}

/* ---------- bố cục cây ---------- */
function layoutTree(root,dx,dy){
  let leaf=0,id=0;const list=[];
  (function walk(n,d,par){n.id=id++;n.d=d;n.par=par;list.push(n);
    if(n.c&&n.c.length){n.c.forEach(ch=>walk(ch,d+1,n));n.x=(n.c[0].x+n.c[n.c.length-1].x)/2;}
    else{n.x=30+leaf*dx;leaf++;}
    n.y=34+d*dy;})(root,0,null);
  return {list,W:Math.max(60,30+(leaf-1)*dx+30),H:34+Math.max(...list.map(n=>n.d))*dy+40};
}

/* ---------- Duyệt cây: DFS và BFS ---------- */
function traverseSim(root,cfg){
  const algos=cfg.algos||['dfs','bfs'];let algo=cfg.algo||algos[0];
  const ui=shell(root,{title:cfg.title||'DFS và BFS',sub:cfg.sub,legend:'<span><i style="border-color:var(--chance);background:var(--chance-soft)"></i>Đang nằm trong stack/queue</span><span><i style="border-color:var(--ok);background:var(--ok-soft)"></i>Đã thăm</span><span><i style="border-color:var(--accent);background:var(--accent)"></i>Vừa lấy ra</span>'});
  seg(ui.ctl,algos.map(a=>[a,a.toUpperCase()]),algo,v=>{algo=v;st.set(build());});
  const st=stepper(ui.ctl,render);
  const L=layoutTree(cfg.tree,58,70);
  function build(){
    const steps=[];let box=[cfg.tree];const order=[];
    const dsName=algo==='dfs'?'stack':'queue';
    steps.push({box:box.map(n=>n.n),order:[],cur:null,note:`Khởi tạo: đưa gốc <b>${cfg.tree.n}</b> vào ${dsName}.`});
    while(box.length){
      const n=algo==='dfs'?box.pop():box.shift();order.push(n.n);
      if(cfg.goal&&n.n===cfg.goal){steps.push({box:box.map(x=>x.n),order:[...order],cur:n.n,done:true,note:`Lấy <b>${n.n}</b> ra: đây là đích, dừng. ${algo.toUpperCase()} đã thăm ${order.length} nút: ${order.join(', ')}.`});return steps;}
      const kids=(n.c||[]);
      if(algo==='dfs')for(let k=kids.length-1;k>=0;k--)box.push(kids[k]);else kids.forEach(k=>box.push(k));
      steps.push({box:box.map(x=>x.n),order:[...order],cur:n.n,note:`Lấy <b>${n.n}</b> ra từ ${algo==='dfs'?'<b>đỉnh stack</b> (vào sau, ra trước)':'<b>đầu queue</b> (vào trước, ra trước)'}. ${kids.length?`Đưa các con ${kids.map(k=>k.n).join(', ')} vào ${dsName}${algo==='dfs'?' theo thứ tự ngược để con trái nằm trên đỉnh':' ở cuối hàng'}.`:'Nút lá, không có con.'}`});
    }
    steps[steps.length-1].note+=' Đã duyệt hết cây.';
    return steps;
  }
  function render(step){
    const svg=newSvg(ui.viz,L.W,L.H);
    L.list.forEach(n=>{if(n.par)S('line',{x1:n.par.x,y1:n.par.y,x2:n.x,y2:n.y,class:'s-edge'},svg);});
    L.list.forEach(n=>{
      const g=S('g',null,svg);let cls='s-node';
      const oi=step.order.indexOf(n.n);
      if(oi>=0)cls+=' s-explored';if(step.box.includes(n.n))cls+=' s-frontier';if(step.cur===n.n)cls='s-node s-current';
      S('circle',{cx:n.x,cy:n.y,r:16,class:cls},g);
      if(cfg.goal===n.n)S('circle',{cx:n.x,cy:n.y,r:21,fill:'none',class:'ln-dash'},g);
      S('text',{x:n.x,y:n.y+5,'text-anchor':'middle',class:'t-b'+(step.cur===n.n?' on-current':'')},g,n.n);
      if(oi>=0)haloText(g,n.x+19,n.y-12,String(oi+1),'t-small t-acc t-b','start');
    });
    const ds=algo==='dfs'?'Stack (đỉnh ở bên phải)':'Queue (đầu hàng ở bên trái)';
    ui.side.innerHTML=`<h5>${ds}</h5><div class="chips">${step.box.map((x,i)=>`<span class="chip${(algo==='dfs'?i===step.box.length-1:i===0)?' hot':''}">${x}</span>`).join('')||'<span style="color:var(--muted)">(rỗng)</span>'}</div><h5>Thứ tự thăm</h5><div class="chips">${step.order.map((x,i)=>`<span class="chip">${i+1}. ${x}</span>`).join('')||'<span style="color:var(--muted)">(chưa có)</span>'}</div><p style="color:var(--muted);font-size:.8rem">Phần tử tô đậm là phần tử sẽ được lấy ra ở bước tiếp.</p>`;
    ui.note.innerHTML=step.note;
  }
  st.set(build());
}

/* ---------- Cây trò chơi: minimax, expectimax, expectiminimax, alpha-beta ---------- */
function gameSim(root,cfg){
  const modes=cfg.modes||['minimax'];let mode=cfg.mode||modes[0];
  const MN={minimax:'Minimax',expectimax:'Expectimax',alphabeta:'Alpha-beta',expectiminimax:'Expectiminimax'};
  const nLeaves=(function cnt(n){return 'v' in n?1:n.c.reduce((x,c)=>x+cnt(c),0);})(cfg.tree);
  const ui=shell(root,{title:cfg.title||'Cây trò chơi',sub:cfg.sub,stack:nLeaves>6,legend:'<span><i style="border-color:var(--max);background:var(--max-soft);border-radius:2px"></i>▲ MAX (agent)</span><span><i style="border-color:var(--min);background:var(--min-soft);border-radius:2px"></i>▼ MIN (đối thủ)</span><span><i style="border-color:var(--chance);background:var(--chance-soft)"></i>● Nút ngẫu nhiên</span>'});
  if(modes.length>1)seg(ui.ctl,modes.map(m=>[m,MN[m]]),mode,v=>{mode=v;st.set(build());});
  const st=stepper(ui.ctl,render);
  const L=layoutTree(cfg.tree,cfg.dx||56,cfg.dy||82);
  let lab=0;const AUTO='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  L.list.forEach(n=>{if(!('v' in n))n.label=n.n||(n.par?AUTO[lab++]:'gốc');});
  const kind=n=>('v' in n)?'leaf':n.t==='max'?'max':n.t==='chance'?'chance':(mode==='expectimax'?'chance':'min');
  const probs=n=>n.p||n.c.map(()=>1/n.c.length);
  const name=n=>n.label;
  function build(){
    const steps=[];const val={},part={},done={},pruned={},ab={};let leafCount=0;
    const snap=(cur,note,extra)=>steps.push(Object.assign({val:{...val},part:{...part},done:{...done},pruned:{...pruned},ab:JSON.parse(JSON.stringify(ab)),cur,note,leaves:leafCount},extra||{}));
    snap(null,mode==='alphabeta'?'Alpha-beta duyệt cây theo chiều sâu (DFS), từ trái sang phải, mang theo khoảng [α, β]: α là mức tốt nhất MAX đã chắc chắn có, β là mức tốt nhất MIN đã chắc chắn có trên đường từ gốc xuống.':'Giá trị ở lá đã biết. Ta tính ngược từ dưới lên: mỗi bước hoàn tất một nút khi mọi con của nó đã có giá trị.');
    if(mode!=='alphabeta'){
      (function ev(n){
        if('v' in n){val[n.id]=n.v;return n.v;}
        const vs=n.c.map(ev);const k=kind(n);let v,expr;
        if(k==='max'){v=Math.max(...vs);expr=`max(${vs.map(x=>fmt(x)).join(', ')})`;}
        else if(k==='min'){v=Math.min(...vs);expr=`min(${vs.map(x=>fmt(x)).join(', ')})`;}
        else{const p=probs(n);v=vs.reduce((s,x,i)=>s+p[i]*x,0);expr=vs.map((x,i)=>`${fmt(p[i],3)}×(${fmt(x)})`).join(' + ');}
        val[n.id]=v;done[n.id]=1;
        const who={max:'MAX — agent chọn con lớn nhất',min:'MIN — đối thủ chọn con nhỏ nhất',chance:n.t==='chance'?'ngẫu nhiên — lấy trung bình có trọng số theo xác suất':'đối thủ được mô hình hóa ngẫu nhiên — lấy trung bình theo xác suất'}[k];
        snap(n.id,`Nút <b>${name(n)}</b> (${who}): ${expr} = <b>${fmt(v)}</b>.`);
        return v;})(cfg.tree);
    }else{
      (function abv(n,a,b){
        if('v' in n){leafCount++;val[n.id]=n.v;return n.v;}
        const isMax=kind(n)==='max';let v=isMax?-Infinity:Infinity;
        ab[n.id]=[a,b];part[n.id]=v;
        snap(n.id,`Vào nút <b>${name(n)}</b> (${isMax?'MAX':'MIN'}) với α = ${fmt(a)}, β = ${fmt(b)}.`);
        for(let i=0;i<n.c.length;i++){
          const ch=n.c[i];const cv=abv(ch,a,b);
          const old=v;v=isMax?Math.max(v,cv):Math.min(v,cv);part[n.id]=v;
          if(isMax)a=Math.max(a,v);else b=Math.min(b,v);ab[n.id]=[a,b];
          let note=`${'v' in ch?`Lá ${fmt(cv)}`:`Con ${name(ch)} trả về ${fmt(cv)}`} → nút <b>${name(n)}</b>: ${isMax?'max':'min'}(${fmt(old)}, ${fmt(cv)}) = ${fmt(v)}, nên ${isMax?`<b>${name(n)} ≥ ${fmt(v)}</b>; α = ${fmt(a)}`:`<b>${name(n)} ≤ ${fmt(v)}</b>; β = ${fmt(b)}`}.`;
          if(a>=b&&i<n.c.length-1){
            const rest=n.c.slice(i+1);rest.forEach(r=>(function mark(x){pruned[x.id]=1;(x.c||[]).forEach(mark);})(r));
            note+=` Vì α = ${fmt(a)} ≥ β = ${fmt(b)}: ${isMax?`MIN phía trên đã có lựa chọn chỉ ${fmt(b)}, không bao giờ để ván đi vào nút này (nơi MAX được ít nhất ${fmt(v)})`:`MAX phía trên đã có lựa chọn ${fmt(a)}, không bao giờ chọn nút này (nơi MIN ép xuống tối đa ${fmt(v)})`}. <b>Cắt tỉa</b> ${rest.length} nhánh còn lại.`;
            snap(n.id,note);break;
          }
          snap(n.id,note);
        }
        val[n.id]=v;done[n.id]=1;delete ab[n.id];delete part[n.id];
        const last=steps[steps.length-1];last.val[n.id]=v;last.done[n.id]=1;delete last.ab[n.id];delete last.part[n.id];last.note+=` Nút ${name(n)} xong: giá trị <b>${fmt(v)}</b>${n.par?`, trả về cho ${name(n.par)}`:''}.`;
        return v;})(cfg.tree,-Infinity,Infinity);
      const total=L.list.filter(n=>'v' in n).length;
      steps[steps.length-1].note+=` Chỉ đọc <b>${leafCount}/${total}</b> lá; kết quả ở gốc giống hệt minimax.`;
    }
    const lastStep=steps[steps.length-1];lastStep.policy=policyEdges();lastStep.final=true;
    return steps;
  }
  function policyEdges(){
    const set={};
    (function walk(n){if('v' in n)return;const k=kind(n);
      if(k==='max'||k==='min'){
        let best=null,bv=null;
        n.c.forEach(ch=>{const v=evalExact(ch);if(best==null||(k==='max'?v>bv:v<bv)){best=ch;bv=v;}});
        set[best.id]=1;walk(best);
      }else n.c.forEach(walk);})(cfg.tree);
    return set;
  }
  function evalExact(n){if('v' in n)return n.v;const vs=n.c.map(evalExact);const k=kind(n);if(k==='max')return Math.max(...vs);if(k==='min')return Math.min(...vs);const p=probs(n);return vs.reduce((s,x,i)=>s+p[i]*x,0);}
  function render(step){
    const svg=newSvg(ui.viz,L.W,L.H);
    L.list.forEach(n=>{if(!n.par)return;
      const g=S('g',{class:step.pruned[n.id]?'s-pruned':null},svg);
      const pol=step.policy&&step.policy[n.id];
      S('line',{x1:n.par.x,y1:n.par.y,x2:n.x,y2:n.y,class:pol?'s-edge-path':'s-edge','stroke-dasharray':step.pruned[n.id]?'4 4':null},g);
      const idx=n.par.c.indexOf(n);let lbl='';
      if(n.par.a)lbl=n.par.a[idx];
      if(kind(n.par)==='chance')lbl=(lbl?lbl+' ':'')+(n.par.pl?n.par.pl[idx]:fmt(probs(n.par)[idx],2));
      if(lbl)haloText(g,(n.par.x*0.45+n.x*0.55)+(n.x<n.par.x?-6:n.x>n.par.x?6:8),(n.par.y*0.45+n.y*0.55),lbl,'t-small t-muted',n.x<n.par.x?'end':n.x>n.par.x?'start':'start');
    });
    L.list.forEach(n=>{
      const g=S('g',{class:step.pruned[n.id]?'s-pruned':null},svg);const k=kind(n);const {x,y}=n;
      if(step.cur===n.id)S('circle',{cx:x,cy:y,r:28,fill:'none',stroke:'var(--accent)','stroke-width':2.5,'stroke-dasharray':'5 3'},g);
      let ty=y+5;
      if(k==='max'){S('polygon',{points:`${x},${y-21} ${x-23},${y+15} ${x+23},${y+15}`,class:'nd-max'},g);ty=y+10;}
      else if(k==='min'){S('polygon',{points:`${x-23},${y-15} ${x+23},${y-15} ${x},${y+21}`,class:'nd-min'},g);ty=y+1;}
      else if(k==='chance')S('circle',{cx:x,cy:y,r:19,class:'nd-ch'},g);
      else S('rect',{x:x-19,y:y-14,width:38,height:28,rx:6,class:'nd'},g);
      let txt='',cls='t-b';
      if(k==='leaf')txt=fmt(n.v);
      else if(step.done[n.id])txt=fmt(step.val[n.id],1);
      else if(step.part[n.id]!=null&&isFinite(step.part[n.id])){txt=(k==='max'?'≥':'≤')+fmt(step.part[n.id]);cls+=' t-acc';}
      else{txt='?';cls='t-muted';}
      S('text',{x,y:ty,'text-anchor':'middle',class:cls,style:'font-size:'+(txt.length>4?'11px':'13px')},g,txt);
      if(k!=='leaf')haloText(g,x+(k==='chance'?24:27),y-14,name(n),'t-small t-muted','start');
      if(step.ab[n.id])haloText(g,x,y-(k==='max'?28:24),`[${fmt(step.ab[n.id][0])}, ${fmt(step.ab[n.id][1])}]`,'t-small t-acc t-b');
    });
    // bảng bên
    let s='';
    if(mode==='alphabeta'){
      const total=L.list.filter(n=>'v' in n).length,pr=L.list.filter(n=>('v' in n)&&step.pruned[n.id]).length;
      s+=`<h5>Đường đệ quy hiện tại</h5><table><tr><th>Nút</th><th>Loại</th><th>α</th><th>β</th></tr>`;
      const act=L.list.filter(n=>step.ab[n.id]);
      s+=act.length?act.map(n=>`<tr${n.id===step.cur?' class="top"':''}><td>${name(n)}</td><td>${kind(n).toUpperCase()}</td><td>${fmt(step.ab[n.id][0])}</td><td>${fmt(step.ab[n.id][1])}</td></tr>`).join(''):'<tr><td colspan="4" style="color:var(--muted)">(trống)</td></tr>';
      s+=`</table><h5>Thống kê</h5><p style="margin:0">Đã đọc <b>${step.leaves}</b> lá · đã cắt <b>${pr}</b>/${total} lá.</p><p style="color:var(--muted);font-size:.8rem">“≥ 3” ở nút MAX nghĩa là giá trị chắc chắn ít nhất 3; “≤ 2” ở nút MIN nghĩa là chắc chắn nhiều nhất 2.</p>`;
    }else{
      s+=`<h5>Các nút đã tính</h5><table><tr><th>Nút</th><th>Loại</th><th class="n">Giá trị</th></tr>`;
      const dn=L.list.filter(n=>step.done[n.id]);
      s+=dn.length?dn.map(n=>`<tr${n.id===step.cur?' class="top"':''}><td>${name(n)}</td><td>${{max:'MAX',min:'MIN',chance:'Kỳ vọng'}[kind(n)]}</td><td class="n">${fmt(step.val[n.id])}</td></tr>`).join(''):'<tr><td colspan="3" style="color:var(--muted)">(chưa có)</td></tr>';
      s+='</table>';
    }
    if(step.final)s+=`<p style="margin-top:8px"><b>Đường tô xanh</b>: ${mode==='minimax'||mode==='alphabeta'?'nước đi tối ưu của cả hai bên':'hành động tối ưu của agent tại các nút MAX'}.</p>`;
    ui.side.innerHTML=s;ui.note.innerHTML=step.note;
  }
  st.set(build());
}

/* ---------- Value iteration ---------- */
function viSim(root,cfg){
  const ui=shell(root,{title:cfg.title||'Value iteration',sub:cfg.sub,stack:true});
  const st=stepper(ui.ctl,render);
  const states=cfg.states,ends=new Set(cfg.end||[]),g=cfg.gamma==null?1:cfg.gamma,T=cfg.T;
  let focus=cfg.focus||states.find(s=>!ends.has(s));
  const sel=document.createElement('label');sel.innerHTML='Xem chi tiết trạng thái <select>'+states.filter(s=>!ends.has(s)).map(s=>`<option${s===focus?' selected':''}>${s}</option>`).join('')+'</select>';
  ui.ctl.prepend(sel);sel.querySelector('select').addEventListener('change',e=>{focus=e.target.value;st.go(st.i);});
  const V=[Object.fromEntries(states.map(s=>[s,0]))],PI=[{}];
  const Q=(s,a,Vp)=>T[s][a].reduce((acc,[s2,p,r])=>acc+p*(r+g*Vp[s2]),0);
  for(let t=1;t<=(cfg.iters||10);t++){
    const Vp=V[t-1],Vn={},pn={};
    states.forEach(s=>{if(ends.has(s)){Vn[s]=0;return;}let best=-Infinity,ba=null;for(const a in T[s]){const q=Q(s,a,Vp);if(q>best+1e-12){best=q;ba=a;}}Vn[s]=best;pn[s]=ba;});
    V.push(Vn);PI.push(pn);
  }
  const steps=V.map((v,t)=>({t}));
  function render(step){
    const t=step.t;
    let h=`<div class="tbl-wrap" style="margin:0"><table class="tbl"><tr><th>Vòng t</th>${states.map(s=>`<th class="n">V<sub>t</sub>(${s})</th>`).join('')}</tr>`;
    const from=Math.max(0,t-5);
    if(from>0)h+=`<tr><td colspan="${states.length+1}" style="color:var(--muted)">… (ẩn ${from} vòng đầu)</td></tr>`;
    for(let k=from;k<=t;k++)h+=`<tr class="${k===t?'hl':''}"><td>${k}</td>${states.map(s=>`<td class="n">${ends.has(s)?'0':fmt(V[k][s])}</td>`).join('')}</tr>`;
    if(t>0)h+=`<tr class="good"><td>π<sub>${t}</sub></td>${states.map(s=>`<td class="n">${ends.has(s)?'—':PI[t][s]}</td>`).join('')}</tr>`;
    h+='</table></div>';ui.viz.innerHTML=h;
    if(t===0){ui.side.innerHTML='<p style="margin:0">Vòng 0: chưa nhìn được bước nào về tương lai, nên mọi giá trị khởi tạo bằng 0.</p>';ui.note.innerHTML='Bấm “Bước tiếp” để thực hiện một vòng cập nhật Bellman cho mọi trạng thái.';return;}
    const Vp=V[t-1],s=focus;
    let d=`<h5>Chi tiết tại trạng thái ${s}, vòng ${t} (dùng V<sub>${t-1}</sub>)</h5>`;
    for(const a in T[s]){
      const terms=T[s][a].map(([s2,p,r])=>`${fmt(p,3)}·(${fmt(r)} + ${fmt(g,3)}·${fmt(Vp[s2])})`).join(' + ');
      d+=`<p style="margin:.3rem 0">Q(${s}, <b>${a}</b>) = ${terms} = <b>${fmt(Q(s,a,Vp))}</b></p>`;
    }
    d+=Object.keys(T[s]).length>1?`<p style="margin:.3rem 0">⇒ V<sub>${t}</sub>(${s}) = max các Q = <b>${fmt(V[t][s])}</b>, chọn <b>${PI[t][s]}</b>.</p>`:`<p style="margin:.3rem 0">⇒ V<sub>${t}</sub>(${s}) = <b>${fmt(V[t][s])}</b> (chính sách cố định chọn ${PI[t][s]}).</p>`;
    ui.side.innerHTML=d;
    const diff=Math.max(...states.map(x=>Math.abs(V[t][x]-Vp[x])));
    ui.note.innerHTML=`Vòng ${t}: mỗi trạng thái nhìn xa thêm một bước, dùng bảng giá trị của vòng trước. Thay đổi lớn nhất so với vòng trước: <b>${fmt(diff,4)}</b>${diff<1e-3?' — gần như không đổi nữa, giá trị đã hội tụ.':'.'}`;
  }
  st.set(steps);
}

/* ---------- Gradient descent cho hồi quy tuyến tính ---------- */
function gdSim(root,cfg){
  const ui=shell(root,{title:cfg.title||'Gradient descent',sub:cfg.sub});
  const pts=cfg.points,n=pts.length;let eta=cfg.eta||0.1,mode=cfg.mode||'gd';let w,hist,ptr,last;
  seg(ui.ctl,[['gd','Gradient descent'],['sgd','SGD']],mode,v=>{mode=v;reset();});
  const lab=document.createElement('label');lab.innerHTML=`η <input type="range" min="0.01" max="${cfg.etaMax||0.3}" step="0.01" value="${eta}"><output>${eta}</output>`;ui.ctl.append(lab);
  lab.querySelector('input').addEventListener('input',e=>{eta=+e.target.value;lab.querySelector('output').textContent=eta.toFixed(2);reset();});
  const bw=document.createElement('span');bw.className='sim-ctl';bw.innerHTML='<button type="button" data-a="r">⏮ Đặt lại</button><button type="button" class="primary" data-a="s">Bước tiếp ▶</button><button type="button" data-a="m">+10 bước</button>';ui.ctl.append(bw);
  bw.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.a==='r')reset();if(b.dataset.a==='s')step(1);if(b.dataset.a==='m')step(10);});
  const loss=w=>pts.reduce((s,[x,y])=>s+Math.pow(w[0]+w[1]*x-y,2),0)/n;
  function reset(){w=(cfg.w||[0,0]).slice();hist=[{w:w.slice(),L:loss(w)}];ptr=0;last=null;draw();}
  function step(k){
    for(let i=0;i<k;i++){
      let g0=0,g1=0,used;
      if(mode==='gd'){pts.forEach(([x,y])=>{const r=w[0]+w[1]*x-y;g0+=2*r/n;g1+=2*r*x/n;});used='tất cả '+n+' điểm';}
      else{const [x,y]=pts[ptr%n];const r=w[0]+w[1]*x-y;g0=2*r;g1=2*r*x;used=`điểm (${x}, ${y})`;ptr++;}
      last={w:w.slice(),g:[g0,g1],used};
      w=[w[0]-eta*g0,w[1]-eta*g1];hist.push({w:w.slice(),L:loss(w)});
      if(!isFinite(w[0])||Math.abs(w[0])>1e6)break;
    }
    draw();
  }
  /* khi in: chạy tiếp tới lúc hội tụ (tối đa 200 bước) để giấy in ra trạng thái cuối; in xong trả lại như cũ */
  let saved=null;
  STEPPERS.push({
    toEnd(){if(saved)return;saved={w:w.slice(),hist:hist.slice(),ptr,last};
      for(let t=hist.length-1;t<200;t++){const a=hist[hist.length-1].L;step(1);const b=hist[hist.length-1].L;if(!isFinite(b)||Math.abs(a-b)<1e-7)break;}},
    restore(){if(!saved)return;({w,hist,ptr,last}=saved);w=w.slice();saved=null;draw();}});
  const xr=cfg.xr||[0,5],yr=cfg.yr||[0,5];
  function draw(){
    const Wd=420,Hd=300,ml=36,mb=30,mt=12,mr=12;
    const X=x=>ml+(x-xr[0])/(xr[1]-xr[0])*(Wd-ml-mr),Y=y=>Hd-mb-(y-yr[0])/(yr[1]-yr[0])*(Hd-mb-mt);
    const svg=newSvg(ui.viz,Wd,Hd);
    for(let x=Math.ceil(xr[0]);x<=xr[1];x++){S('line',{x1:X(x),x2:X(x),y1:Y(yr[0]),y2:Y(yr[1]),class:'grid'},svg);S('text',{x:X(x),y:Hd-mb+16,'text-anchor':'middle',class:'t-small t-muted'},svg,x);}
    for(let y=Math.ceil(yr[0]);y<=yr[1];y++){S('line',{x1:X(xr[0]),x2:X(xr[1]),y1:Y(y),y2:Y(y),class:'grid'},svg);S('text',{x:ml-8,y:Y(y)+4,'text-anchor':'end',class:'t-small t-muted'},svg,y);}
    S('text',{x:Wd-mr,y:Hd-mb-6,'text-anchor':'end',class:'t-small t-muted'},svg,'x');S('text',{x:ml+6,y:mt+10,class:'t-small t-muted'},svg,'y');
    const f=x=>w[0]+w[1]*x;
    if(isFinite(w[0])){
      pts.forEach(([x,y])=>S('line',{x1:X(x),y1:Y(y),x2:X(x),y2:Y(f(x)),class:'ln-min','stroke-dasharray':'3 3'},svg));
      const cl=v=>Math.max(-1e4,Math.min(1e4,v));
      S('line',{x1:X(xr[0]),y1:cl(Y(f(xr[0]))),x2:X(xr[1]),y2:cl(Y(f(xr[1]))),class:'ln-acc'},svg);
    }
    pts.forEach(([x,y],i)=>S('circle',{cx:X(x),cy:Y(y),r:6,class:mode==='sgd'&&last&&last.used.includes(`(${x}, ${y})`)?'f-min':'f-ink'},svg));
    // đồ thị loss nhỏ
    const L=hist.map(h=>h.L),k=L.length;
    let s=`<h5>Tham số và loss</h5><table><tr><th>t</th><th>w₀ (chặn)</th><th>w₁ (dốc)</th><th>TrainLoss</th></tr>`;
    hist.slice(-6).forEach((h,i,arr)=>{const t=k-arr.length+i;s+=`<tr${i===arr.length-1?' class="top"':''}><td>${t}</td><td>${fmt(h.w[0],3)}</td><td>${fmt(h.w[1],3)}</td><td>${fmt(h.L,3)}</td></tr>`;});
    s+='</table><h5>TrainLoss theo số bước</h5>';
    const cw=260,ch=90,mx=Math.max(...L.filter(isFinite).slice(0,200),1e-9);
    s+=`<svg viewBox="0 0 ${cw} ${ch}" style="width:100%;height:auto"><line x1="0" y1="${ch-1}" x2="${cw}" y2="${ch-1}" class="grid"/>`;
    const pl=L.slice(0,200).map((v,i)=>`${(i/Math.max(1,Math.min(199,k-1)))*(cw-4)+2},${ch-4-Math.min(1,v/mx)*(ch-10)}`).join(' ');
    s+=`<polyline points="${pl}" class="ln-acc" style="stroke-width:2"/></svg>`;
    ui.side.innerHTML=s;
    if(!last){ui.note.innerHTML=`Bắt đầu từ w = (${fmt(w[0])}, ${fmt(w[1])}): đường dự đoán ${w[1]===0&&w[0]===0?'nằm sát trục hoành':''}. Các đoạn đỏ đứt là sai số của từng điểm. Bấm “Bước tiếp” để đi một bước ngược hướng gradient.`;return;}
    const div=!isFinite(hist[hist.length-1].L)||hist[hist.length-1].L>hist[0].L*10;
    ui.note.innerHTML=`Bước vừa rồi dùng <b>${last.used}</b>: gradient = (${fmt(last.g[0],3)}, ${fmt(last.g[1],3)}). Cập nhật w ← w − η·∇ = (${fmt(last.w[0],3)} − ${eta.toFixed(2)}×${fmt(last.g[0],3)}, ${fmt(last.w[1],3)} − ${eta.toFixed(2)}×${fmt(last.g[1],3)}) = (<b>${fmt(w[0],3)}</b>, <b>${fmt(w[1],3)}</b>).${div?' <b style="color:var(--min)">Loss đang tăng vọt: η quá lớn khiến mỗi bước nhảy vượt qua đáy rồi văng xa hơn.</b>':''}`;
  }
  reset();
}

/* ---------- k-means ---------- */
function kmeansSim(root,cfg){
  const ui=shell(root,{title:cfg.title||'k-means',sub:cfg.sub});
  const st=stepper(ui.ctl,render);
  const pts=cfg.points,K=cfg.init.length;const COL=['var(--max)','var(--min)','var(--ok)','var(--violet)'];
  const d2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
  const steps=[];let mu=cfg.init.map(m=>m.slice()),z=pts.map(()=>-1);
  const lossOf=(z,mu)=>z.reduce((s,k,i)=>k<0?s:s+d2(pts[i],mu[k]),0);
  steps.push({mu:mu.map(m=>m.slice()),z:z.slice(),phase:'init',note:`Khởi tạo ${K} tâm cụm (dấu ✕). Chưa điểm nào được gán cụm.`});
  for(let it=0;it<10;it++){
    const nz=pts.map(p=>{let b=0;for(let k=1;k<K;k++)if(d2(p,mu[k])<d2(p,mu[b]))b=k;return b;});
    const changed=nz.some((k,i)=>k!==z[i]);z=nz;
    steps.push({mu:mu.map(m=>m.slice()),z:z.slice(),phase:'assign',loss:lossOf(z,mu),note:`<b>Bước gán (cố định tâm, chọn z):</b> mỗi điểm về cụm có tâm gần nhất. ${changed?'Có điểm đổi cụm.':'Không điểm nào đổi cụm: thuật toán đã hội tụ.'} Loss = tổng bình phương khoảng cách = <b>${fmt(lossOf(z,mu))}</b>.`});
    if(!changed&&it>0)break;
    mu=mu.map((m,k)=>{const mem=pts.filter((p,i)=>z[i]===k);if(!mem.length)return m;return [mem.reduce((s,p)=>s+p[0],0)/mem.length,mem.reduce((s,p)=>s+p[1],0)/mem.length];});
    steps.push({mu:mu.map(m=>m.slice()),z:z.slice(),phase:'update',loss:lossOf(z,mu),note:`<b>Bước cập nhật (cố định z, chọn tâm):</b> mỗi tâm dời về trung bình cộng các điểm của cụm mình. Loss giảm còn <b>${fmt(lossOf(z,mu))}</b>.`});
  }
  const xr=cfg.xr||[0,10],yr=cfg.yr||[0,8];
  function render(step){
    const Wd=420,Hd=300,m=26;const X=x=>m+(x-xr[0])/(xr[1]-xr[0])*(Wd-2*m),Y=y=>Hd-m-(y-yr[0])/(yr[1]-yr[0])*(Hd-2*m);
    const svg=newSvg(ui.viz,Wd,Hd);
    for(let x=xr[0];x<=xr[1];x+=2)S('line',{x1:X(x),x2:X(x),y1:Y(yr[0]),y2:Y(yr[1]),class:'grid'},svg);
    for(let y=yr[0];y<=yr[1];y+=2)S('line',{x1:X(xr[0]),x2:X(xr[1]),y1:Y(y),y2:Y(y),class:'grid'},svg);
    if(step.phase!=='init')pts.forEach((p,i)=>{const c=step.mu[step.z[i]];S('line',{x1:X(p[0]),y1:Y(p[1]),x2:X(c[0]),y2:Y(c[1]),stroke:COL[step.z[i]],'stroke-width':1.2,'stroke-dasharray':'3 3',opacity:.6},svg);});
    pts.forEach((p,i)=>S('circle',{cx:X(p[0]),cy:Y(p[1]),r:6.5,fill:step.z[i]<0?'var(--muted)':COL[step.z[i]],stroke:'var(--surface)','stroke-width':1.5},svg));
    step.mu.forEach((c,k)=>{const x=X(c[0]),y=Y(c[1]);S('path',{d:`M${x-9},${y-9}L${x+9},${y+9}M${x+9},${y-9}L${x-9},${y+9}`,stroke:COL[k],'stroke-width':4,'stroke-linecap':'round'},svg);});
    let s='<h5>Tâm cụm</h5><table><tr><th>Cụm</th><th>Tâm μ</th><th>Số điểm</th></tr>';
    step.mu.forEach((c,k)=>{s+=`<tr><td><span style="color:${COL[k]}">●</span> ${k+1}</td><td>(${fmt(c[0])}, ${fmt(c[1])})</td><td>${step.z.filter(v=>v===k).length}</td></tr>`;});
    s+='</table>';if(step.loss!=null)s+=`<p>Loss hiện tại: <b>${fmt(step.loss)}</b></p>`;
    ui.side.innerHTML=s;ui.note.innerHTML=step.note;
  }
  st.set(steps);
}

const REG={graph:graphSim,traverse:traverseSim,game:gameSim,vi:viSim,gd:gdSim,kmeans:kmeansSim};
function initSims(scope){
  scope.querySelectorAll('.sim[data-sim]').forEach(root=>{
    const sc=root.querySelector('script[type="application/json"]');
    try{const cfg=sc?JSON.parse(sc.textContent):{};REG[root.dataset.sim](root,cfg);}
    catch(e){console.error(e);root.insertAdjacentHTML('beforeend','<p class="sim-note">Không tải được mô phỏng: '+esc(e.message)+'</p>');}
  });
}
window.CSAI_initSims=initSims;  /* trang in cả chương gọi lại sau khi ghép bài */
document.addEventListener('DOMContentLoaded',()=>initSims(document));
})();
