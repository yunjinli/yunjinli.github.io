# frozen_string_literal: true

require "minitest/autorun"
require "tmpdir"
require "fileutils"
require "jekyll"
require_relative "../_plugins/cache-bust"

class CacheBustTest < Minitest::Test
  def test_stylesheet_url_tracks_sass_partials_and_entrypoint
    Dir.mktmpdir do |source|
      FileUtils.mkdir_p(File.join(source, "_sass"))
      FileUtils.mkdir_p(File.join(source, "assets/css"))
      partial = File.join(source, "_sass/_portfolio.scss")
      entrypoint = File.join(source, "assets/css/main.scss")
      File.write(partial, ".card { opacity: 1; }")
      File.write(entrypoint, '@import "portfolio";')
      site = Struct.new(:source).new(source)
      template = Liquid::Template.parse("{{ '/assets/css/main.css' | bust_css_cache }}")
      render = -> { template.render!({}, registers: { site: site }) }

      original = render.call
      assert_match %r{\A/assets/css/main\.css\?[0-9a-f]{32}\z}, original
      assert_equal original, render.call

      File.write(partial, ".card { opacity: 0; }")
      changed_partial = render.call
      refute_equal original, changed_partial

      File.write(entrypoint, '@import "portfolio"; body { margin: 0; }')
      refute_equal changed_partial, render.call
    end
  end
end
