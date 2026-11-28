"""Writes public/assets/scenery/village-jukebox.glb: a Minecraft jukebox block, one cube with the
game's own 16 px textures, sampled without smoothing.

    python3 tools/model-import/jukebox.py <jukebox_top.png> <jukebox_side.png>

The two textures are `assets/minecraft/textures/block/jukebox_{top,side}.png` of Minecraft: Java
Edition 1.21.4."""

import json
import struct
import sys
from pathlib import Path

SIZE = 1.5  # metres along each edge; a cell is 2.4 m wide
OUT = Path(__file__).resolve().parents[2] / "public/assets/scenery/village-jukebox.glb"


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def faces(normals_and_ups):
    """Four corners per face, the image upright as seen from outside."""
    positions, normals, uvs, indices = [], [], [], []
    half = SIZE / 2
    for normal, up in normals_and_ups:
        right = cross(up, normal)
        base = len(positions)
        for sr, su, u, v in ((-1, -1, 0, 1), (1, -1, 1, 1), (1, 1, 1, 0), (-1, 1, 0, 0)):
            positions.append(
                tuple((normal[i] + right[i] * sr + up[i] * su) * half + (half if i == 1 else 0) for i in range(3))
            )
            normals.append(normal)
            uvs.append((u, v))
        indices += [base, base + 1, base + 2, base, base + 2, base + 3]
    return positions, normals, uvs, indices


def main(top_png, side_png):
    up = (0, 1, 0)
    parts = [
        faces([((0, 1, 0), (0, 0, -1)), ((0, -1, 0), (0, 0, 1))]),
        faces([((1, 0, 0), up), ((-1, 0, 0), up), ((0, 0, 1), up), ((0, 0, -1), up)]),
    ]
    blob = bytearray()
    views, accessors, primitives = [], [], []

    def view(data, target=None):
        while len(blob) % 4:
            blob.append(0)
        entry = {"buffer": 0, "byteOffset": len(blob), "byteLength": len(data)}
        if target:
            entry["target"] = target
        blob.extend(data)
        views.append(entry)
        return len(views) - 1

    def accessor(values, kind, component, fmt, target, bounds=False):
        flat = [x for value in values for x in (value if isinstance(value, tuple) else (value,))]
        entry = {
            "bufferView": view(struct.pack(f"<{len(flat)}{fmt}", *flat), target),
            "componentType": component,
            "count": len(values),
            "type": kind,
        }
        if bounds:
            entry["min"] = [min(v[i] for v in values) for i in range(3)]
            entry["max"] = [max(v[i] for v in values) for i in range(3)]
        accessors.append(entry)
        return len(accessors) - 1

    for material, (positions, normals, uvs, indices) in enumerate(parts):
        primitives.append(
            {
                "attributes": {
                    "POSITION": accessor(positions, "VEC3", 5126, "f", 34962, True),
                    "NORMAL": accessor([tuple(map(float, n)) for n in normals], "VEC3", 5126, "f", 34962),
                    "TEXCOORD_0": accessor([tuple(map(float, uv)) for uv in uvs], "VEC2", 5126, "f", 34962),
                },
                "indices": accessor(indices, "SCALAR", 5123, "H", 34963),
                "material": material,
            }
        )
    images = [{"bufferView": view(Path(p).read_bytes()), "mimeType": "image/png"} for p in (top_png, side_png)]
    gltf = {
        "asset": {"version": "2.0", "generator": "tools/model-import/jukebox.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": "jukebox", "mesh": 0}],
        "meshes": [{"name": "jukebox", "primitives": primitives}],
        "materials": [
            {
                "name": name,
                "pbrMetallicRoughness": {
                    "baseColorTexture": {"index": index},
                    "metallicFactor": 0,
                    "roughnessFactor": 0.85,
                },
            }
            for index, name in enumerate(("jukebox-top", "jukebox-side"))
        ],
        "textures": [{"source": 0, "sampler": 0}, {"source": 1, "sampler": 0}],
        # Nearest on both sides: the pixels stay square.
        "samplers": [{"magFilter": 9728, "minFilter": 9728, "wrapS": 33071, "wrapT": 33071}],
        "images": images,
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": 0}],
    }
    while len(blob) % 4:
        blob.append(0)
    gltf["buffers"][0]["byteLength"] = len(blob)
    text = json.dumps(gltf, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    total = 12 + 8 + len(text) + 8 + len(blob)
    OUT.write_bytes(
        struct.pack("<4sII", b"glTF", 2, total)
        + struct.pack("<I4s", len(text), b"JSON")
        + text
        + struct.pack("<I4s", len(blob), b"BIN\0")
        + bytes(blob)
    )
    print(OUT, total, "bytes")


if __name__ == "__main__":
    main(*sys.argv[1:3])
