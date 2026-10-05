"""Generate daily endpoint pairs from an explicit, editable list of notable players."""
import json,pathlib,collections,random,unicodedata
R=pathlib.Path(__file__).resolve().parents[1];d=json.loads((R/'public/data/hockey.json').read_text())
names='''Wayne Gretzky|Mario Lemieux|Gordie Howe|Bobby Orr|Bobby Hull|Brett Hull|Mark Messier|Jaromir Jagr|Sidney Crosby|Alex Ovechkin|Connor McDavid|Nathan MacKinnon|Auston Matthews|Connor Bedard|Leon Draisaitl|Nikita Kucherov|Patrick Kane|Jonathan Toews|Joe Sakic|Steve Yzerman|Nicklas Lidstrom|Sergei Fedorov|Pavel Datsyuk|Henrik Zetterberg|Dominik Hasek|Martin Brodeur|Patrick Roy|Roberto Luongo|Carey Price|Henrik Lundqvist|Marc-Andre Fleury|Ed Belfour|Grant Fuhr|Tony Esposito|Ken Dryden|Bernie Parent|Terry Sawchuk|Glenn Hall|Jacques Plante|Phil Esposito|Jean Beliveau|Maurice Richard|Henri Richard|Guy Lafleur|Marcel Dionne|Gilbert Perreault|Bryan Trottier|Mike Bossy|Denis Potvin|Paul Coffey|Ray Bourque|Chris Chelios|Brian Leetch|Scott Stevens|Scott Niedermayer|Al MacInnis|Chris Pronger|Zdeno Chara|Erik Karlsson|Victor Hedman|Cale Makar|Quinn Hughes|Adam Fox|Roman Josi|Duncan Keith|Drew Doughty|Eric Lindros|Peter Forsberg|Teemu Selanne|Paul Kariya|Pavel Bure|Alexander Mogilny|Mats Sundin|Daniel Alfredsson|Joe Thornton|Jarome Iginla|Mike Modano|Jeremy Roenick|Luc Robitaille|Brendan Shanahan|Mark Recchi|Ron Francis|Doug Gilmour|Adam Oates|Pat LaFontaine|Dale Hawerchuk|Denis Savard|Lanny McDonald|Darryl Sittler|Bobby Clarke|Bill Barber|Rick Tocchet|Cam Neely|Rick Nash|Dany Heatley|Ilya Kovalchuk|Evgeni Malkin|Steven Stamkos|Vincent Lecavalier|Martin St. Louis|Claude Giroux|Anze Kopitar|Patrice Bergeron|Brad Marchand|David Pastrnak|Henrik Sedin|Daniel Sedin|Jason Spezza|Daniel Briere|John Tavares|Jack Hughes|Jack Eichel|Aleksander Barkov|Matthew Tkachuk|Brady Tkachuk|Mikko Rantanen|Kirill Kaprizov|Sebastian Aho|William Nylander|Mitch Marner|Brayden Point|Elias Pettersson|Jonathan Quick|Andrei Vasilevskiy|Sergei Bobrovsky|Connor Hellebuyck|Pekka Rinne|Tuukka Rask|Ryan Miller|Ryan Getzlaf|Corey Perry|Jari Kurri|Peter Stastny|Doug Harvey|Ted Lindsay|Alex Delvecchio|Red Kelly|Frank Mahovlich|Tim Horton|Stan Mikita|Dave Keon|Johnny Bower|Jacques Lemaire|Larry Robinson|Bobby Smith|Guy Carbonneau|Pierre Turgeon|Rod Brind'Amour|Keith Tkachuk|Shane Doan|Saku Koivu|Zach Parise|Ryan Suter|Ryan O'Reilly|Phil Kessel|Patrick Marleau'''.split('|')
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',s.lower()) if not unicodedata.combining(c)).replace('-',' ').replace("'",'')
lookup={norm(p[0]):int(i) for i,p in d['players'].items()}
ids=[]
for name in names:
 assert norm(name) in lookup,('Player not found',name)
 ids.append(lookup[norm(name)])
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
overrides=json.loads(existing.read_text()).get('overrides',{}) if existing.exists() else {}
# Keep the already-published challenge fixed for players mid-attempt.
import datetime
date='2026-10-04';day=(datetime.date.fromisoformat(date)-datetime.date(1970,1,1)).days
overrides.setdefault(date,d['puzzles'][day%len(d['puzzles'])])
existing.write_text(json.dumps({'policy':'Curated notable endpoints; 2–4 links; all NHL players allowed as intermediates','notablePlayerIds':ids,'overrides':overrides,'puzzles':puzzles},separators=(',',':')))
print(len(ids),'curated players;',len(puzzles),'daily matchups')
