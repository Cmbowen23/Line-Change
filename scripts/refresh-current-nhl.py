"""Refresh official NHL appearances without adding roster-only connections."""
import collections, concurrent.futures, csv, datetime, json, pathlib, re, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]

def fetch_report(kind, game_type, season):
    rows, start = [], 0
    while True:
        params = {'isAggregate': 'false', 'isGame': 'false', 'start': start, 'limit': 1000,
                  'cayenneExp': f'seasonId={season} and gameTypeId={game_type}'}
        url = f'https://api.nhle.com/stats/rest/en/{kind}/summary?' + urllib.parse.urlencode(params)
        request = urllib.request.Request(url, headers={'User-Agent': 'LineChange/1.0 (official NHL appearance refresh)', 'Accept': 'application/json'})
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.load(response)
        batch = result['data']; rows.extend(batch)
        if len(rows) >= result['total']:
            assert len(rows) == result['total'], 'Report row count mismatch'
            break
        assert batch, 'Incomplete report'
        start += len(batch)
    return kind, game_type, rows

def memberships(reports, season):
    players, groups, games = {}, {}, {}
    for kind, game_type, rows in reports:
        seen = set()
        for row in rows:
            player = int(row['playerId'])
            assert player not in seen, 'Duplicate summary player'; seen.add(player)
            assert int(row['seasonId']) == season and int(row['gamesPlayed']) > 0, 'Wrong season or no appearances'
            teams = [t for t in re.split(r'[,\s]+', row['teamAbbrevs'].strip()) if t]
            assert teams and all(re.fullmatch('[A-Z]{2,3}', t) for t in teams), 'Invalid team code'
            players[player] = [row.get('skaterFullName') or row.get('goalieFullName'), 'G' if kind == 'goalie' else row['positionCode']]
            assert players[player][0], 'Missing player name'
            if game_type == 2:
                games[player] = int(row['gamesPlayed'])  # season total, not once per traded team
            for team in teams:
                flags = groups.setdefault((player, team), [0, 0]); flags[game_type - 2] = 1
    return players, groups, games

def read_csv(name):
    with (ROOT / 'source-data' / name).open(newline='') as source:
        reader = csv.DictReader(source); return reader.fieldnames, list(reader)

def write_csv(name, fields, rows):
    with (ROOT / 'source-data' / name).open('w', newline='') as target:
        writer = csv.DictWriter(target, fields); writer.writeheader(); writer.writerows(rows)

def remeasure_puzzles(data, schedule):
    by_player = collections.defaultdict(list)
    for i, group in enumerate(data['groups']):
        for player in group[2]: by_player[player].append(i)
    cache = {}
    def distance(a, b):
        if a not in cache:
            distances, queue, seen = {a: 0}, [a], set()
            for player in queue:
                for i in by_player[player]:
                    if i in seen: continue
                    seen.add(i)
                    for next_player in data['groups'][i][2]:
                        if next_player not in distances:
                            distances[next_player] = distances[player] + 1; queue.append(next_player)
            cache[a] = distances
        assert b in cache[a], 'Daily matchup is disconnected'
        return cache[a][b]
    for puzzles in [data['puzzles'], schedule['puzzles'], list(schedule.get('overrides', {}).values())]:
        for puzzle in puzzles: puzzle[2] = distance(puzzle[0], puzzle[1])

def main():
    today = datetime.date.today(); year = today.year if today.month >= 9 else today.year - 1
    season = year * 10000 + year + 1
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        reports = list(pool.map(lambda args: fetch_report(*args, season), [('skater', 2), ('goalie', 2), ('skater', 3), ('goalie', 3)]))
    additions, membership, season_games = memberships(reports, season)
    assert len(additions) >= 300, 'Current-season appearances are unavailable or incomplete; existing data retained'
    data_path = ROOT / 'public/data/hockey.json'; data = json.loads(data_path.read_text())
    depth_path = ROOT / 'public/data/player-depth.json'; depth = json.loads(depth_path.read_text())
    snapshot_path = ROOT / 'source-data/current-season.json'
    previous = json.loads(snapshot_path.read_text()) if snapshot_path.exists() else {}
    baseline = previous['baselineRegularSeasonGames'] if previous.get('seasonId') == season else dict(depth['regularSeasonGames'])
    unknown_teams = {team for _, team in membership} - set(data['teams'])
    assert not unknown_teams, f'Unknown teams: {unknown_teams}'
    for player, (name, position) in additions.items():
        old = data['players'].get(str(player), [name, position, season, season])
        data['players'][str(player)] = [name, position, min(int(old[2]), season), max(int(old[3]), season)]
        depth['regularSeasonGames'][str(player)] = int(baseline.get(str(player), 0)) + season_games.get(player, 0)
    current_groups = collections.defaultdict(set)
    for player, team in membership: current_groups[team].add(player)
    assert len(current_groups) == 32, 'Not all current NHL teams have appearance records'
    data['groups'] = [g for g in data['groups'] if g[1] != season] + [[team, season, sorted(ids)] for team, ids in sorted(current_groups.items())]
    data['coverage'] = f'1917–18 through {year}–{str(year + 1)[-2:]}'
    data['refreshedAt'] = today.isoformat(); data['currentSeason'] = season
    # Stable daily identity preserves attempts; retrieval metadata identifies this refresh.
    schedule_path = ROOT / 'public/data/daily-puzzles.json'; schedule = json.loads(schedule_path.read_text())
    remeasure_puzzles(data, schedule)
    fields, rows = read_csv('player_seasons.csv'); rows = [row for row in rows if int(row['season']) != season]
    rows.extend({'player_id': player, 'player_name': additions[player][0], 'team': team, 'season': season,
                 'regular_season_appearance': flags[0], 'playoff_appearance': flags[1]} for (player, team), flags in sorted(membership.items()))
    write_csv('player_seasons.csv', fields, rows)
    fields, rows = read_csv('players.csv'); records = {int(row['player_id']): row for row in rows}
    for player in additions:
        record = records.setdefault(player, dict.fromkeys(fields, 0)); p = data['players'][str(player)]
        record.update(player_id=player, player_name=p[0], position=p[1], first_season=p[2], last_season=p[3], regular_season_games=depth['regularSeasonGames'][str(player)])
    write_csv('players.csv', fields, [records[player] for player in sorted(records)])
    for path, record in [(data_path, data), (depth_path, depth), (schedule_path, schedule)]:
        path.write_text(json.dumps(record, ensure_ascii=False, separators=(',', ':')))
    snapshot_path.write_text(json.dumps({'seasonId': season, 'asOf': today.isoformat(), 'playerCount': len(additions),
        'teamCount': len(current_groups), 'membershipCount': len(membership), 'baselineRegularSeasonGames': baseline,
        'reports': [{'kind': kind, 'gameType': game_type, 'rows': rows} for kind, game_type, rows in reports]}, separators=(',', ':')))
    html_path = ROOT / 'public/index.html'; html = html_path.read_text()
    html = re.sub(r'1917–18 → \d{4}–\d{2}', f'1917–18 → {year}–{str(year + 1)[-2:]}', html)
    html = re.sub(r'Loading [\d,]+ NHL players…', f"Loading {len(data['players']):,} NHL players…", html)
    html_path.write_text(html)
    print(json.dumps({'season': season, 'asOf': today.isoformat(), 'currentPlayers': len(additions), 'teams': len(current_groups), 'allPlayers': len(data['players']), 'groups': len(data['groups'])}))

if __name__ == '__main__': main()
