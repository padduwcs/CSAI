/* CSAI — trang cả chương: tải các bài của chương, nối thành một trang để đọc liền mạch hoặc in.
   chuong.html?c=N mở chương N; chuong.html?c=all mở cả khóa học (mọi chương).
   Thêm &in=1 thì tự mở hộp thoại in sau khi tải xong. Bản in có mục lục ở đầu (chỉ hiện khi in). */
document.addEventListener('DOMContentLoaded',async()=>{
  const box=document.getElementById('chapter');
  const q=new URLSearchParams(location.search);
  const CH=window.CSAI_CHAPTERS||[];
  const all=q.get('c')==='all';
  const n=parseInt(q.get('c'),10);
  const chs=all?CH.map((c,i)=>({ch:c,k:i+1})):(CH[n-1]?[{ch:CH[n-1],k:n}]:[]);
  if(!chs.length){box.innerHTML='<p class="ch-status">Không tìm thấy chương. <a href="index.html">Về trang chủ</a>.</p>';return;}

  const split=c=>{const [num,name]=c.name.split(' · ');return {num,name};};
  const crumb=document.querySelector('.topbar .crumb');
  if(all){document.title='Cả khóa học · CSAI';if(crumb)crumb.textContent='Cơ sở Trí tuệ nhân tạo · cả khóa học';}
  else{const c=chs[0].ch;document.title=`${c.name} · CSAI`;if(crumb)crumb.textContent=`${c.name} · cả chương`;}

  /* Đổi id trong từng bài thành id riêng (c1b1-…, c1b2-…) để hình SVG của các bài không lẫn mũi tên/mẫu tô của nhau */
  function scopeIds(html,p){
    const ids=new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
    return html
      .replace(/(\sid=")([^"]+)"/g,(m,a,x)=>`${a}${p}${x}"`)
      .replace(/url\(#([^)]+)\)/g,(m,x)=>ids.has(x)?`url(#${p}${x})`:m)
      .replace(/href="#([^"]+)"/g,(m,x)=>ids.has(x)?`href="#${p}${x}"`:m);
  }
  /* Tên mục: "1. Tiêu đề" từ <h2><span class="sec">1</span>Tiêu đề</h2> */
  const secTitle=h=>{const s=h.querySelector('.sec');const t=[...h.childNodes].filter(x=>x!==s).map(x=>x.textContent).join('').trim();return s?`${s.textContent.trim()}. ${t}`:t;};

  try{
    const lessons=chs.flatMap(({ch,k})=>ch.lessons.map((l,i)=>({l,k,p:`c${k}b${i+1}-`})));
    const texts=await Promise.all(lessons.map(({l})=>fetch(l.file).then(r=>{if(!r.ok)throw new Error(l.file);return r.text();})));
    const arts=texts.map(t=>new DOMParser().parseFromString(t,'text/html').querySelector('article.content'));

    /* Mục lục cho bản in: chương → bài → mục */
    const tocLesson=(x,i)=>{
      const secs=arts[i]?[...arts[i].querySelectorAll('h2[id]')].map(h=>`<li><a href="#${x.p}${h.id}">${secTitle(h)}</a></li>`).join(''):'';
      return `<li class="pt-lesson"><a href="#${x.l.id}"><span class="n">${x.l.num}</span>${x.l.title}</a>${secs?`<ol class="pt-secs">${secs}</ol>`:''}</li>`;
    };
    let toc='<nav class="print-toc" aria-hidden="true"><h2>Mục lục</h2>';
    chs.forEach(({ch,k})=>{
      const items=lessons.map((x,i)=>x.k===k?tocLesson(x,i):'').join('');
      toc+=all?`<div class="pt-ch"><a href="#chuong-${k}">${split(ch).num}: ${split(ch).name}</a></div><ol class="pt-lessons">${items}</ol>`
              :`<ol class="pt-lessons">${items}</ol>`;
    });
    toc+='</nav>';

    let html;
    if(all){
      html=`<header class="hero chapter-cover"><div class="eyebrow">Theo Stanford CS221 (Spring 2025)</div>
        <h1>Cơ sở Trí tuệ nhân tạo</h1><p class="lead">Toàn bộ ${CH.length} chương, ${lessons.length} bài, nối liền trong một trang:</p>
        <ol class="lessons">${chs.map(({ch,k})=>`<li><a href="#chuong-${k}">${ch.name}</a></li>`).join('')}</ol>${toc}</header>`;
    }else{
      const {num,name}=split(chs[0].ch);const ls=chs[0].ch.lessons;
      html=`<header class="hero chapter-cover"><div class="eyebrow">Cơ sở Trí tuệ nhân tạo · theo Stanford CS221</div>
        <h1>${num}: ${name}</h1><p class="lead">Toàn bộ ${ls.length} bài của chương, nối liền trong một trang:</p>
        <ol class="lessons">${ls.map(l=>`<li><a href="#${l.id}">Bài ${l.num}. ${l.title}</a></li>`).join('')}</ol>${toc}</header>`;
    }
    let lastK=0;
    lessons.forEach((x,i)=>{
      if(all&&x.k!==lastK){const {num,name}=split(CH[x.k-1]);html+=`<header class="ch-part" id="chuong-${x.k}"><div class="eyebrow">${num}</div><h1>${name}</h1></header>`;lastK=x.k;}
      html+=`<section class="ch-lesson" id="${x.l.id}">${arts[i]?scopeIds(arts[i].innerHTML,x.p):''}</section>`;
    });
    box.innerHTML=html;
  }catch(e){
    const online='https://padduwcs.github.io/CSAI/'+location.pathname.split('/').pop()+location.search;
    box.innerHTML=`<p class="ch-status">Không tải được các bài (trình duyệt chặn khi mở file trực tiếp trên máy). Hãy dùng bản online: <a href="${online}">${online}</a></p>`;
    return;
  }

  if(window.CSAI_initSims)window.CSAI_initSims(box);
  if(window.renderMathInElement)renderMathInElement(box,{delimiters:[{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false}],throwOnError:false,ignoredClasses:['no-math'],strict:'ignore'});
  box.querySelectorAll('figure.fig svg[viewBox]').forEach(s=>{const vb=s.getAttribute('viewBox').split(/[\s,]+/).map(Number);if(vb[2])s.style.maxWidth=Math.round(vb[2]*1.35)+'px';});
  if(window.CSAI_refreshToc)window.CSAI_refreshToc();

  /* Chuyển sang chương trước/sau */
  if(!all){
    const pg=document.createElement('nav');pg.className='pager';pg.setAttribute('aria-label','Chuyển chương');
    const link=(k,cls,lab)=>{const c=CH[k-1];if(!c)return;const a=document.createElement('a');a.href=`chuong.html?c=${k}`;a.className=cls;a.innerHTML=`<small>${lab}</small><span class="t">${c.name}</span>`;pg.append(a);};
    link(n-1,'prev','← Chương trước');link(n+1,'next','Chương tiếp →');
    box.after(pg);
  }

  if(location.hash){const t=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(t)t.scrollIntoView();}

  if(q.get('in')==='1'){
    try{await document.fonts.ready;}catch(e){}
    setTimeout(()=>window.print(),400);
  }
});
