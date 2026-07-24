Jekyll::Hooks.register [:pages, :documents], :post_render do |item|
  next unless item.output_ext == ".html"

  image_index = 0

  item.output = item.output.gsub(/<img\b([^>]*)>/i) do |tag|
    image_index += 1

    updated = tag.dup

    unless updated.match?(/\bdecoding=/i)
      updated.sub!(">", ' decoding="async">')
    end

    unless updated.match?(/\bloading=/i)
      loading = image_index == 1 ? "eager" : "lazy"
      updated.sub!(">", %( loading="#{loading}">))
    end

    unless updated.match?(/\bfetchpriority=/i)
      priority = image_index == 1 ? "high" : "low"
      updated.sub!(">", %( fetchpriority="#{priority}">))
    end

    updated
  end
end