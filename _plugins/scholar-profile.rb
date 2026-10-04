# frozen_string_literal: true

require "cgi"
require "json"
require "net/http"
require "nokogiri"
require "open-uri"
require "time"

module Jekyll
  module ScholarProfile
    DAY = 86_400
    RETRY_DELAY = 3_600

    def self.timestamp(value)
      Time.iso8601(value.to_s).to_i
    rescue ArgumentError
      0
    end

    def self.parse(html, profile_id, checked_at)
      document = Nokogiri::HTML(html)
      # A consent, error, or rate-limit page must never turn into zero citations.
      raise "Response is not a Scholar profile" unless document.at_css("#gsc_prf_in")

      articles = {}
      document.css(".gsc_a_tr").each do |row|
        title = row.at_css(".gsc_a_at")
        count = row.at_css(".gsc_a_ac")
        next unless title && count

        query = URI.parse(title["href"].to_s).query.to_s
        citation_id = CGI.parse(query).fetch("citation_for_view", []).first.to_s
        author, article_id = citation_id.split(":", 2)
        next unless author == profile_id && article_id && article_id.match?(/\A[\w-]+\z/)

        value = count.text.strip.delete(",\u00a0 ")
        # Scholar uses a blank count cell for uncited papers on a valid profile.
        next unless value.empty? || value.match?(/\A\d+\z/)

        articles[article_id] = {
          "article_id" => article_id,
          "citations" => value.empty? ? 0 : value.to_i,
          "checked_at" => checked_at,
        }
      end
      raise "Scholar profile contained no readable publications" if articles.empty?

      { "articles" => articles, "checked_at" => checked_at }
    end

    def self.fetch(profile_id, transport: Net::HTTP)
      api_key = ENV["SEARCHAPI_API_KEY"].to_s.strip
      return fetch_searchapi(profile_id, api_key, transport: transport) unless api_key.empty?

      url = "https://scholar.google.com/citations?user=#{CGI.escape(profile_id)}&hl=en&pagesize=100"
      html = URI.open(url, "User-Agent" => "AcademicPortfolio/1.0", :open_timeout => 5, :read_timeout => 5) { |response| response.read }
      parse(html, profile_id, Time.now.utc.iso8601)
    end

    def self.parse_searchapi(data, profile_id, checked_at)
      unless data.is_a?(Hash) && data.dig("search_metadata", "status") == "Success" && data["articles"].is_a?(Array)
        raise "SearchApi did not return a successful author profile"
      end

      articles = {}
      data["articles"].each do |article|
        next unless article.is_a?(Hash)

        author, article_id = article["citation_id"].to_s.split(":", 2)
        next unless author == profile_id && article_id && article_id.match?(/\A[\w-]+\z/)

        count = article["cited_by"].is_a?(Hash) ? article["cited_by"]["total"] : nil
        next unless count.is_a?(Integer) && count >= 0

        articles[article_id] = { "article_id" => article_id, "citations" => count, "checked_at" => checked_at }
      end
      raise "SearchApi profile contained no readable citation counts" if articles.empty?

      { "articles" => articles, "checked_at" => checked_at }
    end

    def self.fetch_searchapi(profile_id, api_key, transport: Net::HTTP)
      url = URI("https://www.searchapi.io/api/v1/search")
      url.query = URI.encode_www_form(engine: "google_scholar_author", author_id: profile_id, hl: "en")
      request = Net::HTTP::Get.new(url)
      request["Authorization"] = "Bearer #{api_key}"
      request["Accept"] = "application/json"
      response = transport.start(url.host, url.port, use_ssl: true, open_timeout: 5, read_timeout: 30) do |http|
        http.request(request)
      end
      # Keep credentials out of URLs, logs, cached data, and generated pages.
      raise "SearchApi returned HTTP #{response.code}" unless response.code == "200"

      data = JSON.parse(response.body)
      profile = parse_searchapi(data, profile_id, Time.now.utc.iso8601)
      Jekyll.logger.info "Google Scholar:", "Updated #{profile['articles'].length} publication counts using SearchApi."
      profile
    rescue JSON::ParserError
      raise "SearchApi returned invalid JSON"
    end

    def self.load(cache, profile_id, now: Time.now.to_i, fetcher: method(:fetch))
      profile_key = "profile-#{profile_id}"
      source = ENV["SEARCHAPI_API_KEY"].to_s.strip.empty? ? "direct" : "searchapi"
      attempt_key = "attempt-#{source}-#{profile_id}"
      previous = cache.key?(profile_key) ? cache[profile_key] : nil
      return previous if previous && now - timestamp(previous["checked_at"]) < DAY
      return previous if cache.key?(attempt_key) && now - cache[attempt_key] < RETRY_DELAY

      cache[attempt_key] = now
      begin
        profile = fetcher.call(profile_id)
        cache[profile_key] = profile
        profile
      rescue StandardError => error
        message = error.message
        api_key = ENV["SEARCHAPI_API_KEY"].to_s.strip
        message = message.gsub(api_key, "[REDACTED]") unless api_key.empty?
        Jekyll.logger.warn "Google Scholar:", "#{error.class}: #{message}; retaining cached counts where available."
        previous
      end
    end

    # BibTeX owns the reference; the cache owns only fetched citation data.
    def self.reference(entry, default_profile_id)
      link = entry["google_scholar"].to_s.strip
      if link.empty?
        profile_id = default_profile_id.to_s
        article_id = entry["google_scholar_id"].to_s
      else
        uri = URI.parse(CGI.unescapeHTML(link))
        return unless ["http", "https"].include?(uri.scheme) && uri.host == "scholar.google.com" && uri.path == "/citations"

        query = CGI.parse(uri.query.to_s)
        profile_id, article_id = query.fetch("citation_for_view", []).first.to_s.split(":", 2)
        user = query.fetch("user", []).first
        return if user && user != profile_id
      end
      return unless profile_id.to_s.match?(/\A[\w-]+\z/) && article_id.to_s.match?(/\A[\w-]+\z/)

      {
        "profile_id" => profile_id,
        "article_id" => article_id,
        "url" => "https://scholar.google.com/citations?view_op=view_citation&hl=en&user=#{profile_id}&citation_for_view=#{profile_id}:#{article_id}",
      }
    rescue URI::InvalidURIError, ArgumentError
      nil
    end

    def self.citation(entry, default_profile_id:, cache:, fetcher: method(:fetch))
      result = reference(entry, default_profile_id)
      return { "url" => "https://scholar.google.com/scholar?q=#{CGI.escape(entry['title'].to_s)}" } unless result

      profile = load(cache, result["profile_id"], fetcher: fetcher)
      # Values also support snapshots cached before indexing switched from titles to IDs.
      match = profile && profile.fetch("articles", {}).values.find { |article| article["article_id"] == result["article_id"] }
      if match && match["citations"].is_a?(Integer) && match["citations"] >= 0
        result.merge!("citations" => match["citations"], "checked_at" => match["checked_at"])
      end
      result
    end
  end

  module ScholarCitationFilter
    def scholar_citation(entry)
      site = @context.registers[:site]
      ScholarProfile.citation(entry, default_profile_id: site.config["scholar_userid"], cache: Jekyll::Cache.new("ScholarProfile"))
    end
  end
end

Liquid::Template.register_filter(Jekyll::ScholarCitationFilter)
