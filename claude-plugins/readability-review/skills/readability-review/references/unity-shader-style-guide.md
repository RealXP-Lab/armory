# Unity Shader Style Guide

## Naming conventions

- **\_PascalCase**: Shader property names and global uniform variables (e.g. `_BaseColor`, `_MainTex`).
- **PascalCase**: Struct names, functions, entry points, and pass names (e.g. `VertexInput`, `MainFragment`, `ForwardLit`).
  - Preserve conventional casing for standard abbreviations (UV, GI, XY, LOD, etc.): `UVScale`, `XYPosition`, `LODLevel`.
- **camelCase**: Local variables and function parameters (e.g. `worldPos`, `viewDir`).
- **ALL_CAPS_WITH_UNDERSCORES**: Macros and `#define` identifiers (e.g. `MAX_LIGHT_COUNT`, `USE_FOG`).
- **Semantic suffixes**: Align HLSL semantics (`SV_Position`, `TEXCOORD0`, `SV_Target`) in struct definitions.

## Whitespace and punctuation

- Indent with 2 spaces. Do not use tabs.
- Limit vertical gaps to one blank line.
- Place opening braces on their own line, aligned with the declaration.
- Limit lines to 100 characters.
- Write one statement per line and one assignment per statement.
- Place spaces around binary operators and after commas (`a + b`, `Sample(tex, uv)`).
- Do not place spaces inside parentheses or brackets (`foo(x)`, `tex[i]`).
- Use `//` for all comments. Reserve `/* ... */` for temporarily commenting out code during development. Do not leave commented-out code in a file long term—rely on source control to preserve code that may be needed later.

## Organization

- One shader per file. File name must match its `Shader "Namespace/Name"` declaration.
- File layout (in order):
  1. Header comment (shader name, author, date, dependencies)
  2. `Shader { ... }` block with `Properties { ... }`
  3. `SubShader { Pass { HLSLPROGRAM ... ENDHLSL } }`
  4. `#pragma` directives at top of `HLSLPROGRAM`
  5. `#include` directives immediately after pragmas
  6. Cbuffer / uniform-block definitions
  7. Texture and sampler declarations
  8. Macro definitions (`#define`, enums)
  9. Struct definitions (vertex inputs/outputs)
  10. Helper functions
  11. Entry functions (`Vert`, `Frag`, etc.)

## SRP Batcher compatibility

All URP shaders must be compatible with the SRP Batcher:

- Declare all material properties (except textures and samplers) inside a single `CBUFFER_START(UnityPerMaterial)` / `CBUFFER_END` block. The name must be exactly `UnityPerMaterial`—any other name breaks SRP Batcher compatibility.
- Declare textures and samplers outside the cbuffer using the `TEXTURE2D()` and `SAMPLER()` macros.
- Keep the `UnityPerMaterial` block identical across all passes. For multi-pass shaders, define the cbuffer in an `HLSLINCLUDE` block at the SubShader scope.
- Do not use `MaterialPropertyBlock` at runtime—it disables SRP Batching for that renderer.
- Include `"RenderPipeline" = "UniversalPipeline"` in SubShader tags.

## Shader keywords

- Use `#pragma shader_feature` for per-material keywords (e.g. `_EMISSION`, `_NORMALMAP`). Unused variants are stripped from builds.
- Use `#pragma multi_compile` for global keywords or keywords that must always be included (e.g. `_MAIN_LIGHT_SHADOWS`, `FOG_LINEAR`). All variants ship in builds.
- Prefix local (per-material) keywords with an underscore: `_EMISSION`, `_DETAIL_ON`.
- Do not prefix global keywords: `FOG_LINEAR`, `SHADOWS_SOFT`.
- Name all keywords in `ALL_CAPS_WITH_UNDERSCORES`.
- Minimize variant counts. Each `multi_compile` line multiplies the total, directly impacting build times and memory.

## Performance considerations

- Move heavy math to the vertex stage when possible.
- Pack uniforms by update frequency into cbuffers to reduce memory traffic.
- Minimize varyings (interpolators) passed between stages.
- Avoid dynamic loops in fragment shaders. Unroll small, fixed-count loops.
- Branch sparingly. Prefer lerp-based conditionals for coherence.
