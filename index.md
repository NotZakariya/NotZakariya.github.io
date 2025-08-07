---
layout: default
title: Home
---

<!-- container removed, handled by layout -->
  <h1 class="main-title">Posts</h1>
  <ul class="post-list">
    {% for post in site.posts %}
      <li>
        <a href="{{ post.url }}">{{ post.title }}</a>
        <span class="post-meta">{{ post.date | date: "%B %d, %Y" }}</span>
        {% if post.tags %}
          <span class="post-tags">
            {% for tag in post.tags %}
              <a href="/tags/#{{ tag | slugify }}" class="tag">{{ tag }}</a>{% unless forloop.last %}, {% endunless %}
            {% endfor %}
          </span>
        {% endif %}
      </li>
    {% endfor %}
  </ul>
<!-- container removed, handled by layout -->