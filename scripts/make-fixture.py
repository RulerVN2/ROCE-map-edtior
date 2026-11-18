# Tạo file .schem thử nghiệm bằng thư viện độc lập (mcschematic) để kiểm tra bộ đọc schem.
import sys, mcschematic
out = sys.argv[1]
s = mcschematic.MCSchematic()
W, H, L = 5, 4, 7
for x in range(W):
    for z in range(L):
        s.setBlock((x, 0, z), "minecraft:oak_planks")
        for y in range(1, H):
            edge = x in (0, W - 1) or z in (0, L - 1)
            s.setBlock((x, y, z), "minecraft:cobblestone" if edge and y < H - 1 else ("minecraft:spruce_planks" if y == H - 1 else "minecraft:air"))
s.setBlock((2, 1, 0), "minecraft:air"); s.setBlock((2, 2, 0), "minecraft:air")           # cửa ở mặt bắc
s.setBlock((1, 1, 1), "minecraft:oak_stairs[facing=north,half=bottom,shape=straight,waterlogged=false]")
s.setBlock((3, 1, 1), "minecraft:oak_log[axis=x]")
s.setBlock((1, 1, 5), "minecraft:oak_fence[east=true,north=false,south=false,west=false,waterlogged=false]")
s.setBlock((2, 1, 5), "minecraft:oak_sign[rotation=4,waterlogged=false]")
s.setBlock((3, 1, 5), "minecraft:rail[shape=south_east,waterlogged=false]")
s.setBlock((3, 1, 3), 'minecraft:chest[facing=west,type=single,waterlogged=false]{Items:[{Slot:0b,id:"minecraft:arrow",Count:16b}]}')
s.save(out, "hut", mcschematic.Version.JE_1_20_1)
