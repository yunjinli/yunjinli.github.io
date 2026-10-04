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

  def api_profile(count: 1234, author: PROFILE)
    {
      "search_metadata" => { "status" => "Success" },
      "articles" => [{ "title" => "A research paper", "citation_id" => "#{author}:paper-id", "cited_by" => { "total" => count } }],
    }
  end

  def with_api_key
    original = ENV["SEARCHAPI_API_KEY"]
    ENV["SEARCHAPI_API_KEY"] = "test-private-api-key"
    yield ENV["SEARCHAPI_API_KEY"]
  ensure
    original.nil? ? ENV.delete("SEARCHAPI_API_KEY") : ENV["SEARCHAPI_API_KEY"] = original
  end

  def test_searchapi_parses_totals_and_zero_without_caching_response_metadata
    data = api_profile
    data["search_parameters"] = { "api_key" => "must-not-be-cached" }
    assert_equal parsed, Jekyll::ScholarProfile.parse_searchapi(data, PROFILE, CHECKED_AT)
    entry = Jekyll::ScholarProfile.parse_searchapi(api_profile(count: 0), PROFILE, CHECKED_AT)["articles"].values.first
    assert_equal 0, entry["citations"]
  end

  def test_searchapi_rejects_errors_unknown_counts_and_wrong_profiles
    [nil, "3", -1].each do |count|
      assert_raises(RuntimeError) { Jekyll::ScholarProfile.parse_searchapi(api_profile(count: count), PROFILE, CHECKED_AT) }
    end
    assert_raises(RuntimeError) { Jekyll::ScholarProfile.parse_searchapi(api_profile(author: "other"), PROFILE, CHECKED_AT) }
    assert_raises(RuntimeError) { Jekyll::ScholarProfile.parse_searchapi({ "error" => "Quota exhausted" }, PROFILE, CHECKED_AT) }
  end

  def test_searchapi_uses_authorization_header_and_never_puts_key_in_url
    with_api_key do |key|
      response = Struct.new(:code, :body).new("200", JSON.generate(api_profile))
      http = Object.new
      http.define_singleton_method(:request) do |request|
        raise "Missing authorization" unless request["Authorization"] == "Bearer #{key}"
        raise "Key in URL" if request.path.include?(key) || request.path.include?("api_key")
        raise "Wrong profile" unless request.path.include?("author_id=#{PROFILE}")
        response
      end
      transport = Object.new
      connection = nil
      transport.define_singleton_method(:start, lambda do |*args, **options, &block|
        connection = [args, options]
        block.call(http)
      end)
      result = Jekyll::ScholarProfile.fetch(PROFILE, transport: transport)
      assert_equal ["www.searchapi.io", 443], connection[0]
      assert connection[1][:use_ssl]
      assert_equal 1234, result["articles"].values.first["citations"]
      refute_includes JSON.generate(result), key
    end
  end

  def test_api_failures_preserve_counts_and_redact_credentials
    with_api_key do |key|
      old = { "articles" => {}, "checked_at" => "2026-10-01T12:00:00Z" }
      result = nil
      out, err = capture_io do
        result = Jekyll::ScholarProfile.load({ "profile-#{PROFILE}" => old }, PROFILE, now: NOW,
          fetcher: ->(_) { raise "Upstream failure for #{key}" })
      end
      assert_equal old, result
      refute_includes out + err, key
      assert_includes out + err, "[REDACTED]"
    end
  end

  def test_adding_api_key_retries_after_a_failed_direct_request
    cache = { "attempt-direct-#{PROFILE}" => NOW }
    with_api_key do
      assert_equal parsed, Jekyll::ScholarProfile.load(cache, PROFILE, now: NOW, fetcher: ->(_) { parsed })
    end
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
