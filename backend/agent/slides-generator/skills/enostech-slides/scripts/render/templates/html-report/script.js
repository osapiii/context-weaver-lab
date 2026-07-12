'use strict';

// templates/html-report/script.js — core inline JS for the report
module.exports = 
`
(function(){
  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ここでは「すべて開く / すべて閉じる」と TOC ジャンプ時の open 補助だけ実装。
  function openCard(card){ if (card && !card.hasAttribute('open')) card.setAttribute('open', ''); }
  function closeCard(card){ if (card && card.hasAttribute('open')) card.removeAttribute('open'); }

  var btnAll = document.getElementById('btn-expand-all');
  var btnNone = document.getElementById('btn-collapse-all');
  if (btnAll) btnAll.addEventListener('click', function(){
    document.querySelectorAll('details.card').forEach(function(c){ openCard(c); });
  });
  if (btnNone) btnNone.addEventListener('click', function(){
    document.querySelectorAll('details.card').forEach(function(c){ closeCard(c); });
  });

  // 検索フィルタ (シンプル: display 切替)
  var search = document.getElementById('search-input');
  var filterInfo = document.getElementById('filter-info');
  function updateFilterInfo(visible){ if (filterInfo) filterInfo.textContent = visible + ' 件表示しています'; }
  if (search) search.addEventListener('input', function(){
    var q = search.value.trim().toLowerCase();
    var visible = 0;
    document.querySelectorAll('details.card').forEach(function(c){
      var hay = c.getAttribute('data-haystack') || '';
      var show = !q || hay.indexOf(q) >= 0;
      c.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    updateFilterInfo(visible);
  });
  updateFilterInfo(document.querySelectorAll('details.card').length);

  // 表のソート
  document.querySelectorAll('table.sortable').forEach(function(tbl){
    tbl.querySelectorAll('thead th').forEach(function(th){
      th.addEventListener('click', function(){
        var col = parseInt(th.getAttribute('data-col') || '0', 10);
        var asc = !th.classList.contains('asc');
        tbl.querySelectorAll('thead th').forEach(function(t){ t.classList.remove('asc','desc'); });
        th.classList.add(asc ? 'asc' : 'desc');
        var tbody = tbl.querySelector('tbody');
        var rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort(function(a,b){
          var av = a.children[col] ? a.children[col].textContent.trim() : '';
          var bv = b.children[col] ? b.children[col].textContent.trim() : '';
          var an = parseFloat(av.replace(/[,%\\s]/g,''));
          var bn = parseFloat(bv.replace(/[,%\\s]/g,''));
          if (!isNaN(an) && !isNaN(bn)) return asc ? an - bn : bn - an;
          return asc ? av.localeCompare(bv, 'ja') : bv.localeCompare(av, 'ja');
        });
        rows.forEach(function(r){ tbody.appendChild(r); });
      });
    });
  });

  // コードコピー
  document.querySelectorAll('.copy-btn').forEach(function(btn){
    btn.addEventListener('click', function(ev){
      ev.stopPropagation();
      var id = btn.getAttribute('data-target');
      var el = id ? document.getElementById(id) : null;
      if (!el) return;
      var text = el.textContent;
      var done = function(){
        var prev = btn.textContent;
        btn.textContent = 'コピーしました';
        btn.classList.add('is-copied');
        setTimeout(function(){
          btn.textContent = prev;
          btn.classList.remove('is-copied');
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (_e) {}
        document.body.removeChild(ta);
        done();
      }
    });
  });

  // TOC クリック → 該当 details を開いてからスクロール
  document.querySelectorAll('.toc-list a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var id = a.getAttribute('href').slice(1);
      var el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      openCard(el);
      var y = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: prefersReduced ? 'auto' : 'smooth' });
    });
  });

  // ライトボックス
  var lb = document.getElementById('lightbox');
  var lbImg = lb ? lb.querySelector('img') : null;
  var lbCap = lb ? lb.querySelector('.lightbox-caption') : null;
  function openLightbox(src, cap){
    if (!lb || !lbImg) return;
    lbImg.src = src;
    if (lbCap) lbCap.textContent = cap || '';
    lb.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox(){
    if (!lb) return;
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  document.querySelectorAll('.slide-thumb').forEach(function(t){
    t.addEventListener('click', function(e){
      e.stopPropagation();
      var img = t.querySelector('img');
      if (!img) return;
      openLightbox(img.src, t.getAttribute('data-caption') || '');
    });
  });
  if (lb) {
    lb.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeLightbox();
    });
  }
})();
`.trim();
;
