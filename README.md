# Spotify-Purge-Playlist

Removes songs from the source playlist that is already in the purge playlist. For example, if you add a song (4:44 by JAY-Z) to the "Graveyard" playlist, this script will remove the song (4:44 by JAY-Z) from the "Rap music" playlist

## Example

1. Rap music playlist:
   | Song | Artist |
   |------|--------|
   | 4:44 | JAY-Z |
   | Halftime | Nas |
   | ... | ... |

    Graveyard playlist:
    | Song | Artist |
    |------|--------|
    | 4:44 | JAY-Z |
    | Peaches | Justin Beiber |
    | ... | ... |

2. Run script: `yarn start`

3. Rap music playlist:
   | Song | Artist |
   |------|--------|
   | Halftime | Nas |
   | ... | ... |

    Graveyard playlist:
    | Song | Artist |
    |------|--------|
    | 4:44 | JAY-Z |
    | Peaches | Justin Beiber |
    | ... | ... |

### Usage

1. Create a [spotify developer application](https://developer.spotify.com/)
2. `yarn`
3. Rename `.env.example` to `.env`
4. Fill out `.env`
5. `yarn start`
