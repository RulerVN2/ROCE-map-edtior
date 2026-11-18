# Tạo một file jar giả có cấu trúc giống Minecraft 1.20.1 (chỉ gồm vài file structure tự bịa)
# bằng thư viện độc lập (nbtlib, zipfile) để kiểm tra phần nhập công trình làng.
import sys, io, gzip, zipfile, nbtlib
from nbtlib import Compound, List, Int, String, Byte

def structure(size, palette, blocks):
    root = Compound({
        'DataVersion': Int(3465),
        'size': List[Int]([Int(v) for v in size]),
        'palette': List[Compound]([Compound({'Name': String(n), **({'Properties': Compound({k: String(v) for k, v in p.items()})} if p else {})}) for n, p in palette]),
        'blocks': List[Compound]([Compound({'pos': List[Int]([Int(v) for v in pos]), 'state': Int(st), **({'nbt': nbt} if nbt else {})}) for pos, st, nbt in blocks]),
        'entities': List[Compound]([]),
    })
    buf = io.BytesIO(); nbtlib.File(root).write(buf); return gzip.compress(buf.getvalue())   # file structure của game luôn nén gzip

pal = [('minecraft:oak_planks', None), ('minecraft:air', None), ('minecraft:oak_stairs', {'facing': 'north', 'half': 'bottom', 'shape': 'straight', 'waterlogged': 'false'}),
       ('minecraft:chest', {'facing': 'west', 'type': 'single', 'waterlogged': 'false'}), ('minecraft:jigsaw', {'orientation': 'north_up'})]
blocks = []
for x in range(3):
    for z in range(4):
        blocks.append(((x, 0, z), 0, None))
        if (x, z) != (1, 1): blocks.append(((x, 1, z), 1, None))   # (1,1,1) cố ý bỏ trống -> structure_void
blocks.append(((0, 1, 0), 2, None))
blocks.append(((2, 1, 3), 3, Compound({'id': String('minecraft:chest'), 'Items': List[Compound]([Compound({'Slot': Byte(0), 'id': String('minecraft:bread'), 'Count': Byte(3)})])})))
blocks.append(((1, 0, 0), 4, Compound({'id': String('minecraft:jigsaw'), 'final_state': String('minecraft:cobblestone'), 'joint': String('aligned'), 'name': String('minecraft:bottom'), 'pool': String('minecraft:empty'), 'target': String('minecraft:building_entrance')})))
house = structure((3, 2, 4), pal, blocks)
lamp = structure((1, 3, 1), [('minecraft:oak_fence', {'east': 'false', 'north': 'false', 'south': 'false', 'west': 'false', 'waterlogged': 'false'}), ('minecraft:torch', None)],
                 [((0, 0, 0), 0, None), ((0, 1, 0), 0, None), ((0, 2, 0), 1, None)])
with zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_DEFLATED) as z:
    base = 'data/minecraft/structures/village/'
    z.writestr(base + 'plains/houses/plains_small_house_1.nbt', house)
    z.writestr(base + 'plains/town_centers/plains_meeting_point_1.nbt', house)
    z.writestr(base + 'plains/plains_lamp_1.nbt', lamp)
    z.writestr(base + 'desert/houses/desert_small_house_1.nbt', house)
    z.writestr(base + 'plains/streets/straight_01.nbt', house)             # phải bị bỏ qua
    z.writestr(base + 'plains/zombie/houses/plains_small_house_1.nbt', house)  # phải bị bỏ qua
    z.writestr(base + 'common/animals/cows_1.nbt', house)                  # phải bị bỏ qua
    z.writestr('assets/minecraft/lang/en_us.json', '{}')
    # Texture giả (ảnh 16 x 16 nhiễu theo tên khối) cùng blockstate/model đúng cấu trúc game, để thử phần vẽ texture.
    import json, subprocess, hashlib
    from PIL import Image
    names = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import {BLOCK_PALETTE} from './src/core/terrain.js';import {parseSchem} from './src/core/schem.js';import {PROP_CATALOG,propBlocks} from './src/core/props.js';import fs from 'node:fs';"
        "const n=new Set(BLOCK_PALETTE.map(b=>b.Name));for(const p of parseSchem(fs.readFileSync('test/fixtures/hut.schem')).palette)n.add(p.split('[')[0]);for(const d of PROP_CATALOG)for(const b of propBlocks({k:d.key,s:1,sc:1}))n.add(b[3].split('[')[0]);console.log(JSON.stringify([...n]))"]))
    def png(name, tint=None):
        h = hashlib.md5(name.encode()).digest(); base = tint or (80 + h[0] % 150, 80 + h[1] % 150, 80 + h[2] % 150)
        im = Image.new('RGBA', (16, 16))
        for y in range(16):
            for x in range(16):
                v = (h[(x * 7 + y * 13) % 16] % 40) - 20 + (30 if (x + y) % 8 == 0 else 0)
                im.putpixel((x, y), tuple(max(0, min(255, c + v)) for c in base) + (255,))
        b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()
    def block(n, textures, parent='minecraft:block/cube'):
        z.writestr(f'assets/minecraft/blockstates/{n}.json', json.dumps({'variants': {'': {'model': f'minecraft:block/{n}'}}}))
        z.writestr(f'assets/minecraft/models/block/{n}.json', json.dumps({'parent': parent, 'textures': textures}))
    for full in names:
        n = full.split(':')[1]
        if n in ('air',): continue
        if n == 'grass_block':
            block(n, {'bottom': 'minecraft:block/dirt', 'top': 'minecraft:block/grass_block_top', 'side': 'minecraft:block/grass_block_side', 'particle': 'minecraft:block/dirt'}, 'minecraft:block/cube_bottom_top')
            z.writestr('assets/minecraft/textures/block/grass_block_top.png', png('gray', (150, 150, 150)))
            z.writestr('assets/minecraft/textures/block/grass_block_side.png', png('grass_side', (110, 90, 60)))
        elif n.endswith('_log'):
            block(n, {'end': f'minecraft:block/{n}_top', 'side': f'minecraft:block/{n}'}, 'minecraft:block/cube_column')
            z.writestr(f'assets/minecraft/textures/block/{n}_top.png', png(n + 'top', (170, 140, 90)))
            z.writestr(f'assets/minecraft/textures/block/{n}.png', png(n, (100, 75, 45)))
        elif n.endswith('_stairs') or n.endswith('_fence') or n.endswith('_sign'):
            base = n.rsplit('_', 1)[0] + '_planks'
            block(n, {'texture': f'minecraft:block/{base}', 'particle': f'minecraft:block/{base}'}, 'minecraft:block/stairs')
            if f'assets/minecraft/textures/block/{base}.png' not in z.namelist(): z.writestr(f'assets/minecraft/textures/block/{base}.png', png(base))
        else:
            block(n, {'all': f'minecraft:block/{n}'}, 'minecraft:block/cube_all')
            z.writestr(f'assets/minecraft/textures/block/{n}.png', png(n))
    for tn in ('water_still', 'lava_still'):
        if f'assets/minecraft/textures/block/{tn}.png' not in z.namelist(): z.writestr(f'assets/minecraft/textures/block/{tn}.png', png(tn, (60, 110, 220) if 'water' in tn else (230, 110, 30)))
    def skin(name, w=64, h=64):
        hh = hashlib.md5(name.encode()).digest(); im = Image.new('RGBA', (w, h))
        for y in range(h):
            for x in range(w):
                im.putpixel((x, y), (60 + hh[(x // 4 + y // 4) % 16] % 180, 60 + hh[(x // 3 + y // 5) % 16] % 180, 60 + hh[(x // 5 + y // 3) % 16] % 180, 255))
        b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()
    for ent, hgt in (('zombie/zombie', 64), ('zombie/husk', 64), ('skeleton/skeleton', 32), ('creeper/creeper', 32), ('pig/pig', 32), ('cow/cow', 32), ('sheep/sheep', 32), ('sheep/sheep_fur', 32), ('chicken', 32), ('villager/villager', 64), ('illager/pillager', 64), ('illager/vindicator', 64), ('illager/evoker', 64)):
        z.writestr(f'assets/minecraft/textures/entity/{ent}.png', skin(ent, 64, hgt))
    for ent, w, hgt in (('spider/spider', 64, 32), ('wolf/wolf', 64, 32), ('iron_golem/iron_golem', 128, 128), ('horse/horse_brown', 64, 64)):
        z.writestr(f'assets/minecraft/textures/entity/{ent}.png', skin(ent, w, hgt))
    for ent, w, hgt in (('enderman/enderman', 64, 32), ('witch', 64, 128), ('minecart', 64, 32), ('boat/oak', 128, 64), ('horse/armor/horse_armor_iron', 64, 64), ('armorstand/wood', 64, 64), ('illager/ravager', 128, 128)):
        z.writestr(f'assets/minecraft/textures/entity/{ent}.png', skin(ent, w, hgt))
    for it in ('crossbow_standby', 'iron_sword', 'iron_axe', 'bow', 'diamond_sword'):
        z.writestr(f'assets/minecraft/textures/item/{it}.png', skin(it, 16, 16))
    for mat in ('chainmail', 'iron', 'gold', 'diamond', 'netherite'):
        for n in (1, 2): z.writestr(f'assets/minecraft/textures/models/armor/{mat}_layer_{n}.png', skin(f'{mat}{n}', 64, 32))
    with z.open(zipfile.ZipInfo('version.json'), 'w') as f: f.write(b'{"id":"1.20.1"}')   # mục không nén
