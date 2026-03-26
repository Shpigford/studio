export const VERT_SHADER = `#version 300 es
out vec2 vUV;
void main() {
  float x = float((gl_VertexID & 1) << 2);
  float y = float((gl_VertexID >> 1 & 1) << 2);
  vUV = vec2(x * 0.5, y * 0.5);
  gl_Position = vec4(x - 1.0, y - 1.0, 0.0, 1.0);
}
`

export const FRAG_SHADER = `#version 300 es
precision highp float;

#define NUM_OCTAVES 4

in vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform vec2 uResolution;
uniform sampler2D uNoiseTex;

uniform vec3 uColorMain;
uniform vec3 uColorLow;
uniform vec3 uColorMid;
uniform vec3 uColorHigh;

uniform float uNoiseScale;
uniform float uWindSpeed;
uniform float uWarpPower;
uniform float uFbmStrength;
uniform float uFbmDamping;
uniform float uWatercolorDetail;
uniform float uWatercolorWarp;
uniform float uBlurRadius;
uniform float uGrain;
uniform float uVeinIntensity;
uniform float uVeinScale;
uniform vec3 uVeinColor;

vec3 blendLinearBurn(vec3 base, vec3 blend, float opacity) {
  return max(base + blend - vec3(1.0), vec3(0.0)) * opacity + base * (1.0 - opacity);
}

vec4 permute(vec4 x) { return mod((x * 34.0 + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

float rand(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 ip = floor(p);
  vec2 u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  float res = mix(
    mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
    mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x),
    u.y
  );
  return res * res;
}

float fbm(vec2 x) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < NUM_OCTAVES; ++i) {
    v += a * noise(x);
    x = rot * x * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

float cnoise(vec3 P) {
  vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod(Pi0, 289.0); Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = vec4(Pi0.z); vec4 iz1 = vec4(Pi1.z);
  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0); vec4 ixy1 = permute(ixy + iz1);
  vec4 gx0 = ixy0 / 7.0; vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(vec4(0.0), gx0) - 0.5);
  gy0 -= sz0 * (step(vec4(0.0), gy0) - 0.5);
  vec4 gx1 = ixy1 / 7.0; vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(vec4(0.0), gx1) - 0.5);
  gy1 -= sz1 * (step(vec4(0.0), gy1) - 0.5);
  vec3 g000 = vec3(gx0.x, gy0.x, gz0.x); vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
  vec3 g010 = vec3(gx0.z, gy0.z, gz0.z); vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
  vec3 g001 = vec3(gx1.x, gy1.x, gz1.x); vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
  vec3 g011 = vec3(gx1.z, gy1.z, gz1.z); vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);
  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
  float n000 = dot(g000, Pf0); float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z)); float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z)); float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz)); float n111 = dot(g111, Pf1);
  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

void main() {
  vec2 uv = vUV;
  float time = uTime;

  // Perlin warp displacement
  float noiseX = cnoise(vec3(uv * 1.0 + vec2(0.0, 74.8572), time * 0.3));
  float noiseY = cnoise(vec3(uv * 1.0 + vec2(203.91282, 10.0), time * 0.3));
  uv += vec2(noiseX * 2.0, noiseY) * uWarpPower;

  // Watercolor noise displacement
  float noiseA = cnoise(vec3(uv * uWatercolorDetail + vec2(344.91282, 0.0), time * 0.3))
               + cnoise(vec3(uv * uWatercolorDetail * 2.2 + vec2(723.937, 0.0), time * 0.4)) * 0.5;
  uv += noiseA * uWatercolorWarp;

  // Texture noise displacement
  vec2 textureUv = uv;
  float texR0 = texture(uNoiseTex, textureUv).r;
  float texG0 = texture(uNoiseTex, vec2(textureUv.x, 1.0 - textureUv.y)).g;
  float texDisp0 = mix(texR0 - 0.5, texG0 - 0.5, (sin(time) + 1.0) * 0.5) * 0.15;

  vec2 texUv1 = textureUv + vec2(63.861, 368.937);
  float texR1 = texture(uNoiseTex, texUv1).r;
  float texG1 = texture(uNoiseTex, vec2(texUv1.x, 1.0 - texUv1.y)).g;
  float texDisp1 = mix(texR1 - 0.5, texG1 - 0.5, (sin(time) + 1.0) * 0.5) * 0.15;

  vec2 texUv3 = textureUv + vec2(453.163, 1648.808);
  float texR3 = texture(uNoiseTex, texUv3).r;
  float texG3 = texture(uNoiseTex, vec2(texUv3.x, 1.0 - texUv3.y)).g;
  float texDisp3 = mix(texR3 - 0.5, texG3 - 0.5, (sin(time) + 1.0) * 0.5) * 0.15;

  uv += texDisp0;

  // FBM domain warping
  vec2 st_fbm = uv * uNoiseScale;
  vec2 q = vec2(0.0);
  q.x = fbm(st_fbm * 0.5 + uWindSpeed * time);
  q.y = fbm(st_fbm * 0.5 + uWindSpeed * time);
  vec2 r = vec2(0.0);
  r.x = fbm(st_fbm + 1.0 * q + vec2(0.3, 9.2) + 0.15 * time);
  r.y = fbm(st_fbm + 1.0 * q + vec2(8.3, 0.8) + 0.126 * time);
  float f = fbm(st_fbm + r - q);
  float fullFbm = (f + 0.6 * f * f + 0.7 * f + 0.5) * 0.5;
  fullFbm = pow(fullFbm, uFbmDamping);
  fullFbm *= uFbmStrength;

  float blur = uBlurRadius * 1.5;

  // Layer 1
  vec2 snUv = (uv + vec2((fullFbm - 0.5) * 1.2) + vec2(0.0, 0.025) + texDisp0);
  float sn = noise(snUv * 2.0 + vec2(0.0, time * 0.5)) * 2.0 * 1.5;
  float sn2 = smoothstep(sn - 1.2 * blur, sn + 1.2 * blur, (snUv.y - 0.5) * 5.0 + 0.5);

  // Layer 2
  vec2 snUvB = (uv + vec2((fullFbm - 0.5) * 0.85) + vec2(0.0, 0.025) + texDisp1);
  float snB = noise(snUvB * 4.0 + vec2(293.0, time * 1.0)) * 2.0 * 1.4;
  float sn2B = smoothstep(snB - 0.9 * blur, snB + 0.9 * blur, (snUvB.y - 0.6) * 5.0 + 0.5);

  // Layer 3
  vec2 snUvC = (uv + vec2((fullFbm - 0.5) * 1.1) + texDisp3);
  float snC = noise(snUvC * 6.0 + vec2(153.0, time * 1.2)) * 2.0 * 1.3;
  float sn2C = smoothstep(snC - 0.7 * blur, snC + 0.7 * blur, (snUvC.y - 0.9) * 6.0 + 0.5);

  sn2 = pow(sn2, 0.8);
  sn2B = pow(sn2B, 0.9);

  // Color blending
  vec3 color = blendLinearBurn(uColorMain, uColorLow, 1.0 - sn2);
  color = blendLinearBurn(color, mix(uColorMain, uColorMid, 1.0 - sn2B), sn2);
  color = mix(color, mix(uColorMain, uColorHigh, 1.0 - sn2C), sn2 * sn2B);

  // Veins — ridged noise creates sharp crease-like lines
  if (uVeinIntensity > 0.0) {
    float vn1 = abs(cnoise(vec3(uv * uVeinScale, time * 0.1)));
    float vn2 = abs(cnoise(vec3(uv * uVeinScale * 2.3 + vec2(83.2, 41.7), time * 0.08))) * 0.5;
    float vein = 1.0 - smoothstep(0.0, 0.08, vn1 + vn2 * 0.5);
    color = mix(color, uVeinColor, vein * uVeinIntensity);
  }

  // Grain overlay — offset by time so grain animates with the marble
  float grain = (texture(uNoiseTex, gl_FragCoord.xy / 256.0 + time * 7.3).r - 0.5) * uGrain;
  color += grain;

  fragColor = vec4(color, 1.0);
}
`
