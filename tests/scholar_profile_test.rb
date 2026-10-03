# frozen_string_literal: true

require "minitest/autorun"
require "jekyll"
require "timeout"
require_relative "../_plugins/scholar-profile"

class ScholarProfileTest < Minitest::Test
  PROFILE = "test-author"
  CHECKED_AT = "2026-10-03T12:00:00Z"
  NOW = Time.iso8601(CHECKED_AT).to_i

  def profile_html(count: "1,234", author: PROFILE, title: "A research paper")
    <<~HTML
      <div id="gsc_prf_in">Researcher</div>
      <table><tr class="gsc_a_tr">
        <td><a class="gsc_a_at" href="/citations?citation_for_view=#{author}:paper-id">#{title}</a></td>
        <td><a class="gsc_a_ac">#{count}</a></td>
      </tr></table>
    HTML
  end

  def parsed(**args)
    Jekyll::ScholarProfile.parse(profile_html(**args), PROFILE, CHECKED_AT)
  end

  def test_parses_exact_counts_and_true_zero
    entry = parsed["articles"].values.first
    assert_equal 1234, entry["citations"]
    assert_equal "paper-id", entry["article_id"]
    assert_equal CHECKED_AT, entry["checked_at"]
    assert_equal 0, parsed(count: "")["articles"].values.first["citations"]
  end

  def test_block_pages_unknown_counts_and_other_authors_are_not_zero
    assert_raises(RuntimeError) { Jekyll::ScholarProfile.parse("<html>Too many requests</html>", PROFILE, CHECKED_AT) }
    assert_raises(RuntimeError) { parsed(count: "Unavailable") }
    assert_raises(RuntimeError) { parsed(author: "another-author") }
  end

  def test_network_failure_preserves_last_success_and_throttles_retries
    old = parsed
    old["checked_at"] = "2026-10-01T12:00:00Z"
    cache = { "profile-#{PROFILE}" => old }
    attempts = 0
    failing_fetch = lambda do |_|
      attempts += 1
      raise Timeout::Error, "request timed out"
    end
    result = Jekyll::ScholarProfile.load(cache, PROFILE, now: NOW, fetcher: failing_fetch)
    assert_equal old, result
    assert_equal old, cache["profile-#{PROFILE}"]
    Jekyll::ScholarProfile.load(cache, PROFILE, now: NOW + 5, fetcher: failing_fetch)
    assert_equal 1, attempts
  end

  def test_fresh_cache_avoids_request_and_empty_cache_does_not_invent_counts
    cache = { "profile-#{PROFILE}" => parsed }
    assert_equal parsed, Jekyll::ScholarProfile.load(cache, PROFILE, now: NOW, fetcher: ->(_) { flunk "Unexpected request" })
    assert_nil Jekyll::ScholarProfile.load({}, PROFILE, now: NOW, fetcher: ->(_) { raise IOError, "offline" })
  end

  def test_successful_refresh_replaces_stale_cache
    old = { "articles" => {}, "checked_at" => "2026-10-01T12:00:00Z" }
    cache = { "profile-#{PROFILE}" => old }
    fresh = parsed
    assert_equal fresh, Jekyll::ScholarProfile.load(cache, PROFILE, now: NOW, fetcher: ->(_) { fresh })
    assert_equal fresh, cache["profile-#{PROFILE}"]
  end

  def test_title_alias_matching_and_newer_verified_values
    publications = {
      "renamed" => { "titles" => ["New title", "A Research-Paper"], "citations" => nil },
      "missing" => { "titles" => ["Unrelated paper"], "citations" => 17 },
      "newer" => { "titles" => ["A research paper"], "citations" => 1500, "checked_at" => "2026-10-04T12:00:00Z" },
    }
    Jekyll::ScholarProfile.merge!(publications, parsed)
    assert_equal 1234, publications["renamed"]["citations"]
    assert_equal "paper-id", publications["renamed"]["article_id"]
    assert_equal 17, publications["missing"]["citations"]
    assert_equal 1500, publications["newer"]["citations"]
  end
end
