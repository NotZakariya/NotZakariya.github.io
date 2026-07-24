require "cgi"

module SiteImageMarkup
  module_function

  def attribute(tag, name)
    match = tag.match(/\b#{Regexp.escape(name)}\s*=\s*(["'])(.*?)\1/i)
    match && match[2]
  end

  def add_attribute(tag, name, value)
    return tag if tag.match?(/\b#{Regexp.escape(name)}\s*=/i)

    tag.sub(/\s*(\/?)>\z/, %( #{name}="#{value}"\\1>))
  end

  def local_image_path(source_root, page_url, src)
    return if src.nil? || src.empty?
    return if src.match?(%r{\A(?:[a-z]+:)?//}i) || src.start_with?("data:")

    clean_src = CGI.unescape(src.split(/[?#]/, 2).first.to_s)
    return if clean_src.empty?

    source_root = File.expand_path(source_root)
    candidates =
      if clean_src.start_with?("/")
        [File.expand_path(clean_src.sub(%r{\A/+}, ""), source_root)]
      else
        page_directory = File.dirname(page_url.to_s.sub(%r{\A/+}, ""))
        [
          File.expand_path(File.join(page_directory, clean_src), source_root),
          File.expand_path(clean_src, source_root)
        ]
      end

    candidates.find do |candidate|
      candidate.start_with?("#{source_root}#{File::SEPARATOR}") && File.file?(candidate)
    end
  end

  def dimensions(path)
    extension = File.extname(path).downcase

    case extension
    when ".png"
      data = File.binread(path, 24)
      return unless data.start_with?("\x89PNG\r\n\x1a\n".b)
      data.byteslice(16, 8).unpack("NN")
    when ".gif"
      data = File.binread(path, 10)
      return unless data.start_with?("GIF87a", "GIF89a")
      data.byteslice(6, 4).unpack("vv")
    when ".jpg", ".jpeg"
      jpeg_dimensions(path)
    when ".webp"
      webp_dimensions(path)
    when ".svg"
      svg_dimensions(path)
    end
  rescue EOFError, IOError, SystemCallError
    nil
  end

  def jpeg_dimensions(path)
    File.open(path, "rb") do |file|
      return unless file.read(2) == "\xFF\xD8".b

      until file.eof?
        byte = file.read(1)
        next unless byte == "\xFF".b

        marker = file.read(1)
        marker = file.read(1) while marker == "\xFF".b
        next if marker.nil? || marker == "\xD8".b || marker == "\xD9".b

        length_data = file.read(2)
        return unless length_data&.bytesize == 2
        segment_length = length_data.unpack1("n")
        return if segment_length < 2

        marker_number = marker.unpack1("C")
        if (0xC0..0xC3).include?(marker_number) ||
           (0xC5..0xC7).include?(marker_number) ||
           (0xC9..0xCB).include?(marker_number) ||
           (0xCD..0xCF).include?(marker_number)
          size_data = file.read(5)
          return unless size_data&.bytesize == 5
          height, width = size_data.byteslice(1, 4).unpack("nn")
          return [width, height]
        end

        file.seek(segment_length - 2, IO::SEEK_CUR)
      end
    end
    nil
  end

  def webp_dimensions(path)
    data = File.binread(path, 30)
    return unless data.byteslice(0, 4) == "RIFF" && data.byteslice(8, 4) == "WEBP"

    case data.byteslice(12, 4)
    when "VP8X"
      width = 1 + data.getbyte(24) + (data.getbyte(25) << 8) + (data.getbyte(26) << 16)
      height = 1 + data.getbyte(27) + (data.getbyte(28) << 8) + (data.getbyte(29) << 16)
      [width, height]
    when "VP8 "
      return unless data.byteslice(23, 3) == "\x9D\x01\x2A".b
      width, height = data.byteslice(26, 4).unpack("vv")
      [width & 0x3FFF, height & 0x3FFF]
    when "VP8L"
      return unless data.getbyte(20) == 0x2F
      b1, b2, b3, b4 = data.byteslice(21, 4).bytes
      width = 1 + (((b2 & 0x3F) << 8) | b1)
      height = 1 + (((b4 & 0x0F) << 10) | (b3 << 2) | ((b2 & 0xC0) >> 6))
      [width, height]
    end
  end

  def svg_dimensions(path)
    source = File.read(path, 16_384)
    svg = source[/<svg\b[^>]*>/i]
    return unless svg

    width = svg[/\bwidth\s*=\s*["']([\d.]+)/i, 1]
    height = svg[/\bheight\s*=\s*["']([\d.]+)/i, 1]
    return [width.to_f.round, height.to_f.round] if width && height

    view_box = svg[/\bviewBox\s*=\s*["'][^"']*?([\d.]+)\s+([\d.]+)\s*["']/i, 1..2]
    view_box && view_box.map { |value| value.to_f.round }
  end

  def process_html(html, source_root, page_url)
    content_image_index = 0

    html.gsub(/<img\b([^>]*)>/i) do |tag|
      updated = tag.dup
      classes = attribute(updated, "class").to_s.split
      is_logo = classes.include?("logo")

      content_image_index += 1 unless is_logo
      updated = add_attribute(updated, "decoding", "async")

      if is_logo || content_image_index == 1
        updated = add_attribute(updated, "loading", "eager")
        updated = add_attribute(updated, "fetchpriority", "high")
      else
        updated = add_attribute(updated, "loading", "lazy")
      end

      src = attribute(updated, "src")
      image_path = local_image_path(source_root, page_url, src)
      size = image_path && dimensions(image_path)

      if size
        updated = add_attribute(updated, "width", size[0])
        updated = add_attribute(updated, "height", size[1])
      end

      updated
    end
  end
end

if defined?(Jekyll)
  Jekyll::Hooks.register [:pages, :documents], :post_render do |item|
    next unless item.output_ext == ".html"

    item.output = SiteImageMarkup.process_html(
      item.output,
      item.site.source,
      item.url
    )
  end
end

if $PROGRAM_NAME == __FILE__
  destination = File.expand_path(ARGV.fetch(0))
  source = File.expand_path(ARGV.fetch(1, "."))

  Dir.glob(File.join(destination, "**", "*.html")).each do |html_path|
    relative = html_path.delete_prefix("#{destination}/")
    page_url =
      if File.basename(relative) == "index.html"
        "/#{File.dirname(relative).sub(%r{\A\.$}, "")}/"
      else
        "/#{relative}"
      end

    original = File.read(html_path)
    updated = SiteImageMarkup.process_html(original, source, page_url)
    File.write(html_path, updated) if updated != original
  end
end
