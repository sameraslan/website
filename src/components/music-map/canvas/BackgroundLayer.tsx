"use client";

import { useMemo } from "react";
import * as THREE from "three";

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec2 vUv;
  uniform float u_zoomT;

  // Cheap value noise — good enough for paper grain
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
      u.y
    );
  }

  void main() {
    // Authored in sRGB; ShaderMaterial does not auto-apply the
    // linear->sRGB output conversion, so the literal hex values
    // are written straight to the framebuffer.
    vec3 paper = vec3(0.980, 0.965, 0.926);  // #faf6ec
    vec3 rule = vec3(0.882, 0.855, 0.792);   // #e1dac9
    float grain = noise(vUv * 600.0) * 0.04 - 0.02;
    vec3 col = paper + grain;

    // Faint hairline contours, only visible at far zoom
    float lines = sin(vUv.x * 80.0) * sin(vUv.y * 80.0);
    float contour = smoothstep(0.95, 1.0, lines) * (1.0 - u_zoomT) * 0.15;
    col = mix(col, rule, contour);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function BackgroundLayer({ zoomT }: { zoomT: number }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: { u_zoomT: { value: zoomT } },
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );
  material.uniforms.u_zoomT.value = zoomT;

  return (
    <mesh material={material} position={[0, 0, -10]} renderOrder={-1000}>
      <planeGeometry args={[20, 20]} />
    </mesh>
  );
}
