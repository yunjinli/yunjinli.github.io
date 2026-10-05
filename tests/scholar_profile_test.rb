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

  def scholar_url(article_id = "paper-id", profile_id = PROFILE)
    "https://scholar.google.com/citations?view_op=view_citation&user=#{profile_id}&citation_for_view=#{profile_id}:#{article_id}"
  end

  def test_scheduled_refresh_bypasses_twenty_hour_cache_once_per_workflow_attempt
    previous = parsed(count: "17")
    previous["checked_at"] = Time.at(NOW - 20 * 3600).utc.iso8601
    cache = { "profile-#{PROFILE}" => previous }
    attempts = 0
    fetcher = lambda do |_|
      attempts += 1
      parsed(count: (17 + attempts).to_s)
    end
    # Reproduce a content deployment followed by the next morning's schedule.
    assert_equal previous, Jekyll::ScholarProfile.load(cache, PROFILE, now: NOW, refresh_id: "", fetcher: fetcher)
    3.times do
      profile = Jekyll::ScholarProfile.load(cache, PROFILE, now: NOW, refresh_id: "scheduled-run-1", fetcher: fetcher)
      assert_equal 18, profile["articles"]["paper-id"]["citations"]
    end
    assert_equal 1, attempts
    # A manual run or rerun must fetch again, even inside the retry window.
    profile = Jekyll::ScholarProfile.load(cache, PROFILE, now: NOW + 5, refresh_id: "manual-run-1", fetcher: fetcher)
    assert_equal 19, profile["articles"]["paper-id"]["citations"]
    assert_equal 2, attempts
  end

  def test_failed_forced_refresh_preserves_snapshot_and_does_not_retry_for_every_card
    [parsed, nil].each do |previous|
      cache = previous ? { "profile-#{PROFILE}" => previous } : {}
      attempts = 0
      fetcher = lambda do |_|
        attempts += 1
        raise IOError, "offline"
      end
      3.times do
        result = Jekyll::ScholarProfile.load(cache, PROFILE, now: NOW, refresh_id: "scheduled-run-1", fetcher: fetcher)
        assert_same previous, result
      end
      assert_equal 1, attempts
      assert_same previous, cache["profile-#{PROFILE}"]
      result = Jekyll::ScholarProfile.load(cache, PROFILE, now: NOW + 5, refresh_id: "manual-run-1", fetcher: fetcher)
      assert_same previous, result
      assert_equal 2, attempts
    end
  end

  def test_bibtex_link_identifies_paper_after_title_changes_and_overrides_default_profile
    entry = { "title" => "Completely renamed", "google_scholar" => scholar_url }
    citation = Jekyll::ScholarProfile.citation(entry, default_profile_id: "another-profile", cache: {}, fetcher: lambda do |profile_id|
      assert_equal PROFILE, profile_id
      parsed
    end)
    assert_equal 1234, citation["citations"]
    assert_equal "paper-id", citation["article_id"]
    assert_equal CHECKED_AT, citation["checked_at"]
    assert_includes citation["url"], "citation_for_view=#{PROFILE}:paper-id"
  end

  def test_same_title_papers_keep_separate_counts_and_share_one_profile_request
    data = api_profile
    data["articles"] << { "title" => "A research paper", "citation_id" => "#{PROFILE}:second-id", "cited_by" => { "total" => 0 } }
    fresh = Jekyll::ScholarProfile.parse_searchapi(data, PROFILE, Time.now.utc.iso8601)
    cache = {}
    attempts = 0
    fetcher = lambda do |_|
      attempts += 1
      fresh
    end
    counts = ["paper-id", "second-id"].map do |id|
      Jekyll::ScholarProfile.citation({ "title" => "A research paper", "google_scholar" => scholar_url(id) },
        default_profile_id: nil, cache: cache, fetcher: fetcher)["citations"]
    end
    assert_equal [1234, 0], counts
    assert_equal 1, attempts
  end

  def test_existing_id_field_and_html_escaped_links_remain_supported
    legacy = Jekyll::ScholarProfile.reference({ "google_scholar_id" => "paper-id" }, PROFILE)
    full = Jekyll::ScholarProfile.reference({ "google_scholar" => scholar_url.gsub("&", "&amp;") }, nil)
    assert_equal legacy, full
  end

  def test_missing_or_invalid_references_use_title_search_without_fetching
    invalid_links = [nil, "https://scholar.google.com/citations?user=#{PROFILE}",
      scholar_url.sub("scholar.google.com", "example.com"), scholar_url.sub("user=#{PROFILE}", "user=other"),
      "javascript:alert(1)", "not a URL"]
    invalid_links.each do |link|
      citation = Jekyll::ScholarProfile.citation({ "title" => "Title & subtitle", "google_scholar" => link },
        default_profile_id: PROFILE, cache: {}, fetcher: ->(_) { flunk "Unexpected request" })
      assert_equal({ "url" => "https://scholar.google.com/scholar?q=Title+%26+subtitle" }, citation)
    end
  end

  def test_missing_count_keeps_article_link_without_inventing_zero
    citation = Jekyll::ScholarProfile.citation({ "google_scholar" => scholar_url("missing-id") },
      default_profile_id: nil, cache: {}, fetcher: ->(_) { parsed })
    refute citation.key?("citations")
    assert_includes citation["url"], "citation_for_view=#{PROFILE}:missing-id"
  end

  def test_failed_refresh_can_read_previous_title_indexed_cache
    old = parsed
    old["checked_at"] = "2020-01-01T00:00:00Z"
    old["articles"] = { "a research paper" => old["articles"].values.first }
    citation = Jekyll::ScholarProfile.citation({ "google_scholar" => scholar_url },
      default_profile_id: nil, cache: { "profile-#{PROFILE}" => old }, fetcher: ->(_) { raise IOError, "offline" })
    assert_equal 1234, citation["citations"]
    assert_equal CHECKED_AT, citation["checked_at"]
  end

  def test_failed_request_without_cache_keeps_article_link
    citation = Jekyll::ScholarProfile.citation({ "google_scholar" => scholar_url },
      default_profile_id: nil, cache: {}, fetcher: ->(_) { raise IOError, "offline" })
    refute citation.key?("citations")
    assert_includes citation["url"], "citation_for_view=#{PROFILE}:paper-id"
  end
end
