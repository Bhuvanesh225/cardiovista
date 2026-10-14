# ASSETS & LICENSING — CardioVista

## Anatomical mesh — `assets/heart.glb`

| | |
|---|---|
| File | `assets/heart.glb` |
| Size | 292,372 bytes (**0.28 MB**) |
| Triangles | 10,805 |
| Coronary nodes | `Anterior interventricular artery` (LAD), `Diagonal coronary branch` (LCX territory), `Right marginal coronary artery` (RCA) |
| Anatomy nodes | `Heart ventricular and atrial myocardium`, `Ascending aorta and aortic arch`, `Pulmonary trunk`, venae cavae, pulmonary arteries/veins, aortic arch branches |
| SHA-256 | `8356a15d0b1f0a40a9dbcb83743ae9ffb62540b741f10c7bab3586ed60059bec` |
| Source | Innerscene 3D Parts Library ("Heart", adapted from MakeHuman/MPFB CC0 assets) |
| License | **CC0 1.0 Universal (public domain)** |

**Credit (voluntary, not legally required under CC0):**
> Anatomical mesh: Innerscene (adapted from MakeHuman CC0 assets), CC0 1.0

The mesh is dedicated to the public domain: it may be used, modified and
redistributed for any purpose, including commercially, with no attribution
requirement and no share-alike condition. The committed file is the upstream
`heart.glb` with its three 2048px PNG textures downscaled to 1024px JPEG
(geometry, node names and materials unchanged) to stay within the 3 MB web
budget; the SHA-256 above is pinned in `app/registry.json` (`mesh_sha`) and
checked in `tests/test_vessel_map.py`.
Original download: <https://www.innerscene.com/tools/library/3d-parts/heart-e9f72b0e>

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
mapping.

## Code license

MIT — see `LICENSE`.