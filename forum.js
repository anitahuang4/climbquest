import { supabase } from './supabase.js';
let currentUser = null;
let currentFilter = 'all';
let activeThreadId = null;
let selectedTag = 'general';
let votedThreadIds = new Set(JSON.parse(localStorage.getItem('cq_voted') || '[]'));
const threadList = document.getElementById('threadList');
const composeBox = document.getElementById('composeBox');
const newThreadBtn = document.getElementById('newThreadBtn');
const composeCancelBtn = document.getElementById('composeCancelBtn');
const composeSubmitBtn = document.getElementById('composeSubmitBtn');
const composeTags = document.getElementById('composeTags');
const composeTitle = document.getElementById('composeTitle');
const composeBody = document.getElementById('composeBody');
const filterRow = document.getElementById('filterRow');
const threadDetail = document.getElementById('threadDetail');
const detailBackdrop = document.getElementById('detailBackdrop');
const detailClose = document.getElementById('detailClose');
const detailTag = document.getElementById('detailTag');
const detailTitle = document.getElementById('detailTitle');
const detailAuthor = document.getElementById('detailAuthor');
const detailDate = document.getElementById('detailDate');
const detailUpvotes = document.getElementById('detailUpvotes');
const detailBody = document.getElementById('detailBody');
const detailReplies = document.getElementById('detailReplies');
const replyInput = document.getElementById('replyInput');
const replySubmitBtn = document.getElementById('replySubmitBtn');
const replyMessage = document.getElementById('replyMessage');
const navUser = document.getElementById('navUser');
const logoutBtn = document.getElementById('logoutBtn');
async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { window.location.href = 'index.html'; return; }
  currentUser = user;
  const username =
    user.user_metadata?.username ||
    user.email?.split('@')[0] ||
    'climber';
  if (navUser) navUser.textContent = username;
  bindEvents();
  loadThreads();
}
async function loadThreads() {
  let query = supabase
    .from('forum_threads')
    .select('id, title, body, tag, author_name, upvotes, reply_count, created_at')
    .order('created_at', { ascending: false });
  if (currentFilter !== 'all') {
    query = query.eq('tag', currentFilter);
  }
  const { data, error } = await query;
  ['skeletonA', 'skeletonB', 'skeletonC'].forEach(id => {
    document.getElementById(id)?.remove();
  });
  if (error) {
    threadList.innerHTML = `<div class="thread-empty">
      <div class="thread-empty-title">Couldn't load posts</div>
      <div class="thread-empty-sub">${error.message}</div>
    </div>`;
    return;
  }
  if (!data || data.length === 0) {
    threadList.innerHTML = `<div class="thread-empty">
      <div class="thread-empty-title">No posts yet</div>
      <div class="thread-empty-sub">Be the first to post</div>
    </div>`;
    return;
  }
  threadList.innerHTML = data.map(thread => renderThreadRow(thread)).join('');
  threadList.querySelectorAll('.thread-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.thread-upvote-btn')) return;
      openThread(row.dataset.id);
    });
  });
  threadList.querySelectorAll('.thread-upvote-btn').forEach(btn => {
    btn.addEventListener('click', () => handleUpvote(btn));
  });
}
function renderThreadRow(thread) {
  const voted = votedThreadIds.has(thread.id);
  const date = timeAgo(thread.created_at);
  return `
    <div class="thread-row" data-id="${thread.id}">
      <div class="thread-row-left">
        <div class="thread-top">
          <span class="thread-tag tag-${thread.tag}">${thread.tag}</span>
        </div>
        <div class="thread-title">${escHtml(thread.title)}</div>
        <div class="thread-preview">${escHtml(thread.body)}</div>
        <div class="thread-meta">
          <span class="thread-meta-author">${escHtml(thread.author_name)}</span>
          <span>${date}</span>
          <span>${thread.reply_count || 0} repl${thread.reply_count === 1 ? 'y' : 'ies'}</span>
        </div>
      </div>
      <div class="thread-row-right">
        <button class="thread-upvote-btn ${voted ? 'voted' : ''}" data-id="${thread.id}" data-voted="${voted}">
          ▲ <span class="upvote-count">${thread.upvotes || 0}</span>
        </button>
      </div>
    </div>
  `;
}
async function openThread(id) {
  activeThreadId = id;
  threadDetail.classList.add('open');
  document.body.style.overflow = 'hidden';
  const row = threadList.querySelector(`.thread-row[data-id="${id}"]`);
  if (row) {
    detailTitle.textContent = row.querySelector('.thread-title').textContent;
    detailBody.textContent = '…';
    detailAuthor.textContent = row.querySelector('.thread-meta-author').textContent;
    detailDate.textContent = row.querySelector('.thread-meta span:nth-child(2)').textContent;
    detailTag.textContent = row.querySelector('.thread-tag').textContent;
    detailTag.className = 'eyebrow eyebrow-dot';
    detailUpvotes.textContent = row.querySelector('.upvote-count').textContent + ' ▲';
  }
  detailReplies.innerHTML = '<div class="reply-empty">Loading replies…</div>';
  const [threadRes, repliesRes] = await Promise.all([
    supabase.from('forum_threads').select('*').eq('id', id).single(),
    supabase.from('forum_replies')
      .select('id, body, author_name, created_at')
      .eq('thread_id', id)
      .order('created_at', { ascending: true }),
  ]);
  if (threadRes.data) {
    const t = threadRes.data;
    detailTitle.textContent = t.title;
    detailBody.textContent = t.body;
    detailAuthor.textContent = t.author_name;
    detailDate.textContent = timeAgo(t.created_at);
    detailUpvotes.textContent = (t.upvotes || 0) + ' ▲';
    detailTag.textContent = t.tag;
  }
  if (repliesRes.error || !repliesRes.data || repliesRes.data.length === 0) {
    detailReplies.innerHTML = '<div class="reply-empty">No replies yet — be the first!</div>';
  } else {
    detailReplies.innerHTML = repliesRes.data.map(r => `
      <div class="reply-item">
        <div class="reply-header">
          <div class="reply-avatar"></div>
          <span class="reply-author">${escHtml(r.author_name)}</span>
          <span class="reply-time">${timeAgo(r.created_at)}</span>
        </div>
        <div class="reply-body">${escHtml(r.body)}</div>
      </div>
    `).join('');
  }
}
function closeThread() {
  threadDetail.classList.remove('open');
  document.body.style.overflow = '';
  activeThreadId = null;
  replyInput.value = '';
  replyMessage.textContent = '';
}
async function submitReply() {
  const body = replyInput.value.trim();
  if (!body || !activeThreadId) return;
  replySubmitBtn.disabled = true;
  replyMessage.textContent = '';
  const username =
    currentUser.user_metadata?.username ||
    currentUser.email?.split('@')[0] ||
    'climber';
  const { error } = await supabase.from('forum_replies').insert({
    thread_id: activeThreadId,
    body,
    author_id: currentUser.id,
    author_name: username,
  });
  if (error) {
    replyMessage.textContent = error.message;
    replySubmitBtn.disabled = false;
    return;
  }
  const { data: t } = await supabase
    .from('forum_threads')
    .select('reply_count')
    .eq('id', activeThreadId)
    .single();
  await supabase
    .from('forum_threads')
    .update({ reply_count: (t.reply_count || 0) + 1 })
    .eq('id', activeThreadId);
  replyInput.value = '';
  replySubmitBtn.disabled = false;
  await openThread(activeThreadId);
  const countEl = threadList.querySelector(`.thread-row[data-id="${activeThreadId}"] .thread-meta span:nth-child(3)`);
  if (countEl) {
    const n = (t.reply_count || 0) + 1;
    countEl.textContent = `${n} repl${n === 1 ? 'y' : 'ies'}`;
  }
}
async function handleUpvote(btn) {
  const id = btn.dataset.id;
  const voted = btn.dataset.voted === 'true';
  const delta = voted ? -1 : 1;
  const countEl = btn.querySelector('.upvote-count');
  const newCount = Math.max(0, parseInt(countEl.textContent) + delta);
  countEl.textContent = newCount;
  btn.dataset.voted = String(!voted);
  btn.classList.toggle('voted', !voted);
  if (voted) votedThreadIds.delete(id);
  else votedThreadIds.add(id);
  localStorage.setItem('cq_voted', JSON.stringify([...votedThreadIds]));
  await supabase
    .from('forum_threads')
    .update({ upvotes: newCount })
    .eq('id', id);
}
async function submitThread() {
  const title = composeTitle.value.trim();
  const body = composeBody.value.trim();
  if (!title || !body) return;
  composeSubmitBtn.disabled = true;
  const username =
    currentUser.user_metadata?.username ||
    currentUser.email?.split('@')[0] ||
    'climber';
  const { error } = await supabase.from('forum_threads').insert({
    title,
    body,
    tag: selectedTag,
    author_id: currentUser.id,
    author_name: username,
    upvotes: 0,
    reply_count: 0,
  });
  composeSubmitBtn.disabled = false;
  if (error) {
    alert(error.message);
    return;
  }
  composeTitle.value = '';
  composeBody.value = '';
  composeBox.classList.remove('open');
  await loadThreads();
}
function bindComposeTags() {
  composeTags.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      composeTags.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTag = btn.dataset.tag;
    });
  });
}
function bindFilters() {
  filterRow.querySelectorAll('.filter-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      filterRow.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      threadList.innerHTML = `
        <div class="skeleton-row"><div class="skeleton-line short"></div><div class="skeleton-line mid"></div></div>
        <div class="skeleton-row"><div class="skeleton-line short"></div><div class="skeleton-line" style="width:70%"></div></div>
      `;
      loadThreads();
    });
  });
}
function bindEvents() {
  newThreadBtn.addEventListener('click', () => composeBox.classList.toggle('open'));
  composeCancelBtn.addEventListener('click', () => {
    composeBox.classList.remove('open');
    composeTitle.value = '';
    composeBody.value = '';
  });
  composeSubmitBtn.addEventListener('click', submitThread);
  composeTitle.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); composeBody.focus(); }
  });
  detailBackdrop.addEventListener('click', closeThread);
  detailClose.addEventListener('click', closeThread);
  replySubmitBtn.addEventListener('click', submitReply);
  replyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(); }
  });
  replyInput.addEventListener('input', () => {
    replyInput.style.height = 'auto';
    replyInput.style.height = Math.min(replyInput.scrollHeight, 120) + 'px';
  });
  logoutBtn?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.href = 'index.html';
  });
  bindComposeTags();
  bindFilters();
}
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
init();