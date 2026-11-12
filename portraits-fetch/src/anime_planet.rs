use anyhow::Result;
use regex::Regex;
use reqwest::Client;
use url::Url;

const UA: &str = "BuildCharacterPortraitBot/1.0";
const ORIGIN: &str = "https://www.anime-planet.com";

pub fn first_name(display_name: &str) -> String {
    display_name
        .trim()
        .split_whitespace()
        .next()
        .unwrap_or(display_name)
        .to_string()
}

pub fn simplify_name(display_name: &str) -> String {
    let re = Regex::new(r"\s*\([^)]*\)\s*").unwrap();
    re.replace_all(display_name, " ").trim().to_string()
}

fn normalize_name(s: &str) -> String {
    Regex::new(r"[^a-z0-9]+")
        .unwrap()
        .replace_all(&s.to_lowercase(), " ")
        .trim()
        .to_string()
}

fn extract_portrait_url(html: &str) -> Option<String> {
    let primary = Regex::new(r#"https://cdn\.anime-planet\.com/characters/primary/[^"'\s]+"#).unwrap();
    if let Some(m) = primary.find(html) {
        return Some(m.as_str().to_string());
    }
    let thumb = Regex::new(r#"https://www\.anime-planet\.com/images/characters/[^"'\s]+\.jpg[^"'\s]*"#).unwrap();
    thumb.find(html).map(|m| m.as_str().to_string())
}

fn pick_character_path(html: &str, display_name: &str) -> Option<String> {
    let want = normalize_name(display_name);
    let want_first = normalize_name(&first_name(display_name));
    let re = Regex::new(r#"(?is)href="(/characters/[a-z0-9-]+)"[^>]*>[\s\S]*?<h5[^>]*>([^<]+)<"#).unwrap();

    let mut best: Option<(String, i32)> = None;
    for cap in re.captures_iter(html) {
        let path = cap.get(1)?.as_str().to_string();
        let title = normalize_name(cap.get(2)?.as_str());
        let score = if title == want {
            100
        } else if title.contains(&want) || want.contains(&title) {
            80
        } else if title.starts_with(&want_first) {
            60
        } else if title.contains(&want_first) {
            40
        } else {
            0
        };
        if score > 0 {
            if best.as_ref().map(|(_, s)| score > *s).unwrap_or(true) {
                best = Some((path, score));
            }
        }
    }
    if let Some((path, score)) = best {
        if score >= 40 {
            return Some(path);
        }
    }
    let fallback = Regex::new(r#"href="(/characters/[a-z0-9-]+)""#).unwrap();
    fallback
        .captures(html)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

async fn fetch_html(client: &Client, url: &str) -> Result<Option<(String, String)>> {
    let res = client
        .get(url)
        .header("User-Agent", UA)
        .header("Accept", "text/html")
        .send()
        .await?;
    if !res.status().is_success() {
        return Ok(None);
    }
    let final_url = res.url().to_string();
    let html = res.text().await?;
    Ok(Some((final_url, html)))
}

fn on_character_page(final_url: &str) -> bool {
    let Ok(parsed) = Url::parse(final_url) else {
        return false;
    };
    let path = parsed.path();
    path.starts_with("/characters/")
        && !path.contains("/characters/all")
        && Regex::new(r"^/characters/[a-z0-9-]+/?$")
            .unwrap()
            .is_match(path)
}

pub async fn portrait_url(client: &Client, display_name: &str) -> Result<Option<String>> {
    let queries = [
        first_name(display_name),
        simplify_name(display_name),
        display_name.trim().to_string(),
    ];

    for query in queries {
        if query.is_empty() {
            continue;
        }
        let search_url = format!(
            "{ORIGIN}/characters/all?name={}",
            urlencoding_encode(&query)
        );
        let Some((final_url, mut html)) = fetch_html(client, &search_url).await? else {
            continue;
        };

        if !on_character_page(&final_url) {
            let Some(path) = pick_character_path(&html, display_name) else {
                continue;
            };
            let page_url = format!("{ORIGIN}{path}");
            let Some((_, page_html)) = fetch_html(client, &page_url).await? else {
                continue;
            };
            html = page_html;
        }

        if let Some(url) = extract_portrait_url(&html) {
            return Ok(Some(url));
        }
    }
    Ok(None)
}

fn urlencoding_encode(s: &str) -> String {
    url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
}

pub fn ext_from_url(url: &str) -> &'static str {
    let path = Url::parse(url)
        .ok()
        .map(|u| u.path().to_lowercase())
        .unwrap_or_default();
    if path.ends_with(".png") {
        ".png"
    } else if path.ends_with(".webp") {
        ".webp"
    } else if path.ends_with(".gif") {
        ".gif"
    } else {
        ".jpg"
    }
}
