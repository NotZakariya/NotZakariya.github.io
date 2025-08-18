---
title: Tags
layout: default
permalink: /tags/
---



<div style="display: flex; align-items: stretch; justify-content: flex-start; max-width: 1200px; margin: 0 auto; padding: 2rem 0 0 0; width: 100%; box-sizing: border-box;">
  <!-- Sidebar -->
  <div style="min-width: 280px; max-width: 400px; margin-left: 0 !important; padding-left: 0 !important; height: fit-content; position: sticky; top: 2rem;">

<div style="display: flex; align-items: center; gap: 1em; margin-bottom: 1.5rem;">
  <h2 style="color: #009e73; font-size: 1.5rem; font-weight: 700; margin: 0;">Tags</h2>
  <input id="tag-search" type="text" placeholder="Search tags..." style="padding: 0.4em 1em; font-size: 1.13em; border: 2px solid #009966; border-radius: 1em; font-family: 'Georgia', serif; font-style: italic; letter-spacing: 0.04em; color: #444;">
</div>
    {% assign tags = site.tags | sort %}
  <div id="tags-sidebar-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
      {% if tags.size > 0 %}
        {% for tag in tags %}
          <a class="sidebar-tag" href="#{{ tag[0] | slugify }}" style="background: #fff; color: #009e73; border: 2px solid #009e73; border-radius: 2rem; padding: 0.5rem 1.5rem; font-size: 1.1rem; font-weight: 600; text-decoration: none; box-shadow: 0 2px 8px rgba(0,0,0,0.07); transition: background 0.2s, color 0.2s; display: block; margin-bottom: 0.5rem; text-align: left;"
            onmouseover="this.style.background='#009e73';this.style.color='#fff'"
            onmouseout="this.style.background='#fff';this.style.color='#009e73'"
          >{{ tag[0] }}</a>
        {% endfor %}
      {% else %}
        <div style="color: #ff5722; font-size: 1.2rem; text-align: left; margin-top: 2rem;">No tags found.</div>
      {% endif %}
    </div>
  </div>

  <!-- Main Content -->
  <div style="flex: 1; text-align: left; max-width: 600px; margin: 0 auto;">
    <h1 style="font-size: 2.5rem; color: #009e73; font-weight: 700; margin-bottom: 2rem;">Tags & Posts</h1>
    <div id="tags-posts-list">
      {% for tag in tags %}
        <div class="tag-group" data-tag="{{ tag[0] | downcase }}" id="{{ tag[0] | slugify }}" style="margin-bottom: 2.5rem; scroll-margin-top: 2rem;">
          <h2 style="color: #ff5722; font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">{{ tag[0] }}</h2>
          {% assign posts = tag[1] %}
          {% if posts.size > 0 %}
            <ul style="list-style: none; padding: 0;">
              {% for post in posts %}
                <li style="margin-bottom: 1.2rem;">
                  <a href="{{ post.url }}" style="font-size: 1.1rem; color: #009e73; font-weight: 600; text-decoration: none;">{{ post.title }}</a>
                  <span style="color: #666; font-size: 0.95rem;">({{ post.date | date: "%B %d, %Y" }})</span>
                  {% if post.excerpt %}
                    <div style="color: #444; font-size: 1rem; margin-top: 0.3rem;">{{ post.excerpt | strip_html | truncate: 160 }}</div>
                  {% endif %}
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
</div>

<script>
// Filter tags and posts as user types
document.getElementById('tag-search').addEventListener('input', function(e) {
  const query = e.target.value.trim().toLowerCase();
  // Sidebar tags
  document.querySelectorAll('#tags-sidebar-list .sidebar-tag').forEach(function(tag) {
    const text = tag.textContent.toLowerCase();
    tag.style.display = text.includes(query) ? '' : 'none';
  });
  // Posts list
  document.querySelectorAll('#tags-posts-list .tag-group').forEach(function(group) {
    const tagText = group.getAttribute('data-tag');
    group.style.display = tagText && tagText.includes(query) ? '' : 'none';
  });
});
</script>
