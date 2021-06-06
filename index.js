import 'dotenv/config';
import express from 'express';
import Spotify from 'spotify-web-api-node';
import open from 'open';

const { CLIENT_ID, CLIENT_SECRET, PURGE_PLAYLIST_NAME, SOURCE_PLAYLIST_NAME } =
    process.env;

const spotifyApi = new Spotify({
    redirectUri: 'http://localhost:8888/callback',
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET
});

const app = express();

const scopes = [
    'user-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-read-private',
    'playlist-modify-private',
    'user-library-read'
];

app.get('/login', (req, res) => {
    res.redirect(spotifyApi.createAuthorizeURL(scopes));
});

const getToken = new Promise((resolve, reject) => {
    app.get('/callback', async (req, res) => {
        const error = req.query.error;
        const code = req.query.code;

        if (error) {
            console.error('Callback Error:', error);
            res.send(`Callback Error: ${error}`);
            return;
        }

        try {
            const data = await spotifyApi.authorizationCodeGrant(code);

            const access_token = data.body['access_token'];
            const refresh_token = data.body['refresh_token'];

            spotifyApi.setAccessToken(access_token);
            spotifyApi.setRefreshToken(refresh_token);

            res.send('Success! You can now close the window.');
            resolve();
        } catch (error) {
            console.error('Error getting Tokens:', error);
            res.send(`Error getting Tokens: ${error}`);
            reject(error);
        }
    });
});

/**
 * @type {import('http').Server}
 */
const server = await new Promise((res) => {
    const http = app.listen(8888, () => res(http));
});

const proc = await open('http://localhost:8888/login', {
    background: true,
    newInstance: true
});

await getToken;

proc.kill();
server.close();

const {
    body: { id: USER_ID }
} = await spotifyApi.getMe();

/**
 *
 * @param {string} name Playlist Name
 * @returns {Promise<SpotifyApi.PlaylistObjectSimplified>} Playlist
 */
const getPlaylist = async (name) => {
    const {
        body: { items: playlists }
    } = await spotifyApi.getUserPlaylists(USER_ID);

    return playlists.find((playlist) => playlist.name === name);
};

/**
 *
 * @param {string} name Playlist Name
 * @returns {Promise<Map<string, SpotifyApi.TrackObjectFull>>} Playlist set
 */
const getAllPlaylistTracks = async (name) => {
    const playlistMap = new Map();
    const playlist = await getPlaylist(name);

    console.log(`Fetching playlist: ${name}`);

    let offset = 0;
    const {
        body: { total }
    } = await spotifyApi.getPlaylistTracks(playlist.id);

    do {
        const {
            body: { items }
        } = await spotifyApi.getPlaylistTracks(playlist.id, {
            offset,
            limit: 100
        });

        items.forEach(({ track }, i) =>
            playlistMap.set(track.uri, { ...track, position: i + offset })
        );

        offset += 100;
    } while (playlistMap.size !== total);

    console.log(`Successfully loaded ${total} songs from playlist: ${name}`);

    return playlistMap;
};

const [graveyardMap, newMusicMap] = await Promise.all([
    getAllPlaylistTracks(PURGE_PLAYLIST_NAME),
    getAllPlaylistTracks(SOURCE_PLAYLIST_NAME)
]);

/** @type {Array<SpotifyApi.TrackObjectFull>} */
const intersection = [];
newMusicMap.forEach(
    (val, key) =>
        graveyardMap.has(key) &&
        intersection.push({
            ...val,
            position: val.position
        })
);

if (!intersection.length) {
    console.log('No songs to purge');
    process.exit(0);
}

/**
 * @template T
 * @param {Array<T>} arr
 * @param {number} chunkSize
 * @returns {Array<Array<T>>}
 */
const chunkArray = (arr, chunkSize) => {
    /** @type {Array<Array<T>>} */
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        res.push(chunk);
    }
    return res;
};

const playlist = await getPlaylist(SOURCE_PLAYLIST_NAME);

console.log(
    `Removing ${intersection.length} songs from playlist: ${SOURCE_PLAYLIST_NAME}`
);

const localTracks = intersection
    .filter((val) => val.uri.includes('spotify:local'))
    .map((track) => track.position);

if (localTracks.length) {
    await spotifyApi.removeTracksFromPlaylistByPosition(
        playlist.id,
        localTracks,
        playlist.snapshot_id
    );
}

const tracks = intersection
    .filter((val) => !val.uri.includes('spotify:local'))
    .map((track) => ({ uri: track.uri }));

const trackChunks = chunkArray(tracks, 50);

await Promise.all(
    trackChunks.map((chunk) =>
        spotifyApi.removeTracksFromPlaylist(playlist.id, chunk)
    )
);

console.log(
    `Successfully removed the following songs from playlist: ${SOURCE_PLAYLIST_NAME}`
);
console.log(intersection.map((track) => track.name));
