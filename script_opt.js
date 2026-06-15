import { mat4 } from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";

const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");
if (!gl) alert("WebGL2 not supported");

canvas.width = innerWidth;
canvas.height = innerHeight;

gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0, 0, 0, 1);

function createGraph(data, title) {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 300;

    const ctx = c.getContext("2d");

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, c.width, c.height);

    // фиксированная шкала FPS
    const min = 0;
    const max = 60;

    ctx.strokeStyle = "white";
    ctx.beginPath();
    ctx.moveTo(40, 20);
    ctx.lineTo(40, 280);
    ctx.lineTo(580, 280);
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.fillText(title, 50, 30);

    // подписи оси Y
    ctx.fillText("60", 5, 25);
    ctx.fillText("30", 5, 150);
    ctx.fillText("0", 15, 285);

    ctx.strokeStyle = "lime";
    ctx.beginPath();

    const w = 540;
    const h = 240;

    for (let i = 0; i < data.length; i++) {
        const x = 40 + (i / data.length) * w;

        const value = Math.min(data[i], max);

        const y =
            280 -
            ((value - min) / (max - min)) * h;

        if (i === 0)
            ctx.moveTo(x, y);
        else
            ctx.lineTo(x, y);
    }

    ctx.stroke();

    return c;
}

function download(canvas, name) {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = name;
    a.click();
}

const vs = `#version 300 es
layout(location=0) in vec2 aQuad;
layout(location=1) in vec3 aPos;
layout(location=2) in vec3 aVel;

uniform float uTime;
uniform mat4 uProj;

void main() {
    vec3 pos = aPos + aVel * uTime;
    pos.y = mod(pos.y + 10.0, 20.0) - 10.0;

    gl_Position = uProj * vec4(pos + vec3(aQuad * 0.15, 0.0), 1.0);
}
`;

const fs = `#version 300 es
precision highp float;
out vec4 color;

void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    color = vec4(0.6, 0.8, 1.0, a);
}
`;

function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, shader(gl.VERTEX_SHADER, vs));
gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(prog);
gl.useProgram(prog);

const COUNT = 50000;

const pos = new Float32Array(COUNT * 3);
const vel = new Float32Array(COUNT * 3);

for (let i = 0; i < COUNT; i++) {
    pos[i*3+0] = (Math.random()-0.5)*10;
    pos[i*3+1] = Math.random()*10;
    pos[i*3+2] = (Math.random()-0.5)*10;

    vel[i*3+0] = (Math.random()-0.5)*0.2;
    vel[i*3+1] = - (Math.random()*2 + 2);
    vel[i*3+2] = (Math.random()-0.5)*0.2;
}

const quad = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);

const quadBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

const posBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);

const velBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, velBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vel, gl.STATIC_DRAW);

function buf(data, loc, size, div) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    if (div !== undefined) gl.vertexAttribDivisor(loc, div);
}

const vaoBefore = gl.createVertexArray();
gl.bindVertexArray(vaoBefore);

gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

gl.bindVertexArray(null);

const vaoAfter = gl.createVertexArray();
gl.bindVertexArray(vaoAfter);

gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
gl.enableVertexAttribArray(1);
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
gl.vertexAttribDivisor(1, 1);

gl.bindBuffer(gl.ARRAY_BUFFER, velBuffer);
gl.enableVertexAttribArray(2);
gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
gl.vertexAttribDivisor(2, 1);

gl.bindVertexArray(null);

const uTime = gl.getUniformLocation(prog, "uTime");
const uProj = gl.getUniformLocation(prog, "uProj");

function drawBefore(time)
{
    gl.uniformMatrix4fv(uProj, false, proj);

    gl.bindVertexArray(vaoBefore);

    for(let i = 0; i < COUNT; i++)
    {
        const px = pos[i*3+0];
        const py = pos[i*3+1];
        const pz = pos[i*3+2];

        const vx = vel[i*3+0];
        const vy = vel[i*3+1];
        const vz = vel[i*3+2];

        gl.vertexAttrib3f(1, px, py, pz);
        gl.vertexAttrib3f(2, vx, vy, vz);

        gl.uniform1f(uTime, time);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}

function drawAfter(time)
{
    gl.uniform1f(uTime, time);
    gl.uniformMatrix4fv(uProj, false, proj);

    gl.bindVertexArray(vaoAfter);

    gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        4,
        COUNT
    );
}

const proj = mat4.create();
mat4.ortho(proj, -10, 10, -10, 10, -1, 1);

let mode = "before";
let fpsA = [], fpsB = [];

let last = performance.now();
let start = performance.now();
const DURATION = 8000;

function loop() {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;

    const fps = dt > 0 ? 1 / dt : 0;

    gl.clear(gl.COLOR_BUFFER_BIT);

    if(mode === "before")
    {
        drawBefore(now * 0.001);
    }
    else
    {
        drawAfter(now * 0.001);
    }

    (mode === "before" ? fpsA : fpsB).push(fps);

    if (now - start > DURATION) {
        if (mode === "before") {
            mode = "after";
            start = now;
        } else {
            console.log(
                "BEFORE avg FPS",
                fpsA.reduce((a,b)=>a+b,0)/fpsA.length
            );

            console.log(
                "AFTER avg FPS",
                fpsB.reduce((a,b)=>a+b,0)/fpsB.length
            );
            download(createGraph(fpsA, "BEFORE"), "before.png");
            download(createGraph(fpsB, "AFTER"), "after.png");
            return;
        }
    }

    requestAnimationFrame(loop);
}

loop();