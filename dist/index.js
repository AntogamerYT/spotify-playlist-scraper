#! /usr/bin/env node
import { execSync, spawnSync } from "child_process";
import chalk from "chalk";
import yesno from "yesno";
import { argv } from "process";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { createInterface } from "readline";
import { resolve } from "path";
import fs from 'fs';
import os from 'os';
import { createHash } from "crypto";
/**
 * Console colors and their meanings:
 * Yellow: infos
 * Red: errors
 * Blue: debug
 */
const osName = os.type();
const ytdlLinks = {
    "Windows_NT": "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_min.exe",
    "Linux": "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux",
    "Darwin": "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
};
const ytdlfilenames = {
    "Windows_NT": "yt-dlp_min.exe",
    "Linux": "yt-dlp_linux",
    "Darwin": "yt-dlp_macos"
};
let cliArgs = {};
argv.slice(2).map(arg => {
    const [key, value] = arg.split("=");
    cliArgs[key] = value;
});
if (Object.keys(cliArgs).length === 0) {
    logInfo("Usage: npx spotify-playlist-scraper cid=Client_ID secret=Client_Secret playlist=Playlist_ID");
    process.exit();
}
if (cliArgs["cid"] === undefined || cliArgs["secret"] === undefined) {
    throw new Error(chalk.red("The Spotify client ID and secret are required to run this script. Get them from https://developer.spotify.com/dashboard/applications and run the script again like this:\nnpx spotify-playlist-scraper cid=Client_ID secret=Client_Secret playlist=Playlist_ID"));
}
if (cliArgs["playlist"] === undefined) {
    const readline = createInterface({
        input: process.stdin,
        output: process.stdout
    });
    readline.question(chalk.yellow(`Please enter a playlist ID, you can get it from a playlist url (Example: https://open.spotify.com/playlist/${chalk.green("1YIe34rcmLjCYpY9wJoM2p")}): `), (playlistID) => {
        cliArgs["playlist"] = playlistID;
        readline.close();
    });
}
let tracksJson = [];
const SpotifyCID = cliArgs["cid"];
const SpotifySecret = cliArgs["secret"];
const SpotifyPlaylistID = cliArgs["playlist"];
const LogType = cliArgs["log"] || "info";
if (!fs.existsSync(resolve(".") + "/tracks")) {
    fs.mkdirSync(resolve(".") + "/tracks");
}
else {
    const res = await yesno({
        question: chalk.yellow("A tracks folder already exists! Do you want to keep it or DELETE its content? (y = keep/n = delete)"),
    });
    if (res) {
        logInfo("Keeping tracks folder..");
    }
    else {
        logInfo("Deleting tracks folder..");
        fs.rmSync(resolve(".") + "/tracks", { recursive: true, force: true });
        fs.mkdirSync(resolve(".") + "/tracks");
    }
}
if (fs.existsSync(resolve(".") + "/tracks.json")) {
    const res = await yesno({
        question: chalk.yellow("A tracks.json file already exists! Do you want to skip to the music download or overwrite it and scrape it again?\nThis will also generate filenames in your JSON if you don't already have them and decide to skip! (y = skip/n = overwrite)"),
    });
    if (res) {
        tracksJson = JSON.parse(fs.readFileSync(resolve(".") + "/tracks.json", "utf-8")).tracks;
        await downloadYtDlp();
        downloadMusic();
        process.exit();
    }
    else {
        logInfo("Overwriting tracks.json..");
        await scrapeMusic();
        const downloadTracksAnswer = await yesno({
            question: chalk.yellow(`Do you want to download all (${tracksJson.length}) tracks using yt-dlp? ${chalk.red("RESULTS MAY BE INACCURATE, BLAME YOUTUBE, NOT ME!")} (y/n)`),
        });
        if (!downloadTracksAnswer) {
            logInfo("Exiting..");
            process.exit(0);
        }
        else {
            await downloadYtDlp();
            downloadMusic();
            process.exit();
        }
    }
}
await scrapeMusic();
const downloadTracksAnswer = await yesno({
    question: chalk.yellow(`Do you want to download all (${tracksJson.length}) tracks using yt-dlp? ${chalk.red("RESULTS MAY BE INACCURATE, BLAME YOUTUBE, NOT ME!")}\nThis will also generate filenames in your JSON if you don't already have them! (y/n)`),
});
if (!downloadTracksAnswer) {
    logInfo("Exiting..");
    process.exit(0);
}
else {
    await downloadYtDlp();
    downloadMusic();
    process.exit();
}
function parseTrack(track, includeFileName) {
    if (includeFileName) {
        return { fileName: replaceAllBadCharacters(track.name) + ".mp3", name: track.name, url: track.external_urls.spotify, artist: track.artists[0].name };
    }
    else {
        return { name: track.name, url: track.external_urls.spotify, artist: track.artists[0].name };
    }
}
function replaceAllBadCharacters(str) {
    return str
        .replace(/[/\\?%*:|"'().<>-]/g, '')
        .replaceAll(" ", "");
}
function logInfo(text) {
    console.log(chalk.yellow("[i] " + text));
}
function logSuccess(text) {
    console.log(chalk.green("[!] " + text));
}
function logDebug(text) {
    console.log(chalk.blueBright("[d] " + text));
}
function getPathFromOs() {
    return osName === "Windows_NT" ? resolve(".") + "\\" : resolve(".") + "/";
}
function downloadMusic() {
    logInfo("Downloading tracks..");
    if (!('fileName' in tracksJson[0])) {
        logInfo("No fileName property found, generating filenames..");
        tracksJson = tracksJson.map((track) => parseTrack(track, true));
    }
    for (let track of tracksJson) {
        logInfo("Downloading " + track.name);
        try {
            const execution = execSync(`${getPathFromOs()}${ytdlfilenames[osName]} -x --audio-format mp3 --audio-quality 0 --output "tracks/${track.fileName}" "ytsearch:${track.artist} ${track.name}"`);
            if (LogType === "DEBUG")
                logDebug("Ytdl stdout: " + execution.toString());
        }
        catch (error) {
            if (error.stderr.includes("Sign in to confirm your age"))
                logInfo("Skipping " + track.name + " because it's age restricted.");
            else
                logInfo("Skipping " + track.name + " because its download errored, enable debug logging for more info.");
            if (LogType === "DEBUG")
                logDebug("Ytdl stderr: " + error.stderr.toString());
            continue;
        }
        logSuccess("Downloaded " + track.name);
    }
}
async function downloadYtDlp() {
    if (!fs.existsSync(resolve(".") + "/" + ytdlfilenames[osName])) {
        logInfo("Downloading yt-dlp..");
        const Download = await fetch(ytdlLinks[osName]);
        const file = fs.createWriteStream(resolve(".") + "/" + ytdlfilenames[osName], { flags: "wx" });
        await finished(Readable.fromWeb(Download.body).pipe(file));
        if (osName === "Linux" || osName === "Darwin")
            spawnSync(`chmod +x ${getPathFromOs()}${ytdlfilenames[osName]}`);
        const hash = createHash("sha256").update(fs.readFileSync(resolve(".") + "/" + ytdlfilenames[osName])).digest("hex");
        const hashesList = await (await fetch("https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS")).text();
        if (LogType === "DEBUG")
            logDebug("yt-dlp hashes from GitHub: " + hashesList);
        if (LogType === "DEBUG")
            logDebug("SHA256 of the yt-dlp file: " + hash);
        if (hashesList.includes(hash)) {
            logSuccess("Downloaded yt-dlp");
        }
        else {
            logInfo("Failed to download yt-dlp, please download it manually from https://github.com/yt-dlp/yt-dlp/releases and put it in the same folder of where you're executing the command, then run the script again.");
            if (LogType === "DEBUG")
                logDebug("SHA256 Check failed, quitting..");
            process.exit(1);
        }
    }
    else {
        let hash = createHash("sha256").update(fs.readFileSync(resolve(".") + "/" + ytdlfilenames[osName])).digest("hex");
        const hashesList = await (await fetch("https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS")).text();
        if (LogType === "DEBUG")
            logDebug("yt-dlp hashes from GitHub: " + hashesList);
        if (LogType === "DEBUG")
            logDebug("SHA256 of the yt-dlp file: " + hash);
        if (hashesList.includes(hash)) {
            logSuccess("yt-dlp already exists! Skipping download..");
        }
        else {
            logInfo("Updating yt-dlp..");
            if (LogType === "DEBUG")
                logDebug("SHA256 Check failed (file hash: " + hash + "), updating yt-dlp.)");
            const Download = await fetch(ytdlLinks[osName]);
            const file = fs.createWriteStream(resolve(".") + "/" + ytdlfilenames[osName], { flags: "wx" });
            await finished(Readable.fromWeb(Download.body).pipe(file));
            if (osName === "Linux" || osName === "Darwin")
                spawnSync(`chmod +x ${getPathFromOs()}${ytdlfilenames[osName]}`);
            hash = createHash("sha256").update(fs.readFileSync(resolve(".") + "/" + ytdlfilenames[osName])).digest("hex");
            if (hashesList.includes(hash)) {
                logSuccess("Updated yt-dlp!");
            }
        }
    }
}
async function scrapeMusic() {
    logInfo("Scraping tracks..");
    const tokenReq = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-agent": "Node.JS Fetch",
            "Authorization": "Basic " + Buffer.from(SpotifyCID + ":" + SpotifySecret).toString("base64")
        },
        body: `grant_type=client_credentials`
    });
    if (tokenReq.status === 401) {
        throw new Error(chalk.red("The client or secret provided are invalid, please check them and try again."));
    }
    const token = (await tokenReq.json()).access_token;
    if (LogType === "DEBUG")
        logDebug("Spotify access token: " + token);
    const playlistReq = await fetch(`https://api.spotify.com/v1/playlists/${SpotifyPlaylistID}/tracks`, {
        headers: {
            Authorization: "Bearer " + token,
            "User-agent": "Node.JS Fetch"
        }
    });
    if (playlistReq.status === 404) {
        throw new Error(chalk.red("The playlist ID provided is invalid."));
    }
    const includeTracks = await yesno({
        question: chalk.yellow("Do you want to include the track fileName in the tracks.json file? (y/n)")
    });
    const playlist = await playlistReq.json();
    for (let track of playlist.items) {
        tracksJson.push(parseTrack(track.track, includeTracks));
    }
    fs.writeFileSync(resolve(".") + "/tracks.json", JSON.stringify({ tracks: tracksJson }));
    logSuccess(`Scraped ${playlist.items.length} tracks!`);
}
