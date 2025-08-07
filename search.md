---
layout: default
title: Search
---

<div class="container">
  <h1 class="main-title">Search</h1>
  <input type="text" id="search-input" placeholder="Type to search posts..." class="search-bar" autocomplete="off">
  <ul id="search-results" class="post-list"></ul>
</div>

<script>
const posts = [
  {% for post in site.posts %}
    {
      title: {{ post.title | jsonify }},
      url: {{ post.url | jsonify }},
      date: {{ post.date | date: '%B %d, %Y' | jsonify }},
      tags: {{ post.tags | jsonify }},
      excerpt: {{ post.excerpt | strip_html | strip_newlines | jsonify }}
    }{% unless forloop.last %},{% endunless %}
  {% endfor %}
];

const input = document.getElementById('search-input');
const results = document.getElementById('search-results');

input.addEventListener('input', function() {
  const query = this.value.trim().toLowerCase();
  results.innerHTML = '';
  if (!query) return;
  const filtered = posts.filter(post =>
    post.title.toLowerCase().includes(query) ||
    (post.excerpt && post.excerpt.toLowerCase().includes(query)) ||
    (post.tags && post.tags.join(' ').toLowerCase().includes(query))
  );
  filtered.forEach(post => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${post.url}">${post.title}</a> <span class="post-meta">${post.date}</span>`;
    results.appendChild(li);
  });
});
</script>

<style>
.search-bar {
  width: 100%;
  max-width: 400px;
  padding: 0.7em 1em;
  font-size: 1.1em;
  border: 1px solid #e5e5e5;
  border-radius: 999px;
  margin: 1.5em auto 2em auto;
  display: block;
  background: #fff;
  box-shadow: 0 2px 8px rgba(5,191,133,0.07);
}
</style>