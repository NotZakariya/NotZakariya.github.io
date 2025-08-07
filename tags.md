---
title: Tags
layout: default
---

<!-- container removed, handled by layout -->
  <h1 class="main-title">Tags</h1>
  <div class="tags-cloud">
    {% assign tags = site.tags | sort %}
    {% for tag in tags %}
      <a href="#{{ tag[0] | slugify }}" class="tag">{{ tag[0] }} <span class="tag-count">({{ tag[1].size }})</span></a>
    {% endfor %}
  </div>
  <hr>
  {% for tag in tags %}
    <h2 id="{{ tag[0] | slugify }}">{{ tag[0] }}</h2>
    <ul>
      {% for post in tag[1] %}
        <li><a href="{{ post.url }}">{{ post.title }}</a> <span class="post-meta">{{ post.date | date: "%B %d, %Y" }}</span></li>
      {% endfor %}
    </ul>
  {% endfor %}
<!-- container removed, handled by layout -->
