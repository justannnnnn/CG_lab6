import { mat4 } from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2');

if (!gl) {
    alert('WebGL2 не поддерживается в этом браузере.');
}

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0, 0, 0, 1);

const vertexShaderSrc = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aVelocity;
layout(location = 2) in float aLife;
layout(location = 3) in float aStartTime;

uniform float uTime;
uniform mat4 uProjection;
uniform int uEffectType;

out float vLife;

void main() {
    float t = uTime;
    vec3 pos = aPosition + aVelocity * t;
    float life = aLife - t;
    float size = 3.0;

    // FIREWORK
    if(uEffectType == 0) {
        pos.y -= 3.0 * uTime * uTime;
        size = 3.0 + 2.0 * life;
    }

    // SMOKE
    else if(uEffectType == 1) {
        pos.x += sin(uTime + aPosition.x) * 0.5;
        size = 10.0 + (1.0 - life) * 25.0;
    }

    // RAIN
    else if(uEffectType == 2) {
        float speed = -aVelocity.y * 1.5;

        vec3 pos = aPosition;

        pos.y += aVelocity.y * uTime;
        pos.x += aVelocity.x * uTime;
        pos.z += aVelocity.z * uTime;

        float height = 10.0;
        float offset = fract(aPosition.y / height);

        pos.y = mod(pos.y - uTime * speed + offset * height, height);
        pos.x += sin(aPosition.y * 10.0 + uTime) * 0.2;

        float depth = clamp(1.0 - (aPosition.y / height), 0.3, 1.0);

        size = (1.2 + speed * 0.3) * depth;
    }

    // SPARKLER
    else if(uEffectType == 3) {

        float localTime = uTime - aStartTime;

        if(localTime < 0.0) {
            gl_Position = vec4(0.0);
            gl_PointSize = 0.0;
            vLife = 0.0;
            return;
        }

        pos = aPosition + aVelocity * localTime;
        pos.y -= 6.0 * localTime * localTime;
        float trailFade = exp(-localTime * 0.8);
        life = (aLife - localTime) * trailFade;
        size = (2.0 + 2.0 * life) * (1.0 + trailFade);
    }

    // CLOUDS
    else if(uEffectType == 4) {
        float t = uTime;

        pos.x += aVelocity.x * t;
        pos.y += sin(aPosition.x * 0.2 + t * 0.5) * 0.3;

        size = 60.0 + 100.0 * (0.5 + 0.5 * sin(aPosition.x * 0.5 + uTime * 0.3));
    }

    vLife = max(life, 0.0);
    gl_Position = uProjection * vec4(pos, 1.0);
    gl_PointSize = size;
}
`;

const fragmentShaderSrc = `#version 300 es
precision highp float;
precision highp int;

in float vLife;
out vec4 fragColor;

uniform int uEffectType;

void main() {
    float alpha = clamp(vLife, 0.0, 1.0);
    vec2 uv = gl_PointCoord;
    vec2 centered = uv - 0.5;
    float dist = length(centered);
    float circle = smoothstep(0.5, 0.2, dist);
    float finalAlpha = alpha * circle;

    vec4 color;

    // FIREWORK
    if(uEffectType == 0) {
        color = vec4(1.0, 0.5, 0.2, finalAlpha);
    } 
    // SMOKE
    else if(uEffectType == 1) {
        color = vec4(1.0, 1.0, 1.0, finalAlpha * 0.3);
    } 
    // RAIN
    else if(uEffectType == 2) {
        float streak = smoothstep(0.8, 0.0, vLife);

        vec3 base = vec3(0.55, 0.65, 1.0);
        vec3 highlight = vec3(0.9, 0.95, 1.0);
        vec3 colorMix = mix(base, highlight, streak);

        float glow = 1.2;
        float groundFade = smoothstep(0.0, 2.0, vLife);
        finalAlpha *= groundFade;

        color = vec4(colorMix, finalAlpha * 0.8 * glow);
    }
    // SPARKLER 
    else if(uEffectType == 3) {
        float glow = 1.5;
        color = vec4(1.0, 0.8, 0.3, finalAlpha * glow);
    }
    // CLOUDS
    else if(uEffectType == 4) {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float core = exp(-d * d * 6.0);

        float edge = smoothstep(0.35, 0.0, d);

        float edgeGlow = (1.0 - core) * edge;

        float alpha = finalAlpha * (core * 0.4 + edgeGlow * 0.9);

        vec3 baseColor = vec3(1.0);

        vec3 colorMix = baseColor + edgeGlow * vec3(0.2, 0.25, 0.3);
        alpha *= 1.2;
        alpha = clamp(alpha, 0.0, 1.0);

        color = vec4(colorMix, alpha);
    }
    else if(uEffectType == 5) {
        color = vec4(1.0, 1.0, 1.0, finalAlpha * 0.2);
    }
    else {
        color = vec4(1.0, 0.5, 0.2, finalAlpha);
    }

    fragColor = color;
}
`;

function compileShader(src, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

const vertexShader = compileShader(vertexShaderSrc, gl.VERTEX_SHADER);
const fragmentShader = compileShader(fragmentShaderSrc, gl.FRAGMENT_SHADER);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
}
gl.useProgram(program);

const uTimeLocation = gl.getUniformLocation(program, 'uTime');
const uProjectionLocation = gl.getUniformLocation(program, 'uProjection');

if (uTimeLocation === null || uProjectionLocation === null) {
    console.error("Не удалось найти uniform location");
}

let currentEffect = "firework";
let effectIndex = 0;
const effects = ["firework","smoke","rain","sparkler","clouds"];

window.addEventListener("keydown", (e)=>{
    if(e.key === "ArrowRight") {
        effectIndex = (effectIndex+1) % effects.length;
        currentEffect = effects[effectIndex];
        particleSystem.initEffect(currentEffect);
        particleSystem.updateBuffers();
        startTime = performance.now();
    }
});
const uEffectTypeLocation = gl.getUniformLocation(program, 'uEffectType');

class ParticleSystem {
    constructor(maxParticles) {
        this.maxParticles = maxParticles;
        this.positions = new Float32Array(maxParticles * 3);
        this.velocities = new Float32Array(maxParticles * 3);
        this.lifes = new Float32Array(maxParticles);
        this.startTimes = new Float32Array(maxParticles);
        this.activeParticles = 0;
        
        this.startBuffer = gl.createBuffer();
        this.posBuffer = gl.createBuffer();
        this.velBuffer = gl.createBuffer();
        this.lifeBuffer = gl.createBuffer();
    }

    initEffect(type) {
        let count = this.maxParticles;
        if(type === "clouds") {
            count = 3000;
        } else if(type === "rain") {
            count = 40000;
        } else if(type === "smoke") {
            count = 50000;
        } else if(type === "sparkler") {
            count = 50000;
        } else if(type === "firework") {
            count = 10000;
        }
        this.activeParticles = count;
        for (let i = 0; i < this.activeParticles; i++) {
            if(type === "firework") {
                this.positions[i*3+0] = 1;
                this.positions[i*3+1] = 5;
                this.positions[i*3+2] = 2;

                let angle = Math.random() * Math.PI/2 - Math.PI/4; 
                let radiusAngle = Math.random() * 2 * Math.PI;
                let speed = Math.random() * 5 + 5;

                this.velocities[i*3+0] = Math.cos(angle) * Math.cos(radiusAngle) * speed;
                this.velocities[i*3+1] = Math.sin(angle) * speed; 
                this.velocities[i*3+2] = Math.cos(angle) * Math.sin(radiusAngle) * speed;

                this.lifes[i] = Math.random() * 2 + 1;
            } else if(type === "smoke") {
                this.positions[i*3+0] = (Math.random()-0.5) * 2;
                this.positions[i*3+1] = 0;
                this.positions[i*3+2] = (Math.random()-0.5) * 2;

                this.velocities[i*3+0] = (Math.random()-0.5) * 0.2;
                this.velocities[i*3+1] = Math.random() * 0.5 + 0.2;
                this.velocities[i*3+2] = (Math.random()-0.5) * 0.2;

                this.lifes[i] = Math.random() * 3 + 2;
            } else if(type === "rain") {
                this.positions[i*3+0] = (Math.random() - 0.5) * 25;
                this.positions[i*3+1] = Math.random() * 15;
                this.positions[i*3+2] = (Math.random() - 0.5) * 25;

                this.velocities[i*3+0] = (Math.random() - 0.5) * 1.5;
                this.velocities[i*3+1] = - (Math.random() * 10 + 8);
                this.velocities[i*3+2] = (Math.random() - 0.5) * 1.0;

                this.lifes[i] = 9999;
            } else if(type === "sparkler") {
                this.startTimes[i] = Math.random() * 2.0;

                this.positions[i*3+0] = 0;
                this.positions[i*3+1] = 0;
                this.positions[i*3+2] = 0;

                let angle = (Math.random() - 0.5) * Math.PI / 6;
                let spread = Math.random() * 2 * Math.PI;
                let speed = Math.random() * 10 + 6;

                this.velocities[i*3+0] = Math.cos(spread) * Math.sin(angle) * speed;
                this.velocities[i*3+1] = Math.cos(angle) * speed;
                this.velocities[i*3+2] = Math.sin(spread) * Math.sin(angle) * speed;

                this.lifes[i] = Math.random() * 1.2 + 0.8;
            } else if(type === "clouds") {а
                const cx = -10 + Math.random() * 5;
                const cy = 8.5;
                const cz = 0;

                const r = () => (Math.random() + Math.random() + Math.random()) / 3;

                const x = (r() - 0.5) * 10;
                const y = (r() - 0.5) * 4;
                const z = (r() - 0.5) * 2;

                this.positions[i*3+0] = cx + x;
                this.positions[i*3+1] = cy + y;
                this.positions[i*3+2] = cz + z;

                this.velocities[i*3+0] = 0.35;
                this.velocities[i*3+1] = 0;
                this.velocities[i*3+2] = 0;

                this.lifes[i] = 9999;
            }
        }
    }

    updateBuffers() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.velBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.velocities, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.lifes, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);

        if (this.startTimes) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.startBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.startTimes, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(3);
            gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0);
        } else {
            gl.disableVertexAttribArray(3);
        }
    }
    

    render(currentTime, projection, effectType) {
        gl.uniform1f(uTimeLocation, currentTime);
        gl.uniformMatrix4fv(uProjectionLocation, false, projection);
        gl.uniform1i(uEffectTypeLocation, effectType);

        gl.drawArrays(gl.POINTS, 0, this.activeParticles);
    }
}

const particleSystem = new ParticleSystem(100000);
particleSystem.initEffect("firework");
particleSystem.updateBuffers();

let startTime = performance.now();
function render() {
    let currentTime = (performance.now() - startTime) / 1000;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    const projection = mat4.create();
    mat4.ortho(projection, -10, 10, 0, 10, -1, 1);

    particleSystem.render(currentTime, projection, effectIndex);
    requestAnimationFrame(render);
}

render();