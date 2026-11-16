use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CharacterStats {
    pub strength: i32,
    pub speed: i32,
    pub abilities: i32,
    pub iq: i32,
    pub durability: i32,
}

impl CharacterStats {
    pub fn total(&self) -> i32 {
        self.strength + self.speed + self.abilities + self.iq + self.durability
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WikiScrapeSlice {
    #[serde(default, rename = "tabPath")]
    pub tab_path: Vec<String>,
    #[serde(rename = "columnIndex", default)]
    pub column_index: i32,
    #[serde(default, rename = "columnLabel")]
    pub column_label: Option<String>,
    pub stats: CharacterStats,
    #[serde(default, rename = "hasPowersSection")]
    pub has_powers_section: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WikiCharacterScrape {
    pub id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub series: String,
    #[serde(default, rename = "wikiTitle")]
    pub wiki_title: Option<String>,
    #[serde(default, rename = "scrapedAt")]
    pub scraped_at: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default, rename = "htmlCacheFile")]
    pub html_cache_file: Option<String>,
    #[serde(default, rename = "tabCount")]
    pub tab_count: i32,
    #[serde(default)]
    pub slices: Vec<WikiScrapeSlice>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GameCharacter {
    pub id: String,
  #[serde(rename = "displayName")]
    pub display_name: String,
    pub series: String,
    #[serde(default)]
    pub stats: CharacterStats,
}

pub fn tab_path_key(path: &[String]) -> String {
    if path.is_empty() {
        "(full page)".to_string()
    } else {
        path.join(" › ")
    }
}
