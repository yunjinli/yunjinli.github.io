# frozen_string_literal: true

require "cgi"
require "nokogiri"
require "open-uri"
require "time"

module Jekyll
  module ScholarProfile
    DAY = 86_400
    RETRY_DELAY = 3_600

    def self.normalize(title)
      title.to_s.unicode_normalize(:nfkc).downcase.gsub(/[^\p{L}\p{N}]/, "")
    end

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

        articles[normalize(title.text)] = {
          "article_id" => article_id,
          "citations" => value.empty? ? 0 : value.to_i,
          "checked_at" => checked_at,
        }
      end
      raise "Scholar profile contained no readable publications" if articles.empty?

      { "articles" => articles, "checked_at" => checked_at }
    end

    def self.fetch(profile_id)
      url = "https://scholar.google.com/citations?user=#{CGI.escape(profile_id)}&hl=en&pagesize=100"
      html = URI.open(url, "User-Agent" => "AcademicPortfolio/1.0", :open_timeout => 5, :read_timeout => 5) { |response| response.read }
      parse(html, profile_id, Time.now.utc.iso8601)
    end

    def self.load(cache, profile_id, now: Time.now.to_i, fetcher: method(:fetch))
      profile_key = "profile-#{profile_id}"
      attempt_key = "attempt-#{profile_id}"
      previous = cache.key?(profile_key) ? cache[profile_key] : nil
      return previous if previous && now - timestamp(previous["checked_at"]) < DAY
      return previous if cache.key?(attempt_key) && now - cache[attempt_key] < RETRY_DELAY

      cache[attempt_key] = now
      begin
        profile = fetcher.call(profile_id)
        cache[profile_key] = profile
        profile
      rescue StandardError => error
        Jekyll.logger.warn "Google Scholar:", "#{error.class}: #{error.message}; keeping verified citation values."
        previous
      end
    end

    def self.merge!(publications, profile)
      return unless profile

      publications.each_value do |entry|
        match = Array(entry["titles"]).filter_map { |title| profile["articles"][normalize(title)] }.first
        next unless match
        next if timestamp(entry["checked_at"]) > timestamp(match["checked_at"])

        entry.merge!(match)
      end
    end
  end

  class ScholarProfileGenerator < Generator
    safe true
    priority :low

    def generate(site)
      return unless site.config.dig("enable_publication_badges", "google_scholar")

      data = site.data["scholar_citations"]
      profile_id = site.config["scholar_userid"].to_s
      return unless data && data["profile_id"] == profile_id && !profile_id.empty?

      profile = ScholarProfile.load(Jekyll::Cache.new("ScholarProfile"), profile_id)
      ScholarProfile.merge!(data.fetch("publications", {}), profile)
    end
  end
end
