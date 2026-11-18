# Đọc lại world đã xuất bằng thư viện độc lập (anvil-parser2, nbtlib) và so với dữ liệu trong Editor.
import sys, json, nbtlib, anvil
pr = json.load(open(sys.argv[1])); d = pr['dir']
D = nbtlib.load(d + '/level.dat')['Data']
print('level:', D['LevelName'], 'border', float(D['BorderSize']), 'spawn', int(D['SpawnX']), int(D['SpawnY']), int(D['SpawnZ']))
ok = True
for p in pr['probe']:
    x, z, h = p['x'], p['z'], p['h']
    c = anvil.Region.from_file(f"{d}/region/r.{x>>9}.{z>>9}.mca").get_chunk((x >> 4) & 31, (z >> 4) & 31)
    col = [c.get_block(x & 15, y, z & 15).id for y in range(h - 1, h + 5)]
    biome = str(c.get_biome(x & 15, 70, z & 15))
    wet = p['water'] > h
    good = col[1] != 'air' and (col[2] == 'water' if wet else col[2] in ('air', 'snow'))
    if wet: good &= c.get_block(x & 15, p['water'], z & 15).id == 'water' and c.get_block(x & 15, p['water'] + 1, z & 15).id == 'air'
    if p['mat'] == 8: good &= col[1] == 'cobblestone'
    if p['biome'] == 5: good &= 'snowy_plains' in biome and col[2] == 'snow'
    ok &= good
    print(p, col, biome, 'OK' if good else 'SAI')
import zlib, struct
def raw_chunk(x, z, folder='region'):
    # Đọc thô chunk để lấy block_entities / entities (anvil-parser không lộ ra các trường này).
    f = open(f"{d}/{folder}/r.{x>>9}.{z>>9}.mca", 'rb').read()
    i = ((x >> 4) & 31) + ((z >> 4) & 31) * 32
    loc = struct.unpack('>I', f[i*4:i*4+4])[0]; off = (loc >> 8) * 4096
    n = struct.unpack('>I', f[off:off+4])[0]
    import io
    return nbtlib.File.parse(io.BytesIO(zlib.decompress(f[off+5:off+4+n])))
for b in pr.get('blocks', []):
    x, y, z = b['x'], b['y'], b['z']
    c = anvil.Region.from_file(f"{d}/region/r.{x>>9}.{z>>9}.mca").get_chunk((x >> 4) & 31, (z >> 4) & 31)
    blk = c.get_block(x & 15, y, z & 15)
    good = blk.id == b['id'] and all(str(blk.properties.get(k)) == b[k] for k in ('facing', 'north') if k in b)
    if b.get('be'):
        bes = [e for e in raw_chunk(x, z)['block_entities'] if (int(e['x']), int(e['y']), int(e['z'])) == (x, y, z)]
        good &= len(bes) == 1 and str(bes[0]['id']) == 'minecraft:chest' and str(bes[0]['Items'][0]['id']) == b['be']
    ok &= good
    print(b, blk.id, dict(blk.properties), 'OK' if good else 'SAI')
if pr.get('spawn'):
    good = (int(D['SpawnX']), int(D['SpawnZ'])) == (pr['spawn']['x'], pr['spawn']['z'])
    ok &= good; print('spawn', pr['spawn'], 'OK' if good else 'SAI')
# Mob: đọc lại từ thư mục entities.
uuids = set()
for m in pr.get('mobs', []):
    cx, cz = int(m['x'] // 16), int(m['z'] // 16)
    root = raw_chunk(cx * 16, cz * 16, 'entities')
    ents = [e for e in root['Entities'] if str(e['id']) == m['id'] and abs(float(e['Pos'][0]) - m['x']) < 1e-6 and abs(float(e['Pos'][2]) - m['z']) < 1e-6]
    good = len(ents) == 1 and [int(v) for v in root['Position']] == [cx, cz]
    if good:
        e = ents[0]
        good &= abs(float(e['Rotation'][0]) - m['yaw']) < 1e-4
        good &= int(e.get('PersistenceRequired', 0)) == 1
        good &= (int(e.get('NoAI', 0)) == 1) == bool(m['noAI'])
        if not m['onStruct']: good &= abs(float(e['Pos'][1]) - m['y']) < 1e-6
        if 'e2e' in m['snbt']: good &= [str(t) for t in e['Tags']] == ['e2e'] and str(e['ArmorItems'][3]['id']) == 'minecraft:iron_helmet'
        if m['id'] == 'recruits:recruit': good &= [str(t) for t in e['Tags']] == ['doi1'] and abs(float(e['Health']) - 30.0) < 1e-6
        u = tuple(int(v) for v in e['UUID']); good &= len(u) == 4 and u not in uuids; uuids.add(u)
    ok &= good
    print('mob', m['id'], round(m['x'], 2), round(m['z'], 2), 'y', m['y'], 'OK' if good else 'SAI')
if pr.get('cave'):
    cv = pr['cave']; x, z = cv['x'], cv['z']
    c = anvil.Region.from_file(f"{d}/region/r.{x>>9}.{z>>9}.mca").get_chunk((x >> 4) & 31, (z >> 4) & 31)
    col = {y: c.get_block(x & 15, y, z & 15).id for y in range(cv['floor'] - 1, cv['h'] + 2)}
    # Sàn còn nguyên, trong khoang là không khí, và cửa hang khoét thông từ khoang lên tới mặt đất.
    good = col[cv['floor']] != 'air' and all(col[y] == 'air' for y in range(cv['floor'] + 1, cv['h'] + 1))
    ok &= good; print('hang', cv, 'OK' if good else 'SAI')
print('KHOP' if ok else 'SAI'); sys.exit(0 if ok else 1)
