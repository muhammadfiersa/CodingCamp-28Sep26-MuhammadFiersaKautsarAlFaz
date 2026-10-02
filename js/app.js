/* ============================================================
   PengeluaranKu — Expense & Budget Visualizer
   js/app.js  —  Single IIFE module, no build step required
   Features: custom categories, monthly summary, sort, 
             overspend highlight, dark/light mode toggle
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY   = 'evb_data';
  var THEME_KEY     = 'evb_theme';

  var barChartInstance = null;
  var pieChartInstance = null;

  /* ── SORT STATE ───────────────────────────────────────────── */
  var SortState = { field: 'date', dir: 'desc' };

  /* ── APP STATE ────────────────────────────────────────────── */
  var AppState = {
    expenses:      [],
    budgets:       [],
    categories:    [],
    activeView:    'dashboard',
    selectedPeriod: '',
    activeFilters: { category: null, dateFrom: null, dateTo: null, period: null }
  };

  /* ── SERIALIZER ───────────────────────────────────────────── */
  var Serializer = {
    encode: function (state) {
      return JSON.stringify({ version: 1, expenses: state.expenses, budgets: state.budgets, categories: state.categories });
    },
    decode: function (jsonStr) {
      var p = JSON.parse(jsonStr);
      if (!p || typeof p !== 'object') throw new Error('Invalid storage data');
      p.expenses   = Array.isArray(p.expenses)   ? p.expenses   : [];
      p.budgets    = Array.isArray(p.budgets)    ? p.budgets    : [];
      p.categories = Array.isArray(p.categories) ? p.categories : [];
      return p;
    }
  };

  /* ── STORAGE MANAGER ──────────────────────────────────────── */
  var StorageManager = {
    isAvailable: function () {
      try { var k = '__evb_test__'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; } catch(e) { return false; }
    },
    save: function (state) {
      try { localStorage.setItem(STORAGE_KEY, Serializer.encode(state)); }
      catch(e) { NotificationManager.show('Gagal menyimpan data ke penyimpanan lokal.', 'error'); }
    },
    load: function () {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return Serializer.decode(raw);
    }
  };

  /* ── HELPERS ──────────────────────────────────────────────── */
  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
  }

  function formatRupiah(amount) {
    return 'Rp ' + Number(amount).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function formatDate(isoDate) {
    if (!isoDate) return '-';
    var p = isoDate.split('-');
    var m = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return parseInt(p[2],10) + ' ' + m[parseInt(p[1],10)-1] + ' ' + p[0];
  }

  function formatMonthLabel(yyyymm) {
    var p = yyyymm.split('-');
    var m = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return m[parseInt(p[1],10)-1] + ' ' + p[0];
  }

  function todayISO() {
    var n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0') + '-' + String(n.getDate()).padStart(2,'0');
  }

  function currentPeriod() {
    var n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0');
  }

  function dateToPeriod(isoDate) { return isoDate ? isoDate.slice(0,7) : ''; }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  /* ── DARK MODE MANAGER ────────────────────────────────────── */
  var DarkMode = {
    apply: function (dark) {
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      var btn  = document.getElementById('darkmode-toggle');
      var icon = btn && btn.querySelector('.darkmode-icon');
      if (icon) icon.textContent = dark ? '☀️' : '🌙';
      if (btn) btn.setAttribute('title', dark ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap');
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch(e) {}
    },
    isDark: function () {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    },
    toggle: function () { DarkMode.apply(!DarkMode.isDark()); },
    init: function () {
      var saved = '';
      try { saved = localStorage.getItem(THEME_KEY) || ''; } catch(e) {}
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      DarkMode.apply(saved === 'dark' || (!saved && prefersDark));
      var btn = document.getElementById('darkmode-toggle');
      if (btn) btn.addEventListener('click', DarkMode.toggle);
    }
  };

  /* ── CATEGORY SERVICE ─────────────────────────────────────── */
  var CategoryService = {
    getDefaults: function () { return ['Makanan','Transportasi','Hiburan','Kesehatan','Perumahan','Lainnya']; },
    validate: function (state, name) {
      var errors = [], t = (name||'').trim();
      if (!t) { errors.push('Nama kategori tidak boleh kosong.'); return errors; }
      if (t.length > 50) errors.push('Nama kategori maksimal 50 karakter.');
      if (state.categories.some(function(c){ return c.name.toLowerCase()===t.toLowerCase(); }))
        errors.push('Kategori "' + t + '" sudah ada.');
      return errors;
    },
    add: function (state, name) {
      var errors = CategoryService.validate(state, name);
      if (errors.length) return { state: state, errors: errors };
      var t = name.trim();
      return { state: Object.assign({}, state, { categories: state.categories.concat([{ id: generateId(), name: t }]) }), errors: [] };
    },
    remove: function (state, id, confirm) {
      var cat = state.categories.find(function(c){ return c.id===id; });
      if (!cat) return { state: state, associationCounts: { expenses:0, budgets:0 } };
      var ae = state.expenses.filter(function(e){ return e.category===cat.name; }).length;
      var ab = state.budgets.filter(function(b){ return b.category===cat.name; }).length;
      var counts = { expenses:ae, budgets:ab };
      if (!confirm) return { state: state, associationCounts: counts };
      var newExp = state.expenses.map(function(e){ return e.category===cat.name ? Object.assign({},e,{category:'Uncategorized'}) : e; });
      var newBud = state.budgets.filter(function(b){ return b.category!==cat.name; });
      var newCat = state.categories.filter(function(c){ return c.id!==id; });
      return { state: Object.assign({},state,{expenses:newExp,budgets:newBud,categories:newCat}), associationCounts: counts };
    }
  };

  /* ── EXPENSE SERVICE ──────────────────────────────────────── */
  var ExpenseService = {
    validate: function (exp) {
      var errors = [];
      if (exp.amount===''||exp.amount===null||exp.amount===undefined) {
        errors.push({ field:'expense-amount', msg:'Jumlah harus diisi.' });
      } else {
        var a = parseFloat(exp.amount);
        if (isNaN(a)||!isFinite(a)) errors.push({ field:'expense-amount', msg:'Jumlah harus berupa angka.' });
        else if (a<0.01||a>999999999.99) errors.push({ field:'expense-amount', msg:'Jumlah harus antara 0.01 dan 999.999.999,99.' });
      }
      if (!exp.category||!exp.category.trim()) errors.push({ field:'expense-category', msg:'Kategori harus dipilih.' });
      else if (exp.category.length>100) errors.push({ field:'expense-category', msg:'Kategori maksimal 100 karakter.' });
      if (!exp.date) errors.push({ field:'expense-date', msg:'Tanggal harus diisi.' });
      else if (exp.date>todayISO()) errors.push({ field:'expense-date', msg:'Tanggal tidak boleh di masa depan.' });
      if (!exp.name||!exp.name.trim()) errors.push({ field:'expense-name', msg:'Nama item harus diisi.' });
      if (exp.description&&exp.description.length>500) errors.push({ field:'expense-description', msg:'Deskripsi maksimal 500 karakter.' });
      return errors;
    },
    add: function (state, exp) {
      var errors = ExpenseService.validate(exp);
      if (errors.length) return { state: state, errors: errors };
      var n = { id:generateId(), name:exp.name.trim(), amount:parseFloat(exp.amount), category:exp.category.trim(), date:exp.date, description:(exp.description||'').trim() };
      return { state: Object.assign({},state,{expenses:state.expenses.concat([n])}), errors:[] };
    },
    update: function (state, id, u) {
      var errors = ExpenseService.validate(u);
      if (errors.length) return { state: state, errors: errors };
      var ne = state.expenses.map(function(e){ return e.id!==id ? e : { id:e.id, name:u.name.trim(), amount:parseFloat(u.amount), category:u.category.trim(), date:u.date, description:(u.description||'').trim() }; });
      return { state: Object.assign({},state,{expenses:ne}), errors:[] };
    },
    remove: function (state, id) {
      return Object.assign({},state,{expenses:state.expenses.filter(function(e){ return e.id!==id; })});
    }
  };

  /* ── BUDGET SERVICE ───────────────────────────────────────── */
  var BudgetService = {
    validate: function (state, budget, editingId) {
      var errors = [];
      if (!budget.category||!budget.category.trim()) errors.push({ field:'budget-category', msg:'Kategori harus dipilih.' });
      if (!budget.period||!/^\d{4}-\d{2}$/.test(budget.period)) errors.push({ field:'budget-period', msg:'Periode harus diisi (format YYYY-MM).' });
      if (budget.limit===''||budget.limit===null||budget.limit===undefined) {
        errors.push({ field:'budget-limit', msg:'Batas anggaran harus diisi.' });
      } else {
        var l = parseFloat(budget.limit);
        if (isNaN(l)||!isFinite(l)||l<=0) errors.push({ field:'budget-limit', msg:'Batas anggaran harus angka positif.' });
        else if (l>999999999.99) errors.push({ field:'budget-limit', msg:'Batas anggaran terlalu besar.' });
      }
      if (budget.category&&budget.period) {
        var dup = state.budgets.some(function(b){ return (editingId&&b.id===editingId)?false:b.category===budget.category&&b.period===budget.period; });
        if (dup) errors.push({ field:'budget-category', msg:'Anggaran untuk kategori dan periode ini sudah ada.' });
      }
      return errors;
    },
    add: function (state, budget) {
      var errors = BudgetService.validate(state, budget, null);
      if (errors.length) return { state: state, errors: errors };
      var n = { id:generateId(), category:budget.category.trim(), period:budget.period, limit:parseFloat(budget.limit) };
      return { state: Object.assign({},state,{budgets:state.budgets.concat([n])}), errors:[] };
    },
    update: function (state, id, u) {
      var errors = BudgetService.validate(state, u, id);
      if (errors.length) return { state: state, errors: errors };
      var nb = state.budgets.map(function(b){ return b.id!==id ? b : { id:b.id, category:u.category.trim(), period:u.period, limit:parseFloat(u.limit) }; });
      return { state: Object.assign({},state,{budgets:nb}), errors:[] };
    },
    remove: function (state, id) {
      return Object.assign({},state,{budgets:state.budgets.filter(function(b){ return b.id!==id; })});
    },
    getStatus: function (spending, limit) {
      var o = Math.max(0, spending-limit);
      return { status: spending>=limit?'warning':'ok', overspent: o };
    }
  };

  /* ── FILTER ENGINE ────────────────────────────────────────── */
  var FilterEngine = {
    sort: function (expenses, field, dir) {
      var f=field||'date', d=dir||'desc';
      return expenses.slice().sort(function(a,b){
        var av=a[f]||'', bv=b[f]||'';
        if (f==='amount') { av=Number(a.amount)||0; bv=Number(b.amount)||0; }
        if (av<bv) return d==='desc'?1:-1;
        if (av>bv) return d==='desc'?-1:1;
        return 0;
      });
    },
    apply: function (expenses, filters) {
      return expenses.filter(function(e){
        if (filters.category && e.category!==filters.category) return false;
        if (filters.dateFrom && e.date<filters.dateFrom) return false;
        if (filters.dateTo   && e.date>filters.dateTo)   return false;
        if (filters.period   && dateToPeriod(e.date)!==filters.period) return false;
        return true;
      });
    }
  };

  /* ── SUMMARY CALCULATOR ───────────────────────────────────── */
  var SummaryCalculator = {
    periodSummary: function (expenses, budgets, period) {
      var pe = expenses.filter(function(e){ return dateToPeriod(e.date)===period; });
      var pb = budgets.filter(function(b){ return b.period===period; });
      var ts = pe.reduce(function(s,e){ return s+e.amount; },0);
      var tb = pb.reduce(function(s,b){ return s+b.limit;  },0);
      var catMap = {};
      pe.forEach(function(e){ catMap[e.category]=(catMap[e.category]||0)+e.amount; });
      var perCat = Object.keys(catMap).map(function(cat){
        var bud = pb.find(function(b){ return b.category===cat; });
        return { category:cat, spending:catMap[cat], limit: bud?bud.limit:0 };
      });
      return { totalSpending:ts, totalBudgeted:tb, remaining:tb-ts, perCategory:perCat };
    },
    progressPercent: function (spending, limit) {
      if (!limit||limit<=0) return 0;
      return Math.min((spending/limit)*100, 100);
    },
    piePercentages: function (categoryTotals) {
      var total = categoryTotals.reduce(function(s,c){ return s+c.amount; },0);
      if (!total) return [];
      return categoryTotals.map(function(c){ return { category:c.category, amount:c.amount, percent:parseFloat(((c.amount/total)*100).toFixed(1)) }; });
    },
    monthlySummary: function (expenses, budgets) {
      var months = {};
      expenses.forEach(function(e){
        var p = dateToPeriod(e.date);
        if (!p) return;
        if (!months[p]) months[p] = { period:p, spending:0, count:0 };
        months[p].spending += e.amount;
        months[p].count++;
      });
      var result = Object.keys(months).sort().reverse().map(function(p){
        var row = months[p];
        var pb = budgets.filter(function(b){ return b.period===p; });
        var tb = pb.reduce(function(s,b){ return s+b.limit; },0);
        return { period:p, spending:row.spending, count:row.count, budgeted:tb };
      });
      return result;
    }
  };

  /* ── CSV EXPORTER ─────────────────────────────────────────── */
  var CSVExporter = {
    escapeField: function (v) {
      var s = String(v==null?'':v);
      return /[,"\n\r]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
    },
    filename: function (period) { return 'expenses-'+period+'.csv'; },
    generate: function (expenses, period) {
      var pe = expenses.filter(function(e){ return dateToPeriod(e.date)===period; });
      if (!pe.length) return '';
      var self = CSVExporter, lines = ['date,category,amount,description'];
      pe.forEach(function(e){ lines.push([self.escapeField(e.date),self.escapeField(e.category),self.escapeField(e.amount),self.escapeField(e.description||'')].join(',')); });
      return lines.join('\r\n');
    },
    triggerDownload: function (csvText, filename) {
      var blob = new Blob([csvText],{type:'text/csv;charset=utf-8;'});
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href=url; a.download=filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); },1000);
    }
  };

  /* ── NOTIFICATION MANAGER ─────────────────────────────────── */
  var NotificationManager = {
    show: function (message, type) {
      var container = document.getElementById('toast-container');
      if (!container) return;
      type = type || 'info';
      var icons = { success:'✅', error:'❌', info:'ℹ️' };
      var toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.innerHTML = '<span class="toast-icon" aria-hidden="true">'+(icons[type]||icons.info)+'</span><span>'+escapeHtml(message)+'</span>';
      container.appendChild(toast);
      var t = setTimeout(function(){ NotificationManager._remove(toast); }, 4000);
      toast.addEventListener('click', function(){ clearTimeout(t); NotificationManager._remove(toast); });
    },
    _remove: function (toast) {
      toast.classList.add('removing');
      toast.addEventListener('animationend', function(){ if(toast.parentNode) toast.parentNode.removeChild(toast); }, { once:true });
    }
  };

  /* ── ROUTER ───────────────────────────────────────────────── */
  var Router = {
    init: function () {
      document.querySelectorAll('.nav-link[data-view]').forEach(function(link){
        link.addEventListener('click', function(e){
          e.preventDefault();
          Router.navigate(link.dataset.view);
          var nl = document.getElementById('nav-links'), tg = document.getElementById('nav-toggle');
          if (nl) nl.classList.remove('open');
          if (tg) tg.setAttribute('aria-expanded','false');
        });
      });
      var toggle = document.getElementById('nav-toggle');
      if (toggle) {
        toggle.addEventListener('click', function(){
          var nl = document.getElementById('nav-links');
          var open = nl.classList.toggle('open');
          toggle.setAttribute('aria-expanded', String(open));
        });
      }
    },
    navigate: function (viewName) {
      document.querySelectorAll('.view').forEach(function(v){ v.classList.remove('active'); v.hidden=true; });
      var target = document.getElementById('view-'+viewName);
      if (target) { target.classList.add('active'); target.hidden=false; }
      document.querySelectorAll('.nav-link[data-view]').forEach(function(l){ l.classList.toggle('active',l.dataset.view===viewName); });
      AppState.activeView = viewName;
    }
  };

  /* ── FORM CONTROLLER ──────────────────────────────────────── */
  var FormController = {
    showFieldError: function (fieldId, message) {
      var el = document.getElementById(fieldId), err = document.querySelector('[data-error="'+fieldId+'"]');
      if (el) el.classList.add('is-invalid');
      if (err) err.textContent = message;
    },
    clearFieldErrors: function () {
      document.querySelectorAll('.form-error').forEach(function(el){ el.textContent=''; });
      document.querySelectorAll('.is-invalid').forEach(function(el){ el.classList.remove('is-invalid'); });
    },
    bindExpenseForm: function (onSubmit) {
      var form = document.getElementById('expense-form');
      if (!form) return;
      form.addEventListener('submit', function(e){
        e.preventDefault();
        onSubmit({ name:document.getElementById('expense-name').value, amount:document.getElementById('expense-amount').value, category:document.getElementById('expense-category').value, date:document.getElementById('expense-date').value, description:document.getElementById('expense-description').value, editingId:document.getElementById('expense-editing-id').value||null });
      });
    },
    populateExpenseForm: function (expense) {
      document.getElementById('expense-name').value        = expense.name        || '';
      document.getElementById('expense-amount').value      = expense.amount      || '';
      document.getElementById('expense-category').value    = expense.category    || '';
      document.getElementById('expense-date').value        = expense.date        || '';
      document.getElementById('expense-description').value = expense.description || '';
      document.getElementById('expense-editing-id').value  = expense.id          || '';
      var sb=document.getElementById('expense-submit-btn'), cb=document.getElementById('expense-cancel-btn'), ft=document.getElementById('expense-form-title');
      if (sb) sb.textContent='💾 Simpan Perubahan';
      if (cb) cb.hidden=false;
      if (ft) ft.textContent='Edit Transaksi';
    },
    resetExpenseForm: function () {
      var form=document.getElementById('expense-form'); if(form) form.reset();
      document.getElementById('expense-editing-id').value='';
      var sb=document.getElementById('expense-submit-btn'), cb=document.getElementById('expense-cancel-btn'), ft=document.getElementById('expense-form-title');
      if (sb) sb.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> Tambah Transaksi';
      if (cb) cb.hidden=true;
      if (ft) ft.textContent='Tambah Transaksi';
      FormController.clearFieldErrors();
    },
    bindBudgetForm: function (onSubmit) {
      var form = document.getElementById('budget-form');
      if (!form) return;
      form.addEventListener('submit', function(e){
        e.preventDefault();
        onSubmit({ category:document.getElementById('budget-category').value, period:document.getElementById('budget-period').value, limit:document.getElementById('budget-limit').value, editingId:document.getElementById('budget-editing-id').value||null });
      });
    },
    resetBudgetForm: function () {
      var form=document.getElementById('budget-form'); if(form) form.reset();
      document.getElementById('budget-editing-id').value='';
      var sb=document.getElementById('budget-submit-btn'), cb=document.getElementById('budget-cancel-btn'), ft=document.getElementById('budget-form-title');
      if (sb) sb.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> Simpan Anggaran';
      if (cb) cb.hidden=true;
      if (ft) ft.textContent='Tambah Anggaran';
      FormController.clearFieldErrors();
    }
  };

  /* ── CHART COLORS & RENDERER ──────────────────────────────── */
  var CHART_COLORS = ['#4F46E5','#10B981','#F59E0B','#EF4444','#3B82F6','#8B5CF6','#EC4899','#14B8A6','#F97316','#84CC16','#06B6D4','#D946EF'];
  function getCategoryColor(i) { return CHART_COLORS[i % CHART_COLORS.length]; }

  var ChartRenderer = {
    drawBar: function (canvasId, data) {
      var canvas = document.getElementById(canvasId);
      if (!canvas) return;
      if (barChartInstance) { barChartInstance.destroy(); barChartInstance=null; }
      if (!data||!data.length) { canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height); return; }
      barChartInstance = new Chart(canvas.getContext('2d'), {
        type:'bar',
        data:{ labels:data.map(function(d){return d.label;}), datasets:[{ label:'Pengeluaran', data:data.map(function(d){return d.value;}), backgroundColor:data.map(function(d,i){return d.color||getCategoryColor(i);}), borderRadius:6, borderSkipped:false }]},
        options:{ responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:function(c){ return ' '+formatRupiah(c.parsed.y); } } } }, scales:{ y:{ beginAtZero:true, ticks:{ callback:function(v){ if(v>=1000000) return 'Rp '+(v/1000000).toFixed(1)+'jt'; if(v>=1000) return 'Rp '+(v/1000).toFixed(0)+'rb'; return 'Rp '+v; } }, grid:{ color:'rgba(0,0,0,0.05)' } }, x:{ grid:{display:false} } } }
      });
    },
    drawPie: function (canvasId, data) {
      var canvas = document.getElementById(canvasId);
      if (!canvas) return;
      if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance=null; }
      if (!data||!data.length) { canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height); return; }
      var colors = data.map(function(d,i){ return d.color||getCategoryColor(i); });
      pieChartInstance = new Chart(canvas.getContext('2d'), {
        type:'doughnut',
        data:{ labels:data.map(function(d){return d.label;}), datasets:[{ data:data.map(function(d){return d.value;}), backgroundColor:colors, borderColor:'#ffffff', borderWidth:2, hoverOffset:6 }]},
        options:{ responsive:true, maintainAspectRatio:true, cutout:'55%', plugins:{ legend:{ position:'bottom', labels:{ font:{size:11}, padding:10, usePointStyle:true } }, tooltip:{ callbacks:{ label:function(c){ var pct=((c.parsed/c.dataset.data.reduce(function(a,b){return a+b;},0))*100).toFixed(1); return ' '+formatRupiah(c.parsed)+' ('+pct+'%)'; } } } } }
      });
    }
  };

  /* ── POPULATE CATEGORY SELECTS ────────────────────────────── */
  function populateCategorySelects() {
    ['expense-category','budget-category','filter-category'].forEach(function(id){
      var sel = document.getElementById(id);
      if (!sel) return;
      var cur = sel.value;
      while (sel.options.length>1) sel.remove(1);
      AppState.categories.forEach(function(cat){
        var opt=document.createElement('option'); opt.value=cat.name; opt.textContent=cat.name; sel.appendChild(opt);
      });
      if (cur) sel.value=cur;
    });
  }

  /* ── SORT CONTROLS ────────────────────────────────────────── */
  function initSortControls() {
    document.querySelectorAll('.btn-sort').forEach(function(btn){
      btn.addEventListener('click', function(){
        var field = btn.dataset.sortField;
        var dir   = btn.dataset.sortDir;
        // If already active same field, flip direction
        if (SortState.field===field) {
          SortState.dir = SortState.dir==='asc'?'desc':'asc';
        } else {
          SortState.field = field;
          SortState.dir   = dir;
        }
        // Update button states & arrows
        document.querySelectorAll('.btn-sort').forEach(function(b){
          var isActive = b.dataset.sortField===SortState.field;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', String(isActive));
          var arrow = b.querySelector('.sort-arrow');
          if (arrow) {
            if (isActive) arrow.textContent = SortState.dir==='asc' ? '↑' : '↓';
            else arrow.textContent = '↕';
          }
          // Store direction on button for next click
          b.dataset.sortDir = isActive ? SortState.dir : b.dataset.sortDir;
        });
        ExpenseListView.render(AppState);
      });
    });
  }

  /* ── OVERSPEND DETECTION ──────────────────────────────────── */
  function isRowOverBudget(expense) {
    var period = dateToPeriod(expense.date);
    var bud = AppState.budgets.find(function(b){ return b.category===expense.category && b.period===period; });
    if (!bud) return false;
    var totalSpent = AppState.expenses.filter(function(e){ return e.category===expense.category && dateToPeriod(e.date)===period; }).reduce(function(s,e){ return s+e.amount; },0);
    return totalSpent > bud.limit;
  }

  /* ── MONTHLY SUMMARY VIEW ─────────────────────────────────── */
  var MonthlySummaryView = {
    render: function (state) {
      var container = document.getElementById('monthly-summary-list');
      var emptyEl   = document.getElementById('monthly-summary-empty');
      if (!container) return;

      var rows = SummaryCalculator.monthlySummary(state.expenses, state.budgets);
      if (!rows.length) {
        if (emptyEl) emptyEl.hidden=false;
        var old = container.querySelector('.monthly-summary-table');
        if (old) old.remove();
        return;
      }
      if (emptyEl) emptyEl.hidden=true;

      var maxSpend = Math.max.apply(null, rows.map(function(r){ return r.spending; }));

      var old = container.querySelector('.monthly-summary-table');
      if (old) old.remove();

      var table = document.createElement('table');
      table.className = 'monthly-summary-table';
      table.innerHTML =
        '<thead><tr>' +
          '<th scope="col">Bulan</th>' +
          '<th scope="col" class="text-right">Pengeluaran</th>' +
          '<th scope="col" class="text-right">Anggaran</th>' +
          '<th scope="col">Tren</th>' +
          '<th scope="col">Status</th>' +
        '</tr></thead>';

      var tbody = document.createElement('tbody');
      rows.forEach(function(row){
        var pct = maxSpend>0 ? (row.spending/maxSpend)*100 : 0;
        var isOver = row.budgeted>0 && row.spending>row.budgeted;
        var statusClass = row.budgeted===0 ? 'no-budget' : (isOver ? 'over' : 'ok');
        var statusLabel = row.budgeted===0 ? 'Tanpa Anggaran' : (isOver ? '⚠ Melebihi' : '✓ Aman');

        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' +
            '<div class="month-label">' + escapeHtml(formatMonthLabel(row.period)) + '</div>' +
            '<div class="month-txn-count">' + row.count + ' transaksi</div>' +
          '</td>' +
          '<td class="text-right"><span class="monthly-amount">' + escapeHtml(formatRupiah(row.spending)) + '</span></td>' +
          '<td class="text-right"><span class="monthly-budget-amount">' + (row.budgeted>0 ? escapeHtml(formatRupiah(row.budgeted)) : '—') + '</span></td>' +
          '<td>' +
            '<div class="monthly-bar-wrap">' +
              '<div class="monthly-bar-track"><div class="monthly-bar-fill' + (isOver?' over':'') + '" style="width:' + pct.toFixed(1) + '%"></div></div>' +
            '</div>' +
          '</td>' +
          '<td><span class="monthly-status-badge ' + statusClass + '">' + statusLabel + '</span></td>';
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);
    }
  };

  /* ── DASHBOARD VIEW ───────────────────────────────────────── */
  var DashboardView = {
    render: function (state) {
      var period  = state.selectedPeriod;
      var summary = SummaryCalculator.periodSummary(state.expenses, state.budgets, period);

      document.getElementById('summary-spending').textContent = formatRupiah(summary.totalSpending);
      document.getElementById('summary-budgeted').textContent = formatRupiah(summary.totalBudgeted);
      var remEl = document.getElementById('summary-remaining');
      remEl.textContent = formatRupiah(summary.remaining);
      remEl.classList.toggle('negative', summary.remaining<0);

      var periodInput = document.getElementById('dashboard-period');
      if (periodInput && periodInput.value!==period) periodInput.value=period;

      // Budget progress bars
      var listEl  = document.getElementById('budget-progress-list');
      var emptyEl = document.getElementById('budget-progress-empty');
      var pb = state.budgets.filter(function(b){ return b.period===period; });

      if (listEl) {
        listEl.querySelectorAll('.budget-progress-item').forEach(function(i){ i.remove(); });
        if (!pb.length) {
          if (emptyEl) emptyEl.hidden=false;
        } else {
          if (emptyEl) emptyEl.hidden=true;
          pb.forEach(function(budget){
            var cs  = summary.perCategory.find(function(c){ return c.category===budget.category; });
            var sp  = cs?cs.spending:0;
            var pct = SummaryCalculator.progressPercent(sp, budget.limit);
            var st  = BudgetService.getStatus(sp, budget.limit);
            var fc  = st.status==='warning'?(st.overspent>0?'overspent':'warning'):'';
            var item = document.createElement('div');
            item.className='budget-progress-item';
            item.innerHTML=
              '<div class="budget-progress-header"><span class="budget-progress-label">'+escapeHtml(budget.category)+'</span><span class="budget-progress-amount">'+formatRupiah(sp)+' / '+formatRupiah(budget.limit)+'</span></div>'+
              '<div class="progress-bar-track" role="progressbar" aria-valuenow="'+Math.round(pct)+'" aria-valuemin="0" aria-valuemax="100" aria-label="Progress anggaran '+escapeHtml(budget.category)+'"><div class="progress-bar-fill '+fc+'" style="width:'+pct+'%"></div></div>'+
              (st.overspent>0
                ? '<p class="budget-progress-status overspent">Melebihi anggaran sebesar '+formatRupiah(st.overspent)+'!</p>'
                : '<p class="budget-progress-status '+(pct>=80?'warning':'')+'">'+formatRupiah(budget.limit-sp)+' tersisa</p>');
            listEl.appendChild(item);
          });
        }
      }

      // Charts
      var chartEmpty = document.getElementById('chart-empty');
      if (!summary.perCategory.length) {
        if (chartEmpty) chartEmpty.hidden=false;
        ChartRenderer.drawBar('chart-bar',[]);
        ChartRenderer.drawPie('chart-pie',[]);
        MonthlySummaryView.render(state);
        return;
      }
      if (chartEmpty) chartEmpty.hidden=true;
      var bd = summary.perCategory.map(function(c,i){ return { label:c.category, value:c.spending, color:getCategoryColor(i) }; });
      var pd = summary.perCategory.map(function(c,i){ return { label:c.category, value:c.spending, color:getCategoryColor(i) }; });
      ChartRenderer.drawBar('chart-bar',bd);
      ChartRenderer.drawPie('chart-pie',pd);
      MonthlySummaryView.render(state);
    }
  };

  /* ── EXPENSE LIST VIEW ────────────────────────────────────── */
  var ExpenseListView = {
    render: function (state) {
      var sorted    = FilterEngine.sort(state.expenses, SortState.field, SortState.dir);
      var filtered  = FilterEngine.apply(sorted, state.activeFilters);
      var displayed = filtered.slice(0,500);

      var tbody  = document.getElementById('expense-table-body');
      var emptyEl= document.getElementById('expense-empty-state');
      var badge  = document.getElementById('expense-count-badge');

      if (badge)  badge.textContent=filtered.length;
      if (!tbody) return;
      tbody.innerHTML='';

      if (!displayed.length) { if(emptyEl) emptyEl.hidden=false; return; }
      if (emptyEl) emptyEl.hidden=true;

      displayed.forEach(function(expense){
        var tr = document.createElement('tr');
        var catKey = (expense.category||'').toLowerCase().replace(/\s+/g,'');
        var over = isRowOverBudget(expense);
        if (over) tr.classList.add('row--overspent');

        tr.innerHTML =
          '<td>'+escapeHtml(formatDate(expense.date))+'</td>'+
          '<td>'+
            '<span style="font-weight:600">'+escapeHtml(expense.name)+'</span>'+
            (over ? '<span class="overspent-tag" aria-label="Melebihi anggaran">⚠ Over</span>' : '')+
            (expense.description ? '<br><span style="font-size:12px;color:var(--clr-text-muted)">'+escapeHtml(expense.description)+'</span>' : '')+
          '</td>'+
          '<td><span class="cat-badge cat-badge--'+catKey+'">'+escapeHtml(expense.category)+'</span></td>'+
          '<td class="text-right amount-cell">'+escapeHtml(formatRupiah(expense.amount))+'</td>'+
          '<td class="text-center">'+
            '<button type="button" class="btn btn--secondary btn--icon" data-action="edit" data-id="'+escapeHtml(expense.id)+'" aria-label="Edit transaksi '+escapeHtml(expense.name)+'">✏️ Edit</button> '+
            '<button type="button" class="btn btn--danger btn--icon" data-action="delete" data-id="'+escapeHtml(expense.id)+'" aria-label="Hapus transaksi '+escapeHtml(expense.name)+'">🗑️ Hapus</button>'+
          '</td>';
        tbody.appendChild(tr);
      });

      tbody.onclick = function(e){
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var id=btn.dataset.id, action=btn.dataset.action;
        if (action==='edit') {
          var exp=AppState.expenses.find(function(ex){ return ex.id===id; });
          if (!exp) return;
          FormController.populateExpenseForm(exp);
          Router.navigate('expenses');
          var formEl=document.getElementById('expense-form');
          if (formEl) formEl.scrollIntoView({behavior:'smooth',block:'start'});
        } else if (action==='delete') {
          var exp=AppState.expenses.find(function(ex){ return ex.id===id; });
          if (!exp) return;
          if (!window.confirm('Hapus transaksi "'+exp.name+'" sebesar '+formatRupiah(exp.amount)+'?\n\nTindakan ini tidak dapat dibatalkan.')) return;
          AppState=ExpenseService.remove(AppState,id);
          StorageManager.save(AppState);
          ExpenseListView.render(AppState);
          DashboardView.render(AppState);
          NotificationManager.show('Transaksi berhasil dihapus.','success');
        }
      };
    }
  };

  /* ── BUDGET VIEW ──────────────────────────────────────────── */
  var BudgetView = {
    render: function (state) {
      var tbody=document.getElementById('budget-table-body'), emptyEl=document.getElementById('budget-empty-state');
      if (!tbody) return;
      tbody.innerHTML='';
      if (!state.budgets.length) { if(emptyEl) emptyEl.hidden=false; return; }
      if (emptyEl) emptyEl.hidden=true;
      state.budgets.forEach(function(budget){
        var pe=state.expenses.filter(function(e){ return e.category===budget.category&&dateToPeriod(e.date)===budget.period; });
        var sp=pe.reduce(function(s,e){ return s+e.amount; },0);
        var st=BudgetService.getStatus(sp,budget.limit);
        var pct=SummaryCalculator.progressPercent(sp,budget.limit);
        var tr=document.createElement('tr');
        tr.innerHTML=
          '<td><span class="cat-badge">'+escapeHtml(budget.category)+'</span></td>'+
          '<td>'+escapeHtml(budget.period)+'</td>'+
          '<td class="text-right">'+escapeHtml(formatRupiah(budget.limit))+'</td>'+
          '<td class="text-right" style="color:'+(st.status==='warning'?'var(--clr-danger)':'var(--clr-accent)')+';font-weight:600">'+escapeHtml(formatRupiah(sp))+' ('+Math.round(pct)+'%)</td>'+
          '<td class="text-center">'+
            '<button type="button" class="btn btn--secondary btn--icon" data-action="edit" data-id="'+escapeHtml(budget.id)+'" aria-label="Edit anggaran '+escapeHtml(budget.category)+'">✏️ Edit</button> '+
            '<button type="button" class="btn btn--danger btn--icon" data-action="delete" data-id="'+escapeHtml(budget.id)+'" aria-label="Hapus anggaran '+escapeHtml(budget.category)+'">🗑️ Hapus</button>'+
          '</td>';
        tbody.appendChild(tr);
      });
      tbody.onclick=function(e){
        var btn=e.target.closest('[data-action]');
        if (!btn) return;
        var id=btn.dataset.id, action=btn.dataset.action;
        if (action==='edit') {
          var bud=AppState.budgets.find(function(b){ return b.id===id; });
          if (!bud) return;
          document.getElementById('budget-category').value=bud.category;
          document.getElementById('budget-period').value=bud.period;
          document.getElementById('budget-limit').value=bud.limit;
          document.getElementById('budget-editing-id').value=bud.id;
          var sb=document.getElementById('budget-submit-btn'), cb=document.getElementById('budget-cancel-btn'), ft=document.getElementById('budget-form-title');
          if(sb) sb.innerHTML='💾 Simpan Perubahan';
          if(cb) cb.hidden=false;
          if(ft) ft.textContent='Edit Anggaran';
          var f=document.getElementById('budget-form'); if(f) f.scrollIntoView({behavior:'smooth',block:'start'});
        } else if (action==='delete') {
          var bud=AppState.budgets.find(function(b){ return b.id===id; });
          if (!bud) return;
          if (!window.confirm('Hapus anggaran '+bud.category+' untuk periode '+bud.period+'?')) return;
          AppState=BudgetService.remove(AppState,id);
          StorageManager.save(AppState);
          BudgetView.render(AppState);
          DashboardView.render(AppState);
          NotificationManager.show('Anggaran berhasil dihapus.','success');
        }
      };
    }
  };

  /* ── CATEGORY MANAGEMENT VIEW ─────────────────────────────── */
  var CategoryManagementView = {
    render: function (state) {
      var list=document.getElementById('category-list');
      if (!list) return;
      list.innerHTML='';
      state.categories.forEach(function(cat){
        var li=document.createElement('li');
        li.className='category-item';
        li.innerHTML=escapeHtml(cat.name)+'<button type="button" class="category-item__delete" data-id="'+escapeHtml(cat.id)+'" aria-label="Hapus kategori '+escapeHtml(cat.name)+'">×</button>';
        list.appendChild(li);
      });
      list.onclick=function(e){
        var btn=e.target.closest('[data-id]');
        if (!btn) return;
        var id=btn.dataset.id, cat=AppState.categories.find(function(c){ return c.id===id; });
        if (!cat) return;
        var res=CategoryService.remove(AppState,id,false), counts=res.associationCounts;
        if (counts.expenses>0||counts.budgets>0) {
          if (!window.confirm('Kategori "'+cat.name+'" memiliki '+counts.expenses+' transaksi dan '+counts.budgets+' anggaran terkait.\n\nMenghapus kategori akan memindahkan semua transaksi ke "Uncategorized".\n\nLanjutkan?')) return;
        }
        var confirmed=CategoryService.remove(AppState,id,true);
        AppState=confirmed.state;
        StorageManager.save(AppState);
        populateCategorySelects();
        CategoryManagementView.render(AppState);
        ExpenseListView.render(AppState);
        BudgetView.render(AppState);
        DashboardView.render(AppState);
        NotificationManager.show('Kategori "'+cat.name+'" berhasil dihapus.','success');
      };
    }
  };

  /* ── APP INIT ─────────────────────────────────────────────── */
  function init() {
    // Storage check
    if (!StorageManager.isAvailable()) {
      var banner=document.createElement('div');
      banner.style.cssText='position:fixed;top:0;left:0;right:0;background:#EF4444;color:#fff;text-align:center;padding:12px;font-weight:600;z-index:9999';
      banner.textContent='Penyimpanan lokal tidak tersedia di browser ini. Data tidak akan tersimpan.';
      document.body.prepend(banner);
    }

    // Load stored data
    try {
      var stored=StorageManager.load();
      if (stored) { AppState.expenses=stored.expenses||[]; AppState.budgets=stored.budgets||[]; AppState.categories=stored.categories||[]; }
    } catch(e) { NotificationManager.show('Gagal memuat data tersimpan. Memulai dengan data kosong.','error'); }

    // Seed defaults
    if (!AppState.categories.length) {
      CategoryService.getDefaults().forEach(function(name){ var r=CategoryService.add(AppState,name); AppState=r.state; });
    }

    AppState.selectedPeriod = currentPeriod();

    // Dark mode
    DarkMode.init();

    // Category selects
    populateCategorySelects();

    // Default date/period
    var di=document.getElementById('expense-date'); if(di) di.value=todayISO();
    var bpi=document.getElementById('budget-period'); if(bpi) bpi.value=currentPeriod();

    // Router
    Router.init();
    Router.navigate('dashboard');

    // Sort controls
    initSortControls();

    // Dashboard period selector
    var dp=document.getElementById('dashboard-period');
    if (dp) {
      dp.value=AppState.selectedPeriod;
      dp.addEventListener('change', function(){ AppState.selectedPeriod=dp.value; DashboardView.render(AppState); });
    }

    // Expense form
    FormController.bindExpenseForm(function(raw){
      FormController.clearFieldErrors();
      var result = raw.editingId ? ExpenseService.update(AppState,raw.editingId,raw) : ExpenseService.add(AppState,raw);
      if (result.errors.length) { result.errors.forEach(function(err){ FormController.showFieldError(err.field,err.msg); }); return; }
      AppState=result.state;
      StorageManager.save(AppState);
      FormController.resetExpenseForm();
      var di=document.getElementById('expense-date'); if(di) di.value=todayISO();
      ExpenseListView.render(AppState);
      DashboardView.render(AppState);
      NotificationManager.show(raw.editingId?'Transaksi berhasil diperbarui.':'Transaksi berhasil ditambahkan!','success');
    });

    var ceb=document.getElementById('expense-cancel-btn');
    if (ceb) ceb.addEventListener('click', function(){ FormController.resetExpenseForm(); var di=document.getElementById('expense-date'); if(di) di.value=todayISO(); });

    // Budget form
    FormController.bindBudgetForm(function(raw){
      FormController.clearFieldErrors();
      var result = raw.editingId ? BudgetService.update(AppState,raw.editingId,raw) : BudgetService.add(AppState,raw);
      if (result.errors.length) { result.errors.forEach(function(err){ FormController.showFieldError(err.field,err.msg); }); return; }
      AppState=result.state;
      StorageManager.save(AppState);
      FormController.resetBudgetForm();
      var bpi=document.getElementById('budget-period'); if(bpi) bpi.value=currentPeriod();
      BudgetView.render(AppState);
      DashboardView.render(AppState);
      NotificationManager.show(raw.editingId?'Anggaran berhasil diperbarui.':'Anggaran berhasil disimpan!','success');
    });

    var cbb=document.getElementById('budget-cancel-btn');
    if (cbb) cbb.addEventListener('click', function(){ FormController.resetBudgetForm(); var bpi=document.getElementById('budget-period'); if(bpi) bpi.value=currentPeriod(); });

    // Filter controls
    var fc=document.getElementById('filter-category'), fd=document.getElementById('filter-date-from'), ft=document.getElementById('filter-date-to'), fp=document.getElementById('filter-period');
    function applyFilters(){
      AppState.activeFilters={ category:fc?(fc.value||null):null, dateFrom:fd?(fd.value||null):null, dateTo:ft?(ft.value||null):null, period:fp?(fp.value||null):null };
      ExpenseListView.render(AppState);
    }
    if(fc) fc.addEventListener('change',applyFilters);
    if(fd) fd.addEventListener('change',applyFilters);
    if(ft) ft.addEventListener('change',applyFilters);
    if(fp) fp.addEventListener('change',applyFilters);

    var clf=document.getElementById('filter-clear-btn');
    if (clf) clf.addEventListener('click', function(){
      if(fc) fc.value=''; if(fd) fd.value=''; if(ft) ft.value=''; if(fp) fp.value='';
      AppState.activeFilters={category:null,dateFrom:null,dateTo:null,period:null};
      ExpenseListView.render(AppState);
      NotificationManager.show('Filter dihapus. Menampilkan semua transaksi.','info');
    });

    // Export
    var expBtn=document.getElementById('export-btn');
    if (expBtn) expBtn.addEventListener('click', function(){
      var period=AppState.selectedPeriod, csv=CSVExporter.generate(AppState.expenses,period);
      if (!csv) { NotificationManager.show('Tidak ada data transaksi untuk periode '+period+'.','info'); return; }
      CSVExporter.triggerDownload(csv,CSVExporter.filename(period));
      NotificationManager.show('File CSV berhasil diunduh.','success');
    });

    // Add custom category
    var acb=document.getElementById('add-category-btn'), ncn=document.getElementById('new-category-name');
    if (acb&&ncn) {
      acb.addEventListener('click', function(){
        var errEl=document.querySelector('[data-error="new-category-name"]');
        if(errEl) errEl.textContent='';
        ncn.classList.remove('is-invalid');
        var addedName=ncn.value.trim(); var result=CategoryService.add(AppState,ncn.value);
        if (result.errors.length) {
          if(errEl) errEl.textContent=result.errors[0];
          ncn.classList.add('is-invalid');
          return;
        }
        AppState=result.state;
        StorageManager.save(AppState);
        ncn.value='';
        populateCategorySelects();
        CategoryManagementView.render(AppState);
        NotificationManager.show('Kategori "'+addedName+'" berhasil ditambahkan!','success');
      });
      ncn.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); acb.click(); } });
    }

    // Initial render
    DashboardView.render(AppState);
    ExpenseListView.render(AppState);
    BudgetView.render(AppState);
    CategoryManagementView.render(AppState);
  }

  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(init,0); });
  } else {
    setTimeout(init,0);
  }

})();
