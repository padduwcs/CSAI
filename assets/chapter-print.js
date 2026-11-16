/* CSAI — trang in cả chương: tải các bài của chương, ghép thành một trang, rồi mở hộp thoại in. */
document.addEventListener('DOMContentLoaded',async()=>{
  const box=document.getElementById('chapter');
  const q=new URLSearchParams(location.search);
  const CH=window.CSAI_CHAPTERS||[];
  const n=parseInt(q.get('c'),10);
  const ch=CH[n-1];
  if(!ch){box.innerHTML='<p class="ch-status">Không tìm thấy chương. <a href="index.html">Về trang chủ</a>.</p>';return;}

  const [num,name]=ch.name.split(' · ');
  document.title=`${ch.name} (cả chương) · CSAI`;
  const crumb=document.querySelector('.topbar .crumb');if(crumb)crumb.textContent=`${ch.name} · in cả chương`;

  /* Đổi id trong từng bài thành id riêng (b1-…, b2-…) để hình SVG của các bài không lẫn mũi tên/mẫu tô của nhau */
  function scopeIds(html,p){
    const ids=new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
    return html
      .replace(/(\sid=")([^"]+)"/g,(m,a,x)=>`${a}${p}${x}"`)
      .replace(/url\(#([^)]+)\)/g,(m,x)=>ids.has(x)?`url(#${p}${x})`:m)
      .replace(/href="#([^"]+)"/g,(m,x)=>ids.has(x)?`href="#${p}${x}"`:m);
  }

  try{
    const texts=await Promise.all(ch.lessons.map(l=>fetch(l.file).then(r=>{if(!r.ok)throw new Error(l.file);return r.text();})));
    let html=`<header class="hero chapter-cover"><div class="eyebrow">Cơ sở Trí tuệ nhân tạo · theo Stanford CS221</div>
      <h1>${num}: ${name}</h1><p class="lead">Bản in đầy đủ ${ch.lessons.length} bài của chương:</p>
      <ol class="lessons">${ch.lessons.map(l=>`<li>Bài ${l.num}. ${l.title}</li>`).join('')}</ol></header>`;
    texts.forEach((t,i)=>{
      const doc=new DOMParser().parseFromString(t,'text/html');
      const art=doc.querySelector('article.content');
      html+=`<section class="ch-lesson">${art?scopeIds(art.innerHTML,'b'+(i+1)+'-'):''}</section>`;
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

  if(q.get('in')==='1'){
    try{await document.fonts.ready;}catch(e){}
    setTimeout(()=>window.print(),400);
  }
});
