/* 新闻中心页：网格渲染 + 分类筛选 + 详情模态 */
(function () {
  'use strict';
  var grid = document.getElementById('newsGrid');
  var filters = document.getElementById('newsFilters');
  if (!grid) return;

  var items = [];

  function cardHTML(n, i) {
    return '<article class="card reveal' + (i === 0 ? '' : ' reveal-d' + Math.min(3, i % 3 + 1)) + '" data-news="' + n.id + '" tabindex="0" role="button" aria-label="查看新闻：' + n.title + '">' +
      '<div class="card-media"><img src="' + n.image + '" alt="' + n.title + '" loading="lazy" decoding="async"></div>' +
      '<div class="card-body">' +
      '<div class="row gap-s" style="flex-wrap:wrap;margin-bottom:12px">' +
      '<span class="tag' + (n.featured ? ' tag-coral' : '') + '">' + n.cat + '</span>' +
      '<span class="news-date">' + n.date + '</span></div>' +
      '<h3 class="t-h3" style="line-height:1.5">' + n.title + '</h3>' +
      '<p class="t-small mt-s" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">' + n.summary + '</p>' +
      '<p class="t-mono mt-s" style="color:var(--on-light-45);font-size:.62rem">来源：' + n.source + '</p>' +
      '</div></article>';
  }

  function render(cat) {
    var list = cat === 'all' ? items : items.filter(function (n) { return n.cat === cat; });
    grid.innerHTML = list.map(cardHTML).join('');
    // 让 main.js 重新绑定
    if (window.HMS && window.HMS.bindNews) window.HMS.bindNews();
    // 重新触发显现动画
    var els = grid.querySelectorAll('.reveal');
    Array.prototype.forEach.call(els, function (el) { el.classList.add('in'); });
  }

  fetch('data/news.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      items = data.items || [];
      if (window.HMS) window.HMS.setNewsData(data);
      render('all');
    })
    .catch(function () {
      grid.innerHTML = '<p class="t-body">新闻数据加载失败。请确认 data/news.json 可访问。</p>';
    });

  if (filters) {
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('.filter');
      if (!b) return;
      Array.prototype.forEach.call(filters.querySelectorAll('.filter'), function (x) { x.classList.remove('is-on'); });
      b.classList.add('is-on');
      render(b.getAttribute('data-cat'));
    });
  }
})();
