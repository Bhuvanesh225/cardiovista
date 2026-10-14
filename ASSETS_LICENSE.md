# ASSETS & LICENSING — CardioVista

## Anatomical mesh — `assets/heart_bp3d.glb`

| | |
|---|---|
| File | `assets/heart_bp3d.glb` |
| Size | 746,504 bytes (**0.71 MB**) |
| Triangles | 33,578 |
| Nodes | `myocardium`, `aorta`, `pulmonary_trunk`, `coronary_LAD`, `coronary_LCX`, `coronary_RCA` |
| SHA-256 | `47965791ff90e376021b40a8a9d43c7d7d9379c035f724336d51297aa67b653b` |
| Source | BodyParts3D (Database Center for Life Science, Japan) |
| License | **CC BY-SA 2.1 JP** |

**Required attribution (shown in-app and here):**
> Anatomical mesh: BodyParts3D (Database Center for Life Science), CC BY-SA 2.1 JP

The mesh is distributed under the share-alike terms of CC BY-SA 2.1 JP. Any redistribution of
a modified mesh must carry the same license. The NIH mirror of BodyParts3D was intentionally
**not** used, to keep a single, clear licence chain.

The SHA-256 above is pinned in `app/registry.json` (`mesh_sha`) and checked at API startup and
in `tests/test_vessel_map.py` (CI fails on drift).

## Dataset — UCI *Extension of Z-Alizadeh Sani*

| | |
|---|---|
| Repository | UCI Machine Learning Repository, dataset 411 |
| DOI | [10.24432/C5461K](https://doi.org/10.24432/C5461K) |
| License | **CC BY 4.0** |
| Citation | Alizadehsani, R., Roshanzamir, M., & Sani, Z. (2013). *extention of Z-Alizadeh sani dataset* [Dataset]. UCI Machine Learning Repository. |

Local copy committed at `data/raw/extention of Z-Alizadeh sani dataset.xlsx` (131 KB) for
offline reproduction; `ucimlrepo` can re-fetch it.

## Fallback illustration

`web/src/components/Fallback2D.tsx` is an original SVG derived from the same anatomical
mapping and carries the same CC BY-SA 2.1 JP attribution.

## Code license

MIT — see `LICENSE`.