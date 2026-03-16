// p5 v2 compatible vertex shader (same pattern as gradients tool)
export const VERT_SHADER = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}
`

// Fragment shader ported verbatim from source
export const FRAG_SHADER = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D tex0;
uniform vec2 resolution;
uniform float blurAmount;
uniform float chromaticAb;
uniform float refractionStrength;
uniform float refractionScale;
uniform int refractionType;
uniform float pixelAmount;
uniform bool halftoneEnabled;
uniform int halftoneType;
uniform float halftoneSize;
uniform float halftoneAngle;
uniform float halftoneSoftness;
uniform float halftoneCoverage;
uniform bool crtEnabled;
uniform float crtScanlines;
uniform float crtCurvature;
uniform float crtVignette;
uniform float crtPhosphor;
uniform bool vhsEnabled;
uniform float vhsDistortion;
uniform float vhsTracking;
uniform float time;

#define PI 3.14159265359

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * noise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

vec2 applyRefraction(vec2 uv, float strength, float scale, int type) {
  vec2 center = vec2(0.5);
  vec2 dir = uv - center;
  float dist = length(dir);
  vec2 offset = vec2(0.0);

  if (type == 0) {
    float k = strength * 0.5;
    float r2 = dist * dist;
    float factor = 1.0 + k * r2;
    offset = dir * (factor - 1.0);
  }
  else if (type == 1) {
    float k = -strength * 0.5;
    float r2 = dist * dist;
    float factor = 1.0 + k * r2;
    offset = dir * (factor - 1.0);
  }
  else if (type == 2) {
    float wave1 = sin(uv.y * scale * 10.0 + uv.x * scale * 3.0) * 0.5 + 0.5;
    float wave2 = sin(uv.x * scale * 8.0 - uv.y * scale * 4.0) * 0.5 + 0.5;
    offset.x = (wave1 - 0.5) * strength * 0.03;
    offset.y = (wave2 - 0.5) * strength * 0.03;
  }
  else if (type == 3) {
    float n1 = fbm(uv * scale * 3.0, 4);
    float n2 = fbm(uv * scale * 3.0 + vec2(5.2, 1.3), 4);
    offset.x = (n1 - 0.5) * strength * 0.06;
    offset.y = (n2 - 0.5) * strength * 0.06;
  }
  else if (type == 4) {
    float ripple = sin(dist * scale * 30.0) * exp(-dist * 3.0);
    offset = normalize(dir + vec2(0.001)) * ripple * strength * 0.05;
  }
  else if (type == 5) {
    float n1 = fbm(uv * scale * 8.0, 3) - 0.5;
    float n2 = fbm(uv * scale * 8.0 + vec2(10.0), 3) - 0.5;
    float edgeFade = smoothstep(0.0, 0.3, dist) * smoothstep(0.7, 0.4, dist);
    offset.x = n1 * strength * 0.02 * (1.0 - edgeFade * 0.5);
    offset.y = n2 * strength * 0.02 * (1.0 - edgeFade * 0.5);
  }

  return uv + offset;
}

void main() {
  vec2 uv = vTexCoord;
  uv.y = 1.0 - uv.y;

  if (refractionStrength > 0.0) {
    uv = applyRefraction(uv, refractionStrength, refractionScale, refractionType);
  }

  vec4 color;

  if (chromaticAb > 0.0) {
    vec2 dir = uv - vec2(0.5);
    float offset = chromaticAb * 0.003;
    float r = texture2D(tex0, uv + dir * offset).r;
    float g = texture2D(tex0, uv).g;
    float b = texture2D(tex0, uv - dir * offset).b;
    float a = texture2D(tex0, uv).a;
    color = vec4(r, g, b, a);
  } else {
    color = texture2D(tex0, uv);
  }

  if (blurAmount > 0.0) {
    vec4 blurColor = vec4(0.0);
    float total = 0.0;
    float blurSize = blurAmount / resolution.x * 2.0;

    for (float x = -3.0; x <= 3.0; x += 1.0) {
      for (float y = -3.0; y <= 3.0; y += 1.0) {
        float weight = 1.0 - length(vec2(x, y)) / 4.5;
        if (weight > 0.0) {
          vec2 sampleOffset = vec2(x, y) * blurSize;
          if (chromaticAb > 0.0) {
            vec2 sampleUv = uv + sampleOffset;
            vec2 dir = sampleUv - vec2(0.5);
            float chromOffset = chromaticAb * 0.003;
            blurColor.r += texture2D(tex0, sampleUv + dir * chromOffset).r * weight;
            blurColor.g += texture2D(tex0, sampleUv).g * weight;
            blurColor.b += texture2D(tex0, sampleUv - dir * chromOffset).b * weight;
            blurColor.a += texture2D(tex0, sampleUv).a * weight;
          } else {
            blurColor += texture2D(tex0, uv + sampleOffset) * weight;
          }
          total += weight;
        }
      }
    }
    color = blurColor / total;
  }

  if (pixelAmount > 1.0) {
    vec2 pixelSize = vec2(pixelAmount) / resolution;
    vec2 pixelatedUV = floor(vTexCoord / pixelSize) * pixelSize + pixelSize * 0.5;
    pixelatedUV.y = 1.0 - pixelatedUV.y;

    if (refractionStrength > 0.0) {
      pixelatedUV = applyRefraction(pixelatedUV, refractionStrength, refractionScale, refractionType);
    }

    if (chromaticAb > 0.0) {
      vec2 dir = pixelatedUV - vec2(0.5);
      float offset = chromaticAb * 0.003;
      color.r = texture2D(tex0, pixelatedUV + dir * offset).r;
      color.g = texture2D(tex0, pixelatedUV).g;
      color.b = texture2D(tex0, pixelatedUV - dir * offset).b;
    } else {
      color = texture2D(tex0, pixelatedUV);
    }
  }

  if (halftoneEnabled) {
    vec3 originalColor = color.rgb;
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    float angleRad = halftoneAngle * PI / 180.0;
    float cosA = cos(angleRad);
    float sinA = sin(angleRad);
    vec2 centeredUV = vTexCoord - 0.5;
    vec2 rotatedUV = vec2(
      centeredUV.x * cosA - centeredUV.y * sinA,
      centeredUV.x * sinA + centeredUV.y * cosA
    ) + 0.5;

    vec2 pixelCoord = rotatedUV * resolution;
    vec2 gridPos = floor(pixelCoord / halftoneSize);
    vec2 cellUV = (pixelCoord - gridPos * halftoneSize) / halftoneSize;

    float pattern = 0.0;
    float softness = halftoneSoftness / 100.0 * 0.2 + 0.01;
    float coverage = halftoneCoverage / 100.0;

    float inkAmount = (1.0 - luminance) * (0.5 + coverage * 0.8);
    inkAmount = clamp(inkAmount, 0.0, 1.0);

    if (halftoneType == 0) {
      float dist = length(cellUV - 0.5);
      float radius = inkAmount * (0.5 + coverage * 0.3);
      pattern = 1.0 - smoothstep(radius - softness, radius + softness, dist);
    } else if (halftoneType == 1) {
      float linePos = abs(cellUV.y - 0.5);
      float lineWidth = inkAmount * (0.35 + coverage * 0.2);
      pattern = 1.0 - smoothstep(lineWidth - softness, lineWidth + softness, linePos);
    } else if (halftoneType == 2) {
      float line1 = abs(cellUV.y - 0.5);
      float line2 = abs(cellUV.x - 0.5);
      float lineWidth = inkAmount * (0.32 + coverage * 0.2);
      float p1 = 1.0 - smoothstep(lineWidth - softness, lineWidth + softness, line1);
      float p2 = 1.0 - smoothstep(lineWidth - softness, lineWidth + softness, line2);
      pattern = max(p1, p2);
    }

    vec3 paperColor = vec3(1.0);
    vec3 inkColor = originalColor * 0.9;
    color.rgb = mix(paperColor, inkColor, pattern);

    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, 1.3);
  }

  if (crtEnabled || vhsEnabled) {
    vec2 crtUV = vTexCoord;
    crtUV.y = 1.0 - crtUV.y;

    if (crtEnabled && crtCurvature > 0.0) {
      vec2 cc = crtUV - 0.5;
      float dist = dot(cc, cc) * crtCurvature * 0.5;
      crtUV = crtUV + cc * dist;
    }

    if (vhsEnabled && vhsDistortion > 0.0) {
      float distortAmount = vhsDistortion / 100.0;
      float wave = sin(crtUV.y * 15.0 + time * 3.0) * distortAmount * 0.02;
      wave += sin(crtUV.y * 40.0 + time * 7.0) * distortAmount * 0.01;
      crtUV.x += wave;
    }

    if (vhsEnabled && vhsTracking > 0.0) {
      float trackAmount = vhsTracking / 100.0;
      float band = floor(crtUV.y * 20.0 + time * 2.0);
      float bandNoise = fract(sin(band * 43.758) * 438.5453);
      if (bandNoise > 0.92) {
        crtUV.x += (bandNoise - 0.92) * trackAmount * 0.5;
      }
    }

    if (crtUV.x >= 0.0 && crtUV.x <= 1.0 && crtUV.y >= 0.0 && crtUV.y <= 1.0) {
      vec2 sampleUV = crtUV;
      sampleUV.y = 1.0 - sampleUV.y;

      if (refractionStrength > 0.0) {
        sampleUV = applyRefraction(sampleUV, refractionStrength, refractionScale, refractionType);
      }

      bool needsResample = (crtEnabled && crtCurvature > 0.0) ||
                           (vhsEnabled && (vhsDistortion > 0.0 || vhsTracking > 0.0));

      if (crtEnabled && crtPhosphor > 0.0) {
        float phosphorOffset = crtPhosphor / 100.0 * 0.003;
        if (chromaticAb > 0.0) {
          vec2 dir = sampleUV - vec2(0.5);
          float chromOffset = chromaticAb * 0.003;
          color.r = texture2D(tex0, sampleUV + vec2(phosphorOffset, 0.0) + dir * chromOffset).r;
          color.g = texture2D(tex0, sampleUV).g;
          color.b = texture2D(tex0, sampleUV - vec2(phosphorOffset, 0.0) - dir * chromOffset).b;
        } else {
          color.r = texture2D(tex0, sampleUV + vec2(phosphorOffset, 0.0)).r;
          color.g = texture2D(tex0, sampleUV).g;
          color.b = texture2D(tex0, sampleUV - vec2(phosphorOffset, 0.0)).b;
        }
      } else if (needsResample) {
        if (chromaticAb > 0.0) {
          vec2 dir = sampleUV - vec2(0.5);
          float offset = chromaticAb * 0.003;
          color.r = texture2D(tex0, sampleUV + dir * offset).r;
          color.g = texture2D(tex0, sampleUV).g;
          color.b = texture2D(tex0, sampleUV - dir * offset).b;
        } else {
          color = texture2D(tex0, sampleUV);
        }
      }

      if (crtEnabled && crtScanlines > 0.0) {
        float scanline = sin(crtUV.y * resolution.y * PI) * 0.5 + 0.5;
        scanline = pow(scanline, 1.5);
        float scanlineIntensity = crtScanlines / 100.0;
        color.rgb *= 1.0 - scanlineIntensity * (1.0 - scanline) * 0.5;
      }

      if (crtEnabled && crtVignette > 0.0) {
        vec2 vignetteUV = crtUV * 2.0 - 1.0;
        float vignette = 1.0 - dot(vignetteUV, vignetteUV) * crtVignette / 100.0 * 0.5;
        vignette = clamp(vignette, 0.0, 1.0);
        color.rgb *= vignette;
      }

      if (vhsEnabled && vhsDistortion > 0.0) {
        float noiseAmount = vhsDistortion / 100.0 * 0.1;
        float staticNoise = fract(sin(dot(crtUV + time, vec2(12.9898, 78.233))) * 43758.5453);
        color.rgb += (staticNoise - 0.5) * noiseAmount;
      }
    } else {
      color.rgb = vec3(0.0);
    }
  }

  gl_FragColor = color;
}
`
