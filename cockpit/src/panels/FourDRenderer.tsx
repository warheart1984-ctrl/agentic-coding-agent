import { useRef, useEffect, useState } from "react";
import "./FourDRenderer.css";

interface Vertex4D {
  x: number;
  y: number;
  z: number;
  w: number;
}

interface Edge {
  a: number;
  b: number;
}

interface ProjectedVertex {
  x: number;
  y: number;
  z: number;
  w: number;
}

const D4 = 4.0;
const D3 = 4.0;
const SCALE = 100;

function makeVertices4D(): Vertex4D[] {
  const verts: Vertex4D[] = [];
  for (let x of [-1, 1])
    for (let y of [-1, 1])
      for (let z of [-1, 1])
        for (let w of [-1, 1])
          verts.push({ x, y, z, w });
  return verts;
}

function makeEdges(verts: Vertex4D[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      let diff = 0;
      if (verts[i].x !== verts[j].x) diff++;
      if (verts[i].y !== verts[j].y) diff++;
      if (verts[i].z !== verts[j].z) diff++;
      if (verts[i].w !== verts[j].w) diff++;
      if (diff === 1) edges.push({ a: i, b: j });
    }
  }
  return edges;
}

function rotateXW(p: Vertex4D, theta: number): Vertex4D {
  const c = Math.cos(theta), s = Math.sin(theta);
  return {
    x: c * p.x - s * p.w,
    y: p.y,
    z: p.z,
    w: s * p.x + c * p.w,
  };
}

function rotateYZ(p: Vertex4D, theta: number): Vertex4D {
  const c = Math.cos(theta), s = Math.sin(theta);
  return {
    x: p.x,
    y: c * p.y - s * p.z,
    z: s * p.y + c * p.z,
    w: p.w,
  };
}

function rotateZW(p: Vertex4D, theta: number): Vertex4D {
  const c = Math.cos(theta), s = Math.sin(theta);
  return {
    x: p.x,
    y: p.y,
    z: c * p.z - s * p.w,
    w: s * p.z + c * p.w,
  };
}

function rotateYW(p: Vertex4D, theta: number): Vertex4D {
  const c = Math.cos(theta), s = Math.sin(theta);
  return {
    x: p.x,
    y: c * p.y - s * p.w,
    z: p.z,
    w: s * p.y + c * p.w,
  };
}

function rotate4D(p: Vertex4D, t: number): Vertex4D {
  const a = t * 0.7;
  const b = t * 1.1;
  const c = t * 1.5;
  const d = t * 2.0;
  let r = rotateXW(p, a);
  r = rotateYZ(r, b);
  r = rotateZW(r, c);
  r = rotateYW(r, d);
  return r;
}

function project4Dto3D(p: Vertex4D): { x: number; y: number; z: number; w: number } {
  const k = D4 / (D4 - p.w);
  return { x: k * p.x, y: k * p.y, z: k * p.z, w: p.w };
}

function project3Dto2D(p: { x: number; y: number; z: number }, width: number, height: number) {
  const k = D3 / (D3 - p.z);
  return {
    X: width / 2 + k * p.x * SCALE,
    Y: height / 2 - k * p.y * SCALE,
    depth: p.z,
  };
}

function depthColor(w: number): string {
  const depth = (w + 1) / 2;
  const r = Math.round(50 + 205 * depth);
  const b = Math.round(255 - 205 * depth);
  const a = 0.2 + 0.8 * depth;
  return `rgba(${r}, 100, ${b}, ${a})`;
}

export function FourDRenderer({ 
  governanceMode = "idle",
  driftScore = 0,
  evidenceConfidence = 1,
  intentIntensity = 1,
}: {
  governanceMode?: "idle" | "validating" | "executing" | "violation";
  driftScore?: number;
  evidenceConfidence?: number;
  intentIntensity?: number;
} = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(0);
  const vertices4D = useRef(makeVertices4D());
  const edges = useRef(makeEdges(vertices4D.current));

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const maybeCtx = canvasEl.getContext("2d");
    if (!maybeCtx) return;
    const ctx: CanvasRenderingContext2D = maybeCtx;

    function resize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    let rafId: number;
    let lastTime = performance.now();

    function animate(now: number) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const speed = 0.5 + intentIntensity * 2;
      setTime((t) => t + dt * speed);

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";

      const projected: { X: number; Y: number; depth: number; w: number }[] = [];

      for (const v of vertices4D.current) {
        const rotated = rotate4D(v, time * speed);
        const p3 = project4Dto3D(rotated);
        const p2 = project3Dto2D(p3, width, height);
        projected.push({ ...p2, w: rotated.w });
      }

      for (const edge of edges.current) {
        const a = projected[edge.a];
        const b = projected[edge.b];
        if (!a || !b) continue;
        const avgDepth = (a.depth + b.depth) / 2;
        const avgW = (a.w + b.w) / 2;

        ctx.strokeStyle = depthColor(avgW);
        ctx.globalAlpha = 0.3 + (0.7 * (avgW + 1)) / 2;
        ctx.beginPath();
        ctx.moveTo(a.X, a.Y);
        ctx.lineTo(b.X, b.Y);
        ctx.stroke();
      }

      if (governanceMode === "violation") {
        ctx.strokeStyle = "#eb5757";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 50 + Math.sin(time * 10) * 10, 0, Math.PI * 2);
        ctx.stroke();
      } else if (governanceMode === "validating") {
        ctx.strokeStyle = "#f2c94c";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -time * 50;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 60, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = "#fff";
      ctx.font = "11px monospace";
      ctx.fillText(`4D Constitutional State`, 10, 20);
      ctx.fillText(`Drift: ${(driftScore * 100).toFixed(1)}%`, 10, 36);
      ctx.fillText(`Evidence: ${(evidenceConfidence * 100).toFixed(1)}%`, 10, 52);
      ctx.fillText(`Intent: ${(intentIntensity * 100).toFixed(1)}%`, 10, 68);
      ctx.fillText(`Mode: ${governanceMode}`, 10, 84);

      rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafId);
    };
  }, [time, governanceMode, driftScore, evidenceConfidence, intentIntensity]);

  return (
    <canvas 
      ref={canvasRef} 
      className="four-d-canvas"
      style={{ width: "100%", height: "100%", minHeight: 300 }}
    />
  );
}