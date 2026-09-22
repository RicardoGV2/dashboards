// Demo data lives in this file. Replace it with your own data or API responses.
const DEMO = {
  overview: {
    title: 'Overview', description: "A little clarity on how things are going. Here's your snapshot.",
    chartTitle: 'Visitors over time', chartDescription: 'Daily traffic across your workspace', unit: 'visitors',
    metrics: [
      { label: 'Total visitors', value: 24892, format: 'number', change: 12.8, icon: '◉' },
      { label: 'Revenue', value: 48562, format: 'money', change: 8.2, icon: '＄' },
      { label: 'Conversions', value: 1842, format: 'number', change: 16.4, icon: '◇' },
      { label: 'Bounce rate', value: 32.8, format: 'percent', change: -2.3, icon: '↗', inverse: true }
    ],
    channels: [{ name: 'Organic search', percent: 46, color: '#6965db' }, { name: 'Direct', percent: 32, color: '#36b9a7' }, { name: 'Social media', percent: 22, color: '#eeb36f' }],
    series: [380, 475, 420, 525, 500, 645, 585, 670, 610, 750, 690, 780]
  },
  audience: {
    title: 'Audience', description: 'Explore the people finding and using your project.',
    chartTitle: 'Audience growth', chartDescription: 'Estimated active users over time', unit: 'active users',
    metrics: [
      { label: 'Active users', value: 18640, format: 'number', change: 10.4, icon: '◉' },
      { label: 'New users', value: 7521, format: 'number', change: 7.1, icon: '✳' },
      { label: 'Returning users', value: 11119, format: 'number', change: 13.2, icon: '↩' },
      { label: 'Avg. engagement', value: 4.6, format: 'minutes', change: 5.3, icon: '◷' }
    ],
    channels: [{ name: 'Desktop', percent: 54, color: '#6965db' }, { name: 'Mobile', percent: 38, color: '#36b9a7' }, { name: 'Tablet', percent: 8, color: '#eeb36f' }],
    series: [270, 295, 355, 330, 425, 400, 465, 430, 500, 550, 530, 625]
  },
  revenue: {
    title: 'Revenue', description: 'A clear picture of your example business performance.',
    chartTitle: 'Revenue over time', chartDescription: 'Estimated sales in USD', unit: 'in revenue',
    metrics: [
      { label: 'Total revenue', value: 48562, format: 'money', change: 8.2, icon: '＄' },
      { label: 'Orders', value: 1248, format: 'number', change: 11.6, icon: '▣' },
      { label: 'Avg. order value', value: 38.91, format: 'moneyPrecise', change: -1.2, icon: '◇' },
      { label: 'Refunds', value: 2.1, format: 'percent', change: -0.8, icon: '↩', inverse: true }
    ],
    channels: [{ name: 'Online store', percent: 58, color: '#6965db' }, { name: 'Subscriptions', percent: 27, color: '#36b9a7' }, { name: 'Other', percent: 15, color: '#eeb36f' }],
    series: [650, 770, 730, 810, 795, 900, 850, 1010, 990, 1090, 1040, 1220]
  },
  performance: {
    title: 'Performance', description: 'Track the example indicators that matter to your site.',
    chartTitle: 'Page views over time', chartDescription: 'Estimated page views across your workspace', unit: 'page views',
    metrics: [
      { label: 'Page views', value: 68412, format: 'number', change: 14.6, icon: '◫' },
      { label: 'Sessions', value: 32210, format: 'number', change: 9.8, icon: '◉' },
      { label: 'Pages / session', value: 2.12, format: 'decimal', change: 3.2, icon: '▤' },
      { label: 'Exit rate', value: 28.4, format: 'percent', change: -1.5, icon: '↗', inverse: true }
    ],
    channels: [{ name: 'Landing page', percent: 49, color: '#6965db' }, { name: 'Dashboard', percent: 34, color: '#36b9a7' }, { name: 'Other pages', percent: 17, color: '#eeb36f' }],
    series: [900, 1030, 950, 1180, 1090, 1250, 1210, 1420, 1320, 1550, 1500, 1690]
  }
};

const ACTIVITIES = [
  { symbol: '↗', color: 'green', title: 'Traffic is trending up', detail: 'Your demo workspace received more visits this week.', time: '2 hours ago' },
  { symbol: '✳', color: '', title: 'New milestone reached', detail: 'Your sample project crossed a new visitor milestone.', time: 'Yesterday' },
  { symbol: '◉', color: 'orange', title: 'Audience report updated', detail: 'The latest example audience numbers are ready to review.', time: '2 days ago' },
  { symbol: '▣', color: '', title: 'Monthly report prepared', detail: 'Export the current view as a CSV using the button above.', time: '3 days ago' }
];

const $ = (selector) => document.querySelector(selector);
const formatNumber = new Intl.NumberFormat('en-US');
const formatCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const formatPreciseCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
let activeView = 'overview';
let activeDays = 30;

function formatValue(value, format) {
  switch (format) {
    case 'money': return formatCurrency.format(value);
    case 'moneyPrecise': return formatPreciseCurrency.format(value);
    case 'percent': return `${value.toFixed(1)}%`;
    case 'decimal': return value.toFixed(2);
    case 'minutes': return `${value.toFixed(1)} min`;
    default: return formatNumber.format(Math.round(value));
  }
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function rangeFactor() { return activeDays === 7 ? 0.27 : activeDays === 90 ? 2.72 : 1; }

function renderMetrics(view) {
  const root = $('#metrics');
  root.replaceChildren();
  view.metrics.forEach((metric) => {
    const card = makeElement('article', 'metric-card');
    const top = makeElement('div', 'metric-top');
    top.append(makeElement('p', 'metric-label', metric.label), makeElement('span', 'metric-icon', metric.icon));
    const adjusted = metric.format === 'percent' || metric.format === 'minutes' || metric.format === 'decimal' || metric.format === 'moneyPrecise'
      ? metric.value : metric.value * rangeFactor();
    const value = makeElement('p', 'metric-value', formatValue(adjusted, metric.format));
    const foot = makeElement('div', 'metric-foot');
    const positive = metric.inverse ? metric.change <= 0 : metric.change >= 0;
    const change = makeElement('span', `change ${positive ? 'positive' : 'negative'}`, `${metric.change >= 0 ? '↗ +' : '↘ '}${metric.change.toFixed(1)}%`);
    foot.append(change, document.createTextNode('vs. previous period'));
    card.append(top, value, foot);
    root.append(card);
  });
}

function renderChannels(view) {
  const root = $('#channels');
  root.replaceChildren();
  view.channels.forEach((channel) => {
    const group = makeElement('div', 'channel');
    group.style.setProperty('--bar-color', channel.color);
    group.style.setProperty('--bar-width', `${channel.percent}%`);
    const top = makeElement('div', 'channel-top');
    const label = makeElement('span', 'channel-label');
    label.append(makeElement('span', 'channel-dot'), document.createTextNode(channel.name));
    top.append(label, makeElement('span', 'channel-value', `${channel.percent}%`));
    const track = makeElement('div', 'bar-track');
    track.setAttribute('role', 'img');
    track.setAttribute('aria-label', `${channel.name}: ${channel.percent}%`);
    track.append(makeElement('div', 'bar-fill'));
    group.append(top, track);
    root.append(group);
  });
  $('#channels-title').textContent = activeView === 'audience' ? 'Device breakdown' : activeView === 'revenue' ? 'Revenue sources' : activeView === 'performance' ? 'Top pages' : 'Traffic sources';
}

function svgElement(tag, attributes, text) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderChart(view) {
  const factor = activeDays === 7 ? 0.85 : activeDays === 90 ? 1.32 : 1;
  const values = view.series.map((value) => Math.round(value * factor));
  const max = Math.ceil(Math.max(...values) / 200) * 200;
  const left = 45, right = 668, top = 17, bottom = 210;
  const x = (index) => left + index * (right - left) / (values.length - 1);
  const y = (value) => bottom - value / max * (bottom - top);
  const path = values.map((value, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(2)} ${y(value).toFixed(2)}`).join(' ');
  $('#chart-line').setAttribute('d', path);
  $('#chart-area').setAttribute('d', `${path} L ${right} ${bottom} L ${left} ${bottom} Z`);
  const grid = $('#chart-grid');
  grid.replaceChildren();
  for (let i = 0; i <= 4; i++) {
    const value = max * (4 - i) / 4;
    const lineY = y(value);
    grid.append(svgElement('line', { class: 'chart-gridline', x1: left, y1: lineY, x2: right, y2: lineY }));
    grid.append(svgElement('text', { class: 'chart-axis-label', x: 0, y: lineY + 4 }, value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : String(Math.round(value))));
  }
  const points = $('#chart-points');
  points.replaceChildren();
  values.forEach((value, index) => {
    const point = svgElement('circle', { class: 'chart-point', cx: x(index), cy: y(value), r: index === values.length - 1 ? 5 : 3 });
    point.append(svgElement('title', {}, `${formatNumber.format(value)} ${view.unit}, sample ${index + 1}`));
    points.append(point);
  });
  const periodTotal = view.metrics[0].format === 'money' ? view.metrics[0].value * rangeFactor() : view.metrics[0].value * rangeFactor();
  $('#chart-total').textContent = formatValue(periodTotal, view.metrics[0].format);
  $('#chart-note').textContent = `total ${view.unit} this period`;
  $('#trend-title').textContent = view.chartTitle;
  $('#trend-description').textContent = view.chartDescription;
  $('#trend-chart').setAttribute('aria-label', `${view.chartTitle}: ${values.map((value) => formatNumber.format(value)).join(', ')} (sample data)`);
  const labels = activeDays === 7 ? ['7 days ago', '5 days ago', '3 days ago', 'Today'] : activeDays === 90 ? ['90 days ago', '60 days ago', '30 days ago', 'Today'] : ['30 days ago', '20 days ago', '10 days ago', 'Today'];
  const labelRoot = $('#chart-labels');
  labelRoot.replaceChildren(...labels.map((label) => makeElement('span', '', label)));
}

function renderActivity() {
  const query = $('#search').value.toLocaleLowerCase().trim();
  const filtered = ACTIVITIES.filter((item) => `${item.title} ${item.detail} ${item.time}`.toLocaleLowerCase().includes(query));
  const root = $('#activity-list');
  root.replaceChildren();
  $('#activity-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'event' : 'events'}`;
  if (!filtered.length) {
    root.append(makeElement('p', 'empty-state', 'No activity matches your search.'));
    return;
  }
  filtered.forEach((item) => {
    const row = makeElement('article', 'activity-row');
    const symbol = makeElement('span', `activity-symbol ${item.color}`, item.symbol);
    symbol.setAttribute('aria-hidden', 'true');
    const content = makeElement('div');
    content.append(makeElement('h3', 'activity-name', item.title), makeElement('p', 'activity-detail', item.detail));
    row.append(symbol, content, makeElement('span', 'activity-time', item.time));
    root.append(row);
  });
}

function render() {
  const view = DEMO[activeView];
  $('#page-title').textContent = view.title;
  $('#breadcrumb').textContent = view.title;
  $('#page-description').textContent = view.description;
  document.title = `Dashboards — ${view.title}`;
  document.querySelectorAll('[data-view]').forEach((button) => {
    const selected = button.dataset.view === activeView;
    button.classList.toggle('is-active', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  renderMetrics(view);
  renderChannels(view);
  renderChart(view);
  renderActivity();
}

function exportCsv() {
  const view = DEMO[activeView];
  const rows = [['Dashboard', view.title], ['Period (days)', activeDays], [], ['Metric', 'Value', 'Change (%)']];
  view.metrics.forEach((metric) => {
    const adjusted = ['percent', 'minutes', 'decimal', 'moneyPrecise'].includes(metric.format) ? metric.value : metric.value * rangeFactor();
    rows.push([metric.label, formatValue(adjusted, metric.format), metric.change]);
  });
  rows.push([], ['Breakdown', 'Percent']);
  view.channels.forEach((channel) => rows.push([channel.name, channel.percent]));
  rows.push([], ['Trend sample', 'Value']);
  view.series.forEach((value, index) => rows.push([index + 1, Math.round(value * (activeDays === 7 ? 0.85 : activeDays === 90 ? 1.32 : 1))]));
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dashboards-${activeView}-${activeDays}days.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
  activeView = button.dataset.view;
  render();
  if (window.innerWidth <= 760) $('#main-content').scrollIntoView({ behavior: 'smooth' });
}));
$('#range').addEventListener('change', (event) => { activeDays = Number(event.target.value); render(); });
$('#search').addEventListener('input', renderActivity);
$('#export').addEventListener('click', exportCsv);
$('#theme-toggle').addEventListener('click', () => {
  const dark = document.body.dataset.theme !== 'dark';
  document.body.dataset.theme = dark ? 'dark' : 'light';
  $('#theme-toggle').textContent = dark ? '☀' : '☾';
  $('#theme-toggle').setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  try { localStorage.setItem('dashboards-theme', dark ? 'dark' : 'light'); } catch { /* Storage is optional. */ }
});
try {
  if (localStorage.getItem('dashboards-theme') === 'dark') {
    document.body.dataset.theme = 'dark';
    $('#theme-toggle').textContent = '☀';
    $('#theme-toggle').setAttribute('aria-label', 'Switch to light mode');
  }
} catch { /* Private browsing or disabled storage is fine. */ }
render();
