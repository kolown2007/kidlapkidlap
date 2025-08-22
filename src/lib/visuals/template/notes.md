# Quick notes: UV, Normal, Tangent

These are the three most important per-vertex/per-pixel attributes for texturing and lighting.

## UV (texture coordinates)
- What: 2D coordinates (vec2) that map a 2D image onto a 3D surface.
- Range: usually [0,1] across the surface; (0,0) = one corner, (1,1) = opposite.
- Use:
  - Sample textures in fragment shader: `color = texture2D(uSampler, vUV);`
  - Tiling: `fract(vUV * scale)`; scrolling: `vUV += vec2(speed*time,0)`.
- Gotchas:
  - If a mesh has no UVs, texture sampling will be invalid.
  - Seams at u=0/1 can appear if the texture is not tileable.
- Babylon tip: many MeshBuilder helpers provide UVs (Plane, Box, Sphere).

## Normal (surface normal)
- What: a per-vertex vector (vec3) describing the surface orientation at that vertex.
- Purpose:
  - Lighting (Lambert, Blinn-Phong, PBR) uses normals to compute how light hits the surface.
  - If you displace vertices in the vertex shader, normals must be adjusted for correct lighting.
- Recompute in shader (simple approach):
  - If you have parametric positions, compute analytical normal.
  - Or approximate by using derivatives in the fragment shader (GLSL `dFdx/dFdy`) when available.
- Example (GLSL fragment, perturb normal):
  ```glsl
  vec3 n = normalize(vNormal);
  // if displaced in vertex shader, recompute or use normal map
  ```

## Tangent (and bitangent)
- What: a per-vertex vec3 (or vec4 with sign) that, together with the normal, forms a tangent space basis used for normal mapping.
- Why needed:
  - Normal maps are stored in texture space (tangent space); to convert to world/view space you need tangent+bitangent+normal.
- Typical storage: tangent is a vec4 where w stores handedness (sign) to reconstruct bitangent.
- GLSL usage (reconstruct TBN):
  ```glsl
  vec3 T = normalize(vTangent.xyz);
  vec3 N = normalize(vNormal);
  vec3 B = cross(N, T) * vTangent.w;
  mat3 TBN = mat3(T, B, N);
  vec3 mappedNormal = texture(normalMap, vUV).xyz * 2.0 - 1.0;
  vec3 worldNormal = normalize(TBN * mappedNormal);
  ```

## Practical rules & tips
- Vertex vs fragment:
  - Vertex shader transforms position + normals (coarse); fragment shader runs per-pixel (fine detail).
  - For silhouette changes use vertex displacement. For surface detail use normal maps in the fragment shader.
- When displacing vertices:
  - Recompute normals or provide a normal map; otherwise lighting looks wrong.
  - Ensure the mesh has sufficient vertex density for smooth displacement.
- For GLB/skinned models:
  - Skinning alters vertex positions; either use engine skinning or implement skinning in your shader.
  - Tangents are often provided in GLB for normal mapping; check the importer/exporter settings.
- Debugging:
  - Show UVs visually with a checkerboard texture to verify seams and stretching.
  - Visualize normals by encoding them into color: `gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);`
  - Verify tangents: render the tangent vector similarly if needed.

## Quick Babylon notes
- Access attributes:
  - `attributes: ['position','normal','uv','tangent']` when creating ShaderMaterial.
- Set textures/uniforms:
  ```ts
  mat.setTexture('uAlbedo', new Texture('/textures/albedo.png', scene));
  mat.setFloat('iTime', performance.now()*0.001);
  mat.setVector2('iResolution', new Vector2(engine.getRenderWidth(), engine.getRenderHeight()));
  ```
- If a mesh lacks tangents and you need normal mapping, generate tangents (`VertexData.GenerateNormals` / exporter option) on export.

---

Keep this file next to your visual templates so it's easy to copy examples into new shaders.
```// filepath: c:\Users\Barry\Documents\netart\kidlapkidlap\src\lib\visuals\notes.md
# Quick notes: UV, Normal, Tangent

These are the three most important per-vertex/per-pixel attributes for texturing and lighting.

## UV (texture coordinates)
- What: 2D coordinates (vec2) that map a 2D image onto a 3D surface.
- Range: usually [0,1] across the surface; (0,0) = one corner, (1,1) = opposite.
- Use:
  - Sample textures in fragment shader: `color = texture2D(uSampler, vUV);`
  - Tiling: `fract(vUV * scale)`; scrolling: `vUV += vec2(speed*time,0)`.
- Gotchas:
  - If a mesh has no UVs, texture sampling will be invalid.
  - Seams at u=0/1 can appear if the texture is not tileable.
- Babylon tip: many MeshBuilder helpers provide UVs (Plane, Box, Sphere).

## Normal (surface normal)
- What: a per-vertex vector (vec3) describing the surface orientation at that vertex.
- Purpose:
  - Lighting (Lambert, Blinn-Phong, PBR) uses normals to compute how light hits the surface.
  - If you displace vertices in the vertex shader, normals must be adjusted for correct lighting.
- Recompute in shader (simple approach):
  - If you have parametric positions, compute analytical normal.
  - Or approximate by using derivatives in the fragment shader (GLSL `dFdx/dFdy`) when available.
- Example (GLSL fragment, perturb normal):
  ```glsl
  vec3 n = normalize(vNormal);
  // if displaced in vertex shader, recompute or use normal map
  ```

## Tangent (and bitangent)
- What: a per-vertex vec3 (or vec4 with sign) that, together with the normal, forms a tangent space basis used for normal mapping.
- Why needed:
  - Normal maps are stored in texture space (tangent space); to convert to world/view space you need tangent+bitangent+normal.
- Typical storage: tangent is a vec4 where w stores handedness (sign) to reconstruct bitangent.
- GLSL usage (reconstruct TBN):
  ```glsl
  vec3 T = normalize(vTangent.xyz);
  vec3 N = normalize(vNormal);
  vec3 B = cross(N, T) * vTangent.w;
  mat3 TBN = mat3(T, B, N);
  vec3 mappedNormal = texture(normalMap, vUV).xyz * 2.0 - 1.0;
  vec3 worldNormal = normalize(TBN * mappedNormal);
  ```

## Practical rules & tips
- Vertex vs fragment:
  - Vertex shader transforms position + normals (coarse); fragment shader runs per-pixel (fine detail).
  - For silhouette changes use vertex displacement. For surface detail use normal maps in the fragment shader.
- When displacing vertices:
  - Recompute normals or provide a normal map; otherwise lighting looks wrong.
  - Ensure the mesh has sufficient vertex density for smooth displacement.
- For GLB/skinned models:
  - Skinning alters vertex positions; either use engine skinning or implement skinning in your shader.
  - Tangents are often provided in GLB for normal mapping; check the importer/exporter settings.
- Debugging:
  - Show UVs visually with a checkerboard texture to verify seams and stretching.
  - Visualize normals by encoding them into color: `gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);`
  - Verify tangents: render the tangent vector similarly if needed.

## Quick Babylon notes
- Access attributes:
  - `attributes: ['position','normal','uv','tangent']` when creating ShaderMaterial.
- Set textures/uniforms:
  ```ts
  mat.setTexture('uAlbedo', new Texture('/textures/albedo.png', scene));
  mat.setFloat('iTime', performance.now()*0.001);
  mat.setVector2('iResolution', new Vector2(engine.getRenderWidth(), engine.getRenderHeight()));
  ```
- If a mesh lacks tangents and you need normal mapping, generate tangents (`VertexData.GenerateNormals` / exporter option) on export.

---

Keep this file next to your visual templates so it's easy