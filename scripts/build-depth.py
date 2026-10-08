"""Publish existing career game totals for free-play endpoint difficulty."""
import csv,json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
games={row['player_id']:int(row['regular_season_games']) for row in csv.DictReader((root/'source-data/players.csv').open())}
(root/'public/data/player-depth.json').write_text(json.dumps({'regularSeasonGames':games},separators=(',',':')))
