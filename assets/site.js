/* CSAI — dựng khung trang: thanh trên, mục lục, điều hướng, theme, công thức. */
(function(){
  const CHAPTERS=[
    {name:'Chương 1 · Học máy',lessons:[
      {id:'ml-1',file:'ml-1-hoi-quy-phan-loai.html',num:'1.1',title:'Hồi quy và phân loại tuyến tính'},
      {id:'ml-2',file:'ml-2-phi-tuyen-mang-noron.html',num:'1.2',title:'Đặc trưng phi tuyến, mạng nơ-ron, lan truyền ngược'},
      {id:'ml-3',file:'ml-3-tong-quat-hoa-kmeans.html',num:'1.3',title:'Tổng quát hóa, thực hành tốt và k‑means'}]},
    {name:'Chương 2 · Tìm kiếm',lessons:[
      {id:'search-1',file:'search-1-mo-hinh-dp.html',num:'2.1',title:'Mô hình hóa, tìm kiếm trên cây, quy hoạch động'},
      {id:'search-2',file:'search-2-ucs-astar.html',num:'2.2',title:'UCS, học chi phí và A*'}]},
    {name:'Chương 3 · Quyết định Markov',lessons:[
      {id:'mdp-1',file:'mdp-1-mo-hinh-danh-gia.html',num:'3.1',title:'MDP và đánh giá chính sách'},
      {id:'mdp-2',file:'mdp-2-value-iteration-rl.html',num:'3.2',title:'Value iteration và học tăng cường'}]},
    {name:'Chương 4 · Trò chơi',lessons:[
      {id:'games-1',file:'games-1-minimax.html',num:'4.1',title:'Mô hình trò chơi, expectimax, minimax'},
      {id:'games-2',file:'games-2-alphabeta-td.html',num:'4.2',title:'Hàm đánh giá, alpha-beta, TD learning, trò chơi đồng thời'}]}
  ];
  const ALL=CHAPTERS.flatMap(c=>c.lessons);
  window.CSAI_CHAPTERS=CHAPTERS;

  function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}
  const saved=store('csai-theme');
  if(saved==='light'||saved==='dark')document.documentElement.dataset.theme=saved;

  function el(tag,attrs,html){const e=document.createElement(tag);for(const k in attrs||{})e.setAttribute(k,attrs[k]);if(html!=null)e.innerHTML=html;return e;}

  document.addEventListener('DOMContentLoaded',()=>{
    const pageId=document.body.dataset.page||'';
    const cur=ALL.findIndex(l=>l.id===pageId);
    const lesson=ALL[cur];

    /* Thanh trên */
    const hasSide=!!document.getElementById('sidebar');
    const ICON_SIDE='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><line x1="9.5" y1="4.5" x2="9.5" y2="19.5"/></svg>';
    const ICON_THEME='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" style="fill:currentColor"/></svg>';
    const ICON_PRINT='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V4h10v5"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><rect x="7" y="14" width="10" height="6"/></svg>';
    const top=el('header',{class:'topbar'});
    top.innerHTML=`<a class="skip" href="#main">Đến nội dung</a>
      ${hasSide?`<button class="icon-btn side-btn" type="button" aria-controls="sidebar" title="Ẩn/hiện mục lục (phím [ )">${ICON_SIDE}</button>`:''}
      <a class="brand" href="index.html">CSAI</a>
      <span class="crumb">${lesson?(lesson.num+' · '+lesson.title):'Cơ sở Trí tuệ nhân tạo · theo Stanford CS221'}</span>
      <span class="spacer"></span>
      <button class="icon-btn print-btn" type="button" title="In bài (Ctrl+P)" aria-label="In nội dung trang">${ICON_PRINT}</button>
      <button class="icon-btn theme-btn" type="button" title="Giao diện sáng/tối" aria-label="Đổi giao diện sáng/tối">${ICON_THEME}</button>
      <div class="progress"></div>`;
    document.body.prepend(top);

    /* In: luôn in bằng giao diện sáng, xong thì trả lại giao diện đang dùng */
    top.querySelector('.print-btn').addEventListener('click',()=>window.print());
    let themeBeforePrint=null;
    addEventListener('beforeprint',()=>{const r=document.documentElement;if(themeBeforePrint===null)themeBeforePrint=r.dataset.theme||'';r.dataset.theme='light';});
    addEventListener('afterprint',()=>{if(themeBeforePrint===null)return;const r=document.documentElement;if(themeBeforePrint)r.dataset.theme=themeBeforePrint;else delete r.dataset.theme;themeBeforePrint=null;});

    top.querySelector('.theme-btn').addEventListener('click',()=>{
      const dark=document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches);
      const next=dark?'light':'dark';document.documentElement.dataset.theme=next;store('csai-theme',next);
    });

    /* Sidebar */
    const side=document.getElementById('sidebar');
    if(side){
      let h='';
      for(const ch of CHAPTERS){
        h+=`<div class="nav-chapter"><div class="nav-chapter-title">${ch.name}</div>`;
        for(const l of ch.lessons){
          h+=`<a class="nav-lesson${l.id===pageId?' current':''}" href="${l.file}"><span class="num">${l.num}</span><span>${l.title}</span></a>`;
          if(l.id===pageId)h+='<nav class="toc" aria-label="Mục lục bài"></nav>';
        }
        h+='</div>';
      }
      side.innerHTML=`<nav aria-label="Các bài giảng">${h}</nav>`;
      const toc=side.querySelector('.toc');
      const heads=[...document.querySelectorAll('.content h2[id]')];
      if(toc)heads.forEach(hd=>{const a=el('a',{href:'#'+hd.id});a.textContent=hd.textContent.replace(/^\s*\d+\s*/,'');const s=hd.querySelector('.sec');if(s)a.textContent=s.textContent+'. '+[...hd.childNodes].filter(n=>n!==s).map(n=>n.textContent).join('').trim();toc.append(a);});
      /* Ẩn/hiện thanh bên: máy tính thì thu gọn cột (nhớ lựa chọn), điện thoại thì mở dạng lớp phủ */
      const btn=top.querySelector('.side-btn');
      const mobile=()=>matchMedia('(max-width:820px)').matches;
      const B=document.body;
      if(store('csai-nav')==='hidden')B.classList.add('nav-hidden');
      const sync=()=>btn.setAttribute('aria-expanded',String(mobile()?B.classList.contains('nav-open'):!B.classList.contains('nav-hidden')));
      const toggle=()=>{if(mobile())B.classList.toggle('nav-open');else{const h=B.classList.toggle('nav-hidden');store('csai-nav',h?'hidden':'shown');}sync();};
      const close=()=>{B.classList.remove('nav-open');sync();};
      btn.addEventListener('click',toggle);sync();
      side.addEventListener('click',e=>{if(e.target.closest('a')&&mobile())close();});
      document.addEventListener('keydown',e=>{
        if(e.key==='Escape')close();
        if(e.key==='['&&!e.ctrlKey&&!e.metaKey&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))toggle();
      });
      const links=[...side.querySelectorAll('.toc a')];
      const bar=top.querySelector('.progress');
      let tick=false;
      function onScroll(){
        let idx=-1;heads.forEach((hd,i)=>{if(hd.getBoundingClientRect().top<140)idx=i;});
        links.forEach((a,i)=>a.classList.toggle('active',i===idx));
        const d=document.documentElement;const p=d.scrollTop/(d.scrollHeight-d.clientHeight||1);bar.style.width=(Math.min(1,Math.max(0,p))*100)+'%';
        tick=false;
      }
      addEventListener('scroll',()=>{if(!tick){tick=true;requestAnimationFrame(onScroll);}},{passive:true});onScroll();
    }

    /* Điều hướng cuối bài */
    const content=document.querySelector('.content');
    if(content&&cur>=0){
      const pg=el('nav',{class:'pager','aria-label':'Chuyển bài'});
      const prev=ALL[cur-1],next=ALL[cur+1];
      if(prev)pg.append(el('a',{href:prev.file,class:'prev'},`<small>← Bài trước</small><span class="t"><span class="n">${prev.num}</span>${prev.title}</span>`));
      if(next)pg.append(el('a',{href:next.file,class:'next'},`<small>Bài tiếp →</small><span class="t"><span class="n">${next.num}</span>${next.title}</span>`));
      content.append(pg);
    }

    /* Dòng nguồn chỉ hiện khi in, ở cuối bản in: ghi rõ bản online và ngày in */
    const ONLINE='https://padduwcs.github.io/CSAI/'+(location.pathname.split('/').pop()||'')+location.search.replace(/&in=1/,'');
    const body=content||document.querySelector('.home');
    if(body){
      const srcLine=el('div',{class:'print-src'});body.append(srcLine);
      const fill=()=>{srcLine.innerHTML=`In từ CSAI · Bản online: <a href="${ONLINE}">${ONLINE}</a> · Ngày in: ${new Date().toLocaleDateString('vi-VN')}`;};
      fill();addEventListener('beforeprint',fill);
    }

    /* Trang chủ: nút in cả chương ở góc mỗi thẻ chương */
    document.querySelectorAll('.road .ch').forEach((card,i)=>{
      const a=el('a',{class:'icon-btn ch-print',href:`in-chuong.html?c=${i+1}&in=1`,target:'_blank',rel:'noopener',title:`In cả chương ${i+1}`,'aria-label':`In toàn bộ chương ${i+1}`},ICON_PRINT);
      card.append(a);
    });

    /* Hình nhỏ không bị phóng quá cỡ: tối đa ~1.35 lần kích thước thiết kế */
    document.querySelectorAll('figure.fig svg[viewBox]').forEach(s=>{const vb=s.getAttribute('viewBox').split(/[\s,]+/).map(Number);if(vb[2])s.style.maxWidth=Math.round(vb[2]*1.35)+'px';});

    /* Công thức */
    if(window.renderMathInElement){
      renderMathInElement(document.body,{delimiters:[{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false}],throwOnError:false,ignoredClasses:['no-math'],strict:'ignore'});
    }
  });
})();
