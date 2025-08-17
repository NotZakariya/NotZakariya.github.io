---
title: Tags
layout: default
---


<div class="main-content">
  <h1 class="main-title">Tags</h1>
  {% assign tags = site.tags | sort %}
  {% if tags.size > 0 %}
    <div class="tags-cloud">
      {% for tag in tags %}
        <a href="#{{ tag[0] | slugify }}" class="tag">{{ tag[0] }} <span class="tag-count">({{ tag[1].size }})</span></a>
      {% endfor %}
    </div>
  {% endif %}
  {% for tag in tags %}
    {% if tag[1].size > 0 %}
      <h2 id="{{ tag[0] | slugify }}">{{ tag[0] }}</h2>
      <ul>
        {% for post in tag[1] %}
          <li><a href="{{ post.url }}">{{ post.title }}</a> <span class="post-meta">{{ post.date | date: "%B %d, %Y" }}</span></li>
        {% endfor %}
      </ul>
    {% endif %}
  {% endfor %}
</div>
