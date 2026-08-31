/* ============================================================
   海南中学 · 公共交互
   导航 / 滚动显现 / 视差 / 新闻 / Gallery / 地图 / 时间轴 / 彩蛋
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(hover: none)').matches;

  /* ---------- 性能分级 ---------- */
  var perf = (function () {
    var cores = navigator.hardwareConcurrency || 4;
    var mem = navigator.deviceMemory || 4;
    var low = cores <= 4 || mem <= 4;
    if (low) document.documentElement.classList.add('perf-lite');
    return low ? 'lite' : 'full';
  })();

  /* ---------- 导航：滚动状态 ---------- */
  var nav = $('#nav');
  var heroEl = $('#hero');
  function updateNav() {
    var y = window.pageYOffset;
    nav.classList.toggle('is-scrolled', y > 40);
    // 浅色页面上未滚动时导航用深色字
    if (heroEl) {
      nav.classList.add('is-light');
    }
    var topBtn = $('#toTop');
    if (topBtn) topBtn.classList.toggle('is-on', y > 700);
  }
  updateNav();
  window.addEventListener('scroll', updateNav, { passive: true });

  /* ---------- 全屏菜单 ---------- */
  var burger = $('#burger');
  var menu = $('#menu');
  if (burger && menu) {
    var open = false;
    function setMenu(v) {
      open = v;
      burger.setAttribute('aria-expanded', String(v));
      burger.setAttribute('aria-label', v ? '关闭菜单' : '打开菜单');
      if (v) { menu.hidden = false; requestAnimationFrame(function () { menu.classList.add('is-open'); }); }
      else { menu.classList.remove('is-open'); setTimeout(function () { if (!open) menu.hidden = true; }, 560); }
      document.body.classList.toggle('no-scroll', v);
    }
    burger.addEventListener('click', function () { setMenu(!open); });
    $$('.menu-item a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) setMenu(false);
    });
  }

  /* ---------- 滚动显现 ---------- */
  var revealIO = null;
  if ('IntersectionObserver' in window) {
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    $$('.reveal, .reveal-scale').forEach(function (el) { revealIO.observe(el); });
  } else {
    $$('.reveal, .reveal-scale').forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- 视差（轻度） ---------- */
  var parallaxEls = $$('[data-parallax]');
  if (parallaxEls.length && !reduced) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.pageYOffset;
        parallaxEls.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
          var rate = parseFloat(el.getAttribute('data-parallax')) || 0.2;
          el.style.transform = 'translate3d(0,' + (y - (el.offsetTop || 0)) * rate * 0.35 + 'px,0)';
        });
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- Hero 标题逐字 ---------- */
  var heroTitle = $('#heroTitle');
  if (heroTitle && !reduced) {
    var text = heroTitle.textContent.trim();
    heroTitle.textContent = '';
    heroTitle.setAttribute('aria-label', text);
    text.split('').forEach(function (ch, i) {
      var s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch;
      s.style.animationDelay = (0.25 + i * 0.11) + 's';
      heroTitle.appendChild(s);
    });
    ['#heroEyebrow', '#heroEn', '#heroLede', '#heroActions'].forEach(function (sel, i) {
      var el = $(sel);
      if (!el) return;
      el.style.opacity = 0;
      el.style.transform = 'translateY(22px)';
      el.style.transition = 'opacity 1s cubic-bezier(.16,1,.3,1), transform 1s cubic-bezier(.16,1,.3,1)';
      el.style.transitionDelay = (0.7 + i * 0.14) + 's';
      setTimeout(function () { el.style.opacity = 1; el.style.transform = 'none'; }, 60);
    });
  }

  /* ---------- 数字滚动 ---------- */
  function animateCount(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var prefix = el.getAttribute('data-prefix') || '';
    var dur = reduced ? 0 : 1400;
    var start = performance.now();
    function step(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      var v = Math.round(target * eased);
      el.innerHTML = prefix + v + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    if (dur === 0) el.innerHTML = prefix + target + suffix;
    else requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    var countIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { animateCount(en.target); countIO.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    $$('[data-count]').forEach(function (el) { countIO.observe(el); });
  }

  /* ---------- 新闻 ---------- */
  var newsData = null;
  function setNewsData(data) { newsData = data; }
  function buildNews(data) {
    setNewsData(data);
    var items = data.items || [];
    var list = $('#newsList');
    var rail = $('#newsRail');

    // 侧栏：取前 4 条（排除 featured 已在左侧展示的）
    var side = items.filter(function (n) { return !n.featured; }).slice(0, 4);
    if (list) {
      list.innerHTML = side.map(function (n) {
        return '<article class="news-item" data-news="' + n.id + '" tabindex="0" role="button">' +
          '<div class="card-media"><img src="' + n.image + '" alt="' + n.title + '" loading="lazy"></div>' +
          '<div><div class="row gap-s" style="flex-wrap:wrap;margin-bottom:6px">' +
          '<span class="news-date">' + n.date + '</span><span class="t-mono" style="color:var(--coral);font-size:.62rem">' + n.cat + '</span></div>' +
          '<h4>' + n.title + '</h4>' +
          '<p class="t-small" style="margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + n.summary + '</p>' +
          '</div></article>';
      }).join('');
    }

    // 轨道
    if (rail) {
      rail.innerHTML = items.map(function (n) {
        return '<article class="rail-item" data-news="' + n.id + '" tabindex="0" role="button">' +
          '<div class="card-media"><img src="' + n.image + '" alt="' + n.title + '" loading="lazy"></div>' +
          '<div class="card-body" style="padding:16px">' +
          '<div class="row gap-s" style="margin-bottom:8px"><span class="news-date">' + n.date + '</span>' +
          '<span class="t-mono" style="color:var(--coral);font-size:.62rem">' + n.cat + '</span></div>' +
          '<h4 style="font-size:1rem;font-weight:600;line-height:1.5">' + n.title + '</h4></div></article>';
      }).join('');
    }
    bindNews();
  }

  function bindNews() {
    $$('[data-news]').forEach(function (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function () { openNews(el.getAttribute('data-news')); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNews(el.getAttribute('data-news')); }
      });
    });
  }

  var newsModal = $('#newsModal');
  var lastFocus = null;
  function openNews(id) {
    if (!newsData) return;
    var n = (newsData.items || []).filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    lastFocus = document.activeElement;
    $('#modalImg').src = n.image;
    $('#modalImg').alt = n.title;
    $('#modalCat').textContent = n.cat;
    $('#modalDate').textContent = n.date;
    $('#modalSource').textContent = '来源：' + n.source;
    $('#modalTitle').textContent = n.title;
    $('#modalBody').textContent = n.body || n.summary;
    $('#modalNote').textContent = n.demo
      ? '※ 本条摘要为示例文本，完整内容请以来源原文为准。'
      : '※ 内容摘自公开报道，完整内容请以来源原文为准。';
    var link = $('#modalSourceLink');
    if (n.sourceUrl) { link.href = n.sourceUrl; link.style.display = ''; }
    else link.style.display = 'none';
    newsModal.hidden = false;
    newsModal.classList.add('is-open');
    document.body.classList.add('no-scroll');
    $('.modal-close', newsModal).focus();
  }
  function closeNews() {
    newsModal.classList.remove('is-open');
    newsModal.hidden = true;
    document.body.classList.remove('no-scroll');
    if (lastFocus) lastFocus.focus();
  }
  if (newsModal) {
    $$('[data-close]', newsModal).forEach(function (el) { el.addEventListener('click', closeNews); });
  }

  /* ---------- Gallery ---------- */
  var GALLERY = [
    { src: 'assets/images/web/lanshu-1600.jpg', cat: '园林', title: '百年榄仁树', alt: '校园里的百年榄仁树，树冠舒展' },
    { src: 'assets/images/web/news-football1.jpg', cat: '运动', title: '足球场上的傍晚', alt: '学生在足球场训练' },
    { src: 'assets/images/web/academic-jy_ketang2-800.jpg', cat: '课堂', title: '课堂 · 朗读', alt: '学生在课堂上朗读课文' },
    { src: 'assets/images/web/wenhua_3-800.jpg', cat: '园林', title: '校园园林景观', alt: '校园园林与绿化景观' },
    { src: 'assets/images/web/acad-jy-ketang1.jpg', cat: '课堂', title: '课堂 · 导入', alt: '教师以课文插图导入课程' },
    { src: 'assets/images/web/news-yishujie.jpg', cat: '艺术', title: '艺术节舞台', alt: '艺术节开幕式舞台表演' },
    { src: 'assets/images/web/acad-jy-xuesheng.jpg', cat: '课堂', title: '课堂讨论', alt: '学生在课堂上发言讨论' },
    { src: 'assets/images/web/wenhua_yanchi-800.jpg', cat: '园林', title: '砚池', alt: '校园内的砚池水景' },
    { src: 'assets/images/web/news-yundonghui.jpg', cat: '运动', title: '校运会方阵', alt: '校运会学生集体方阵' },
    { src: 'assets/images/web/taoranting-800.jpg', cat: '园林', title: '陶然亭', alt: '校内陶然亭园林小品' },
    { src: 'assets/images/web/academic-kfr23_yingbin-800.jpg', cat: '校园活动', title: '开放日 · 迎宾', alt: '招生开放日校园迎宾场景' },
    { src: 'assets/images/web/meijing-800.jpg', cat: '学生生活', title: '校园美景', alt: '校园景色与建筑' },
    { src: 'assets/images/web/news-guzheng.jpg', cat: '艺术', title: '乐器演奏', alt: '学生演奏古筝' },
    { src: 'assets/images/web/wenhua_8-800.jpg', cat: '校园活动', title: '校园一隅', alt: '校园景观与活动空间' },
    { src: 'assets/images/web/news-football3.jpg', cat: '运动', title: '球场日常', alt: '学生在球场的日常训练' },
    { src: 'assets/images/web/acad-yuyinshi.jpg', cat: '课堂', title: '语音教室', alt: '学生在语音教室上课' }
  ];
  var galleryEl = $('#gallery');
  var lb = $('#lightbox');
  var lbIndex = 0;
  var lbList = GALLERY;

  function renderGallery(cat) {
    if (!galleryEl) return;
    var list = cat === 'all' ? GALLERY : GALLERY.filter(function (g) { return g.cat === cat; });
    lbList = list;
    galleryEl.innerHTML = list.map(function (g, i) {
      return '<figure class="masonry-item" data-i="' + i + '" tabindex="0" role="button" aria-label="查看图片：' + g.title + '">' +
        '<img src="' + g.src + '" alt="' + g.alt + '" loading="lazy" decoding="async">' +
        '<figcaption class="masonry-cap"><span class="cat">' + g.cat + '</span><span class="ttl">' + g.title + '</span></figcaption></figure>';
    }).join('');
    $$('.masonry-item', galleryEl).forEach(function (el) {
      el.addEventListener('click', function () { openLb(parseInt(el.getAttribute('data-i'), 10)); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLb(parseInt(el.getAttribute('data-i'), 10)); }
      });
    });
  }

  function openLb(i) {
    if (!lb || !lbList.length) return;
    lbIndex = (i + lbList.length) % lbList.length;
    var g = lbList[lbIndex];
    $('#lbImg').src = g.src;
    $('#lbImg').alt = g.alt;
    $('#lbCat').textContent = g.cat;
    $('#lbTitle').textContent = g.title;
    $('#lbIndex').textContent = (lbIndex + 1) + ' / ' + lbList.length;
    lb.hidden = false;
    lb.classList.add('is-open');
    document.body.classList.add('no-scroll');
    $('#lbNext').focus();
  }
  function closeLb() {
    if (!lb) return;
    lb.classList.remove('is-open');
    lb.hidden = true;
    document.body.classList.remove('no-scroll');
  }
  if (lb) {
    $$('[data-lb-close]', lb).forEach(function (b) { b.addEventListener('click', closeLb); });
    $('#lbPrev').addEventListener('click', function () { openLb(lbIndex - 1); });
    $('#lbNext').addEventListener('click', function () { openLb(lbIndex + 1); });
  }
  $$('#galleryFilters .filter').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('#galleryFilters .filter').forEach(function (x) { x.classList.remove('is-on'); });
      b.classList.add('is-on');
      renderGallery(b.getAttribute('data-cat'));
    });
  });

  /* ---------- Campus 概念地图 ---------- */
  var campusInfo = $('#campusInfoSwap');
  var CAMPUS = {
    gate: { name: '校门', en: 'THE GATE', desc: '海南中学府城校区校门。设计参考官网图片中的门楼形态：横向舒展的入口空间与对称门柱。' },
    yihao: { name: '一号教学楼', en: 'ACADEMIC BUILDING 01', desc: '现代简洁的体量、连续的水平遮阳与外廊，适应海南的日照与雨季。' },
    fengqitang: { name: '凤栖堂', en: 'FENGQI HALL', desc: '绿瓦、朱柱、完整院落。府城校区最具历史感的建筑之一，百年文脉的空间载体。' },
    yanlintang: { name: '衍林堂', en: 'YANLIN HALL', desc: '衍林堂前立有「春风化雨——钟衍林和学生们」铜像，纪念首任校长钟衍林。' },
    library: { name: '图书馆', en: 'LIBRARY', desc: '大面积玻璃与通透的阅览空间，与庭院绿化相互渗透。' },
    science: { name: '实验区域', en: 'SCIENCE & LAB', desc: '承担物理、化学、生物与信息技术实践教学的场所。' },
    sports: { name: '体育场', en: 'SPORTS FIELD', desc: '包含跑道与中央球场的开放运动空间。' },
    taoranting: { name: '陶然亭', en: 'TAORAN PAVILION', desc: '校内园林小品，绿瓦凉亭与草坪灌木构成安静的空间节点。' },
    siyuan: { name: '思园 · 砚池', en: 'SI GARDEN & INKSTONE POND', desc: '林荫道与水面构成校园的热带园林景观。' },
    art: { name: '艺术教育中心', en: 'ARTS CENTER', desc: '包含礼堂与艺术教学空间，承担艺术节、讲座与演出。' },
    dorm: { name: '学生生活区', en: 'STUDENT LIFE', desc: '宿舍与食堂构成的生活区域，围合出庭院式的日常空间。' },
    lanshu: { name: '百年榄仁树', en: 'CENTENARIAN TERMINALIA', desc: '「树木是有记忆的，它的故事记录在年轮里。」它的年轮，就是这所学校历史的注脚。' }
  };
  $$('.bspot').forEach(function (spot) {
    function activate() {
      $$('.bspot').forEach(function (s) { s.classList.remove('is-on'); });
      spot.classList.add('is-on');
      var d = CAMPUS[spot.getAttribute('data-id')];
      if (!d || !campusInfo) return;
      campusInfo.innerHTML =
        '<span class="tag tag-demo">CONCEPT</span>' +
        '<h3 class="t-h2 mt-s">' + d.name + '</h3>' +
        '<p class="t-mono" style="color:var(--on-light-45);margin-top:6px">' + d.en + '</p>' +
        '<p class="t-body mt-m">' + d.desc + '</p>' +
        '<p class="t-small mt-m">位置与形态为概念示意，非真实测绘。</p>' +
        '<a class="btn btn-dark mt-s" href="campus-3d.html?focus=' + spot.getAttribute('data-id') + '">在 3D 校园中查看 <span class="btn-arrow">↗</span></a>';
      campusInfo.classList.remove('swap');
      void campusInfo.offsetWidth;
      campusInfo.classList.add('swap');
    }
    spot.addEventListener('click', activate);
    spot.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });

  /* ---------- 一天时间轴 ---------- */
  var dayItems = $$('#dayItems .day-item');
  var dayProgress = $('#dayProgress');
  if (dayItems.length) {
    var dayIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var idx = dayItems.indexOf(en.target);
          dayItems.forEach(function (it, i) { it.classList.toggle('is-on', i <= idx); });
          if (dayProgress) dayProgress.style.width = ((idx + 1) / dayItems.length * 100) + '%';
        }
      });
    }, { threshold: 0.55, rootMargin: '-10% 0px -20% 0px' });
    dayItems.forEach(function (it) { dayIO.observe(it); });
  }

  /* ---------- 新闻轨道滚动 ---------- */
  var railEl = $('#newsRail');
  if (railEl) {
    var step = function () { return Math.max(280, railEl.clientWidth * 0.7); };
    $('#railPrev').addEventListener('click', function () { railEl.scrollBy({ left: -step(), behavior: reduced ? 'auto' : 'smooth' }); });
    $('#railNext').addEventListener('click', function () { railEl.scrollBy({ left: step(), behavior: reduced ? 'auto' : 'smooth' }); });
  }

  /* ---------- 彩蛋：星星 ---------- */
  var star = $('#eggStar');
  var eggToast = $('#eggToast');
  if (star && eggToast) {
    star.addEventListener('click', function () {
      eggToast.hidden = false;
      eggToast.classList.add('is-on');
      $('#eggClose').focus();
    });
    function closeEgg() {
      eggToast.classList.remove('is-on');
      setTimeout(function () { eggToast.hidden = true; }, 500);
    }
    $('#eggClose').addEventListener('click', closeEgg);
    eggToast.addEventListener('click', function (e) { if (e.target === eggToast) closeEgg(); });
  }

  /* ---------- 彩蛋：快速滚动「慢一点」 ---------- */
  var slowmo = $('#slowmo');
  if (slowmo && !reduced && !isTouch) {
    var lastY = window.pageYOffset, lastT = Date.now(), speed = 0, shown = 0;
    window.addEventListener('scroll', function () {
      var now = Date.now(), y = window.pageYOffset;
      var dt = Math.max(16, now - lastT);
      var v = Math.abs(y - lastY) / dt * 1000;
      speed = speed * 0.7 + v * 0.3;
      if (speed > 4200 && now - shown > 6000) {
        shown = now;
        slowmo.classList.add('is-on');
        setTimeout(function () { slowmo.classList.remove('is-on'); }, 900);
      }
      lastY = y; lastT = now;
    }, { passive: true });
  }

  /* ---------- 鼠标光晕（轻微） ---------- */
  var lf = $('#lightFollow');
  if (lf && !isTouch && !reduced && perf === 'full') {
    var raf = null, mx = 0, my = 0;
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        lf.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
        raf = null;
      });
    }, { passive: true });
  }

  /* ---------- 返回顶部 ---------- */
  var toTop = $('#toTop');
  if (toTop) toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  /* ---------- 全局按键 ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (lb && lb.classList.contains('is-open')) closeLb();
    else if (newsModal && newsModal.classList.contains('is-open')) closeNews();
    else if (eggToast && eggToast.classList.contains('is-on')) {
      eggToast.classList.remove('is-on');
      setTimeout(function () { eggToast.hidden = true; }, 500);
    }
  });
  if (lb) {
    $('#lbPrev') && document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'ArrowLeft') openLb(lbIndex - 1);
      if (e.key === 'ArrowRight') openLb(lbIndex + 1);
    });
  }

  /* ---------- 载入数据 ---------- */
  function loadJSON(url, cb) {
    fetch(url, { cache: 'no-cache' }).then(function (r) { return r.json(); })
      .then(cb).catch(function () { /* 静态部署降级：不阻塞页面 */ });
  }
  if ($('#newsList')) loadJSON('data/news.json', buildNews);
  if (galleryEl) renderGallery('all');

  /* ---------- 平滑锚点（带偏移） ---------- */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1);
      if (!id) return;
      var t = document.getElementById(id);
      if (!t) return;
      e.preventDefault();
      var top = t.getBoundingClientRect().top + window.pageYOffset - 76;
      window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
    });
  });

  /* ---------- 对外 API（供子页面复用） ---------- */
  window.HMS = {
    setNewsData: setNewsData,
    bindNews: bindNews,
    openNews: openNews,
    openLightbox: openLb,
    perf: perf,
    reduced: reduced
  };
})();
