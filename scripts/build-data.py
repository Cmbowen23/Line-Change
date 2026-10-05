import csv,json,pathlib,collections,random
R=pathlib.Path(__file__).resolve().parents[1];D=R/'source-data';O=R/'public/data'
ps=list(csv.DictReader((D/'players.csv').open())); groups=collections.defaultdict(set)
for r in csv.DictReader((D/'player_seasons.csv').open()):groups[(r['team'],int(r['season']))].add(int(r['player_id']))
teams={r['team_abbrev']:r['team_name'] for r in csv.DictReader((D/'teams.csv').open())}
records=[[t,s,sorted(ids)] for (t,s),ids in sorted(groups.items())]
byplayer=collections.defaultdict(list)
for i,(t,s,ids) in enumerate(records):
 for p in ids:byplayer[p].append(i)
players={int(r['player_id']):[r['player_name'],r['position'],r['first_season'],r['last_season']] for r in ps}
def distances(a):
 ds={a:0};q=[a];visited=set()
 for p in q:
  for gi in byplayer[p]:
   if gi in visited:continue
   visited.add(gi)
   for x in records[gi][2]:
    if x not in ds:ds[x]=ds[p]+1;q.append(x)
 return ds
old=[int(r['player_id']) for r in ps if int(r['regular_season_games'])>=600 and int(r['first_season'])<19801981]
new=[int(r['player_id']) for r in ps if int(r['regular_season_games'])>=300 and int(r['last_season'])>=20232024]
rng=random.Random(101);rng.shuffle(old);rng.shuffle(new);puzzles=[]
for a in old:
 ds=distances(a)
 choices=[b for b in new if 3<=ds.get(b,0)<=5];rng.shuffle(choices)
 for b in choices[:10]:puzzles.append([a,b,ds[b]])
rng.shuffle(puzzles);assert len(puzzles)>=366
O.mkdir(exist_ok=True)
data={'version':'2026-10-05','coverage':'1917–18 through 2025–26','players':players,'groups':records,'teams':teams,'puzzles':puzzles[:730]}
(O/'hockey.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
print(len(players),'players;',len(records),'groups;',len(data['puzzles']),'daily puzzles;', (O/'hockey.json').stat().st_size,'bytes')
