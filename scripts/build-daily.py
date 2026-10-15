"""Generate daily endpoint pairs from an explicit, editable list of notable players."""
import json,pathlib,collections,random,unicodedata
R=pathlib.Path(__file__).resolve().parents[1];d=json.loads((R/'public/data/hockey.json').read_text())
names='''Wayne Gretzky|Mario Lemieux|Gordie Howe|Bobby Orr|Bobby Hull|Brett Hull|Mark Messier|Jaromir Jagr|Sidney Crosby|Alex Ovechkin|Connor McDavid|Nathan MacKinnon|Auston Matthews|Connor Bedard|Leon Draisaitl|Nikita Kucherov|Patrick Kane|Jonathan Toews|Joe Sakic|Steve Yzerman|Nicklas Lidstrom|Sergei Fedorov|Pavel Datsyuk|Henrik Zetterberg|Dominik Hasek|Martin Brodeur|Patrick Roy|Roberto Luongo|Carey Price|Henrik Lundqvist|Marc-Andre Fleury|Ed Belfour|Grant Fuhr|Tony Esposito|Ken Dryden|Bernie Parent|Terry Sawchuk|Glenn Hall|Jacques Plante|Phil Esposito|Jean Beliveau|Maurice Richard|Henri Richard|Guy Lafleur|Marcel Dionne|Gilbert Perreault|Bryan Trottier|Mike Bossy|Denis Potvin|Paul Coffey|Ray Bourque|Chris Chelios|Brian Leetch|Scott Stevens|Scott Niedermayer|Al MacInnis|Chris Pronger|Zdeno Chara|Erik Karlsson|Victor Hedman|Cale Makar|Quinn Hughes|Adam Fox|Roman Josi|Duncan Keith|Drew Doughty|Eric Lindros|Peter Forsberg|Teemu Selanne|Paul Kariya|Pavel Bure|Alexander Mogilny|Mats Sundin|Daniel Alfredsson|Joe Thornton|Jarome Iginla|Mike Modano|Jeremy Roenick|Luc Robitaille|Brendan Shanahan|Mark Recchi|Ron Francis|Doug Gilmour|Adam Oates|Pat LaFontaine|Dale Hawerchuk|Denis Savard|Lanny McDonald|Darryl Sittler|Bobby Clarke|Bill Barber|Rick Tocchet|Cam Neely|Rick Nash|Dany Heatley|Ilya Kovalchuk|Evgeni Malkin|Steven Stamkos|Vincent Lecavalier|Martin St. Louis|Claude Giroux|Anze Kopitar|Patrice Bergeron|Brad Marchand|David Pastrnak|Henrik Sedin|Daniel Sedin|Jason Spezza|Daniel Briere|John Tavares|Jack Hughes|Jack Eichel|Aleksander Barkov|Matthew Tkachuk|Brady Tkachuk|Mikko Rantanen|Kirill Kaprizov|Sebastian Aho|William Nylander|Mitch Marner|Brayden Point|Elias Pettersson|Jonathan Quick|Andrei Vasilevskiy|Sergei Bobrovsky|Connor Hellebuyck|Pekka Rinne|Tuukka Rask|Ryan Miller|Ryan Getzlaf|Corey Perry|Jari Kurri|Peter Stastny|Doug Harvey|Ted Lindsay|Alex Delvecchio|Red Kelly|Frank Mahovlich|Tim Horton|Stan Mikita|Dave Keon|Johnny Bower|Jacques Lemaire|Larry Robinson|Bobby Smith|Guy Carbonneau|Pierre Turgeon|Rod Brind'Amour|Keith Tkachuk|Shane Doan|Saku Koivu|Zach Parise|Ryan Suter|Ryan O'Reilly|Phil Kessel|Patrick Marleau'''.split('|')
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',s.lower()) if not unicodedata.combining(c)).replace('-',' ').replace("'",'')
# Resolve duplicate names explicitly; never depend on dictionary insertion order.
lookup=collections.defaultdict(list)
for player_id,player in d['players'].items():lookup[norm(player[0])].append(int(player_id))
pinned={'Jack Hughes':8481559,'Elias Pettersson':8480012,'Sebastian Aho':8478427}
ids=[]
for name in names:
 matches=lookup[norm(name)]
 assert matches,('Player not found',name)
 if name in pinned:
  player_id=pinned[name]
  assert player_id in matches and d['players'][str(player_id)][1]=='C',('Wrong curated player identity',name)
 else:
  assert len(matches)==1,('Ambiguous curated name: pin its player ID',name,matches)
  player_id=matches[0]
 ids.append(player_id)
byplayer=collections.defaultdict(list)
for gi,g in enumerate(d['groups']):
 for p in g[2]:byplayer[p].append(gi)
def distances(a):
 ds={a:0};q=[a];seen=set()
 for p in q:
  for gi in byplayer[p]:
   if gi in seen:continue
   seen.add(gi)
   for x in d['groups'][gi][2]:
    if x not in ds:ds[x]=ds[p]+1;q.append(x)
 return ds
rng=random.Random(209);candidates=[]
for i,a in enumerate(ids):
 ds=distances(a)
 for b in ids[i+1:]:
  if 2<=ds[b]<=4:candidates.append([a,b,ds[b]])
rng.shuffle(candidates)
# Spread endpoint appearances across consecutive days; never force an obscure name.
puzzles=[];recent=[]
while candidates and len(puzzles)<730:
 blocked={p for pair in recent[-7:] for p in pair}
 index=next((i for i,p in enumerate(candidates) if p[0] not in blocked and p[1] not in blocked),0)
 p=candidates.pop(index)
 if rng.random()<.5:p[0],p[1]=p[1],p[0]
 puzzles.append(p);recent.append(p[:2])
assert len(puzzles)==730
existing=R/'public/data/daily-puzzles.json'
previous=json.loads(existing.read_text()) if existing.exists() else {}
overrides=previous.get('overrides',{})
existing.write_text(json.dumps({'policy':'Curated notable endpoints; 2–4 links; all NHL players allowed as intermediates','notablePlayerIds':ids,'overrides':overrides,'overrideDifficulties':previous.get('overrideDifficulties',{}),'legacyPuzzles':previous.get('legacyPuzzles',previous.get('puzzles',puzzles)),'puzzles':puzzles},separators=(',',':')))
print(len(ids),'curated players;',len(puzzles),'daily matchups')

# Recompute the weekday ranking whenever the curated source schedule changes.
import subprocess
subprocess.run(['node',str(R/'scripts/build-daily-weekdays.mjs')],check=True)
