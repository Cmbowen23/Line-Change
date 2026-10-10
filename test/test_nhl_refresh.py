import importlib.util, pathlib, unittest
spec = importlib.util.spec_from_file_location('refresh', pathlib.Path(__file__).resolve().parents[1] / 'scripts/refresh-current-nhl.py')
refresh = importlib.util.module_from_spec(spec); spec.loader.exec_module(refresh)

class RefreshTests(unittest.TestCase):
    def row(self, **changes):
        return {'playerId': 1, 'seasonId': 20262027, 'gamesPlayed': 4, 'teamAbbrevs': 'PHI,OTT', 'skaterFullName': 'Player', 'positionCode': 'C', **changes}
    def test_traded_players_keep_both_clubs_and_games_are_counted_once(self):
        players, groups, games = refresh.memberships([('skater', 2, [self.row()]), ('skater', 3, [self.row(gamesPlayed=2)])], 20262027)
        self.assertEqual(set(groups), {(1, 'PHI'), (1, 'OTT')}); self.assertEqual(groups[(1, 'PHI')], [1, 1]); self.assertEqual(games[1], 4)
    def test_wrong_seasons_zero_appearances_and_duplicate_ids_are_rejected(self):
        for rows in [[self.row(seasonId=20252026)], [self.row(gamesPlayed=0)], [self.row(teamAbbrevs='')], [self.row(), self.row()]]:
            with self.assertRaises(AssertionError): refresh.memberships([('skater', 2, rows)], 20262027)
    def test_current_connections_remeasure_puzzles_without_changing_endpoints(self):
        data = {'groups': [['A', 20252026, [1, 2]], ['B', 20252026, [2, 3]], ['C', 20262027, [1, 3]]], 'puzzles': [[1, 3, 2]]}
        schedule = {'puzzles': [[1, 3, 2]], 'overrides': {'2026-10-10': [3, 1, 2]}}
        refresh.remeasure_puzzles(data, schedule)
        self.assertEqual(data['puzzles'], [[1, 3, 1]]); self.assertEqual(schedule['overrides']['2026-10-10'], [3, 1, 1])

if __name__ == '__main__': unittest.main()
