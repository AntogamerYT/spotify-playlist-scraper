# spotify-playlist-scraper

spotify-playlist-scraper is the first playlist data scraper that uses official APIs to scrape playlist (not for music tho, we use [yt-dlp](https://github.com/yt-dlp/yt-dlp/)) data and put them in a easily-readable [JSON file](https://github.com/AntogamerYT/spotify-playlist-scraper/blob/main/tracks.example.json)!

## Notices
This package is currently not usable in your code.

While I might consider it in the future, for now you can only use it via `npx` or by installing it globally using `npm install -g spotify-playlist-scraper`

⚠️Videos with the age verification requirement are currently not downloadable and it won't get fixed⚠️


## Requirements
- NodeJS 18+
- Client ID and Secret from a [Spotify developers](https://developer.spotify.com/dashboard) application

## Installation

No need to manually install, you can run the `npx spotify-playlist-scraper` command with the CLI Arguments that you can find below and let the magic happen!

## CLI Arguments

| Argument | Value                     | Required                           |
|----------|---------------------------|------------------------------------|
| cid      | The Spotify API client ID | true                               |
| secret   | Spotify API client secret | true                               |
| playlist | The playlist ID, you can obtain it from a link (For example, in https://open.spotify.com/playlist/1YIe34rcmLjCYpY9wJoM2p, **1YIe34rcmLjCYpY9wJoM2p** is the ID) | true                                |
| log      | Can be DEBUG or info, default is info| false                  |
----------------