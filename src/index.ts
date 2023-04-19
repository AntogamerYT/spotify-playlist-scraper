#! /usr/bin/env node
import { execSync, spawnSync } from "child_process";
import chalk from "chalk";
import yesno from "yesno";
import { argv } from "process";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { createInterface } from "readline";
import { resolve } from "path";
import fs from 'fs'
import os from 'os'

/**
 * Console colors and their meanings:
 * Yellow: infos
 * Red: errors
 * Blue: debug
 */

const osName: string = os.type()
const ytdlLinks: {
    [key: string]: string;
} = {
    "Windows_NT": "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_min.exe",
    "Linux": "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux",
    "Darwin": "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
}
const ytdlfilenames: {
    [key: string]: string;
} = {
    "Windows_NT": "yt-dlp_min.exe",
    "Linux": "yt-dlp_linux",
    "Darwin": "yt-dlp_macos"
}

let cliArgs: arguments = {}
argv.slice(2).map(arg => {
    const [key, value] = arg.split("=");
    cliArgs[key] = value;
});


if (Object.keys(cliArgs).length === 0) {
    LogInfo("Usage: npx spotify-playlist-scraper cid=Client_ID secret=Client_Secret playlist=Playlist_ID")
    process.exit()
}


if (cliArgs["cid"] === undefined || cliArgs["secret"] === undefined) {
    throw new Error(chalk.red("The Spotify client ID and secret are required to run this script. Get them from https://developer.spotify.com/dashboard/applications and run the script again like this:\nnpx spotify-playlist-scraper cid=Client_ID secret=Client_Secret playlist=Playlist_ID"))
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



let tracksJson: any/*Track[] | TrackNoUrl[]*/ = [];
const SpotifyCID = cliArgs["cid"];
const SpotifySecret = cliArgs["secret"];
const SpotifyPlaylistID = cliArgs["playlist"];
const LogType = cliArgs["log"] || "info";

if (!fs.existsSync(resolve(".") + "/tracks")) {
    fs.mkdirSync(resolve(".") + "/tracks")
} else {
    const res = await yesno({
        question: chalk.yellow("A tracks folder already exists! Do you want to keep it or DELETE its content? (y = keep/n = delete)"),
    })
    if (res) {
        LogInfo("Keeping tracks folder..")
    } else {
        LogInfo("Deleting tracks folder..")
        fs.rmSync(resolve(".") + "/tracks", { recursive: true, force: true })
        fs.mkdirSync(resolve(".") + "/tracks")
    }
}

if (fs.existsSync(resolve(".") + "/tracks.json")) {
    const res = await yesno({
        question: chalk.yellow("A tracks.json file already exists! Do you want to skip to the music download or overwrite it and scrape it again?\nThis will also generate filenames in your JSON if you don't already have them and decide to skip! (y = skip/n = overwrite)"),
    })
    if (res) {
        tracksJson = JSON.parse(fs.readFileSync(resolve(".") + "/tracks.json", "utf-8")).tracks;
        await DownloadYtDlp()
        DownloadMusic()
        process.exit()
    } else {
        LogInfo("Overwriting tracks.json..")
        await ScrapeMusic()
        const downloadTracksAnswer = await yesno({
            question: chalk.yellow(`Do you want to download all (${tracksJson.length}) tracks using yt-dlp? ${chalk.red("RESULTS MAY BE INACCURATE, BLAME YOUTUBE, NOT ME!")} (y/n)`),
        })

        if (!downloadTracksAnswer) {
            LogInfo("Exiting..")
            process.exit(0);
        } else {
            await DownloadYtDlp()
            DownloadMusic()
            process.exit()
        }
    }
}

await ScrapeMusic()
const downloadTracksAnswer = await yesno({
    question: chalk.yellow(`Do you want to download all (${tracksJson.length}) tracks using yt-dlp? ${chalk.red("RESULTS MAY BE INACCURATE, BLAME YOUTUBE, NOT ME!")}\nThis will also generate filenames in your JSON if you don't already have them! (y/n)`),
})

if (!downloadTracksAnswer) {
    LogInfo("Exiting..")
    process.exit(0);
} else {
    await DownloadYtDlp()
    await DownloadMusic()
    process.exit()
}






function parseTrack(track: any, includeFileName: boolean) {
    if (includeFileName) {
        return { fileName: replaceAllBadCharacters(track.name) + ".mp3", name: track.name, url: track.external_urls.spotify, artist: track.artists[0].name }
    } else {
        return { name: track.name, url: track.external_urls.spotify, artist: track.artists[0].name }
    }
}

function replaceAllBadCharacters(str: string) {
    return str
        .replace(/[/\\?%*:|"'().<>-]/g, '')
        .replaceAll(" ", "");
}

interface Track {
    fileName: string;
    artist: string;
    name: string;
    url: string;
}

interface TrackNoUrl {
    artist: string;
    name: string;
    url: string;
}

interface arguments {
    [key: string]: string;
}

function LogInfo(text: string) {
    console.log(chalk.yellow("[i] " + text))
}

function LogDebug(text: string) {
    console.log(chalk.blue("[d] " + text))
}

function getPathFromOs() {
    return osName === "Windows_NT" ? resolve(".") + "\\" : resolve(".") + "/"
}


function DownloadMusic() {
    LogInfo("Downloading tracks..")

    if (!tracksJson[0].fileName) {
        LogInfo("No fileName property found, generating filenames..")
        tracksJson = tracksJson.map((track: any) => parseTrack(track, true))
    }

    for (let track of tracksJson) {
        LogInfo("Downloading " + track.name);
        const execution = execSync(`${getPathFromOs()}${ytdlfilenames[osName]} -x --audio-format mp3 --audio-quality 0 --output "tracks/${track.fileName}" "ytsearch:${track.artist} ${track.name}"`);

        if (LogType === "DEBUG") LogDebug("Ytdl stdout: " + execution.toString())

        LogInfo("Downloaded " + track.name)
    }
}

async function DownloadYtDlp() {
    if (!fs.existsSync(resolve(".") + "/" + ytdlfilenames[osName])) {
        LogInfo("Downloading yt-dlp..")
        const Download = await fetch(ytdlLinks[osName])
        const file = fs.createWriteStream(resolve(".") + "/" + ytdlfilenames[osName], { flags: "wx" })
        await finished(Readable.fromWeb(Download.body as any).pipe(file))
        if(osName === "Linux" || osName === "Darwin") spawnSync(`chmod +x ${getPathFromOs()}${ytdlfilenames[osName]}`)
        const execution = spawnSync(`${getPathFromOs()}${ytdlfilenames[osName]}`);
        
        if (LogType === "DEBUG") LogDebug("Ytdl stdout: " + execution.output.toString())

        if (execution.output.toString().includes("yt-dlp")) {
            LogInfo("Downloaded yt-dlp")
        } else {
            LogInfo("Failed to download yt-dlp, please download it manually from https://github.com/yt-dlp/yt-dlp/releases and put it in the same folder of where you're executing the command, then run the script again.")
            process.exit(1);
        }
    } else {
        LogInfo("yt-dlp already exists! Skipping download..")
    }
}

async function ScrapeMusic() {
    LogInfo("Scraping tracks..")
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
        throw new Error(chalk.red("The client or secret provided are invalid, please check them and try again."))
    }

    const token = (await tokenReq.json()).access_token;
    LogDebug("Spotify access token: " + token)

    const playlistReq = await fetch(`https://api.spotify.com/v1/playlists/${SpotifyPlaylistID}/tracks`, {
        headers: {
            Authorization: "Bearer " + token,
            "User-agent": "Node.JS Fetch"
        }
    });

    if (playlistReq.status === 404) {
        throw new Error(chalk.red("The playlist ID provided is invalid."))
    }

    const includeTracks = await yesno({
        question: chalk.yellow("Do you want to include the track fileName in the tracks.json file? (y/n)")
    })

    const playlist = await playlistReq.json();
    for (let track of playlist.items) {
        tracksJson.push(parseTrack(track.track, includeTracks))
    }

    fs.writeFileSync(resolve(".") + "/tracks.json", JSON.stringify({ tracks: tracksJson }));
    LogInfo(`Scraped ${playlist.items.length} tracks!`)
}


