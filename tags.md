---
title: Tags
layout: default
permalink: /tags/
---

<div style="display: flex; gap: 2rem; max-width: 1200px; margin: 0 auto; padding: 2rem 1rem 2rem 1rem;">
  <!-- Sidebar -->
  <div style="min-width: 280px; max-width: 400px; background: rgba(255,255,255,0.2); border-radius: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.07); padding: 2rem 1rem 2rem 1rem; margin: 0; height: fit-content; position: sticky; top: 2rem;">
    <h2 style="color: #009e73; font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem;">Tags</h2>
    {% assign tags = site.tags | sort %}
    {% if tags.size > 0 %}
      {% for tag in tags %}
        <a href="#{{ tag[0] | slugify }}" style="background: #fff; color: #009e73; border: 2px solid #009e73; border-radius: 2rem; padding: 0.5rem 1.5rem; font-size: 1.1rem; font-weight: 600; text-decoration: none; box-shadow: 0 2px 8px rgba(0,0,0,0.07); transition: background 0.2s, color 0.2s; display: block; margin-bottom: 0.5rem; text-align: left;"
          onmouseover="this.style.background='#009e73';this.style.color='#fff'"
          onmouseout="this.style.background='#fff';this.style.color='#009e73'"
        >{{ tag[0] }}</a>
      {% endfor %}
    {% else %}
      <div style="color: #ff5722; font-size: 1.2rem; text-align: left; margin-top: 2rem;">No tags found.</div>
    {% endif %}
  </div>

  <!-- Main Content -->
  <div style="flex: 1; text-align: left;">
    <h1 style="font-size: 2.5rem; color: #009e73; font-weight: 700; margin-bottom: 2rem;">Tags & Posts</h1>
    {% for tag in tags %}
      <div id="{{ tag[0] | slugify }}" style="margin-bottom: 2.5rem; scroll-margin-top: 2rem;">
        <h2 style="color: #009e73; font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">{{ tag[0] }}</h2>
        {% assign posts = tag[1] %}
        {% if posts.size > 0 %}
          <ul style="list-style: none; padding: 0;">
            {% for post in posts %}
              <li style="margin-bottom: 1.2rem;">
                <a href="{{ post.url }}" style="font-size: 1.1rem; color: #009e73; font-weight: 600; text-decoration: none;">{{ post.title }}</a>
                <span style="color: #666; font-size: 0.95rem;">({{ post.date | date: "%B %d, %Y" }})</span>
              </li>
            {% endfor %}
          </ul>
        {% else %}
          <div style="color: #ff5722; font-size: 1.1rem;">No posts for this tag.</div>
        {% endif %}
      </div>
    {% endfor %}
  </div>
</div>
