import { config as dotenvConfig } from "dotenv";
import { execSync } from "child_process";
import fs from 'fs'
dotenvConfig({
    path: process.cwd() + "/.env"
})
let tracksJson: Track[] = [];
const SpotifyCID = process.env.SpotifyCID;
const SpotifySecret = process.env.SpotifySecret;

const tokenReq = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-agent": "Node.JS Fetch",
        "Authorization": "Basic " + Buffer.from(SpotifyCID + ":" + SpotifySecret).toString("base64")
    },
    body: `grant_type=client_credentials`
});

const token = (await tokenReq.json()).access_token;

const playlistReq = await fetch("https://api.spotify.com/v1/playlists/1YIe34rcmLjCYpY9wJoM2p/tracks", {
    headers: {
        Authorization: "Bearer " + token,
        "User-agent": "Node.JS Fetch"
    }
});

const playlist = await playlistReq.json();
for (let track of playlist.items) {
    tracksJson.push(parseTrack(track.track))
}

fs.writeFileSync("tracks.json", JSON.stringify({ tracks: tracksJson }));

console.log("[i] Downloading tracks..")

for (let track of tracksJson) {
    console.log("[i] Downloading " + track.name);
    const execution = execSync(`${process.cwd()}\\yt-dlp_min.exe -x --audio-format mp3 --audio-quality 0 --output "tracks/${track.fileName}" "ytsearch:${track.artist} ${track.name}"`);
    console.log(execution.toString())
    console.log("[Downloaded " + track.name)
}


function parseTrack(track: any) {
    return {fileName: replaceAllBadCharacters(track.name) + ".mp3", name: track.name, url: track.external_urls.spotify, artist: track.artists[0].name}
}

function replaceAllBadCharacters(str: string) {
    return str
        .replace(/[/\\?%*:|".<>-]/g, '')
        .replaceAll(" ", "");
}

interface Track {
    fileName: string;
    artist: string;
    name: string;
    url: string;
}